import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
    buildSettledChallanAmountMap,
    getChallanNetPayable,
} from '@/lib/server/challanBillingSnapshot';

const roundMoney = (value: number) => Number(value.toFixed(2));

const normalizeLineItems = (value: unknown) => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const label = String((item as { label?: unknown })?.label || '').trim();
            const amount = Number((item as { amount?: unknown })?.amount || 0);

            if (!label || Number.isNaN(amount) || amount <= 0) return null;

            return { label, amount: roundMoney(amount) };
        })
        .filter((item): item is { label: string; amount: number } => item !== null);
};

interface NormalizedChallanAllocation {
    challan_no: string;
    settled_amount: number;
    deduction_items: Array<{ label: string; amount: number }>;
    addition_items: Array<{ label: string; amount: number }>;
    deduction_total: number;
    addition_total: number;
    net_paid_amount: number;
}

const normalizeChallanAllocations = (value: unknown): NormalizedChallanAllocation[] => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const challanNo = String((item as { challan_no?: unknown })?.challan_no || '').trim();
            const settledAmount = roundMoney(Number((item as { settled_amount?: unknown })?.settled_amount || 0));
            const deductionItems = normalizeLineItems((item as { deduction_items?: unknown })?.deduction_items);
            const additionItems = normalizeLineItems((item as { addition_items?: unknown })?.addition_items);

            if (!challanNo || Number.isNaN(settledAmount) || settledAmount <= 0) return null;

            const deductionTotal = roundMoney(deductionItems.reduce((sum, d) => sum + d.amount, 0));
            const additionTotal = roundMoney(additionItems.reduce((sum, a) => sum + a.amount, 0));

            return {
                challan_no: challanNo,
                settled_amount: settledAmount,
                deduction_items: deductionItems,
                addition_items: additionItems,
                deduction_total: deductionTotal,
                addition_total: additionTotal,
                net_paid_amount: roundMoney(settledAmount + additionTotal - deductionTotal),
            };
        })
        .filter((item): item is NormalizedChallanAllocation => item !== null);
};

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ brokerId: string }> }
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

    const { brokerId } = await params;

    const { data: account, error: accountError } = await supabase
        .from('broker_ledger_accounts')
        .select('id')
        .eq('broker_id', brokerId)
        .single();

    if (accountError || !account) {
        return NextResponse.json({ error: 'Ledger account not found for this broker' }, { status: 404 });
    }

    const body = await request.json();
    const {
        receipt_date,
        payment_mode,
        reference_no,
        bank_name,
        narration,
        payer_name,
        challan_allocations,
    } = body;

    const validModes = ['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'ADJUSTMENT'];
    const mode = (payment_mode || 'CASH').toUpperCase();
    if (!validModes.includes(mode)) {
        return NextResponse.json({ error: `payment_mode must be one of: ${validModes.join(', ')}` }, { status: 400 });
    }

    const normalizedAllocations = normalizeChallanAllocations(challan_allocations);
    if (Array.isArray(challan_allocations) && normalizedAllocations.length !== challan_allocations.length) {
        return NextResponse.json({ error: 'Each challan line needs a valid challan number and a settled amount greater than zero.' }, { status: 400 });
    }

    if (normalizedAllocations.length === 0) {
        return NextResponse.json({ error: 'Select at least one challan and enter the amount paid against it.' }, { status: 400 });
    }

    const seenChallans = new Set<string>();
    for (const allocation of normalizedAllocations) {
        if (seenChallans.has(allocation.challan_no)) {
            return NextResponse.json({ error: `Challan ${allocation.challan_no} cannot be added more than once in a single payment.` }, { status: 400 });
        }
        seenChallans.add(allocation.challan_no);
    }

    const challanNos = normalizedAllocations.map((allocation) => allocation.challan_no);

    const { data: challans, error: challansError } = await supabase
        .from('challans')
        .select('id, challan_no, total_hire_amount, extra_hire_amount, advance_amount, less_tds, status, broker_id')
        .eq('broker_id', brokerId)
        .eq('status', 'ACTIVE')
        .in('challan_no', challanNos);

    if (challansError) {
        return NextResponse.json({ error: challansError.message }, { status: 400 });
    }

    const challanMap = new Map((challans || []).map((challan) => [challan.challan_no, challan]));
    const missingChallans = challanNos.filter((challanNo) => !challanMap.has(challanNo));
    if (missingChallans.length > 0) {
        return NextResponse.json(
            { error: `These challans are invalid, cancelled, or belong to another broker: ${missingChallans.join(', ')}` },
            { status: 400 }
        );
    }

    // Already-settled amounts from existing active receipts.
    const { data: existingReceipts, error: existingReceiptsError } = await supabase
        .from('broker_challan_payment_receipts')
        .select('status, challan_allocations')
        .eq('broker_id', brokerId)
        .eq('status', 'ACTIVE');

    if (existingReceiptsError) {
        return NextResponse.json({ error: existingReceiptsError.message }, { status: 400 });
    }

    const alreadySettledMap = buildSettledChallanAmountMap(existingReceipts || []);

    for (const allocation of normalizedAllocations) {
        const challan = challanMap.get(allocation.challan_no)!;
        const netPayable = getChallanNetPayable(challan);
        const alreadySettled = alreadySettledMap.get(allocation.challan_no) || 0;
        const remaining = roundMoney(Math.max(netPayable - alreadySettled, 0));

        if (remaining <= 0.009) {
            return NextResponse.json({ error: `Challan ${allocation.challan_no} is already fully paid.` }, { status: 400 });
        }

        if (allocation.settled_amount > remaining + 0.009) {
            return NextResponse.json(
                { error: `Amount for challan ${allocation.challan_no} cannot exceed its remaining balance of ₹${remaining}.` },
                { status: 400 }
            );
        }
    }

    const amount = roundMoney(normalizedAllocations.reduce((sum, allocation) => sum + allocation.settled_amount, 0));

    if (amount <= 0) {
        return NextResponse.json({ error: 'Total settled amount must be greater than zero.' }, { status: 400 });
    }

    const storedAllocations = normalizedAllocations.map((allocation) => ({
        challan_no: allocation.challan_no,
        settled_amount: allocation.settled_amount,
        deduction_items: allocation.deduction_items,
        addition_items: allocation.addition_items,
        deduction_total: allocation.deduction_total,
        addition_total: allocation.addition_total,
        net_paid_amount: allocation.net_paid_amount,
    }));

    const { data, error } = await supabase
        .from('broker_challan_payment_receipts')
        .insert({
            broker_ledger_account_id: account.id,
            broker_id: brokerId,
            receipt_date: receipt_date || new Date().toISOString().split('T')[0],
            amount,
            actual_received_amount: amount,
            payment_mode: mode,
            reference_no: reference_no || null,
            bank_name: bank_name || null,
            narration: narration || null,
            payer_name: payer_name?.trim() || null,
            challan_allocations: storedAllocations,
            related_billing_record_ids: [],
            bill_allocations: [],
            created_by: user.id,
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create broker challan payment receipt:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
