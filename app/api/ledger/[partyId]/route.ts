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

const roundMoney = (value: number) => Number(value.toFixed(2));

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

    let branch_name: string | null = null;
    if (party.branch_code) {
        const { data: branch } = await supabase
            .from('branches')
            .select('name')
            .eq('code', party.branch_code)
            .maybeSingle();
        branch_name = branch?.name ?? null;
    }

    const partyWithBranch = { ...party, branch_name };

    // 2. Ledger account
    const { data: account } = await supabase
        .from('party_ledger_accounts')
        .select('*')
        .eq('party_id', partyId)
        .single();

    // 3. Consignments (all rows kept for bill view/edit, filtered rows used for the main list)
    const allConsignmentsQuery = supabase
        .from('consignments')
        .select('id, cn_no, invoice_no, bkg_date, booking_branch, loading_point, dest_branch, delivery_point, no_of_pkg, total_qty, is_loose, actual_weight, charged_weight, load_unit, total_freight, basic_freight, freight_rate, unload_charges, retention_charges, extra_km_charges, mhc_charges, door_coll_charges, door_del_charges, traffic_challan_charges, other_charges, vehicle_no, bkg_basis, cancel_cn, goods_desc, delivery_type, freight_included, parent_cn_id')
        .eq('billing_party_id', partyId)
        .eq('cancel_cn', false)
        .order('bkg_date', { ascending: false })
        .order('cn_no', { ascending: false });

    const { data: allConsignmentsRaw } = await allConsignmentsQuery;

    const cnNoById = new Map(
        (allConsignmentsRaw || []).map((record) => [record.id, record.cn_no] as const),
    );
    const missingParentIds = Array.from(new Set(
        (allConsignmentsRaw || [])
            .map((record) => record.parent_cn_id)
            .filter((parentId): parentId is string => Boolean(parentId) && !cnNoById.has(parentId)),
    ));

    if (missingParentIds.length > 0) {
        const { data: parentRows } = await supabase
            .from('consignments')
            .select('id, cn_no')
            .in('id', missingParentIds);

        (parentRows || []).forEach((parentRow) => {
            cnNoById.set(parentRow.id, parentRow.cn_no);
        });
    }

    const allConsignments = (allConsignmentsRaw || []).map((record) => ({
        ...record,
        parent_cn_no: record.parent_cn_id ? cnNoById.get(record.parent_cn_id) ?? null : null,
    }));

    const consignments = allConsignments.filter((record) => {
        const bookingDate = record.bkg_date?.slice(0, 10) || '';
        if (dateFrom && bookingDate < dateFrom) return false;
        if (dateTo && bookingDate > dateTo) return false;
        if (search && !String(record.cn_no || '').toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    // 4. Billing records
    const { data: allBillingRecords } = await supabase
        .from('party_billing_records')
        .select('*')
        .eq('party_id', partyId)
        .order('billing_date', { ascending: false });

    const billingRecords = (allBillingRecords || []).filter((record) => {
        const billingDate = record.billing_date?.slice(0, 10) || '';
        if (dateFrom && billingDate < dateFrom) return false;
        if (dateTo && billingDate > dateTo) return false;
        return true;
    });

    // 5. Payment receipts
    const { data: allPaymentReceipts } = await supabase
        .from('party_payment_receipts')
        .select('*')
        .eq('party_id', partyId)
        .order('receipt_date', { ascending: false });

    const paymentReceipts = (allPaymentReceipts || []).filter((record) => {
        const receiptDate = record.receipt_date?.slice(0, 10) || '';
        if (dateFrom && receiptDate < dateFrom) return false;
        if (dateTo && receiptDate > dateTo) return false;
        return true;
    });

    // 6. When date filters are applied, expand the consignment set to include
    // CNs covered by active billing records in the date range.
    // This ensures Total CNS Amount − Total Billed = Unbilled Amount always holds.
    let summaryConsignments = consignments || [];
    if (dateFrom || dateTo) {
        const billedCnNos = new Set<string>();
        (billingRecords || []).forEach((b) => {
            if (b.status !== 'ACTIVE') return;
            const rawCnNos = b.covered_cn_nos;
            const cnNos: string[] = Array.isArray(rawCnNos)
                ? rawCnNos.map((cn: unknown) => String(cn).trim()).filter(Boolean)
                : [];
            cnNos.forEach((cn) => billedCnNos.add(cn));
        });

        if (billedCnNos.size > 0) {
            const existingCnNos = new Set(summaryConsignments.map((c) => c.cn_no));
            const additionalCns = (allConsignments || []).filter((c) =>
                billedCnNos.has(c.cn_no) && !existingCnNos.has(c.cn_no)
            );
            if (additionalCns.length > 0) {
                summaryConsignments = [...summaryConsignments, ...additionalCns];
            }
        }
    }

    // 7. Compute summary from raw data
    const allCns = summaryConsignments as SummaryConsignment[];
    const allBills = ((billingRecords || []) as SummaryBillingRecord[]).filter((b) => b.status === 'ACTIVE');
    const allPayments = ((paymentReceipts || []) as SummaryPaymentReceipt[]).filter((p) => p.status === 'ACTIVE');

    const totalCnsAmount = allCns.reduce((sum, c) => sum + (parseFloat(String(c.total_freight || 0)) || 0), 0);
    const totalBilled = allBills.reduce((sum, b) => sum + (parseFloat(String(b.amount || 0)) || 0), 0);
    const totalPaid = allPayments.reduce((sum, p) => sum + (parseFloat(String(p.amount || 0)) || 0), 0);
    const openingBalance = parseFloat(account?.opening_balance || '0') || 0;
    // Use total invoice amount (not CN-portion) so that unbilled + billed = total CNS amount
    const rawUnbilledAmount = roundMoney(totalCnsAmount - totalBilled);
    const unbilledAmount = Math.max(rawUnbilledAmount, 0);
    const overbilledAmount = Math.max(-rawUnbilledAmount, 0);

    const summary = {
        total_cns_amount: totalCnsAmount,
        total_cns_count: allCns.length,
        total_billed: totalBilled,
        total_paid: totalPaid,
        unbilled_amount: unbilledAmount,
        overbilled_amount: overbilledAmount,
        outstanding: openingBalance + totalBilled - totalPaid,
        opening_balance: openingBalance,
        total_bills_count: allBills.length,
    };

    return NextResponse.json({
        party: partyWithBranch,
        account: account || null,
        summary,
        consignments: summaryConsignments || [],
        all_consignments: allConsignments || [],
        billing_records: billingRecords || [],
        payment_receipts: paymentReceipts || [],
        all_billing_records: allBillingRecords || [],
        all_payment_receipts: allPaymentReceipts || [],
    });
}
