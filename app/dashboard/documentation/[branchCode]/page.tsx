'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    ArrowLeft,
    ChevronRight,
    FileText,
    Hash,
    Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { hasFullBranchAccess } from '@/lib/branchAccess';
import { toast } from 'sonner';

type Branch = {
    code: string;
    name: string;
    city: string;
    state: string;
    is_head_branch: boolean;
};

type DocItem = {
    id: string;
    title: string;
    description: string;
    href: string;
    adminOnly: boolean;
    /** Only global/main admins (not branch-scoped) */
    fullAccessOnly?: boolean;
};

export default function BranchDocumentationPage() {
    const params = useParams();
    const branchCode = String(params.branchCode || '').toUpperCase();
    const [branch, setBranch] = useState<Branch | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isFullAccessAdmin, setIsFullAccessAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    const { data: profile } = await supabase
                        .from('users')
                        .select('role, branch_access')
                        .eq('id', user.id)
                        .single();
                    setIsAdmin(profile?.role === 'admin');
                    setIsFullAccessAdmin(
                        profile?.role === 'admin' && hasFullBranchAccess(profile),
                    );
                }

                const res = await fetch('/api/references/branches?includeCnConfig=1');
                if (!res.ok) throw new Error('Failed to fetch branch');
                const branches = await res.json();
                const match = branches.find(
                    (b: Branch & { code: string }) => b.code.toUpperCase() === branchCode
                );

                if (!match) {
                    toast.error('Branch not found');
                    setBranch(null);
                    return;
                }

                setBranch(match);
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Failed to load branch');
            } finally {
                setLoading(false);
            }
        };

        if (branchCode) load();
    }, [branchCode]);

    const docItems: DocItem[] = [
        {
            id: 'cn-assigning',
            title: 'CN Assigning',
            description: 'Issue CN number ranges, view assignment history, and manage low-CN warnings for this branch.',
            href: `/dashboard/documentation/${branchCode}/cn-assigning`,
            adminOnly: true,
        },
        {
            id: 'cn-soft-delete',
            title: 'CN Soft-Delete',
            description: 'Search CNs, soft-delete them (audit retained), and release the CN number for reuse. Main/global admin only.',
            href: `/dashboard/documentation/${branchCode}/cn-soft-delete`,
            adminOnly: true,
            fullAccessOnly: true,
        },
    ];

    const visibleItems = docItems.filter((item) => {
        if (item.fullAccessOnly) return isFullAccessAdmin;
        if (item.adminOnly) return isAdmin;
        return true;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!branch) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" asChild>
                    <Link href="/dashboard/documentation">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to branches
                    </Link>
                </Button>
                <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                    Branch not found.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
                    <Link href="/dashboard/documentation">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        All branches
                    </Link>
                </Button>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <FileText className="h-4 w-4" />
                    <Link href="/dashboard/documentation" className="hover:text-foreground">Documentation</Link>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-foreground font-medium">{branch.code}</span>
                </div>

                <h1 className="text-2xl font-bold text-[#101828]">
                    {branch.code} — {branch.name}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {branch.city}, {branch.state} · Select a documentation section below.
                </p>
            </div>

            {visibleItems.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                    No documentation sections available for your role.
                </div>
            ) : (
                <div className="grid gap-3 max-w-2xl">
                    {visibleItems.map((item) => (
                        <Link
                            key={item.id}
                            href={item.href}
                            className="group flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                        >
                            <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <Hash className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-[#101828]">{item.title}</span>
                                    {item.adminOnly && (
                                        <Badge variant="outline" className="text-xs">Admin</Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
