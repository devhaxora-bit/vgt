import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/ledger/[partyId]/payments/[receiptId]/reverse
// Reverse a payment receipt (admin only)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string; receiptId: string }> }
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

    const { partyId, receiptId } = await params;
    const body = await request.json();
    const { reversal_reason } = body;

    if (!reversal_reason?.trim()) {
        return NextResponse.json({ error: 'reversal_reason is required' }, { status: 400 });
    }

    const { data: receipt } = await supabase
        .from('party_payment_receipts')
        .select('id, status')
        .eq('id', receiptId)
        .eq('party_id', partyId)
        .single();

    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    if (receipt.status === 'REVERSED') return NextResponse.json({ error: 'Receipt is already reversed' }, { status: 400 });

    const { data, error } = await supabase
        .from('party_payment_receipts')
        .update({
            status: 'REVERSED',
            reversal_reason: reversal_reason.trim(),
            reversed_at: new Date().toISOString(),
            reversed_by: user.id,
        })
        .eq('id', receiptId)
        .select()
        .single();

    if (error) {
        console.error('Failed to reverse payment receipt:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
