'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { FileText, Loader2, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { PartyAutocomplete } from '@/components/PartyAutocomplete';
import { AddBillingDialog } from '@/components/features/ledger/AddBillingDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { Party } from '@/lib/types/party.types';
import {
    fmtMoney,
    type LedgerConsignment,
} from '@/lib/ledgerUi';

type BillListRow = {
    id: string;
    party_id: string;
    party_name: string;
    party_code: string;
    billing_date: string;
    amount: number;
    bill_ref_no?: string;
    covered_cn_nos?: string[];
    status: string;
    narration?: string;
};

const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
};

export default function InvoicingPage() {
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [partyInput, setPartyInput] = useState('');
    const [loadingParty, setLoadingParty] = useState(false);
    const [consignments, setConsignments] = useState<LedgerConsignment[]>([]);
    const [relatedChallanNos, setRelatedChallanNos] = useState<string[]>([]);
    const [coveredCnNosWatch, setCoveredCnNosWatch] = useState<string[]>([]);
    const [bills, setBills] = useState<BillListRow[]>([]);
    const [billsLoading, setBillsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [ledgerError, setLedgerError] = useState<string | null>(null);

    const loadBills = useCallback(async () => {
        setBillsLoading(true);
        try {
            const params = new URLSearchParams({ limit: '200' });
            if (search.trim()) params.set('search', search.trim());
            const res = await fetch(`/api/ledger/bills?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to load bills');
            const json = await res.json();
            setBills(Array.isArray(json.data) ? json.data : []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load bills list');
        } finally {
            setBillsLoading(false);
        }
    }, [search]);

    useEffect(() => {
        void loadBills();
    }, [loadBills]);

    const loadPartyLedger = useCallback(async (partyId: string) => {
        setLoadingParty(true);
        setLedgerError(null);
        try {
            const res = await fetch(`/api/ledger/${partyId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load party ledger');
            if (!json.account) {
                setLedgerError('This party has no ledger account yet. Open Party Ledger Book once to create it, then return here.');
                setConsignments([]);
                return;
            }

            // Use all_billing_records (unfiltered) to know every billed CN for this party.
            const allBilling: { status?: string; covered_cn_nos?: string[] }[] =
                Array.isArray(json.all_billing_records) ? json.all_billing_records
                    : Array.isArray(json.billing_records) ? json.billing_records
                        : [];
            const billedCnNos = new Set<string>();
            allBilling.forEach((record) => {
                if (record.status !== 'ACTIVE') return;
                (record.covered_cn_nos || []).forEach((cn) => {
                    const normalized = String(cn || '').trim().toUpperCase();
                    if (normalized) billedCnNos.add(normalized);
                });
            });
            // Prefer all_consignments (full list) over the date-filtered consignments
            // so unbilled CNs from any period appear for selection.
            const allCns: LedgerConsignment[] =
                Array.isArray(json.all_consignments) && json.all_consignments.length > 0
                    ? json.all_consignments
                    : Array.isArray(json.consignments) ? json.consignments : [];
            const billable = allCns.filter(
                (cn) => !billedCnNos.has(String(cn.cn_no || '').trim().toUpperCase()),
            );

            setConsignments(billable);
            setRelatedChallanNos([]);
            setCoveredCnNosWatch([]);
        } catch (err) {
            setLedgerError(err instanceof Error ? err.message : 'Failed to load party');
            setConsignments([]);
        } finally {
            setLoadingParty(false);
        }
    }, []);

    const handlePartySelect = (party: Party | null) => {
        if (!party || party.id === 'new') {
            setSelectedParty(null);
            setConsignments([]);
            setLedgerError(party?.id === 'new' ? 'Select an existing party to generate a bill.' : null);
            return;
        }
        setSelectedParty(party);
        setPartyInput(party.name);
        void loadPartyLedger(party.id);
    };

    // Resolve related challans when selected covered CNs change inside the bill form.
    useEffect(() => {
        let cancelled = false;
        const loadRelated = async () => {
            if (!selectedParty || coveredCnNosWatch.length === 0) {
                if (!cancelled) setRelatedChallanNos([]);
                return;
            }
            try {
                const res = await fetch(`/api/challans/by-cns?cns=${encodeURIComponent(coveredCnNosWatch.join(','))}`);
                if (!res.ok) return;
                const json = await res.json();
                const nos = (json.data || []).map((row: { challan_no: string }) => row.challan_no).filter(Boolean);
                if (!cancelled) setRelatedChallanNos(Array.from(new Set(nos)));
            } catch {
                if (!cancelled) setRelatedChallanNos([]);
            }
        };
        void loadRelated();
        return () => { cancelled = true; };
    }, [selectedParty, coveredCnNosWatch]);

    const showForm = Boolean(selectedParty && !ledgerError && !loadingParty);

    const partyLabel = useMemo(() => {
        if (!selectedParty) return '';
        return selectedParty.code ? `${selectedParty.name} (${selectedParty.code})` : selectedParty.name;
    }, [selectedParty]);

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" /> Invoicing
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Select any party, link uncovered CNs, and generate a freight bill. All bills are listed below.
                    </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/ledger">Open Party Ledger</Link>
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Party</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="max-w-xl">
                        <PartyAutocomplete
                            value={partyInput}
                            placeholder="Search party by name or code…"
                            onValueChange={setPartyInput}
                            onSelect={handlePartySelect}
                        />
                    </div>
                    {selectedParty && (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary">{selectedParty.code || 'No code'}</Badge>
                            <span>{selectedParty.name}</span>
                            {selectedParty.gstin ? <span>GSTIN: {selectedParty.gstin}</span> : null}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => {
                                    setSelectedParty(null);
                                    setPartyInput('');
                                    setConsignments([]);
                                    setLedgerError(null);
                                }}
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
                            </Button>
                        </div>
                    )}
                    {loadingParty && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading party billing data…
                        </div>
                    )}
                    {ledgerError && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {ledgerError}
                        </div>
                    )}
                </CardContent>
            </Card>

            {showForm && selectedParty && (
                <AddBillingDialog
                    open
                    variant="inline"
                    partyId={selectedParty.id}
                    partyLabel={partyLabel}
                    consignments={consignments}
                    relatedChallanNos={relatedChallanNos}
                    onCoveredCnNosChange={setCoveredCnNosWatch}
                    onClose={() => undefined}
                    onSuccess={() => {
                        void loadPartyLedger(selectedParty.id);
                        void loadBills();
                    }}
                />
            )}

            {!selectedParty && (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        Choose a party above to open the bill generation form.
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-base">All Bills</CardTitle>
                        <div className="flex gap-2">
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="h-9 pl-8"
                                    placeholder="Search bill / party / CN…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={() => void loadBills()} disabled={billsLoading}>
                                {billsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bill No</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Party</TableHead>
                                    <TableHead>Covered CNs</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {billsLoading && bills.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                            Loading bills…
                                        </TableCell>
                                    </TableRow>
                                ) : bills.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                            No bills found
                                        </TableCell>
                                    </TableRow>
                                ) : bills.map((bill) => (
                                    <TableRow key={bill.id}>
                                        <TableCell className="font-mono font-semibold text-primary">
                                            {bill.bill_ref_no || bill.id.slice(0, 8).toUpperCase()}
                                        </TableCell>
                                        <TableCell>{fmtDate(bill.billing_date)}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{bill.party_name}</div>
                                            <div className="text-xs text-muted-foreground">{bill.party_code}</div>
                                        </TableCell>
                                        <TableCell className="max-w-[280px] text-xs font-mono break-words">
                                            {(bill.covered_cn_nos || []).join(', ') || '—'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">
                                            ₹{fmtMoney(bill.amount)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={bill.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                {bill.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {bill.party_id ? (
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/dashboard/ledger/${bill.party_id}`}>Ledger</Link>
                                                </Button>
                                            ) : null}
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
