import { NextRequest, NextResponse } from 'next/server';
import { prepareChallanBillingSnapshot } from '@/lib/server/challanBillingSnapshot';
import { findDuplicateGlobalBillRefNo } from '@/lib/server/billRefDuplicates';
import { requireAuthz, requireBrokerBranchAccess } from '@/lib/server/requireAuthz';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ brokerId: string; recordId: string }> }
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { brokerId, recordId } = await params;
    const brokerAccess = await requireBrokerBranchAccess(auth, brokerId);
    if (!brokerAccess.ok) return brokerAccess.response;

    const supabase = auth.supabase;
    const body = await request.json();
    const {
        billing_date,
        billing_period_from,
        billing_period_to,
        bill_ref_no,
        narration,
        covered_challan_nos,
        added_other_charges_amount,
    } = body;

    if (!billing_date) {
        return NextResponse.json({ error: 'billing_date is required' }, { status: 400 });
    }

    const { data: record } = await supabase
        .from('broker_challan_billing_records')
        .select('id, status, branch_code')
        .eq('id', recordId)
        .eq('broker_id', brokerId)
        .single();

    if (!record) return NextResponse.json({ error: 'Billing record not found' }, { status: 404 });
    const forbiddenRecord = auth.forbidIfForeignBranch(record.branch_code);
    if (forbiddenRecord) return forbiddenRecord;
    if (record.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Only active billing records can be edited' }, { status: 400 });
    }

    const { data: snapshotData, error: snapshotError } = await prepareChallanBillingSnapshot(supabase, {
        brokerId,
        coveredChallanNos: covered_challan_nos,
        addedOtherChargesAmount: added_other_charges_amount,
        excludeBillingRecordId: recordId,
    });

    if (snapshotError || !snapshotData) {
        return NextResponse.json({ error: snapshotError || 'Failed to prepare bill snapshot' }, { status: 400 });
    }

    if (snapshotData.finalBillAmount <= 0) {
        return NextResponse.json({ error: 'Bill amount must be greater than zero' }, { status: 400 });
    }

    const normalizedBillRefNo = bill_ref_no?.trim() || null;

    const { duplicateRecordId, error: duplicateBillRefError } = await findDuplicateGlobalBillRefNo(supabase, {
        billRefNo: normalizedBillRefNo,
        excludeBrokerBillingRecordId: recordId,
    });

    if (duplicateBillRefError) {
        return NextResponse.json({ error: duplicateBillRefError }, { status: 500 });
    }

    if (duplicateRecordId) {
        return NextResponse.json({ error: 'Bill reference number already exists' }, { status: 400 });
    }

    const normalizedNarration = narration?.trim() || (normalizedBillRefNo ? `Challan bill ${normalizedBillRefNo}` : 'Challan bill');

    const { data, error } = await supabase
        .from('broker_challan_billing_records')
        .update({
            billing_date,
            billing_period_from: billing_period_from || null,
            billing_period_to: billing_period_to || null,
            amount: snapshotData.finalBillAmount,
            bill_ref_no: normalizedBillRefNo,
            narration: normalizedNarration,
            covered_challan_nos: snapshotData.normalizedCoveredChallanNos,
            challan_total_amount: snapshotData.challanTotalAmount,
            added_other_charges_amount: snapshotData.addedOtherChargesAmount,
            challan_snapshot: snapshotData.challanSnapshot,
            extra_charge_items: [],
        })
        .eq('id', recordId)
        .eq('broker_id', brokerId)
        .select()
        .single();

    if (error) {
        console.error('Failed to update broker challan billing record:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
