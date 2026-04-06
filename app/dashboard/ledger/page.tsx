'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Search,
    BookOpen,
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertCircle,
    Building2,
    RotateCcw,
    ChevronRight,
    Package,
    Filter,
    ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
    outstanding: number;
}

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

export default function LedgerPage() {
    const [parties, setParties] = useState<LedgerParty[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('all');
    const [outstandingOnly, setOutstandingOnly] = useState(false);
    const [sortField, setSortField] = useState<'party_name' | 'outstanding' | 'unbilled_amount' | 'total_cns_amount'>('total_cns_amount');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);

    const fetchLedger = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (branchFilter !== 'all') params.set('branch', branchFilter);
            if (outstandingOnly) params.set('has_outstanding', 'true');
            const res = await fetch(`/api/ledger/summary?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setParties(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchLedger(); }, [branchFilter, outstandingOnly]);

    useEffect(() => {
        fetch('/api/references/branches')
            .then(r => r.json())
            .then((data: { code: string; name: string }[]) => {
                setBranchOptions(data.map(b => ({ value: b.code, label: `${b.code} - ${b.name}` })));
            })
            .catch(console.error);
    }, []);

    const filtered = useMemo(() => {
        let list = [...parties];
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
        outstanding: filtered.reduce((s, p) => s + (p.outstanding || 0), 0),
    }), [filtered]);

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const SortIcon = ({ field }: { field: typeof sortField }) => (
        <ArrowUpDown className={`h-3.5 w-3.5 ml-1 inline ${sortField === field ? 'text-primary' : 'text-muted-foreground/40'}`} />
    );

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
                <Button variant="outline" size="sm" onClick={fetchLedger} className="gap-2 self-start">
                    <RotateCcw className="h-4 w-4" /> Refresh
                </Button>
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
                                <p className="text-[10px] text-muted-foreground">{filtered.length} parties</p>
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
                <CardContent className="p-4">
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
                            <SelectTrigger className="h-9 w-48">
                                <SelectValue placeholder="All Branches" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Branches</SelectItem>
                                {branchOptions.map(b => (
                                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            variant={outstandingOnly ? 'default' : 'outline'}
                            size="sm"
                            className="h-9 gap-2"
                            onClick={() => setOutstandingOnly(o => !o)}
                        >
                            <Filter className="h-3.5 w-3.5" />
                            Outstanding Only
                        </Button>

                        {(searchTerm || branchFilter !== 'all' || outstandingOnly) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 text-muted-foreground"
                                onClick={() => { setSearchTerm(''); setBranchFilter('all'); setOutstandingOnly(false); }}
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Party Table */}
            <Card className="border shadow-lg overflow-hidden bg-card/60 backdrop-blur-xl border-border/40">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-6">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Party Ledger ({filtered.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/40 border-b">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-bold py-4 w-24">Code</TableHead>
                                    <TableHead
                                        className="font-bold py-4 cursor-pointer select-none"
                                        onClick={() => toggleSort('party_name')}
                                    >
                                        Party Name <SortIcon field="party_name" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 text-right cursor-pointer select-none"
                                        onClick={() => toggleSort('total_cns_amount')}
                                    >
                                        CNS Amount <SortIcon field="total_cns_amount" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 text-right">Billed</TableHead>
                                    <TableHead
                                        className="font-bold py-4 text-right cursor-pointer select-none"
                                        onClick={() => toggleSort('unbilled_amount')}
                                    >
                                        Unbilled <SortIcon field="unbilled_amount" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 text-right">Paid</TableHead>
                                    <TableHead
                                        className="font-bold py-4 text-right cursor-pointer select-none"
                                        onClick={() => toggleSort('outstanding')}
                                    >
                                        Outstanding <SortIcon field="outstanding" />
                                    </TableHead>
                                    <TableHead className="py-4 text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            Loading ledger data...
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-40">
                                                <BookOpen className="h-10 w-10 text-muted-foreground" />
                                                <p className="text-sm font-medium">No parties found</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map(p => (
                                        <TableRow key={p.party_id} className="hover:bg-primary/5 transition-colors border-b last:border-0 group">
                                            <TableCell>
                                                <span className="font-mono font-bold text-primary text-xs">
                                                    {p.party_code}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-semibold text-sm">{p.party_name}</div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize h-4">
                                                        {p.party_type}
                                                    </Badge>
                                                    {p.phone && (
                                                        <span className="text-[10px] text-muted-foreground">{p.phone}</span>
                                                    )}
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {p.total_cns_count} CNS
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="font-mono font-bold text-sm text-foreground">
                                                    ₹{fmt(p.total_cns_amount)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="font-mono font-bold text-sm text-emerald-700">
                                                    ₹{fmt(p.total_billed)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(p.unbilled_amount || 0) > 0 ? (
                                                    <span className="font-mono font-bold text-sm text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                                        ₹{fmt(p.unbilled_amount)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/40 text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="font-mono font-bold text-sm text-indigo-700">
                                                    ₹{fmt(p.total_paid)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(p.outstanding || 0) > 0 ? (
                                                    <span className="font-mono font-bold text-sm text-red-700 bg-red-50 px-2 py-0.5 rounded">
                                                        ₹{fmt(p.outstanding)}
                                                    </span>
                                                ) : (p.outstanding || 0) < 0 ? (
                                                    <span className="font-mono font-bold text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                                        Cr ₹{fmt(Math.abs(p.outstanding))}
                                                    </span>
                                                ) : (
                                                    <span className="font-mono text-sm text-emerald-700">NIL</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link href={`/dashboard/ledger/${p.party_id}`}>
                                                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-primary hover:bg-primary/10">
                                                        Ledger <ChevronRight className="h-3.5 w-3.5" />
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
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
                            <div className="text-right font-mono text-indigo-700">—</div>
                            <div className={`text-right font-mono ${totals.outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                ₹{fmt(totals.outstanding)}
                            </div>
                            <div></div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
