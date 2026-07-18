import { NextRequest, NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';

const LIVE_CN_SELECT =
    'id, cn_no, bkg_date, booking_branch, dest_branch, delivery_point, loading_point, consignor_name, consignee_name, billing_party, total_freight, vehicle_no, cancel_cn, status, created_at, deleted_at, deleted_by, delete_reason';

type SoftDeleteBody = {
    reason?: string;
};

/** GET — search live or soft-deleted CNs (main/global admin only) */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ branchCode: string }> },
) {
    const auth = await requireAuthz({ adminOnly: true, fullAccessOnly: true });
    if (!auth.ok) return auth.response;

    const { branchCode: rawBranch } = await params;
    const branchCode = String(rawBranch || '').trim().toUpperCase();
    if (!branchCode) {
        return NextResponse.json({ error: 'branchCode is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get('q') || '').trim();
    const view = String(searchParams.get('view') || 'live').toLowerCase(); // live | deleted

    let query = auth.supabase
        .from('consignments')
        .select(LIVE_CN_SELECT)
        .eq('booking_branch', branchCode)
        .order(view === 'deleted' ? 'deleted_at' : 'bkg_date', { ascending: false })
        .limit(50);

    if (view === 'deleted') {
        query = query.not('deleted_at', 'is', null);
    } else {
        query = query.is('deleted_at', null);
    }

    if (q) {
        query = query.or(
            `cn_no.ilike.%${q}%,consignor_name.ilike.%${q}%,consignee_name.ilike.%${q}%,vehicle_no.ilike.%${q}%`,
        );
    }

    const { data, error } = await query;
    if (error) {
        console.error('CN soft-delete search failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
}

/** POST — soft-delete a CN by id (main/global admin only); frees cn_no for reuse */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ branchCode: string }> },
) {
    const auth = await requireAuthz({ adminOnly: true, fullAccessOnly: true });
    if (!auth.ok) return auth.response;

    const { branchCode: rawBranch } = await params;
    const branchCode = String(rawBranch || '').trim().toUpperCase();
    if (!branchCode) {
        return NextResponse.json({ error: 'branchCode is required' }, { status: 400 });
    }

    const body = (await request.json()) as SoftDeleteBody & { id?: string; cn_no?: string };
    const reason = String(body.reason || '').trim();
    if (!reason) {
        return NextResponse.json({ error: 'delete reason is required' }, { status: 400 });
    }

    const id = String(body.id || '').trim();
    const cnNo = String(body.cn_no || '').trim();
    if (!id && !cnNo) {
        return NextResponse.json({ error: 'id or cn_no is required' }, { status: 400 });
    }

    let findQuery = auth.supabase
        .from('consignments')
        .select('id, cn_no, booking_branch, deleted_at, cancel_cn, total_freight, consignor_name, consignee_name, bkg_date')
        .eq('booking_branch', branchCode)
        .is('deleted_at', null)
        .limit(1);

    if (id) {
        findQuery = findQuery.eq('id', id);
    } else {
        findQuery = findQuery.eq('cn_no', cnNo);
    }

    const { data: rows, error: findError } = await findQuery;
    if (findError) {
        return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    const record = rows?.[0];
    if (!record) {
        return NextResponse.json({ error: 'Consignment not found (or already deleted)' }, { status: 404 });
    }

    // Block if covered by an active party bill
    const { data: bills, error: billError } = await auth.supabase
        .from('party_billing_records')
        .select('id, bill_ref_no, covered_cn_nos, status')
        .eq('status', 'ACTIVE')
        .contains('covered_cn_nos', [record.cn_no]);

    if (billError) {
        return NextResponse.json({ error: billError.message }, { status: 500 });
    }

    if (bills && bills.length > 0) {
        const refs = bills.map((b) => b.bill_ref_no || b.id.slice(0, 8)).join(', ');
        return NextResponse.json(
            {
                error: `Cannot soft-delete CN ${record.cn_no}: it is covered by active bill(s): ${refs}. Cancel/adjust the bill first.`,
            },
            { status: 409 },
        );
    }

    // Block if linked on an active challan
    const { data: challans, error: challanError } = await auth.supabase
        .from('challans')
        .select('id, challan_no, linked_cn_nos, status')
        .eq('status', 'ACTIVE')
        .contains('linked_cn_nos', [record.cn_no]);

    if (challanError) {
        // linked_cn_nos may not support contains on all schemas — fall back to text search
        console.warn('Challan contains check failed, trying ilike:', challanError.message);
    } else if (challans && challans.length > 0) {
        const refs = challans.map((c) => c.challan_no || c.id.slice(0, 8)).join(', ');
        return NextResponse.json(
            {
                error: `Cannot soft-delete CN ${record.cn_no}: it is linked on active challan(s): ${refs}. Unlink/cancel the challan first.`,
            },
            { status: 409 },
        );
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await auth.supabase
        .from('consignments')
        .update({
            deleted_at: now,
            deleted_by: auth.user.id,
            delete_reason: reason,
            cancel_cn: true,
            status: 'CANCELLED',
        })
        .eq('id', record.id)
        .is('deleted_at', null)
        .select(LIVE_CN_SELECT)
        .single();

    if (updateError) {
        console.error('Soft-delete update failed:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: releaseError } = await auth.supabase.rpc('release_cn_number_after_soft_delete', {
        p_cn_no: record.cn_no,
        p_booking_branch: record.booking_branch,
    });

    if (releaseError) {
        console.error('CN number release failed:', releaseError);
        // Soft-delete succeeded; report release warning but still return success
        return NextResponse.json({
            item: updated,
            warning: `CN soft-deleted but number release failed: ${releaseError.message}`,
        });
    }

    return NextResponse.json({ item: updated });
}
