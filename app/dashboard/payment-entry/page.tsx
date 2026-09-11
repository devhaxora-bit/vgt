'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Banknote, Loader2, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { PartyAutocomplete } from '@/components/PartyAutocomplete';
import { AddPaymentDialog } from '@/components/features/ledger/AddPaymentDialog';
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
    type BillingRecord,
    type PaymentReceipt,
} from '@/lib/ledgerUi';

type PaymentListRow = {
    id: string;
    party_id: string;
    party_name: string;
    party_code: string;
    receipt_date: string;
    amount: number;
    actual_received_amount?: number;
    payment_mode: string;
    reference_no?: string;
    bank_name?: string;
    narration?: string;
    status: string;
};

const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
};

export default function PaymentEntryPage() {
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [partyInput, setPartyInput] = useState('');
    const [loadingParty, setLoadingParty] = useState(false);
    const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
    const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceipt[]>([]);
    const [payments, setPayments] = useState<PaymentListRow[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [ledgerError, setLedgerError] = useState<string | null>(null);
    const [formKey, setFormKey] = useState(0);

    const loadPayments = useCallback(async () => {
        setPaymentsLoading(true);
        try {
            const params = new URLSearchParams({ limit: '200' });
            if (search.trim()) params.set('search', search.trim());
            const res = await fetch(`/api/ledger/payments?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to load payments');
            const json = await res.json();
            setPayments(Array.isArray(json.data) ? json.data : []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load payments list');
        } finally {
            setPaymentsLoading(false);
        }
    }, [search]);

    useEffect(() => {
        void loadPayments();
    }, [loadPayments]);

    const loadPartyLedger = useCallback(async (partyId: string) => {
        setLoadingParty(true);
        setLedgerError(null);
        try {
            const res = await fetch(`/api/ledger/${partyId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load party ledger');
            if (!json.account) {
                setLedgerError('This party has no ledger account yet. Open Party Ledger Book once to create it, then return here.');
                setBillingRecords([]);
                setPaymentReceipts([]);
                return;
            }

            setBillingRecords(json.all_billing_records || json.billing_records || []);
            setPaymentReceipts(json.all_payment_receipts || json.payment_receipts || []);
            setFormKey((key) => key + 1);
        } catch (err) {
            setLedgerError(err instanceof Error ? err.message : 'Failed to load party');
            setBillingRecords([]);
            setPaymentReceipts([]);
        } finally {
            setLoadingParty(false);
        }
    }, []);

    const handlePartySelect = (party: Party | null) => {
        if (!party || party.id === 'new') {
            setSelectedParty(null);
            setBillingRecords([]);
            setPaymentReceipts([]);
            setLedgerError(party?.id === 'new' ? 'Select an existing party to record a payment.' : null);
            return;
        }
        setSelectedParty(party);
        setPartyInput(party.name);
        void loadPartyLedger(party.id);
    };

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
                        <Banknote className="h-6 w-6 text-primary" /> Payment Entry
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Select any party, link unpaid bills, and record a receipt. All payments are listed below.
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
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => {
                                    setSelectedParty(null);
                                    setPartyInput('');
                                    setBillingRecords([]);
                                    setPaymentReceipts([]);
                                    setLedgerError(null);
                                }}
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
                            </Button>
                        </div>
                    )}
                    {loadingParty && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading party payment data…
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
                <AddPaymentDialog
                    key={formKey}
                    open
                    variant="inline"
                    partyId={selectedParty.id}
                    partyLabel={partyLabel}
                    billingRecords={billingRecords}
                    paymentReceipts={paymentReceipts}
                    onClose={() => undefined}
                    onSuccess={() => {
                        void loadPartyLedger(selectedParty.id);
                        void loadPayments();
                    }}
                />
            )}

            {!selectedParty && (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        Choose a party above to open the payment entry form.
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-base">All Payments</CardTitle>
                        <div className="flex gap-2">
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="h-9 pl-8"
                                    placeholder="Search party / UTR / mode…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={() => void loadPayments()} disabled={paymentsLoading}>
                                {paymentsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
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
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paymentsLoading && payments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                                            Loading payments…
                                        </TableCell>
                                    </TableRow>
                                ) : payments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                                            No payments found
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
                                            {payment.party_id ? (
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/dashboard/ledger/${payment.party_id}`}>Ledger</Link>
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
