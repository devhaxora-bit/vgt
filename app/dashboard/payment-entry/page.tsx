'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Banknote, Loader2, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { AddPaymentDialog } from '@/components/features/ledger/AddPaymentDialog';
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
    type PaymentReceipt,
} from '@/lib/ledgerUi';

type PaymentListRow = PaymentReceipt & {
    party_id: string;
    party_name: string;
    party_code: string;
    branch_code?: string;
};

type ListSummary = {
    count: number;
    active_count: number;
    total_settled: number;
    total_received: number;
};

const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
};

export default function PaymentEntryPage() {
    const [payments, setPayments] = useState<PaymentListRow[]>([]);
    const [summary, setSummary] = useState<ListSummary>({
        count: 0, active_count: 0, total_settled: 0, total_received: 0,
    });
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [editing, setEditing] = useState<PaymentListRow | null>(null);
    const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
    const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceipt[]>([]);
    const [editLoading, setEditLoading] = useState(false);

    const loadPayments = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '300' });
            if (search.trim()) params.set('search', search.trim());
            if (status !== 'ALL') params.set('status', status);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            const res = await fetch(`/api/ledger/payments?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to load payments');
            const json = await res.json();
            setPayments(Array.isArray(json.data) ? json.data : []);
            setSummary(json.summary || { count: 0, active_count: 0, total_settled: 0, total_received: 0 });
        } catch (err) {
            console.error(err);
            toast.error('Failed to load payments list');
        } finally {
            setLoading(false);
        }
    }, [search, status, dateFrom, dateTo]);

    useEffect(() => {
        void loadPayments();
    }, [loadPayments]);

    const openEdit = async (payment: PaymentListRow) => {
        if (payment.status !== 'ACTIVE') {
            toast.error('Only active payments can be edited');
            return;
        }
        setEditLoading(true);
        try {
            const res = await fetch(`/api/ledger/${payment.party_id}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load party ledger');
            const allPayments: PaymentReceipt[] = json.all_payment_receipts || json.payment_receipts || [];
            const fresh = allPayments.find((p) => p.id === payment.id) || payment;
            setBillingRecords(json.all_billing_records || json.billing_records || []);
            setPaymentReceipts(allPayments);
            setEditing({
                ...payment,
                ...fresh,
                party_id: payment.party_id,
                party_name: payment.party_name,
                party_code: payment.party_code,
            });
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
                        <Banknote className="h-6 w-6 text-primary" /> Payment Entry
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Search and filter all receipts. Create a new payment or edit an existing one.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/ledger">Party Ledger</Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/dashboard/payment-entry/new">
                            <Plus className="h-4 w-4 mr-1" /> Create Payment
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Payments Shown</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold font-mono">{summary.count}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Active Settled</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold font-mono">
                        ₹{fmtMoney(summary.total_settled)}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Active Received</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold font-mono text-primary">
                        ₹{fmtMoney(summary.total_received)}
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
                                placeholder="Party / UTR / mode…"
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
                        <Button variant="outline" size="sm" onClick={() => void loadPayments()} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                            Refresh
                        </Button>
                        <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">All Payments</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Party</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead className="text-right">Settled</TableHead>
                                    <TableHead className="text-right">Received</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && payments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                                            Loading payments…
                                        </TableCell>
                                    </TableRow>
                                ) : payments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                                            No payments found. Create a payment to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : payments.map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell>{fmtDate(payment.receipt_date)}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{payment.party_name}</div>
                                            <div className="text-xs text-muted-foreground">{payment.party_code}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{payment.payment_mode}</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {payment.reference_no || '—'}
                                            {payment.bank_name ? (
                                                <div className="text-muted-foreground">{payment.bank_name}</div>
                                            ) : null}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">
                                            ₹{fmtMoney(payment.amount)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            ₹{fmtMoney(payment.actual_received_amount ?? payment.amount)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={payment.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                {payment.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {payment.status === 'ACTIVE' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={editLoading}
                                                        onClick={() => void openEdit(payment)}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/dashboard/ledger/${payment.party_id}`}>Ledger</Link>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AddPaymentDialog
                open={!!editing}
                onClose={() => setEditing(null)}
                partyId={editing?.party_id || ''}
                partyLabel={editing ? `${editing.party_name}${editing.party_code ? ` (${editing.party_code})` : ''}` : undefined}
                billingRecords={billingRecords}
                paymentReceipts={paymentReceipts}
                record={editing}
                onSuccess={() => {
                    setEditing(null);
                    void loadPayments();
                }}
            />
        </div>
    );
}
