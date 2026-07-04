import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { prepareChallanBillingSnapshot } from '@/lib/server/challanBillingSnapshot';
import { findDuplicateGlobalBillRefNo } from '@/lib/server/billRefDuplicates';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ brokerId: string }> }
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

    const { brokerId } = await params;

    const { data: account, error: accountError } = await supabase
        .from('broker_ledger_accounts')
        .select('id')
        .eq('broker_id', brokerId)
        .single();

    if (accountError || !account) {
        return NextResponse.json({ error: 'Ledger account not found for this broker' }, { status: 404 });
    }

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
    const normalizedBillRefNo = String(bill_ref_no || '').trim();

    if (!billing_date || !normalizedBillRefNo) {
        return NextResponse.json({ error: 'billing_date and bill_ref_no are required' }, { status: 400 });
    }

    const { duplicateRecordId, error: duplicateBillRefError } = await findDuplicateGlobalBillRefNo(supabase, {
        billRefNo: normalizedBillRefNo,
    });

    if (duplicateBillRefError) {
        return NextResponse.json({ error: duplicateBillRefError }, { status: 500 });
    }

    if (duplicateRecordId) {
        return NextResponse.json({ error: 'Bill reference number already exists' }, { status: 400 });
    }

    const { data: snapshotData, error: snapshotError } = await prepareChallanBillingSnapshot(supabase, {
        brokerId,
        coveredChallanNos: covered_challan_nos,
        addedOtherChargesAmount: added_other_charges_amount,
    });

    if (snapshotError || !snapshotData) {
        return NextResponse.json({ error: snapshotError || 'Failed to prepare bill snapshot' }, { status: 400 });
    }

    if (snapshotData.finalBillAmount <= 0) {
        return NextResponse.json({ error: 'Bill amount must be greater than zero' }, { status: 400 });
    }

    const normalizedNarration = narration?.trim() || `Challan bill ${normalizedBillRefNo}`;

    const { data, error } = await supabase
        .from('broker_challan_billing_records')
        .insert({
            broker_ledger_account_id: account.id,
            broker_id: brokerId,
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
            created_by: user.id,
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create broker challan billing record:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
