import type { createClient } from '@/utils/supabase/server';

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

type BillingSnapshotChallan = {
    id: string;
    challan_no: string;
    date_from?: string | null;
    vehicle_no?: string | null;
    driver_name?: string | null;
    driver_mobile?: string | null;
    owner_name?: string | null;
    owner_mobile?: string | null;
    owner_address?: string | null;
    broker_name?: string | null;
    broker_code?: string | null;
    origin_branch_code?: string | null;
    destination_branch_code?: string | null;
    loading_point?: string | null;
    destination_point?: string | null;
    linked_cn_nos?: string[] | null;
    total_hire_amount?: number | string | null;
    extra_hire_amount?: number | string | null;
    advance_amount?: number | string | null;
    hire_amount?: number | string | null;
    extra_km_charges?: number | string | null;
    detent_charges?: number | string | null;
    unloading_charges?: number | string | null;
    total_extra_charges?: number | string | null;
    less_tds?: number | string | null;
};

export interface BillingChallanSnapshotRow {
    challan_no: string;
    date_from: string | null;
    vehicle_no: string | null;
    driver_name: string | null;
    owner_name: string | null;
    broker_name: string | null;
    origin_branch_code: string | null;
    destination_branch_code: string | null;
    linked_cn_nos: string[];
    linked_cn_count: number;
    total_hire_amount: number;
    extra_hire_amount: number;
    full_hire_amount: number;
    advance_amount: number;
    balance_amount: number;
}

export interface PreparedChallanBillingSnapshot {
    normalizedCoveredChallanNos: string[] | null;
    challanSnapshot: BillingChallanSnapshotRow[];
    challanTotalAmount: number;
    addedOtherChargesAmount: number;
    finalBillAmount: number;
}

const parseMoney = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const getChallanFullHireAmount = (
    challan: Pick<BillingSnapshotChallan, 'total_hire_amount' | 'extra_hire_amount'>
) => roundMoney(parseMoney(challan.total_hire_amount) + parseMoney(challan.extra_hire_amount));

const normalizeCoveredChallanNos = (coveredChallanNos: unknown) => {
    if (!Array.isArray(coveredChallanNos)) return [];

    const normalized = coveredChallanNos
        .map((value) => String(value).trim())
        .filter(Boolean);

    return Array.from(new Set(normalized));
};

const buildChallanSnapshot = (
    challans: BillingSnapshotChallan[],
    addedOtherChargesAmount: number
) => {
    const rows = challans.map((challan, index) => {
        const totalHire = roundMoney(parseMoney(challan.total_hire_amount));
        const extraHire = roundMoney(parseMoney(challan.extra_hire_amount));
        const fullHire = roundMoney(totalHire + extraHire);
        const advance = roundMoney(parseMoney(challan.advance_amount));
        const isLastRow = index === challans.length - 1;
        const mergedFullHire = roundMoney(fullHire + (isLastRow ? addedOtherChargesAmount : 0));

        return {
            challan_no: challan.challan_no,
            date_from: challan.date_from || null,
            vehicle_no: challan.vehicle_no || null,
            driver_name: challan.driver_name || null,
            owner_name: challan.owner_name || null,
            broker_name: challan.broker_name || null,
            origin_branch_code: challan.origin_branch_code || null,
            destination_branch_code: challan.destination_branch_code || null,
            linked_cn_nos: Array.isArray(challan.linked_cn_nos) ? challan.linked_cn_nos : [],
            linked_cn_count: Array.isArray(challan.linked_cn_nos) ? challan.linked_cn_nos.length : 0,
            total_hire_amount: totalHire,
            extra_hire_amount: extraHire,
            full_hire_amount: mergedFullHire,
            advance_amount: advance,
            balance_amount: roundMoney(mergedFullHire - advance),
        };
    });

    const challanTotalAmount = roundMoney(
        challans.reduce((sum, challan) => sum + getChallanFullHireAmount(challan), 0)
    );

    return { rows, challanTotalAmount };
};

const fetchOverlappingBills = async (
    supabase: SupabaseLike,
    brokerId: string,
    normalizedCoveredChallanNos: string[],
    excludeBillingRecordId?: string
) => {
    const { data, error } = await supabase
        .from('broker_challan_billing_records')
        .select('id, bill_ref_no, covered_challan_nos')
        .eq('broker_id', brokerId)
        .eq('status', 'ACTIVE');

    if (error) return { data: null, error: error.message };

    const overlapping = (data || []).filter((record) => {
        if (excludeBillingRecordId && record.id === excludeBillingRecordId) return false;

        const existing = Array.isArray(record.covered_challan_nos)
            ? record.covered_challan_nos.map((value) => String(value).trim()).filter(Boolean)
            : [];

        return existing.some((challanNo) => normalizedCoveredChallanNos.includes(challanNo));
    });

    return { data: overlapping, error: null };
};

export async function findDuplicateChallanBillRefNo(
    supabase: SupabaseLike,
    {
        brokerId,
        billRefNo,
        excludeBillingRecordId,
    }: {
        brokerId: string;
        billRefNo: string | null;
        excludeBillingRecordId?: string;
    }
) {
    const normalizedBillRefNo = String(billRefNo || '').trim();
    if (!normalizedBillRefNo) {
        return { duplicateRecordId: null, error: null };
    }

    const { data, error } = await supabase
        .from('broker_challan_billing_records')
        .select('id')
        .eq('broker_id', brokerId)
        .eq('bill_ref_no', normalizedBillRefNo)
        .limit(1);

    if (error) return { duplicateRecordId: null, error: error.message };

    const duplicateRecord = (data || []).find((record) => record.id !== excludeBillingRecordId);

    return {
        duplicateRecordId: duplicateRecord?.id || null,
        error: null,
    };
}

export async function prepareChallanBillingSnapshot(
    supabase: SupabaseLike,
    {
        brokerId,
        coveredChallanNos,
        addedOtherChargesAmount,
        excludeBillingRecordId,
    }: {
        brokerId: string;
        coveredChallanNos: unknown;
        addedOtherChargesAmount: unknown;
        excludeBillingRecordId?: string;
    }
): Promise<{ data: PreparedChallanBillingSnapshot | null; error: string | null }> {
    const normalizedCoveredChallanNos = normalizeCoveredChallanNos(coveredChallanNos);
    const normalizedAddedOtherChargesAmount = roundMoney(parseMoney(addedOtherChargesAmount));

    if (normalizedCoveredChallanNos.length === 0) {
        const finalBillAmount = normalizedAddedOtherChargesAmount;
        return {
            data: {
                normalizedCoveredChallanNos: null,
                challanSnapshot: [],
                challanTotalAmount: 0,
                addedOtherChargesAmount: normalizedAddedOtherChargesAmount,
                finalBillAmount,
            },
            error: null,
        };
    }

    const { data: overlappingBills, error: overlappingBillsError } = await fetchOverlappingBills(
        supabase,
        brokerId,
        normalizedCoveredChallanNos,
        excludeBillingRecordId
    );

    if (overlappingBillsError) {
        return { data: null, error: overlappingBillsError };
    }

    if ((overlappingBills || []).length > 0) {
        const overlappingChallanNos = Array.from(new Set(
            (overlappingBills || []).flatMap((record) => {
                const existing = Array.isArray(record.covered_challan_nos)
                    ? record.covered_challan_nos.map((value) => String(value).trim()).filter(Boolean)
                    : [];

                return existing.filter((challanNo) => normalizedCoveredChallanNos.includes(challanNo));
            })
        ));

        const sampleBillRef = overlappingBills?.[0]?.bill_ref_no || overlappingBills?.[0]?.id;
        return {
            data: null,
            error: `Challan already billed in another active bill${sampleBillRef ? ` (${sampleBillRef})` : ''}: ${overlappingChallanNos.join(', ')}`,
        };
    }

    const { data: challans, error } = await supabase
        .from('challans')
        .select('id, challan_no, date_from, vehicle_no, driver_name, driver_mobile, owner_name, owner_mobile, owner_address, broker_name, broker_code, origin_branch_code, destination_branch_code, loading_point, destination_point, linked_cn_nos, total_hire_amount, extra_hire_amount, advance_amount, hire_amount, extra_km_charges, detent_charges, unloading_charges, total_extra_charges, less_tds')
        .eq('broker_id', brokerId)
        .eq('status', 'ACTIVE')
        .in('challan_no', normalizedCoveredChallanNos);

    if (error) {
        return { data: null, error: error.message };
    }

    const challanMap = new Map<string, BillingSnapshotChallan>();
    (challans || []).forEach((challan) => {
        if (!challanMap.has(challan.challan_no)) {
            challanMap.set(challan.challan_no, challan as BillingSnapshotChallan);
        }
    });

    const missingChallanNos = normalizedCoveredChallanNos.filter((challanNo) => !challanMap.has(challanNo));
    if (missingChallanNos.length > 0) {
        return {
            data: null,
            error: `Selected challans are invalid, cancelled, or belong to another broker: ${missingChallanNos.join(', ')}`,
        };
    }

    const orderedChallans = normalizedCoveredChallanNos
        .map((challanNo) => challanMap.get(challanNo))
        .filter((challan): challan is BillingSnapshotChallan => Boolean(challan));

    const { rows, challanTotalAmount } = buildChallanSnapshot(
        orderedChallans,
        normalizedAddedOtherChargesAmount
    );

    return {
        data: {
            normalizedCoveredChallanNos,
            challanSnapshot: rows,
            challanTotalAmount,
            addedOtherChargesAmount: normalizedAddedOtherChargesAmount,
            finalBillAmount: roundMoney(challanTotalAmount + normalizedAddedOtherChargesAmount),
        },
        error: null,
    };
}

export async function hasActiveLinkedChallanPayments(
    supabase: SupabaseLike,
    {
        brokerId,
        billingRecordId,
    }: {
        brokerId: string;
        billingRecordId: string;
    }
) {
    const { data, error } = await supabase
        .from('broker_challan_payment_receipts')
        .select('id, related_billing_record_ids, bill_allocations')
        .eq('broker_id', brokerId)
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

export const buildSettledChallanBillAmountMap = (paymentReceipts: Array<{
    amount?: number | null;
    status?: string | null;
    related_billing_record_ids?: string[] | null;
    bill_allocations?: Array<{ billing_record_id?: string; settled_amount?: number | null }> | null;
}>) => {
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

export const getChallanBillPaymentStatus = (billAmount: number, settledAmount: number) => {
    if (settledAmount <= 0.009) return 'UNPAID' as const;
    if (settledAmount >= billAmount - 0.009) return 'COMPLETE' as const;
    return 'PARTIAL' as const;
};
