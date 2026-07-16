import { NextRequest, NextResponse } from 'next/server';
import { requireAuthz, requirePartyBranchAccess } from '@/lib/server/requireAuthz';

// POST /api/ledger/[partyId]/payments/[receiptId]/reverse
// Reverse a payment receipt (admin only)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string; receiptId: string }> }
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { partyId, receiptId } = await params;
    const partyAccess = await requirePartyBranchAccess(auth, partyId);
    if (!partyAccess.ok) return partyAccess.response;

    const supabase = auth.supabase;
    const userId = auth.user.id;
    const body = await request.json();
    const { reversal_reason } = body;

    if (!reversal_reason?.trim()) {
        return NextResponse.json({ error: 'reversal_reason is required' }, { status: 400 });
    }

    const { data: receipt } = await supabase
        .from('party_payment_receipts')
        .select('id, status, branch_code')
        .eq('id', receiptId)
        .eq('party_id', partyId)
        .single();

    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    const forbiddenRecord = auth.forbidIfForeignBranch(receipt.branch_code);
    if (forbiddenRecord) return forbiddenRecord;
    if (receipt.status === 'REVERSED') return NextResponse.json({ error: 'Receipt is already reversed' }, { status: 400 });

    const { data, error } = await supabase
        .from('party_payment_receipts')
        .update({
            status: 'REVERSED',
            reversal_reason: reversal_reason.trim(),
            reversed_at: new Date().toISOString(),
            reversed_by: userId,
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
