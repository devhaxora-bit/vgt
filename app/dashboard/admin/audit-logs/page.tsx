'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { History, Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
    LEDGER_AUDIT_ACTIONS,
    LEDGER_AUDIT_ENTITY_TYPES,
    type LedgerAuditAction,
    type LedgerAuditEntityType,
    type LedgerAuditLog,
} from '@/lib/types/ledgerAudit.types';

const ENTITY_LABELS: Record<LedgerAuditEntityType, string> = {
    bill: 'Bill',
    payment: 'Payment',
    consignment: 'Consignment',
    challan: 'Challan',
    challan_bill: 'Challan bill',
    challan_payment: 'Challan payment',
};

const ACTION_LABELS: Record<LedgerAuditAction, string> = {
    insert: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    reassign: 'Reassigned',
    cancel: 'Cancelled',
    reverse: 'Reversed',
};

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

const formatJsonValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value || '—';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const actionBadgeClass = (action: LedgerAuditAction): string => {
    if (action === 'reassign') return 'bg-amber-50 text-amber-800 border-amber-200';
    if (action === 'cancel' || action === 'reverse' || action === 'delete') {
        return 'bg-red-50 text-red-700 border-red-200';
    }
    if (action === 'insert') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
};

function AuditLogsPageInner() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [logs, setLogs] = useState<LedgerAuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selected, setSelected] = useState<LedgerAuditLog | null>(null);
    const [related, setRelated] = useState<LedgerAuditLog[]>([]);
    const [relatedLoading, setRelatedLoading] = useState(false);

    const entityType = searchParams.get('entity_type') || 'all';
    const action = searchParams.get('action') || 'all';
    const q = searchParams.get('q') || '';
    const entityId = searchParams.get('entity_id') || '';
    const txid = searchParams.get('txid') || '';
    const partyId = searchParams.get('party_id') || '';
    const limit = searchParams.get('limit') || '50';

    const [searchDraft, setSearchDraft] = useState(q);

    useEffect(() => {
        setSearchDraft(q);
    }, [q]);

    const replaceParams = useCallback(
        (updates: Record<string, string | null>) => {
            const next = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(updates)) {
                if (!value || value === 'all') next.delete(key);
                else next.set(key, value);
            }
            const qs = next.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname);
        },
        [pathname, router, searchParams],
    );

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (entityType !== 'all') params.set('entity_type', entityType);
            if (action !== 'all') params.set('action', action);
            if (q.trim()) params.set('q', q.trim());
            if (entityId) params.set('entity_id', entityId);
            if (txid) params.set('txid', txid);
            if (partyId) params.set('party_id', partyId);
            params.set('limit', limit);

            const res = await fetch(`/api/ledger/audit-logs?${params.toString()}`);
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json.error || 'Failed to load audit logs');
            }
            setLogs(Array.isArray(json.data) ? json.data : []);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to load audit logs');
            setLogs([]);
        } finally {
            setIsLoading(false);
        }
    }, [action, entityId, entityType, limit, partyId, q, txid]);

    useEffect(() => {
        void fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        if (!selected) {
            setRelated([]);
            return;
        }

        let cancelled = false;
        setRelatedLoading(true);
        fetch(`/api/ledger/audit-logs?txid=${selected.txid}&limit=200`)
            .then(async (res) => {
                const json = await res.json();
                if (!res.ok || json.success === false) {
                    throw new Error(json.error || 'Failed to load related events');
                }
                if (!cancelled) {
                    setRelated(Array.isArray(json.data) ? json.data : []);
                }
            })
            .catch(() => {
                if (!cancelled) setRelated([]);
            })
            .finally(() => {
                if (!cancelled) setRelatedLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selected]);

    const changedDiff = useMemo(() => {
        if (!selected) return [];
        const fields = selected.changed_fields.length
            ? selected.changed_fields
            : Object.keys({ ...(selected.old_data || {}), ...(selected.new_data || {}) });
        return fields.map((field) => ({
            field,
            oldValue: selected.old_data ? selected.old_data[field] : undefined,
            newValue: selected.new_data ? selected.new_data[field] : undefined,
        }));
    }, [selected]);

    const partyMove =
        selected &&
        selected.old_party_id &&
        selected.new_party_id &&
        selected.old_party_id !== selected.new_party_id
            ? `${selected.old_party_name || selected.old_party_id} → ${selected.new_party_name || selected.new_party_id}`
            : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#101828]">Audit Logs</h2>
                    <p className="text-sm text-muted-foreground">
                        Who changed bills, payments, consignments, and challans — including party reassignments grouped by transaction.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void fetchLogs()} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2 space-y-1.5">
                    <Label htmlFor="audit-search">Reference</Label>
                    <form
                        className="flex gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            replaceParams({ q: searchDraft.trim() || null });
                        }}
                    >
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="audit-search"
                                className="pl-8"
                                placeholder="Bill no, CN no, challan, payment ref"
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
                    <Label>Record type</Label>
                    <Select value={entityType} onValueChange={(value) => replaceParams({ entity_type: value })}>
                        <SelectTrigger>
                            <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All types</SelectItem>
                            {LEDGER_AUDIT_ENTITY_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {ENTITY_LABELS[type]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Action</Label>
                    <Select value={action} onValueChange={(value) => replaceParams({ action: value })}>
                        <SelectTrigger>
                            <SelectValue placeholder="All actions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All actions</SelectItem>
                            {LEDGER_AUDIT_ACTIONS.map((item) => (
                                <SelectItem key={item} value={item}>
                                    {ACTION_LABELS[item]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Limit</Label>
                    <Select value={limit} onValueChange={(value) => replaceParams({ limit: value })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                            <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {(entityId || txid || partyId) && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {entityId && (
                        <Badge variant="outline">Record {entityId.slice(0, 8)}…</Badge>
                    )}
                    {txid && <Badge variant="outline">Transaction {txid}</Badge>}
                    {partyId && <Badge variant="outline">Party filter</Badge>}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => replaceParams({ entity_id: null, txid: null, party_id: null })}
                    >
                        Clear record filters
                    </Button>
                </div>
            )}

            <div className="rounded-lg border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/40">
                            <TableHead className="w-[170px]">When</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Changed</TableHead>
                            <TableHead>Who</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                    Loading logs…
                                </TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No audit events match these filters. Apply the database migration first if this is a new environment.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow
                                    key={log.id}
                                    className="cursor-pointer"
                                    onClick={() => setSelected(log)}
                                >
                                    <TableCell className="text-xs whitespace-nowrap">{formatWhen(log.occurred_at)}</TableCell>
                                    <TableCell className="text-xs">{ENTITY_LABELS[log.entity_type]}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={actionBadgeClass(log.action)}>
                                            {ACTION_LABELS[log.action]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{log.entity_ref || '—'}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                                        {log.changed_fields.slice(0, 4).join(', ') || '—'}
                                        {log.changed_fields.length > 4 ? ` +${log.changed_fields.length - 4}` : ''}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {log.actor_name || 'System'}
                                        {log.actor_code ? (
                                            <span className="block text-[11px] text-muted-foreground font-mono">
                                                {log.actor_code}
                                            </span>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
                <DialogContent className="max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            {selected ? ACTION_LABELS[selected.action] : 'Event'}{' '}
                            {selected ? ENTITY_LABELS[selected.entity_type] : ''}
                        </DialogTitle>
                        <DialogDescription>
                            {selected?.entity_ref} · {selected ? formatWhen(selected.occurred_at) : ''}
                        </DialogDescription>
                    </DialogHeader>

                    {selected && (
                        <ScrollArea className="max-h-[70vh] pr-3">
                            <div className="space-y-4 text-sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Who</p>
                                        <p>
                                            {selected.actor_name || 'System'}
                                            {selected.actor_code ? ` (${selected.actor_code})` : ''}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Transaction</p>
                                        <p className="font-mono text-xs">{selected.txid}</p>
                                    </div>
                                    {partyMove && (
                                        <div className="sm:col-span-2">
                                            <p className="text-xs text-muted-foreground">Party</p>
                                            <p>{partyMove}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Field</TableHead>
                                                <TableHead>Before</TableHead>
                                                <TableHead>After</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {changedDiff.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-muted-foreground">
                                                        No field-level changes recorded.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                changedDiff.map((row) => (
                                                    <TableRow key={row.field}>
                                                        <TableCell className="font-mono text-xs align-top">{row.field}</TableCell>
                                                        <TableCell className="text-xs whitespace-pre-wrap align-top text-red-800">
                                                            {formatJsonValue(row.oldValue)}
                                                        </TableCell>
                                                        <TableCell className="text-xs whitespace-pre-wrap align-top text-emerald-800">
                                                            {formatJsonValue(row.newValue)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div>
                                    <p className="text-xs font-medium mb-2">Same database transaction</p>
                                    {relatedLoading ? (
                                        <p className="text-muted-foreground text-xs">Loading related events…</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {related.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    className={`w-full text-left rounded-md border px-3 py-2 text-xs ${
                                                        item.id === selected.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                                                    }`}
                                                    onClick={() => setSelected(item)}
                                                >
                                                    <span className="font-medium">{ACTION_LABELS[item.action]} {ENTITY_LABELS[item.entity_type]}</span>
                                                    <span className="ml-2 font-mono">{item.entity_ref}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function AuditLogsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading audit logs…
                </div>
            }
        >
            <AuditLogsPageInner />
        </Suspense>
    );
}
