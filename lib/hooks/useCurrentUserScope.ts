'use client';

import { useEffect, useState } from 'react';
import { hasFullBranchAccess, isBranchScopedAccess } from '@/lib/branchAccess';

export type CurrentUserScope = {
    ready: boolean;
    role: string | null;
    branchAccess: string | null;
    /** Uppercase home / assigned branch code when present */
    branchCode: string | null;
    /** global/main — can see all branches */
    hasFullAccess: boolean;
    /** branch-only — locked to branchCode */
    isBranchScoped: boolean;
};

const EMPTY: CurrentUserScope = {
    ready: false,
    role: null,
    branchAccess: null,
    branchCode: null,
    hasFullAccess: true,
    isBranchScoped: false,
};

/**
 * Current user's branch scope for defaulting / locking branch dropdowns.
 */
export function useCurrentUserScope(): CurrentUserScope {
    const [scope, setScope] = useState<CurrentUserScope>(EMPTY);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch('/api/auth/me');
                const json = await res.json();
                const user = json?.data;
                if (cancelled) return;

                if (!user) {
                    setScope({ ...EMPTY, ready: true });
                    return;
                }

                const branchCode = String(user.branch_code || '').trim().toUpperCase() || null;
                const branchAccess = String(user.branch_access || 'global').toLowerCase();

                setScope({
                    ready: true,
                    role: user.role || null,
                    branchAccess,
                    branchCode,
                    hasFullAccess: hasFullBranchAccess(user),
                    isBranchScoped: isBranchScopedAccess(user) && Boolean(branchCode),
                });
            } catch {
                if (!cancelled) {
                    setScope({ ...EMPTY, ready: true });
                }
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    return scope;
}

/** Default list filter value: branch users → their code; others with home branch → that; else 'all' */
export function defaultBranchFilterValue(scope: CurrentUserScope): string {
    if (!scope.ready) return 'all';
    if (scope.branchCode) return scope.branchCode;
    return 'all';
}
