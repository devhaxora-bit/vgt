'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { CnAssigningPanel } from '@/components/features/documentation/CnAssigningPanel';
import { toast } from 'sonner';

export default function CnAssigningPage() {
    const params = useParams();
    const router = useRouter();
    const branchCode = String(params.branchCode || '').toUpperCase();
    const [branchName, setBranchName] = useState('');
    const [authChecked, setAuthChecked] = useState(false);

    useEffect(() => {
        const checkAdminAndLoad = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    router.replace('/login');
                    return;
                }

                const { data: profile } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (profile?.role !== 'admin') {
                    toast.error('Admin privileges required for CN Assigning');
                    router.replace(`/dashboard/documentation/${branchCode}`);
                    return;
                }

                const res = await fetch('/api/references/branches?includeCnConfig=1');
                if (res.ok) {
                    const branches = await res.json();
                    const match = branches.find(
                        (b: { code: string; name: string }) => b.code.toUpperCase() === branchCode
                    );
                    if (match) setBranchName(match.name);
                }

                setAuthChecked(true);
            } catch {
                toast.error('Failed to verify permissions');
                router.replace('/dashboard/documentation');
            }
        };

        if (branchCode) checkAdminAndLoad();
    }, [branchCode, router]);

    if (!authChecked) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
                    <Link href={`/dashboard/documentation/${branchCode}`}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to {branchCode} documentation
                    </Link>
                </Button>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <FileText className="h-4 w-4" />
                    <Link href="/dashboard/documentation" className="hover:text-foreground">Documentation</Link>
                    <ChevronRight className="h-3 w-3" />
                    <Link href={`/dashboard/documentation/${branchCode}`} className="hover:text-foreground">
                        {branchCode}
                    </Link>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-foreground font-medium">CN Assigning</span>
                </div>

                <h1 className="text-2xl font-bold text-[#101828]">CN Assigning</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {branchCode}{branchName ? ` — ${branchName}` : ''} · Issue CN ranges and view assignment history.
                </p>
            </div>

            <CnAssigningPanel branchCode={branchCode} />
        </div>
    );
}
