import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuthz, requirePartyBranchAccess } from '@/lib/server/requireAuthz';

type ReassignResult = {
    success: boolean;
    receipt_id: string;
    old_party_id: string;
    new_party_id: string;
    new_party_name: string;
    reason?: string;
};

const reassignBodySchema = z.object({
    new_party_id: z.string().min(1, 'new_party_id is required'),
    reason: z.string().trim().min(1, 'reason is required'),
});

const mapRpcError = (message: string, code?: string) => {
    if (code === 'P0409' || /still belong to the old party/i.test(message)) {
        return { status: 409 as const, error: message };
    }
    if (/not found/i.test(message)) {
        return { status: 404 as const, error: message };
    }
    if (/admin|authentication/i.test(message)) {
        return { status: 403 as const, error: message };
    }
    return { status: 400 as const, error: message };
};

// POST /api/ledger/[partyId]/payments/[receiptId]/reassign-party
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string; receiptId: string }> }
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { partyId, receiptId } = await params;
    const partyAccess = await requirePartyBranchAccess(auth, partyId);
    if (!partyAccess.ok) return partyAccess.response;

    const parsed = reassignBodySchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    const newPartyId = parsed.data.new_party_id.trim();
    const reason = parsed.data.reason.trim();

    if (newPartyId === partyId) {
        return NextResponse.json({ error: 'New party is the same as the current party' }, { status: 400 });
    }

    const newPartyAccess = await requirePartyBranchAccess(auth, newPartyId);
    if (!newPartyAccess.ok) return newPartyAccess.response;

    const { data, error } = await auth.supabase.rpc('fn_reassign_payment_receipt_party', {
        p_receipt_id: receiptId,
        p_old_party_id: partyId,
        p_new_party_id: newPartyId,
        p_reason: reason,
    });

    if (error) {
        const mapped = mapRpcError(error.message || 'Failed to reassign payment receipt', error.code);
        return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    return NextResponse.json(data as ReassignResult);
}
