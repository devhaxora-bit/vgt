'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Search,
    BookOpen,
    TrendingUp,
    DollarSign,
    AlertCircle,
    RotateCcw,
    ChevronRight,
    Package,
    Filter,
    ArrowUpDown,
    Calendar,
    Download,
    Loader2,
} from 'lucide-react';
import { downloadLedgerSummaryPdf } from '@/lib/ledgerSummaryPdf';
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

interface LedgerParty {
    party_id: string;
    party_name: string;
    party_code: string;
    party_type: string;
    phone: string | null;
    branch_code: string | null;
    ledger_account_id: string;
    opening_balance: number;
    credit_limit: number;
    credit_days: number;
    total_cns_amount: number;
    total_cns_count: number;
    total_billed: number;
    total_paid: number;
    unbilled_amount: number;
    overbilled_amount?: number;
    outstanding: number;
}

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const hasLedgerActivity = (party: LedgerParty) =>
    Number(party.opening_balance || 0) !== 0 ||
    Number(party.total_cns_amount || 0) !== 0 ||
    Number(party.total_billed || 0) !== 0 ||
    Number(party.total_paid || 0) !== 0 ||
    Number(party.unbilled_amount || 0) !== 0 ||
    Number(party.overbilled_amount || 0) !== 0 ||
    Number(party.outstanding || 0) !== 0;

type BillingFilter = 'all' | 'has_bills' | 'no_bills';
type PaymentFilter = 'all' | 'has_payments' | 'no_payments';

export default function LedgerPage() {
    const [parties, setParties] = useState<LedgerParty[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('all');
    const [outstandingOnly, setOutstandingOnly] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [billingFilter, setBillingFilter] = useState<BillingFilter>('all');
    const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [sortField, setSortField] = useState<'party_name' | 'outstanding' | 'unbilled_amount' | 'total_cns_amount'>('total_cns_amount');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);

    const fetchLedger = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (branchFilter !== 'all') params.set('branch', branchFilter);
            if (outstandingOnly) params.set('has_outstanding', 'true');
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            if (billingFilter !== 'all') params.set('billing_status', billingFilter);
            if (paymentFilter !== 'all') params.set('payment_status', paymentFilter);

            const res = await fetch(`/api/ledger/summary?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setParties(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [branchFilter, outstandingOnly, dateFrom, dateTo, billingFilter, paymentFilter]);

    useEffect(() => { fetchLedger(); }, [fetchLedger]);

    useEffect(() => {
        fetch('/api/references/branches')
            .then(r => r.json())
            .then((data: { code: string; name: string }[]) => {
                setBranchOptions(data.map(b => ({ value: b.code, label: `${b.code} - ${b.name}` })));
            })
            .catch(console.error);
    }, []);

    const filtered = useMemo(() => {
        let list = parties.filter(hasLedgerActivity);
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(p =>
                p.party_name.toLowerCase().includes(q) ||
                p.party_code.toLowerCase().includes(q)
            );
        }
        list.sort((a, b) => {
            const va = a[sortField];
            const vb = b[sortField];
            if (typeof va === 'string' && typeof vb === 'string') {
                return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            const na = Number(va);
            const nb = Number(vb);
            return sortDir === 'asc' ? na - nb : nb - na;
        });
        return list;
    }, [parties, searchTerm, sortField, sortDir]);

    const totals = useMemo(() => ({
        cns: filtered.reduce((s, p) => s + (p.total_cns_amount || 0), 0),
        billed: filtered.reduce((s, p) => s + (p.total_billed || 0), 0),
        unbilled: filtered.reduce((s, p) => s + (p.unbilled_amount || 0), 0),
        overbilled: filtered.reduce((s, p) => s + (p.overbilled_amount || 0), 0),
        outstanding: filtered.reduce((s, p) => s + (p.outstanding || 0), 0),
    }), [filtered]);

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const SortIcon = ({ field }: { field: typeof sortField }) => (
        <ArrowUpDown className={`h-3.5 w-3.5 ml-1 inline ${sortField === field ? 'text-primary' : 'text-muted-foreground/40'}`} />
    );

    const activeFilterCount = [
        branchFilter !== 'all',
        outstandingOnly,
        !!dateFrom,
        !!dateTo,
        billingFilter !== 'all',
        paymentFilter !== 'all',
    ].filter(Boolean).length;

    const resetFilters = () => {
        setSearchTerm('');
        setBranchFilter('all');
        setOutstandingOnly(false);
        setDateFrom('');
        setDateTo('');
        setBillingFilter('all');
        setPaymentFilter('all');
    };

    const handleExportPdf = async () => {
        setIsPdfExporting(true);
        try {
            // Build a human-readable period label
            let periodLabel = 'All Time';
            if (dateFrom && dateTo) {
                const fmtD = (s: string) => {
                    const [y, m, d] = s.split('-');
                    return `${d}/${m}/${y}`;
                };
                periodLabel = `${fmtD(dateFrom)} – ${fmtD(dateTo)}`;
            } else if (dateFrom) {
                const fmtD = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
                periodLabel = `From ${fmtD(dateFrom)}`;
            } else if (dateTo) {
                const fmtD = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
                periodLabel = `Up to ${fmtD(dateTo)}`;
            }

            const now = new Date();
            const generatedAt = now.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true,
            });

            await downloadLedgerSummaryPdf({
                rows: filtered.map(p => ({
                    party_code: p.party_code,
                    party_name: p.party_name,
                    party_type: p.party_type,
                    branch_code: p.branch_code,
                    total_cns_count: p.total_cns_count,
                    total_cns_amount: p.total_cns_amount,
                    total_billed: p.total_billed,
                    unbilled_amount: p.unbilled_amount,
                    overbilled_amount: p.overbilled_amount ?? 0,
                    total_paid: p.total_paid,
                    outstanding: p.outstanding,
                })),
                periodLabel,
                filters: {
                    branch: branchFilter !== 'all' ? branchFilter : undefined,
                    billingStatus: billingFilter !== 'all' ? billingFilter : undefined,
                    paymentStatus: paymentFilter !== 'all' ? paymentFilter : undefined,
                    outstandingOnly,
                },
                generatedAt,
            });
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setIsPdfExporting(false);
        }
    };

    return (
        <div className="p-6 space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <BookOpen className="h-6 w-6 text-primary" />
                        Party Ledger Book
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Track CNS billing, payments, and outstanding for all parties
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start">
                    <Button variant="outline" size="sm" onClick={fetchLedger} className="gap-2">
                        <RotateCcw className="h-4 w-4" /> Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleExportPdf}
                        disabled={isPdfExporting || filtered.length === 0}
                        className="gap-2"
                    >
                        {isPdfExporting
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Download className="h-4 w-4" />}
                        {isPdfExporting ? 'Exporting…' : 'Export PDF'}
                    </Button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-none shadow-md bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Total CNS Amount</p>
                                <p className="text-lg font-black text-foreground">₹{fmt(totals.cns)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                <TrendingUp className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Total Billed</p>
                                <p className="text-lg font-black text-emerald-700">₹{fmt(totals.billed)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                                <AlertCircle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Unbilled Amount</p>
                                <p className="text-lg font-black text-amber-700">₹{fmt(totals.unbilled)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                                <DollarSign className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Total Outstanding</p>
                                <p className={`text-lg font-black ${totals.outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                    ₹{fmt(totals.outstanding)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Bar */}
            <Card className="border shadow-sm bg-card/60 backdrop-blur-xl border-border/40">
                <CardContent className="p-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search party name or code..."
                                className="pl-9 h-9"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={branchFilter} onValueChange={setBranchFilter}>
                            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Branch" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Branches</SelectItem>
                                {branchOptions.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant={outstandingOnly ? 'default' : 'outline'} size="sm" className="h-9" onClick={() => setOutstandingOnly(o => !o)}>
                            <Filter className="h-3.5 w-3.5 mr-2" /> Outstanding Only
                        </Button>
                        {(activeFilterCount > 0 || searchTerm) && (
                            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground ml-auto" onClick={resetFilters}>
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                                {activeFilterCount > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{activeFilterCount}</Badge>
                                )}
                            </Button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 border-t pt-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Date Range</span>
                            <Input type="date" className="h-9 w-36 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                            <span className="text-muted-foreground text-xs">–</span>
                            <Input type="date" className="h-9 w-36 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                        </div>
                        <Select value={billingFilter} onValueChange={v => setBillingFilter(v as BillingFilter)}>
                            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Billing Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Billing</SelectItem>
                                <SelectItem value="has_bills">Has Bills</SelectItem>
                                <SelectItem value="no_bills">No Bills</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={paymentFilter} onValueChange={v => setPaymentFilter(v as PaymentFilter)}>
                            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Payment Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Payments</SelectItem>
                                <SelectItem value="has_payments">Has Payments</SelectItem>
                                <SelectItem value="no_payments">No Payments</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Party Table */}
            <Card className="border shadow-lg overflow-hidden bg-card/60 backdrop-blur-xl border-border/40">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/40 border-b">
                                <TableRow>
                                    <TableHead className="font-bold py-4 w-24">Code</TableHead>
                                    <TableHead className="font-bold py-4 cursor-pointer" onClick={() => toggleSort('party_name')}>Party <SortIcon field="party_name" /></TableHead>
                                    <TableHead className="font-bold py-4 text-right cursor-pointer" onClick={() => toggleSort('total_cns_amount')}>CNS Amount <SortIcon field="total_cns_amount" /></TableHead>
                                    <TableHead className="font-bold py-4 text-right">Billed</TableHead>
                                    <TableHead className="font-bold py-4 text-right cursor-pointer" onClick={() => toggleSort('unbilled_amount')}>Unbilled <SortIcon field="unbilled_amount" /></TableHead>
                                    <TableHead className="font-bold py-4 text-right">Paid</TableHead>
                                    <TableHead className="font-bold py-4 text-right cursor-pointer" onClick={() => toggleSort('outstanding')}>Outstanding <SortIcon field="outstanding" /></TableHead>
                                    <TableHead className="py-4 text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">Loading ledger data...</TableCell></TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-40">
                                                <BookOpen className="h-10 w-10 text-muted-foreground" />
                                                <p className="text-sm font-medium">No parties found</p>
                                                {activeFilterCount > 0 && <p className="text-xs">Try adjusting your filters</p>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.map(p => (
                                    <TableRow key={p.party_id} className="hover:bg-primary/5 transition-colors border-b last:border-0 group">
                                        <TableCell><span className="font-mono font-bold text-primary text-xs">{p.party_code}</span></TableCell>
                                        <TableCell>
                                            <div className="font-semibold text-sm">{p.party_name}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize h-4">{p.party_type}</Badge>
                                                {p.phone && <span className="text-[10px] text-muted-foreground">{p.phone}</span>}
                                                <span className="text-[10px] text-muted-foreground font-mono">{p.total_cns_count} CNS</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="font-mono font-bold text-sm">₹{fmt(p.total_cns_amount)}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {Number(p.total_billed || 0) > 0 ? (
                                                <span className="font-mono font-bold text-sm text-emerald-700">₹{fmt(p.total_billed)}</span>
                                            ) : (
                                                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Not Billed</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(p.unbilled_amount || 0) > 0 ? (
                                                <span className="font-mono font-bold text-sm text-amber-700 bg-amber-50 px-2 py-0.5 rounded">₹{fmt(p.unbilled_amount)}</span>
                                            ) : (p.overbilled_amount || 0) > 0 ? (
                                                <span className="font-mono font-bold text-sm text-red-700 bg-red-50 px-2 py-0.5 rounded">OB ₹{fmt(p.overbilled_amount || 0)}</span>
                                            ) : (
                                                <span className="text-muted-foreground/40 text-xs">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {Number(p.total_paid || 0) > 0 ? (
                                                <span className="font-mono font-bold text-sm text-indigo-700">₹{fmt(p.total_paid)}</span>
                                            ) : (
                                                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">No Payment</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(p.outstanding || 0) > 0 ? (
                                                <span className="font-mono font-bold text-sm text-red-700 bg-red-50 px-2 py-0.5 rounded">₹{fmt(p.outstanding)}</span>
                                            ) : (p.outstanding || 0) < 0 ? (
                                                <span className="font-mono font-bold text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Cr ₹{fmt(Math.abs(p.outstanding))}</span>
                                            ) : (
                                                <span className="font-mono text-sm text-emerald-700">NIL</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link href={`/dashboard/ledger/${p.party_id}`}>
                                                <Button size="sm" variant="ghost" className="h-8 gap-1 text-primary hover:bg-primary/10">Ledger <ChevronRight className="h-3.5 w-3.5" /></Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Footer totals row */}
                    {filtered.length > 0 && (
                        <div className="px-6 py-4 border-t bg-muted/20 grid grid-cols-8 gap-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            <div className="col-span-2">Total ({filtered.length} parties)</div>
                            <div className="text-right font-mono text-foreground">₹{fmt(totals.cns)}</div>
                            <div className="text-right font-mono text-emerald-700">₹{fmt(totals.billed)}</div>
                            <div className="text-right font-mono text-amber-700">₹{fmt(totals.unbilled)}</div>
                            <div className="text-right font-mono text-indigo-700">₹{fmt(filtered.reduce((s, p) => s + (p.total_paid || 0), 0))}</div>
                            <div className={`text-right font-mono ${totals.outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>₹{fmt(totals.outstanding)}</div>
                            <div></div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
