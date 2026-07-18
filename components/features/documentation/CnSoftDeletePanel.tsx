'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Trash2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

type CnRow = {
    id: string;
    cn_no: string;
    bkg_date: string | null;
    booking_branch: string | null;
    dest_branch: string | null;
    delivery_point: string | null;
    consignor_name: string | null;
    consignee_name: string | null;
    total_freight: number | null;
    vehicle_no: string | null;
    cancel_cn: boolean | null;
    deleted_at: string | null;
    delete_reason: string | null;
};

const fmtMoney = (n: number | null | undefined) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n || 0));

const fmtDate = (value: string | null) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function CnSoftDeletePanel({ branchCode }: { branchCode: string }) {
    const [view, setView] = useState<'live' | 'deleted'>('live');
    const [q, setQ] = useState('');
    const [items, setItems] = useState<CnRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<CnRow | null>(null);
    const [reason, setReason] = useState('');
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ view });
            if (q.trim()) params.set('q', q.trim());
            const res = await fetch(
                `/api/documentation/branches/${encodeURIComponent(branchCode)}/cn-soft-delete?${params}`,
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to search CNs');
            setItems(data.items || []);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to search CNs');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [branchCode, q, view]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleSoftDelete = async () => {
        if (!selected) return;
        if (!reason.trim()) {
            toast.error('Enter a delete reason');
            return;
        }

        setDeleting(true);
        try {
            const res = await fetch(
                `/api/documentation/branches/${encodeURIComponent(branchCode)}/cn-soft-delete`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: selected.id, reason: reason.trim() }),
                },
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Soft-delete failed');

            toast.success(`CN ${selected.cn_no} soft-deleted. Number released for reuse.`);
            if (data.warning) toast.warning(data.warning);
            setSelected(null);
            setReason('');
            setView('deleted');
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Soft-delete failed');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl">
            <Card className="border-amber-200 bg-amber-50/40">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Soft-delete CNs (main / global admin)
                    </CardTitle>
                    <CardDescription>
                        Soft-deleted CNs keep their data for audit, are excluded from all counts and ledgers,
                        and free the CN number for re-issue. Blocked if the CN is on an active bill or challan.
                    </CardDescription>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="text-base">Search — {branchCode}</CardTitle>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant={view === 'live' ? 'default' : 'outline'}
                                onClick={() => setView('live')}
                            >
                                Live CNs
                            </Button>
                            <Button
                                size="sm"
                                variant={view === 'deleted' ? 'default' : 'outline'}
                                onClick={() => setView('deleted')}
                            >
                                Deleted history
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-8"
                                placeholder="Search CN no, consignor, consignee, vehicle…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void load();
                                }}
                            />
                        </div>
                        <Button onClick={() => void load()} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                        </Button>
                    </div>

                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>CN No</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Consignor</TableHead>
                                    <TableHead>Destination</TableHead>
                                    <TableHead className="text-right">Freight</TableHead>
                                    <TableHead>{view === 'deleted' ? 'Deleted' : 'Action'}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                            Loading…
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No CNs found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-mono font-semibold">{row.cn_no}</TableCell>
                                            <TableCell>{fmtDate(row.bkg_date)}</TableCell>
                                            <TableCell className="max-w-[160px] truncate">
                                                {row.consignor_name || '—'}
                                            </TableCell>
                                            <TableCell className="max-w-[120px] truncate">
                                                {row.delivery_point || row.dest_branch || '—'}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                ₹{fmtMoney(row.total_freight)}
                                            </TableCell>
                                            <TableCell>
                                                {view === 'deleted' ? (
                                                    <div className="space-y-1">
                                                        <div className="text-xs">{fmtDate(row.deleted_at)}</div>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            Soft-deleted
                                                        </Badge>
                                                        {row.delete_reason && (
                                                            <div className="text-[11px] text-muted-foreground max-w-[180px] truncate" title={row.delete_reason}>
                                                                {row.delete_reason}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-destructive hover:bg-destructive/10"
                                                        onClick={() => {
                                                            setSelected(row);
                                                            setReason('');
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                                        Soft-delete
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {selected && view === 'live' && (
                <Card className="border-destructive/30">
                    <CardHeader>
                        <CardTitle className="text-base text-destructive">
                            Soft-delete CN {selected.cn_no}
                        </CardTitle>
                        <CardDescription>
                            Data is kept for audit but excluded from counts. The CN number will be released
                            for re-issue on this branch.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-muted-foreground">Consignor:</span>{' '}
                                {selected.consignor_name || '—'}
                            </div>
                            <div>
                                <span className="text-muted-foreground">Consignee:</span>{' '}
                                {selected.consignee_name || '—'}
                            </div>
                            <div>
                                <span className="text-muted-foreground">Freight:</span> ₹
                                {fmtMoney(selected.total_freight)}
                            </div>
                            <div>
                                <span className="text-muted-foreground">Date:</span> {fmtDate(selected.bkg_date)}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="delete-reason">Reason (required)</Label>
                            <textarea
                                id="delete-reason"
                                value={reason}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                                placeholder="Why is this CN being soft-deleted?"
                                rows={3}
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setSelected(null)} disabled={deleting}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={() => void handleSoftDelete()} disabled={deleting}>
                                {deleting ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                Confirm soft-delete
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
