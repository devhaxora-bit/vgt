'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Banknote, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { PartyAutocomplete } from '@/components/PartyAutocomplete';
import { AddPaymentDialog } from '@/components/features/ledger/AddPaymentDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Party } from '@/lib/types/party.types';
import {
    type BillingRecord,
    type PaymentReceipt,
} from '@/lib/ledgerUi';

export default function CreatePaymentPage() {
    const router = useRouter();
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [partyInput, setPartyInput] = useState('');
    const [loadingParty, setLoadingParty] = useState(false);
    const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
    const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceipt[]>([]);
    const [ledgerError, setLedgerError] = useState<string | null>(null);
    const [formKey, setFormKey] = useState(0);

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

    const partyLabel = useMemo(() => {
        if (!selectedParty) return '';
        return selectedParty.code ? `${selectedParty.name} (${selectedParty.code})` : selectedParty.name;
    }, [selectedParty]);

    const partyField = (
        <div className="space-y-2">
            <PartyAutocomplete
                value={partyInput}
                placeholder="Search party by name or code…"
                onValueChange={(value) => {
                    setPartyInput(value);
                    if (!value.trim()) {
                        setSelectedParty(null);
                        setBillingRecords([]);
                        setPaymentReceipts([]);
                        setLedgerError(null);
                    }
                }}
                onSelect={handlePartySelect}
            />
            {selectedParty && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{selectedParty.code || 'No code'}</Badge>
                    <span>{selectedParty.name}</span>
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
        </div>
    );

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Banknote className="h-6 w-6 text-primary" /> Create Payment
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Fill the payment form — pick the party inside, link bills, and save.
                    </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/payment-entry">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Payment Entry
                    </Link>
                </Button>
            </div>

            <AddPaymentDialog
                key={formKey}
                open
                variant="inline"
                partyId={selectedParty?.id || ''}
                partyLabel={partyLabel || undefined}
                billingRecords={ledgerError ? [] : billingRecords}
                paymentReceipts={ledgerError ? [] : paymentReceipts}
                partyField={partyField}
                onClose={() => undefined}
                onSuccess={() => {
                    toast.success('Payment recorded');
                    router.push('/dashboard/payment-entry');
                }}
            />
        </div>
    );
}
