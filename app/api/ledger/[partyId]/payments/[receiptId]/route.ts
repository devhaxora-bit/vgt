import { NextRequest, NextResponse } from 'next/server';

import {
    buildSettledBillAmountMap,
    normalizeBillAllocations,
    resolvePaymentAmounts,
} from '@/lib/server/partyPaymentReceipts';
import { requireAuthz, requirePartyBranchAccess } from '@/lib/server/requireAuthz';

const roundMoney = (value: number) => Number(value.toFixed(2));
const VALID_MODES = ['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'ADJUSTMENT'] as const;

// PATCH /api/ledger/[partyId]/payments/[receiptId]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string; receiptId: string }> }
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { partyId, receiptId } = await params;
    const partyAccess = await requirePartyBranchAccess(auth, partyId);
    if (!partyAccess.ok) return partyAccess.response;

    const supabase = auth.supabase;
    const body = await request.json() as {
        receipt_date?: string;
        amount?: number | string;
        payment_mode?: string;
        reference_no?: string | null;
        bank_name?: string | null;
        narration?: string | null;
        related_billing_record_ids?: string[] | null;
        actual_received_amount?: number | string | null;
        bill_allocations?: unknown;
    };

    const { data: receipt, error: receiptError } = await supabase
        .from('party_payment_receipts')
        .select('id, status, branch_code')
        .eq('id', receiptId)
        .eq('party_id', partyId)
        .single();

    if (receiptError || !receipt) {
        return NextResponse.json({ error: 'Payment receipt not found' }, { status: 404 });
    }

    const forbiddenRecord = auth.forbidIfForeignBranch(receipt.branch_code);
    if (forbiddenRecord) return forbiddenRecord;

    if (receipt.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Only active payment receipts can be edited' }, { status: 400 });
    }

    if (!body.receipt_date) {
        return NextResponse.json({ error: 'receipt_date is required' }, { status: 400 });
    }

    const mode = String(body.payment_mode || 'CASH').toUpperCase();
    if (!VALID_MODES.includes(mode as (typeof VALID_MODES)[number])) {
        return NextResponse.json({ error: `payment_mode must be one of: ${VALID_MODES.join(', ')}` }, { status: 400 });
    }

    const normalizedBillAllocations = normalizeBillAllocations(body.bill_allocations);
    if (Array.isArray(body.bill_allocations) && normalizedBillAllocations.length !== body.bill_allocations.length) {
        return NextResponse.json({ error: 'Each selected bill must have a valid settled amount and deduction breakup' }, { status: 400 });
    }

    const normalizedBillingRecordIdsFromBody = Array.isArray(body.related_billing_record_ids)
        ? body.related_billing_record_ids.map((value) => String(value).trim()).filter(Boolean)
        : [];
    const normalizedBillingRecordIds = normalizedBillAllocations.length > 0
        ? normalizedBillAllocations.map((allocation) => allocation.billing_record_id)
        : normalizedBillingRecordIdsFromBody;

    if (normalizedBillingRecordIds.length > 0) {
        const { data: billingRecords, error: billingRecordsError } = await supabase
            .from('party_billing_records')
            .select('id, status, amount')
            .eq('party_id', partyId)
            .in('id', normalizedBillingRecordIds);

        if (billingRecordsError) {
            return NextResponse.json({ error: billingRecordsError.message }, { status: 400 });
        }

        if (!billingRecords || billingRecords.length !== normalizedBillingRecordIds.length) {
            return NextResponse.json({ error: 'One or more selected bills are invalid for this party' }, { status: 400 });
        }

        if (billingRecords.some((record) => record.status !== 'ACTIVE')) {
            return NextResponse.json({ error: 'Payments can only be linked to active bills' }, { status: 400 });
        }

        if (normalizedBillAllocations.length > 0) {
            const { data: existingReceipts, error: existingReceiptsError } = await supabase
                .from('party_payment_receipts')
                .select('id, amount, status, related_billing_record_ids, bill_allocations')
                .eq('party_id', partyId)
                .eq('status', 'ACTIVE');

            if (existingReceiptsError) {
                return NextResponse.json({ error: existingReceiptsError.message }, { status: 400 });
            }

            const alreadySettledMap = buildSettledBillAmountMap(existingReceipts || [], receiptId);
            const billAmountMap = new Map(
                billingRecords.map((record) => [record.id, Number(record.amount || 0)])
            );

            const seenBillIds = new Set<string>();
            for (const allocation of normalizedBillAllocations) {
                if (seenBillIds.has(allocation.billing_record_id)) {
                    return NextResponse.json({ error: 'The same bill cannot be selected more than once in a payment receipt' }, { status: 400 });
                }
                seenBillIds.add(allocation.billing_record_id);

                const billAmount = billAmountMap.get(allocation.billing_record_id) || 0;
                const alreadySettledAmount = alreadySettledMap.get(allocation.billing_record_id) || 0;
                const remainingBillAmount = roundMoney(Math.max(billAmount - alreadySettledAmount, 0));

                if (remainingBillAmount <= 0.009) {
                    return NextResponse.json({ error: 'One or more selected bills are already fully settled' }, { status: 400 });
                }

                if (allocation.settled_amount > remainingBillAmount + 0.009) {
                    return NextResponse.json({ error: 'Settled amount cannot exceed the remaining balance for the selected bill' }, { status: 400 });
                }
            }
        }
    }

    const amounts = resolvePaymentAmounts({
        amount: body.amount,
        actualReceivedAmount: body.actual_received_amount,
        allocations: normalizedBillAllocations,
    });

    if (!amounts.ok) {
        return NextResponse.json({ error: amounts.error }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('party_payment_receipts')
        .update({
            receipt_date: body.receipt_date,
            amount: amounts.amount,
            actual_received_amount: amounts.actualReceivedAmount,
            payment_mode: mode,
            reference_no: body.reference_no || null,
            bank_name: body.bank_name || null,
            narration: body.narration || null,
            related_billing_record_ids: normalizedBillingRecordIds.length > 0 ? normalizedBillingRecordIds : null,
            bill_allocations: normalizedBillAllocations,
        })
        .eq('id', receiptId)
        .eq('party_id', partyId)
        .select()
        .single();

    if (error) {
        console.error('Failed to update payment receipt:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
