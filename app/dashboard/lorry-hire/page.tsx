'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChallanDetailsDialog } from '@/components/features/challans/ChallanDetailsDialog';
import { ChallanLinkedCnsCell, type LinkedCnPreview } from '@/components/features/challans/ChallanLinkedCnsCell';
import { ConsignmentDetailsDialog } from '@/components/features/consignments/ConsignmentDetailsDialog';
import { LorryHirePaymentForm } from '@/components/features/lorry-hire/LorryHirePaymentForm';
import { QueryRefLink } from '@/components/features/query/QueryDocDialogs';
import type { LorryHireChallan, LorryHireData } from '@/lib/types/lorryHire.types';

const fmtDate = (value?: string | null) => {
    if (!value) return '—';
    const day = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return value;
    const [year, month, date] = day.split('-');
    return `${date}/${month}/${year}`;
};

const money = (v: number) => Number(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

export default function LorryHirePage() {
    const [data, setData] = useState<LorryHireData>({ challans: [], payments: [], can_pay: false });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [viewingChallan, setViewingChallan] = useState<Record<string, unknown> | null>(null);
    const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);
    const [openingChallanId, setOpeningChallanId] = useState<string | null>(null);
    const [viewingCn, setViewingCn] = useState<LinkedCnPreview | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [payTab, setPayTab] = useState<'advance' | 'balance' | 'payments'>('balance');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/lorry-hire', { cache: 'no-store' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not load CBS');
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load CBS');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        void fetch('/api/auth/me')
            .then((res) => res.ok ? res.json() : null)
            .then((json) => {
                const role = String(json?.data?.role || json?.user?.role || '').toLowerCase();
                setIsAdmin(role === 'admin');
            })
            .catch(() => undefined);
    }, []);

    const selected = data.challans.find((ch) => ch.id === selectedId);
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return data.challans;
        return data.challans.filter((ch) =>
            `${ch.challan_no} ${ch.vehicle_no} ${ch.owner_name || ''} ${ch.broker_name || ''} ${ch.origin_branch_code} ${(ch.linked_cn_nos || []).join(' ')}`
                .toLowerCase()
                .includes(query),
        );
    }, [data.challans, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    const page = Math.min(currentPage, totalPages);
    const paged = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
    const history = data.payments.filter((p) => p.challan_id === selectedId);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, rowsPerPage]);

    const pageNumbers = useMemo(() => {
        const pages: number[] = [];
        const maxVisible = 5;
        let start = Math.max(1, page - Math.floor(maxVisible / 2));
        const end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    }, [page, totalPages]);

    const selectChallan = (challan: LorryHireChallan, tab: 'advance' | 'balance' | 'payments') => {
        setSelectedId(challan.id);
        setPayTab(tab);
        setIsPaymentDialogOpen(true);
    };

    const openChallanDetails = async (challan: LorryHireChallan) => {
        setOpeningChallanId(challan.id);
        try {
            const response = await fetch(`/api/challans/${challan.id}`);
            if (!response.ok) throw new Error('Could not open challan');
            const payload = await response.json();
            setViewingChallan(payload && typeof payload === 'object' ? payload : challan);
            setIsChallanModalOpen(true);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not open challan');
        } finally {
            setOpeningChallanId(null);
        }
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            {error && <p role="alert" className="rounded-md border border-destructive p-3 text-destructive">{error}</p>}
            <Input
                aria-label="Search challans or lorries"
                placeholder="Search challan, lorry, owner, broker, CN or branch…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Challan</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Lorry</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Linked CNs</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Hire</TableHead>
                            <TableHead>Advance</TableHead>
                            <TableHead>TDS</TableHead>
                            <TableHead>Payments recorded</TableHead>
                            <TableHead>Balance left</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={12}>Loading challans…</TableCell></TableRow>
                        ) : paged.length === 0 ? (
                            <TableRow><TableCell colSpan={12}>No matching active challans.</TableCell></TableRow>
                        ) : paged.map((ch) => (
                            <TableRow
                                key={ch.id}
                                data-state={selectedId === ch.id ? 'selected' : undefined}
                            >
                                <TableCell className="font-medium">
                                    <QueryRefLink
                                        title="View challan"
                                        loading={openingChallanId === ch.id}
                                        onClick={() => void openChallanDetails(ch)}
                                    >
                                        {ch.challan_no}
                                    </QueryRefLink>
                                </TableCell>
                                <TableCell>{fmtDate(ch.date_from)}</TableCell>
                                <TableCell>{ch.vehicle_no}</TableCell>
                                <TableCell>{ch.broker_name || ch.owner_name || '—'}</TableCell>
                                <TableCell onClick={(event) => event.stopPropagation()}>
                                    <ChallanLinkedCnsCell
                                        linkedCnNos={ch.linked_cn_nos}
                                        onOpenCn={setViewingCn}
                                    />
                                </TableCell>
                                <TableCell>{ch.origin_branch_code}</TableCell>
                                <TableCell>{money(Number(ch.total_hire_amount) + Number(ch.extra_hire_amount))}</TableCell>
                                <TableCell>{money(ch.advance_amount)}</TableCell>
                                <TableCell>{money(ch.less_tds)}</TableCell>
                                <TableCell>{money(ch.paid_amount)}</TableCell>
                                <TableCell className="font-semibold">{money(ch.remaining)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-3">
                                        <button
                                            type="button"
                                            className="text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                                            disabled={!data.can_pay || ch.remaining === 0}
                                            onClick={() => selectChallan(ch, 'advance')}
                                        >
                                            Add Advance
                                        </button>
                                        <button
                                            type="button"
                                            className="text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground"
                                            disabled={!data.can_pay}
                                            onClick={() => selectChallan(ch, 'balance')}
                                        >
                                            Add Balance
                                        </button>
                                        <button type="button" className="text-xs text-primary hover:underline" onClick={() => selectChallan(ch, 'payments')}>
                                            Payments
                                        </button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/5 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                            Showing <strong>{filtered.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}</strong>
                            {' '}–{' '}
                            <strong>{Math.min(page * rowsPerPage, filtered.length)}</strong>
                            {' '}of <strong>{filtered.length}</strong> challans
                        </span>
                        <div className="flex items-center gap-2">
                            <span>Show</span>
                            <Select value={String(rowsPerPage)} onValueChange={(val) => setRowsPerPage(Number(val))}>
                                <SelectTrigger className="h-7 w-16 bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                            <span>rows</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                            Previous
                        </Button>
                        {pageNumbers.map((pageNo) => (
                            <Button
                                key={pageNo}
                                variant="outline"
                                size="sm"
                                className={pageNo === page ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : ''}
                                onClick={() => setCurrentPage(pageNo)}
                            >
                                {pageNo}
                            </Button>
                        ))}
                        <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                            Next
                        </Button>
                    </div>
                </div>
            </div>
            {selected && (
                <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
                        <DialogHeader className="shrink-0 border-b px-5 py-5 pr-12 text-left sm:px-6">
                            <DialogTitle>{payTab === 'advance' ? 'Add advance' : payTab === 'balance' ? 'Add balance payment' : 'Payment history'} · {selected.challan_no}</DialogTitle>
                            <DialogDescription>{selected.vehicle_no} · {fmtDate(selected.date_from)} · {selected.broker_name || selected.owner_name || '—'} · {selected.origin_branch_code}</DialogDescription>
                        </DialogHeader>
                        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm font-medium">Challan payment details</p>
                                <Button type="button" variant="outline" size="sm" disabled={openingChallanId === selected.id} onClick={() => void openChallanDetails(selected)}>
                                    {openingChallanId === selected.id ? 'Opening…' : 'View full challan'}
                                </Button>
                            </div>
                            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-y py-4 sm:grid-cols-5">
                                {[
                                    ['Hire', Number(selected.total_hire_amount) + Number(selected.extra_hire_amount)],
                                    ['Advance', selected.advance_amount],
                                    ['TDS', selected.less_tds],
                                    ['Payments recorded', selected.paid_amount],
                                    ['Balance left', selected.remaining],
                                ].map(([label, value]) => <div key={String(label)}>
                                    <dt className="text-xs text-muted-foreground">{label}</dt>
                                    <dd className={`mt-1 text-sm font-semibold tabular-nums ${label === 'Balance left' ? 'text-primary' : ''}`}>{money(Number(value))}</dd>
                                </div>)}
                            </dl>
                            {selected.remaining === 0 && <Badge>Original hire balance cleared · additional payments allowed</Badge>}
                            <Tabs value={payTab} onValueChange={(value) => setPayTab(value as typeof payTab)}>
                                <TabsList className="h-auto w-full flex-wrap justify-start">
                                    <TabsTrigger value="advance" disabled={selected.remaining === 0}>Advance payment</TabsTrigger>
                                    <TabsTrigger value="balance">Balance payment</TabsTrigger>
                                    <TabsTrigger value="payments">Payments ({history.length})</TabsTrigger>
                                </TabsList>
                                <TabsContent value="advance" className="mt-4">
                                    {data.can_pay ? (
                                        <LorryHirePaymentForm key={`${selected.id}-advance`} challan={selected} paymentType="ADVANCE" onCancel={() => setIsPaymentDialogOpen(false)} onSaved={async () => { toast.success('Advance recorded'); setIsPaymentDialogOpen(false); await load(); }} />
                                    ) : (
                                        <p className="text-sm text-muted-foreground">An administrator can record advance payments.</p>
                                    )}
                                </TabsContent>
                                <TabsContent value="balance" className="mt-4">
                                    {data.can_pay ? (
                                        <LorryHirePaymentForm key={`${selected.id}-balance`} challan={selected} paymentType="BALANCE" onCancel={() => setIsPaymentDialogOpen(false)} onSaved={async () => { toast.success('Balance payment recorded'); setIsPaymentDialogOpen(false); await load(); }} />
                                    ) : (
                                        <p className="text-sm text-muted-foreground">An administrator can record balance payments.</p>
                                    )}
                                </TabsContent>
                                <TabsContent value="payments" className="mt-4">
                                    {history.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No CBS payments recorded for this challan.</p>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date / type</TableHead>
                                                    <TableHead>Paid to / mode</TableHead>
                                                    <TableHead>Amount applied</TableHead>
                                                    <TableHead>Adjustments</TableHead>
                                                    <TableHead>Final paid</TableHead>
                                                    <TableHead>Details</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {history.map((p) => (
                                                    <TableRow key={p.id}>
                                                        <TableCell>
                                                            {p.payment_date}
                                                            <div>
                                                                {p.payment_type}
                                                                {!p.active && <Badge variant="destructive" className="ml-2">Reversed</Badge>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {p.paid_to}
                                                            <div className="text-xs text-muted-foreground">{p.payment_mode} · {p.bank_name} · {p.reference_no}</div>
                                                        </TableCell>
                                                        <TableCell>{money(p.amount)}</TableCell>
                                                        <TableCell>
                                                            {p.addition_items.map((a, i) => <div key={`a${i}`}>+ {a.label}: {money(a.amount)}</div>)}
                                                            {p.deduction_items.map((a, i) => <div key={`d${i}`}>− {a.label}: {money(a.amount)}</div>)}
                                                        </TableCell>
                                                        <TableCell>{money(p.net_paid_amount)}</TableCell>
                                                        <TableCell className="max-w-xs whitespace-normal">{p.narration}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            <ChallanDetailsDialog
                isOpen={isChallanModalOpen}
                onClose={() => {
                    setIsChallanModalOpen(false);
                    setViewingChallan(null);
                }}
                challan={viewingChallan}
            />
            <ConsignmentDetailsDialog
                isOpen={!!viewingCn}
                onClose={() => setViewingCn(null)}
                consignment={viewingCn}
                isAdmin={isAdmin}
            />
        </div>
    );
}
