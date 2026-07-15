import { NextRequest, NextResponse } from 'next/server';
import { requireAuthz, type AuthzOk } from '@/lib/server/requireAuthz';
import { PartySchema } from '@/lib/types/party.types';

const normalizeBranch = (value: unknown): string =>
    String(value || '').trim().toUpperCase();

const nextPartyCode = async (
    supabase: AuthzOk['supabase'],
    branch: string | null,
): Promise<string> => {
    let query = supabase
        .from('parties')
        .select('code')
        .order('code', { ascending: false })
        .limit(1);

    if (branch) {
        query = query.eq('branch_code', branch);
    }

    const { data } = await query.maybeSingle();
    const maxNum = data?.code ? parseInt(String(data.code), 10) : NaN;
    if (Number.isNaN(maxNum)) return '000001';
    return String(maxNum + 1).padStart(6, '0');
};

// GET /api/parties
// Supports: ?q=search&branch=CODE | ?code= | ?gstin=&excludeId= | ?nextCode=1
export async function GET(req: NextRequest) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const { searchParams } = req.nextUrl;
    const code = searchParams.get('code')?.trim();
    const gstin = searchParams.get('gstin')?.trim();
    const excludeId = searchParams.get('excludeId')?.trim() || undefined;
    const wantNextCode = searchParams.get('nextCode') === '1' || searchParams.get('nextCode') === 'true';
    const q = searchParams.get('q') || '';
    const listBranch = auth.resolveListBranch(searchParams.get('branch'));

    if (wantNextCode) {
        const next = await nextPartyCode(auth.supabase, listBranch);
        return NextResponse.json({ nextCode: next });
    }

    if (code) {
        let query = auth.supabase
            .from('parties')
            .select('*')
            .eq('code', code);

        if (listBranch) {
            query = query.eq('branch_code', listBranch);
        }

        const { data, error } = await query.maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!data) return NextResponse.json(null);
        const forbidden = auth.forbidIfForeignBranch(data.branch_code);
        if (forbidden) return forbidden;
        return NextResponse.json(data);
    }

    if (gstin) {
        let query = auth.supabase
            .from('parties')
            .select('*')
            .eq('is_active', true)
            .eq('gstin', gstin.toUpperCase());

        if (listBranch) {
            query = query.eq('branch_code', listBranch);
        }
        if (excludeId) {
            query = query.neq('id', excludeId);
        }

        const { data, error } = await query.limit(1).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!data) return NextResponse.json(null);
        const forbidden = auth.forbidIfForeignBranch(data.branch_code);
        if (forbidden) return forbidden;
        return NextResponse.json(data);
    }

    let query = auth.supabase
        .from('parties')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (listBranch) {
        query = query.eq('branch_code', listBranch);
    }

    if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(`name.ilike.${term},code.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

// POST /api/parties — create (admin)
export async function POST(req: NextRequest) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const parsed = PartySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message || 'Invalid party data' },
            { status: 400 },
        );
    }

    const input = parsed.data;
    let branchCode = normalizeBranch(input.branch_code);

    if (auth.isBranchScoped) {
        branchCode = auth.branchCode!;
    }

    if (!branchCode) {
        return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
    }

    if (!auth.canAccessBranch(branchCode)) {
        return NextResponse.json({ error: 'Forbidden: Outside your branch scope' }, { status: 403 });
    }

    if (input.gstin) {
        const { data: existingGstin } = await auth.supabase
            .from('parties')
            .select('id, name, code')
            .eq('is_active', true)
            .eq('gstin', input.gstin.toUpperCase())
            .eq('branch_code', branchCode)
            .limit(1)
            .maybeSingle();

        if (existingGstin) {
            return NextResponse.json(
                {
                    error: `A party with GSTIN "${input.gstin}" already exists: "${existingGstin.name}" (${existingGstin.code})`,
                },
                { status: 409 },
            );
        }
    }

    const { data: existingCode } = await auth.supabase
        .from('parties')
        .select('id, name')
        .eq('code', input.code)
        .maybeSingle();

    if (existingCode) {
        return NextResponse.json(
            { error: `Party code "${input.code}" is already used by "${existingCode.name}"` },
            { status: 409 },
        );
    }

    const { data, error } = await auth.supabase
        .from('parties')
        .insert({
            ...input,
            gstin: input.gstin ? input.gstin.toUpperCase() : null,
            branch_code: branchCode,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
}
