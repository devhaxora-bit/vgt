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
 * Admin menu + pages allowed for branch-scoped admins and employees.
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

type AccessUser = {
    role?: string | null;
    branch_access?: BranchAccess | string | null;
} | null | undefined;

const normalizeRole = (user: AccessUser): string =>
    String(user?.role || '').toLowerCase();

export const isEmployee = (user: AccessUser): boolean =>
    normalizeRole(user) === 'employee';

/** Full-access (global/main) employees — can create masters for any branch. */
export const isFullAccessEmployee = (user: AccessUser): boolean =>
    isEmployee(user) && hasFullBranchAccess(user);

/** Branch-only employees — can create masters for their own branch only. */
export const isBranchEmployee = (user: AccessUser): boolean =>
    isEmployee(user) && isBranchScopedAccess(user);

/** Admins: edit/delete parties, brokers, vehicles. */
export const canManageMasterData = (user: AccessUser): boolean =>
    normalizeRole(user) === 'admin';

/**
 * Admins + all employees may create parties/brokers/vehicles.
 * Branch scope is enforced by API/RLS (own branch vs any branch).
 */
export const canCreateMasterData = (user: AccessUser): boolean =>
    canManageMasterData(user) || isEmployee(user);

export const canAccessAdminPath = (
    user: AccessUser,
    pathname: string,
): boolean => {
    if (normalizeRole(user) !== 'admin') {
        return false;
    }
    if (hasFullBranchAccess(user)) {
        return true;
    }
    return isBranchAdminAllowedPath(pathname);
};

/**
 * Page access for party / broker / vehicle routes.
 * - Admins: existing admin rules
 * - Employees: those three pages only (add-only in UI)
 */
export const canAccessMasterDataPath = (
    user: AccessUser,
    pathname: string,
): boolean => {
    if (canAccessAdminPath(user, pathname)) {
        return true;
    }
    return isEmployee(user) && isBranchAdminAllowedPath(pathname);
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
