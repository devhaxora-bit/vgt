'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    BRANCH_ADMIN_ALLOWED_PATHS,
    canAccessMasterDataPath,
    canManageMasterData,
    isBranchScopedAccess,
    isEmployee,
} from '@/lib/branchAccess';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isBranchAdmin, setIsBranchAdmin] = useState(false);
    const [isMasterDataCreator, setIsMasterDataCreator] = useState(false);

    useEffect(() => {
        const checkAdminRole = async () => {
            setIsLoading(true);
            setIsAuthorized(false);

            try {
                const supabase = createClient();
                const { data: { user: authUser } } = await supabase.auth.getUser();

                if (!authUser) {
                    router.replace('/login');
                    return;
                }

                const { data: userProfile, error } = await supabase
                    .from('users')
                    .select('role, branch_access')
                    .eq('id', authUser.id)
                    .single();

                if (error || !userProfile) {
                    toast.error('Failed to verify permissions');
                    router.replace('/dashboard');
                    return;
                }

                if (!canAccessMasterDataPath(userProfile, pathname)) {
                    toast.error('Access Denied: Not available for your role');
                    if (canAccessMasterDataPath(userProfile, BRANCH_ADMIN_ALLOWED_PATHS[0])) {
                        router.replace(BRANCH_ADMIN_ALLOWED_PATHS[0]);
                    } else {
                        router.replace('/dashboard');
                    }
                    return;
                }

                setIsBranchAdmin(isBranchScopedAccess(userProfile) && canManageMasterData(userProfile));
                setIsMasterDataCreator(isEmployee(userProfile) && !canManageMasterData(userProfile));
                setIsAuthorized(true);
            } catch (error) {
                console.error('Admin check failed:', error);
                router.replace('/dashboard');
            } finally {
                setIsLoading(false);
            }
        };

        void checkAdminRole();
    }, [router, pathname]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12 h-full min-h-[500px]">
                <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">Verifying permissions...</p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return null;
    }

    const title = isMasterDataCreator
        ? 'Master Data'
        : isBranchAdmin
            ? 'Branch Administration'
            : 'System Administration';

    const subtitle = isMasterDataCreator
        ? 'Add parties, brokers, and vehicles. Branch users can create for their branch only; main/global users can create for any branch. Editing is limited to admins.'
        : isBranchAdmin
            ? 'Manage parties, brokers, and vehicles for your branch.'
            : 'Manage users, branches, and system configurations.';

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#101828]">
                        {title}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {subtitle}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-6 min-h-[60vh]">
                {children}
            </div>
        </div>
    );
}
