'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { PartyAutocomplete } from '@/components/PartyAutocomplete';
import { AddBillingDialog } from '@/components/features/ledger/AddBillingDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Party } from '@/lib/types/party.types';
import { type LedgerConsignment } from '@/lib/ledgerUi';
import { normalizeCnKey } from '@/lib/utils/cnKey';

export default function CreateBillPage() {
    const router = useRouter();
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [partyInput, setPartyInput] = useState('');
    const [loadingParty, setLoadingParty] = useState(false);
    const [consignments, setConsignments] = useState<LedgerConsignment[]>([]);
    const [relatedChallanNos, setRelatedChallanNos] = useState<string[]>([]);
    const [coveredCnNosWatch, setCoveredCnNosWatch] = useState<string[]>([]);
    const [ledgerError, setLedgerError] = useState<string | null>(null);

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

            if (Array.isArray(json.billable_consignments)) {
                setConsignments(json.billable_consignments);
                setRelatedChallanNos([]);
                setCoveredCnNosWatch([]);
                return;
            }

            // Compatibility fallback for an older API response.
            const allBilling: { status?: string; covered_cn_nos?: string[] }[] =
                Array.isArray(json.all_billing_records) ? json.all_billing_records
                    : Array.isArray(json.billing_records) ? json.billing_records
                        : [];
            const billedCnNos = new Set<string>();
            allBilling.forEach((record) => {
                if (record.status !== 'ACTIVE') return;
                (record.covered_cn_nos || []).forEach((cn) => {
                    const normalized = normalizeCnKey(cn);
                    if (normalized) billedCnNos.add(normalized);
                });
            });
            const allCns: LedgerConsignment[] =
                Array.isArray(json.all_consignments) && json.all_consignments.length > 0
                    ? json.all_consignments
                    : Array.isArray(json.consignments) ? json.consignments : [];
            setConsignments(
                allCns.filter((cn) => !billedCnNos.has(normalizeCnKey(cn.cn_no))),
            );
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
            setRelatedChallanNos([]);
            setCoveredCnNosWatch([]);
            setLedgerError(party?.id === 'new' ? 'Select an existing party to generate a bill.' : null);
            return;
        }
        setSelectedParty(party);
        setPartyInput(party.name);
        void loadPartyLedger(party.id);
    };

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
                        setConsignments([]);
                        setLedgerError(null);
                    }
                }}
                onSelect={handlePartySelect}
            />
            {selectedParty && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{selectedParty.code || 'No code'}</Badge>
                    <span>{selectedParty.name}</span>
                    {selectedParty.gstin ? <span>GSTIN: {selectedParty.gstin}</span> : null}
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
        </div>
    );

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" /> Create Bill
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Fill the bill form — pick the party inside, cover CNs, and save.
                    </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/invoicing">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Bill Entry
                    </Link>
                </Button>
            </div>

            <AddBillingDialog
                open
                variant="inline"
                partyId={selectedParty?.id || ''}
                partyLabel={partyLabel || undefined}
                consignments={ledgerError ? [] : consignments}
                relatedChallanNos={relatedChallanNos}
                onCoveredCnNosChange={setCoveredCnNosWatch}
                partyField={partyField}
                onClose={() => undefined}
                onSuccess={() => {
                    toast.success('Bill created');
                    router.push('/dashboard/invoicing');
                }}
            />
        </div>
    );
}
