import { NextRequest, NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';

// GET /api/vehicles?q=partial — search, or ?no=exact — fetch one, optional ?branch=CODE
export async function GET(req: NextRequest) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const q = req.nextUrl.searchParams.get('q') || '';
    const no = req.nextUrl.searchParams.get('no') || '';
    const branch = auth.resolveListBranch(req.nextUrl.searchParams.get('branch'));

    if (no) {
        let query = auth.supabase
            .from('vehicles')
            .select('*')
            .ilike('vehicle_no', no.toUpperCase())
            .eq('is_active', true);

        if (branch) {
            query = query.eq('branch_code', branch);
        }

        const { data, error } = await query.maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(data);
    }

    let query = auth.supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_no');
    if (branch) query = query.eq('branch_code', branch);
    if (q.trim()) query = query.ilike('vehicle_no', `%${q.trim().toUpperCase()}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// POST /api/vehicles — create
export async function POST(req: NextRequest) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const body = await req.json();

    const vehicleNo = String(body.vehicle_no || '').trim().toUpperCase();
    let branchCode = String(body.branch_code || '').trim().toUpperCase();

    if (!vehicleNo) {
        return NextResponse.json({ error: 'vehicle_no is required' }, { status: 400 });
    }

    if (auth.isBranchScoped) {
        branchCode = auth.branchCode!;
    }

    if (!branchCode) {
        return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
    }

    if (!auth.canAccessBranch(branchCode)) {
        return NextResponse.json({ error: 'Forbidden: Outside your branch scope' }, { status: 403 });
    }

    const { data, error } = await auth.supabase
        .from('vehicles')
        .insert({ ...body, vehicle_no: vehicleNo, branch_code: branchCode })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: `Vehicle ${vehicleNo} already exists in the master.` }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data, { status: 201 });
}
