import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const CN_SELECT_FIELDS =
    'id, cn_no, invoice_no, bkg_date, booking_branch, loading_point, dest_branch, delivery_point, no_of_pkg, total_qty, is_loose, actual_weight, charged_weight, load_unit, total_freight, basic_freight, freight_rate, unload_charges, retention_charges, extra_km_charges, mhc_charges, door_coll_charges, door_del_charges, traffic_challan_charges, other_charges, vehicle_no, bkg_basis, goods_desc, delivery_type, freight_included, parent_cn_id';

const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

// GET /api/query/bills?q=ref  -> search bills by bill ref / party name
// GET /api/query/bills?id=uuid -> full bill detail with party + covered consignments
export async function GET(request: Request) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    const q = searchParams.get('q')?.trim();

    if (id) {
        const { data: record, error } = await supabase
            .from('party_billing_records')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !record) {
            return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
        }

        const { data: party } = await supabase
            .from('parties')
            .select('id, name, code, type, phone, gstin, address, branch_code')
            .eq('id', record.party_id)
            .single();

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

        return NextResponse.json({ record, party: party ?? null, consignments });
    }

    if (q === undefined || q === null) {
        return NextResponse.json({ error: 'Provide ?q= or ?id=' }, { status: 400 });
    }
    if (q.length < 1) return NextResponse.json([]);

    // Match by bill ref number, or by party name (resolve those party ids first).
    const { data: matchingParties } = await supabase
        .from('parties')
        .select('id')
        .ilike('name', `%${q}%`)
        .limit(25);
    const partyIds = (matchingParties ?? []).map((p) => p.id);

    const filters = [`bill_ref_no.ilike.%${q}%`];
    if (partyIds.length > 0) {
        filters.push(`party_id.in.(${partyIds.join(',')})`);
    }

    const { data: bills, error: billsError } = await supabase
        .from('party_billing_records')
        .select('id, bill_ref_no, billing_date, amount, status, party_id, covered_cn_nos')
        .or(filters.join(','))
        .order('billing_date', { ascending: false })
        .limit(20);

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
    }));

    return NextResponse.json(result);
}
