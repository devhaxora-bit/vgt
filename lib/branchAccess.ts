import type { BranchAccess } from '@/lib/types/user.types';

/** Global and Main branch accounts share full multi-branch rights. */
export const hasFullBranchAccess = (
    user: { branch_access?: BranchAccess | string | null } | null | undefined,
): boolean => {
    const access = String(user?.branch_access || 'global').toLowerCase();
    return access === 'global' || access === 'main';
};

/** Branch-scoped accounts are limited to their assigned branch_code. */
export const isBranchScopedAccess = (
    user: { branch_access?: BranchAccess | string | null } | null | undefined,
): boolean => {
    return String(user?.branch_access || 'global').toLowerCase() === 'branch';
};

/**
 * Admin menu + pages allowed for branch-scoped admins.
 * Global/Main admins keep the full System Administration area.
 */
export const BRANCH_ADMIN_ALLOWED_PATHS = [
    '/dashboard/admin/parties',
    '/dashboard/admin/brokers',
    '/dashboard/admin/vehicles',
] as const;

export const isBranchAdminAllowedPath = (pathname: string): boolean => {
    const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
    return BRANCH_ADMIN_ALLOWED_PATHS.some(
        (allowed) => path === allowed || path.startsWith(`${allowed}/`),
    );
};

export const canAccessAdminPath = (
    user: {
        role?: string | null;
        branch_access?: BranchAccess | string | null;
    } | null | undefined,
    pathname: string,
): boolean => {
    if (String(user?.role || '').toLowerCase() !== 'admin') {
        return false;
    }
    if (hasFullBranchAccess(user)) {
        return true;
    }
    return isBranchAdminAllowedPath(pathname);
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
