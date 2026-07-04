import type { createClient } from '@/utils/supabase/server';
import { normalizeBillRefNo } from '@/lib/billRef';

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

const isSameBillRefNo = (left: string | null | undefined, right: string) =>
    normalizeBillRefNo(left).toUpperCase() === right.toUpperCase();

export async function findDuplicateGlobalBillRefNo(
    supabase: SupabaseLike,
    {
        billRefNo,
        excludePartyBillingRecordId,
        excludeBrokerBillingRecordId,
    }: {
        billRefNo: string | null;
        excludePartyBillingRecordId?: string;
        excludeBrokerBillingRecordId?: string;
    }
) {
    const normalizedBillRefNo = normalizeBillRefNo(billRefNo);
    if (!normalizedBillRefNo) {
        return { duplicateRecordId: null, duplicateSource: null, error: null };
    }

    const [partyResult, brokerResult] = await Promise.all([
        supabase
            .from('party_billing_records')
            .select('id, bill_ref_no')
            .ilike('bill_ref_no', normalizedBillRefNo),
        supabase
            .from('broker_challan_billing_records')
            .select('id, bill_ref_no')
            .ilike('bill_ref_no', normalizedBillRefNo),
    ]);

    if (partyResult.error) {
        return { duplicateRecordId: null, duplicateSource: null, error: partyResult.error.message };
    }

    if (brokerResult.error) {
        return { duplicateRecordId: null, duplicateSource: null, error: brokerResult.error.message };
    }

    const duplicatePartyRecord = (partyResult.data || []).find((record) =>
        record.id !== excludePartyBillingRecordId && isSameBillRefNo(record.bill_ref_no, normalizedBillRefNo)
    );

    if (duplicatePartyRecord) {
        return {
            duplicateRecordId: duplicatePartyRecord.id,
            duplicateSource: 'party' as const,
            error: null,
        };
    }

    const duplicateBrokerRecord = (brokerResult.data || []).find((record) =>
        record.id !== excludeBrokerBillingRecordId && isSameBillRefNo(record.bill_ref_no, normalizedBillRefNo)
    );

    if (duplicateBrokerRecord) {
        return {
            duplicateRecordId: duplicateBrokerRecord.id,
            duplicateSource: 'broker' as const,
            error: null,
        };
    }

    return { duplicateRecordId: null, duplicateSource: null, error: null };
}
