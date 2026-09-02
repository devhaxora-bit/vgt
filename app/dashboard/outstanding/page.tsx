'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    Building2,
    Calendar,
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
import type { OutstandingPartyRow } from '@/app/api/outstanding/route';

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

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
            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error((errBody as { error?: string }).error ?? 'Failed to fetch outstanding data');
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
        if (!searchTerm.trim()) return allParties;
        const q = searchTerm.toLowerCase();
        return allParties.filter(
            (p) =>
                p.party_name.toLowerCase().includes(q) ||
                (p.party_code ?? '').toLowerCase().includes(q)
        );
    }, [allParties, searchTerm]);

    const displayedData = selectedPartyId
        ? allParties.filter((p) => p.party_id === selectedPartyId)
        : [];

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
        setBranchFilter(defaultBranchFilterValue(userScope));
        setDateFrom('');
        setDateTo('');
        setSelectedPartyId(null);
        setExpandedParties(new Set());
        // allParties reset will be triggered by the branchFilter/date effect
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
        if (displayedData.length === 0) return;
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
                rows: displayedData,
                periodLabel: buildPeriodLabel(),
                filters: {
                    branch: branchFilter && branchFilter !== 'all' ? branchFilter : undefined,
                    branchName:
                        branchFilter && branchFilter !== 'all'
                            ? branchNameByCode.get(branchFilter)
                            : undefined,
                    search: searchTerm.trim() || undefined,
                },
                generatedAt,
            });
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setIsPdfExporting(false);
        }
    };

    const handlePrint = async () => {
        if (displayedData.length === 0) return;
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
                        rows: displayedData,
                        periodLabel: buildPeriodLabel(),
                        filters: {
                            branch: branchFilter && branchFilter !== 'all' ? branchFilter : undefined,
                            branchName:
                                branchFilter && branchFilter !== 'all'
                                    ? branchNameByCode.get(branchFilter)
                                    : undefined,
                            search: searchTerm.trim() || undefined,
                        },
                        generatedAt,
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
    ].filter(Boolean).length;

    return (
        <div className="p-6 space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <AlertCircle className="h-6 w-6 text-primary" />
                        Party Outstanding
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Bill-wise outstanding amounts for all parties
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void loadAllParties()}
                        disabled={allPartiesLoading || !branchFilter}
                        className="gap-2"
                    >
                        <RotateCcw className="h-4 w-4" /> Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        disabled={isPrinting || displayedData.length === 0}
                        className="gap-2"
                    >
                        {isPrinting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Printer className="h-4 w-4" />
                        )}
                        Print
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleExportPdf}
                        disabled={isPdfExporting || displayedData.length === 0}
                        className="gap-2"
                    >
                        {isPdfExporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        {isPdfExporting ? 'Exporting…' : 'Export PDF'}
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col md:flex-row gap-3 flex-wrap">
                        {/* Branch */}
                        <div className="flex flex-col gap-1 min-w-[200px]">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> Branch
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
                                    className="h-9 bg-muted/40 text-sm"
                                />
                            ) : (
                                <Select
                                    value={branchFilter ?? 'all'}
                                    onValueChange={(v) => setBranchFilter(v)}
                                >
                                    <SelectTrigger className="h-9 text-sm w-full">
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

                        {/* Date From */}
                        <div className="flex flex-col gap-1 min-w-[160px]">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Bill Date From
                            </label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Date To */}
                        <div className="flex flex-col gap-1 min-w-[160px]">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Bill Date To
                            </label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Party Search */}
                        <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Search className="h-3 w-3" /> Search Party
                            </label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Search party name or code…"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-9 pl-8 pr-8 text-sm"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Reset */}
                        {activeFilterCount > 0 && (
                            <div className="flex flex-col gap-1 justify-end">
                                <label className="text-xs opacity-0">Reset</label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetFilters}
                                    className="gap-1.5 h-9 text-muted-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Reset
                                    <Badge variant="secondary" className="ml-0.5 text-xs px-1.5 py-0">
                                        {activeFilterCount}
                                    </Badge>
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {selectedPartyId && displayedData.length > 0 ? (
                <>
                    <div className="flex items-center gap-2 text-sm">
                        <Button variant="ghost" size="sm" onClick={clearSelectedParty} className="h-8 gap-1 text-muted-foreground">
                            <X className="h-3.5 w-3.5" /> Back to list
                        </Button>
                        <span className="text-muted-foreground">Showing:</span>
                        <span className="font-semibold">{displayedData[0].party_name}</span>
                        <Badge variant="outline" className="font-mono text-xs">{displayedData[0].party_code}</Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card>
                            <CardContent className="pt-4 pb-4">
                                <p className="text-xs text-muted-foreground font-medium">Bills</p>
                                <p className="text-2xl font-bold mt-1">
                                    {displayedData.reduce((s, p) => s + p.bills.length, 0)}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 pb-4">
                                <p className="text-xs text-muted-foreground font-medium">Total Billed</p>
                                <p className="text-xl font-bold mt-1 tabular-nums">₹{fmt(grandTotals.billed)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 pb-4">
                                <p className="text-xs text-muted-foreground font-medium">Total Paid</p>
                                <p className="text-xl font-bold mt-1 tabular-nums">₹{fmt(grandTotals.paid)}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-destructive/30 bg-destructive/5">
                            <CardContent className="pt-4 pb-4">
                                <p className="text-xs text-muted-foreground font-medium">Outstanding</p>
                                <p className="text-xl font-bold mt-1 text-destructive tabular-nums">₹{fmt(grandTotals.outstanding)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead className="font-semibold">Party / Bill No.</TableHead>
                                        <TableHead className="font-semibold">Bill Date</TableHead>
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
                                                    <TableCell className="w-8 py-2.5">
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm">{party.party_name}</span>
                                                            <Badge variant="outline" className="text-xs font-mono">
                                                                {party.party_code}
                                                            </Badge>
                                                            {party.branch_code && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {party.branch_name || party.branch_code}
                                                                </Badge>
                                                            )}
                                                            <span className="text-xs text-muted-foreground ml-1">
                                                                {party.bills.length} bill{party.bills.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-muted-foreground text-xs">—</TableCell>
                                                    <TableCell className="py-2.5 text-right tabular-nums font-bold">
                                                        ₹{fmt(party.total_billed)}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-right tabular-nums text-muted-foreground">
                                                        ₹{fmt(party.total_paid)}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-right tabular-nums font-bold text-destructive">
                                                        ₹{fmt(party.total_outstanding)}
                                                    </TableCell>
                                                </TableRow>

                                                {isExpanded && (
                                                    <>
                                                        {party.bills.map((bill, idx) => (
                                                            <TableRow
                                                                key={bill.id}
                                                                className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                                                            >
                                                                <TableCell className="w-8"></TableCell>
                                                                <TableCell className="py-2 pl-8">
                                                                    <span className="font-medium text-sm font-mono">
                                                                        {bill.bill_ref_no || '—'}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="py-2 text-sm text-muted-foreground">
                                                                    {fmtDate(bill.billing_date)}
                                                                </TableCell>
                                                                <TableCell className="py-2 text-right tabular-nums text-sm">
                                                                    ₹{fmt(bill.amount)}
                                                                </TableCell>
                                                                <TableCell className="py-2 text-right tabular-nums text-sm text-muted-foreground">
                                                                    ₹{fmt(bill.paid_amount)}
                                                                </TableCell>
                                                                <TableCell className="py-2 text-right tabular-nums text-sm font-semibold text-destructive">
                                                                    ₹{fmt(bill.outstanding)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        <TableRow className="bg-primary/5 border-b-2">
                                                            <TableCell></TableCell>
                                                            <TableCell colSpan={2} className="py-2 pl-8 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                                {party.party_name} — Subtotal
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right tabular-nums text-sm font-bold">
                                                                ₹{fmt(party.total_billed)}
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right tabular-nums text-sm font-semibold text-muted-foreground">
                                                                ₹{fmt(party.total_paid)}
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right tabular-nums text-sm font-bold text-destructive">
                                                                ₹{fmt(party.total_outstanding)}
                                                            </TableCell>
                                                        </TableRow>
                                                    </>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}

                                    <TableRow className="bg-muted border-t-2 font-bold">
                                        <TableCell></TableCell>
                                        <TableCell colSpan={2} className="py-3 text-sm font-bold uppercase tracking-wide">
                                            Grand Total — {displayedData.length} {displayedData.length === 1 ? 'Party' : 'Parties'} /{' '}
                                            {displayedData.reduce((s, p) => s + p.bills.length, 0)} Bills
                                        </TableCell>
                                        <TableCell className="py-3 text-right tabular-nums font-bold text-base">
                                            ₹{fmt(grandTotals.billed)}
                                        </TableCell>
                                        <TableCell className="py-3 text-right tabular-nums font-semibold text-muted-foreground">
                                            ₹{fmt(grandTotals.paid)}
                                        </TableCell>
                                        <TableCell className="py-3 text-right tabular-nums font-bold text-destructive text-base">
                                            ₹{fmt(grandTotals.outstanding)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Card className="border shadow-lg overflow-hidden">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/40 border-b">
                                    <TableRow>
                                        <TableHead className="font-bold py-4 w-24">Code</TableHead>
                                        <TableHead className="font-bold py-4">Party</TableHead>
                                        <TableHead className="font-bold py-4 w-28">Branch</TableHead>
                                        <TableHead className="font-bold py-4 text-right">Bills</TableHead>
                                        <TableHead className="font-bold py-4 text-right">Billed</TableHead>
                                        <TableHead className="font-bold py-4 text-right">Paid</TableHead>
                                        <TableHead className="font-bold py-4 text-right">Outstanding</TableHead>
                                        <TableHead className="py-4 text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allPartiesLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Loading outstanding parties…
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : fetchError ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center">
                                                <div className="flex flex-col items-center gap-2 text-destructive">
                                                    <AlertCircle className="h-8 w-8" />
                                                    <p className="text-sm font-medium">{fetchError}</p>
                                                    <Button variant="outline" size="sm" onClick={() => void loadAllParties()}>
                                                        Retry
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredParties.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center">
                                                <div className="flex flex-col items-center gap-2 opacity-40">
                                                    <FileText className="h-10 w-10 text-muted-foreground" />
                                                    <p className="text-sm font-medium">
                                                        {allPartiesLoaded
                                                            ? searchTerm
                                                                ? `No parties found for "${searchTerm}"`
                                                                : 'No outstanding bills found'
                                                            : 'Select a branch to view outstanding parties'}
                                                    </p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredParties.map((party) => (
                                            <TableRow
                                                key={party.party_id}
                                                className="hover:bg-primary/5 transition-colors border-b last:border-0 group cursor-pointer"
                                                onClick={() => selectParty(party.party_id)}
                                            >
                                                <TableCell>
                                                    <span className="font-mono font-bold text-primary text-xs">{party.party_code}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-semibold text-sm">{party.party_name}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                        {party.bills.length} bill{party.bills.length !== 1 ? 's' : ''}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {party.branch_code ? (
                                                        <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                                                            {party.branch_name || party.branch_code}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/40 text-xs">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm">{party.bills.length}</TableCell>
                                                <TableCell className="text-right font-mono font-bold text-sm">₹{fmt(party.total_billed)}</TableCell>
                                                <TableCell className="text-right font-mono font-bold text-sm text-indigo-700">₹{fmt(party.total_paid)}</TableCell>
                                                <TableCell className="text-right">
                                                    <span className="font-mono font-bold text-sm text-red-700 bg-red-50 px-2 py-0.5 rounded">
                                                        ₹{fmt(party.total_outstanding)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-primary hover:bg-primary/10">
                                                        Details <ChevronRight className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        {filteredParties.length > 0 && !allPartiesLoading && (
                            <div className="px-6 py-4 border-t bg-muted/20 grid grid-cols-8 gap-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                <div className="col-span-2">Total ({filteredParties.length} parties)</div>
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
