'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const checkAdminRole = async () => {
            try {
                const supabase = createClient();
                const { data: { user: authUser } } = await supabase.auth.getUser();

                if (!authUser) {
                    router.replace('/login');
                    return;
                }

                // Check user role in public.users table
                const { data: userProfile, error } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', authUser.id)
                    .single();

                if (error || !userProfile) {
                    toast.error('Failed to verify permissions');
                    router.replace('/dashboard');
                    return;
                }

                if (userProfile.role !== 'admin') {
                    toast.error('Access Denied: Admin privileges required');
                    router.replace('/dashboard');
                    return;
                }

                setIsAuthorized(true);
            } catch (error) {
                console.error('Admin check failed:', error);
                router.replace('/dashboard');
            } finally {
                setIsLoading(false);
            }
        };

        checkAdminRole();
    }, [router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12 h-full min-h-[500px]">
                <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">Verifying admin permissions...</p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return null;
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#101828]">System Administration</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage users, branches, and system configurations.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-6 min-h-[60vh]">
                {children}
            </div>
        </div>
    );
}
