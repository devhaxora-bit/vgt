import type { createClient } from '@/utils/supabase/server';

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

type BillingSnapshotConsignment = {
    id: string;
    cn_no: string;
    invoice_no?: string | null;
    bkg_date?: string | null;
    booking_branch?: string | null;
    loading_point?: string | null;
    dest_branch?: string | null;
    delivery_point?: string | null;
    actual_weight?: number | string | null;
    charged_weight?: number | string | null;
    load_unit?: string | null;
    total_freight?: number | string | null;
    basic_freight?: number | string | null;
    freight_rate?: number | string | null;
    unload_charges?: number | string | null;
    retention_charges?: number | string | null;
    extra_km_charges?: number | string | null;
    mhc_charges?: number | string | null;
    door_coll_charges?: number | string | null;
    door_del_charges?: number | string | null;
    other_charges?: number | string | null;
    vehicle_no?: string | null;
};

export interface BillingConsignmentSnapshotRow {
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

export interface PreparedBillingSnapshot {
    normalizedCoveredCnNos: string[] | null;
    consignmentSnapshot: BillingConsignmentSnapshotRow[];
    cnTotalAmount: number;
    addedOtherChargesAmount: number;
    finalBillAmount: number;
}

const parseMoney = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const getConsignmentExtraCharges = (
    consignment: Pick<BillingSnapshotConsignment, 'unload_charges' | 'extra_km_charges' | 'mhc_charges' | 'door_coll_charges' | 'door_del_charges' | 'other_charges'>
) : number => {
    const chargeValues: Array<number | string | null | undefined> = [
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
    consignment: Pick<BillingSnapshotConsignment, 'basic_freight' | 'total_freight' | 'retention_charges' | 'unload_charges' | 'extra_km_charges' | 'mhc_charges' | 'door_coll_charges' | 'door_del_charges' | 'other_charges'>
) => {
    const baseFreight = parseMoney(consignment.basic_freight);
    if (baseFreight > 0) return baseFreight;

    const totalFreight = parseMoney(consignment.total_freight);
    const detention = parseMoney(consignment.retention_charges);
    const extraCharges = getConsignmentExtraCharges(consignment);
    const derivedFreight = totalFreight - detention - extraCharges;

    return derivedFreight > 0 ? derivedFreight : totalFreight;
};

const getConsignmentChargeBreakdown = (
    consignment: Pick<BillingSnapshotConsignment, 'basic_freight' | 'total_freight' | 'unload_charges' | 'retention_charges' | 'extra_km_charges' | 'mhc_charges' | 'door_coll_charges' | 'door_del_charges' | 'other_charges'>
) => {
    const freight = roundMoney(getConsignmentBaseFreight(consignment));
    const unloading = roundMoney(parseMoney(consignment.unload_charges));
    const detention = roundMoney(parseMoney(consignment.retention_charges));
    const extraKm = roundMoney(parseMoney(consignment.extra_km_charges));
    const loading = roundMoney(parseMoney(consignment.mhc_charges));
    const doorCollection = roundMoney(parseMoney(consignment.door_coll_charges));
    const doorDelivery = roundMoney(parseMoney(consignment.door_del_charges));
    const other = roundMoney(parseMoney(consignment.other_charges));
    const total = roundMoney(parseMoney(consignment.total_freight) || (
        freight
        + unloading
        + detention
        + extraKm
        + loading
        + doorCollection
        + doorDelivery
        + other
    ));

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

const normalizeCoveredCnNos = (coveredCnNos: unknown) => {
    if (!Array.isArray(coveredCnNos)) return [];

    const normalized = coveredCnNos
        .map((value) => String(value).trim())
        .filter(Boolean);

    return Array.from(new Set(normalized));
};

const buildChargeWeight = (consignment: BillingSnapshotConsignment) => {
    const weight = parseMoney(consignment.charged_weight) || parseMoney(consignment.actual_weight);
    if (weight <= 0) return null;

    const unit = String(consignment.load_unit || '').trim().toUpperCase();
    return `${weight}${unit ? ` ${unit}` : ''}`.trim();
};

const buildConsignmentSnapshot = (
    consignments: BillingSnapshotConsignment[],
    addedOtherChargesAmount: number
) => {
    const rows = consignments.map((consignment, index) => {
        const breakdown = getConsignmentChargeBreakdown(consignment);
        const isLastRow = index === consignments.length - 1;
        const mergedOtherCharges = roundMoney(breakdown.other + (isLastRow ? addedOtherChargesAmount : 0));
        const mergedTotalAmount = roundMoney(breakdown.total + (isLastRow ? addedOtherChargesAmount : 0));

        return {
            cn_no: consignment.cn_no,
            bkg_date: consignment.bkg_date || null,
            invoice_no: consignment.invoice_no || consignment.cn_no,
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

    const cnTotalAmount = roundMoney(consignments.reduce((sum, consignment) => (
        sum + getConsignmentChargeBreakdown(consignment).total
    ), 0));

    return {
        rows,
        cnTotalAmount,
    };
};

const fetchOverlappingBills = async (
    supabase: SupabaseLike,
    partyId: string,
    normalizedCoveredCnNos: string[],
    excludeBillingRecordId?: string
) => {
    const { data, error } = await supabase
        .from('party_billing_records')
        .select('id, bill_ref_no, covered_cn_nos')
        .eq('party_id', partyId)
        .eq('status', 'ACTIVE');

    if (error) return { data: null, error: error.message };

    const overlapping = (data || []).filter((record) => {
        if (excludeBillingRecordId && record.id === excludeBillingRecordId) return false;

        const existingCoveredCnNos = Array.isArray(record.covered_cn_nos)
            ? record.covered_cn_nos.map((value) => String(value).trim()).filter(Boolean)
            : [];

        return existingCoveredCnNos.some((cnNo) => normalizedCoveredCnNos.includes(cnNo));
    });

    return { data: overlapping, error: null };
};

export async function findDuplicateBillRefNo(
    supabase: SupabaseLike,
    {
        partyId,
        billRefNo,
        excludeBillingRecordId,
    }: {
        partyId: string;
        billRefNo: string | null;
        excludeBillingRecordId?: string;
    }
) {
    const normalizedBillRefNo = String(billRefNo || '').trim();
    if (!normalizedBillRefNo) {
        return { duplicateRecordId: null, error: null };
    }

    const { data, error } = await supabase
        .from('party_billing_records')
        .select('id')
        .eq('party_id', partyId)
        .eq('bill_ref_no', normalizedBillRefNo)
        .limit(1);

    if (error) return { duplicateRecordId: null, error: error.message };

    const duplicateRecord = (data || []).find((record) => record.id !== excludeBillingRecordId);

    return {
        duplicateRecordId: duplicateRecord?.id || null,
        error: null,
    };
}

export async function prepareBillingSnapshot(
    supabase: SupabaseLike,
    {
        partyId,
        coveredCnNos,
        addedOtherChargesAmount,
        excludeBillingRecordId,
    }: {
        partyId: string;
        coveredCnNos: unknown;
        addedOtherChargesAmount: unknown;
        excludeBillingRecordId?: string;
    }
): Promise<{ data: PreparedBillingSnapshot | null; error: string | null }> {
    const normalizedCoveredCnNos = normalizeCoveredCnNos(coveredCnNos);
    const normalizedAddedOtherChargesAmount = roundMoney(parseMoney(addedOtherChargesAmount));

    if (normalizedCoveredCnNos.length === 0) {
        const finalBillAmount = normalizedAddedOtherChargesAmount;
        return {
            data: {
                normalizedCoveredCnNos: null,
                consignmentSnapshot: [],
                cnTotalAmount: 0,
                addedOtherChargesAmount: normalizedAddedOtherChargesAmount,
                finalBillAmount,
            },
            error: null,
        };
    }

    const { data: overlappingBills, error: overlappingBillsError } = await fetchOverlappingBills(
        supabase,
        partyId,
        normalizedCoveredCnNos,
        excludeBillingRecordId
    );

    if (overlappingBillsError) {
        return { data: null, error: overlappingBillsError };
    }

    if ((overlappingBills || []).length > 0) {
        const overlappingCnNos = Array.from(new Set(
            (overlappingBills || []).flatMap((record) => {
                const existingCoveredCnNos = Array.isArray(record.covered_cn_nos)
                    ? record.covered_cn_nos.map((value) => String(value).trim()).filter(Boolean)
                    : [];

                return existingCoveredCnNos.filter((cnNo) => normalizedCoveredCnNos.includes(cnNo));
            })
        ));

        const sampleBillRef = overlappingBills?.[0]?.bill_ref_no || overlappingBills?.[0]?.id;
        return {
            data: null,
            error: `CN already billed in another active bill${sampleBillRef ? ` (${sampleBillRef})` : ''}: ${overlappingCnNos.join(', ')}`,
        };
    }

    const { data: consignments, error } = await supabase
        .from('consignments')
        .select('id, cn_no, invoice_no, bkg_date, booking_branch, loading_point, dest_branch, delivery_point, actual_weight, charged_weight, load_unit, total_freight, basic_freight, freight_rate, unload_charges, retention_charges, extra_km_charges, mhc_charges, door_coll_charges, door_del_charges, other_charges, vehicle_no')
        .eq('billing_party_id', partyId)
        .eq('cancel_cn', false)
        .in('cn_no', normalizedCoveredCnNos);

    if (error) {
        return { data: null, error: error.message };
    }

    const consignmentMap = new Map<string, BillingSnapshotConsignment>();
    (consignments || []).forEach((consignment) => {
        const existing = consignmentMap.get(consignment.cn_no);
        if (!existing) {
            consignmentMap.set(consignment.cn_no, consignment as BillingSnapshotConsignment);
        }
    });

    const missingCnNos = normalizedCoveredCnNos.filter((cnNo) => !consignmentMap.has(cnNo));
    if (missingCnNos.length > 0) {
        return {
            data: null,
            error: `Selected CNs are invalid, cancelled, or belong to another billing party: ${missingCnNos.join(', ')}`,
        };
    }

    const orderedConsignments = normalizedCoveredCnNos
        .map((cnNo) => consignmentMap.get(cnNo))
        .filter((consignment): consignment is BillingSnapshotConsignment => Boolean(consignment));

    const { rows, cnTotalAmount } = buildConsignmentSnapshot(
        orderedConsignments,
        normalizedAddedOtherChargesAmount
    );

    return {
        data: {
            normalizedCoveredCnNos,
            consignmentSnapshot: rows,
            cnTotalAmount,
            addedOtherChargesAmount: normalizedAddedOtherChargesAmount,
            finalBillAmount: roundMoney(cnTotalAmount + normalizedAddedOtherChargesAmount),
        },
        error: null,
    };
}

export async function hasActiveLinkedPayments(
    supabase: SupabaseLike,
    {
        partyId,
        billingRecordId,
    }: {
        partyId: string;
        billingRecordId: string;
    }
) {
    const { data, error } = await supabase
        .from('party_payment_receipts')
        .select('id, related_billing_record_ids, bill_allocations')
        .eq('party_id', partyId)
        .eq('status', 'ACTIVE');

    if (error) {
        return { hasLinkedPayments: false, error: error.message };
    }

    const hasLinkedPayments = (data || []).some((receipt) => {
        const relatedBillIds = Array.isArray(receipt.related_billing_record_ids)
            ? receipt.related_billing_record_ids.map((value) => String(value).trim())
            : [];
        if (relatedBillIds.includes(billingRecordId)) return true;

        const billAllocations = Array.isArray(receipt.bill_allocations)
            ? receipt.bill_allocations
            : [];

        return billAllocations.some((allocation) => (
            String((allocation as { billing_record_id?: unknown })?.billing_record_id || '').trim() === billingRecordId
        ));
    });

    return {
        hasLinkedPayments,
        error: null,
    };
}
