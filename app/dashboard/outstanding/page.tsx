'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Download,
    FileText,
    Loader2,
    Printer,
    RotateCcw,
    Search,
    X,
} from 'lucide-react';
import { useCurrentUserScope, defaultBranchFilterValue } from '@/lib/hooks/useCurrentUserScope';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

import { downloadOutstandingPdf } from '@/lib/outstandingPdf';
import type { OutstandingPartyRow, OutstandingBill } from '@/app/api/outstanding/route';

type PayStatusFilter = 'all' | 'unpaid' | 'due' | 'partial' | 'paid';

const PAY_STATUS_LABELS: Record<PayStatusFilter, string> = {
    all: 'All',
    unpaid: 'Unpaid',
    due: 'To be paid',
    partial: 'Partial',
    paid: 'Paid',
};

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const roundMoney = (value: number) => Number(value.toFixed(2));

const fmtDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

const fmtDateInput = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

const billMatchesStatus = (bill: OutstandingBill, status: PayStatusFilter) => {
    if (status === 'all') return true;
    if (status === 'unpaid') return bill.pay_status === 'due' || bill.pay_status === 'partial';
    return bill.pay_status === status;
};

const filterPartyByStatus = (
    party: OutstandingPartyRow,
    status: PayStatusFilter,
): OutstandingPartyRow | null => {
    const bills = party.bills.filter((bill) => billMatchesStatus(bill, status));
    if (bills.length === 0) return null;
    return {
        ...party,
        bills,
        total_billed: roundMoney(bills.reduce((sum, bill) => sum + bill.amount, 0)),
        total_paid: roundMoney(bills.reduce((sum, bill) => sum + bill.paid_amount, 0)),
        total_outstanding: roundMoney(bills.reduce((sum, bill) => sum + bill.outstanding, 0)),
    };
};

const payStatusBadge = (status: OutstandingBill['pay_status']) => {
    if (status === 'paid') {
        return <Badge className="h-5 px-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Paid</Badge>;
    }
    if (status === 'partial') {
        return <Badge className="h-5 px-1.5 text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-100">Partial</Badge>;
    }
    return <Badge className="h-5 px-1.5 text-[10px] font-bold bg-red-100 text-red-800 hover:bg-red-100">To be paid</Badge>;
};

export default function OutstandingPage() {
    const userScope = useCurrentUserScope();
    const [allParties, setAllParties] = useState<OutstandingPartyRow[]>([]);
    const [allPartiesLoaded, setAllPartiesLoaded] = useState(false);
    const [allPartiesLoading, setAllPartiesLoading] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const [branchFilter, setBranchFilter] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [payStatusFilter, setPayStatusFilter] = useState<PayStatusFilter>('all');
    const [expandedParties, setExpandedParties] = useState<Set<string>>(new Set());
    const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
    const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const printFrameRef = useRef<HTMLIFrameElement | null>(null);

    // Load branch list
    useEffect(() => {
        fetch('/api/references/branches')
            .then((r) => r.json())
            .then((branches: { code: string; name: string }[]) => {
                setBranchOptions(
                    branches.map((b) => ({
                        value: String(b.code || '').trim().toUpperCase(),
                        label: `${b.code} - ${b.name}`,
                    }))
                );
            })
            .catch(console.error);
    }, []);

    // Default branch from user scope
    useEffect(() => {
        if (!userScope.ready || branchFilter !== null) return;
        if (branchOptions.length === 0) return;
        setBranchFilter(defaultBranchFilterValue(userScope));
    }, [userScope.ready, userScope.branchCode, branchFilter, branchOptions.length]);

    const loadAllParties = useCallback(async () => {
        if (!branchFilter) return;
        setAllPartiesLoading(true);
        setFetchError(null);
        try {
            const params = new URLSearchParams();
            if (branchFilter !== 'all') params.set('branch', branchFilter);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);

            const res = await fetch(`/api/outstanding?${params.toString()}`);
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(
                    (errBody as { error?: string }).error
                        ?? (res.status === 401 ? 'Session expired — refresh the page or sign in again' : 'Failed to fetch outstanding data'),
                );
            }
            const json: OutstandingPartyRow[] = await res.json();
            setAllParties(json);
            setAllPartiesLoaded(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to fetch outstanding data';
            console.error(err);
            setFetchError(msg);
        } finally {
            setAllPartiesLoading(false);
        }
    }, [branchFilter, dateFrom, dateTo]);

    useEffect(() => {
        if (!branchFilter) return;
        setSelectedPartyId(null);
        setExpandedParties(new Set());
        void loadAllParties();
    }, [branchFilter, dateFrom, dateTo, loadAllParties]);

    const filteredParties = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return allParties
            .filter(
                (p) =>
                    !q ||
                    p.party_name.toLowerCase().includes(q) ||
                    (p.party_code ?? '').toLowerCase().includes(q),
            )
            .map((p) => filterPartyByStatus(p, payStatusFilter))
            .filter((p): p is OutstandingPartyRow => p !== null);
    }, [allParties, searchTerm, payStatusFilter]);

    // If status filter removes the selected party, return to the list.
    useEffect(() => {
        if (!selectedPartyId) return;
        if (!filteredParties.some((p) => p.party_id === selectedPartyId)) {
            setSelectedPartyId(null);
            setExpandedParties(new Set());
        }
    }, [filteredParties, selectedPartyId]);

    const displayedData = useMemo(() => {
        if (!selectedPartyId) return [];
        return filteredParties.filter((p) => p.party_id === selectedPartyId);
    }, [filteredParties, selectedPartyId]);

    /** PDF/Print: one selected/filtered party → statement; otherwise full list. */
    const exportRows = selectedPartyId && displayedData.length > 0 ? displayedData : filteredParties;
    const statementMode = exportRows.length === 1;
    const canExportPdf = exportRows.length > 0 && !allPartiesLoading;

    const grandTotals = useMemo(
        () =>
            displayedData.reduce(
                (acc, p) => ({
                    billed: acc.billed + p.total_billed,
                    paid: acc.paid + p.total_paid,
                    outstanding: acc.outstanding + p.total_outstanding,
                }),
                { billed: 0, paid: 0, outstanding: 0 }
            ),
        [displayedData]
    );

    const listTotals = useMemo(
        () =>
            filteredParties.reduce(
                (acc, p) => ({
                    billed: acc.billed + p.total_billed,
                    paid: acc.paid + p.total_paid,
                    outstanding: acc.outstanding + p.total_outstanding,
                    bills: acc.bills + p.bills.length,
                }),
                { billed: 0, paid: 0, outstanding: 0, bills: 0 }
            ),
        [filteredParties]
    );

    const toggleParty = (partyId: string) => {
        setExpandedParties((prev) => {
            const next = new Set(prev);
            if (next.has(partyId)) {
                next.delete(partyId);
            } else {
                next.add(partyId);
            }
            return next;
        });
    };

    const selectParty = (partyId: string) => {
        setSelectedPartyId(partyId);
        setExpandedParties(new Set([partyId]));
    };

    const clearSelectedParty = () => {
        setSelectedPartyId(null);
        setExpandedParties(new Set());
    };

    const resetFilters = () => {
        setSearchTerm('');
        setPayStatusFilter('all');
        setBranchFilter(defaultBranchFilterValue(userScope));
        setDateFrom('');
        setDateTo('');
        setSelectedPartyId(null);
        setExpandedParties(new Set());
    };

    const branchNameByCode = useMemo(
        () =>
            new Map(
                branchOptions.map((b) => {
                    const sep = b.label.indexOf(' - ');
                    const name = sep >= 0 ? b.label.slice(sep + 3).trim() : b.label;
                    return [b.value, name];
                })
            ),
        [branchOptions]
    );

    const buildPeriodLabel = () => {
        const fmtD = (s: string) => fmtDateInput(s);
        if (dateFrom && dateTo) return `${fmtD(dateFrom)} - ${fmtD(dateTo)}`;
        if (dateFrom) return `From ${fmtD(dateFrom)}`;
        if (dateTo) return `Up to ${fmtD(dateTo)}`;
        return 'All Time';
    };

    const handleExportPdf = async () => {
        if (exportRows.length === 0) return;
        setIsPdfExporting(true);
        try {
            const now = new Date();
            const generatedAt = now.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });

            await downloadOutstandingPdf({
                rows: exportRows,
                periodLabel: buildPeriodLabel(),
                filters: {
                    branch: branchFilter && branchFilter !== 'all' ? branchFilter : undefined,
                    branchName:
                        branchFilter && branchFilter !== 'all'
                            ? branchNameByCode.get(branchFilter)
                            : undefined,
                    search: searchTerm.trim() || undefined,
                    status: PAY_STATUS_LABELS[payStatusFilter],
                },
                generatedAt,
                statementMode,
            });
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setIsPdfExporting(false);
        }
    };

    const handlePrint = async () => {
        if (exportRows.length === 0) return;
        setIsPrinting(true);
        try {
            const now = new Date();
            const generatedAt = now.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });

            const { buildOutstandingHtml, loadPdfLogoForOutstanding } = await import('@/lib/outstandingPdf');
            const logoUrl = await loadPdfLogoForOutstanding();

            const iframe = document.createElement('iframe');
            iframe.setAttribute('aria-hidden', 'true');
            iframe.style.position = 'fixed';
            iframe.style.left = '-10000px';
            iframe.style.top = '0';
            iframe.style.width = '297mm';
            iframe.style.height = '210mm';
            document.body.appendChild(iframe);
            printFrameRef.current = iframe;

            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) throw new Error('Failed to create print document');

            doc.open();
            doc.write(
                buildOutstandingHtml(
                    {
                        rows: exportRows,
                        periodLabel: buildPeriodLabel(),
                        filters: {
                            branch: branchFilter && branchFilter !== 'all' ? branchFilter : undefined,
                            branchName:
                                branchFilter && branchFilter !== 'all'
                                    ? branchNameByCode.get(branchFilter)
                                    : undefined,
                            search: searchTerm.trim() || undefined,
                            status: PAY_STATUS_LABELS[payStatusFilter],
                        },
                        generatedAt,
                        statementMode,
                    },
                    logoUrl
                )
            );
            doc.close();

            await Promise.all(
                Array.from(doc.images).map((img) => {
                    if (img.complete) return Promise.resolve();
                    return new Promise<void>((resolve) => {
                        img.onload = () => resolve();
                        img.onerror = () => resolve();
                    });
                })
            );
            await new Promise((resolve) => setTimeout(resolve, 200));

            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();

            setTimeout(() => {
                iframe.remove();
                printFrameRef.current = null;
            }, 2000);
        } catch (err) {
            console.error('Print failed:', err);
        } finally {
            setIsPrinting(false);
        }
    };

    const activeFilterCount = [
        !!branchFilter && branchFilter !== defaultBranchFilterValue(userScope),
        !!dateFrom,
        !!dateTo,
        !!searchTerm.trim(),
        payStatusFilter !== 'all',
    ].filter(Boolean).length;

    const showingPartyDetail = Boolean(selectedPartyId && displayedData.length > 0);
    const summaryStats = showingPartyDetail
        ? {
              parties: displayedData.length,
              bills: displayedData.reduce((s, p) => s + p.bills.length, 0),
              billed: grandTotals.billed,
              paid: grandTotals.paid,
              outstanding: grandTotals.outstanding,
          }
        : {
              parties: filteredParties.length,
              bills: listTotals.bills,
              billed: listTotals.billed,
              paid: listTotals.paid,
              outstanding: listTotals.outstanding,
          };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden p-2 md:p-2.5 animate-fadeIn">
            {/* Compact title + actions */}
            <div className="flex shrink-0 items-center justify-between gap-2">
                <h1 className="flex min-w-0 items-center gap-1.5 text-sm font-bold tracking-tight">
                    <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
                    Party Outstanding
                </h1>
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void loadAllParties()}
                        disabled={allPartiesLoading || !branchFilter}
                        className="h-7 gap-1 px-2 text-[11px]"
                    >
                        <RotateCcw className="h-3 w-3" /> Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        disabled={isPrinting || !canExportPdf}
                        className="h-7 gap-1 px-2 text-[11px]"
                    >
                        {isPrinting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Printer className="h-3 w-3" />
                        )}
                        Print
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleExportPdf}
                        disabled={isPdfExporting || !canExportPdf}
                        className="h-7 gap-1 px-2 text-[11px]"
                    >
                        {isPdfExporting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Download className="h-3 w-3" />
                        )}
                        {isPdfExporting
                            ? 'Exporting…'
                            : selectedPartyId
                                ? 'Export PDF'
                                : `PDF (${filteredParties.length})`}
                    </Button>
                </div>
            </div>

            {/* Filters (left) + summary cards (right) — one short row */}
            <div className="grid shrink-0 gap-1.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] lg:items-stretch">
                <Card className="border shadow-sm">
                    <CardContent className="flex h-full flex-col justify-center p-2">
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
                            <div className="col-span-2 sm:col-span-1 xl:col-span-1 flex flex-col gap-0.5 min-w-0">
                                <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                                    Branch
                                </label>
                                {userScope.isBranchScoped ? (
                                    <Input
                                        value={
                                            branchFilter && branchFilter !== 'all'
                                                ? branchNameByCode.get(branchFilter)
                                                    ? `${branchFilter} - ${branchNameByCode.get(branchFilter)}`
                                                    : branchFilter
                                                : 'All Branches'
                                        }
                                        readOnly
                                        disabled
                                        className="h-7 bg-muted/40 px-2 text-[11px]"
                                    />
                                ) : (
                                    <Select
                                        value={branchFilter ?? 'all'}
                                        onValueChange={(v) => setBranchFilter(v)}
                                    >
                                        <SelectTrigger className="h-7 w-full text-[11px]">
                                            <SelectValue placeholder="All Branches" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Branches</SelectItem>
                                            {branchOptions.map((b) => (
                                                <SelectItem key={b.value} value={b.value}>
                                                    {b.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            <div className="flex flex-col gap-0.5 min-w-0">
                                <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                                    From
                                </label>
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="h-7 px-1.5 text-[11px]"
                                />
                            </div>

                            <div className="flex flex-col gap-0.5 min-w-0">
                                <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                                    To
                                </label>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="h-7 px-1.5 text-[11px]"
                                />
                            </div>

                            <div className="flex flex-col gap-0.5 min-w-0">
                                <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                                    Status
                                </label>
                                <Select
                                    value={payStatusFilter}
                                    onValueChange={(v) => setPayStatusFilter(v as PayStatusFilter)}
                                >
                                    <SelectTrigger className="h-7 w-full text-[11px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="unpaid">Unpaid</SelectItem>
                                        <SelectItem value="due">To be paid</SelectItem>
                                        <SelectItem value="partial">Partial</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="col-span-2 sm:col-span-3 xl:col-span-2 flex flex-col gap-0.5 min-w-0">
                                <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                                    Search
                                </label>
                                <div className="relative flex gap-1">
                                    <div className="relative min-w-0 flex-1">
                                        <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Party name or code…"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="h-7 pl-7 pr-6 text-[11px]"
                                        />
                                        {searchTerm ? (
                                            <button
                                                type="button"
                                                onClick={() => setSearchTerm('')}
                                                className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        ) : null}
                                    </div>
                                    {activeFilterCount > 0 ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={resetFilters}
                                            className="h-7 shrink-0 gap-1 px-1.5 text-[11px] text-muted-foreground"
                                        >
                                            <X className="h-3 w-3" />
                                            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                                                {activeFilterCount}
                                            </Badge>
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-4 gap-1.5">
                    <Card className="shadow-sm">
                        <CardContent className="flex h-full flex-col justify-center px-2 py-1.5">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                                {showingPartyDetail ? 'Bills' : 'Parties'}
                            </p>
                            <p className="mt-0.5 text-base font-bold tabular-nums leading-tight">
                                {showingPartyDetail ? summaryStats.bills : summaryStats.parties}
                            </p>
                            {!showingPartyDetail ? (
                                <p className="text-[9px] text-muted-foreground tabular-nums leading-none">
                                    {summaryStats.bills} bills
                                </p>
                            ) : null}
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardContent className="flex h-full flex-col justify-center px-2 py-1.5">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                                Billed
                            </p>
                            <p className="mt-0.5 text-xs font-bold tabular-nums leading-tight md:text-sm">
                                ₹{fmt(summaryStats.billed)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardContent className="flex h-full flex-col justify-center px-2 py-1.5">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                                Paid
                            </p>
                            <p className="mt-0.5 text-xs font-bold tabular-nums leading-tight text-indigo-700 md:text-sm">
                                ₹{fmt(summaryStats.paid)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
                        <CardContent className="flex h-full flex-col justify-center px-2 py-1.5">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                                Outstanding
                            </p>
                            <p className="mt-0.5 text-xs font-bold tabular-nums leading-tight text-destructive md:text-sm">
                                ₹{fmt(summaryStats.outstanding)}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {showingPartyDetail ? (
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                    <div className="flex shrink-0 items-center gap-2 text-[11px]">
                        <Button variant="ghost" size="sm" onClick={clearSelectedParty} className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground">
                            <X className="h-3 w-3" /> Back
                        </Button>
                        <span className="text-muted-foreground">Showing:</span>
                        <span className="truncate font-semibold">{displayedData[0].party_name}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{displayedData[0].party_code}</Badge>
                    </div>

                    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border shadow-sm">
                        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                            <div className="min-h-0 flex-1 overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead className="font-semibold">Party / Bill No.</TableHead>
                                        <TableHead className="font-semibold">Bill Date</TableHead>
                                        <TableHead className="font-semibold">Status</TableHead>
                                        <TableHead className="font-semibold text-right">Bill Amount</TableHead>
                                        <TableHead className="font-semibold text-right">Paid</TableHead>
                                        <TableHead className="font-semibold text-right">Outstanding</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayedData.map((party) => {
                                        const isExpanded = expandedParties.has(party.party_id);
                                        return (
                                            <React.Fragment key={party.party_id}>
                                                <TableRow
                                                    className="bg-muted/60 hover:bg-muted/80 cursor-pointer select-none font-semibold border-t-2"
                                                    onClick={() => toggleParty(party.party_id)}
                                                >
                                                    <TableCell className="w-8 ">
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="">
                                                        <div className="flex w-full min-w-0 flex-nowrap items-center gap-2">
                                                            <span className="min-w-0 flex-1 truncate font-bold text-xs" title={party.party_name}>
                                                                {party.party_name}
                                                            </span>
                                                            <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[9px] font-mono">
                                                                {party.party_code}
                                                            </Badge>
                                                            {party.branch_code && (
                                                                <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[9px]">
                                                                    {party.branch_name || party.branch_code}
                                                                </Badge>
                                                            )}
                                                            <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                                                                {party.bills.length} bill{party.bills.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className=" text-muted-foreground text-[11px]">—</TableCell>
                                                    <TableCell className=" text-muted-foreground text-[11px]">—</TableCell>
                                                    <TableCell className=" text-right tabular-nums text-xs font-bold">
                                                        ₹{fmt(party.total_billed)}
                                                    </TableCell>
                                                    <TableCell className=" text-right tabular-nums text-xs text-muted-foreground">
                                                        ₹{fmt(party.total_paid)}
                                                    </TableCell>
                                                    <TableCell className=" text-right tabular-nums text-xs font-bold text-destructive">
                                                        ₹{fmt(party.total_outstanding)}
                                                    </TableCell>
                                                </TableRow>

                                                {isExpanded && (
                                                    <>
                                                        {party.bills.map((bill, idx) => (
                                                            <TableRow
                                                                key={bill.id}
                                                                className={idx % 2 === 0 ? 'bg-background' : 'bg-[var(--table-row-even)]'}
                                                            >
                                                                <TableCell className="w-8 "></TableCell>
                                                                <TableCell className=" pl-8">
                                                                    <span className="font-medium text-xs font-mono">
                                                                        {bill.bill_ref_no || '—'}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className=" text-xs text-muted-foreground">
                                                                    {fmtDate(bill.billing_date)}
                                                                </TableCell>
                                                                <TableCell className="">
                                                                    {payStatusBadge(bill.pay_status)}
                                                                </TableCell>
                                                                <TableCell className=" text-right tabular-nums text-xs">
                                                                    ₹{fmt(bill.amount)}
                                                                </TableCell>
                                                                <TableCell className=" text-right tabular-nums text-xs text-muted-foreground">
                                                                    ₹{fmt(bill.paid_amount)}
                                                                </TableCell>
                                                                <TableCell className={`text-right tabular-nums text-xs font-semibold ${bill.outstanding > 0.005 ? 'text-destructive' : 'text-emerald-700'}`}>
                                                                    ₹{fmt(bill.outstanding)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        <TableRow className="bg-primary/5 border-b-2">
                                                            <TableCell className=""></TableCell>
                                                            <TableCell colSpan={3} className="pl-8 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                                                Subtotal
                                                            </TableCell>
                                                            <TableCell className=" text-right tabular-nums text-xs font-bold">
                                                                ₹{fmt(party.total_billed)}
                                                            </TableCell>
                                                            <TableCell className=" text-right tabular-nums text-xs font-semibold text-muted-foreground">
                                                                ₹{fmt(party.total_paid)}
                                                            </TableCell>
                                                            <TableCell className=" text-right tabular-nums text-xs font-bold text-destructive">
                                                                ₹{fmt(party.total_outstanding)}
                                                            </TableCell>
                                                        </TableRow>
                                                    </>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}

                                    <TableRow className="bg-muted border-t-2 font-bold">
                                        <TableCell className=""></TableCell>
                                        <TableCell colSpan={3} className="text-xs font-bold uppercase tracking-wide">
                                            Grand Total — {displayedData.reduce((s, p) => s + p.bills.length, 0)} Bills
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs font-bold">
                                            ₹{fmt(grandTotals.billed)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs font-semibold text-muted-foreground">
                                            ₹{fmt(grandTotals.paid)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs font-bold text-destructive">
                                            ₹{fmt(grandTotals.outstanding)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border shadow-sm">
                    <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <div className="min-h-0 flex-1 overflow-auto">
                            <Table>
                                <TableHeader className="bg-muted/40 border-b">
                                    <TableRow>
                                        <TableHead className="font-bold w-24">Code</TableHead>
                                        <TableHead className="font-bold">Party</TableHead>
                                        <TableHead className="font-bold w-28">Branch</TableHead>
                                        <TableHead className="font-bold text-right">Bills</TableHead>
                                        <TableHead className="font-bold text-right">Billed</TableHead>
                                        <TableHead className="font-bold text-right">Paid</TableHead>
                                        <TableHead className="font-bold text-right">Outstanding</TableHead>
                                        <TableHead className="text-right w-20"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allPartiesLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                                <div className="flex items-center justify-center gap-2 text-xs">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Loading outstanding parties…
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : fetchError ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center">
                                                <div className="flex flex-col items-center gap-2 text-destructive">
                                                    <AlertCircle className="h-7 w-7" />
                                                    <p className="text-xs font-medium">{fetchError}</p>
                                                    <Button variant="outline" size="sm" onClick={() => void loadAllParties()}>
                                                        Retry
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredParties.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center">
                                                <div className="flex flex-col items-center gap-2 opacity-40">
                                                    <FileText className="h-8 w-8 text-muted-foreground" />
                                                    <p className="text-xs font-medium">
                                                        {allPartiesLoaded
                                                            ? searchTerm
                                                                ? `No parties found for "${searchTerm}"`
                                                                : `No ${PAY_STATUS_LABELS[payStatusFilter].toLowerCase()} bills found`
                                                            : 'Select a branch to view outstanding parties'}
                                                    </p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredParties.map((party) => (
                                            <TableRow
                                                key={party.party_id}
                                                className="transition-colors border-b last:border-0 group cursor-pointer"
                                                onClick={() => selectParty(party.party_id)}
                                            >
                                                <TableCell className="">
                                                    <span className="font-mono font-bold text-primary text-[11px]">{party.party_code}</span>
                                                </TableCell>
                                                <TableCell className="">
                                                    <div className="flex w-full min-w-0 flex-nowrap items-center gap-2">
                                                        <span className="min-w-0 flex-1 truncate font-semibold text-xs" title={party.party_name}>
                                                            {party.party_name}
                                                        </span>
                                                        <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                                                            {party.bills.length} bill{party.bills.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="">
                                                    {party.branch_code ? (
                                                        <span className="font-mono text-[10px] font-semibold text-foreground bg-muted px-1.5 py-0 rounded">
                                                            {party.branch_name || party.branch_code}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/40 text-[10px]">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className=" text-right font-mono text-xs">{party.bills.length}</TableCell>
                                                <TableCell className=" text-right font-mono font-bold text-xs">₹{fmt(party.total_billed)}</TableCell>
                                                <TableCell className=" text-right font-mono font-bold text-xs text-indigo-700">₹{fmt(party.total_paid)}</TableCell>
                                                <TableCell className=" text-right">
                                                    <span className={`font-mono font-bold text-xs px-1.5 py-0 rounded ${party.total_outstanding > 0.005 ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
                                                        ₹{fmt(party.total_outstanding)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className=" text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[11px] text-primary hover:bg-primary/10">
                                                        Details <ChevronRight className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        {filteredParties.length > 0 && !allPartiesLoading && (
                            <div className="shrink-0 border-t bg-muted/20 px-3 py-1.5 grid grid-cols-8 gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                <div className="col-span-2">Total ({filteredParties.length} parties) · {PAY_STATUS_LABELS[payStatusFilter]}</div>
                                <div></div>
                                <div className="text-right font-mono text-foreground">{listTotals.bills}</div>
                                <div className="text-right font-mono text-foreground">₹{fmt(listTotals.billed)}</div>
                                <div className="text-right font-mono text-indigo-700">₹{fmt(listTotals.paid)}</div>
                                <div className="text-right font-mono text-red-700">₹{fmt(listTotals.outstanding)}</div>
                                <div></div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
