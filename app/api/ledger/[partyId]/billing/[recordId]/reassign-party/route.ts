import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuthz, requirePartyBranchAccess, type AuthzContext } from '@/lib/server/requireAuthz';

type ReassignResult = {
    success: boolean;
    bill_id: string;
    bill_ref_no: string | null;
    old_party_id: string;
    new_party_id: string;
    new_party_name: string;
    moved_payment_count: number;
    moved_cn_count: number;
};

type PaymentRow = {
    id: string;
    receipt_date: string;
    amount: number;
    related_billing_record_ids: string[] | null;
    bill_allocations: Array<{ billing_record_id?: string }> | null;
};

const reassignBodySchema = z.object({
    new_party_id: z.string().min(1, 'new_party_id is required'),
    confirm_move_payments: z.boolean().optional().default(false),
});

const linkedBillIds = (receipt: PaymentRow): string[] => {
    const ids = new Set<string>();
    for (const id of receipt.related_billing_record_ids || []) {
        const trimmed = String(id || '').trim();
        if (trimmed) ids.add(trimmed);
    }
    for (const allocation of receipt.bill_allocations || []) {
        const trimmed = String(allocation.billing_record_id || '').trim();
        if (trimmed) ids.add(trimmed);
    }
    return [...ids];
};

const mapRpcError = (message: string, code?: string) => {
    if (code === 'P0409' || /also cover other bills|confirm moving both/i.test(message)) {
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

const loadLinkedPayments = async (
    supabase: AuthzContext['supabase'],
    partyId: string,
    recordId: string,
) => {
    const { data, error } = await supabase
        .from('party_payment_receipts')
        .select('id, receipt_date, amount, related_billing_record_ids, bill_allocations')
        .eq('party_id', partyId)
        .eq('status', 'ACTIVE');

    if (error) {
        throw new Error(error.message);
    }

    const linked = ((data || []) as PaymentRow[]).filter((receipt) => linkedBillIds(receipt).includes(recordId));
    const exclusive = linked.filter((receipt) => linkedBillIds(receipt).length === 1);
    const blocked = linked.filter((receipt) => linkedBillIds(receipt).length > 1);

    return { exclusive, blocked };
};

// GET /api/ledger/[partyId]/billing/[recordId]/reassign-party
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ partyId: string; recordId: string }> }
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { partyId, recordId } = await params;
    const partyAccess = await requirePartyBranchAccess(auth, partyId);
    if (!partyAccess.ok) return partyAccess.response;

    try {
        const { exclusive, blocked } = await loadLinkedPayments(auth.supabase, partyId, recordId);
        return NextResponse.json({
            exclusive_payment_count: exclusive.length,
            blocked_payment_count: blocked.length,
            exclusive_payments: exclusive.map((receipt) => ({
                id: receipt.id,
                receipt_date: receipt.receipt_date,
                amount: receipt.amount,
            })),
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to load linked payments' },
            { status: 500 }
        );
    }
}

// POST /api/ledger/[partyId]/billing/[recordId]/reassign-party
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string; recordId: string }> }
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { partyId, recordId } = await params;
    const partyAccess = await requirePartyBranchAccess(auth, partyId);
    if (!partyAccess.ok) return partyAccess.response;

    const parsed = reassignBodySchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }

    const newPartyId = parsed.data.new_party_id.trim();
    const confirmMovePayments = parsed.data.confirm_move_payments;

    if (newPartyId === partyId) {
        return NextResponse.json({ error: 'New party is the same as the current party' }, { status: 400 });
    }

    const newPartyAccess = await requirePartyBranchAccess(auth, newPartyId);
    if (!newPartyAccess.ok) return newPartyAccess.response;

    const { data, error } = await auth.supabase.rpc('fn_reassign_billing_record_party', {
        p_bill_id: recordId,
        p_old_party_id: partyId,
        p_new_party_id: newPartyId,
        p_confirm_move_payments: confirmMovePayments,
    });

    if (error) {
        const mapped = mapRpcError(error.message || 'Failed to reassign billing record', error.code);
        return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    return NextResponse.json(data as ReassignResult);
}
