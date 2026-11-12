import { NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';
import { fetchAllRows } from '@/lib/server/fetchAllRows';
import { buildSettledChallanAmountMap, getChallanNetPayable } from '@/lib/server/challanBillingSnapshot';
import { roundMoney } from '@/lib/money';
import { lorryHirePaymentSchema } from '@/lib/schemas/lorryHire.schema';

export async function GET() {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;
    const [challans, payments, receipts] = await Promise.all([
        fetchAllRows(() => {
            let query = auth.supabase.from('challans').select('id, challan_no, vehicle_no, date_from, origin_branch_code, broker_id, owner_name, broker_name, linked_cn_nos, total_hire_amount, extra_hire_amount, advance_amount, less_tds').eq('status', 'ACTIVE').order('date_from', { ascending: false }).order('challan_no', { ascending: false });
            if (auth.isBranchScoped) query = query.eq('origin_branch_code', auth.branchCode!);
            return query;
        }),
        fetchAllRows(() => {
            let query = auth.supabase.from('lorry_hire_payments').select('*').order('created_at', { ascending: false }).order('id');
            if (auth.isBranchScoped) query = query.eq('branch_code', auth.branchCode!);
            return query;
        }),
        fetchAllRows(() => auth.supabase.from('broker_challan_payment_receipts').select('id, status, challan_allocations').eq('status', 'ACTIVE').order('id')),
    ]);
    const error = challans.error || payments.error || receipts.error;
    if (error) return NextResponse.json({ error }, { status: 500 });
    const settled = buildSettledChallanAmountMap(receipts.data || []);
    const activeReceiptIds = new Set((receipts.data || []).map(r => r.id));
    const history = (payments.data || []).map(p => ({ ...p, active: !p.broker_receipt_id || activeReceiptIds.has(p.broker_receipt_id) }));
    const rows = (challans.data || []).flatMap(ch => {
        const challanNo = String(ch.challan_no || '').trim().toUpperCase();
        const hire = Number(ch.total_hire_amount || 0) + Number(ch.extra_hire_amount || 0);
        // Skip test fixtures and placeholder challans with no hire (e.g. default next-challan 300066955).
        if (!challanNo || challanNo.startsWith('TEST-') || hire <= 0) return [];
        const active = history.filter(p => p.challan_id === ch.id && p.active);
        const paid = ch.broker_id
            ? (settled.get(ch.challan_no) || 0)
            : active.filter(p => p.payment_type !== 'ADVANCE').reduce((sum, p) => sum + Number(p.amount), 0);
        return [{ ...ch, recorded_advance: roundMoney(active.filter(p => p.payment_type === 'ADVANCE').reduce((sum, p) => sum + Number(p.amount), 0)), paid_amount: roundMoney(paid), remaining: roundMoney(Math.max(getChallanNetPayable(ch) - paid, 0)) }];
    });
    return NextResponse.json({ challans: rows, payments: history, can_pay: auth.user.role.toLowerCase() === 'admin' });
}

export async function POST(request: Request) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 }); }
    const parsed = lorryHirePaymentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const { data: challan, error: lookupError } = await auth.supabase.from('challans').select('origin_branch_code').eq('id', parsed.data.challan_id).single();
    if (lookupError || !challan) return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    const forbidden = auth.forbidIfForeignBranch(challan.origin_branch_code);
    if (forbidden) return forbidden;
    const { data, error } = await auth.supabase.from('lorry_hire_payments').insert({ ...parsed.data, branch_code: challan.origin_branch_code, created_by: auth.user.id }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
}
