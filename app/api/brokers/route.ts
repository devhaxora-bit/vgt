import { NextRequest, NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';

// GET /api/brokers — list all or search by ?q=name&branch=CODE
export async function GET(req: NextRequest) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const q = req.nextUrl.searchParams.get('q') || '';
    const branch = auth.resolveListBranch(req.nextUrl.searchParams.get('branch'));

    let query = auth.supabase
        .from('brokers')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (branch) {
        query = query.eq('branch_code', branch);
    }

    if (q.trim()) {
        query = query.ilike('name', `%${q.trim()}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// POST /api/brokers — create a broker
export async function POST(req: NextRequest) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const body = await req.json();

    const code = String(body.code || '').trim().toUpperCase();
    const name = String(body.name || '').trim();
    let branchCode = String(body.branch_code || '').trim().toUpperCase();

    if (!code) return NextResponse.json({ error: 'Broker code is required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Broker name is required' }, { status: 400 });

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
        .from('brokers')
        .insert({
            code,
            name,
            mobile: body.mobile || null,
            address: body.address || null,
            branch_code: branchCode,
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json(
                { error: `Broker code ${code} already exists for branch ${branchCode}.` },
                { status: 409 },
            );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data, { status: 201 });
}
