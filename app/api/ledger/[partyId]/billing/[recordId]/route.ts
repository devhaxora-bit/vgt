import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/ledger/[partyId]/billing/[recordId]
// Update editable fields on a billing record (admin only)
export async function PATCH(
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
    const { billing_date, billing_period_from, billing_period_to, bill_ref_no, narration, covered_cn_nos } = body;

    if (!billing_date) {
        return NextResponse.json({ error: 'billing_date is required' }, { status: 400 });
    }

    const { data: record } = await supabase
        .from('party_billing_records')
        .select('id, status')
        .eq('id', recordId)
        .eq('party_id', partyId)
        .single();

    if (!record) return NextResponse.json({ error: 'Billing record not found' }, { status: 404 });
    if (record.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Only active billing records can be edited' }, { status: 400 });
    }

    const normalizedBillRefNo = bill_ref_no?.trim() || null;
    const normalizedNarration = narration?.trim() || (normalizedBillRefNo ? `Freight bill ${normalizedBillRefNo}` : 'Freight bill');
    const normalizedCoveredCns = Array.isArray(covered_cn_nos)
        ? covered_cn_nos.map((value) => String(value).trim()).filter(Boolean)
        : null;

    const { data, error } = await supabase
        .from('party_billing_records')
        .update({
            billing_date,
            billing_period_from: billing_period_from || null,
            billing_period_to: billing_period_to || null,
            bill_ref_no: normalizedBillRefNo,
            narration: normalizedNarration,
            covered_cn_nos: normalizedCoveredCns,
        })
        .eq('id', recordId)
        .eq('party_id', partyId)
        .select()
        .single();

    if (error) {
        console.error('Failed to update billing record:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
