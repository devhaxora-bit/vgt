'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Loader2, Pencil, Printer } from 'lucide-react';

import { numberToWords } from '@/lib/utils';
import { composeBillRefNo, getBillRefPrefix, splitBillRefSuffix } from '@/lib/billRef';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { BillingConsignmentPicker, type BillingConsignmentOption } from '@/components/features/ledger/BillingConsignmentPicker';

interface PartyInfo {
    id: string;
    name: string;
    code: string;
    type: string;
    phone?: string;
    gstin?: string;
    address?: string;
    branch_code?: string;
}

interface BillingRecord {
    id: string;
    billing_date: string;
    billing_period_from?: string;
    billing_period_to?: string;
    amount: number;
    cn_total_amount?: number;
    added_other_charges_amount?: number;
    bill_ref_no?: string;
    narration: string;
    covered_cn_nos?: string[];
    consignment_snapshot?: unknown[];
    extra_charge_items?: BillingExtraChargeItem[];
    status: string;
    cancel_reason?: string;
    cancelled_at?: string;
}

interface BillingExtraChargeItem {
    label: string;
    amount: number;
}

interface Consignment {
    id: string;
    cn_no: string;
    invoice_no?: string;
    bkg_date: string;
    booking_branch: string;
    loading_point?: string;
    dest_branch: string;
    delivery_point?: string;
    no_of_pkg: number;
    actual_weight: number;
    charged_weight: number;
    load_unit: string;
    total_freight: number;
    basic_freight?: number;
    freight_rate?: number;
    unload_charges?: number;
    retention_charges?: number;
    extra_km_charges?: number;
    mhc_charges?: number;
    door_coll_charges?: number;
    door_del_charges?: number;
    other_charges?: number;
    vehicle_no?: string;
    bkg_basis: string;
    goods_desc?: string;
    delivery_type?: string;
}

interface BillingConsignmentSnapshotRow {
    cn_no: string;
    bkg_date: string | null;
    invoice_no: string | null;
    vehicle_no: string | null;
    booking_branch: string | null;
    loading_station: string | null;
    delivery_station: string | null;
    charge_wt: string | null;
    freight_rate: number;
    freight: number;
    unloading: number;
    detention: number;
    extra_km: number;
    loading: number;
    door_collection: number;
    door_delivery: number;
    other_charges: number;
    total_amount: number;
}

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
};

const normalizeDate = (value?: string | null) => {
    if (!value) return '';
    return value.slice(0, 10);
};

const fmtDotDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}.${month}.${year}`;
};

const toUpperText = (value?: string | null) => String(value || '').trim().toUpperCase();

const splitAddressLines = (address?: string | null) => {
    const normalized = String(address || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    if (!normalized) return ['ADDRESS NOT AVAILABLE', ''];

    if (normalized.length <= 42) return [normalized, ''];

    const midpoint = Math.floor(normalized.length / 2);
    let splitIndex = -1;

    for (let offset = 0; offset < normalized.length / 2; offset += 1) {
        const right = midpoint + offset;
        const left = midpoint - offset;

        if (normalized[right] === ' ' || normalized[right] === ',') {
            splitIndex = right;
            break;
        }

        if (normalized[left] === ' ' || normalized[left] === ',') {
            splitIndex = left;
            break;
        }
    }

    if (splitIndex <= 0) {
        splitIndex = normalized.indexOf(' ', 32);
    }

    if (splitIndex <= 0) return [normalized, ''];

    return [
        normalized.slice(0, splitIndex).replace(/[,\s]+$/g, '').trim(),
        normalized.slice(splitIndex + 1).replace(/^[,\s]+/g, '').trim(),
    ];
};

const parseMoney = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const buildChargeWeight = (consignment: Pick<Consignment, 'charged_weight' | 'actual_weight' | 'load_unit'>) => {
    const weight = parseMoney(consignment.charged_weight) || parseMoney(consignment.actual_weight);
    if (weight <= 0) return null;

    const unit = String(consignment.load_unit || '').trim().toUpperCase();
    return `${weight}${unit ? ` ${unit}` : ''}`.trim();
};

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

const buildConsignmentBreakup = (
    consignments: Array<Pick<Consignment, 'basic_freight' | 'total_freight' | 'unload_charges' | 'retention_charges' | 'extra_km_charges' | 'mhc_charges' | 'door_coll_charges' | 'door_del_charges' | 'other_charges'>>
) => {
    const initialTotals = {
        freightTotal: 0,
        unloadingTotal: 0,
        detentionTotal: 0,
        extraKmTotal: 0,
        loadingChargeTotal: 0,
        doorCollectionTotal: 0,
        doorDeliveryTotal: 0,
        otherChargeTotal: 0,
        cnChargeTotal: 0,
    };

    return consignments.reduce((totals, consignment) => {
        const breakdown = getConsignmentChargeBreakdown(consignment);

        totals.freightTotal += breakdown.freight;
        totals.unloadingTotal += breakdown.unloading;
        totals.detentionTotal += breakdown.detention;
        totals.extraKmTotal += breakdown.extraKm;
        totals.loadingChargeTotal += breakdown.loading;
        totals.doorCollectionTotal += breakdown.doorCollection;
        totals.doorDeliveryTotal += breakdown.doorDelivery;
        totals.otherChargeTotal += breakdown.other;
        totals.cnChargeTotal += breakdown.total;

        return totals;
    }, initialTotals);
};

const getSavedAddedOtherChargesAmount = (record: BillingRecord | null, fallbackCnTotal = 0) => {
    if (!record) return 0;

    if (record.added_other_charges_amount !== null && record.added_other_charges_amount !== undefined) {
        return roundMoney(parseMoney(record.added_other_charges_amount));
    }

    return roundMoney(parseMoney(record.amount) - fallbackCnTotal);
};

const normalizeSnapshotRows = (value: unknown): BillingConsignmentSnapshotRow[] => {
    if (!Array.isArray(value)) return [];

    return value.reduce<BillingConsignmentSnapshotRow[]>((rows, row) => {
            const snapshotRow = row as Record<string, unknown>;
            const cnNo = String(snapshotRow.cn_no || '').trim();
            if (!cnNo) return rows;

            rows.push({
                cn_no: cnNo,
                bkg_date: snapshotRow.bkg_date ? String(snapshotRow.bkg_date) : null,
                invoice_no: snapshotRow.invoice_no ? String(snapshotRow.invoice_no) : cnNo,
                vehicle_no: snapshotRow.vehicle_no ? String(snapshotRow.vehicle_no) : null,
                booking_branch: snapshotRow.booking_branch ? String(snapshotRow.booking_branch) : null,
                loading_station: snapshotRow.loading_station ? String(snapshotRow.loading_station) : null,
                delivery_station: snapshotRow.delivery_station ? String(snapshotRow.delivery_station) : null,
                charge_wt: snapshotRow.charge_wt ? String(snapshotRow.charge_wt) : null,
                freight_rate: roundMoney(parseMoney(snapshotRow.freight_rate)),
                freight: roundMoney(parseMoney(snapshotRow.freight)),
                unloading: roundMoney(parseMoney(snapshotRow.unloading)),
                detention: roundMoney(parseMoney(snapshotRow.detention)),
                extra_km: roundMoney(parseMoney(snapshotRow.extra_km)),
                loading: roundMoney(parseMoney(snapshotRow.loading)),
                door_collection: roundMoney(parseMoney(snapshotRow.door_collection)),
                door_delivery: roundMoney(parseMoney(snapshotRow.door_delivery)),
                other_charges: roundMoney(parseMoney(snapshotRow.other_charges)),
                total_amount: roundMoney(parseMoney(snapshotRow.total_amount)),
            });

            return rows;
        }, []);
};

const buildLiveSnapshotRows = (record: BillingRecord, consignments: Consignment[]) => {
    const coveredConsignments = buildCoveredConsignments(record, consignments);
    const liveBreakup = buildConsignmentBreakup(coveredConsignments);
    const addedOtherChargesAmount = getSavedAddedOtherChargesAmount(record, liveBreakup.cnChargeTotal);

    return coveredConsignments.map((consignment, index) => {
        const breakdown = getConsignmentChargeBreakdown(consignment);
        const isLastRow = index === coveredConsignments.length - 1;
        const mergedOtherCharges = roundMoney(breakdown.other + (isLastRow ? addedOtherChargesAmount : 0));
        const mergedTotalAmount = roundMoney(breakdown.total + (isLastRow ? addedOtherChargesAmount : 0));

        return {
            cn_no: consignment.cn_no,
            bkg_date: consignment.bkg_date || null,
            invoice_no: consignment.invoice_no || consignment.cn_no || null,
            vehicle_no: consignment.vehicle_no || null,
            booking_branch: consignment.booking_branch || null,
            loading_station: consignment.loading_point || consignment.booking_branch || null,
            delivery_station: consignment.delivery_point || consignment.dest_branch || null,
            charge_wt: buildChargeWeight(consignment),
            freight_rate: roundMoney(parseMoney(consignment.freight_rate)),
            freight: breakdown.freight,
            unloading: breakdown.unloading,
            detention: breakdown.detention,
            extra_km: breakdown.extraKm,
            loading: breakdown.loading,
            door_collection: breakdown.doorCollection,
            door_delivery: breakdown.doorDelivery,
            other_charges: mergedOtherCharges,
            total_amount: mergedTotalAmount,
        };
    });
};

const buildBillDetailRows = (record: BillingRecord, consignments: Consignment[]) => {
    const snapshotRows = normalizeSnapshotRows(record.consignment_snapshot);
    if (snapshotRows.length > 0) return snapshotRows;
    return buildLiveSnapshotRows(record, consignments);
};

const buildSnapshotBreakup = (
    rows: BillingConsignmentSnapshotRow[],
    addedOtherChargesAmount: number
) => {
    const normalizedAddedOtherChargesAmount = roundMoney(addedOtherChargesAmount);

    if (rows.length === 0) {
        return {
            freightTotal: 0,
            unloadingTotal: 0,
            detentionTotal: 0,
            extraKmTotal: 0,
            loadingChargeTotal: 0,
            doorCollectionTotal: 0,
            doorDeliveryTotal: 0,
            otherChargeTotal: 0,
            billOtherChargeTotal: normalizedAddedOtherChargesAmount,
            cnChargeTotal: 0,
            addedOtherChargesAmount: normalizedAddedOtherChargesAmount,
            finalBillAmount: normalizedAddedOtherChargesAmount,
        };
    }

    const totals = rows.reduce((summary, row) => {
        summary.freightTotal += row.freight;
        summary.unloadingTotal += row.unloading;
        summary.detentionTotal += row.detention;
        summary.extraKmTotal += row.extra_km;
        summary.loadingChargeTotal += row.loading;
        summary.doorCollectionTotal += row.door_collection;
        summary.doorDeliveryTotal += row.door_delivery;
        summary.billOtherChargeTotal += row.other_charges;
        summary.finalBillAmount += row.total_amount;
        return summary;
    }, {
        freightTotal: 0,
        unloadingTotal: 0,
        detentionTotal: 0,
        extraKmTotal: 0,
        loadingChargeTotal: 0,
        doorCollectionTotal: 0,
        doorDeliveryTotal: 0,
        billOtherChargeTotal: 0,
        finalBillAmount: 0,
    });

    const normalizedFinalBillAmount = roundMoney(totals.finalBillAmount);
    const normalizedBillOtherChargeTotal = roundMoney(totals.billOtherChargeTotal);

    return {
        freightTotal: roundMoney(totals.freightTotal),
        unloadingTotal: roundMoney(totals.unloadingTotal),
        detentionTotal: roundMoney(totals.detentionTotal),
        extraKmTotal: roundMoney(totals.extraKmTotal),
        loadingChargeTotal: roundMoney(totals.loadingChargeTotal),
        doorCollectionTotal: roundMoney(totals.doorCollectionTotal),
        doorDeliveryTotal: roundMoney(totals.doorDeliveryTotal),
        otherChargeTotal: roundMoney(normalizedBillOtherChargeTotal - normalizedAddedOtherChargesAmount),
        billOtherChargeTotal: normalizedBillOtherChargeTotal,
        cnChargeTotal: roundMoney(normalizedFinalBillAmount - normalizedAddedOtherChargesAmount),
        addedOtherChargesAmount: normalizedAddedOtherChargesAmount,
        finalBillAmount: normalizedFinalBillAmount,
    };
};

const getBillDownloadName = (billRefNo?: string | null, recordId?: string) => {
    const rawValue = String(billRefNo || recordId || 'billing-record').trim();
    const safeValue = rawValue
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();

    const finalValue = /-\d+$/.test(safeValue) ? safeValue : `${safeValue}-1`;
    return `Bill no.${finalValue}.pdf`;
};

const formatTableAmount = (value: number) => (Math.abs(value) < 0.01 ? '' : fmt(value));

const formatSignedTableAmount = (value: number) => {
    if (Math.abs(value) < 0.01) return '';
    const absoluteValue = fmt(Math.abs(value));
    return value < 0 ? `-${absoluteValue}` : absoluteValue;
};

function buildCoveredConsignments(record: BillingRecord, consignments: Consignment[]) {
    const covered = new Set((record.covered_cn_nos || []).map((cn) => cn.trim()).filter(Boolean));
    if (covered.size > 0) {
        const order = new Map((record.covered_cn_nos || []).map((cn, index) => [cn.trim(), index]));
        return consignments
            .filter((c) => covered.has(c.cn_no))
            .sort((a, b) => (order.get(a.cn_no) ?? 9999) - (order.get(b.cn_no) ?? 9999));
    }

    if (record.billing_period_from || record.billing_period_to) {
        return consignments.filter((c) => {
            const bookingDate = c.bkg_date?.slice(0, 10) || '';
            if (record.billing_period_from && bookingDate < record.billing_period_from) return false;
            if (record.billing_period_to && bookingDate > record.billing_period_to) return false;
            return true;
        });
    }

    return [];
}

export function EditBillingDialog({
    open,
    onClose,
    partyId,
    record,
    onSuccess,
    consignments,
}: {
    open: boolean;
    onClose: () => void;
    partyId: string;
    record: BillingRecord | null;
    onSuccess: () => void;
    consignments: BillingConsignmentOption[];
}) {
    const [form, setForm] = useState({
        billing_date: '',
        amount: '',
        bill_ref_no: '',
        narration: '',
        covered_cn_nos: [] as string[],
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!record) return;

        const savedAddedOtherCharges = getSavedAddedOtherChargesAmount(record);
        setForm({
            billing_date: normalizeDate(record.billing_date),
            amount: Math.abs(savedAddedOtherCharges) < 0.01 ? '' : savedAddedOtherCharges.toFixed(2),
            bill_ref_no: splitBillRefSuffix(record.bill_ref_no, record.billing_date),
            narration: record.narration || '',
            covered_cn_nos: record.covered_cn_nos || [],
        });
    }, [record, consignments]);

    const selectedConsignments = useMemo(
        () => consignments.filter((consignment) => form.covered_cn_nos.includes(consignment.cn_no)),
        [consignments, form.covered_cn_nos]
    );

    const consignmentBreakup = useMemo(
        () => buildConsignmentBreakup(selectedConsignments),
        [selectedConsignments]
    );
    const billRefPrefix = useMemo(
        () => getBillRefPrefix(form.billing_date),
        [form.billing_date]
    );

    const enteredOtherChargeAmount = roundMoney(parseMoney(form.amount));
    const suggestedBillTotal = consignmentBreakup.cnChargeTotal;
    const displayedOtherChargeTotal = roundMoney(consignmentBreakup.otherChargeTotal + enteredOtherChargeAmount);
    const finalBillAmount = roundMoney(consignmentBreakup.cnChargeTotal + enteredOtherChargeAmount);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!record) return;
        if (finalBillAmount <= 0) {
            toast.error('Bill amount must be greater than zero');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/ledger/${partyId}/billing/${record.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    billing_date: form.billing_date,
                    added_other_charges_amount: enteredOtherChargeAmount,
                    bill_ref_no: composeBillRefNo(form.billing_date, form.bill_ref_no) || null,
                    narration: form.narration.trim(),
                    covered_cn_nos: form.covered_cn_nos.length > 0 ? form.covered_cn_nos : null,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update billing record');
            }

            toast.success('Billing record updated');
            onSuccess();
            onClose();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to update billing record');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-[95vw] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50">
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-primary" /> Edit Billing Record
                    </DialogTitle>
                    <DialogDescription>
                        Update the bill details here. The typed amount is added into the bill other-charges column.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="grid gap-6 p-6 lg:grid-cols-[1.05fr_0.95fr]">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Billing Date *</Label>
                                    <Input type="date" value={form.billing_date} onChange={(e) => setForm((f) => ({ ...f, billing_date: e.target.value }))} className="h-9" required />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Bill Ref No</Label>
                                    <div className="flex h-9 overflow-hidden rounded-md border bg-background shadow-sm">
                                        <div className="flex items-center border-r bg-muted/40 px-3 text-xs font-bold text-muted-foreground">
                                            {billRefPrefix}
                                        </div>
                                        <Input
                                            value={form.bill_ref_no}
                                            onChange={(e) => setForm((f) => ({ ...f, bill_ref_no: e.target.value }))}
                                            className="h-full border-0 shadow-none focus-visible:ring-0"
                                            placeholder="Enter bill number"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Add In Other Charges (₹)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={form.amount}
                                        onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                        className="h-9 font-mono"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setForm((current) => ({
                                        ...current,
                                        amount: '',
                                    }))}
                                >
                                    Use CN Total
                                </Button>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Description</Label>
                                <Input value={form.narration} onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))} className="h-9" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">CNs Covered</Label>
                                <BillingConsignmentPicker
                                    consignments={consignments}
                                    value={form.covered_cn_nos}
                                    onChange={(covered_cn_nos) => setForm((f) => ({ ...f, covered_cn_nos }))}
                                />
                            </div>

                            <div className="rounded-lg border bg-muted/10">
                                <div className="border-b px-4 py-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Updated Bill Breakup</div>
                                    <div className="text-xs text-muted-foreground">Every CN freight-detail charge is shown here. The entered amount is added on top and shown inside bill other charges.</div>
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
                                        <span className="text-muted-foreground">CN Other Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.otherChargeTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Added Other Charges</span>
                                        <span className="font-mono font-semibold">₹{fmt(enteredOtherChargeAmount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Bill Other Charges Column</span>
                                        <span className="font-mono font-semibold">₹{fmt(displayedOtherChargeTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">CN Total</span>
                                        <span className="font-mono font-semibold">₹{fmt(consignmentBreakup.cnChargeTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-t pt-2 font-bold">
                                        <span>Final Bill Amount</span>
                                        <span className="font-mono text-primary">₹{fmt(finalBillAmount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">CN Total Without Added Amount</span>
                                        <span className="font-mono font-semibold">₹{fmt(suggestedBillTotal)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function BillingRecordViewDialog({
    open,
    onClose,
    party,
    record,
    consignments,
    isAdmin,
    onEdit,
}: {
    open: boolean;
    onClose: () => void;
    party: PartyInfo | null;
    record: BillingRecord | null;
    consignments: Consignment[];
    isAdmin: boolean;
    onEdit: () => void;
}) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [logoBase64, setLogoBase64] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const loadLogo = async () => {
            try {
                const res = await fetch('/vgt_logo.png');
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (active) setLogoBase64(typeof reader.result === 'string' ? reader.result : null);
                };
                reader.readAsDataURL(blob);
            } catch {
                if (active) setLogoBase64(null);
            }
        };
        void loadLogo();
        return () => { active = false; };
    }, []);

    const billDetailRows = useMemo(() => {
        if (!record) return [];
        return buildBillDetailRows(record, consignments);
    }, [record, consignments]);

    const billAmount = roundMoney(parseMoney(record?.amount));
    const addedOtherChargesAmount = useMemo(
        () => getSavedAddedOtherChargesAmount(record),
        [record]
    );
    const consignmentBreakup = useMemo(
        () => buildSnapshotBreakup(billDetailRows, addedOtherChargesAmount),
        [billDetailRows, addedOtherChargesAmount]
    );
    const issuingBranch = billDetailRows[0]?.booking_branch || party?.branch_code || '—';

    const handlePrint = async (mode: 'print' | 'download') => {
        if (!party || !record) return;

        const logoUrl = logoBase64 || `${window.location.origin}/vgt_logo.png`;
        const displayTotal = roundMoney(parseMoney(record.amount));
        const branchDisplay = (() => {
            const normalized = toUpperText(issuingBranch);
            if (!normalized || normalized === '—') return 'Vizianagaram';
            if (normalized === 'VZM' || normalized === 'VIZIANAGARAM') return 'Vizianagaram';
            return normalized.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
        })();
        const partyName = toUpperText(party.name).startsWith('M/S')
            ? toUpperText(party.name)
            : `M/S. ${toUpperText(party.name)}`;
        const [addressLine1, addressLine2] = splitAddressLines(party.address);
        const amountWords = numberToWords(displayTotal).replace(/^Rupees\s+/i, '').trim();
        const narrationHtml = record.narration
            ? `<div class="remark-title">Remarks :</div><div>${record.narration}</div>`
            : '';
        const detailRows = billDetailRows.length > 0
            ? billDetailRows.map((row) => ({
                cnNo: row.cn_no || '—',
                date: fmtDotDate(row.bkg_date),
                invoiceNo: row.invoice_no || row.cn_no || '—',
                vehicleNo: toUpperText(row.vehicle_no) || '—',
                loadingStation: toUpperText(row.loading_station || row.booking_branch) || '—',
                deliveryStation: toUpperText(row.delivery_station) || '—',
                chargeWt: row.charge_wt || '—',
                rate: row.freight_rate > 0 ? fmt(row.freight_rate) : '',
                freight: formatTableAmount(row.freight),
                unloading: formatTableAmount(row.unloading),
                detention: formatTableAmount(row.detention),
                extraKm: formatTableAmount(row.extra_km),
                loading: formatTableAmount(row.loading),
                doorCollection: formatTableAmount(row.door_collection),
                doorDelivery: formatTableAmount(row.door_delivery),
                otherCharges: formatSignedTableAmount(row.other_charges),
                totalAmount: formatSignedTableAmount(row.total_amount),
            }))
            : [{
                cnNo: record.bill_ref_no || '—',
                date: fmtDotDate(record.billing_date),
                invoiceNo: record.bill_ref_no || '—',
                vehicleNo: '—',
                loadingStation: toUpperText(issuingBranch) || '—',
                deliveryStation: '—',
                chargeWt: '—',
                rate: '',
                freight: '',
                unloading: '',
                detention: '',
                extraKm: '',
                loading: '',
                doorCollection: '',
                doorDelivery: '',
                otherCharges: '',
                totalAmount: fmt(displayTotal),
            }];
        const minimumDetailRows = Math.max(8, detailRows.length);
        const coveredRows = detailRows.map((row) => `
                <tr class="item-row">
                    <td class="center">${row.cnNo}</td>
                    <td class="center">${row.date}</td>
                    <td class="center">${row.invoiceNo}</td>
                    <td class="center">${row.vehicleNo}</td>
                    <td class="center">${row.loadingStation}</td>
                    <td class="center">${row.deliveryStation}</td>
                    <td class="center">${row.chargeWt}</td>
                    <td class="center">${row.rate}</td>
                    <td class="amount">${row.freight}</td>
                    <td class="amount">${row.unloading}</td>
                    <td class="amount">${row.detention}</td>
                    <td class="amount">${row.extraKm}</td>
                    <td class="amount">${row.loading}</td>
                    <td class="amount">${row.doorCollection}</td>
                    <td class="amount">${row.doorDelivery}</td>
                    <td class="amount">${row.otherCharges}</td>
                    <td class="amount">${row.totalAmount}</td>
                </tr>
            `).join('');
        const blankRows = Array.from({ length: Math.max(0, minimumDetailRows - detailRows.length) }, () => `
                <tr class="item-row blank-row">
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                </tr>
            `).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
<title>${record.bill_ref_no || record.id}</title>
<style>
@page { size: A4 landscape; margin: 5mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
.page { width: 287mm; min-height: 200mm; margin: 0 auto; padding: 6mm 10mm; background: #fff; }
.sheet { border: 1.2px solid #111; min-height: 186mm; }
.header-band { border-bottom: 1.2px solid #111; display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; column-gap: 8px; padding: 7px 12px 5px; }
.header-logo { display: flex; align-items: center; justify-content: flex-start; }
.header-logo img { width: 102px; max-width: 100%; filter: grayscale(1) contrast(1.6) brightness(0.2); object-fit: contain; }
.header-copy { text-align: center; }
.header-title { font-size: 16px; font-weight: 800; letter-spacing: 0.2px; }
.header-line { display: flex; justify-content: center; gap: 34px; font-size: 11px; font-weight: 700; margin-top: 3px; line-height: 1.3; }
.header-line.contact { display: block; margin-top: 3px; }
.detail-grid { display: grid; grid-template-columns: 48% 52%; border-bottom: 1.2px solid #111; align-items: stretch; }
.party-block { border-right: 1.2px solid #111; display: grid; grid-template-rows: minmax(34px, auto) minmax(34px, auto) minmax(52px, auto) minmax(34px, auto); }
.party-line { border-bottom: 1.2px solid #111; padding: 6px 8px 7px; font-size: 11px; font-weight: 800; text-transform: uppercase; line-height: 1.24; overflow-wrap: anywhere; word-break: break-word; }
.party-line:last-child { border-bottom: none; text-align: center; padding-top: 6px; padding-bottom: 8px; }
.right-block { display: grid; grid-template-rows: 58px 57px; }
.branch-row { border-bottom: 1.2px solid #111; display: grid; grid-template-columns: 18% 82%; }
.branch-label { border-right: 1.2px solid #111; padding: 7px 6px 7px; font-size: 11px; font-weight: 800; line-height: 1.25; }
.branch-value { display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; }
.bill-row { display: grid; grid-template-columns: 40% 18% 42%; }
.bill-cell { border-right: 1.2px solid #111; padding: 7px 6px 7px; font-size: 11px; font-weight: 700; line-height: 1.2; }
.bill-cell:last-child { border-right: none; }
.bill-cell.center { text-align: center; }
.bill-cell.value { font-size: 12px; font-weight: 800; }
.items-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 20px; }
.items-table th, .items-table td { border-right: 1.2px solid #111; border-bottom: 1.2px solid #111; padding: 5px 3px 6px; font-size: 8.8px; vertical-align: middle; }
.items-table th:last-child, .items-table td:last-child { border-right: none; }
.items-table thead th { text-align: center; font-size: 8.8px; font-weight: 800; line-height: 1.35; padding: 8px 3px 10px; vertical-align: bottom; }
.items-table tbody td { height: 28px; font-weight: 700; line-height: 1.2; }
.items-table .center { text-align: center; }
.items-table .amount { text-align: right; padding-right: 8px; }
.blank-row td { font-weight: 400; }
.total-row td { height: 26px; font-size: 10px; font-weight: 800; padding-top: 6px; padding-bottom: 7px; }
.total-label { text-align: center; }
.words-row { border-bottom: 1.2px solid #111; padding: 7px 10px 8px; text-align: center; font-size: 10px; font-weight: 800; line-height: 1.25; }
.notes-block { min-height: 90px; border-bottom: 1.2px solid #111; padding: 8px 8px 10px; font-size: 10px; font-weight: 700; line-height: 1.8; }
.remark-title { margin-bottom: 4px; font-weight: 800; }
.footer-grid { display: grid; grid-template-columns: 60% 40%; min-height: 88px; }
.bank-block { border-right: 1.2px solid #111; padding: 8px 8px 10px; font-size: 10px; font-weight: 700; line-height: 1.9; }
.bank-title { font-size: 10px; font-weight: 800; }
.signature-block { padding: 8px 8px 10px; display: flex; align-items: flex-start; justify-content: center; }
.signature-inner { width: 100%; text-align: center; font-size: 10px; font-weight: 700; line-height: 1.7; }
.signature-company { font-size: 11px; font-weight: 800; margin-bottom: 22px; }
.signature-name { margin-top: 10px; }
.signature-role { font-size: 10px; font-weight: 800; }
</style>
</head>
<body>
<div class="page">
    <div class="sheet">
        <div class="header-band">
            <div class="header-logo">
                <img src="${logoUrl}" alt="VGT Logo" />
            </div>
            <div class="header-copy">
                <div class="header-title">VISAKHA GOLDEN TRANSPORT</div>
                <div class="header-line">
                    <span>OUR PAN NO: AAWFV7670H</span>
                    <span>D. NO. 8-19-58/A, GOPAL NAGAR, NEAR BANK COLONY, VIZIANAGARAM, ANDHRA PRADESH - 535003</span>
                </div>
                <div class="header-line contact">Contact:9392223404,8756314575 Email:vsp@visakhagolden.com</div>
            </div>
            <div></div>
        </div>

        <div class="detail-grid">
            <div class="party-block">
                <div class="party-line">${partyName}</div>
                <div class="party-line">${addressLine1}</div>
                <div class="party-line">${addressLine2 || '&nbsp;'}</div>
                <div class="party-line">${party.gstin ? `GST-${toUpperText(party.gstin)}` : '&nbsp;'}</div>
            </div>
            <div class="right-block">
                <div class="branch-row">
                    <div class="branch-label">Issuing<br/>Branch :</div>
                    <div class="branch-value">${branchDisplay}</div>
                </div>
                <div class="bill-row">
                    <div class="bill-cell value">Bill No.${record.bill_ref_no || `VGT-${record.id.slice(0, 8).toUpperCase()}`}</div>
                    <div class="bill-cell center">Date.</div>
                    <div class="bill-cell value center">${fmtDotDate(record.billing_date)}</div>
                </div>
            </div>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th style="width:5%;">Consignment<br/>Note No.</th>
                    <th style="width:4.5%;">Date</th>
                    <th style="width:10%;">Invoice<br/>No</th>
                    <th style="width:6%;">Vehicle no.</th>
                    <th style="width:7%;">Loading<br/>Station</th>
                    <th style="width:7%;">Destination</th>
                    <th style="width:4.5%;">Charge Wt.</th>
                    <th style="width:4.5%;">Rate</th>
                    <th style="width:6%;">Freight</th>
                    <th style="width:5%;">Unload</th>
                    <th style="width:4.5%;">Detention</th>
                    <th style="width:5%;">Extra KM</th>
                    <th style="width:5%;">Loading</th>
                    <th style="width:5%;">Door Coll</th>
                    <th style="width:5%;">Door Del</th>
                    <th style="width:5.5%;">Other<br/>Charges</th>
                    <th style="width:5.5%;">Total Billed<br/>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${coveredRows}
                ${blankRows}
                <tr class="total-row">
                    <td colspan="15"></td>
                    <td class="total-label">TOTAL</td>
                    <td class="amount">${fmt(displayTotal)}</td>
                </tr>
            </tbody>
        </table>

        <div class="words-row">Rupees In Words:- ${amountWords}</div>

        <div class="notes-block">
            ${narrationHtml}
            <div>GST PAYABLE BY UNDER REVERSE CHARGE MECHANISM</div>
            <div>Ewaybill id:37AAWFV7670H1Z8</div>
        </div>

        <div class="footer-grid">
            <div class="bank-block">
                <div class="bank-title">Bank Details: Visakha Golden Transport</div>
                <div>A/C No: 070205500602</div>
                <div>IFSC Code: ICIC0000702</div>
                <div>ICICI Bank Vizianagaram</div>
            </div>
            <div class="signature-block">
                <div class="signature-inner">
                    <div class="signature-company">For Visakha Golden Transport</div>
                    <div class="signature-name">${record.status === 'CANCELLED' ? 'Cancelled Bill' : '&nbsp;'}</div>
                    <div class="signature-role">(Authorized Signatory)</div>
                </div>
            </div>
        </div>
    </div>
</div>
</body>
</html>`;

        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;

        doc.open();
        doc.write(html);
        doc.close();

        await Promise.all(
            Array.from(doc.images).map((image) => {
                if (image.complete) return Promise.resolve();
                return new Promise<void>((resolve) => {
                    image.onload = () => resolve();
                    image.onerror = () => resolve();
                });
            })
        );

        await new Promise((resolve) => setTimeout(resolve, 250));

        if (mode === 'print') {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            return;
        }

        const page = doc.querySelector('.page') as HTMLElement | null;
        if (!page) return;

        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ]);

        const canvas = await html2canvas(page, {
            scale: 3,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: page.scrollWidth,
            height: page.scrollHeight,
            windowWidth: page.scrollWidth,
            windowHeight: page.scrollHeight,
        });

        const imageData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
            compress: true,
        });

        pdf.addImage(imageData, 'PNG', 5, 5, 287, 200, undefined, 'FAST');
        pdf.save(getBillDownloadName(record.bill_ref_no, record.id));
    };

    if (!party || !record) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col sm:max-w-[95vw]">
                <iframe
                    ref={iframeRef}
                    style={{
                        position: 'fixed',
                        left: '-10000px',
                        top: 0,
                        width: '1400px',
                        height: '1000px',
                        border: 'none',
                        opacity: 0,
                        pointerEvents: 'none',
                    }}
                />
                <DialogHeader className="bg-primary px-6 py-4 flex-shrink-0 flex flex-row items-center justify-between space-y-0 text-white">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <Eye className="h-5 w-5 opacity-80" />
                                <span className="opacity-70">Bill No:</span>
                                <span className="tracking-wide">{record.bill_ref_no || '—'}</span>
                            </DialogTitle>
                            <Badge className="bg-white/20 text-white border-white/20 hover:bg-white/30 text-[10px] uppercase tracking-wider px-2 py-0.5">
                                {record.status}
                            </Badge>
                        </div>
                        <DialogDescription className="text-white/70 text-xs mt-1">
                            Bill dated <span className="font-mono">{fmtDate(record.billing_date)}</span>
                        </DialogDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                        <Button variant="outline" className="gap-2" onClick={() => void handlePrint('print')}>
                            <Printer className="h-4 w-4" /> Print
                        </Button>
                        <Button variant="outline" className="gap-2" onClick={() => void handlePrint('download')}>
                            <Download className="h-4 w-4" /> Download PDF
                        </Button>
                        {isAdmin && record.status === 'ACTIVE' && (
                            <Button className="gap-2" onClick={onEdit}>
                                <Pencil className="h-4 w-4" /> Edit Bill
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 space-y-4">

                    <div className="grid md:grid-cols-2 gap-4">
                        <Card><CardContent className="p-4 space-y-2">
                            <div className="text-[11px] font-bold uppercase text-muted-foreground">Party</div>
                            <div className="text-base font-black text-primary">{party.name}</div>
                            <div className="text-sm text-muted-foreground">Code: {party.code || '—'}</div>
                            <div className="text-sm text-muted-foreground">GSTIN: {party.gstin || '—'}</div>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{party.address || 'Address not available'}</div>
                        </CardContent></Card>
                        <Card><CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-[11px] font-bold uppercase text-muted-foreground">Bill Ref No</div>
                                    <div className="text-base font-black">{record.bill_ref_no || '—'}</div>
                                </div>
                                <Badge variant={record.status === 'ACTIVE' ? 'default' : 'outline'}
                                    className={record.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                    {record.status}
                                </Badge>
                            </div>
                            <div className="text-sm">Bill Date: <span className="font-medium">{fmtDate(record.billing_date)}</span></div>
                            <div className="text-sm">Issuing Branch: <span className="font-medium">{issuingBranch}</span></div>
                            <div className="text-sm">Matched LR Count: <span className="font-medium">{billDetailRows.length || (record.covered_cn_nos?.length || 0)}</span></div>
                            <div className="text-sm">Amount: <span className="font-black text-emerald-700 font-mono">₹{fmt(billAmount)}</span></div>
                            <div className="text-sm">CN Freight: <span className="font-black text-primary font-mono">₹{fmt(consignmentBreakup.freightTotal)}</span></div>
                            <div className="text-sm">Unloading Charges: <span className="font-black text-slate-700 font-mono">₹{fmt(consignmentBreakup.unloadingTotal)}</span></div>
                            <div className="text-sm">Detention Charges: <span className="font-black text-amber-700 font-mono">₹{fmt(consignmentBreakup.detentionTotal)}</span></div>
                            <div className="text-sm">Extra KM Charges: <span className="font-black text-slate-700 font-mono">₹{fmt(consignmentBreakup.extraKmTotal)}</span></div>
                            <div className="text-sm">Loading Charges: <span className="font-black text-slate-700 font-mono">₹{fmt(consignmentBreakup.loadingChargeTotal)}</span></div>
                            <div className="text-sm">Door Coll Charges: <span className="font-black text-slate-700 font-mono">₹{fmt(consignmentBreakup.doorCollectionTotal)}</span></div>
                            <div className="text-sm">Door Del Charges: <span className="font-black text-slate-700 font-mono">₹{fmt(consignmentBreakup.doorDeliveryTotal)}</span></div>
                            <div className="text-sm">CN Other Charges: <span className="font-black text-slate-700 font-mono">₹{fmt(consignmentBreakup.otherChargeTotal)}</span></div>
                            <div className="text-sm">Added Other Charges: <span className="font-black text-slate-900 font-mono">₹{fmt(consignmentBreakup.addedOtherChargesAmount)}</span></div>
                            <div className="text-sm">Bill Other Charges Column: <span className="font-black text-slate-900 font-mono">₹{fmt(consignmentBreakup.billOtherChargeTotal)}</span></div>
                            <div className="text-sm">CN Total: <span className="font-black text-foreground font-mono">₹{fmt(consignmentBreakup.cnChargeTotal)}</span></div>
                        </CardContent></Card>
                    </div>

                    <Card>
                        <CardContent className="p-4 space-y-3">
                            <div className="text-[11px] font-bold uppercase text-muted-foreground">Narration</div>
                            <div className="text-sm">{record.narration || '—'}</div>
                            <div className="text-[11px] font-bold uppercase text-muted-foreground pt-2">Amount In Words</div>
                            <div className="text-sm font-semibold text-primary">{numberToWords(billAmount)}</div>
                            {record.status === 'CANCELLED' && (
                                <>
                                    <div className="text-[11px] font-bold uppercase text-muted-foreground pt-2">Cancel Reason</div>
                                    <div className="text-sm text-destructive">{record.cancel_reason || '—'}</div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-[11px] font-bold uppercase text-muted-foreground">Covered CN Details</div>
                                <div className="text-xs text-muted-foreground">{billDetailRows.length} matched consignments</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left p-2 font-bold text-xs">SL</th>
                                            <th className="text-left p-2 font-bold text-xs">CN No</th>
                                            <th className="text-left p-2 font-bold text-xs">Date</th>
                                            <th className="text-left p-2 font-bold text-xs">Invoice No</th>
                                            <th className="text-left p-2 font-bold text-xs">Vehicle</th>
                                            <th className="text-left p-2 font-bold text-xs">Loading</th>
                                            <th className="text-left p-2 font-bold text-xs">Destination</th>
                                            <th className="text-right p-2 font-bold text-xs">Wt.</th>
                                            <th className="text-right p-2 font-bold text-xs">Rate</th>
                                            <th className="text-right p-2 font-bold text-xs">Freight</th>
                                            <th className="text-right p-2 font-bold text-xs">Unload</th>
                                            <th className="text-right p-2 font-bold text-xs">Detention</th>
                                            <th className="text-right p-2 font-bold text-xs">Extra KM</th>
                                            <th className="text-right p-2 font-bold text-xs">Loading Charges</th>
                                            <th className="text-right p-2 font-bold text-xs">Door Coll</th>
                                            <th className="text-right p-2 font-bold text-xs">Door Del</th>
                                            <th className="text-right p-2 font-bold text-xs">Other Charges</th>
                                            <th className="text-right p-2 font-bold text-xs">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {billDetailRows.length > 0 ? (
                                            <>
                                                {billDetailRows.map((row, index) => {
                                                    return (
                                                        <tr key={`${row.cn_no}-${index}`} className="border-b last:border-0">
                                                            <td className="p-2 text-xs">{index + 1}</td>
                                                            <td className="p-2 font-mono text-xs text-primary font-bold">{row.cn_no}</td>
                                                            <td className="p-2 text-xs">{fmtDate(row.bkg_date)}</td>
                                                            <td className="p-2 text-xs">{row.invoice_no || '—'}</td>
                                                            <td className="p-2 text-xs">{row.vehicle_no || '—'}</td>
                                                            <td className="p-2 text-xs">{row.loading_station || row.booking_branch || '—'}</td>
                                                            <td className="p-2 text-xs">{row.delivery_station || '—'}</td>
                                                            <td className="p-2 text-right text-xs font-mono">{row.charge_wt || '—'}</td>
                                                            <td className="p-2 text-right text-xs font-mono">{row.freight_rate > 0 ? fmt(row.freight_rate) : '0.00'}</td>
                                                            <td className="p-2 text-right text-xs font-mono">₹{fmt(row.freight)}</td>
                                                            <td className="p-2 text-right text-xs font-mono">₹{fmt(row.unloading)}</td>
                                                            <td className="p-2 text-right text-xs font-mono">₹{fmt(row.detention)}</td>
                                                            <td className="p-2 text-right text-xs font-mono">₹{fmt(row.extra_km)}</td>
                                                            <td className="p-2 text-right text-xs font-mono">₹{fmt(row.loading)}</td>
                                                            <td className="p-2 text-right text-xs font-mono">₹{fmt(row.door_collection)}</td>
                                                            <td className="p-2 text-right text-xs font-mono">₹{fmt(row.door_delivery)}</td>
                                                            <td className="p-2 text-right text-xs font-mono">
                                                                {row.other_charges < 0 ? '-' : ''}₹{fmt(Math.abs(row.other_charges))}
                                                            </td>
                                                            <td className="p-2 text-right text-xs font-mono">
                                                                {row.total_amount < 0 ? '-' : ''}₹{fmt(Math.abs(row.total_amount))}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </>
                                        ) : (
                                            <tr>
                                                <td colSpan={18} className="p-3 text-center text-xs text-muted-foreground">
                                                    No exact CN rows matched this bill. The PDF will still include the saved narration and bill amount.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {(record.covered_cn_nos || []).length > 0 && (
                                <div className="mt-3 text-xs text-muted-foreground">
                                    Saved CN list: <span className="font-mono">{record.covered_cn_nos?.join(', ')}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}
