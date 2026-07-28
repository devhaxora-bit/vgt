import { NextRequest, NextResponse } from 'next/server';
import { requireAuthz, type AuthzOk } from '@/lib/server/requireAuthz';
import { friendlyPartyDbError } from '@/lib/server/partyDbErrors';
import { PartySchema } from '@/lib/types/party.types';
import { createAdminClient } from '@/utils/supabase/admin';

const normalizeBranch = (value: unknown): string =>
    String(value || '').trim().toUpperCase();

/** Global sequential codes (parties_code_key is unique across all branches). */
const nextPartyCode = async (supabase: AuthzOk['supabase']): Promise<string> => {
    const { data } = await supabase
        .from('parties')
        .select('code')
        .order('code', { ascending: false })
        .limit(1)
        .maybeSingle();

    const maxNum = data?.code ? parseInt(String(data.code), 10) : NaN;
    if (Number.isNaN(maxNum)) return '000001';
    return String(maxNum + 1).padStart(6, '0');
};

type ExistingGstinParty = {
    id: string;
    name: string;
    code: string;
    gstin: string | null;
    branch_code: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    pincode?: string | null;
    is_active?: boolean;
};

const findPartyByGstinGlobal = async (
    gstin: string,
    excludeId?: string,
): Promise<ExistingGstinParty | null> => {
    const normalized = gstin.toUpperCase().trim();
    const { data, error } = await createAdminClient()
        .from('parties')
        .select('id, name, code, gstin, branch_code, address, phone, email, pincode, is_active')
        .eq('is_active', true)
        .eq('gstin', normalized)
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;
    if (excludeId && data.id === excludeId) return null;
    return data as ExistingGstinParty;
};

const isPartyLinkedToBranch = async (partyId: string, branchCode: string): Promise<boolean> => {
    const { data } = await createAdminClient()
        .from('party_branches')
        .select('party_id')
        .eq('party_id', partyId)
        .eq('branch_code', branchCode)
        .maybeSingle();
    return Boolean(data);
};

const linkPartyToBranch = async (
    supabase: AuthzOk['supabase'],
    partyId: string,
    branchCode: string,
) => {
    const { data, error } = await supabase.rpc('link_party_to_branch', {
        p_party_id: partyId,
        p_branch_code: branchCode,
    });

    if (error) {
        const message = String(error.message || '');
        if (/permission|own branch|authentication/i.test(message)) {
            return { error: message, status: 403 as const };
        }
        return { error: message || 'Could not add party to this branch', status: 400 as const };
    }

    // rpc may return a row or array depending on PostgREST typing
    const party = Array.isArray(data) ? data[0] : data;
    if (!party) {
        return { error: 'Could not add party to this branch', status: 400 as const };
    }
    return { party };
};

// GET /api/parties
// Supports: ?q=search&branch=CODE | ?code= | ?gstin=&excludeId=&forBranch= | ?nextCode=1
export async function GET(req: NextRequest) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const { searchParams } = req.nextUrl;
    const code = searchParams.get('code')?.trim();
    const gstin = searchParams.get('gstin')?.trim();
    const excludeId = searchParams.get('excludeId')?.trim() || undefined;
    const forBranch = normalizeBranch(searchParams.get('forBranch'));
    const wantNextCode = searchParams.get('nextCode') === '1' || searchParams.get('nextCode') === 'true';
    const q = searchParams.get('q') || '';
    const listBranch = auth.resolveListBranch(searchParams.get('branch'));

    if (wantNextCode) {
        const next = await nextPartyCode(auth.supabase);
        return NextResponse.json({ nextCode: next });
    }

    if (code) {
        // Codes are globally unique — look up without branch filter.
        const { data, error } = await auth.supabase
            .from('parties')
            .select('*')
            .eq('code', code)
            .maybeSingle();

        if (error) {
            // Fall back to admin if RLS hides a foreign-home party (still global unique)
            const { data: adminData } = await createAdminClient()
                .from('parties')
                .select('id, name, code, gstin, branch_code, is_active')
                .eq('code', code)
                .maybeSingle();
            if (!adminData) return NextResponse.json(null);
            return NextResponse.json(adminData);
        }
        if (!data) {
            const { data: adminData } = await createAdminClient()
                .from('parties')
                .select('id, name, code, gstin, branch_code, is_active')
                .eq('code', code)
                .maybeSingle();
            return NextResponse.json(adminData || null);
        }
        return NextResponse.json(data);
    }

    if (gstin) {
        const existing = await findPartyByGstinGlobal(gstin, excludeId);
        if (!existing) return NextResponse.json(null);

        const checkBranch = forBranch || listBranch || auth.branchCode || '';
        const alreadyLinked = checkBranch
            ? await isPartyLinkedToBranch(existing.id, checkBranch)
            : false;

        return NextResponse.json({
            ...existing,
            alreadyLinkedToBranch: alreadyLinked,
            checkBranch: checkBranch || null,
        });
    }

    if (listBranch) {
        const { data, error } = await auth.supabase
            .from('parties')
            .select('*, party_branches!inner(branch_code)')
            .eq('is_active', true)
            .eq('party_branches.branch_code', listBranch)
            .order('name');

        if (error) {
            // party_branches may not exist yet pre-migration — fall back to home branch
            const { data: fallback, error: fallbackError } = await auth.supabase
                .from('parties')
                .select('*')
                .eq('is_active', true)
                .eq('branch_code', listBranch)
                .order('name');

            if (fallbackError) {
                return NextResponse.json(
                    { error: 'Could not load parties. Please try again' },
                    { status: 500 },
                );
            }

            let list = fallback || [];
            if (q.trim()) {
                const term = q.trim().toLowerCase();
                list = list.filter(
                    (p) =>
                        String(p.name || '').toLowerCase().includes(term)
                        || String(p.code || '').toLowerCase().includes(term),
                );
            }
            return NextResponse.json(list);
        }

        let list = (data || []).map((row) => {
            const { party_branches: _pb, ...party } = row as Record<string, unknown>;
            return party;
        });

        if (q.trim()) {
            const term = q.trim().toLowerCase();
            list = list.filter(
                (p) =>
                    String((p as { name?: string }).name || '').toLowerCase().includes(term)
                    || String((p as { code?: string }).code || '').toLowerCase().includes(term),
            );
        }
        return NextResponse.json(list);
    }

    let query = auth.supabase
        .from('parties')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(`name.ilike.${term},code.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) {
        return NextResponse.json(
            { error: 'Could not load parties. Please try again' },
            { status: 500 },
        );
    }
    return NextResponse.json(data || []);
}

// POST /api/parties — create, or link existing GSTIN party to branch
export async function POST(req: NextRequest) {
    const auth = await requireAuthz({ masterDataCreate: true });
    if (!auth.ok) return auth.response;

    const body = await req.json();

    // Link-only flow: { linkPartyId, branch_code }
    const linkPartyId = typeof body.linkPartyId === 'string' ? body.linkPartyId.trim() : '';
    if (linkPartyId) {
        let branchCode = normalizeBranch(body.branch_code);
        if (auth.isBranchScoped) branchCode = auth.branchCode!;
        if (!branchCode) {
            return NextResponse.json({ error: 'Select a branch before adding the party' }, { status: 400 });
        }
        if (!auth.canAccessBranch(branchCode)) {
            return NextResponse.json(
                { error: `You can only add parties to your branch (${auth.branchCode})` },
                { status: 403 },
            );
        }

        const linked = await linkPartyToBranch(auth.supabase, linkPartyId, branchCode);
        if ('error' in linked && linked.error) {
            return NextResponse.json({ error: linked.error }, { status: linked.status });
        }
        return NextResponse.json(
            { ...(linked as { party: ExistingGstinParty }).party, linkedToBranch: branchCode },
            { status: 200 },
        );
    }

    const parsed = PartySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message || 'Check the party details and try again' },
            { status: 400 },
        );
    }

    const input = parsed.data;
    let branchCode = normalizeBranch(input.branch_code);

    if (auth.isBranchScoped) {
        branchCode = auth.branchCode!;
    }

    if (!branchCode) {
        return NextResponse.json({ error: 'Select a branch before saving the party' }, { status: 400 });
    }

    if (!auth.canAccessBranch(branchCode)) {
        return NextResponse.json(
            { error: `You can only create parties for your branch (${auth.branchCode})` },
            { status: 403 },
        );
    }

    if (input.gstin) {
        const existingGstin = await findPartyByGstinGlobal(input.gstin);
        if (existingGstin) {
            const alreadyLinked = await isPartyLinkedToBranch(existingGstin.id, branchCode);
            if (alreadyLinked) {
                return NextResponse.json(
                    {
                        error: `GSTIN already used by ${existingGstin.name} (${existingGstin.code}) on this branch`,
                        code: 'GSTIN_EXISTS_SAME_BRANCH',
                        existingParty: existingGstin,
                    },
                    { status: 409 },
                );
            }

            return NextResponse.json(
                {
                    error: `GSTIN already used by ${existingGstin.name} (${existingGstin.code}) at branch ${existingGstin.branch_code || 'another'}`,
                    code: 'GSTIN_EXISTS_OTHER_BRANCH',
                    existingParty: existingGstin,
                    targetBranch: branchCode,
                },
                { status: 409 },
            );
        }
    }

    const { data: existingCode } = await createAdminClient()
        .from('parties')
        .select('id, name')
        .eq('code', input.code)
        .maybeSingle();

    if (existingCode) {
        return NextResponse.json(
            { error: `Party code ${input.code} is already used by ${existingCode.name}` },
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
        const { message, status } = friendlyPartyDbError(error, 'create', { code: input.code });
        return NextResponse.json({ error: message }, { status });
    }

    // Ensure branch tag exists even if trigger is not yet applied
    await createAdminClient()
        .from('party_branches')
        .upsert(
            { party_id: data.id, branch_code: branchCode },
            { onConflict: 'party_id,branch_code' },
        );

    return NextResponse.json(data, { status: 201 });
}
