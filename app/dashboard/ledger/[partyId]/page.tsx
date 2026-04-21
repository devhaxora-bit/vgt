'use client';

import React, { useState, useEffect, useMemo, use, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { composeBillRefNo, getBillRefPrefix } from '@/lib/billRef';
import {
    ArrowLeft, Package, TrendingUp, AlertCircle, DollarSign,
    Search, RotateCcw, Plus, FileText,
    Truck, CheckCircle2, XCircle, CreditCard, Banknote, Building2,
    Loader2, Eye, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { BillingRecordViewDialog, EditBillingDialog } from '@/components/features/ledger/BillingRecordDialogs';
import { BillingConsignmentPicker } from '@/components/features/ledger/BillingConsignmentPicker';
import { BillingExtraChargesEditor, type BillingExtraChargeDraftItem } from '@/components/features/ledger/BillingExtraChargesEditor';
import { BillingRecordPicker } from '@/components/features/ledger/BillingRecordPicker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Party {
    id: string; name: string; code: string; type: string;
    phone?: string; gstin?: string; address?: string; branch_code?: string;
}

interface LedgerAccount {
    id: string; opening_balance: number; credit_limit: number;
    credit_days: number; notes?: string; opening_balance_note?: string;
    opening_balance_date?: string;
}

interface Summary {
    total_cns_amount: number;
    total_cns_count: number;
    total_billed: number;
    total_paid: number;
    unbilled_amount: number;
    overbilled_amount?: number;
    outstanding: number;
    opening_balance: number;
}

interface Consignment {
    id: string; cn_no: string; bkg_date: string;
    invoice_no?: string;
    booking_branch: string; loading_point?: string; dest_branch: string; delivery_point?: string;
    no_of_pkg: number; actual_weight: number; charged_weight: number;
    load_unit: string; total_freight: number; basic_freight?: number; freight_rate?: number;
    unload_charges?: number; retention_charges?: number; extra_km_charges?: number;
    mhc_charges?: number; door_coll_charges?: number; door_del_charges?: number;
    other_charges?: number; vehicle_no?: string; bkg_basis: string;
    goods_desc?: string; delivery_type?: string;
}

interface BillingExtraChargeItem {
    label: string;
    amount: number;
}

interface BillingRecord {
    id: string; billing_date: string; billing_period_from?: string;
    billing_period_to?: string; amount: number; bill_ref_no?: string;
    narration: string; covered_cn_nos?: string[]; status: string;
    cn_total_amount?: number;
    added_other_charges_amount?: number;
    consignment_snapshot?: Array<Record<string, unknown>>;
    extra_charge_items?: BillingExtraChargeItem[];
    settled_amount?: number;
    remaining_amount?: number;
    cancel_reason?: string; cancelled_at?: string;
}

interface PaymentDeductionItem {
    label: string;
    amount: number;
}

interface PaymentBillAllocation {
    billing_record_id: string;
    settled_amount: number;
    received_amount: number;
    deduction_items?: PaymentDeductionItem[];
}

interface PaymentReceipt {
    id: string; receipt_date: string; amount: number;
    actual_received_amount?: number;
    payment_mode: string; reference_no?: string; bank_name?: string;
    narration?: string; status: string; reversal_reason?: string;
    reversed_at?: string;
    related_billing_record_ids?: string[];
    bill_allocations?: PaymentBillAllocation[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
};

const BASIS_BADGE: Record<string, string> = {
    'TOPAY':       'bg-orange-50 text-orange-700 border-orange-200',
    'PAID':        'bg-emerald-50 text-emerald-700 border-emerald-200',
    'TO BE BILLED':'bg-blue-50 text-blue-700 border-blue-200',
};

const MODE_BADGE: Record<string, string> = {
    CASH:       'bg-emerald-50 text-emerald-700',
    CHEQUE:     'bg-blue-50 text-blue-700',
    NEFT:       'bg-indigo-50 text-indigo-700',
    RTGS:       'bg-purple-50 text-purple-700',
    UPI:        'bg-violet-50 text-violet-700',
    ADJUSTMENT: 'bg-slate-100 text-slate-700',
};

const parseMoney = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const normalizeExtraChargeDraftItems = (items: BillingExtraChargeDraftItem[]) =>
    items
        .map((item) => ({
            label: item.label.trim(),
            amount: Number(parseMoney(item.amount).toFixed(2)),
        }))
        .filter((item) => item.label && item.amount > 0);

const getConsignmentExtraCharges = (
    consignment: Pick<Consignment, 'unload_charges' | 'extra_km_charges' | 'mhc_charges' | 'door_coll_charges' | 'door_del_charges' | 'other_charges'>
) : number => {
    const chargeValues: Array<number | undefined> = [
        consignment.unload_charges,
        consignment.extra_km_charges,
        consignment.mhc_charges,
        consignment.door_coll_charges,
        consignment.door_del_charges,
        consignment.other_charges,
    ];

    return chargeValues.reduce<number>((sum, value) => sum + parseMoney(value), 0);
};

const getConsignmentBaseFreight = (
    consignment: Pick<Consignment, 'basic_freight' | 'total_freight' | 'retention_charges' | 'unload_charges' | 'extra_km_charges' | 'mhc_charges' | 'door_coll_charges' | 'door_del_charges' | 'other_charges'>
) : number => {
    const baseFreight = parseMoney(consignment.basic_freight);
    if (baseFreight > 0) return baseFreight;

    const totalFreight = parseMoney(consignment.total_freight);
    const detention = parseMoney(consignment.retention_charges);
    const extraCharges = getConsignmentExtraCharges(consignment);
    const derivedFreight = totalFreight - detention - extraCharges;

    return derivedFreight > 0 ? derivedFreight : totalFreight;
};

const getConsignmentChargeBreakdown = (
    consignment: Pick<Consignment, 'basic_freight' | 'total_freight' | 'unload_charges' | 'retention_charges' | 'extra_km_charges' | 'mhc_charges' | 'door_coll_charges' | 'door_del_charges' | 'other_charges'>
) => {
    const freight = getConsignmentBaseFreight(consignment);
    const unloading = parseMoney(consignment.unload_charges);
    const detention = parseMoney(consignment.retention_charges);
    const extraKm = parseMoney(consignment.extra_km_charges);
    const loading = parseMoney(consignment.mhc_charges);
    const doorCollection = parseMoney(consignment.door_coll_charges);
    const doorDelivery = parseMoney(consignment.door_del_charges);
    const other = parseMoney(consignment.other_charges);
    const total = parseMoney(consignment.total_freight) || (
        freight
        + unloading
        + detention
        + extraKm
        + loading
        + doorCollection
        + doorDelivery
        + other
    );

    return {
        freight,
        unloading,
        detention,
        extraKm,
        loading,
        doorCollection,
        doorDelivery,
        other,
        total,
    };
};

const buildConsignmentBreakup = (consignments: Consignment[], selectedCnNos: string[]) => {
    const selected = consignments.filter((consignment) => selectedCnNos.includes(consignment.cn_no));

    const freightTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).freight, 0);
    const unloadingTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).unloading, 0);
    const detentionTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).detention, 0);
    const extraKmTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).extraKm, 0);
    const loadingChargeTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).loading, 0);
    const doorCollectionTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).doorCollection, 0);
    const doorDeliveryTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).doorDelivery, 0);
    const otherChargeTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).other, 0);
    const ancillaryChargeTotal = selected.reduce<number>((sum, consignment) => (
        sum
        + getConsignmentChargeBreakdown(consignment).unloading
        + getConsignmentChargeBreakdown(consignment).extraKm
        + getConsignmentChargeBreakdown(consignment).loading
        + getConsignmentChargeBreakdown(consignment).doorCollection
        + getConsignmentChargeBreakdown(consignment).doorDelivery
        + getConsignmentChargeBreakdown(consignment).other
    ), 0);
    const cnChargeTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).total, 0);

    return {
        selected,
        freightTotal,
        unloadingTotal,
        detentionTotal,
        extraKmTotal,
        loadingChargeTotal,
        doorCollectionTotal,
        doorDeliveryTotal,
        otherChargeTotal,
        ancillaryChargeTotal,
        cnChargeTotal,
    };
};

const buildSettledBillAmountMap = (paymentReceipts: PaymentReceipt[]) => {
    const billSettledMap = new Map<string, number>();

    paymentReceipts
        .filter((receipt) => receipt.status === 'ACTIVE')
        .forEach((receipt) => {
            if ((receipt.bill_allocations || []).length > 0) {
                receipt.bill_allocations?.forEach((allocation) => {
                    billSettledMap.set(
                        allocation.billing_record_id,
                        roundMoney((billSettledMap.get(allocation.billing_record_id) || 0) + parseMoney(allocation.settled_amount))
                    );
                });
                return;
            }

            if ((receipt.related_billing_record_ids || []).length === 1) {
                const billId = receipt.related_billing_record_ids?.[0];
                if (!billId) return;
                billSettledMap.set(
                    billId,
                    roundMoney((billSettledMap.get(billId) || 0) + parseMoney(receipt.amount))
                );
            }
        });

    return billSettledMap;
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
    label, value, icon: Icon, iconBg, valueClass, sub,
}: {
    label: string; value: string; icon: React.ComponentType<{ className?: string }>; iconBg: string;
    valueClass?: string; sub?: string;
}) {
    return (
        <Card className="border-none shadow-md bg-white">
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide leading-tight">{label}</p>
                        <p className={`text-xl font-black mt-0.5 leading-tight ${valueClass || 'text-foreground'}`}>{value}</p>
                        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── AddBillingDialog ─────────────────────────────────────────────────────────

function AddBillingDialog({
    open, onClose, partyId, onSuccess, consignments,
}: { open: boolean; onClose: () => void; partyId: string; onSuccess: () => void; consignments: Consignment[] }) {
    const [form, setForm] = useState({
        billing_date: new Date().toISOString().split('T')[0],
        amount: '', bill_ref_no: '', narration: '',
        covered_cn_nos: [] as string[],
    });
    const [saving, setSaving] = useState(false);

    const consignmentBreakup = useMemo(
        () => buildConsignmentBreakup(consignments, form.covered_cn_nos),
        [consignments, form.covered_cn_nos]
    );
    const billRefPrefix = useMemo(
        () => getBillRefPrefix(form.billing_date),
        [form.billing_date]
    );

    const enteredOtherChargeAmount = roundMoney(parseMoney(form.amount));
    const suggestedBillTotal = consignmentBreakup.cnChargeTotal;
    const displayedExtraChargeTotal = roundMoney(consignmentBreakup.otherChargeTotal + enteredOtherChargeAmount);
    const finalBillAmount = roundMoney(consignmentBreakup.cnChargeTotal + enteredOtherChargeAmount);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.bill_ref_no.trim()) {
            toast.error('Bill No is required');
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
                    bill_ref_no: composeBillRefNo(form.billing_date, form.bill_ref_no),
                    narration: form.narration,
                    added_other_charges_amount: enteredOtherChargeAmount,
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
            setForm({ billing_date: new Date().toISOString().split('T')[0], amount: '', bill_ref_no: '', narration: '', covered_cn_nos: [] });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to create billing record');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-[95vw] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50">
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Add Billing Record
                    </DialogTitle>
                    <DialogDescription>
                        Record a billing entry for this party. The typed amount is added into the bill other-charges column.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="grid gap-6 p-6 lg:grid-cols-[1.05fr_0.95fr]">
                        <div className="space-y-4">
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
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Covered CNs</Label>
                                <BillingConsignmentPicker
                                    consignments={consignments}
                                    value={form.covered_cn_nos}
                                    onChange={(covered_cn_nos) => setForm((f) => ({ ...f, covered_cn_nos }))}
                                />
                            </div>

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
                                        <span className="text-muted-foreground">Other Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.otherChargeTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Added Other Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(enteredOtherChargeAmount)}</span>
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
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save Billing Record
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── AddPaymentDialog ─────────────────────────────────────────────────────────

function AddPaymentDialog({
    open, onClose, partyId, onSuccess, billingRecords, paymentReceipts,
}: {
    open: boolean;
    onClose: () => void;
    partyId: string;
    onSuccess: () => void;
    billingRecords: BillingRecord[];
    paymentReceipts: PaymentReceipt[];
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

    const settledBillAmountMap = useMemo(
        () => buildSettledBillAmountMap(paymentReceipts),
        [paymentReceipts]
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
            .filter((record) => parseMoney(record.remaining_amount) > 0.009),
        [billingRecords, settledBillAmountMap]
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
            const res = await fetch(`/api/ledger/${partyId}/payments`, {
                method: 'POST',
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
                throw new Error(err.error || 'Failed to record payment');
            }
            toast.success('Payment receipt recorded successfully');
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
            toast.error(err instanceof Error ? err.message : 'Failed to record payment');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[92vw] w-[92vw] sm:max-w-5xl max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50">
                    <DialogTitle className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-primary" /> Record Payment
                    </DialogTitle>
                    <DialogDescription>
                        Link the receipt to bill numbers, enter how much is settled against each bill, and keep deduction breakup inside that settled amount.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="grid gap-6 p-6 lg:grid-cols-[0.95fr_1.05fr]">
                        <div className="space-y-4">
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
                                <BillingRecordPicker
                                    billingRecords={payableBillingRecords}
                                    value={form.related_billing_record_ids}
                                    onChange={(related_billing_record_ids) => setForm((current) => ({
                                        ...current,
                                        related_billing_record_ids,
                                        bill_allocations: syncBillAllocationDrafts(related_billing_record_ids, current.bill_allocations),
                                    }))}
                                />
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
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Record Payment
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── CancelDialog ─────────────────────────────────────────────────────────────

function CancelDialog({
    open, onClose, title, onConfirm,
}: { open: boolean; onClose: () => void; title: string; onConfirm: (reason: string) => Promise<void> }) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    const handle = async () => {
        if (!reason.trim()) { toast.error('Reason is required'); return; }
        setLoading(true);
        await onConfirm(reason.trim());
        setLoading(false);
        setReason('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-destructive flex items-center gap-2">
                        <XCircle className="h-4 w-4" /> {title}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Reason *</Label>
                        <Input placeholder="Enter reason..." value={reason} onChange={e => setReason(e.target.value)} className="h-9" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose} disabled={loading}>Back</Button>
                        <Button variant="destructive" onClick={handle} disabled={loading || !reason.trim()} className="gap-2">
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirm
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PartyLedgerPage({ params }: { params: Promise<{ partyId: string }> }) {
    const { partyId } = use(params);

    const [data, setData] = useState<{
        party: Party | null;
        account: LedgerAccount | null;
        summary: Summary;
        consignments: Consignment[];
        all_consignments: Consignment[];
        billing_records: BillingRecord[];
        payment_receipts: PaymentReceipt[];
        all_billing_records: BillingRecord[];
        all_payment_receipts: PaymentReceipt[];
    }>({
        party: null, account: null,
        summary: { total_cns_amount: 0, total_cns_count: 0, total_billed: 0, total_paid: 0, unbilled_amount: 0, overbilled_amount: 0, outstanding: 0, opening_balance: 0 },
        consignments: [], all_consignments: [], billing_records: [], payment_receipts: [], all_billing_records: [], all_payment_receipts: [],
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [cnsSearch, setCnsSearch] = useState('');
    const [billingSearch, setBillingSearch] = useState('');
    const [billingStatusFilter, setBillingStatusFilter] = useState<'all' | 'ACTIVE' | 'CANCELLED'>('all');
    const [billingDateFrom, setBillingDateFrom] = useState('');
    const [billingDateTo, setBillingDateTo] = useState('');

    // Dialogs
    const [showBillingDialog, setShowBillingDialog] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<{ type: 'billing' | 'payment'; id: string } | null>(null);
    const [selectedBillingRecord, setSelectedBillingRecord] = useState<BillingRecord | null>(null);
    const [editingBillingRecord, setEditingBillingRecord] = useState<BillingRecord | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            if (cnsSearch) params.set('search', cnsSearch);

            const res = await fetch(`/api/ledger/${partyId}?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load ledger data');
        } finally {
            setIsLoading(false);
        }
    }, [partyId, dateFrom, dateTo, cnsSearch]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(r => setIsAdmin(r?.data?.role === 'admin'))
            .catch(console.error);
    }, []);

    const handleCancelBilling = async (reason: string) => {
        if (!cancelTarget) return;
        try {
            const res = await fetch(`/api/ledger/${partyId}/billing/${cancelTarget.id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancel_reason: reason }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            toast.success('Billing record cancelled');
            fetchData();
        } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to cancel billing record'); }
        setCancelTarget(null);
    };

    const handleReversePayment = async (reason: string) => {
        if (!cancelTarget) return;
        try {
            const res = await fetch(`/api/ledger/${partyId}/payments/${cancelTarget.id}/reverse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reversal_reason: reason }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            toast.success('Payment receipt reversed');
            fetchData();
        } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to reverse payment receipt'); }
        setCancelTarget(null);
    };

    // Monthly summary (computed client-side from CNS + billing records + payments)
    const monthlySummary = useMemo(() => {
        const map: Record<string, { month: string; cns_count: number; cns_amount: number; billed: number; cn_billed: number; paid: number }> = {};

        data.consignments.forEach(c => {
            const m = c.bkg_date?.slice(0, 7) || 'unknown';
            if (!map[m]) map[m] = { month: m, cns_count: 0, cns_amount: 0, billed: 0, cn_billed: 0, paid: 0 };
            map[m].cns_count += 1;
            map[m].cns_amount += parseFloat(String(c.total_freight)) || 0;
        });

        data.billing_records.filter(b => b.status === 'ACTIVE').forEach(b => {
            const m = b.billing_date?.slice(0, 7) || 'unknown';
            if (!map[m]) map[m] = { month: m, cns_count: 0, cns_amount: 0, billed: 0, cn_billed: 0, paid: 0 };
            map[m].billed += parseFloat(String(b.amount)) || 0;
            map[m].cn_billed += parseFloat(String(b.cn_total_amount ?? b.amount)) || 0;
        });

        data.payment_receipts.filter(p => p.status === 'ACTIVE').forEach(p => {
            const m = p.receipt_date?.slice(0, 7) || 'unknown';
            if (!map[m]) map[m] = { month: m, cns_count: 0, cns_amount: 0, billed: 0, cn_billed: 0, paid: 0 };
            map[m].paid += parseFloat(String(p.amount)) || 0;
        });

        return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
    }, [data]);

    const filteredBillingRecords = useMemo(() => {
        const query = billingSearch.trim().toLowerCase();

        return data.billing_records.filter((record) => {
            if (billingStatusFilter !== 'all' && record.status !== billingStatusFilter) {
                return false;
            }

            const billingDate = record.billing_date?.slice(0, 10) || '';
            if (billingDateFrom && billingDate < billingDateFrom) {
                return false;
            }
            if (billingDateTo && billingDate > billingDateTo) {
                return false;
            }

            if (!query) return true;

            const haystack = [
                record.bill_ref_no || '',
                record.narration || '',
                (record.covered_cn_nos || []).join(' '),
                data.party?.name || '',
                data.party?.code || '',
            ].join(' ').toLowerCase();

            return haystack.includes(query);
        });
    }, [billingSearch, billingStatusFilter, billingDateFrom, billingDateTo, data.billing_records, data.party?.code, data.party?.name]);

    const billingRecordMap = useMemo(
        () => new Map(data.billing_records.map((record) => [record.id, record])),
        [data.billing_records]
    );

    const { party, summary } = data;

    if (isLoading && !party) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!party) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                Party not found. <Link href="/dashboard/ledger" className="text-primary hover:underline">Back to Ledger</Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-[#f8f9fa] animate-fadeIn">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b">
                <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/ledger">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10">
                                <ArrowLeft className="h-4 w-4 text-primary" />
                            </Button>
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold">{party.name}</h1>
                                <Badge variant="outline" className="font-mono text-xs">{party.code}</Badge>
                                <Badge className="text-[10px] capitalize bg-primary/10 text-primary border-none">
                                    {party.type}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {party.phone && <span>{party.phone} · </span>}
                                {party.gstin && <span className="font-mono">{party.gstin}</span>}
                            </p>
                        </div>
                    </div>
                    {isAdmin && (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="gap-2 h-8" onClick={() => setShowPaymentDialog(true)}>
                                <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Record Payment
                            </Button>
                            <Button size="sm" className="gap-2 h-8 shadow-md shadow-primary/20" onClick={() => setShowBillingDialog(true)}>
                                <FileText className="h-3.5 w-3.5" /> Add Billing
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 p-6 max-w-[1920px] mx-auto w-full space-y-6">

                {/* KPI Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <KpiCard
                        label="Total CNS Amount"
                        value={`₹${fmt(summary.total_cns_amount)}`}
                        sub={`${summary.total_cns_count} consignments`}
                        icon={Package}
                        iconBg="bg-primary/10"
                        valueClass="text-primary"
                    />
                    <KpiCard
                        label="Total Billed"
                        value={`₹${fmt(summary.total_billed)}`}
                        icon={TrendingUp}
                        iconBg="bg-emerald-50"
                        valueClass="text-emerald-700"
                    />
                    <KpiCard
                        label="Unbilled Amount"
                        value={`₹${fmt(summary.unbilled_amount)}`}
                        sub={summary.overbilled_amount && summary.overbilled_amount > 0 ? `Overbilled ₹${fmt(summary.overbilled_amount)}` : undefined}
                        icon={AlertCircle}
                        iconBg="bg-amber-50"
                        valueClass="text-amber-700"
                    />
                    <KpiCard
                        label="Total Paid"
                        value={`₹${fmt(summary.total_paid)}`}
                        icon={CheckCircle2}
                        iconBg="bg-indigo-50"
                        valueClass="text-indigo-700"
                    />
                    <KpiCard
                        label="Outstanding"
                        value={`₹${fmt(summary.outstanding)}`}
                        icon={DollarSign}
                        iconBg={summary.outstanding > 0 ? 'bg-red-50' : 'bg-emerald-50'}
                        valueClass={summary.outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}
                        sub={summary.outstanding > 0 ? 'Amount Due' : 'Cleared'}
                    />
                </div>

                {/* Date Filter Bar */}
                <Card className="border shadow-sm bg-card/60 backdrop-blur-xl border-border/40">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <Label className="text-xs font-bold uppercase text-muted-foreground shrink-0">Date Filter</Label>
                            <div className="flex items-center gap-2">
                                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-36 text-xs" placeholder="From" />
                                <span className="text-muted-foreground text-xs">to</span>
                                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-36 text-xs" placeholder="To" />
                            </div>
                            {(dateFrom || dateTo) && (
                                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground gap-1"
                                    onClick={() => { setDateFrom(''); setDateTo(''); }}>
                                    <RotateCcw className="h-3 w-3" /> Clear
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Tabs */}
                <Tabs defaultValue="cns" className="space-y-4">
                    <TabsList className="bg-white border shadow-sm h-10">
                        <TabsTrigger value="cns" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
                            <Truck className="h-3.5 w-3.5" /> CNS Entries ({data.consignments.length})
                        </TabsTrigger>
                        <TabsTrigger value="billing" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
                            <FileText className="h-3.5 w-3.5" /> Billing Records ({data.billing_records.length})
                        </TabsTrigger>
                        <TabsTrigger value="payments" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
                            <CreditCard className="h-3.5 w-3.5" /> Payments ({data.payment_receipts.length})
                        </TabsTrigger>
                        <TabsTrigger value="monthly" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
                            <Building2 className="h-3.5 w-3.5" /> Monthly Summary
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Tab 1: CNS Entries ── */}
                    <TabsContent value="cns" className="mt-0">
                        <Card className="border-none shadow-md bg-white">
                            <CardHeader className="flex flex-row items-center justify-between py-3 px-6 border-b">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Truck className="h-4 w-4 text-primary" /> All CNS Entries
                                </CardTitle>
                                <div className="relative w-56">
                                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search CN No..." className="pl-9 h-8 text-xs" value={cnsSearch}
                                        onChange={e => setCnsSearch(e.target.value)} />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="font-bold text-xs py-3">CN No</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Date</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Route</TableHead>
                                            <TableHead className="font-bold text-xs py-3 text-center">Pkgs</TableHead>
                                            <TableHead className="font-bold text-xs py-3 text-right">Weight</TableHead>
                                            <TableHead className="font-bold text-xs py-3 text-right">Freight</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Basis</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.consignments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground text-sm">
                                                    No CNS entries found for this party
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            data.consignments.map(c => (
                                                <TableRow key={c.id} className="hover:bg-primary/5 transition-colors border-b last:border-0">
                                                    <TableCell>
                                                        <Link href={`/dashboard/consignments`}
                                                            className="font-bold text-primary text-xs hover:underline font-mono">
                                                            {c.cn_no}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{fmtDate(c.bkg_date)}</TableCell>
                                                    <TableCell className="text-xs">
                                                        <span className="font-medium">{c.booking_branch}</span>
                                                        <span className="text-muted-foreground mx-1">→</span>
                                                        <span className="font-medium">{c.dest_branch}</span>
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs">{c.no_of_pkg}</TableCell>
                                                    <TableCell className="text-right text-xs font-mono">
                                                        {(c.actual_weight || 0).toFixed(1)} {c.load_unit || 'KG'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="font-black text-xs text-foreground font-mono">
                                                            ₹{fmt(c.total_freight)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline"
                                                            className={`text-[9px] px-1.5 py-0 h-4 ${BASIS_BADGE[c.bkg_basis] || ''}`}>
                                                            {c.bkg_basis}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                {data.consignments.length > 0 && (
                                    <div className="px-6 py-3 border-t bg-muted/10 flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">{data.consignments.length} entries</span>
                                        <span className="text-sm font-black text-primary font-mono">
                                            Total: ₹{fmt(data.consignments.reduce((s, c) => s + (parseFloat(String(c.total_freight)) || 0), 0))}
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Tab 2: Billing Records ── */}
                    <TabsContent value="billing" className="mt-0">
                        <Card className="border-none shadow-md bg-white">
                            <CardHeader className="flex flex-row items-center justify-between py-3 px-6 border-b">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" /> Billing Records
                                </CardTitle>
                                {isAdmin && (
                                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowBillingDialog(true)}>
                                        <Plus className="h-3.5 w-3.5" /> Add Billing
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="px-6 py-4 border-b bg-muted/10">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="relative min-w-[240px] flex-1">
                                            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search bill ref, narration or CN..."
                                                className="pl-9 h-8 text-xs"
                                                value={billingSearch}
                                                onChange={(e) => setBillingSearch(e.target.value)}
                                            />
                                        </div>
                                        <Select
                                            value={billingStatusFilter}
                                            onValueChange={(value: 'all' | 'ACTIVE' | 'CANCELLED') => setBillingStatusFilter(value)}
                                        >
                                            <SelectTrigger className="h-8 w-[160px] text-xs">
                                                <SelectValue placeholder="All Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Status</SelectItem>
                                                <SelectItem value="ACTIVE">Active</SelectItem>
                                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            type="date"
                                            value={billingDateFrom}
                                            onChange={(e) => setBillingDateFrom(e.target.value)}
                                            className="h-8 w-[150px] text-xs"
                                        />
                                        <Input
                                            type="date"
                                            value={billingDateTo}
                                            onChange={(e) => setBillingDateTo(e.target.value)}
                                            className="h-8 w-[150px] text-xs"
                                        />
                                        {(billingSearch || billingStatusFilter !== 'all' || billingDateFrom || billingDateTo) && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 gap-1 text-xs"
                                                onClick={() => {
                                                    setBillingSearch('');
                                                    setBillingStatusFilter('all');
                                                    setBillingDateFrom('');
                                                    setBillingDateTo('');
                                                }}
                                            >
                                                <RotateCcw className="h-3 w-3" /> Reset
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="font-bold text-xs py-3">Bill Ref</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Date</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Period</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Narration</TableHead>
                                            <TableHead className="font-bold text-xs py-3">CNs</TableHead>
                                            <TableHead className="font-bold text-xs py-3 text-right">Amount</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Status</TableHead>
                                            <TableHead className="py-3" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBillingRecords.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground text-sm">
                                                    No billing records found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredBillingRecords.map(b => (
                                                <TableRow key={b.id} className={`hover:bg-primary/5 transition-colors border-b last:border-0 ${b.status === 'CANCELLED' ? 'opacity-50' : ''}`}>
                                                    <TableCell className="font-mono text-xs text-primary font-bold">{b.bill_ref_no || '—'}</TableCell>
                                                    <TableCell className="text-xs">{fmtDate(b.billing_date)}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {b.billing_period_from ? `${fmtDate(b.billing_period_from)} – ${fmtDate(b.billing_period_to)}` : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-xs max-w-[180px] truncate" title={b.narration}>{b.narration}</TableCell>
                                                    <TableCell className="text-xs font-mono text-muted-foreground">
                                                        {b.covered_cn_nos?.join(', ') || '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-black text-sm text-emerald-700 font-mono">
                                                        ₹{fmt(b.amount)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={b.status === 'ACTIVE' ? 'default' : 'outline'}
                                                            className={`text-[9px] px-1.5 py-0 h-4 ${b.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                            {b.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 px-2 text-xs"
                                                                onClick={() => setSelectedBillingRecord(b)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5 mr-1" /> View
                                                            </Button>
                                                            {isAdmin && b.status === 'ACTIVE' && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                                                                        onClick={() => setEditingBillingRecord(b)}
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                                                    </Button>
                                                                    <Button size="sm" variant="ghost"
                                                                        className="h-7 px-2 text-destructive hover:bg-destructive/10 text-xs"
                                                                        onClick={() => setCancelTarget({ type: 'billing', id: b.id })}>
                                                                        Cancel
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                {filteredBillingRecords.length > 0 && (
                                    <div className="px-6 py-3 border-t bg-muted/10 flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">
                                            Showing {filteredBillingRecords.length} of {data.billing_records.length} records
                                        </span>
                                        <span className="text-sm font-black text-emerald-700 font-mono">
                                            Active Total: ₹{fmt(filteredBillingRecords.filter(b => b.status === 'ACTIVE').reduce((s, b) => s + (parseFloat(String(b.amount)) || 0), 0))}
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Tab 3: Payments ── */}
                    <TabsContent value="payments" className="mt-0">
                        <Card className="border-none shadow-md bg-white">
                            <CardHeader className="flex flex-row items-center justify-between py-3 px-6 border-b">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-primary" /> Payment Receipts
                                </CardTitle>
                                {isAdmin && (
                                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowPaymentDialog(true)}>
                                        <Plus className="h-3.5 w-3.5" /> Record Payment
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="font-bold text-xs py-3">Date</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Mode</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Bills / Breakup</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Reference</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Bank</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Narration</TableHead>
                                            <TableHead className="font-bold text-xs py-3 text-right">Settled</TableHead>
                                            <TableHead className="font-bold text-xs py-3">Status</TableHead>
                                            {isAdmin && <TableHead className="py-3" />}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.payment_receipts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={isAdmin ? 9 : 8} className="h-24 text-center text-muted-foreground text-sm">
                                                    No payment receipts yet
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            data.payment_receipts.map(p => (
                                                <TableRow key={p.id} className={`hover:bg-primary/5 transition-colors border-b last:border-0 ${p.status === 'REVERSED' ? 'opacity-50' : ''}`}>
                                                    <TableCell className="text-xs">{fmtDate(p.receipt_date)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${MODE_BADGE[p.payment_mode] || ''}`}>
                                                            {p.payment_mode}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                                                        {(p.bill_allocations || []).length > 0 ? (
                                                            <div className="space-y-2 py-1">
                                                                {p.bill_allocations?.map((allocation) => {
                                                                    const bill = billingRecordMap.get(allocation.billing_record_id);
                                                                    const deductionTotal = (allocation.deduction_items || []).reduce((sum, item) => sum + parseMoney(item.amount), 0);
                                                                    return (
                                                                        <div key={`${p.id}-${allocation.billing_record_id}`} className="rounded-md border bg-muted/10 px-2.5 py-2">
                                                                            <div className="font-mono text-[11px] font-bold text-primary">
                                                                                {bill?.bill_ref_no || bill?.id.slice(0, 8).toUpperCase() || '—'}
                                                                            </div>
                                                                            <div className="mt-1 text-[11px]">
                                                                                Settled ₹{fmt(parseMoney(allocation.settled_amount))} • Received ₹{fmt(parseMoney(allocation.received_amount))}
                                                                            </div>
                                                                            {deductionTotal > 0 && (
                                                                                <>
                                                                                    <div className="mt-1 text-[11px] text-amber-700">
                                                                                        Deductions ₹{fmt(deductionTotal)}
                                                                                    </div>
                                                                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                                                                        {(allocation.deduction_items || [])
                                                                                            .map((item) => `${item.label} ₹${fmt(parseMoney(item.amount))}`)
                                                                                            .join(', ')}
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                            {(bill?.covered_cn_nos || []).length > 0 && (
                                                                                <div className="mt-1 text-[11px] truncate">
                                                                                    CNs: {bill?.covered_cn_nos?.join(', ')}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : p.related_billing_record_ids && p.related_billing_record_ids.length > 0
                                                            ? p.related_billing_record_ids
                                                                .map((id) => billingRecordMap.get(id)?.bill_ref_no || billingRecordMap.get(id)?.id.slice(0, 8).toUpperCase() || '—')
                                                                .join(', ')
                                                            : '—'}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{p.reference_no || '—'}</TableCell>
                                                    <TableCell className="text-xs">{p.bank_name || '—'}</TableCell>
                                                    <TableCell className="text-xs max-w-[180px] truncate" title={p.narration || ''}>{p.narration || '—'}</TableCell>
                                                    <TableCell className="text-right font-black text-sm text-indigo-700 font-mono">
                                                        <div>₹{fmt(p.amount)}</div>
                                                        <div className="text-[11px] font-semibold text-slate-600">
                                                            Rec ₹{fmt(parseMoney(p.actual_received_amount ?? p.amount))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={p.status === 'ACTIVE' ? 'default' : 'outline'}
                                                            className={`text-[9px] px-1.5 py-0 h-4 ${p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                            {p.status}
                                                        </Badge>
                                                    </TableCell>
                                                    {isAdmin && (
                                                        <TableCell className="text-right">
                                                            {p.status === 'ACTIVE' && (
                                                                <Button size="sm" variant="ghost"
                                                                    className="h-7 px-2 text-destructive hover:bg-destructive/10 text-xs"
                                                                    onClick={() => setCancelTarget({ type: 'payment', id: p.id })}>
                                                                    Reverse
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                {data.payment_receipts.filter(p => p.status === 'ACTIVE').length > 0 && (
                                    <div className="px-6 py-3 border-t bg-muted/10 flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">
                                            Active: {data.payment_receipts.filter(p => p.status === 'ACTIVE').length} receipts
                                        </span>
                                        <span className="text-sm font-black text-indigo-700 font-mono">
                                            Total: ₹{fmt(data.payment_receipts.filter(p => p.status === 'ACTIVE').reduce((s, p) => s + (parseFloat(String(p.amount)) || 0), 0))}
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Tab 4: Monthly Summary ── */}
                    <TabsContent value="monthly" className="mt-0">
                        <Card className="border-none shadow-md bg-white">
                            <CardHeader className="py-3 px-6 border-b">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary" /> Monthly Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="font-bold text-xs py-3">Month</TableHead>
                                            <TableHead className="font-bold text-xs py-3 text-center">CNS Count</TableHead>
                                            <TableHead className="font-bold text-xs py-3 text-right">CNS Amount</TableHead>
                                            <TableHead className="font-bold text-xs py-3 text-right">Billed</TableHead>
                                            <TableHead className="font-bold text-xs py-3 text-right">Paid</TableHead>
                                            <TableHead className="font-bold text-xs py-3 text-right">Unbilled</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlySummary.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
                                                    No data available
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            monthlySummary.map(m => (
                                                <TableRow key={m.month} className="hover:bg-primary/5 transition-colors border-b last:border-0">
                                                    <TableCell className="font-bold text-sm">
                                                        {m.month ? format(new Date(m.month + '-01'), 'MMMM yyyy') : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className="font-bold">{m.cns_count}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-foreground">₹{fmt(m.cns_amount)}</TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-emerald-700">₹{fmt(m.billed)}</TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-indigo-700">₹{fmt(m.paid)}</TableCell>
                                                    <TableCell className="text-right">
                                                        {m.cns_amount - m.cn_billed > 0 ? (
                                                            <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                                                ₹{fmt(m.cns_amount - m.cn_billed)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-emerald-700 font-mono font-bold">Fully Billed</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Dialogs */}
            <AddBillingDialog
                open={showBillingDialog}
                onClose={() => setShowBillingDialog(false)}
                partyId={partyId}
                onSuccess={fetchData}
                consignments={data.consignments}
            />
            <EditBillingDialog
                open={!!editingBillingRecord}
                onClose={() => setEditingBillingRecord(null)}
                partyId={partyId}
                record={editingBillingRecord}
                onSuccess={fetchData}
                consignments={data.all_consignments}
            />
            <AddPaymentDialog
                open={showPaymentDialog}
                onClose={() => setShowPaymentDialog(false)}
                partyId={partyId}
                onSuccess={fetchData}
                billingRecords={data.all_billing_records}
                paymentReceipts={data.all_payment_receipts}
            />
            <BillingRecordViewDialog
                open={!!selectedBillingRecord}
                onClose={() => setSelectedBillingRecord(null)}
                party={party}
                record={selectedBillingRecord}
                consignments={data.all_consignments}
                isAdmin={isAdmin}
                onEdit={() => {
                    if (!selectedBillingRecord) return;
                    setEditingBillingRecord(selectedBillingRecord);
                    setSelectedBillingRecord(null);
                }}
            />
            {cancelTarget && (
                <CancelDialog
                    open={true}
                    onClose={() => setCancelTarget(null)}
                    title={cancelTarget.type === 'billing' ? 'Cancel Billing Record' : 'Reverse Payment Receipt'}
                    onConfirm={cancelTarget.type === 'billing' ? handleCancelBilling : handleReversePayment}
                />
            )}
        </div>
    );
}
