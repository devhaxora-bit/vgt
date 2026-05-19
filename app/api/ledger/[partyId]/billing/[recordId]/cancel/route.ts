import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { hasActiveLinkedPayments } from '@/lib/server/billingSnapshot';

// POST /api/ledger/[partyId]/billing/[recordId]/cancel
// Cancel a billing record (admin only)
export async function POST(
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
    const { cancel_reason } = body;

    if (!cancel_reason?.trim()) {
        return NextResponse.json({ error: 'cancel_reason is required' }, { status: 400 });
    }

    // Verify record belongs to correct party
    const { data: record } = await supabase
        .from('party_billing_records')
        .select('id, status')
        .eq('id', recordId)
        .eq('party_id', partyId)
        .single();

    if (!record) return NextResponse.json({ error: 'Billing record not found' }, { status: 404 });
    if (record.status === 'CANCELLED') return NextResponse.json({ error: 'Record is already cancelled' }, { status: 400 });

    const { hasLinkedPayments, error: linkedPaymentsError } = await hasActiveLinkedPayments(supabase, {
        partyId,
        billingRecordId: recordId,
    });

    if (linkedPaymentsError) {
        return NextResponse.json({ error: linkedPaymentsError }, { status: 500 });
    }

    if (hasLinkedPayments) {
        return NextResponse.json({ error: 'Bills with active linked payments cannot be cancelled. Reverse the linked payment first.' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('party_billing_records')
        .update({
            status: 'CANCELLED',
            cancel_reason: cancel_reason.trim(),
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
        })
        .eq('id', recordId)
        .select()
        .single();

    if (error) {
        console.error('Failed to cancel billing record:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
