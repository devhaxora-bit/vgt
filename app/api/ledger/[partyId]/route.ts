import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type SummaryConsignment = {
    total_freight: number | string | null;
};

type SummaryBillingRecord = {
    amount: number | string | null;
    status: string;
};

type SummaryPaymentReceipt = {
    amount: number | string | null;
    status: string;
};

// GET /api/ledger/[partyId]
// Returns full party ledger detail: party info, summary, CNS list, billing records, payment receipts
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string }> }
) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { partyId } = await params;
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    // 1. Party details
    const { data: party, error: partyError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', partyId)
        .single();

    if (partyError || !party) {
        return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    // 2. Ledger account
    const { data: account } = await supabase
        .from('party_ledger_accounts')
        .select('*')
        .eq('party_id', partyId)
        .single();

    // 3. Consignments (date-filtered, for this billing party)
    let cnsQuery = supabase
        .from('consignments')
        .select('id, cn_no, invoice_no, bkg_date, booking_branch, dest_branch, no_of_pkg, actual_weight, charged_weight, load_unit, total_freight, basic_freight, freight_rate, vehicle_no, bkg_basis, cancel_cn, goods_desc, delivery_type')
        .eq('billing_party_id', partyId)
        .eq('cancel_cn', false)
        .order('bkg_date', { ascending: false })
        .order('cn_no', { ascending: false });

    if (dateFrom) cnsQuery = cnsQuery.gte('bkg_date', dateFrom);
    if (dateTo) cnsQuery = cnsQuery.lte('bkg_date', dateTo);
    if (search) cnsQuery = cnsQuery.ilike('cn_no', `%${search}%`);

    const { data: consignments } = await cnsQuery;

    // 4. Billing records (date-filtered)
    let billQuery = supabase
        .from('party_billing_records')
        .select('*')
        .eq('party_id', partyId)
        .order('billing_date', { ascending: false });

    if (dateFrom) billQuery = billQuery.gte('billing_date', dateFrom);
    if (dateTo) billQuery = billQuery.lte('billing_date', dateTo);

    const { data: billingRecords } = await billQuery;

    // 5. Payment receipts (date-filtered)
    let payQuery = supabase
        .from('party_payment_receipts')
        .select('*')
        .eq('party_id', partyId)
        .order('receipt_date', { ascending: false });

    if (dateFrom) payQuery = payQuery.gte('receipt_date', dateFrom);
    if (dateTo) payQuery = payQuery.lte('receipt_date', dateTo);

    const { data: paymentReceipts } = await payQuery;

    // 6. Compute summary from raw data
    const allCns = (consignments || []) as SummaryConsignment[];
    const allBills = ((billingRecords || []) as SummaryBillingRecord[]).filter((b) => b.status === 'ACTIVE');
    const allPayments = ((paymentReceipts || []) as SummaryPaymentReceipt[]).filter((p) => p.status === 'ACTIVE');

    const totalCnsAmount = allCns.reduce((sum, c) => sum + (parseFloat(String(c.total_freight || 0)) || 0), 0);
    const totalBilled = allBills.reduce((sum, b) => sum + (parseFloat(String(b.amount || 0)) || 0), 0);
    const totalPaid = allPayments.reduce((sum, p) => sum + (parseFloat(String(p.amount || 0)) || 0), 0);
    const openingBalance = parseFloat(account?.opening_balance || '0') || 0;

    const summary = {
        total_cns_amount: totalCnsAmount,
        total_cns_count: allCns.length,
        total_billed: totalBilled,
        total_paid: totalPaid,
        unbilled_amount: totalCnsAmount - totalBilled,
        outstanding: openingBalance + totalBilled - totalPaid,
        opening_balance: openingBalance,
    };

    return NextResponse.json({
        party,
        account: account || null,
        summary,
        consignments: consignments || [],
        billing_records: billingRecords || [],
        payment_receipts: paymentReceipts || [],
    });
}
