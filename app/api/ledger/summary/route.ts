import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const hasLedgerActivity = (row: {
    opening_balance?: number | string | null;
    total_cns_amount?: number | string | null;
    total_cns_count?: number | string | null;
    total_billed?: number | string | null;
    total_paid?: number | string | null;
    unbilled_amount?: number | string | null;
    overbilled_amount?: number | string | null;
    outstanding?: number | string | null;
}) => {
    const toNumber = (value: number | string | null | undefined) => Number(value || 0);

    return (
        toNumber(row.opening_balance) !== 0 ||
        toNumber(row.total_cns_amount) !== 0 ||
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
    total_cns_amount: number;
    total_cns_count: number;
    total_billed: number;
    total_paid: number;
};

const emptyPeriodMetrics = (): PeriodLedgerMetrics => ({
    total_cns_amount: 0,
    total_cns_count: 0,
    total_billed: 0,
    total_paid: 0,
});

const roundMoney = (value: number) => Number(value.toFixed(2));
const toMoney = (value: number | string | null | undefined) => Number(value || 0) || 0;

// GET /api/ledger/summary
// Returns vw_party_ledger_summary with optional filters
// Filters: search, branch, has_outstanding, date_from, date_to, billing_status, payment_status
export async function GET(request: Request) {
    const supabase = await createClient();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const branch = searchParams.get('branch');
    const hasOutstanding = searchParams.get('has_outstanding');
    const dateFrom = searchParams.get('date_from')?.trim();     // YYYY-MM-DD
    const dateTo = searchParams.get('date_to')?.trim();         // YYYY-MM-DD
    const billingStatus = searchParams.get('billing_status');   // 'has_bills' | 'no_bills'
    const paymentStatus = searchParams.get('payment_status');   // 'has_payments' | 'no_payments'

    // --- Step 1: If date range given, collect the party_ids that have activity in range ---
    let dateFilteredPartyIds: string[] | null = null;
    let periodMetricsByPartyId: Map<string, PeriodLedgerMetrics> | null = null;

    if (dateFrom || dateTo) {
        // Parties with CNS activity in range
        let cnsQuery = supabase
            .from('consignments')
            .select('billing_party_id, total_freight')
            .eq('cancel_cn', false)
            .limit(10000);
        if (dateFrom) cnsQuery = cnsQuery.gte('bkg_date', dateFrom);
        if (dateTo) cnsQuery = cnsQuery.lte('bkg_date', dateTo);

        // Parties with billing records in range
        let billQuery = supabase
            .from('party_billing_records')
            .select('party_id, amount')
            .eq('status', 'ACTIVE')
            .limit(10000);
        if (dateFrom) billQuery = billQuery.gte('billing_date', dateFrom);
        if (dateTo) billQuery = billQuery.lte('billing_date', dateTo);

        // Parties with payment receipts in range
        let payQuery = supabase
            .from('party_payment_receipts')
            .select('party_id, amount')
            .eq('status', 'ACTIVE')
            .limit(10000);
        if (dateFrom) payQuery = payQuery.gte('receipt_date', dateFrom);
        if (dateTo) payQuery = payQuery.lte('receipt_date', dateTo);

        const [cnsRes, billRes, payRes] = await Promise.all([cnsQuery, billQuery, payQuery]);

        const queryError = cnsRes.error || billRes.error || payRes.error;
        if (queryError) {
            console.error('Failed to fetch ledger period activity:', queryError);
            return NextResponse.json({ error: queryError.message }, { status: 500 });
        }

        const metricsByPartyId = new Map<string, PeriodLedgerMetrics>();
        const getMetrics = (partyId: string) => {
            const existing = metricsByPartyId.get(partyId);
            if (existing) return existing;

            const created = emptyPeriodMetrics();
            metricsByPartyId.set(partyId, created);
            return created;
        };

        (cnsRes.data || []).forEach((record) => {
            if (!record.billing_party_id) return;

            const metrics = getMetrics(record.billing_party_id);
            metrics.total_cns_count += 1;
            metrics.total_cns_amount = roundMoney(metrics.total_cns_amount + toMoney(record.total_freight));
        });
        (billRes.data || []).forEach((record) => {
            const metrics = getMetrics(record.party_id);
            metrics.total_billed = roundMoney(metrics.total_billed + toMoney(record.amount));
        });
        (payRes.data || []).forEach((record) => {
            const metrics = getMetrics(record.party_id);
            metrics.total_paid = roundMoney(metrics.total_paid + toMoney(record.amount));
        });

        periodMetricsByPartyId = metricsByPartyId;
        dateFilteredPartyIds = Array.from(metricsByPartyId.keys());
    }

    // --- Step 2: Query the summary view ---
    let query = supabase
        .from('vw_party_ledger_summary')
        .select('*')
        .order('party_name');

    if (search) {
        query = query.or(`party_name.ilike.%${search}%,party_code.ilike.%${search}%`);
    }
    if (branch) {
        query = query.eq('branch_code', branch);
    }
    if (hasOutstanding === 'true' && dateFilteredPartyIds === null) {
        query = query.gt('outstanding', 0);
    }
    // Date range: restrict to parties with activity in range
    if (dateFilteredPartyIds !== null) {
        if (dateFilteredPartyIds.length === 0) {
            // No activity in range — return empty
            return NextResponse.json([]);
        }
        query = query.in('party_id', dateFilteredPartyIds);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Failed to fetch ledger summary:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let filteredData = (data || [])
        .map((row) => {
            if (!periodMetricsByPartyId) return normalizeLedgerSummaryRow(row);

            const metrics = periodMetricsByPartyId.get(row.party_id) || emptyPeriodMetrics();
            // Use total_billed (invoice amount) as the basis for unbilled — consistent with the view
            const rawUnbilledAmount = roundMoney(metrics.total_cns_amount - metrics.total_billed);

            return normalizeLedgerSummaryRow({
                ...row,
                opening_balance: 0,
                total_cns_amount: metrics.total_cns_amount,
                total_cns_count: metrics.total_cns_count,
                total_billed: metrics.total_billed,
                total_paid: metrics.total_paid,
                unbilled_amount: Math.max(rawUnbilledAmount, 0),
                overbilled_amount: Math.max(-rawUnbilledAmount, 0),
                outstanding: roundMoney(metrics.total_billed - metrics.total_paid),
            });
        })
        .filter(hasLedgerActivity);

    // --- Step 3: Apply billing / payment status filters (client-side on the result set) ---
    if (hasOutstanding === 'true' && dateFilteredPartyIds !== null) {
        filteredData = filteredData.filter(r => Number(r.outstanding || 0) > 0);
    }

    if (billingStatus === 'has_bills') {
        filteredData = filteredData.filter(r => Number(r.total_billed || 0) > 0);
    } else if (billingStatus === 'no_bills') {
        filteredData = filteredData.filter(r => Number(r.total_billed || 0) === 0);
    }

    if (paymentStatus === 'has_payments') {
        filteredData = filteredData.filter(r => Number(r.total_paid || 0) > 0);
    } else if (paymentStatus === 'no_payments') {
        filteredData = filteredData.filter(r => Number(r.total_paid || 0) === 0);
    }

    return NextResponse.json(filteredData);
}
