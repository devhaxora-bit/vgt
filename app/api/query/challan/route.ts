import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const round = (value: number) => Number(value.toFixed(2));

// GET /api/query/challan?id=uuid -> challan + hire settlement + broker bill / payment status
export async function GET(request: Request) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id) return NextResponse.json({ error: 'Provide ?id=' }, { status: 400 });

    const { data: challan, error } = await supabase
        .from('challans')
        .select(`
            *,
            origin_branch:branches!origin_branch_code(name, city),
            destination_branch:branches!destination_branch_code(name, city)
        `)
        .eq('id', id)
        .single();

    if (error || !challan) {
        return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    const grossHire = toNumber(challan.total_hire_amount);
    const advance = toNumber(challan.advance_amount);
    const tds = toNumber(challan.less_tds);
    const balancePayable = round(grossHire - advance - tds);

    // Is this challan covered by an active broker challan bill?
    let brokerBill = null;
    let payments: Array<Record<string, unknown>> = [];

    const { data: billRows } = await supabase
        .from('broker_challan_billing_records')
        .select('id, bill_ref_no, billing_date, amount, status, broker_id')
        .contains('covered_challan_nos', [challan.challan_no])
        .eq('status', 'ACTIVE')
        .order('billing_date', { ascending: false })
        .limit(1);

    if (billRows && billRows.length > 0) {
        const row = billRows[0];
        let brokerName: string | null = challan.broker_name ?? null;
        if (row.broker_id) {
            const { data: broker } = await supabase
                .from('brokers')
                .select('name')
                .eq('id', row.broker_id)
                .maybeSingle();
            brokerName = broker?.name ?? brokerName;
        }
        brokerBill = {
            id: row.id,
            bill_ref_no: row.bill_ref_no,
            billing_date: row.billing_date,
            amount: toNumber(row.amount),
            status: row.status,
            broker_name: brokerName,
        };

        const { data: payRows } = await supabase
            .from('broker_challan_payment_receipts')
            .select('id, receipt_date, amount, payment_mode, reference_no, status')
            .contains('related_billing_record_ids', [row.id])
            .eq('status', 'ACTIVE')
            .order('receipt_date', { ascending: false });
        payments = (payRows ?? []).map((p) => ({
            id: p.id,
            receipt_date: p.receipt_date,
            amount: toNumber(p.amount),
            payment_mode: p.payment_mode,
            reference_no: p.reference_no,
            status: p.status,
        }));
    }

    const paidTotal = round(payments.reduce((sum, p) => sum + toNumber(p.amount), 0));
    const billedAmount = brokerBill ? toNumber(brokerBill.amount) : 0;
    const pendingAmount = brokerBill ? round(billedAmount - paidTotal) : balancePayable;

    return NextResponse.json({
        challan,
        settlement: { gross_hire: grossHire, advance, tds, balance_payable: balancePayable },
        broker_bill: brokerBill,
        payments,
        paid_total: paidTotal,
        pending_amount: pendingAmount,
    });
}
