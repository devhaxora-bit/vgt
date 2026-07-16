import { NextRequest, NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json();

    const { data: existing, error: existingError } = await auth.supabase
        .from('vehicles')
        .select('id, branch_code')
        .eq('id', id)
        .single();

    if (existingError || !existing) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const forbidden = auth.forbidIfForeignBranch(existing.branch_code);
    if (forbidden) return forbidden;

    let branchCode = body.branch_code !== undefined
        ? String(body.branch_code || '').trim().toUpperCase()
        : existing.branch_code;

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
        .update({
            ...body,
            vehicle_no: body.vehicle_no?.toUpperCase(),
            branch_code: branchCode,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: `Vehicle number already exists in the master.` }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const { data: existing } = await auth.supabase
        .from('vehicles')
        .select('id, branch_code')
        .eq('id', id)
        .single();

    if (!existing) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const forbidden = auth.forbidIfForeignBranch(existing.branch_code);
    if (forbidden) return forbidden;

    const { error } = await auth.supabase
        .from('vehicles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
}
