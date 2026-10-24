import { NextRequest, NextResponse } from 'next/server';

import {
    buildSettledBillAmountMap,
    normalizeBillAllocations,
    resolvePaymentAmounts,
} from '@/lib/server/partyPaymentReceipts';
import { roundMoney } from '@/lib/money';
import { requireAuthz, requirePartyBranchAccess } from '@/lib/server/requireAuthz';

// POST /api/ledger/[partyId]/payments
// Record a payment receipt (admin only)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string }> }
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { partyId } = await params;
    const partyAccess = await requirePartyBranchAccess(auth, partyId);
    if (!partyAccess.ok) return partyAccess.response;

    const supabase = auth.supabase;
    const userId = auth.user.id;

    const { data: account, error: accountError } = await supabase
        .from('party_ledger_accounts')
        .select('id')
        .eq('party_id', partyId)
        .single();

    if (accountError || !account) {
        return NextResponse.json({ error: 'Ledger account not found for this party' }, { status: 404 });
    }

    const body = await request.json();
    const { receipt_date, amount, payment_mode, reference_no, bank_name, narration, related_billing_record_ids, actual_received_amount, bill_allocations } = body;

    const validModes = ['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'ADJUSTMENT'];
    const mode = (payment_mode || 'CASH').toUpperCase();
    if (!validModes.includes(mode)) {
        return NextResponse.json({ error: `payment_mode must be one of: ${validModes.join(', ')}` }, { status: 400 });
    }

    const normalizedBillAllocations = normalizeBillAllocations(bill_allocations);
    if (Array.isArray(bill_allocations) && normalizedBillAllocations.length !== bill_allocations.length) {
        return NextResponse.json({ error: 'Each selected bill must have a valid settled amount and deduction breakup' }, { status: 400 });
    }

    const normalizedBillingRecordIdsFromBody = Array.isArray(related_billing_record_ids)
        ? related_billing_record_ids.map((value) => String(value).trim()).filter(Boolean)
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

            const alreadySettledMap = buildSettledBillAmountMap(existingReceipts || []);
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
        amount,
        actualReceivedAmount: actual_received_amount,
        allocations: normalizedBillAllocations,
    });

    if (!amounts.ok) {
        return NextResponse.json({ error: amounts.error }, { status: 400 });
    }

    const amountNum = amounts.amount;
    const actualReceivedAmountNum = amounts.actualReceivedAmount;

    const { data, error } = await supabase
        .from('party_payment_receipts')
        .insert({
            party_ledger_account_id: account.id,
            party_id: partyId,
            receipt_date: receipt_date || new Date().toISOString().split('T')[0],
            amount: amountNum,
            actual_received_amount: actualReceivedAmountNum,
            payment_mode: mode,
            reference_no: reference_no || null,
            bank_name: bank_name || null,
            narration: narration || null,
            related_billing_record_ids: normalizedBillingRecordIds.length > 0 ? normalizedBillingRecordIds : null,
            bill_allocations: normalizedBillAllocations,
            branch_code: partyAccess.entity.branch_code,
            created_by: userId,
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create payment receipt:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
