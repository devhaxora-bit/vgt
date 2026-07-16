import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
    buildSettledChallanBillAmountMap,
    getChallanBillPaymentStatus,
    buildSettledChallanAmountMap,
    getChallanNetPayable,
    getChallanPaymentStatus,
} from '@/lib/server/challanBillingSnapshot';
import { requireAuthz } from '@/lib/server/requireAuthz';

const roundMoney = (value: number) => Number(value.toFixed(2));
const parseMoney = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const getChallanFullHire = (record: {
    total_hire_amount?: number | string | null;
    extra_hire_amount?: number | string | null;
}) => roundMoney(parseMoney(record.total_hire_amount) + parseMoney(record.extra_hire_amount));

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ brokerId: string }> }
) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const supabase = auth.supabase;

    const { brokerId } = await params;
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    const { data: broker, error: brokerError } = await supabase
        .from('brokers')
        .select('*')
        .eq('id', brokerId)
        .single();

    if (brokerError || !broker) {
        return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    }

    // Prefer broker.branch_code when migration applied; fall back to challan origin filter
    if (broker.branch_code) {
        const forbidden = auth.forbidIfForeignBranch(broker.branch_code);
        if (forbidden) return forbidden;
    }

    const { data: account } = await supabase
        .from('broker_ledger_accounts')
        .select('*')
        .eq('broker_id', brokerId)
        .single();

    let allChallansQuery = supabase
        .from('challans')
        .select('id, challan_no, date_from, truck_schedule_date, origin_branch_code, destination_branch_code, loading_point, destination_point, vehicle_no, driver_name, driver_mobile, owner_name, owner_mobile, owner_address, broker_name, broker_code, linked_cn_nos, total_hire_amount, extra_hire_amount, advance_amount, hire_amount, extra_km_charges, detent_charges, unloading_charges, total_extra_charges, less_tds, status, engagement_type, created_at')
        .eq('broker_id', brokerId)
        .eq('status', 'ACTIVE')
        .order('date_from', { ascending: false })
        .order('challan_no', { ascending: false });

    const listBranch = auth.resolveListBranch(null);
    if (listBranch) {
        allChallansQuery = allChallansQuery.eq('origin_branch_code', listBranch);
    }

    const { data: allChallans } = await allChallansQuery;

    const challans = (allChallans || []).filter((record) => {
        const challanDate = record.date_from?.slice(0, 10) || '';
        if (dateFrom && challanDate < dateFrom) return false;
        if (dateTo && challanDate > dateTo) return false;
        if (search && !String(record.challan_no || '').toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    // Branch-scoped user viewing a shared legacy broker with no branch_code: require at least one in-scope challan
    if (!broker.branch_code && auth.isBranchScoped && challans.length === 0) {
        return NextResponse.json({ error: 'Forbidden: Outside your branch scope' }, { status: 403 });
    }

    const { data: allBillingRecords } = await supabase
        .from('broker_challan_billing_records')
        .select('*')
        .eq('broker_id', brokerId)
        .order('billing_date', { ascending: false })
        .order('created_at', { ascending: false });

    const billingRecords = (allBillingRecords || []).filter((record) => {
        const billingDate = record.billing_date?.slice(0, 10) || '';
        if (dateFrom && billingDate < dateFrom) return false;
        if (dateTo && billingDate > dateTo) return false;
        return true;
    });

    const { data: allPaymentReceipts } = await supabase
        .from('broker_challan_payment_receipts')
        .select('*')
        .eq('broker_id', brokerId)
        .order('receipt_date', { ascending: false });

    const paymentReceipts = (allPaymentReceipts || []).filter((record) => {
        const receiptDate = record.receipt_date?.slice(0, 10) || '';
        if (dateFrom && receiptDate < dateFrom) return false;
        if (dateTo && receiptDate > dateTo) return false;
        return true;
    });

    let summaryChallans = challans || [];
    if (dateFrom || dateTo) {
        const billedChallanNos = new Set<string>();
        (billingRecords || []).forEach((bill) => {
            if (bill.status !== 'ACTIVE') return;
            const raw = bill.covered_challan_nos;
            const challanNos: string[] = Array.isArray(raw)
                ? raw.map((value: unknown) => String(value).trim()).filter(Boolean)
                : [];
            challanNos.forEach((challanNo) => billedChallanNos.add(challanNo));
        });

        if (billedChallanNos.size > 0) {
            const existing = new Set(summaryChallans.map((ch) => ch.challan_no));
            const additional = (allChallans || []).filter(
                (ch) => billedChallanNos.has(ch.challan_no) && !existing.has(ch.challan_no)
            );
            if (additional.length > 0) {
                summaryChallans = [...summaryChallans, ...additional];
            }
        }
    }

    const activeBills = ((billingRecords || []) as Array<{ status: string }>).filter((b) => b.status === 'ACTIVE');
    const activePayments = ((paymentReceipts || []) as Array<{ status: string }>).filter((p) => p.status === 'ACTIVE');

    const totalChallanAmount = summaryChallans.reduce(
        (sum, ch) => sum + getChallanFullHire(ch),
        0
    );
    const totalAdvanceAmount = roundMoney(
        summaryChallans.reduce((sum, ch) => sum + parseMoney(ch.advance_amount), 0)
    );
    const totalTdsAmount = roundMoney(
        summaryChallans.reduce((sum, ch) => sum + parseMoney(ch.less_tds), 0)
    );
    const totalNetPayable = roundMoney(
        summaryChallans.reduce((sum, ch) => sum + getChallanNetPayable(ch), 0)
    );
    const totalBilled = activeBills.reduce(
        (sum, b) => sum + parseMoney((b as { amount?: unknown }).amount),
        0
    );
    const totalPaid = activePayments.reduce(
        (sum, p) => sum + parseMoney((p as { amount?: unknown }).amount),
        0
    );
    const openingBalance = parseMoney(account?.opening_balance);
    const rawUnbilledAmount = roundMoney(totalChallanAmount - totalBilled);

    const settledBillMap = buildSettledChallanBillAmountMap(allPaymentReceipts || []);

    const enrichedBillingRecords = (billingRecords || []).map((record) => {
        const billAmount = parseMoney(record.amount);
        const settledAmount = settledBillMap.get(record.id) || 0;
        const remainingAmount = roundMoney(Math.max(billAmount - settledAmount, 0));

        return {
            ...record,
            settled_amount: settledAmount,
            remaining_amount: remainingAmount,
            payment_status: getChallanBillPaymentStatus(billAmount, settledAmount),
        };
    });

    const billedChallanNos = new Set<string>();
    activeBills.forEach((bill) => {
        const raw = (bill as { covered_challan_nos?: string[] }).covered_challan_nos;
        (raw || []).forEach((challanNo) => billedChallanNos.add(String(challanNo).trim()));
    });

    const settledChallanMap = buildSettledChallanAmountMap(allPaymentReceipts || []);

    const enrichedChallans = (challans || []).map((challan) => {
        const fullHire = getChallanFullHire(challan);
        const netPayable = getChallanNetPayable(challan);
        const paidAmount = roundMoney(settledChallanMap.get(challan.challan_no) || 0);
        const balanceAmount = roundMoney(Math.max(netPayable - paidAmount, 0));
        return {
            ...challan,
            full_hire_amount: fullHire,
            net_payable_amount: netPayable,
            advance_amount: roundMoney(parseMoney(challan.advance_amount)),
            less_tds: roundMoney(parseMoney(challan.less_tds)),
            paid_amount: paidAmount,
            balance_amount: balanceAmount,
            payment_status: getChallanPaymentStatus(netPayable, paidAmount),
            bill_status: billedChallanNos.has(challan.challan_no) ? 'BILLED' : 'UNBILLED',
        };
    });

    const { data: allActiveChallans } = await supabase
        .from('challans')
        .select('linked_cn_nos')
        .eq('status', 'ACTIVE');

    const linkedCnSet = new Set<string>();
    (allActiveChallans || []).forEach((challan) => {
        (challan.linked_cn_nos || []).forEach((cnNo: string) => {
            if (cnNo) linkedCnSet.add(String(cnNo).trim());
        });
    });

    const { data: allConsignments } = await supabase
        .from('consignments')
        .select('id, cn_no, bkg_date, booking_branch, loading_point, dest_branch, delivery_point, total_freight, vehicle_no, cancel_cn')
        .eq('cancel_cn', false)
        .order('bkg_date', { ascending: false })
        .limit(5000);

    const unchallanedCns = (allConsignments || []).filter((cns) => {
        const cnNo = String(cns.cn_no || '').trim();
        return cnNo && !linkedCnSet.has(cnNo);
    });

    const summary = {
        total_challan_amount: totalChallanAmount,
        total_challan_count: summaryChallans.length,
        total_advance_amount: totalAdvanceAmount,
        total_tds_amount: totalTdsAmount,
        net_payable_amount: totalNetPayable,
        total_billed: totalBilled,
        total_paid: totalPaid,
        unbilled_amount: Math.max(rawUnbilledAmount, 0),
        overbilled_amount: Math.max(-rawUnbilledAmount, 0),
        outstanding: roundMoney(openingBalance + totalNetPayable - totalPaid),
        opening_balance: openingBalance,
        total_bills_count: activeBills.length,
        unchallaned_cns_count: unchallanedCns.length,
        unchallaned_cns_amount: roundMoney(
            unchallanedCns.reduce((sum, cns) => sum + parseMoney(cns.total_freight), 0)
        ),
    };

    return NextResponse.json({
        broker,
        account: account || null,
        summary,
        challans: enrichedChallans,
        all_challans: allChallans || [],
        billing_records: enrichedBillingRecords,
        payment_receipts: paymentReceipts || [],
        unchallaned_cns: unchallanedCns,
        all_billing_records: allBillingRecords || [],
        all_payment_receipts: allPaymentReceipts || [],
    });
}
