import { NextRequest, NextResponse } from 'next/server';
import { hasActiveLinkedChallanPayments } from '@/lib/server/challanBillingSnapshot';
import { requireAuthz, requireBrokerBranchAccess } from '@/lib/server/requireAuthz';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ brokerId: string; recordId: string }> }
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { brokerId, recordId } = await params;
    const brokerAccess = await requireBrokerBranchAccess(auth, brokerId);
    if (!brokerAccess.ok) return brokerAccess.response;

    const supabase = auth.supabase;
    const userId = auth.user.id;
    const body = await request.json();
    const { cancel_reason } = body;

    if (!cancel_reason?.trim()) {
        return NextResponse.json({ error: 'cancel_reason is required' }, { status: 400 });
    }

    const { data: record } = await supabase
        .from('broker_challan_billing_records')
        .select('id, status, branch_code')
        .eq('id', recordId)
        .eq('broker_id', brokerId)
        .single();

    if (!record) return NextResponse.json({ error: 'Billing record not found' }, { status: 404 });
    const forbiddenRecord = auth.forbidIfForeignBranch(record.branch_code);
    if (forbiddenRecord) return forbiddenRecord;
    if (record.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Record is already cancelled' }, { status: 400 });
    }

    const { hasLinkedPayments, error: linkedPaymentsError } = await hasActiveLinkedChallanPayments(supabase, {
        brokerId,
        billingRecordId: recordId,
    });

    if (linkedPaymentsError) {
        return NextResponse.json({ error: linkedPaymentsError }, { status: 500 });
    }

    if (hasLinkedPayments) {
        return NextResponse.json({ error: 'Bills with active linked payments cannot be cancelled. Reverse the linked payment first.' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('broker_challan_billing_records')
        .update({
            status: 'CANCELLED',
            cancel_reason: cancel_reason.trim(),
            cancelled_at: new Date().toISOString(),
            cancelled_by: userId,
        })
        .eq('id', recordId)
        .select()
        .single();

    if (error) {
        console.error('Failed to cancel broker challan billing record:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
