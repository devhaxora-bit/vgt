import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const roundMoney = (value: number) => Number(value.toFixed(2));

const normalizeDeductionItems = (value: unknown) => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const label = String((item as { label?: unknown })?.label || '').trim();
            const amount = Number((item as { amount?: unknown })?.amount || 0);

            if (!label || Number.isNaN(amount) || amount <= 0) return null;

            return {
                label,
                amount: roundMoney(amount),
            };
        })
        .filter((item): item is { label: string; amount: number } => item !== null);
};

const normalizeBillAllocations = (value: unknown) => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const billingRecordId = String((item as { billing_record_id?: unknown })?.billing_record_id || '').trim();
            const receivedAmount = Number((item as { received_amount?: unknown })?.received_amount || 0);
            const deductionItems = normalizeDeductionItems((item as { deduction_items?: unknown })?.deduction_items);
            const settledAmount = roundMoney(receivedAmount + deductionItems.reduce((sum, deduction) => sum + deduction.amount, 0));

            if (!billingRecordId || Number.isNaN(receivedAmount) || receivedAmount < 0 || settledAmount <= 0) return null;

            return {
                billing_record_id: billingRecordId,
                received_amount: roundMoney(receivedAmount),
                settled_amount: settledAmount,
                deduction_items: deductionItems,
            };
        })
        .filter((item): item is {
            billing_record_id: string;
            received_amount: number;
            settled_amount: number;
            deduction_items: Array<{ label: string; amount: number }>;
        } => item !== null);
};

// POST /api/ledger/[partyId]/payments
// Record a payment receipt (admin only)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string }> }
) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { partyId } = await params;

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
                if (allocation.settled_amount > billAmount + 0.009) {
                    return NextResponse.json({ error: 'Settled amount cannot exceed the selected bill amount' }, { status: 400 });
                }
            }
        }
    }

    let amountNum = Number(amount);
    let actualReceivedAmountNum = Number(actual_received_amount);

    if (normalizedBillAllocations.length > 0) {
        amountNum = roundMoney(normalizedBillAllocations.reduce((sum, allocation) => sum + allocation.settled_amount, 0));
        actualReceivedAmountNum = roundMoney(normalizedBillAllocations.reduce((sum, allocation) => sum + allocation.received_amount, 0));
    } else {
        if (!amount) {
            return NextResponse.json({ error: 'amount is required' }, { status: 400 });
        }

        if (Number.isNaN(amountNum) || amountNum <= 0) {
            return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
        }

        if (actual_received_amount === null || actual_received_amount === undefined || actual_received_amount === '') {
            actualReceivedAmountNum = amountNum;
        }
    }

    if (Number.isNaN(actualReceivedAmountNum) || actualReceivedAmountNum < 0) {
        return NextResponse.json({ error: 'actual_received_amount must be zero or a positive number' }, { status: 400 });
    }

    if (actualReceivedAmountNum > amountNum) {
        return NextResponse.json({ error: 'actual_received_amount cannot exceed the settled receipt amount' }, { status: 400 });
    }

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
            created_by: user.id,
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create payment receipt:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
