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
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
    const [data, setData] = useState<OutstandingPartyRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const [branchFilter, setBranchFilter] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedParties, setExpandedParties] = useState<Set<string>>(new Set());
    const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);

    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const fetchData = useCallback(async () => {
        if (!branchFilter) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (branchFilter !== 'all') params.set('branch', branchFilter);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            if (searchTerm.trim()) params.set('search', searchTerm.trim());

            const res = await fetch(`/api/outstanding?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const json: OutstandingPartyRow[] = await res.json();
            setData(json);
            setHasFetched(true);
            // Expand all parties by default
            setExpandedParties(new Set(json.map((p) => p.party_id)));
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [branchFilter, dateFrom, dateTo, searchTerm]);

    // Fetch on filter changes (debounce search term)
    useEffect(() => {
        if (!branchFilter) return;
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            void fetchData();
        }, 300);
        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [fetchData, branchFilter]);

    const grandTotals = useMemo(
        () =>
            data.reduce(
                (acc, p) => ({
                    billed: acc.billed + p.total_billed,
                    paid: acc.paid + p.total_paid,
                    outstanding: acc.outstanding + p.total_outstanding,
                }),
                { billed: 0, paid: 0, outstanding: 0 }
            ),
        [data]
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

    const expandAll = () => setExpandedParties(new Set(data.map((p) => p.party_id)));
    const collapseAll = () => setExpandedParties(new Set());

    const resetFilters = () => {
        setSearchTerm('');
        setBranchFilter(defaultBranchFilterValue(userScope));
        setDateFrom('');
        setDateTo('');
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
        if (data.length === 0) return;
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
                rows: data,
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
        if (data.length === 0) return;
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
                        rows: data,
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
                        onClick={fetchData}
                        disabled={isLoading || !branchFilter}
                        className="gap-2"
                    >
                        <RotateCcw className="h-4 w-4" /> Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        disabled={isPrinting || data.length === 0}
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
                        disabled={isPdfExporting || data.length === 0}
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
                        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Search className="h-3 w-3" /> Search Party
                            </label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Party name or code…"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-9 pl-8 text-sm"
                                />
                                {searchTerm && (
                                    <button
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

            {/* Summary KPI Cards */}
            {hasFetched && data.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground font-medium">Parties</p>
                            <p className="text-2xl font-bold mt-1">{data.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground font-medium">Total Bills</p>
                            <p className="text-2xl font-bold mt-1">
                                {data.reduce((s, p) => s + p.bills.length, 0)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground font-medium">Total Billed</p>
                            <p className="text-xl font-bold mt-1 tabular-nums">
                                ₹{fmt(grandTotals.billed)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-destructive/30 bg-destructive/5">
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground font-medium">Total Outstanding</p>
                            <p className="text-xl font-bold mt-1 text-destructive tabular-nums">
                                ₹{fmt(grandTotals.outstanding)}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Loading outstanding data…</span>
                        </div>
                    ) : !hasFetched ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                            <FileText className="h-10 w-10 opacity-30" />
                            <p className="text-sm">Select a branch and apply filters to view outstanding bills</p>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                            <AlertCircle className="h-10 w-10 opacity-30" />
                            <p className="text-sm font-medium">No outstanding bills found</p>
                            <p className="text-xs">Try adjusting the filters or date range</p>
                        </div>
                    ) : (
                        <>
                            {/* Expand/collapse controls */}
                            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                                <span className="text-xs text-muted-foreground font-medium">
                                    {data.length} {data.length === 1 ? 'party' : 'parties'} with outstanding bills
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={expandAll}
                                        className="h-7 text-xs gap-1 text-muted-foreground"
                                    >
                                        <ChevronDown className="h-3 w-3" /> Expand All
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={collapseAll}
                                        className="h-7 text-xs gap-1 text-muted-foreground"
                                    >
                                        <ChevronRight className="h-3 w-3" /> Collapse All
                                    </Button>
                                </div>
                            </div>

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
                                    {data.map((party) => {
                                        const isExpanded = expandedParties.has(party.party_id);
                                        return (
                                            <React.Fragment key={party.party_id}>
                                                {/* Party header row */}
                                                <Collapsible open={isExpanded} onOpenChange={() => toggleParty(party.party_id)} asChild>
                                                    <>
                                                        <CollapsibleTrigger asChild>
                                                            <TableRow className="bg-muted/60 hover:bg-muted/80 cursor-pointer select-none font-semibold border-t-2">
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
                                                        </CollapsibleTrigger>

                                                        <CollapsibleContent asChild>
                                                            <>
                                                                {party.bills.map((bill, idx) => (
                                                                    <TableRow
                                                                        key={bill.id}
                                                                        className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                                                                    >
                                                                        <TableCell className="w-8"></TableCell>
                                                                        <TableCell className="py-2 pl-8">
                                                                            <span className="font-medium text-sm font-mono">
                                                                                {bill.bill_no || '—'}
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
                                                                {/* Party subtotal row */}
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
                                                        </CollapsibleContent>
                                                    </>
                                                </Collapsible>
                                            </React.Fragment>
                                        );
                                    })}

                                    {/* Grand Total */}
                                    <TableRow className="bg-muted border-t-2 font-bold">
                                        <TableCell></TableCell>
                                        <TableCell colSpan={2} className="py-3 text-sm font-bold uppercase tracking-wide">
                                            Grand Total — {data.length} {data.length === 1 ? 'Party' : 'Parties'} /{' '}
                                            {data.reduce((s, p) => s + p.bills.length, 0)} Bills
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
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
