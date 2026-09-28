'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    Download,
    FileSpreadsheet,
    Filter,
    Loader2,
    RefreshCw,
    RotateCcw,
    Search,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useCurrentUserScope, defaultBranchFilterValue } from '@/lib/hooks/useCurrentUserScope';
import type { BookingRegisterRow } from '@/lib/types/bookingRegister.types';

type BillStatusFilter = 'all' | 'billed' | 'unbilled';
type SortField =
    | 'bkg_date'
    | 'cn_no'
    | 'booking_branch'
    | 'billing_party'
    | 'bkg_basis'
    | 'total_freight';

const BKG_BASIS_OPTIONS = [
    { value: 'all', label: 'All bases' },
    { value: 'TO BE BILLED', label: 'TBB — To be billed' },
    { value: 'TOPAY', label: 'To-pay' },
    { value: 'PAID', label: 'Paid' },
] as const;

const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (value: string | null) => {
    if (!value) return '—';
    const [y, m, d] = value.split('-');
    if (!y || !m || !d) return value;
    return `${d}/${m}/${y}`;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const csvEscape = (value: unknown): string => {
    const raw = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
    return raw;
};

export default function BookingRegisterPage() {
    const userScope = useCurrentUserScope();

    const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);
    const [branchFilter, setBranchFilter] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState(todayIso());
    const [dateTo, setDateTo] = useState(todayIso());
    const [basisFilter, setBasisFilter] = useState('all');
    const [billStatus, setBillStatus] = useState<BillStatusFilter>('all');
    const [partyQ, setPartyQ] = useState('');
    const [cnNo, setCnNo] = useState('');
    const [destBranch, setDestBranch] = useState('all');
    const [includeCancelled, setIncludeCancelled] = useState(false);

    const [rows, setRows] = useState<BookingRegisterRow[]>([]);
    const [summary, setSummary] = useState({
        count: 0,
        freight_total: 0,
        tbb_count: 0,
        billed_count: 0,
        unbilled_count: 0,
        cancelled_count: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [sortField, setSortField] = useState<SortField>('bkg_date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [tableSearch, setTableSearch] = useState('');

    useEffect(() => {
        fetch('/api/references/branches')
            .then((r) => r.json())
            .then((branches: { code: string; name: string }[]) => {
                setBranchOptions(
                    branches.map((b) => ({
                        value: String(b.code || '').trim().toUpperCase(),
                        label: `${b.code} — ${b.name}`,
                    })),
                );
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (!userScope.ready || branchFilter !== null) return;
        if (branchOptions.length === 0) return;
        setBranchFilter(defaultBranchFilterValue(userScope));
    }, [userScope.ready, userScope.branchCode, branchFilter, branchOptions.length]);

    const applyToday = () => {
        const today = todayIso();
        setDateFrom(today);
        setDateTo(today);
    };

    const resetFilters = () => {
        const today = todayIso();
        setDateFrom(today);
        setDateTo(today);
        setBasisFilter('all');
        setBillStatus('all');
        setPartyQ('');
        setCnNo('');
        setDestBranch('all');
        setIncludeCancelled(false);
        setTableSearch('');
        setBranchFilter(defaultBranchFilterValue(userScope));
    };

    const fetchRegister = useCallback(async () => {
        if (!branchFilter) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (branchFilter !== 'all') params.set('branch', branchFilter);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            if (basisFilter !== 'all') params.set('bkg_basis', basisFilter);
            if (billStatus !== 'all') params.set('bill_status', billStatus);
            if (partyQ.trim()) params.set('party_q', partyQ.trim());
            if (cnNo.trim()) params.set('cn_no', cnNo.trim());
            if (destBranch !== 'all') params.set('dest_branch', destBranch);
            if (includeCancelled) params.set('include_cancelled', 'true');
            params.set('limit', '5000');

            const res = await fetch(`/api/reports/booking-register?${params.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load booking register');

            setRows(Array.isArray(json.data) ? json.data : []);
            setSummary(
                json.summary || {
                    count: 0,
                    freight_total: 0,
                    tbb_count: 0,
                    billed_count: 0,
                    unbilled_count: 0,
                    cancelled_count: 0,
                },
            );
            setHasLoaded(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to load booking register');
            setRows([]);
        } finally {
            setIsLoading(false);
        }
    }, [
        branchFilter,
        dateFrom,
        dateTo,
        basisFilter,
        billStatus,
        partyQ,
        cnNo,
        destBranch,
        includeCancelled,
    ]);

    useEffect(() => {
        if (!branchFilter) return;
        void fetchRegister();
    }, [branchFilter]); // initial load for default branch; Search button reloads

    const sortedRows = useMemo(() => {
        const q = tableSearch.trim().toLowerCase();
        const filtered = q
            ? rows.filter((row) =>
                  [
                      row.cn_no,
                      row.billing_party,
                      row.billing_party_code,
                      row.consignor_name,
                      row.consignee_name,
                      row.dest_branch,
                      row.vehicle_no,
                      row.bill_ref_no,
                  ]
                      .filter(Boolean)
                      .some((value) => String(value).toLowerCase().includes(q)),
              )
            : rows;

        const dir = sortDir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) => {
            const av = a[sortField];
            const bv = b[sortField];
            if (sortField === 'total_freight') {
                return (Number(av) - Number(bv)) * dir;
            }
            return String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true }) * dir;
        });
    }, [rows, sortField, sortDir, tableSearch]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortField(field);
        setSortDir(field === 'cn_no' || field === 'bkg_date' ? 'desc' : 'asc');
    };

    const exportCsv = () => {
        if (sortedRows.length === 0) {
            toast.error('Nothing to export');
            return;
        }
        const headers = [
            'Bkg Date',
            'Branch',
            'CN No',
            'Basis',
            'Billing Party',
            'Party Code',
            'Consignor',
            'Consignee',
            'Dest',
            'Pkgs',
            'Weight',
            'Freight',
            'Del Type',
            'Vehicle',
            'Bill Status',
            'Bill Ref',
        ];
        const lines = [headers.join(',')];
        for (const row of sortedRows) {
            lines.push(
                [
                    row.bkg_date,
                    row.booking_branch,
                    row.cn_no,
                    row.bkg_basis,
                    row.billing_party,
                    row.billing_party_code,
                    row.consignor_name,
                    row.consignee_name,
                    row.dest_branch || row.delivery_point,
                    row.total_qty ?? row.no_of_pkg,
                    row.actual_weight,
                    row.total_freight,
                    row.delivery_type,
                    row.vehicle_no,
                    row.bill_status,
                    row.bill_ref_no,
                ]
                    .map(csvEscape)
                    .join(','),
            );
        }
        const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `booking-register-${dateFrom || 'all'}-${dateTo || 'all'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV downloaded');
    };

    const SortHint = ({ field }: { field: SortField }) =>
        sortField === field ? (
            <span className="ml-1 text-[10px] text-muted-foreground">{sortDir === 'asc' ? '↑' : '↓'}</span>
        ) : null;

    return (
        <div className="space-y-5 p-4 md:p-6 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary">
                        <FileSpreadsheet className="h-5 w-5" />
                        <p className="text-xs font-bold uppercase tracking-wide">Finance · Reports</p>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#101828]">Booking Register</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Date-wise, party-wise, TBB and billed booking list — dense register layout.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={applyToday}>
                        <CalendarDays className="h-4 w-4" />
                        Today
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={resetFilters}>
                        <RotateCcw className="h-4 w-4" />
                        Reset
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={!hasLoaded}>
                        <Download className="h-4 w-4" />
                        CSV
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => void fetchRegister()} disabled={isLoading || !branchFilter}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Search
                    </Button>
                </div>
            </div>

            <Card className="border shadow-sm">
                <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <Filter className="h-3.5 w-3.5" />
                        Filters
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Booking branch</Label>
                            <Select
                                value={branchFilter ?? undefined}
                                onValueChange={setBranchFilter}
                                disabled={!userScope.ready || userScope.isBranchScoped}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {!userScope.isBranchScoped && <SelectItem value="all">All branches</SelectItem>}
                                    {branchOptions.map((b) => (
                                        <SelectItem key={b.value} value={b.value}>
                                            {b.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Date from</Label>
                            <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Date to</Label>
                            <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Booking basis</Label>
                            <Select value={basisFilter} onValueChange={setBasisFilter}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {BKG_BASIS_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Bill status</Label>
                            <Select value={billStatus} onValueChange={(v) => setBillStatus(v as BillStatusFilter)}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="billed">Billed</SelectItem>
                                    <SelectItem value="unbilled">Unbilled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Dest branch</Label>
                            <Select value={destBranch} onValueChange={setDestBranch}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All dest</SelectItem>
                                    {branchOptions.map((b) => (
                                        <SelectItem key={b.value} value={b.value}>
                                            {b.value}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-xs">Party / consignor</Label>
                            <Input
                                className="h-9"
                                placeholder="Billing party name or code"
                                value={partyQ}
                                onChange={(e) => setPartyQ(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">CN No</Label>
                            <Input className="h-9 font-mono" placeholder="CN number" value={cnNo} onChange={(e) => setCnNo(e.target.value)} />
                        </div>
                        <div className="space-y-1.5 flex items-end">
                            <label className="flex items-center gap-2 text-xs h-9 px-1">
                                <input
                                    type="checkbox"
                                    checked={includeCancelled}
                                    onChange={(e) => setIncludeCancelled(e.target.checked)}
                                    className="rounded border"
                                />
                                Include cancelled CNs
                            </label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Bookings', value: String(summary.count) },
                    { label: 'Freight', value: `₹${fmtMoney(summary.freight_total)}` },
                    { label: 'TBB', value: String(summary.tbb_count) },
                    { label: 'Billed', value: String(summary.billed_count) },
                    { label: 'Unbilled', value: String(summary.unbilled_count) },
                    { label: 'Cancelled', value: String(summary.cancelled_count) },
                ].map((kpi) => (
                    <div key={kpi.label} className="rounded-lg border bg-white px-3 py-2.5 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                        <p className="text-lg font-bold tabular-nums text-[#101828]">{kpi.value}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Register · {sortedRows.length} row{sortedRows.length === 1 ? '' : 's'}
                    </p>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            className="h-8 pl-8 text-xs"
                            placeholder="Filter table…"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="vgt-register-table w-full min-w-[1200px] border-collapse text-xs">
                        <thead>
                            <tr>
                                <th className="cursor-pointer" onClick={() => toggleSort('bkg_date')}>
                                    Bkg Date <SortHint field="bkg_date" />
                                </th>
                                <th className="cursor-pointer" onClick={() => toggleSort('booking_branch')}>
                                    Br <SortHint field="booking_branch" />
                                </th>
                                <th className="cursor-pointer" onClick={() => toggleSort('cn_no')}>
                                    CN No <SortHint field="cn_no" />
                                </th>
                                <th className="cursor-pointer" onClick={() => toggleSort('bkg_basis')}>
                                    Basis <SortHint field="bkg_basis" />
                                </th>
                                <th className="cursor-pointer" onClick={() => toggleSort('billing_party')}>
                                    Billing Party <SortHint field="billing_party" />
                                </th>
                                <th>Consignor</th>
                                <th>Consignee</th>
                                <th>Dest</th>
                                <th className="text-right">Pkgs</th>
                                <th className="text-right">Wt</th>
                                <th className="text-right cursor-pointer" onClick={() => toggleSort('total_freight')}>
                                    Freight <SortHint field="total_freight" />
                                </th>
                                <th>Del Type</th>
                                <th>Vehicle</th>
                                <th>Bill</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={14} className="text-center py-10 text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                        Loading register…
                                    </td>
                                </tr>
                            ) : sortedRows.length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="text-center py-10 text-muted-foreground">
                                        {hasLoaded ? 'No bookings match these filters.' : 'Set filters and click Search.'}
                                    </td>
                                </tr>
                            ) : (
                                sortedRows.map((row) => (
                                    <tr key={row.id} className={row.cancel_cn ? 'opacity-60' : undefined}>
                                        <td className="whitespace-nowrap">{fmtDate(row.bkg_date)}</td>
                                        <td className="font-mono font-semibold">{row.booking_branch || '—'}</td>
                                        <td className="font-mono font-bold text-primary">{row.cn_no}</td>
                                        <td>
                                            {String(row.bkg_basis || '').toUpperCase() === 'TO BE BILLED' ? (
                                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-200 bg-amber-50 text-amber-800">
                                                    TBB
                                                </Badge>
                                            ) : (
                                                row.bkg_basis || '—'
                                            )}
                                        </td>
                                        <td className="max-w-[180px]">
                                            <div className="truncate font-medium" title={row.billing_party || undefined}>
                                                {row.billing_party || '—'}
                                            </div>
                                            {row.billing_party_code && (
                                                <div className="font-mono text-[10px] text-muted-foreground">{row.billing_party_code}</div>
                                            )}
                                        </td>
                                        <td className="max-w-[140px] truncate" title={row.consignor_name || undefined}>
                                            {row.consignor_name || '—'}
                                        </td>
                                        <td className="max-w-[140px] truncate" title={row.consignee_name || undefined}>
                                            {row.consignee_name || '—'}
                                        </td>
                                        <td className="font-mono">{row.dest_branch || row.delivery_point || '—'}</td>
                                        <td className="text-right tabular-nums">{row.total_qty ?? row.no_of_pkg ?? '—'}</td>
                                        <td className="text-right tabular-nums">
                                            {row.actual_weight != null
                                                ? `${fmtMoney(Number(row.actual_weight))}${row.load_unit ? ` ${row.load_unit}` : ''}`
                                                : '—'}
                                        </td>
                                        <td className="text-right font-mono font-semibold tabular-nums">
                                            ₹{fmtMoney(row.total_freight)}
                                        </td>
                                        <td className="text-[11px]">{row.delivery_type || '—'}</td>
                                        <td className="font-mono text-[11px]">{row.vehicle_no || '—'}</td>
                                        <td>
                                            {row.bill_status === 'BILLED' ? (
                                                <div>
                                                    <Badge className="h-5 px-1.5 text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                                        Billed
                                                    </Badge>
                                                    {row.bill_ref_no && (
                                                        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                                            {row.bill_ref_no}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-200 text-amber-800">
                                                    Unbilled
                                                </Badge>
                                            )}
                                            {row.cancel_cn && (
                                                <div className="text-[10px] text-red-600 font-semibold mt-0.5">Cancelled</div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => void fetchRegister()}
                    disabled={isLoading}
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
        </div>
    );
}
