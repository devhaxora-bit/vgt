import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';

const CHILD_SELECT_FIELDS =
    'id, cn_no, bkg_date, consignor_name, consignee_name, loading_point, delivery_point, booking_branch, dest_branch, no_of_pkg, total_qty, actual_weight, charged_weight, load_unit, goods_class, goods_desc, total_freight, freight_included, parent_cn_id';

const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

// GET /api/query/cns?id=uuid -> consignment + included (child) CNs + billing status
export async function GET(request: Request) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const supabase = auth.supabase;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id) return NextResponse.json({ error: 'Provide ?id=' }, { status: 400 });

    const { data: consignment, error } = await supabase
        .from('consignments')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

    if (error || !consignment) {
        return NextResponse.json({ error: 'Consignment not found' }, { status: 404 });
    }

    const forbidden = auth.forbidIfForeignBranch(consignment.booking_branch);
    if (forbidden) return forbidden;

    // Included / child consignments (freight_included children of this CN)
    const { data: children } = await supabase
        .from('consignments')
        .select(CHILD_SELECT_FIELDS)
        .eq('parent_cn_id', id)
        .is('deleted_at', null)
        .order('cn_no', { ascending: true });

    // If this CN is itself a child, resolve its parent CN number
    let parentCnNo: string | null = null;
    if (consignment.parent_cn_id) {
        const { data: parent } = await supabase
            .from('consignments')
            .select('cn_no')
            .eq('id', consignment.parent_cn_id)
            .maybeSingle();
        parentCnNo = parent?.cn_no ?? null;
    }

    // All bills that cover this CN (any status — active or cancelled)
    const { data: billRows } = await supabase
        .from('party_billing_records')
        .select('id, bill_ref_no, billing_date, amount, status, party_id')
        .contains('covered_cn_nos', [consignment.cn_no])
        .order('billing_date', { ascending: false });

    // Resolve unique party names in one pass
    const uniquePartyIds = [...new Set((billRows ?? []).map((r) => r.party_id).filter(Boolean))];
    const partyNameMap = new Map<string, string>();
    if (uniquePartyIds.length > 0) {
        const { data: partyRows } = await supabase
            .from('parties')
            .select('id, name')
            .in('id', uniquePartyIds);
        for (const p of partyRows ?? []) partyNameMap.set(p.id, p.name);
    }

    const bills = (billRows ?? []).map((row) => ({
        id: row.id,
        bill_ref_no: row.bill_ref_no,
        billing_date: row.billing_date,
        amount: toNumber(row.amount),
        status: row.status,
        party_name: row.party_id ? (partyNameMap.get(row.party_id) ?? null) : null,
    }));

    // Keep legacy `bill` field pointing to the latest active bill for backwards compat
    const bill = bills.find((b) => b.status === 'ACTIVE') ?? bills[0] ?? null;

    // Challans linked to this CN (via linked_cn_nos array)
    const { data: challanRows } = await supabase
        .from('challans')
        .select('id, challan_no, challan_type, engagement_type, status, date_from, date_to, vehicle_no, broker_name, origin_branch_code, total_hire_amount, extra_hire_amount')
        .contains('linked_cn_nos', [consignment.cn_no])
        .order('date_from', { ascending: false });

    const challans = (challanRows ?? []).map((ch) => ({
        id: ch.id,
        challan_no: ch.challan_no,
        challan_type: ch.challan_type,
        engagement_type: ch.engagement_type,
        status: ch.status,
        date_from: ch.date_from,
        date_to: ch.date_to,
        vehicle_no: ch.vehicle_no,
        broker_name: ch.broker_name,
        branch: ch.origin_branch_code,
        total_hire: toNumber(ch.total_hire_amount) + toNumber(ch.extra_hire_amount),
    }));

    const childCount = children?.length ?? 0;

    return NextResponse.json({
        consignment: { ...consignment, has_children: childCount > 0, child_count: childCount },
        children: children ?? [],
        parent_cn_no: parentCnNo,
        bill,
        bills,
        challans,
    });
}
