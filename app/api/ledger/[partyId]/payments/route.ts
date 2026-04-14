import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/ledger/[partyId]/payments
// Record a payment receipt (admin only)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string }> }
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

    const { partyId } = await params;

    const { data: account, error: accountError } = await supabase
        .from('party_ledger_accounts')
        .select('id')
        .eq('party_id', partyId)
        .single();

    if (accountError || !account) {
        return NextResponse.json({ error: 'Ledger account not found for this party' }, { status: 404 });
    }

    const body = await request.json();
    const { receipt_date, amount, payment_mode, reference_no, bank_name, narration, related_billing_record_ids } = body;

    if (!amount) {
        return NextResponse.json({ error: 'amount is required' }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const validModes = ['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'ADJUSTMENT'];
    const mode = (payment_mode || 'CASH').toUpperCase();
    if (!validModes.includes(mode)) {
        return NextResponse.json({ error: `payment_mode must be one of: ${validModes.join(', ')}` }, { status: 400 });
    }

    const normalizedBillingRecordIds = Array.isArray(related_billing_record_ids)
        ? related_billing_record_ids.map((value) => String(value).trim()).filter(Boolean)
        : [];

    if (normalizedBillingRecordIds.length > 0) {
        const { data: billingRecords, error: billingRecordsError } = await supabase
            .from('party_billing_records')
            .select('id, status')
            .eq('party_id', partyId)
            .in('id', normalizedBillingRecordIds);

        if (billingRecordsError) {
            return NextResponse.json({ error: billingRecordsError.message }, { status: 400 });
        }

        if (!billingRecords || billingRecords.length !== normalizedBillingRecordIds.length) {
            return NextResponse.json({ error: 'One or more selected bills are invalid for this party' }, { status: 400 });
        }

        if (billingRecords.some((record) => record.status !== 'ACTIVE')) {
            return NextResponse.json({ error: 'Payments can only be linked to active bills' }, { status: 400 });
        }
    }

    const { data, error } = await supabase
        .from('party_payment_receipts')
        .insert({
            party_ledger_account_id: account.id,
            party_id: partyId,
            receipt_date: receipt_date || new Date().toISOString().split('T')[0],
            amount: amountNum,
            payment_mode: mode,
            reference_no: reference_no || null,
            bank_name: bank_name || null,
            narration: narration || null,
            related_billing_record_ids: normalizedBillingRecordIds.length > 0 ? normalizedBillingRecordIds : null,
            created_by: user.id,
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create payment receipt:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
