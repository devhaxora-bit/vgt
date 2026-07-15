'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Search, BookOpen, TrendingUp, DollarSign, AlertCircle, RotateCcw,
    ChevronRight, Truck, Filter, ArrowUpDown, Calendar, Download, Loader2, X, Package,
} from 'lucide-react';
import { downloadChallanLedgerSummaryPdf } from '@/lib/challanLedgerSummaryPdf';
import { useCurrentUserScope, defaultBranchFilterValue } from '@/lib/hooks/useCurrentUserScope';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface LedgerBroker {
    broker_id: string;
    broker_code: string;
    broker_name: string;
    broker_mobile: string | null;
    primary_branch_code: string | null;
    total_challan_amount: number;
    total_challan_count: number;
    total_advance_amount: number;
    total_tds_amount: number;
    net_payable_amount: number;
    total_paid: number;
    outstanding: number;
}

interface GlobalStats {
    unchallaned_cns_count: number;
    unchallaned_cns_amount: number;
}

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const hasLedgerActivity = (broker: LedgerBroker) =>
    Number(broker.total_challan_amount || 0) !== 0 ||
    Number(broker.net_payable_amount || 0) !== 0 ||
    Number(broker.total_advance_amount || 0) !== 0 ||
    Number(broker.total_paid || 0) !== 0 ||
    Number(broker.outstanding || 0) !== 0;

const KPI_COLOR_STYLES = {
    primary: { iconBg: 'bg-primary/10', iconText: 'text-primary' },
    emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
    amber: { iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
    indigo: { iconBg: 'bg-indigo-50', iconText: 'text-indigo-600' },
    red: { iconBg: 'bg-red-50', iconText: 'text-red-600' },
} as const;

type PaymentFilter = 'all' | 'has_payments' | 'no_payments';
type KpiFilter = 'none' | 'challans' | 'advance' | 'net_payable' | 'paid' | 'outstanding';

export default function ChallanLedgerPage() {
    const userScope = useCurrentUserScope();
    const [brokers, setBrokers] = useState<LedgerBroker[]>([]);
    const [globalStats, setGlobalStats] = useState<GlobalStats>({ unchallaned_cns_count: 0, unchallaned_cns_amount: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('all');
    const [outstandingOnly, setOutstandingOnly] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [sortField, setSortField] = useState<'broker_code' | 'broker_name' | 'primary_branch_code' | 'outstanding' | 'total_advance_amount' | 'net_payable_amount' | 'total_challan_amount' | 'total_paid'>('broker_code');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);
    const [kpiFilter, setKpiFilter] = useState<KpiFilter>('none');

    const toggleKpiFilter = (next: KpiFilter) => {
        setKpiFilter((prev) => (prev === next ? 'none' : next));
    };

    const fetchLedger = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (branchFilter !== 'all') params.set('branch', branchFilter);
            if (outstandingOnly) params.set('has_outstanding', 'true');
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            if (paymentFilter !== 'all') params.set('payment_status', paymentFilter);

            const res = await fetch(`/api/challan-ledger/summary?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setBrokers(data.brokers || []);
            setGlobalStats(data.global || { unchallaned_cns_count: 0, unchallaned_cns_amount: 0 });
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [branchFilter, outstandingOnly, dateFrom, dateTo, paymentFilter]);

    useEffect(() => { fetchLedger(); }, [fetchLedger]);

    useEffect(() => {
        fetch('/api/references/branches')
            .then((r) => r.json())
            .then((data: { code: string; name: string }[]) => {
                setBranchOptions(data.map((b) => ({ value: b.code, label: `${b.code} - ${b.name}` })));
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (!userScope.ready || !userScope.branchCode) return;
        setBranchFilter((prev) => (prev === 'all' ? userScope.branchCode! : prev));
    }, [userScope.ready, userScope.branchCode]);

    const filtered = useMemo(() => {
        let list = brokers.filter(hasLedgerActivity);
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter((b) =>
                b.broker_name.toLowerCase().includes(q) ||
                b.broker_code.toLowerCase().includes(q)
            );
        }
        if (kpiFilter === 'challans') list = list.filter((b) => Number(b.total_challan_amount || 0) > 0);
        if (kpiFilter === 'advance') list = list.filter((b) => Number(b.total_advance_amount || 0) > 0);
        if (kpiFilter === 'net_payable') list = list.filter((b) => Number(b.net_payable_amount || 0) > 0);
        if (kpiFilter === 'paid') list = list.filter((b) => Number(b.total_paid || 0) > 0);
        if (kpiFilter === 'outstanding') list = list.filter((b) => Number(b.outstanding || 0) > 0);

        list.sort((a, b) => {
            const va = a[sortField];
            const vb = b[sortField];
            const sa = va == null ? '' : String(va);
            const sb = vb == null ? '' : String(vb);
            if (sortField === 'broker_code' || sortField === 'broker_name' || sortField === 'primary_branch_code') {
                return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
            }
            return sortDir === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va);
        });
        return list;
    }, [brokers, searchTerm, kpiFilter, sortField, sortDir]);

    const totals = useMemo(() => ({
        challans: filtered.reduce((s, b) => s + (b.total_challan_amount || 0), 0),
        advance: filtered.reduce((s, b) => s + (b.total_advance_amount || 0), 0),
        netPayable: filtered.reduce((s, b) => s + (b.net_payable_amount || 0), 0),
        paid: filtered.reduce((s, b) => s + (b.total_paid || 0), 0),
        outstanding: filtered.reduce((s, b) => s + (b.outstanding || 0), 0),
    }), [filtered]);

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortField(field); setSortDir('asc'); }
    };

    const SortIcon = ({ field }: { field: typeof sortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 inline text-muted-foreground/40" />;
        return sortDir === 'asc'
            ? <ArrowUpDown className="h-3.5 w-3.5 ml-1 inline text-primary" />
            : <ArrowUpDown className="h-3.5 w-3.5 ml-1 inline text-primary rotate-180" />;
    };

    const activeFilterCount = [
        branchFilter !== 'all',
        outstandingOnly,
        !!dateFrom,
        !!dateTo,
        paymentFilter !== 'all',
    ].filter(Boolean).length;

    const resetFilters = () => {
        setSearchTerm('');
        setBranchFilter(defaultBranchFilterValue(userScope));
        setOutstandingOnly(false);
        setDateFrom('');
        setDateTo('');
        setPaymentFilter('all');
        setKpiFilter('none');
    };

    const handleExportPdf = async () => {
        setIsPdfExporting(true);
        try {
            let periodLabel = 'All Time';
            if (dateFrom && dateTo) {
                const fmtD = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
                periodLabel = `${fmtD(dateFrom)} – ${fmtD(dateTo)}`;
            }

            await downloadChallanLedgerSummaryPdf({
                rows: filtered.map((b) => ({
                    broker_code: b.broker_code,
                    broker_name: b.broker_name,
                    primary_branch_code: b.primary_branch_code,
                    total_challan_count: b.total_challan_count,
                    total_challan_amount: b.total_challan_amount,
                    total_advance_amount: b.total_advance_amount,
                    net_payable_amount: b.net_payable_amount,
                    total_paid: b.total_paid,
                    outstanding: b.outstanding,
                })),
                periodLabel,
                filters: {
                    branch: branchFilter !== 'all' ? branchFilter : undefined,
                    paymentStatus: paymentFilter !== 'all' ? paymentFilter : undefined,
                    outstandingOnly,
                },
                generatedAt: new Date().toLocaleString('en-IN'),
            });
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setIsPdfExporting(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Truck className="h-6 w-6 text-primary" />
                        Broker Challan Ledger
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Track loading challan billing, payments, and outstanding by broker
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start">
                    <Button variant="outline" size="sm" onClick={fetchLedger} className="gap-2">
                        <RotateCcw className="h-4 w-4" /> Refresh
                    </Button>
                    <Button size="sm" onClick={handleExportPdf} disabled={isPdfExporting || filtered.length === 0} className="gap-2">
                        {isPdfExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {isPdfExporting ? 'Exporting…' : 'Export PDF'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                {[
                    { key: 'challans' as const, label: 'Total Challan Amount', value: totals.challans, icon: Truck, color: 'primary' as const },
                    { key: 'advance' as const, label: 'Advance Paid', value: totals.advance, icon: AlertCircle, color: 'amber' as const },
                    { key: 'net_payable' as const, label: 'Net Payable', value: totals.netPayable, icon: TrendingUp, color: 'emerald' as const },
                    { key: 'paid' as const, label: 'Total Paid', value: totals.paid, icon: DollarSign, color: 'indigo' as const },
                    { key: 'outstanding' as const, label: 'Outstanding', value: totals.outstanding, icon: BookOpen, color: 'red' as const },
                ].map(({ key, label, value, icon: Icon, color }) => {
                    const styles = KPI_COLOR_STYLES[color];
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => toggleKpiFilter(key)}
                            className={`text-left w-full rounded-xl border-2 shadow-md bg-white transition-all hover:shadow-lg ${kpiFilter === key ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'}`}
                        >
                            <div className="p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3">
                                <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center shrink-0 ${styles.iconBg}`}>
                                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${styles.iconText}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] sm:text-[11px] font-bold uppercase text-muted-foreground leading-tight">{label}</p>
                                    <p className="text-base sm:text-lg xl:text-xl font-black truncate">₹{fmt(value)}</p>
                                </div>
                            </div>
                        </button>
                    );
                })}
                <div className="rounded-xl border-2 border-transparent shadow-md bg-white w-full">
                    <div className="p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center shrink-0 bg-orange-50">
                            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase text-muted-foreground leading-tight">Unchallaned CNS</p>
                            <p className="text-base sm:text-lg xl:text-xl font-black">{globalStats.unchallaned_cns_count}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">₹{fmt(globalStats.unchallaned_cns_amount)} freight</p>
                        </div>
                    </div>
                </div>
            </div>

            <Card className="border shadow-sm">
                <CardContent className="p-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search broker name or code..." className="pl-9 h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <Select
                            value={branchFilter}
                            onValueChange={setBranchFilter}
                            disabled={userScope.isBranchScoped}
                        >
                            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Branch" /></SelectTrigger>
                            <SelectContent>
                                {!userScope.isBranchScoped && (
                                    <SelectItem value="all">All Branches</SelectItem>
                                )}
                                {branchOptions.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant={outstandingOnly ? 'default' : 'outline'} size="sm" className="h-9" onClick={() => setOutstandingOnly((o) => !o)}>
                            <Filter className="h-3.5 w-3.5 mr-2" /> Outstanding Only
                        </Button>
                        {(activeFilterCount > 0 || searchTerm) && (
                            <Button variant="ghost" size="sm" className="h-9 gap-1.5 ml-auto" onClick={resetFilters}>
                                <RotateCcw className="h-3.5 w-3.5" /> Reset
                            </Button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 border-t pt-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Input type="date" className="h-9 w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        <span className="text-xs">–</span>
                        <Input type="date" className="h-9 w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as PaymentFilter)}>
                            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Payments</SelectItem>
                                <SelectItem value="has_payments">Has Payments</SelectItem>
                                <SelectItem value="no_payments">No Payments</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card className="border shadow-lg overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/40 border-b">
                                <TableRow>
                                    <TableHead className="cursor-pointer" onClick={() => toggleSort('broker_code')}>Code <SortIcon field="broker_code" /></TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => toggleSort('broker_name')}>Broker <SortIcon field="broker_name" /></TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => toggleSort('primary_branch_code')}>Branch <SortIcon field="primary_branch_code" /></TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('total_challan_amount')}>Challan Amt <SortIcon field="total_challan_amount" /></TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('total_advance_amount')}>Advance <SortIcon field="total_advance_amount" /></TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('net_payable_amount')}>Net Payable <SortIcon field="net_payable_amount" /></TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('total_paid')}>Paid <SortIcon field="total_paid" /></TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('outstanding')}>Outstanding <SortIcon field="outstanding" /></TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">Loading...</TableCell></TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No brokers found</TableCell></TableRow>
                                ) : filtered.map((b) => (
                                    <TableRow key={b.broker_id} className="hover:bg-primary/5 group">
                                        <TableCell><span className="font-mono font-bold text-primary text-xs">{b.broker_code}</span></TableCell>
                                        <TableCell>
                                            <div className="font-semibold text-sm">{b.broker_name}</div>
                                            <div className="text-[10px] text-muted-foreground">{b.total_challan_count} challans</div>
                                        </TableCell>
                                        <TableCell>{b.primary_branch_code || '—'}</TableCell>
                                        <TableCell className="text-right font-mono font-bold">₹{fmt(b.total_challan_amount)}</TableCell>
                                        <TableCell className="text-right font-mono text-amber-700">₹{fmt(b.total_advance_amount)}</TableCell>
                                        <TableCell className="text-right font-mono text-emerald-700">₹{fmt(b.net_payable_amount)}</TableCell>
                                        <TableCell className="text-right font-mono text-indigo-700">₹{fmt(b.total_paid)}</TableCell>
                                        <TableCell className="text-right font-mono text-red-700">₹{fmt(b.outstanding)}</TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/dashboard/challan-ledger/${b.broker_id}`}>
                                                <Button size="sm" variant="ghost" className="h-8 gap-1 text-primary">Ledger <ChevronRight className="h-3.5 w-3.5" /></Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
