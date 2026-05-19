import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { findDuplicateBillRefNo, prepareBillingSnapshot } from '@/lib/server/billingSnapshot';

// POST /api/ledger/[partyId]/billing
// Create a billing record for a party (admin only)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string }> }
) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin check
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { partyId } = await params;

    // Get ledger account
    const { data: account, error: accountError } = await supabase
        .from('party_ledger_accounts')
        .select('id')
        .eq('party_id', partyId)
        .single();

    if (accountError || !account) {
        return NextResponse.json({ error: 'Ledger account not found for this party' }, { status: 404 });
    }

    const body = await request.json();
    const { billing_date, billing_period_from, billing_period_to, bill_ref_no, narration, covered_cn_nos, added_other_charges_amount } = body;
    const normalizedBillRefNo = String(bill_ref_no || '').trim();

    if (!billing_date || !normalizedBillRefNo) {
        return NextResponse.json({ error: 'billing_date and bill_ref_no are required' }, { status: 400 });
    }

    const { duplicateRecordId, error: duplicateBillRefError } = await findDuplicateBillRefNo(supabase, {
        partyId,
        billRefNo: normalizedBillRefNo,
    });

    if (duplicateBillRefError) {
        return NextResponse.json({ error: duplicateBillRefError }, { status: 500 });
    }

    if (duplicateRecordId) {
        return NextResponse.json({ error: 'Bill reference number already exists for this party' }, { status: 400 });
    }

    const { data: snapshotData, error: snapshotError } = await prepareBillingSnapshot(supabase, {
        partyId,
        coveredCnNos: covered_cn_nos,
        addedOtherChargesAmount: added_other_charges_amount,
    });

    if (snapshotError || !snapshotData) {
        return NextResponse.json({ error: snapshotError || 'Failed to prepare bill snapshot' }, { status: 400 });
    }

    if (snapshotData.finalBillAmount <= 0) {
        return NextResponse.json({ error: 'Bill amount must be greater than zero' }, { status: 400 });
    }

    const normalizedNarration = narration?.trim() || `Freight bill ${normalizedBillRefNo}`;

    const { data, error } = await supabase
        .from('party_billing_records')
        .insert({
            party_ledger_account_id: account.id,
            party_id: partyId,
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
            created_by: user.id,
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create billing record:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
