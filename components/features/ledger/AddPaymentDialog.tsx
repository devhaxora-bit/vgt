'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Banknote, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { BillingExtraChargesEditor, type BillingExtraChargeDraftItem } from '@/components/features/ledger/BillingExtraChargesEditor';
import { BillingRecordPicker } from '@/components/features/ledger/BillingRecordPicker';
import {
    buildSettledBillAmountMap,
    fmtMoney as fmt,
    normalizeExtraChargeDraftItems,
    parseMoney,
    roundMoney,
    type BillingRecord,
    type PaymentReceipt,
} from '@/lib/ledgerUi';

const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
};

// ─── AddPaymentDialog ─────────────────────────────────────────────────────────

export function AddPaymentDialog({
    open, onClose, partyId, onSuccess, billingRecords, paymentReceipts, record,
    variant = 'dialog',
    partyLabel,
    partyField,
}: {
    open: boolean;
    onClose: () => void;
    partyId: string;
    onSuccess: () => void;
    billingRecords: BillingRecord[];
    paymentReceipts: PaymentReceipt[];
    record?: PaymentReceipt | null;
    variant?: 'dialog' | 'inline';
    partyLabel?: string;
    /** Optional party picker rendered at the top of the form (create pages). */
    partyField?: React.ReactNode;
}) {
    interface PaymentBillAllocationDraft {
        billing_record_id: string;
        settled_amount: string;
        deduction_items: BillingExtraChargeDraftItem[];
    }

    const [form, setForm] = useState({
        receipt_date: new Date().toISOString().split('T')[0],
        amount: '', payment_mode: 'NEFT', reference_no: '', bank_name: '', narration: '',
        related_billing_record_ids: [] as string[],
        bill_allocations: [] as PaymentBillAllocationDraft[],
    });
    const [saving, setSaving] = useState(false);
    const isEditing = Boolean(record?.id);

    const emptyForm = {
        receipt_date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_mode: 'NEFT',
        reference_no: '',
        bank_name: '',
        narration: '',
        related_billing_record_ids: [] as string[],
        bill_allocations: [] as PaymentBillAllocationDraft[],
    };

    useEffect(() => {
        if (!open) return;

        if (!record) {
            setForm(emptyForm);
            return;
        }

        const relatedIds = (record.bill_allocations || []).length > 0
            ? (record.bill_allocations || []).map((allocation) => allocation.billing_record_id)
            : (record.related_billing_record_ids || []);

        const allocationDrafts = (record.bill_allocations || []).length > 0
            ? (record.bill_allocations || []).map((allocation) => ({
                billing_record_id: allocation.billing_record_id,
                settled_amount: parseMoney(allocation.settled_amount) > 0 ? parseMoney(allocation.settled_amount).toFixed(2) : '',
                deduction_items: (allocation.deduction_items || []).map((item) => ({
                    id: Math.random().toString(36).slice(2, 10),
                    label: item.label,
                    amount: parseMoney(item.amount) > 0 ? parseMoney(item.amount).toFixed(2) : '',
                })),
            }))
            : relatedIds.map((billId) => ({
                billing_record_id: billId,
                settled_amount: relatedIds.length === 1 && parseMoney(record.amount) > 0
                    ? parseMoney(record.amount).toFixed(2)
                    : '',
                deduction_items: [] as BillingExtraChargeDraftItem[],
            }));

        setForm({
            receipt_date: String(record.receipt_date || '').slice(0, 10) || emptyForm.receipt_date,
            amount: Math.abs(parseMoney(record.amount)) > 0 ? parseMoney(record.amount).toFixed(2) : '',
            payment_mode: record.payment_mode || 'NEFT',
            reference_no: record.reference_no || '',
            bank_name: record.bank_name || '',
            narration: record.narration || '',
            related_billing_record_ids: relatedIds,
            bill_allocations: allocationDrafts,
        });
    }, [open, record]);

    const settledBillAmountMap = useMemo(
        () => buildSettledBillAmountMap(paymentReceipts.filter((receipt) => receipt.id !== record?.id)),
        [paymentReceipts, record?.id]
    );

    const payableBillingRecords = useMemo(
        () => billingRecords
            .filter((record) => record.status === 'ACTIVE')
            .map((record) => {
                const settledAmount = settledBillAmountMap.get(record.id) || 0;
                const remainingAmount = Math.max(roundMoney(parseMoney(record.amount) - settledAmount), 0);

                return {
                    ...record,
                    settled_amount: settledAmount,
                    remaining_amount: remainingAmount,
                };
            })
            .filter((bill) => (
                parseMoney(bill.remaining_amount) > 0.009
                || form.related_billing_record_ids.includes(bill.id)
            )),
        [billingRecords, settledBillAmountMap, form.related_billing_record_ids]
    );

    const payableBillingRecordMap = useMemo(
        () => new Map(payableBillingRecords.map((record) => [record.id, record])),
        [payableBillingRecords]
    );

    const syncBillAllocationDrafts = useCallback((selectedIds: string[], currentDrafts: PaymentBillAllocationDraft[]) => {
        const currentDraftMap = new Map(currentDrafts.map((draft) => [draft.billing_record_id, draft]));

        return selectedIds.map((billId) => {
            const existingDraft = currentDraftMap.get(billId);
            if (existingDraft) return existingDraft;

            const bill = payableBillingRecordMap.get(billId);
            const defaultSettledAmount = Math.max(parseMoney(bill?.remaining_amount ?? bill?.amount ?? 0), 0);

            return {
                billing_record_id: billId,
                settled_amount: defaultSettledAmount > 0 ? defaultSettledAmount.toFixed(2) : '',
                deduction_items: [],
            };
        });
    }, [payableBillingRecordMap]);

    const normalizedBillAllocations = useMemo(
        () => form.bill_allocations
            .filter((allocation) => form.related_billing_record_ids.includes(allocation.billing_record_id))
            .map((allocation) => {
                const deductionItems = normalizeExtraChargeDraftItems(allocation.deduction_items);
                const deductionTotal = roundMoney(deductionItems.reduce((sum, item) => sum + item.amount, 0));
                const settledAmount = roundMoney(parseMoney(allocation.settled_amount));
                const receivedAmount = roundMoney(settledAmount - deductionTotal);

                return {
                    billing_record_id: allocation.billing_record_id,
                    received_amount: receivedAmount,
                    settled_amount: settledAmount,
                    deduction_items: deductionItems,
                };
            }),
        [form.bill_allocations, form.related_billing_record_ids]
    );

    const selectedBillActualReceivedTotal = useMemo(
        () => roundMoney(normalizedBillAllocations.reduce((sum, allocation) => sum + allocation.received_amount, 0)),
        [normalizedBillAllocations]
    );

    const selectedBillDeductionTotal = useMemo(
        () => roundMoney(normalizedBillAllocations.reduce(
            (sum, allocation) => sum + allocation.deduction_items.reduce((itemSum, item) => itemSum + item.amount, 0),
            0
        )),
        [normalizedBillAllocations]
    );

    const selectedBillSettledTotal = useMemo(
        () => roundMoney(normalizedBillAllocations.reduce((sum, allocation) => sum + allocation.settled_amount, 0)),
        [normalizedBillAllocations]
    );

    const selectedAllocationDrafts = useMemo(
        () => form.related_billing_record_ids.reduce<Array<{ bill: BillingRecord; draft: PaymentBillAllocationDraft }>>((entries, billId) => {
            const bill = payableBillingRecordMap.get(billId);
            const draft = form.bill_allocations.find((allocation) => allocation.billing_record_id === billId);

            if (!bill || !draft) return entries;

            entries.push({ bill, draft });
            return entries;
        }, []),
        [form.related_billing_record_ids, form.bill_allocations, payableBillingRecordMap]
    );

    const usingBillAllocations = form.related_billing_record_ids.length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!partyId) {
            toast.error('Select a party first');
            return;
        }

        if (!usingBillAllocations && !form.amount) {
            toast.error('Amount is required');
            return;
        }

        if (usingBillAllocations) {
            if (normalizedBillAllocations.length !== form.related_billing_record_ids.length) {
                toast.error('Each selected bill must have a valid payment breakup');
                return;
            }

            for (const allocation of normalizedBillAllocations) {
                const bill = payableBillingRecordMap.get(allocation.billing_record_id);
                if (!bill) {
                    toast.error('One or more selected bills are invalid');
                    return;
                }

                if (allocation.settled_amount <= 0) {
                    toast.error('Each selected bill must have a positive settled amount');
                    return;
                }

                if (allocation.received_amount < 0) {
                    toast.error(`Deductions cannot exceed the settled amount for bill ${bill.bill_ref_no || bill.id.slice(0, 8).toUpperCase()}`);
                    return;
                }

                const remainingAmount = parseMoney(bill.remaining_amount ?? bill.amount);
                if (allocation.settled_amount > remainingAmount + 0.009) {
                    toast.error(`Settled amount cannot exceed the remaining balance for bill ${bill.bill_ref_no || bill.id.slice(0, 8).toUpperCase()}`);
                    return;
                }
            }
        }

        setSaving(true);
        try {
            const endpoint = isEditing
                ? `/api/ledger/${partyId}/payments/${record?.id}`
                : `/api/ledger/${partyId}/payments`;
            const res = await fetch(endpoint, {
                method: isEditing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    amount: usingBillAllocations ? selectedBillSettledTotal : parseFloat(form.amount),
                    actual_received_amount: usingBillAllocations ? selectedBillActualReceivedTotal : parseMoney(form.amount),
                    related_billing_record_ids: form.related_billing_record_ids.length > 0 ? form.related_billing_record_ids : null,
                    bill_allocations: usingBillAllocations ? normalizedBillAllocations : [],
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || (isEditing ? 'Failed to update payment' : 'Failed to record payment'));
            }
            toast.success(isEditing ? 'Payment receipt updated' : 'Payment receipt recorded successfully');
            onSuccess();
            onClose();
            setForm({
                receipt_date: new Date().toISOString().split('T')[0],
                amount: '',
                payment_mode: 'NEFT',
                reference_no: '',
                bank_name: '',
                narration: '',
                related_billing_record_ids: [],
                bill_allocations: [],
            });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : (isEditing ? 'Failed to update payment' : 'Failed to record payment'));
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const title = isEditing
        ? 'Edit Payment Receipt'
        : (partyLabel ? `Record Payment — ${partyLabel}` : 'Create Payment');
    const description = isEditing
        ? 'Update receipt details, linked bills, settled amounts, and deduction breakup.'
        : 'Select the party, link unpaid bills, and record the receipt.';

    const formBody = (
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="grid gap-6 p-6 lg:grid-cols-[0.95fr_1.05fr]">
                        <div className="space-y-4">
                            {partyField && !isEditing ? (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Party *</Label>
                                    {partyField}
                                </div>
                            ) : null}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Receipt Date *</Label>
                                    <Input type="date" value={form.receipt_date} onChange={e => setForm(f => ({ ...f, receipt_date: e.target.value }))} className="h-9" required />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Payment Mode *</Label>
                                    <Select value={form.payment_mode} onValueChange={v => setForm(f => ({ ...f, payment_mode: v }))}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'ADJUSTMENT'].map(m => (
                                                <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {!usingBillAllocations ? (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Settled Amount (₹) *</Label>
                                    <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="h-9 font-mono" required />
                                </div>
                            ) : (
                                <div className="rounded-lg border bg-muted/10">
                                    <div className="border-b px-4 py-3">
                                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Receipt Summary</div>
                                        <div className="text-xs text-muted-foreground">Main ledger impact uses the settled amount. Actual received is calculated after subtracting deduction breakup.</div>
                                    </div>
                                    <div className="space-y-2 p-4 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Settled Amount</span>
                                            <span className="font-mono font-semibold text-indigo-700">₹{fmt(selectedBillSettledTotal)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Actual Received</span>
                                            <span className="font-mono font-semibold">₹{fmt(selectedBillActualReceivedTotal)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Deduction / Adjustment</span>
                                            <span className="font-mono font-semibold">₹{fmt(selectedBillDeductionTotal)}</span>
                                        </div>
                                        <div className="flex items-center justify-between border-t pt-2 font-bold">
                                            <span>Receipt Posted To Ledger</span>
                                            <span className="font-mono text-indigo-700">₹{fmt(selectedBillSettledTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {form.payment_mode !== 'CASH' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Reference / UTR</Label>
                                        <Input placeholder="UTR / Cheque No" value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} className="h-9 font-mono" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Bank</Label>
                                        <Input placeholder="Bank name" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} className="h-9" />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Narration</Label>
                                <Input placeholder="Payment remarks / against bills" value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))} className="h-9" />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Bill Numbers</Label>
                                {!partyId ? (
                                    <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                                        Select a party to load unpaid bills.
                                    </div>
                                ) : (
                                    <BillingRecordPicker
                                        billingRecords={payableBillingRecords}
                                        value={form.related_billing_record_ids}
                                        onChange={(related_billing_record_ids) => setForm((current) => ({
                                            ...current,
                                            related_billing_record_ids,
                                            bill_allocations: syncBillAllocationDrafts(related_billing_record_ids, current.bill_allocations),
                                        }))}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {selectedAllocationDrafts.length === 0 ? (
                                <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
                                    Select one or more unpaid bill numbers to record bill-wise settlement and deduction breakup.
                                </div>
                            ) : selectedAllocationDrafts.map(({ bill, draft }) => {
                                const deductionTotal = roundMoney(
                                    normalizeExtraChargeDraftItems(draft.deduction_items).reduce((sum, item) => sum + item.amount, 0)
                                );
                                const settledAmount = roundMoney(parseMoney(draft.settled_amount));
                                const receivedAmount = roundMoney(settledAmount - deductionTotal);
                                const remainingBeforeReceipt = parseMoney(bill.remaining_amount ?? bill.amount);
                                const remainingAfterReceipt = Math.max(roundMoney(remainingBeforeReceipt - settledAmount), 0);
                                const hasOverDeduction = receivedAmount < 0;
                                const hasOverSettlement = settledAmount > remainingBeforeReceipt + 0.009;

                                return (
                                    <div key={bill.id} className="rounded-lg border bg-background shadow-sm">
                                        <div className="border-b px-4 py-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="font-mono text-sm font-bold text-primary">
                                                        {bill.bill_ref_no || bill.id.slice(0, 8).toUpperCase()}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {fmtDate(bill.billing_date)} • Bill Amount ₹{fmt(parseMoney(bill.amount))}
                                                    </div>
                                                    {(bill.covered_cn_nos || []).length > 0 && (
                                                        <div className="mt-1 text-[11px] text-muted-foreground break-words">
                                                            CNs: {bill.covered_cn_nos?.join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="shrink-0 text-right text-xs">
                                                    <div className="font-semibold text-indigo-700">Paid ₹{fmt(parseMoney(bill.settled_amount))}</div>
                                                    <div className="font-semibold text-amber-700">Bal ₹{fmt(remainingBeforeReceipt)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 p-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase text-muted-foreground">Settled For This Bill (₹)</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    max={remainingBeforeReceipt > 0 ? remainingBeforeReceipt : undefined}
                                                    value={draft.settled_amount}
                                                    onChange={(e) => setForm((current) => ({
                                                        ...current,
                                                        bill_allocations: current.bill_allocations.map((allocation) => (
                                                            allocation.billing_record_id === draft.billing_record_id
                                                                ? { ...allocation, settled_amount: e.target.value }
                                                                : allocation
                                                        )),
                                                    }))}
                                                    className="h-9 font-mono"
                                                    placeholder="0.00"
                                                />
                                                <div className="text-[11px] text-muted-foreground">
                                                    Max allowed for this bill: ₹{fmt(remainingBeforeReceipt)}
                                                </div>
                                            </div>

                                            <div className="grid gap-3 text-sm md:grid-cols-4">
                                                <div className="rounded-md border bg-muted/10 px-3 py-2">
                                                    <div className="text-[11px] font-bold uppercase text-muted-foreground">Settled</div>
                                                    <div className="font-mono font-semibold text-indigo-700">₹{fmt(settledAmount)}</div>
                                                </div>
                                                <div className="rounded-md border bg-muted/10 px-3 py-2">
                                                    <div className="text-[11px] font-bold uppercase text-muted-foreground">Received</div>
                                                    <div className={`font-mono font-semibold ${hasOverDeduction ? 'text-destructive' : 'text-foreground'}`}>
                                                        ₹{fmt(Math.max(receivedAmount, 0))}
                                                    </div>
                                                </div>
                                                <div className="rounded-md border bg-muted/10 px-3 py-2">
                                                    <div className="text-[11px] font-bold uppercase text-muted-foreground">Deductions</div>
                                                    <div className="font-mono font-semibold text-amber-700">₹{fmt(deductionTotal)}</div>
                                                </div>
                                                <div className="rounded-md border bg-muted/10 px-3 py-2">
                                                    <div className="text-[11px] font-bold uppercase text-muted-foreground">Balance After</div>
                                                    <div className="font-mono font-semibold text-emerald-700">₹{fmt(remainingAfterReceipt)}</div>
                                                </div>
                                            </div>

                                            {hasOverDeduction && (
                                                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                                                    Deductions cannot be greater than the settled amount for this bill.
                                                </div>
                                            )}

                                            {hasOverSettlement && (
                                                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                                                    Settled amount cannot exceed this bill&apos;s remaining balance of ₹{fmt(remainingBeforeReceipt)}.
                                                </div>
                                            )}

                                            <BillingExtraChargesEditor
                                                items={draft.deduction_items}
                                                onChange={(deduction_items) => setForm((current) => ({
                                                    ...current,
                                                    bill_allocations: current.bill_allocations.map((allocation) => (
                                                        allocation.billing_record_id === draft.billing_record_id
                                                            ? { ...allocation, deduction_items }
                                                            : allocation
                                                    )),
                                                }))}
                                                title="Deduction Breakup"
                                                description="Add positive deduction lines inside this settled amount. Actual received becomes settled minus deductions."
                                                emptyMessage="No deduction lines added for this bill."
                                                lineLabel="Deduction"
                                                descriptionPlaceholder="e.g. TDS / shortage / rate diff / damage recovery"
                                                addButtonLabel="Add Deduction Line"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-4">
                        {variant === 'dialog' && (
                            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        )}
                        <Button type="submit" disabled={saving || !partyId} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isEditing ? 'Save Changes' : 'Record Payment'}
                        </Button>
                    </div>
                </form>
    );

    if (variant === 'inline') {
        return (
            <Card className="overflow-hidden border shadow-sm">
                <CardHeader className="border-b bg-slate-50">
                    <CardTitle className="flex items-center gap-2 text-base">
                        {isEditing ? <Pencil className="h-4 w-4 text-primary" /> : <Banknote className="h-4 w-4 text-primary" />}
                        {title}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">{formBody}</CardContent>
            </Card>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[92vw] w-[92vw] sm:max-w-5xl max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50">
                    <DialogTitle className="flex items-center gap-2">
                        {isEditing ? <Pencil className="h-4 w-4 text-primary" /> : <Banknote className="h-4 w-4 text-primary" />}
                        {title}
                    </DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {formBody}
            </DialogContent>
        </Dialog>
    );
}

// ─── Ledger report download ───────────────────────────────────────────────────

