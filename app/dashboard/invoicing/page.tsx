'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Eye, FileText, Loader2, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { BillingRecordViewDialog, EditBillingDialog } from '@/components/features/ledger/BillingRecordDialogs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    fmtMoney,
    type BillingRecord,
    type LedgerConsignment,
    type LedgerParty,
} from '@/lib/ledgerUi';

type BillListRow = BillingRecord & {
    party_id: string;
    party_name: string;
    party_code: string;
    branch_code?: string;
};

type ListSummary = {
    count: number;
    active_count: number;
    total_amount: number;
};

const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
};

export default function BillEntryPage() {
    const [bills, setBills] = useState<BillListRow[]>([]);
    const [summary, setSummary] = useState<ListSummary>({ count: 0, active_count: 0, total_amount: 0 });
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);

    const [viewing, setViewing] = useState<BillListRow | null>(null);
    const [editing, setEditing] = useState<BillListRow | null>(null);
    const [editConsignments, setEditConsignments] = useState<LedgerConsignment[]>([]);
    const [editParty, setEditParty] = useState<LedgerParty | null>(null);
    const [editLoading, setEditLoading] = useState(false);

    const loadBills = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '300' });
            if (search.trim()) params.set('search', search.trim());
            if (status !== 'ALL') params.set('status', status);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            const res = await fetch(`/api/ledger/bills?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to load bills');
            const json = await res.json();
            setBills(Array.isArray(json.data) ? json.data : []);
            setSummary(json.summary || { count: 0, active_count: 0, total_amount: 0 });
        } catch (err) {
            console.error(err);
            toast.error('Failed to load bills list');
        } finally {
            setLoading(false);
        }
    }, [search, status, dateFrom, dateTo]);

    useEffect(() => {
        void loadBills();
    }, [loadBills]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((r) => r.json())
            .then((r) => setIsAdmin(r?.data?.role === 'admin'))
            .catch(console.error);
    }, []);

    const openView = async (bill: BillListRow) => {
        setViewing(bill);
        setEditing(null);
        setEditLoading(true);
        try {
            const res = await fetch(`/api/ledger/${bill.party_id}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load party ledger');
            setEditParty(json.party || null);
            setEditConsignments(json.all_consignments || json.consignments || []);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to load bill details');
            setEditConsignments([]);
            setEditParty(null);
        } finally {
            setEditLoading(false);
        }
    };

    const openEdit = async (bill: BillListRow) => {
        if (bill.status !== 'ACTIVE') {
            toast.error('Only active bills can be edited');
            return;
        }
        setEditing(bill);
        setViewing(null);
        setEditLoading(true);
        try {
            const res = await fetch(`/api/ledger/${bill.party_id}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load party ledger');
            setEditParty(json.party || null);
            const allBilling: BillingRecord[] = json.all_billing_records || [];
            const editingId = bill.id;
            const otherBilled = new Set<string>();
            allBilling.forEach((record) => {
                if (record.status !== 'ACTIVE' || record.id === editingId) return;
                (record.covered_cn_nos || []).forEach((cn) => {
                    const n = String(cn || '').trim().toUpperCase();
                    if (n) otherBilled.add(n);
                });
            });
            const allCns: LedgerConsignment[] = json.all_consignments || json.consignments || [];
            setEditConsignments(
                allCns.filter((cn) => !otherBilled.has(String(cn.cn_no || '').trim().toUpperCase())),
            );
            const fresh = allBilling.find((b) => b.id === bill.id);
            if (fresh) {
                setEditing({
                    ...bill,
                    ...fresh,
                    party_id: bill.party_id,
                    party_name: bill.party_name,
                    party_code: bill.party_code,
                });
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to open edit');
            setEditing(null);
        } finally {
            setEditLoading(false);
        }
    };

    const clearFilters = () => {
        setSearch('');
        setStatus('ALL');
        setDateFrom('');
        setDateTo('');
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" /> Bill Entry
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Search and filter all freight bills. Create a new bill or edit an existing one.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/ledger">Party Ledger</Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/dashboard/invoicing/new">
                            <Plus className="h-4 w-4 mr-1" /> Create Bill
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Bills Shown</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold font-mono">{summary.count}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Active Bills</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold font-mono">{summary.active_count}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total Bill Amount</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold font-mono text-primary">
                        ₹{fmtMoney(summary.total_amount)}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Filters</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-5">
                    <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs uppercase text-muted-foreground">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="h-9 pl-8"
                                placeholder="Bill no / party / CN…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase text-muted-foreground">Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase text-muted-foreground">From</Label>
                        <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase text-muted-foreground">To</Label>
                        <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <div className="md:col-span-5 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => void loadBills()} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                            Refresh
                        </Button>
                        <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">All Bills</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[1100px] table-fixed">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[160px]">Bill No</TableHead>
                                    <TableHead className="w-[100px]">Date</TableHead>
                                    <TableHead className="w-[200px]">Party</TableHead>
                                    <TableHead className="w-[280px]">Covered CNs</TableHead>
                                    <TableHead className="w-[120px] text-right">Amount</TableHead>
                                    <TableHead className="w-[100px]">Status</TableHead>
                                    <TableHead className="w-[220px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && bills.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                            Loading bills…
                                        </TableCell>
                                    </TableRow>
                                ) : bills.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                            No bills found. Create a bill to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : bills.map((bill) => {
                                    const covered = bill.covered_cn_nos || [];
                                    const coveredLabel = covered.join(', ') || '—';
                                    return (
                                    <TableRow key={bill.id}>
                                        <TableCell className="font-mono font-semibold text-primary whitespace-nowrap">
                                            {bill.bill_ref_no || bill.id.slice(0, 8).toUpperCase()}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">{fmtDate(bill.billing_date)}</TableCell>
                                        <TableCell className="min-w-0 whitespace-normal overflow-hidden">
                                            <div className="font-medium truncate" title={bill.party_name}>{bill.party_name}</div>
                                            <div className="text-xs text-muted-foreground truncate">{bill.party_code}</div>
                                        </TableCell>
                                        <TableCell className="min-w-0 whitespace-normal overflow-hidden">
                                            <div className="flex items-start gap-2 min-w-0">
                                                {covered.length > 0 && (
                                                    <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                                                        {covered.length}
                                                    </Badge>
                                                )}
                                                <div
                                                    className="text-xs font-mono text-muted-foreground line-clamp-2 break-all"
                                                    title={coveredLabel}
                                                >
                                                    {coveredLabel}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold whitespace-nowrap">
                                            ₹{fmtMoney(bill.amount)}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            <Badge variant={bill.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                {bill.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => void openView(bill)}>
                                                    <Eye className="h-3.5 w-3.5 mr-1" /> View
                                                </Button>
                                                {bill.status === 'ACTIVE' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={editLoading}
                                                        onClick={() => void openEdit(bill)}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/dashboard/ledger/${bill.party_id}`}>Ledger</Link>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <BillingRecordViewDialog
                open={!!viewing}
                onClose={() => setViewing(null)}
                party={editParty}
                record={viewing}
                consignments={editConsignments}
                isAdmin={isAdmin}
                onEdit={() => {
                    if (!viewing) return;
                    void openEdit(viewing);
                }}
            />

            <EditBillingDialog
                open={!!editing}
                onClose={() => setEditing(null)}
                partyId={editing?.party_id || ''}
                record={editing}
                consignments={editConsignments}
                onSuccess={() => {
                    setEditing(null);
                    void loadBills();
                }}
            />
        </div>
    );
}
