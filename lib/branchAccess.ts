import type { BranchAccess } from '@/lib/types/user.types';

/** Global and Main branch accounts share full multi-branch rights. */
export const hasFullBranchAccess = (
    user: { branch_access?: BranchAccess | string | null } | null | undefined,
): boolean => {
    const access = String(user?.branch_access || 'global').toLowerCase();
    return access === 'global' || access === 'main';
};

export const branchAccessLabel = (
    access: BranchAccess | string | null | undefined,
): string => {
    switch (String(access || 'global').toLowerCase()) {
        case 'main':
            return 'Main Branch';
        case 'branch':
            return 'Branch Only';
        case 'global':
        default:
            return 'Global';
    }
};
