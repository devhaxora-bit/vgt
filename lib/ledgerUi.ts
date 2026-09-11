import type { BillingExtraChargeDraftItem } from '@/components/features/ledger/BillingExtraChargesEditor';
import type { BillingVehicleCancelItem } from '@/lib/billingVehicleCancel';

export interface LedgerParty {
    id: string;
    name: string;
    code: string;
    type: string;
    phone?: string;
    gstin?: string;
    address?: string;
    pincode?: string | null;
    branch_code?: string;
    branch_name?: string | null;
}

export interface LedgerConsignment {
    id: string;
    cn_no: string;
    bkg_date: string;
    invoice_no?: string;
    booking_branch: string;
    loading_point?: string;
    dest_branch: string;
    delivery_point?: string;
    no_of_pkg: number;
    total_qty?: number;
    is_loose?: boolean;
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
    traffic_challan_charges?: number;
    other_charges?: number;
    vehicle_no?: string;
    bkg_basis: string;
    goods_desc?: string;
    delivery_type?: string;
}

export interface BillingExtraChargeItem {
    label: string;
    amount: number;
}

export interface BillingRecord {
    id: string;
    billing_date: string;
    billing_period_from?: string;
    billing_period_to?: string;
    amount: number;
    bill_ref_no?: string;
    narration: string;
    covered_cn_nos?: string[];
    status: string;
    cn_total_amount?: number;
    added_other_charges_amount?: number;
    vehicle_cancel_items?: BillingVehicleCancelItem[];
    vehicle_cancel_charges_total?: number;
    consignment_snapshot?: Array<Record<string, unknown>>;
    extra_charge_items?: BillingExtraChargeItem[];
    settled_amount?: number;
    remaining_amount?: number;
    cancel_reason?: string;
    cancelled_at?: string;
    created_at?: string;
    party_id?: string;
    party_name?: string;
    party_code?: string;
}

export interface PaymentDeductionItem {
    label: string;
    amount: number;
}

export interface PaymentBillAllocation {
    billing_record_id: string;
    settled_amount: number;
    received_amount: number;
    deduction_items?: PaymentDeductionItem[];
}

export interface PaymentReceipt {
    id: string;
    receipt_date: string;
    amount: number;
    actual_received_amount?: number;
    payment_mode: string;
    reference_no?: string;
    bank_name?: string;
    narration?: string;
    status: string;
    reversal_reason?: string;
    reversed_at?: string;
    related_billing_record_ids?: string[];
    bill_allocations?: PaymentBillAllocation[];
    created_at?: string;
    party_id?: string;
    party_name?: string;
    party_code?: string;
}

export const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

export const parseMoney = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const roundMoney = (value: number) => Number(value.toFixed(2));

export const normalizeExtraChargeDraftItems = (items: BillingExtraChargeDraftItem[]) =>
    items
        .map((item) => ({
            label: item.label.trim(),
            amount: Number(parseMoney(item.amount).toFixed(2)),
        }))
        .filter((item) => item.label && item.amount > 0);

const getConsignmentExtraCharges = (
    consignment: Pick<
        LedgerConsignment,
        | 'unload_charges'
        | 'extra_km_charges'
        | 'mhc_charges'
        | 'door_coll_charges'
        | 'door_del_charges'
        | 'traffic_challan_charges'
        | 'other_charges'
    >
): number => {
    const chargeValues: Array<number | undefined> = [
        consignment.unload_charges,
        consignment.extra_km_charges,
        consignment.mhc_charges,
        consignment.door_coll_charges,
        consignment.door_del_charges,
        consignment.traffic_challan_charges,
        consignment.other_charges,
    ];

    return chargeValues.reduce<number>((sum, value) => sum + parseMoney(value), 0);
};

const getConsignmentBaseFreight = (
    consignment: Pick<
        LedgerConsignment,
        | 'basic_freight'
        | 'total_freight'
        | 'retention_charges'
        | 'unload_charges'
        | 'extra_km_charges'
        | 'mhc_charges'
        | 'door_coll_charges'
        | 'door_del_charges'
        | 'traffic_challan_charges'
        | 'other_charges'
    >
): number => {
    const baseFreight = parseMoney(consignment.basic_freight);
    if (baseFreight > 0) return baseFreight;

    const totalFreight = parseMoney(consignment.total_freight);
    const detention = parseMoney(consignment.retention_charges);
    const extraCharges = getConsignmentExtraCharges(consignment);
    const derivedFreight = totalFreight - detention - extraCharges;

    return derivedFreight > 0 ? derivedFreight : totalFreight;
};

export const getConsignmentChargeBreakdown = (
    consignment: Pick<
        LedgerConsignment,
        | 'basic_freight'
        | 'total_freight'
        | 'unload_charges'
        | 'retention_charges'
        | 'extra_km_charges'
        | 'mhc_charges'
        | 'door_coll_charges'
        | 'door_del_charges'
        | 'traffic_challan_charges'
        | 'other_charges'
    >
) => {
    const freight = getConsignmentBaseFreight(consignment);
    const unloading = parseMoney(consignment.unload_charges);
    const detention = parseMoney(consignment.retention_charges);
    const extraKm = parseMoney(consignment.extra_km_charges);
    const loading = parseMoney(consignment.mhc_charges);
    const doorCollection = parseMoney(consignment.door_coll_charges);
    const doorDelivery = parseMoney(consignment.door_del_charges);
    const trafficChallan = parseMoney(consignment.traffic_challan_charges);
    const other = parseMoney(consignment.other_charges);
    const total = parseMoney(consignment.total_freight) || (
        freight
        + unloading
        + detention
        + extraKm
        + loading
        + doorCollection
        + doorDelivery
        + trafficChallan
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
        trafficChallan,
        other,
        total,
    };
};

export const buildConsignmentBreakup = (consignments: LedgerConsignment[], selectedCnNos: string[]) => {
    const selected = consignments.filter((consignment) => selectedCnNos.includes(consignment.cn_no));

    const freightTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).freight, 0);
    const unloadingTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).unloading, 0);
    const detentionTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).detention, 0);
    const extraKmTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).extraKm, 0);
    const loadingChargeTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).loading, 0);
    const doorCollectionTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).doorCollection, 0);
    const doorDeliveryTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).doorDelivery, 0);
    const trafficChallanTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).trafficChallan, 0);
    const otherChargeTotal = selected.reduce<number>((sum, consignment) => sum + getConsignmentChargeBreakdown(consignment).other, 0);
    const ancillaryChargeTotal = selected.reduce<number>((sum, consignment) => (
        sum
        + getConsignmentChargeBreakdown(consignment).unloading
        + getConsignmentChargeBreakdown(consignment).extraKm
        + getConsignmentChargeBreakdown(consignment).loading
        + getConsignmentChargeBreakdown(consignment).doorCollection
        + getConsignmentChargeBreakdown(consignment).doorDelivery
        + getConsignmentChargeBreakdown(consignment).trafficChallan
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
        trafficChallanTotal,
        otherChargeTotal,
        ancillaryChargeTotal,
        cnChargeTotal,
    };
};

export const buildSettledBillAmountMap = (paymentReceipts: PaymentReceipt[]) => {
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
