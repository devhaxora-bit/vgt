'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, Crown, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Branch = {
    id: string;
    code: string;
    name: string;
    type: string;
    city: string;
    state: string;
    is_head_branch: boolean;
    is_low_cn?: boolean;
    remaining_count?: number | null;
    active_cn_range?: { range_start: number; range_end: number; next_cn_no: number } | null;
};

export default function DocumentationPage() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchBranches = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/references/branches?includeCnConfig=1');
                if (!res.ok) throw new Error('Failed to fetch branches');
                const data = await res.json();
                setBranches(data);
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Failed to load branches');
            } finally {
                setLoading(false);
            }
        };

        fetchBranches();
    }, []);

    const filteredBranches = useMemo(
        () =>
            branches.filter(
                (b) =>
                    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    b.city.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [branches, searchTerm]
    );

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <FileText className="h-4 w-4" />
                    <span>Support</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-foreground font-medium">Documentation</span>
                </div>
                <h1 className="text-2xl font-bold text-[#101828]">Documentation</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Select a branch to view and manage branch-specific documentation and operations.
                </p>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm max-w-md">
                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                <Input
                    placeholder="Search branches by name, code or city…"
                    className="border-none shadow-none focus-visible:ring-0 h-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="text-center py-16 text-muted-foreground">Loading branches…</div>
            ) : filteredBranches.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                    No branches found.
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredBranches.map((branch) => (
                        <Link
                            key={branch.id}
                            href={`/dashboard/documentation/${branch.code}`}
                            className="group rounded-lg border bg-white p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-bold text-[#101828]">{branch.code}</span>
                                            {branch.is_head_branch && (
                                                <Crown className="h-3.5 w-3.5 text-indigo-500" aria-label="Head Branch" />
                                            )}
                                        </div>
                                        <div className="text-sm font-medium text-[#101828]">{branch.name}</div>
                                        <div className="text-xs text-muted-foreground">{branch.city}, {branch.state}</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-1 shrink-0" />
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{branch.type}</Badge>
                                {branch.active_cn_range ? (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                        CN {branch.active_cn_range.next_cn_no}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">No CN range</Badge>
                                )}
                                {branch.is_low_cn && typeof branch.remaining_count === 'number' && (
                                    <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                                        {branch.remaining_count} CNs left
                                    </Badge>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
