import { NextRequest, NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';
import { PartySchema } from '@/lib/types/party.types';

const normalizeBranch = (value: unknown): string =>
    String(value || '').trim().toUpperCase();

// PUT /api/parties/[id] — update (admin)
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json();

    const { data: existing, error: existingError } = await auth.supabase
        .from('parties')
        .select('id, branch_code, code, name')
        .eq('id', id)
        .single();

    if (existingError || !existing) {
        return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    const forbidden = auth.forbidIfForeignBranch(existing.branch_code);
    if (forbidden) return forbidden;

    const parsed = PartySchema.partial().safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message || 'Invalid party data' },
            { status: 400 },
        );
    }

    const input = parsed.data;
    let branchCode = input.branch_code !== undefined
        ? normalizeBranch(input.branch_code)
        : normalizeBranch(existing.branch_code);

    if (auth.isBranchScoped) {
        branchCode = auth.branchCode!;
    }

    if (!branchCode) {
        return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
    }

    if (!auth.canAccessBranch(branchCode)) {
        return NextResponse.json({ error: 'Forbidden: Outside your branch scope' }, { status: 403 });
    }

    if (input.code && input.code !== existing.code) {
        const { data: codeTaken } = await auth.supabase
            .from('parties')
            .select('id, name')
            .eq('code', input.code)
            .neq('id', id)
            .maybeSingle();

        if (codeTaken) {
            return NextResponse.json(
                { error: `Party code "${input.code}" is already used by "${codeTaken.name}"` },
                { status: 409 },
            );
        }
    }

    if (input.gstin) {
        const { data: existingGstin } = await auth.supabase
            .from('parties')
            .select('id, name, code')
            .eq('is_active', true)
            .eq('gstin', input.gstin.toUpperCase())
            .eq('branch_code', branchCode)
            .neq('id', id)
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

    const { data, error } = await auth.supabase
        .from('parties')
        .update({
            ...input,
            gstin: input.gstin !== undefined
                ? (input.gstin ? input.gstin.toUpperCase() : null)
                : undefined,
            branch_code: branchCode,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
}

// DELETE /api/parties/[id] — soft deactivate (admin)
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const { data: existing } = await auth.supabase
        .from('parties')
        .select('id, branch_code')
        .eq('id', id)
        .single();

    if (!existing) {
        return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    const forbidden = auth.forbidIfForeignBranch(existing.branch_code);
    if (forbidden) return forbidden;

    const { error } = await auth.supabase
        .from('parties')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}
