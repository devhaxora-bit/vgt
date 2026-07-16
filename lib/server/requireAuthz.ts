import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
    canAccessAdminPath,
    hasFullBranchAccess,
    isBranchScopedAccess,
} from '@/lib/branchAccess';
import type { BranchAccess, UserRole } from '@/lib/types/user.types';

export const BRANCH_SCOPE_HEADER = 'x-vgt-branch-scope';
export const BRANCH_CODE_HEADER = 'x-vgt-branch-code';
export const BRANCH_ROLE_HEADER = 'x-vgt-role';

export type BranchScope = 'full' | 'branch';

export type AuthzUser = {
    id: string;
    role: UserRole | string;
    branch_access: BranchAccess | string;
    branch_code: string | null;
    full_name?: string | null;
    employee_code?: string | null;
};

export type AuthzContext = {
    user: AuthzUser;
    scope: BranchScope;
    branchCode: string | null;
    supabase: Awaited<ReturnType<typeof createClient>>;
    /** true when user is limited to one branch */
    isBranchScoped: boolean;
    /** true when global/main — all branches */
    hasFullAccess: boolean;
    /**
     * Apply .eq(column, branchCode) when scoped.
     * Returns the same query builder for chaining.
     */
    applyBranchFilter: <T extends { eq: (column: string, value: string) => T }>(
        query: T,
        column: string,
    ) => T;
    /**
     * For list APIs that accept ?branch= — force branch users onto their code.
     * Full-access users keep the requested branch (or null = all).
     */
    resolveListBranch: (requestedBranch?: string | null) => string | null;
    /** 403 Response if value is foreign branch for a scoped user */
    forbidIfForeignBranch: (value: string | null | undefined) => NextResponse | null;
    /** true if this branch value is allowed for the current user */
    canAccessBranch: (value: string | null | undefined) => boolean;
};

export type AuthzFailure = {
    ok: false;
    response: NextResponse;
};

export type AuthzSuccess = {
    ok: true;
} & AuthzContext;

export type AuthzOk = AuthzSuccess;

export type AuthzResult = AuthzSuccess | AuthzFailure;

export type EntityBranchRow = { id: string; branch_code: string };

type EntityBranchFailure = { ok: false; response: NextResponse };
type EntityBranchSuccess = { ok: true; entity: EntityBranchRow };

export type EntityBranchResult = EntityBranchFailure | EntityBranchSuccess;

const normalizeBranchCode = (value: string | null | undefined): string | null => {
    const code = String(value || '').trim().toUpperCase();
    return code || null;
};

/** Resolve head/main branch code for stamping when parent has none. */
export async function resolveHeadBranchCode(
    supabase: AuthzOk['supabase'],
): Promise<string | null> {
    const { data: head } = await supabase
        .from('branches')
        .select('code')
        .eq('is_head_branch', true)
        .order('code')
        .limit(1)
        .maybeSingle();

    if (head?.code) return normalizeBranchCode(head.code);

    const { data: vzm } = await supabase
        .from('branches')
        .select('code')
        .ilike('code', 'VZM')
        .limit(1)
        .maybeSingle();

    if (vzm?.code) return normalizeBranchCode(vzm.code);

    const { data: first } = await supabase
        .from('branches')
        .select('code')
        .eq('is_active', true)
        .order('name')
        .limit(1)
        .maybeSingle();

    return normalizeBranchCode(first?.code);
}

/**
 * Load party and enforce branch scope for write routes keyed by partyId.
 * Returns a resolved branch_code suitable for stamping on bills/payments.
 */
export async function requirePartyBranchAccess(
    auth: AuthzOk,
    partyId: string,
): Promise<EntityBranchResult> {
    const { data: party, error } = await auth.supabase
        .from('parties')
        .select('id, branch_code')
        .eq('id', partyId)
        .single();

    if (error || !party) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Party not found' }, { status: 404 }),
        };
    }

    const parentBranch = normalizeBranchCode(party.branch_code);
    const forbidden = auth.forbidIfForeignBranch(parentBranch);
    if (forbidden) {
        return { ok: false, response: forbidden };
    }

    const branchCode = parentBranch || (await resolveHeadBranchCode(auth.supabase));
    if (!branchCode) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Party has no branch_code and no head branch is configured' },
                { status: 400 },
            ),
        };
    }

    return { ok: true, entity: { id: party.id, branch_code: branchCode } };
}

/**
 * Load broker and enforce branch scope for write routes keyed by brokerId.
 * Returns a resolved branch_code suitable for stamping on bills/payments.
 */
export async function requireBrokerBranchAccess(
    auth: AuthzOk,
    brokerId: string,
): Promise<EntityBranchResult> {
    const { data: broker, error } = await auth.supabase
        .from('brokers')
        .select('id, branch_code')
        .eq('id', brokerId)
        .single();

    if (error || !broker) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Broker not found' }, { status: 404 }),
        };
    }

    const parentBranch = normalizeBranchCode(broker.branch_code);
    if (parentBranch) {
        const forbidden = auth.forbidIfForeignBranch(parentBranch);
        if (forbidden) {
            return { ok: false, response: forbidden };
        }
    } else if (auth.isBranchScoped) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Forbidden: Broker has no branch_code' },
                { status: 403 },
            ),
        };
    }

    const branchCode = parentBranch || (await resolveHeadBranchCode(auth.supabase));
    if (!branchCode) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Broker has no branch_code and no head branch is configured' },
                { status: 400 },
            ),
        };
    }

    return { ok: true, entity: { id: broker.id, branch_code: branchCode } };
}

type RequireAuthzOptions = {
    /** If set, user.role must be one of these (case-insensitive) */
    roles?: Array<UserRole | string>;
    /** Require admin role */
    adminOnly?: boolean;
    /** Require global/main (full) branch access */
    fullAccessOnly?: boolean;
};

const normalizeBranch = (value: string | null | undefined): string | null => {
    const code = String(value || '').trim().toUpperCase();
    return code || null;
};

/**
 * Central authz for API routes.
 * Load once per request — do not re-implement branch checks in each route.
 */
export async function requireAuthz(
    options: RequireAuthzOptions = {},
): Promise<AuthzResult> {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const { data: profile, error } = await supabase
        .from('users')
        .select('id, role, branch_access, branch_code, full_name, employee_code')
        .eq('id', authUser.id)
        .single();

    if (error || !profile) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'User profile not found' }, { status: 403 }),
        };
    }

    if (options.adminOnly && String(profile.role).toLowerCase() !== 'admin') {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 }),
        };
    }

    if (options.roles?.length) {
        const role = String(profile.role).toLowerCase();
        const allowed = options.roles.map((r) => String(r).toLowerCase());
        if (!allowed.includes(role)) {
            return {
                ok: false,
                response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
            };
        }
    }

    const fullAccess = hasFullBranchAccess(profile);
    if (options.fullAccessOnly && !fullAccess) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Forbidden: Full (global/main) access required' },
                { status: 403 },
            ),
        };
    }

    const branchScoped = isBranchScopedAccess(profile);
    const branchCode = branchScoped
        ? normalizeBranch(profile.branch_code)
        : normalizeBranch(profile.branch_code);

    if (branchScoped && !branchCode) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Branch-only account is missing branch_code. Contact admin.' },
                { status: 403 },
            ),
        };
    }

    const scope: BranchScope = branchScoped ? 'branch' : 'full';

    const canAccessBranch = (value: string | null | undefined): boolean => {
        if (scope === 'full') return true;
        const code = normalizeBranch(value);
        if (!code) return false;
        return code === branchCode;
    };

    const applyBranchFilter = <T extends { eq: (column: string, value: string) => T }>(
        query: T,
        column: string,
    ): T => {
        if (scope === 'branch' && branchCode) {
            return query.eq(column, branchCode);
        }
        return query;
    };

    const resolveListBranch = (requestedBranch?: string | null): string | null => {
        if (scope === 'branch') {
            return branchCode;
        }
        return normalizeBranch(requestedBranch);
    };

    const forbidIfForeignBranch = (value: string | null | undefined): NextResponse | null => {
        if (canAccessBranch(value)) return null;
        return NextResponse.json(
            { error: 'Forbidden: Outside your branch scope' },
            { status: 403 },
        );
    };

    return {
        ok: true,
        user: {
            id: profile.id,
            role: profile.role,
            branch_access: profile.branch_access || 'global',
            branch_code: normalizeBranch(profile.branch_code),
            full_name: profile.full_name,
            employee_code: profile.employee_code,
        },
        scope,
        branchCode: scope === 'branch' ? branchCode : normalizeBranch(profile.branch_code),
        supabase,
        isBranchScoped: branchScoped,
        hasFullAccess: fullAccess,
        applyBranchFilter,
        resolveListBranch,
        forbidIfForeignBranch,
        canAccessBranch,
    };
}

/** Page-level admin path check usable from proxy / layouts */
export const canAccessDashboardAdminPath = canAccessAdminPath;
