'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PartyOption {
    id: string;
    name: string;
    code: string;
}

type BillPreview = {
    exclusive_payment_count: number;
    blocked_payment_count: number;
};

export function ReassignPartyDialog({
    open,
    onClose,
    title,
    description,
    currentPartyId,
    recordKind,
    previewUrl,
    onConfirm,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description: string;
    currentPartyId: string;
    recordKind: 'bill' | 'payment';
    previewUrl?: string;
    onConfirm: (newPartyId: string, newPartyName: string, confirmMovePayments: boolean) => Promise<void>;
}) {
    const [search, setSearch] = useState('');
    const [parties, setParties] = useState<PartyOption[]>([]);
    const [loadingParties, setLoadingParties] = useState(false);
    const [selected, setSelected] = useState<PartyOption | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [preview, setPreview] = useState<BillPreview | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    useEffect(() => {
        if (!open) {
            setSearch('');
            setSelected(null);
            setParties([]);
            setConfirmed(false);
            setPreview(null);
            setPreviewError(null);
        }
    }, [open]);

    useEffect(() => {
        setConfirmed(false);
    }, [selected?.id]);

    useEffect(() => {
        if (!open) return;
        const q = search.trim();
        if (q.length < 1) {
            setParties([]);
            setLoadingParties(false);
            return;
        }
        setLoadingParties(true);
        const timer = setTimeout(() => {
            void fetch(`/api/query/parties?q=${encodeURIComponent(q)}`)
                .then((r) => r.json())
                .then((json: PartyOption[] | { error?: string }) => {
                    const list = Array.isArray(json) ? json : [];
                    setParties(list.filter((p) => p.id !== currentPartyId));
                })
                .catch(console.error)
                .finally(() => setLoadingParties(false));
        }, 300);
        return () => {
            clearTimeout(timer);
            setLoadingParties(false);
        };
    }, [open, search, currentPartyId]);

    useEffect(() => {
        if (!open || recordKind !== 'bill' || !previewUrl) {
            return;
        }

        let cancelled = false;
        setLoadingPreview(true);
        setPreviewError(null);

        void fetch(previewUrl)
            .then(async (response) => {
                const json = await response.json() as BillPreview & { error?: string };
                if (!response.ok) {
                    throw new Error(json.error || 'Failed to load linked payments');
                }
                return json;
            })
            .then((json) => {
                if (cancelled) return;
                setPreview({
                    exclusive_payment_count: json.exclusive_payment_count || 0,
                    blocked_payment_count: json.blocked_payment_count || 0,
                });
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                setPreview(null);
                setPreviewError(error instanceof Error ? error.message : 'Failed to load linked payments');
            })
            .finally(() => {
                if (!cancelled) setLoadingPreview(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, recordKind, previewUrl]);

    const exclusivePaymentCount = preview?.exclusive_payment_count || 0;
    const blockedPaymentCount = preview?.blocked_payment_count || 0;
    const billHasPayments = recordKind === 'bill' && exclusivePaymentCount > 0;
    const billBlocked = recordKind === 'bill' && blockedPaymentCount > 0;
    const previewReady = recordKind !== 'bill' || (!loadingPreview && !previewError && preview !== null && !billBlocked);
    const requiresConfirm = billHasPayments;

    const submitLabel = recordKind === 'payment'
        ? 'Move payment'
        : billHasPayments
            ? 'Move bill and payments'
            : 'Move bill';

    const handleConfirm = async () => {
        if (!selected || !previewReady) return;
        if (requiresConfirm && !confirmed) return;
        setSaving(true);
        try {
            await onConfirm(selected.id, selected.name, billHasPayments);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-700">
                        <Building2 className="h-4 w-4" /> {title}
                    </DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 mt-1">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search party name or code..."
                            className="pl-9 h-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            disabled={saving}
                        />
                    </div>
                    {loadingParties ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="max-h-60 overflow-y-auto rounded-md border divide-y">
                            {parties.length === 0 ? (
                                <div className="p-4 text-sm text-center text-muted-foreground">
                                    {search.trim() ? 'No parties found' : 'Type a party name or code'}
                                </div>
                            ) : parties.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 transition-colors flex items-center justify-between gap-2 ${selected?.id === p.id ? 'bg-primary/10 font-semibold text-primary' : ''}`}
                                    onClick={() => setSelected(p)}
                                    disabled={saving}
                                >
                                    <span className="truncate">{p.name}</span>
                                    <span className="text-xs font-mono text-muted-foreground shrink-0">{p.code}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {recordKind === 'bill' && loadingPreview && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Checking linked payments...
                        </div>
                    )}
                    {previewError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                            {previewError}
                        </div>
                    )}
                    {billBlocked && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                            {blockedPaymentCount} payment{blockedPaymentCount === 1 ? '' : 's'} linked to this bill also cover other bills. Reverse those payments first, then reassign.
                        </div>
                    )}
                    {selected && previewReady && (
                        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 space-y-2">
                            <p>
                                Reassigning to: <strong>{selected.name}</strong> ({selected.code})
                            </p>
                            {requiresConfirm ? (
                                <>
                                    <p>
                                        This bill already has {exclusivePaymentCount} payment{exclusivePaymentCount === 1 ? '' : 's'}. You cannot move the bill alone — both the bill and those payments must move together. Covered CNs also move to the new party.
                                    </p>
                                    <div className="flex items-start gap-2 pt-1">
                                        <Checkbox
                                            id="reassign-confirm"
                                            checked={confirmed}
                                            onCheckedChange={(value) => setConfirmed(value === true)}
                                            disabled={saving}
                                        />
                                        <Label htmlFor="reassign-confirm" className="text-xs leading-5 font-normal cursor-pointer">
                                            I confirm moving this bill, its covered CNs, and its {exclusivePaymentCount} payment{exclusivePaymentCount === 1 ? '' : 's'}.
                                        </Label>
                                    </div>
                                </>
                            ) : recordKind === 'bill' ? (
                                <p>This bill has no linked payments, so the bill and its covered CNs will move directly.</p>
                            ) : null}
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button
                            onClick={() => void handleConfirm()}
                            disabled={!selected || saving || !previewReady || (requiresConfirm && !confirmed)}
                            className="gap-2 bg-amber-600 hover:bg-amber-700"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {submitLabel}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
