import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { findDuplicateBillRefNo, hasActiveLinkedPayments, prepareBillingSnapshot } from '@/lib/server/billingSnapshot';

// PATCH /api/ledger/[partyId]/billing/[recordId]
// Update editable fields on a billing record (admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string; recordId: string }> }
) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { partyId, recordId } = await params;
    const body = await request.json();
    const { billing_date, billing_period_from, billing_period_to, bill_ref_no, narration, covered_cn_nos, added_other_charges_amount } = body;

    if (!billing_date) {
        return NextResponse.json({ error: 'billing_date is required' }, { status: 400 });
    }

    const { data: record } = await supabase
        .from('party_billing_records')
        .select('id, status')
        .eq('id', recordId)
        .eq('party_id', partyId)
        .single();

    if (!record) return NextResponse.json({ error: 'Billing record not found' }, { status: 404 });
    if (record.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Only active billing records can be edited' }, { status: 400 });
    }

    const { hasLinkedPayments, error: linkedPaymentsError } = await hasActiveLinkedPayments(supabase, {
        partyId,
        billingRecordId: recordId,
    });

    if (linkedPaymentsError) {
        return NextResponse.json({ error: linkedPaymentsError }, { status: 500 });
    }

    if (hasLinkedPayments) {
        return NextResponse.json({ error: 'Bills with active linked payments cannot be edited. Reverse the linked payment first.' }, { status: 400 });
    }

    const { data: snapshotData, error: snapshotError } = await prepareBillingSnapshot(supabase, {
        partyId,
        coveredCnNos: covered_cn_nos,
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

    const { duplicateRecordId, error: duplicateBillRefError } = await findDuplicateBillRefNo(supabase, {
        partyId,
        billRefNo: normalizedBillRefNo,
        excludeBillingRecordId: recordId,
    });

    if (duplicateBillRefError) {
        return NextResponse.json({ error: duplicateBillRefError }, { status: 500 });
    }

    if (duplicateRecordId) {
        return NextResponse.json({ error: 'Bill reference number already exists for this party' }, { status: 400 });
    }

    const normalizedNarration = narration?.trim() || (normalizedBillRefNo ? `Freight bill ${normalizedBillRefNo}` : 'Freight bill');

    const { data, error } = await supabase
        .from('party_billing_records')
        .update({
            billing_date,
            billing_period_from: billing_period_from || null,
            billing_period_to: billing_period_to || null,
            amount: snapshotData.finalBillAmount,
            bill_ref_no: normalizedBillRefNo,
            narration: normalizedNarration,
            covered_cn_nos: snapshotData.normalizedCoveredCnNos,
            cn_total_amount: snapshotData.cnTotalAmount,
            added_other_charges_amount: snapshotData.addedOtherChargesAmount,
            consignment_snapshot: snapshotData.consignmentSnapshot,
            extra_charge_items: [],
        })
        .eq('id', recordId)
        .eq('party_id', partyId)
        .select()
        .single();

    if (error) {
        console.error('Failed to update billing record:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
