'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { composeBillRefNo, getBillRefPrefix } from '@/lib/billRef';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BillingConsignmentPicker } from '@/components/features/ledger/BillingConsignmentPicker';
import { BillingVehicleCancelEditor } from '@/components/features/ledger/BillingVehicleCancelEditor';
import {
    sumVehicleCancelCharges,
    validateVehicleCancelDrafts,
    vehicleCancelDraftToItems,
    type BillingVehicleCancelDraftItem,
} from '@/lib/billingVehicleCancel';
import {
    buildConsignmentBreakup,
    fmtMoney as fmt,
    parseMoney,
    roundMoney,
    type LedgerConsignment,
} from '@/lib/ledgerUi';

// ─── AddBillingDialog ─────────────────────────────────────────────────────────

export function AddBillingDialog({
    open, onClose, partyId, onSuccess, consignments,
    variant = 'dialog',
    partyLabel,
    relatedChallanNos = [],
    onCoveredCnNosChange,
    partyField,
}: {
    open: boolean;
    onClose: () => void;
    partyId: string;
    onSuccess: () => void;
    consignments: LedgerConsignment[];
    variant?: 'dialog' | 'inline';
    partyLabel?: string;
    relatedChallanNos?: string[];
    onCoveredCnNosChange?: (cnNos: string[]) => void;
    /** Optional party picker rendered at the top of the form (create pages). */
    partyField?: React.ReactNode;
}) {

    const emptyForm = () => ({
        billing_date: new Date().toISOString().split('T')[0],
        billing_period_from: '',
        billing_period_to: '',
        amount: '',
        bill_ref_no: '',
        narration: '',
        covered_cn_nos: [] as string[],
        vehicle_cancel_items: [] as BillingVehicleCancelDraftItem[],
    });
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const lastAutoPrefixRef = useRef('');

    useEffect(() => {
        if (!open) {
            lastAutoPrefixRef.current = '';
            return;
        }
        lastAutoPrefixRef.current = '';
        setForm(emptyForm());
    }, [open, partyId]);

    useEffect(() => {
        if (!open || !partyId) return;
        const date = form.billing_date;
        const prefix = getBillRefPrefix(date);
        if (lastAutoPrefixRef.current && lastAutoPrefixRef.current === prefix) return;

        let cancelled = false;
        void (async () => {
            try {
                const res = await fetch(`/api/ledger/${partyId}/billing/next-ref?date=${encodeURIComponent(date)}`);
                if (!res.ok || cancelled) return;
                const json = await res.json() as { next_suffix: string };
                if (cancelled) return;
                lastAutoPrefixRef.current = prefix;
                setForm((f) => (
                    getBillRefPrefix(f.billing_date) === prefix
                        ? { ...f, bill_ref_no: json.next_suffix }
                        : f
                ));
            } catch {
                // silently fail — user can enter manually
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, partyId, form.billing_date]);

    const consignmentBreakup = useMemo(
        () => buildConsignmentBreakup(consignments, form.covered_cn_nos),
        [consignments, form.covered_cn_nos]
    );
    const billRefPrefix = useMemo(
        () => getBillRefPrefix(form.billing_date),
        [form.billing_date]
    );

    const enteredOtherChargeAmount = roundMoney(parseMoney(form.amount));
    const vehicleCancelTotal = sumVehicleCancelCharges(vehicleCancelDraftToItems(form.vehicle_cancel_items));
    const suggestedBillTotal = consignmentBreakup.cnChargeTotal;
    const displayedExtraChargeTotal = roundMoney(consignmentBreakup.otherChargeTotal + enteredOtherChargeAmount);
    const finalBillAmount = roundMoney(consignmentBreakup.cnChargeTotal + enteredOtherChargeAmount + vehicleCancelTotal);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!partyId) {
            toast.error('Select a party first');
            return;
        }
        if (!form.bill_ref_no.trim()) {
            toast.error('Bill No is required');
            return;
        }

        const vehicleCancelValidationError = validateVehicleCancelDrafts(form.vehicle_cancel_items);
        if (vehicleCancelValidationError) {
            toast.error(vehicleCancelValidationError);
            return;
        }

        if (finalBillAmount <= 0) {
            toast.error('Bill amount must be greater than zero');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/ledger/${partyId}/billing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    billing_date: form.billing_date,
                    billing_period_from: form.billing_period_from || null,
                    billing_period_to: form.billing_period_to || null,
                    bill_ref_no: composeBillRefNo(form.billing_date, form.bill_ref_no),
                    narration: form.narration,
                    added_other_charges_amount: enteredOtherChargeAmount,
                    vehicle_cancel_items: vehicleCancelDraftToItems(form.vehicle_cancel_items),
                    covered_cn_nos: form.covered_cn_nos.length > 0 ? form.covered_cn_nos : null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create billing record');
            }
            toast.success('Billing record created successfully');
            onSuccess();
            onClose();
            setForm(emptyForm());
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to create billing record');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const title = partyLabel ? `Generate Bill — ${partyLabel}` : 'Create Bill';
    const description = 'Select the party, cover unbilled CNs, set bill details, and save.';

    const formBody = (
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="grid gap-6 p-6 lg:grid-cols-[1.05fr_0.95fr]">
                        <div className="space-y-4">
                            {partyField ? (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Party *</Label>
                                    {partyField}
                                </div>
                            ) : null}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Billing Date *</Label>
                                    <Input type="date" value={form.billing_date} onChange={e => setForm(f => ({ ...f, billing_date: e.target.value }))} className="h-9" required />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Bill No *</Label>
                                    <div className="flex h-9 overflow-hidden rounded-md border bg-background shadow-sm">
                                        <div className="flex items-center border-r bg-muted/40 px-3 text-xs font-bold text-muted-foreground">
                                            {billRefPrefix}
                                        </div>
                                        <Input
                                            placeholder="Enter bill number"
                                            value={form.bill_ref_no}
                                            onChange={e => setForm(f => ({ ...f, bill_ref_no: e.target.value }))}
                                            className="h-full border-0 shadow-none focus-visible:ring-0"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>


                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Period From</Label>
                                    <Input type="date" value={form.billing_period_from} onChange={e => setForm(f => ({ ...f, billing_period_from: e.target.value }))} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Period To</Label>
                                    <Input type="date" value={form.billing_period_to} onChange={e => setForm(f => ({ ...f, billing_period_to: e.target.value }))} className="h-9" />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Add In Other Charges (₹)</Label>
                                    <Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="h-9 font-mono" />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setForm((current) => ({ ...current, amount: '' }))}
                                >
                                    Use CN Total
                                </Button>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Description</Label>
                                <Input placeholder="Optional description" value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))} className="h-9" />
                            </div>

                            <BillingVehicleCancelEditor
                                items={form.vehicle_cancel_items}
                                onChange={(vehicle_cancel_items) => setForm((current) => ({ ...current, vehicle_cancel_items }))}
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Covered CNs</Label>
                                {!partyId ? (
                                    <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                                        Select a party to load unbilled CNs.
                                    </div>
                                ) : (
                                    <BillingConsignmentPicker
                                        consignments={consignments}
                                        value={form.covered_cn_nos}
                                        onChange={(covered_cn_nos) => {
                                            setForm((f) => ({ ...f, covered_cn_nos }));
                                            onCoveredCnNosChange?.(covered_cn_nos);
                                        }}
                                    />
                                )}
                            </div>

                            {relatedChallanNos.length > 0 && (
                                <div className="rounded-lg border bg-muted/10 px-4 py-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Related Challans</div>
                                    <div className="mt-1 text-sm font-mono break-words">{relatedChallanNos.join(', ')}</div>
                                    <div className="mt-1 text-[11px] text-muted-foreground">Shown from challans linked to the selected CNs (informational).</div>
                                </div>
                            )}

                            <div className="rounded-lg border bg-muted/10">
                                <div className="border-b px-4 py-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Bill Breakup Preview</div>
                                    <div className="text-xs text-muted-foreground">Every freight-detail charge from the selected CNs is shown below. The entered amount is added on top and shown inside bill other charges.</div>
                                </div>
                                <div className="space-y-2 p-4 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">CN Freight</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.freightTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Unloading Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.unloadingTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Detention Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.detentionTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Extra KM Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.extraKmTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Loading Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.loadingChargeTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Door Coll Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.doorCollectionTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Door Del Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.doorDeliveryTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Traffic Challan Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.trafficChallanTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Other Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.otherChargeTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Added Other Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(enteredOtherChargeAmount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Vehicle Cancellation Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(vehicleCancelTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Bill Other Charges Column</span>
                                        <span className="font-mono font-semibold">₹{fmt(displayedExtraChargeTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">CN Total</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.cnChargeTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-t pt-2 font-bold">
                                        <span>Final Bill Amount</span>
                                        <span className="font-mono text-emerald-700">₹{fmt(finalBillAmount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">CN Total Without Added Amount</span>
                                        <span className="font-mono text-emerald-700">₹{fmt(suggestedBillTotal)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-4">
                        {variant === 'dialog' && (
                            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        )}
                        <Button type="submit" disabled={saving || !partyId} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Generate Bill
                        </Button>
                    </div>
                </form>
    );

    if (variant === 'inline') {
        return (
            <Card className="overflow-hidden border shadow-sm">
                <CardHeader className="border-b bg-slate-50">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4 text-primary" /> {title}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">{formBody}</CardContent>
            </Card>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-[95vw] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50">
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> {title}
                    </DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {formBody}
            </DialogContent>
        </Dialog>
    );
}

// ─── AddPaymentDialog ─────────────────────────────────────────────────────────

