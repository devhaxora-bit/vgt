'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { AuthLoginAttempt } from '@/lib/types/authLoginAttempt.types';

const formatWhen = (iso: string): string =>
    new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });

const reasonLabel = (reason: string | null): string => {
    if (!reason) return '—';
    return reason.replace(/_/g, ' ');
};

function LoginAttemptsPageInner() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [rows, setRows] = useState<AuthLoginAttempt[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const success = searchParams.get('success') || 'all';
    const q = searchParams.get('q') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const limit = searchParams.get('limit') || '100';

    const [searchDraft, setSearchDraft] = useState(q);
    const [fromDraft, setFromDraft] = useState(from);
    const [toDraft, setToDraft] = useState(to);

    useEffect(() => {
        setSearchDraft(q);
        setFromDraft(from);
        setToDraft(to);
    }, [q, from, to]);

    const replaceParams = useCallback(
        (updates: Record<string, string | null>) => {
            const next = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(updates)) {
                if (!value) next.delete(key);
                else next.set(key, value);
            }
            const qs = next.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname);
        },
        [pathname, router, searchParams],
    );

    const fetchRows = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (success !== 'all') params.set('success', success);
            if (q) params.set('q', q);
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            params.set('limit', limit);

            const res = await fetch(`/api/admin/login-attempts?${params.toString()}`);
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || 'Failed to load login attempts');
            }
            setRows(json.data || []);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to load login attempts');
        } finally {
            setIsLoading(false);
        }
    }, [success, q, from, to, limit]);

    useEffect(() => {
        void fetchRows();
    }, [fetchRows]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#101828]">Login Attempts</h2>
                    <p className="text-sm text-muted-foreground">
                        Success and failure proof for access — employee code, role, IP, and reason.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void fetchRows()} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2 space-y-1.5">
                    <Label htmlFor="login-search">Employee / reason</Label>
                    <form
                        className="flex gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            replaceParams({
                                q: searchDraft.trim() || null,
                                from: fromDraft || null,
                                to: toDraft || null,
                            });
                        }}
                    >
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="login-search"
                                className="pl-8"
                                placeholder="Employee code or failure reason"
                                value={searchDraft}
                                onChange={(event) => setSearchDraft(event.target.value)}
                            />
                        </div>
                        <Button type="submit" variant="secondary">
                            Search
                        </Button>
                    </form>
                </div>
                <div className="space-y-1.5">
                    <Label>Result</Label>
                    <Select value={success} onValueChange={(value) => replaceParams({ success: value === 'all' ? null : value })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="true">Success</SelectItem>
                            <SelectItem value="false">Failed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="login-from">From</Label>
                    <Input
                        id="login-from"
                        type="date"
                        value={fromDraft}
                        onChange={(event) => setFromDraft(event.target.value)}
                        onBlur={() => replaceParams({ from: fromDraft || null })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="login-to">To</Label>
                    <Input
                        id="login-to"
                        type="date"
                        value={toDraft}
                        onChange={(event) => setToDraft(event.target.value)}
                        onBlur={() => replaceParams({ to: toDraft || null })}
                    />
                </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/40">
                            <TableHead className="w-[170px]">When</TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Result</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>IP</TableHead>
                            <TableHead className="min-w-[180px]">User agent</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                    Loading…
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    <div className="inline-flex items-center gap-2">
                                        <ShieldAlert className="h-4 w-4" />
                                        No login attempts match these filters. Apply the audit Phase A migration if this is a new environment.
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="text-xs whitespace-nowrap">{formatWhen(row.occurred_at)}</TableCell>
                                    <TableCell>
                                        <div className="font-mono text-xs font-semibold">{row.employee_code || '—'}</div>
                                        {row.user_name && (
                                            <div className="text-xs text-muted-foreground">{row.user_name}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs capitalize">{row.role || '—'}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={
                                                row.success
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-red-50 text-red-700 border-red-200'
                                            }
                                        >
                                            {row.success ? 'Success' : 'Failed'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs capitalize">{reasonLabel(row.failure_reason)}</TableCell>
                                    <TableCell className="font-mono text-xs">{row.ip_address || '—'}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground truncate max-w-[240px]" title={row.user_agent || undefined}>
                                        {row.user_agent || '—'}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export default function LoginAttemptsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading login attempts…
                </div>
            }
        >
            <LoginAttemptsPageInner />
        </Suspense>
    );
}
