import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const hasLedgerActivity = (row: {
    opening_balance?: number | string | null;
    total_challan_amount?: number | string | null;
    total_challan_count?: number | string | null;
    total_billed?: number | string | null;
    total_paid?: number | string | null;
    unbilled_amount?: number | string | null;
    overbilled_amount?: number | string | null;
    outstanding?: number | string | null;
}) => {
    const toNumber = (value: number | string | null | undefined) => Number(value || 0);

    return (
        toNumber(row.opening_balance) !== 0 ||
        toNumber(row.total_challan_amount) !== 0 ||
        toNumber(row.total_billed) !== 0 ||
        toNumber(row.total_paid) !== 0 ||
        toNumber(row.unbilled_amount) !== 0 ||
        toNumber(row.overbilled_amount) !== 0 ||
        toNumber(row.outstanding) !== 0
    );
};

const normalizeLedgerSummaryRow = <T extends {
    unbilled_amount?: number | string | null;
    overbilled_amount?: number | string | null;
}>(row: T) => {
    const rawUnbilledAmount = Number(row.unbilled_amount || 0);
    const derivedOverbilledAmount = rawUnbilledAmount < 0 ? Math.abs(rawUnbilledAmount) : 0;
    const overbilledAmount = Number(row.overbilled_amount || derivedOverbilledAmount || 0);

    return {
        ...row,
        unbilled_amount: Math.max(rawUnbilledAmount, 0),
        overbilled_amount: overbilledAmount,
    };
};

type PeriodLedgerMetrics = {
    total_challan_amount: number;
    total_challan_count: number;
    total_advance_amount: number;
    total_tds_amount: number;
    total_billed: number;
    total_paid: number;
};

const emptyPeriodMetrics = (): PeriodLedgerMetrics => ({
    total_challan_amount: 0,
    total_challan_count: 0,
    total_advance_amount: 0,
    total_tds_amount: 0,
    total_billed: 0,
    total_paid: 0,
});

const roundMoney = (value: number) => Number(value.toFixed(2));
const toMoney = (value: number | string | null | undefined) => Number(value || 0) || 0;

const getChallanFullHire = (record: {
    total_hire_amount?: number | string | null;
    extra_hire_amount?: number | string | null;
}) => roundMoney(toMoney(record.total_hire_amount) + toMoney(record.extra_hire_amount));

export async function GET(request: Request) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const branch = searchParams.get('branch');
    const hasOutstanding = searchParams.get('has_outstanding');
    const dateFrom = searchParams.get('date_from')?.trim();
    const dateTo = searchParams.get('date_to')?.trim();
    const billingStatus = searchParams.get('billing_status');
    const paymentStatus = searchParams.get('payment_status');

    let dateFilteredBrokerIds: string[] | null = null;
    let periodMetricsByBrokerId: Map<string, PeriodLedgerMetrics> | null = null;

    if (dateFrom || dateTo) {
        let challanQuery = supabase
            .from('challans')
            .select('broker_id, total_hire_amount, extra_hire_amount, advance_amount, less_tds')
            .eq('status', 'ACTIVE')
            .not('broker_id', 'is', null)
            .limit(10000);
        if (dateFrom) challanQuery = challanQuery.gte('date_from', dateFrom);
        if (dateTo) challanQuery = challanQuery.lte('date_from', dateTo);

        let billQuery = supabase
            .from('broker_challan_billing_records')
            .select('broker_id, amount')
            .eq('status', 'ACTIVE')
            .limit(10000);
        if (dateFrom) billQuery = billQuery.gte('billing_date', dateFrom);
        if (dateTo) billQuery = billQuery.lte('billing_date', dateTo);

        let payQuery = supabase
            .from('broker_challan_payment_receipts')
            .select('broker_id, amount')
            .eq('status', 'ACTIVE')
            .limit(10000);
        if (dateFrom) payQuery = payQuery.gte('receipt_date', dateFrom);
        if (dateTo) payQuery = payQuery.lte('receipt_date', dateTo);

        const [challanRes, billRes, payRes] = await Promise.all([challanQuery, billQuery, payQuery]);

        const queryError = challanRes.error || billRes.error || payRes.error;
        if (queryError) {
            console.error('Failed to fetch challan ledger period activity:', queryError);
            return NextResponse.json({ error: queryError.message }, { status: 500 });
        }

        const metricsByBrokerId = new Map<string, PeriodLedgerMetrics>();
        const getMetrics = (brokerId: string) => {
            const existing = metricsByBrokerId.get(brokerId);
            if (existing) return existing;

            const created = emptyPeriodMetrics();
            metricsByBrokerId.set(brokerId, created);
            return created;
        };

        (challanRes.data || []).forEach((record) => {
            if (!record.broker_id) return;

            const metrics = getMetrics(record.broker_id);
            metrics.total_challan_count += 1;
            metrics.total_challan_amount = roundMoney(
                metrics.total_challan_amount + getChallanFullHire(record)
            );
            metrics.total_advance_amount = roundMoney(
                metrics.total_advance_amount + toMoney(record.advance_amount)
            );
            metrics.total_tds_amount = roundMoney(
                metrics.total_tds_amount + toMoney(record.less_tds)
            );
        });
        (billRes.data || []).forEach((record) => {
            const metrics = getMetrics(record.broker_id);
            metrics.total_billed = roundMoney(metrics.total_billed + toMoney(record.amount));
        });
        (payRes.data || []).forEach((record) => {
            const metrics = getMetrics(record.broker_id);
            metrics.total_paid = roundMoney(metrics.total_paid + toMoney(record.amount));
        });

        periodMetricsByBrokerId = metricsByBrokerId;
        dateFilteredBrokerIds = Array.from(metricsByBrokerId.keys());
    }

    let query = supabase
        .from('vw_broker_challan_ledger_summary')
        .select('*')
        .order('broker_name');

    if (search) {
        query = query.or(`broker_name.ilike.%${search}%,broker_code.ilike.%${search}%`);
    }
    if (branch) {
        query = query.eq('primary_branch_code', branch);
    }
    if (hasOutstanding === 'true' && dateFilteredBrokerIds === null) {
        query = query.gt('outstanding', 0);
    }
    if (dateFilteredBrokerIds !== null) {
        if (dateFilteredBrokerIds.length === 0) {
            return NextResponse.json({ brokers: [], global: { unchallaned_cns_count: 0, unchallaned_cns_amount: 0 } });
        }
        query = query.in('broker_id', dateFilteredBrokerIds);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Failed to fetch challan ledger summary:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let filteredData = (data || [])
        .map((row) => {
            if (!periodMetricsByBrokerId) return normalizeLedgerSummaryRow(row);

            const metrics = periodMetricsByBrokerId.get(row.broker_id) || emptyPeriodMetrics();
            const rawUnbilledAmount = roundMoney(metrics.total_challan_amount - metrics.total_billed);
            const netPayable = roundMoney(Math.max(
                metrics.total_challan_amount - metrics.total_advance_amount - metrics.total_tds_amount,
                0
            ));

            return normalizeLedgerSummaryRow({
                ...row,
                opening_balance: 0,
                total_challan_amount: metrics.total_challan_amount,
                total_challan_count: metrics.total_challan_count,
                total_advance_amount: metrics.total_advance_amount,
                total_tds_amount: metrics.total_tds_amount,
                net_payable_amount: netPayable,
                total_billed: metrics.total_billed,
                total_paid: metrics.total_paid,
                unbilled_amount: Math.max(rawUnbilledAmount, 0),
                overbilled_amount: Math.max(-rawUnbilledAmount, 0),
                outstanding: roundMoney(netPayable - metrics.total_paid),
            });
        })
        .filter(hasLedgerActivity);

    if (hasOutstanding === 'true' && dateFilteredBrokerIds !== null) {
        filteredData = filteredData.filter((row) => Number(row.outstanding || 0) > 0);
    }

    if (billingStatus === 'has_bills') {
        filteredData = filteredData.filter((row) => Number(row.total_billed || 0) > 0);
    } else if (billingStatus === 'no_bills') {
        filteredData = filteredData.filter((row) => Number(row.total_billed || 0) === 0);
    }

    if (paymentStatus === 'has_payments') {
        filteredData = filteredData.filter((row) => Number(row.total_paid || 0) > 0);
    } else if (paymentStatus === 'no_payments') {
        filteredData = filteredData.filter((row) => Number(row.total_paid || 0) === 0);
    }

    const { data: allChallans } = await supabase
        .from('challans')
        .select('linked_cn_nos')
        .eq('status', 'ACTIVE');

    const linkedCnSet = new Set<string>();
    (allChallans || []).forEach((challan) => {
        (challan.linked_cn_nos || []).forEach((cnNo: string) => {
            if (cnNo) linkedCnSet.add(String(cnNo).trim());
        });
    });

    const { data: allConsignments } = await supabase
        .from('consignments')
        .select('cn_no, total_freight')
        .eq('cancel_cn', false)
        .limit(10000);

    let unchallanedCnsCount = 0;
    let unchallanedCnsAmount = 0;
    (allConsignments || []).forEach((cns) => {
        const cnNo = String(cns.cn_no || '').trim();
        if (!cnNo || linkedCnSet.has(cnNo)) return;
        unchallanedCnsCount += 1;
        unchallanedCnsAmount = roundMoney(unchallanedCnsAmount + toMoney(cns.total_freight));
    });

    return NextResponse.json({
        brokers: filteredData,
        global: {
            unchallaned_cns_count: unchallanedCnsCount,
            unchallaned_cns_amount: unchallanedCnsAmount,
        },
    });
}
