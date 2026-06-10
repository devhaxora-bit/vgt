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

export interface ChallanPaymentChallanAllocation {
    challan_no: string;
    settled_amount: number;
    deduction_items?: Array<{ label: string; amount: number }>;
    addition_items?: Array<{ label: string; amount: number }>;
    deduction_total?: number;
    addition_total?: number;
    net_paid_amount?: number;
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
    payer_name?: string | null;
    status: string;
    related_billing_record_ids?: string[];
    challan_allocations?: ChallanPaymentChallanAllocation[];
    bill_allocations?: Array<{
        billing_record_id: string;
        settled_amount: number;
        received_amount: number;
        deduction_items?: Array<{ label: string; amount: number }>;
    }>;
}

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

const getChallanBalance = (challan: ChallanBillingChallanOption) => {
    const netPayable = Number(challan.net_payable_amount);
    const balance = Number(challan.balance_amount);
    if (!Number.isNaN(balance)) return roundMoney(balance);
    if (!Number.isNaN(netPayable)) return roundMoney(netPayable);
    return getFullHire(challan);
};

export function RecordChallanPaymentDialog({
    open,
    onClose,
    brokerId,
    challans,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    brokerId: string;
    challans: ChallanBillingChallanOption[];
    onSuccess: () => void;
}) {
    interface PaymentChallanAllocationDraft {
        challan_no: string;
        settled_amount: string;
        deduction_items: ChallanBillingExtraChargeDraftItem[];
        addition_items: ChallanBillingExtraChargeDraftItem[];
    }

    const [form, setForm] = useState({
        receipt_date: new Date().toISOString().split('T')[0],
        payment_mode: 'NEFT',
        reference_no: '',
        bank_name: '',
        narration: '',
        payer_name: '',
        challan_allocations: [] as PaymentChallanAllocationDraft[],
    });
    const [saving, setSaving] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');

    const payableChallans = useMemo(
        () => challans.filter((challan) => getChallanBalance(challan) > 0.009),
        [challans]
    );

    const filteredPayableChallans = useMemo(() => {
        const query = pickerSearch.trim().toLowerCase();
        if (!query) return payableChallans;
        return payableChallans.filter((challan) =>
            [challan.challan_no, challan.vehicle_no, challan.driver_name, challan.owner_name]
                .join(' ').toLowerCase().includes(query)
        );
    }, [payableChallans, pickerSearch]);

    const selectedChallanNos = new Set(form.challan_allocations.map((a) => a.challan_no));

    const toggleChallan = (challan: ChallanBillingChallanOption) => {
        setForm((current) => {
            if (current.challan_allocations.some((a) => a.challan_no === challan.challan_no)) {
                return {
                    ...current,
                    challan_allocations: current.challan_allocations.filter((a) => a.challan_no !== challan.challan_no),
                };
            }
            const balance = getChallanBalance(challan);
            return {
                ...current,
                challan_allocations: [
                    ...current.challan_allocations,
                    {
                        challan_no: challan.challan_no,
                        settled_amount: balance > 0 ? String(balance) : '',
                        deduction_items: [],
                        addition_items: [],
                    },
                ],
            };
        });
    };

    const challanByNo = useMemo(
        () => new Map(payableChallans.map((challan) => [challan.challan_no, challan])),
        [payableChallans]
    );

    const settledTotal = roundMoney(
        form.challan_allocations.reduce((sum, draft) => sum + parseMoney(draft.settled_amount), 0)
    );
    const deductionTotal = roundMoney(
        form.challan_allocations.reduce((sum, draft) => (
            sum + normalizeExtraChargeDraftItems(draft.deduction_items).reduce((inner, item) => inner + item.amount, 0)
        ), 0)
    );
    const additionTotal = roundMoney(
        form.challan_allocations.reduce((sum, draft) => (
            sum + normalizeExtraChargeDraftItems(draft.addition_items).reduce((inner, item) => inner + item.amount, 0)
        ), 0)
    );
    const netCashTotal = roundMoney(settledTotal - deductionTotal + additionTotal);

    const updateDraft = (challanNo: string, patch: Partial<PaymentChallanAllocationDraft>) => {
        setForm((current) => ({
            ...current,
            challan_allocations: current.challan_allocations.map((allocation) => (
                allocation.challan_no === challanNo ? { ...allocation, ...patch } : allocation
            )),
        }));
    };

    const resetForm = () => setForm({
        receipt_date: new Date().toISOString().split('T')[0],
        payment_mode: 'NEFT',
        reference_no: '',
        bank_name: '',
        narration: '',
        payer_name: '',
        challan_allocations: [],
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.challan_allocations.length === 0) {
            toast.error('Select at least one challan to pay against');
            return;
        }
        if (settledTotal <= 0) {
            toast.error('Enter the amount paid against the selected challan(s)');
            return;
        }

        // Client-side guard: never exceed a challan's remaining balance.
        for (const draft of form.challan_allocations) {
            const challan = challanByNo.get(draft.challan_no);
            const balance = challan ? getChallanBalance(challan) : 0;
            if (parseMoney(draft.settled_amount) > balance + 0.009) {
                toast.error(`Amount for challan ${draft.challan_no} exceeds its balance of ₹${fmt(balance)}`);
                return;
            }
        }

        setSaving(true);
        try {
            const challan_allocations = form.challan_allocations.map((draft) => ({
                challan_no: draft.challan_no,
                settled_amount: roundMoney(parseMoney(draft.settled_amount)),
                deduction_items: normalizeExtraChargeDraftItems(draft.deduction_items),
                addition_items: normalizeExtraChargeDraftItems(draft.addition_items),
            }));

            const res = await fetch(`/api/challan-ledger/${brokerId}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receipt_date: form.receipt_date,
                    payment_mode: form.payment_mode,
                    reference_no: form.reference_no || null,
                    bank_name: form.bank_name || null,
                    narration: form.narration || null,
                    payer_name: form.payer_name || null,
                    challan_allocations,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to record payment');
            }
            toast.success('Payment recorded successfully');
            onSuccess();
            onClose();
            resetForm();
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
                        Pay directly against challan numbers. Partial payments are allowed until a challan is fully paid.
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
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Paid To / Received By</Label>
                                <Input value={form.payer_name} onChange={(e) => setForm((f) => ({ ...f, payer_name: e.target.value }))} placeholder="Name of the person/party" className="h-9" />
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
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Select Challans *</Label>
                                <div className="rounded-md border">
                                    <div className="border-b p-2">
                                        <Input value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Search challan / vehicle / driver..." className="h-8 text-xs" />
                                    </div>
                                    <div className="max-h-56 overflow-y-auto divide-y">
                                        {filteredPayableChallans.length === 0 ? (
                                            <div className="px-3 py-6 text-center text-xs text-muted-foreground">No challans with an outstanding balance.</div>
                                        ) : filteredPayableChallans.map((challan) => {
                                            const checked = selectedChallanNos.has(challan.challan_no);
                                            return (
                                                <button
                                                    key={challan.id}
                                                    type="button"
                                                    onClick={() => toggleChallan(challan)}
                                                    className={`w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors ${checked ? 'bg-primary/5' : ''}`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-mono text-xs font-bold text-primary">{challan.challan_no}</span>
                                                        <span className="text-[11px] font-semibold text-amber-700">Bal ₹{fmt(getChallanBalance(challan))}</span>
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground">{fmtDate(challan.date_from)} • {challan.vehicle_no || '—'}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg border bg-muted/10 p-4 text-sm space-y-2">
                                <div className="flex justify-between"><span>Settled (against challans)</span><span className="font-mono font-semibold text-indigo-700">₹{fmt(settledTotal)}</span></div>
                                <div className="flex justify-between"><span>Deductions</span><span className="font-mono font-semibold text-destructive">− ₹{fmt(deductionTotal)}</span></div>
                                <div className="flex justify-between"><span>Extra Charges</span><span className="font-mono font-semibold text-emerald-700">+ ₹{fmt(additionTotal)}</span></div>
                                <div className="flex justify-between border-t pt-2 font-bold"><span>Net Cash</span><span className="font-mono">₹{fmt(netCashTotal)}</span></div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {form.challan_allocations.length === 0 ? (
                                <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
                                    Select challans on the left to enter the amount paid, deductions, and extra charges.
                                </div>
                            ) : form.challan_allocations.map((draft) => {
                                const challan = challanByNo.get(draft.challan_no);
                                const balance = challan ? getChallanBalance(challan) : 0;
                                return (
                                    <div key={draft.challan_no} className="rounded-lg border p-4 space-y-3">
                                        <div className="flex justify-between gap-3">
                                            <div>
                                                <div className="font-mono text-sm font-bold text-primary">{draft.challan_no}</div>
                                                <div className="text-xs text-muted-foreground">{challan ? `${fmtDate(challan.date_from)} • ` : ''}Balance ₹{fmt(balance)}</div>
                                            </div>
                                            <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => challan && toggleChallan(challan)}>Remove</Button>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold uppercase text-muted-foreground">Amount Paid For This Challan (₹) *</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                max={balance > 0 ? balance : undefined}
                                                value={draft.settled_amount}
                                                onChange={(e) => updateDraft(draft.challan_no, { settled_amount: e.target.value })}
                                                className="h-9 font-mono"
                                            />
                                        </div>
                                        <ChallanBillingExtraChargesEditor
                                            items={draft.deduction_items}
                                            onChange={(deduction_items) => updateDraft(draft.challan_no, { deduction_items })}
                                            title="Deductions"
                                            description="Amounts subtracted from the cash paid (e.g. TDS, penalty)."
                                            lineLabel="Deduction"
                                            addButtonLabel="Add Deduction"
                                            emptyMessage="No deductions added."
                                        />
                                        <ChallanBillingExtraChargesEditor
                                            items={draft.addition_items}
                                            onChange={(addition_items) => updateDraft(draft.challan_no, { addition_items })}
                                            title="Extra Charges"
                                            description="Extra amounts added to the cash paid (e.g. detention, extra hire)."
                                            lineLabel="Charge"
                                            addButtonLabel="Add Extra Charge"
                                            emptyMessage="No extra charges added."
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

export function ViewChallanPaymentDialog({
    open,
    onClose,
    receipt,
}: {
    open: boolean;
    onClose: () => void;
    receipt: ChallanPaymentReceipt | null;
}) {
    if (!receipt) return null;

    const allocations = Array.isArray(receipt.challan_allocations) ? receipt.challan_allocations : [];
    const deductionTotal = roundMoney(
        allocations.reduce((sum, a) => sum + (a.deduction_items || []).reduce((inner, item) => inner + Number(item.amount || 0), 0), 0)
    );
    const additionTotal = roundMoney(
        allocations.reduce((sum, a) => sum + (a.addition_items || []).reduce((inner, item) => inner + Number(item.amount || 0), 0), 0)
    );
    const settledTotal = roundMoney(allocations.reduce((sum, a) => sum + Number(a.settled_amount || 0), 0));
    const netCash = roundMoney(settledTotal - deductionTotal + additionTotal);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-primary" /> Payment Receipt
                    </DialogTitle>
                    <DialogDescription>{receipt.narration || 'Payment recorded against challans'}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><span className="text-muted-foreground">Date</span><div className="font-semibold">{fmtDate(receipt.receipt_date)}</div></div>
                        <div><span className="text-muted-foreground">Mode</span><div className="font-semibold">{receipt.payment_mode}</div></div>
                        <div><span className="text-muted-foreground">Paid To</span><div className="font-semibold">{receipt.payer_name || '—'}</div></div>
                        <div><span className="text-muted-foreground">Reference</span><div className="font-semibold font-mono text-xs">{receipt.reference_no || '—'}</div></div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border bg-muted/10 p-3 text-sm">
                        <div><span className="text-muted-foreground text-xs">Settled</span><div className="font-mono font-bold text-indigo-700">₹{fmt(settledTotal)}</div></div>
                        <div><span className="text-muted-foreground text-xs">Deductions</span><div className="font-mono font-bold text-destructive">₹{fmt(deductionTotal)}</div></div>
                        <div><span className="text-muted-foreground text-xs">Extra Charges</span><div className="font-mono font-bold text-emerald-700">₹{fmt(additionTotal)}</div></div>
                        <div><span className="text-muted-foreground text-xs">Net Cash</span><div className="font-mono font-bold">₹{fmt(netCash)}</div></div>
                    </div>

                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Challan</TableHead>
                                    <TableHead className="text-right">Settled</TableHead>
                                    <TableHead>Deductions</TableHead>
                                    <TableHead>Extra Charges</TableHead>
                                    <TableHead className="text-right">Net</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allocations.map((allocation, index) => {
                                    const dTotal = (allocation.deduction_items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
                                    const aTotal = (allocation.addition_items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
                                    const net = Number(allocation.net_paid_amount ?? (Number(allocation.settled_amount || 0) - dTotal + aTotal));
                                    return (
                                        <TableRow key={`${allocation.challan_no}-${index}`}>
                                            <TableCell className="font-mono text-xs font-bold text-primary">{allocation.challan_no}</TableCell>
                                            <TableCell className="text-right font-mono">₹{fmt(Number(allocation.settled_amount || 0))}</TableCell>
                                            <TableCell className="text-xs">
                                                {(allocation.deduction_items || []).length === 0 ? '—' : (allocation.deduction_items || []).map((item, i) => (
                                                    <div key={i}>{item.label}: ₹{fmt(Number(item.amount || 0))}</div>
                                                ))}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {(allocation.addition_items || []).length === 0 ? '—' : (allocation.addition_items || []).map((item, i) => (
                                                    <div key={i}>{item.label}: ₹{fmt(Number(item.amount || 0))}</div>
                                                ))}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-semibold">₹{fmt(net)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
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
