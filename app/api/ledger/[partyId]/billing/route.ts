import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
    const { billing_date, billing_period_from, billing_period_to, amount, bill_ref_no, narration, covered_cn_nos } = body;

    if (!narration || !amount) {
        return NextResponse.json({ error: 'narration and amount are required' }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('party_billing_records')
        .insert({
            party_ledger_account_id: account.id,
            party_id: partyId,
            billing_date: billing_date || new Date().toISOString().split('T')[0],
            billing_period_from: billing_period_from || null,
            billing_period_to: billing_period_to || null,
            amount: amountNum,
            bill_ref_no: bill_ref_no || null,
            narration,
            covered_cn_nos: covered_cn_nos || null,
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
