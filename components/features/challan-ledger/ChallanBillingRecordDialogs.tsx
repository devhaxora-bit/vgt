'use client';

import React, { useMemo, useState } from 'react';
import { Banknote, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { composeBillRefNo, getBillRefPrefix } from '@/lib/billRef';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChallanBillingChallanPicker, type ChallanBillingChallanOption } from './ChallanBillingChallanPicker';
import { ChallanBillingRecordPicker, type ChallanBillingRecordOption } from './ChallanBillingRecordPicker';
import {
    ChallanBillingExtraChargesEditor,
    type ChallanBillingExtraChargeDraftItem,
    challanBillingExtraChargeDraftItem,
} from './ChallanBillingExtraChargesEditor';

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (value?: string | null) => {
    if (!value) return '—';
    try {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        const day = String(parsed.getDate()).padStart(2, '0');
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const year = parsed.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return value;
    }
};

const parseMoney = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const getFullHire = (ch: ChallanBillingChallanOption) =>
    Number(ch.full_hire_amount) || parseMoney(ch.total_hire_amount) + parseMoney(ch.extra_hire_amount);

export interface ChallanBillingRecord {
    id: string;
    billing_date: string;
    amount: number;
    bill_ref_no?: string;
    narration: string;
    covered_challan_nos?: string[];
    challan_total_amount?: number;
    added_other_charges_amount?: number;
    challan_snapshot?: Array<Record<string, unknown>>;
    status: string;
    settled_amount?: number;
    remaining_amount?: number;
    payment_status?: string;
}

export interface ChallanPaymentReceipt {
    id: string;
    receipt_date: string;
    amount: number;
    actual_received_amount?: number;
    payment_mode: string;
    reference_no?: string;
    bank_name?: string;
    narration?: string;
    status: string;
    related_billing_record_ids?: string[];
    bill_allocations?: Array<{
        billing_record_id: string;
        settled_amount: number;
        received_amount: number;
        deduction_items?: Array<{ label: string; amount: number }>;
    }>;
}

const buildSettledBillAmountMap = (paymentReceipts: ChallanPaymentReceipt[]) => {
    const billSettledMap = new Map<string, number>();

    paymentReceipts
        .filter((receipt) => receipt.status === 'ACTIVE')
        .forEach((receipt) => {
            if ((receipt.bill_allocations || []).length > 0) {
                receipt.bill_allocations?.forEach((allocation) => {
                    const billId = String(allocation.billing_record_id || '').trim();
                    if (!billId) return;
                    billSettledMap.set(
                        billId,
                        roundMoney((billSettledMap.get(billId) || 0) + Number(allocation.settled_amount || 0))
                    );
                });
                return;
            }

            if ((receipt.related_billing_record_ids || []).length === 1) {
                const billId = String(receipt.related_billing_record_ids?.[0] || '').trim();
                if (!billId) return;
                billSettledMap.set(
                    billId,
                    roundMoney((billSettledMap.get(billId) || 0) + Number(receipt.amount || 0))
                );
            }
        });

    return billSettledMap;
};

const normalizeExtraChargeDraftItems = (items: ChallanBillingExtraChargeDraftItem[]) =>
    items
        .map((item) => ({
            label: item.label.trim(),
            amount: roundMoney(parseMoney(item.amount)),
        }))
        .filter((item) => item.label && item.amount > 0);

export function CreateChallanBillDialog({
    open,
    onClose,
    brokerId,
    challans,
    billedChallanNos,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    brokerId: string;
    challans: ChallanBillingChallanOption[];
    billedChallanNos: string[];
    onSuccess: () => void;
}) {
    const [form, setForm] = useState({
        billing_date: new Date().toISOString().split('T')[0],
        amount: '',
        bill_ref_no: '',
        narration: '',
        covered_challan_nos: [] as string[],
    });
    const [saving, setSaving] = useState(false);

    const selectedTotal = useMemo(
        () => roundMoney(
            challans
                .filter((ch) => form.covered_challan_nos.includes(ch.challan_no))
                .reduce((sum, ch) => sum + getFullHire(ch), 0)
        ),
        [challans, form.covered_challan_nos]
    );

    const enteredOtherChargeAmount = roundMoney(parseMoney(form.amount));
    const finalBillAmount = roundMoney(selectedTotal + enteredOtherChargeAmount);
    const billRefPrefix = useMemo(() => getBillRefPrefix(form.billing_date), [form.billing_date]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.bill_ref_no.trim()) {
            toast.error('Bill No is required');
            return;
        }
        if (form.covered_challan_nos.length === 0) {
            toast.error('Select at least one challan');
            return;
        }
        if (finalBillAmount <= 0) {
            toast.error('Bill amount must be greater than zero');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/challan-ledger/${brokerId}/billing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    billing_date: form.billing_date,
                    bill_ref_no: composeBillRefNo(form.billing_date, form.bill_ref_no),
                    narration: form.narration,
                    added_other_charges_amount: enteredOtherChargeAmount,
                    covered_challan_nos: form.covered_challan_nos,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create billing record');
            }
            toast.success('Challan bill created successfully');
            onSuccess();
            onClose();
            setForm({
                billing_date: new Date().toISOString().split('T')[0],
                amount: '',
                bill_ref_no: '',
                narration: '',
                covered_challan_nos: [],
            });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to create billing record');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-4xl max-h-[95vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50">
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Create Challan Bill
                    </DialogTitle>
                    <DialogDescription>
                        Bill loading challans at full hire value (total hire + extra hire).
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="grid gap-6 p-6 lg:grid-cols-2">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Billing Date *</Label>
                                    <Input type="date" value={form.billing_date} onChange={(e) => setForm((f) => ({ ...f, billing_date: e.target.value }))} className="h-9" required />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Bill No *</Label>
                                    <div className="flex h-9 overflow-hidden rounded-md border bg-background">
                                        <div className="flex items-center border-r bg-muted/40 px-3 text-xs font-bold text-muted-foreground">{billRefPrefix}</div>
                                        <Input value={form.bill_ref_no} onChange={(e) => setForm((f) => ({ ...f, bill_ref_no: e.target.value }))} className="h-full border-0 shadow-none focus-visible:ring-0" required />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Extra Charges (₹)</Label>
                                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="h-9 font-mono" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Description</Label>
                                <Input value={form.narration} onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))} className="h-9" />
                            </div>
                            <div className="rounded-lg border bg-muted/10 p-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span>Challan Total</span><span className="font-mono font-semibold">₹{fmt(selectedTotal)}</span></div>
                                <div className="flex justify-between"><span>Extra Charges</span><span className="font-mono font-semibold">₹{fmt(enteredOtherChargeAmount)}</span></div>
                                <div className="flex justify-between border-t pt-2 font-bold"><span>Final Bill</span><span className="font-mono text-emerald-700">₹{fmt(finalBillAmount)}</span></div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Covered Challans *</Label>
                            <ChallanBillingChallanPicker
                                challans={challans}
                                value={form.covered_challan_nos}
                                onChange={(covered_challan_nos) => setForm((f) => ({ ...f, covered_challan_nos }))}
                                billedChallanNos={billedChallanNos}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save Bill
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function RecordChallanPaymentDialog({
    open,
    onClose,
    brokerId,
    billingRecords,
    paymentReceipts,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    brokerId: string;
    billingRecords: ChallanBillingRecord[];
    paymentReceipts: ChallanPaymentReceipt[];
    onSuccess: () => void;
}) {
    interface PaymentBillAllocationDraft {
        billing_record_id: string;
        settled_amount: string;
        deduction_items: ChallanBillingExtraChargeDraftItem[];
    }

    const [form, setForm] = useState({
        receipt_date: new Date().toISOString().split('T')[0],
        payment_mode: 'NEFT',
        reference_no: '',
        bank_name: '',
        narration: '',
        related_billing_record_ids: [] as string[],
        bill_allocations: [] as PaymentBillAllocationDraft[],
    });
    const [saving, setSaving] = useState(false);

    const settledBillAmountMap = useMemo(() => buildSettledBillAmountMap(paymentReceipts), [paymentReceipts]);

    const payableBillingRecords = useMemo(
        () => billingRecords
            .filter((record) => record.status === 'ACTIVE')
            .map((record) => {
                const settledAmount = settledBillAmountMap.get(record.id) || 0;
                const remainingAmount = Math.max(roundMoney(parseMoney(record.amount) - settledAmount), 0);
                return { ...record, settled_amount: settledAmount, remaining_amount: remainingAmount };
            })
            .filter((record) => parseMoney(record.remaining_amount) > 0.009),
        [billingRecords, settledBillAmountMap]
    );

    const syncBillAllocationDrafts = (billIds: string[], current: PaymentBillAllocationDraft[]) => {
        const existing = new Map(current.map((item) => [item.billing_record_id, item]));
        return billIds.map((billingRecordId) => {
            const bill = payableBillingRecords.find((entry) => entry.id === billingRecordId);
            const remaining = parseMoney(bill?.remaining_amount ?? bill?.amount);
            return existing.get(billingRecordId) || {
                billing_record_id: billingRecordId,
                settled_amount: remaining > 0 ? String(remaining) : '',
                deduction_items: [],
            };
        });
    };

    const selectedAllocationDrafts = form.bill_allocations
        .map((draft) => ({
            draft,
            bill: payableBillingRecords.find((record) => record.id === draft.billing_record_id),
        }))
        .filter((entry): entry is { draft: PaymentBillAllocationDraft; bill: ChallanBillingRecord & { settled_amount: number; remaining_amount: number } } => Boolean(entry.bill));

    const selectedBillSettledTotal = roundMoney(
        selectedAllocationDrafts.reduce((sum, { draft }) => sum + parseMoney(draft.settled_amount), 0)
    );
    const selectedBillDeductionTotal = roundMoney(
        selectedAllocationDrafts.reduce((sum, { draft }) => (
            sum + normalizeExtraChargeDraftItems(draft.deduction_items).reduce((inner, item) => inner + item.amount, 0)
        ), 0)
    );
    const selectedBillActualReceivedTotal = roundMoney(selectedBillSettledTotal - selectedBillDeductionTotal);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.related_billing_record_ids.length === 0) {
            toast.error('Select at least one bill');
            return;
        }
        if (selectedBillSettledTotal <= 0) {
            toast.error('Settled amount must be greater than zero');
            return;
        }

        setSaving(true);
        try {
            const bill_allocations = selectedAllocationDrafts.map(({ draft }) => {
                const deductionItems = normalizeExtraChargeDraftItems(draft.deduction_items);
                const settledAmount = roundMoney(parseMoney(draft.settled_amount));
                const deductionTotal = roundMoney(deductionItems.reduce((sum, item) => sum + item.amount, 0));
                return {
                    billing_record_id: draft.billing_record_id,
                    settled_amount: settledAmount,
                    received_amount: roundMoney(settledAmount - deductionTotal),
                    deduction_items: deductionItems,
                };
            });

            const res = await fetch(`/api/challan-ledger/${brokerId}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receipt_date: form.receipt_date,
                    payment_mode: form.payment_mode,
                    reference_no: form.reference_no || null,
                    bank_name: form.bank_name || null,
                    narration: form.narration || null,
                    bill_allocations,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to record payment');
            }
            toast.success('Payment recorded successfully');
            onSuccess();
            onClose();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to record payment');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[92vw] w-[92vw] sm:max-w-5xl max-h-[95vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50">
                    <DialogTitle className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-primary" /> Record Payment
                    </DialogTitle>
                    <DialogDescription>
                        Link payment to challan bills. Partial payments are supported until the bill is fully settled.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="grid gap-6 p-6 lg:grid-cols-2">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Receipt Date *</Label>
                                    <Input type="date" value={form.receipt_date} onChange={(e) => setForm((f) => ({ ...f, receipt_date: e.target.value }))} className="h-9" required />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Payment Mode *</Label>
                                    <Select value={form.payment_mode} onValueChange={(v) => setForm((f) => ({ ...f, payment_mode: v }))}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'ADJUSTMENT'].map((m) => (
                                                <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {form.payment_mode !== 'CASH' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Reference / UTR</Label>
                                        <Input value={form.reference_no} onChange={(e) => setForm((f) => ({ ...f, reference_no: e.target.value }))} className="h-9 font-mono" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Bank</Label>
                                        <Input value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} className="h-9" />
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Narration</Label>
                                <Input value={form.narration} onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))} className="h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Bill Numbers</Label>
                                <ChallanBillingRecordPicker
                                    billingRecords={payableBillingRecords as ChallanBillingRecordOption[]}
                                    value={form.related_billing_record_ids}
                                    onChange={(related_billing_record_ids) => setForm((current) => ({
                                        ...current,
                                        related_billing_record_ids,
                                        bill_allocations: syncBillAllocationDrafts(related_billing_record_ids, current.bill_allocations),
                                    }))}
                                />
                            </div>
                            <div className="rounded-lg border bg-muted/10 p-4 text-sm space-y-2">
                                <div className="flex justify-between"><span>Settled Total</span><span className="font-mono font-semibold text-indigo-700">₹{fmt(selectedBillSettledTotal)}</span></div>
                                <div className="flex justify-between"><span>Actual Received</span><span className="font-mono font-semibold">₹{fmt(selectedBillActualReceivedTotal)}</span></div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {selectedAllocationDrafts.length === 0 ? (
                                <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
                                    Select unpaid bills to record partial or full payment.
                                </div>
                            ) : selectedAllocationDrafts.map(({ bill, draft }) => {
                                const remainingBefore = parseMoney(bill.remaining_amount ?? bill.amount);
                                return (
                                    <div key={bill.id} className="rounded-lg border p-4 space-y-3">
                                        <div className="flex justify-between gap-3">
                                            <div>
                                                <div className="font-mono text-sm font-bold text-primary">{bill.bill_ref_no || bill.id.slice(0, 8)}</div>
                                                <div className="text-xs text-muted-foreground">{fmtDate(bill.billing_date)} • Bal ₹{fmt(remainingBefore)}</div>
                                            </div>
                                            <Badge variant="outline">{bill.payment_status || 'UNPAID'}</Badge>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold uppercase text-muted-foreground">Settled For This Bill (₹)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                max={remainingBefore > 0 ? remainingBefore : undefined}
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
                                            />
                                        </div>
                                        <ChallanBillingExtraChargesEditor
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
                                            description="Optional deductions from the settled amount."
                                            lineLabel="Deduction"
                                            addButtonLabel="Add Deduction"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save Payment
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function ViewChallanBillDialog({
    open,
    onClose,
    record,
}: {
    open: boolean;
    onClose: () => void;
    record: ChallanBillingRecord | null;
}) {
    if (!record) return null;

    const snapshot = Array.isArray(record.challan_snapshot) ? record.challan_snapshot : [];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Bill {record.bill_ref_no || record.id.slice(0, 8)}</DialogTitle>
                    <DialogDescription>{record.narration}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><span className="text-muted-foreground">Date</span><div className="font-semibold">{fmtDate(record.billing_date)}</div></div>
                        <div><span className="text-muted-foreground">Amount</span><div className="font-semibold text-emerald-700">₹{fmt(parseMoney(record.amount))}</div></div>
                        <div><span className="text-muted-foreground">Challan Total</span><div className="font-semibold">₹{fmt(parseMoney(record.challan_total_amount))}</div></div>
                        <div><span className="text-muted-foreground">Status</span><div><Badge>{record.payment_status || record.status}</Badge></div></div>
                    </div>
                    {snapshot.length > 0 && (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Challan</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead>Driver</TableHead>
                                        <TableHead>CNs</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {snapshot.map((row, index) => (
                                        <TableRow key={`${String(row.challan_no)}-${index}`}>
                                            <TableCell className="font-mono text-xs">{String(row.challan_no || '—')}</TableCell>
                                            <TableCell>{fmtDate(String(row.date_from || ''))}</TableCell>
                                            <TableCell>{String(row.vehicle_no || '—')}</TableCell>
                                            <TableCell>{String(row.driver_name || '—')}</TableCell>
                                            <TableCell className="text-xs">{Array.isArray(row.linked_cn_nos) ? (row.linked_cn_nos as string[]).join(', ') : '—'}</TableCell>
                                            <TableCell className="text-right font-mono">₹{fmt(parseMoney(row.full_hire_amount))}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function CancelReasonDialog({
    open,
    onClose,
    title,
    description,
    onConfirm,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description: string;
    onConfirm: (reason: string) => Promise<void>;
}) {
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            toast.error('Reason is required');
            return;
        }
        setSaving(true);
        try {
            await onConfirm(reason.trim());
            setReason('');
            onClose();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Action failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Reason *</Label>
                        <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirm
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export { challanBillingExtraChargeDraftItem };
