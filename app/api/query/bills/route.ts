import { NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';

const CN_SELECT_FIELDS =
    'id, cn_no, invoice_no, bkg_date, booking_branch, loading_point, dest_branch, delivery_point, no_of_pkg, total_qty, is_loose, actual_weight, charged_weight, load_unit, total_freight, basic_freight, freight_rate, unload_charges, retention_charges, extra_km_charges, mhc_charges, door_coll_charges, door_del_charges, traffic_challan_charges, other_charges, vehicle_no, bkg_basis, goods_desc, delivery_type, freight_included, parent_cn_id';

const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

// GET /api/query/bills?q=ref  -> search bills by bill ref / party name
// GET /api/query/bills?id=uuid -> full bill detail with party + covered consignments
export async function GET(request: Request) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const supabase = auth.supabase;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    const q = searchParams.get('q')?.trim();
    const listBranch = auth.resolveListBranch(searchParams.get('branch'));

    if (id) {
        const { data: record, error } = await supabase
            .from('party_billing_records')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !record) {
            return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
        }

        const forbiddenRecord = auth.forbidIfForeignBranch(record.branch_code);
        if (forbiddenRecord) return forbiddenRecord;

        const { data: partyRow } = await supabase
            .from('parties')
            .select('id, name, code, type, phone, gstin, address, branch_code')
            .eq('id', record.party_id)
            .single();

        const forbidden = auth.forbidIfForeignBranch(partyRow?.branch_code);
        if (forbidden) return forbidden;

        const party: Record<string, unknown> | null = partyRow ? { ...partyRow, branch_name: null } : null;
        if (party && partyRow?.branch_code) {
            const { data: branch } = await supabase
                .from('branches')
                .select('name')
                .eq('code', partyRow.branch_code)
                .maybeSingle();
            party.branch_name = branch?.name ?? null;
        }

        let partySummary = null;
        if (record.party_id) {
            const { data: summary } = await supabase
                .from('vw_party_ledger_summary')
                .select('opening_balance, total_billed, total_paid, outstanding, unbilled_amount')
                .eq('party_id', record.party_id)
                .maybeSingle();
            if (summary) {
                partySummary = {
                    opening_balance: toNumber(summary.opening_balance),
                    total_billed: toNumber(summary.total_billed),
                    total_paid: toNumber(summary.total_paid),
                    outstanding: toNumber(summary.outstanding),
                    unbilled_amount: Math.max(toNumber(summary.unbilled_amount), 0),
                };
            }
        }

        const coveredCnNos: string[] = Array.isArray(record.covered_cn_nos)
            ? record.covered_cn_nos.map((cn: unknown) => String(cn).trim()).filter(Boolean)
            : [];

        let consignments: unknown[] = [];
        if (coveredCnNos.length > 0) {
            const { data } = await supabase
                .from('consignments')
                .select(CN_SELECT_FIELDS)
                .in('cn_no', coveredCnNos);
            consignments = data ?? [];
        } else if (record.party_id) {
            const { data } = await supabase
                .from('consignments')
                .select(CN_SELECT_FIELDS)
                .eq('billing_party_id', record.party_id)
                .eq('cancel_cn', false);
            consignments = data ?? [];
        }

        return NextResponse.json({ record, party: party ?? null, consignments, party_summary: partySummary });
    }

    if (q === undefined || q === null) {
        return NextResponse.json({ error: 'Provide ?q= or ?id=' }, { status: 400 });
    }
    if (q.length < 1) return NextResponse.json([]);

    // Match by bill ref number, or by party name (resolve those party ids first).
    let partyQuery = supabase
        .from('parties')
        .select('id')
        .ilike('name', `%${q}%`)
        .limit(25);

    if (listBranch) {
        partyQuery = partyQuery.eq('branch_code', listBranch);
    }

    const { data: matchingParties } = await partyQuery;
    const partyIds = (matchingParties ?? []).map((p) => p.id);

    const filters = [`bill_ref_no.ilike.%${q}%`];
    if (partyIds.length > 0) {
        filters.push(`party_id.in.(${partyIds.join(',')})`);
    }

    let billsQuery = supabase
        .from('party_billing_records')
        .select('id, bill_ref_no, billing_date, amount, status, party_id, covered_cn_nos, created_at, branch_code')
        .or(filters.join(','))
        .order('billing_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

    if (listBranch) {
        billsQuery = billsQuery.eq('branch_code', listBranch);
    }

    const { data: bills, error: billsError } = await billsQuery;

    if (billsError) {
        console.error('[query/bills search]', billsError);
        return NextResponse.json([]);
    }

    const billPartyIds = Array.from(new Set((bills ?? []).map((b) => b.party_id).filter(Boolean)));
    const partyMap = new Map<string, { name: string; code: string | null }>();
    if (billPartyIds.length > 0) {
        const { data: partyRows } = await supabase
            .from('parties')
            .select('id, name, code')
            .in('id', billPartyIds);
        (partyRows ?? []).forEach((p) => partyMap.set(p.id, { name: p.name, code: p.code }));
    }

    const result = (bills ?? []).map((bill) => ({
        id: bill.id,
        bill_ref_no: bill.bill_ref_no,
        billing_date: bill.billing_date,
        amount: toNumber(bill.amount),
        status: bill.status,
        party_id: bill.party_id,
        party_name: partyMap.get(bill.party_id)?.name ?? 'Unknown Party',
        party_code: partyMap.get(bill.party_id)?.code ?? null,
        covered_count: Array.isArray(bill.covered_cn_nos) ? bill.covered_cn_nos.length : 0,
        branch_code: bill.branch_code ?? null,
    }));

    return NextResponse.json(result);
}
