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

    // Billing status: is this CN covered by an active party bill?
    let bill = null;
    const { data: billRows } = await supabase
        .from('party_billing_records')
        .select('id, bill_ref_no, billing_date, amount, status, party_id')
        .contains('covered_cn_nos', [consignment.cn_no])
        .eq('status', 'ACTIVE')
        .order('billing_date', { ascending: false })
        .limit(1);

    if (billRows && billRows.length > 0) {
        const row = billRows[0];
        let partyName: string | null = null;
        if (row.party_id) {
            const { data: party } = await supabase
                .from('parties')
                .select('name')
                .eq('id', row.party_id)
                .maybeSingle();
            partyName = party?.name ?? null;
        }
        bill = {
            id: row.id,
            bill_ref_no: row.bill_ref_no,
            billing_date: row.billing_date,
            amount: toNumber(row.amount),
            status: row.status,
            party_name: partyName,
        };
    }

    const childCount = children?.length ?? 0;

    return NextResponse.json({
        consignment: { ...consignment, has_children: childCount > 0, child_count: childCount },
        children: children ?? [],
        parent_cn_no: parentCnNo,
        bill,
    });
}
