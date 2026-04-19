import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const normalizeExtraChargeItems = (value: unknown) => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const label = String((item as { label?: unknown })?.label || '').trim();
            const amount = Number((item as { amount?: unknown })?.amount || 0);

            if (!label || Number.isNaN(amount) || amount <= 0) return null;

            return {
                label,
                amount: Number(amount.toFixed(2)),
            };
        })
        .filter((item): item is { label: string; amount: number } => item !== null);
};

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
    const { billing_date, billing_period_from, billing_period_to, amount, bill_ref_no, narration, covered_cn_nos, extra_charge_items } = body;

    if (!billing_date || !bill_ref_no?.trim() || !amount) {
        return NextResponse.json({ error: 'billing_date, bill_ref_no and amount are required' }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const normalizedNarration = narration?.trim() || `Freight bill ${bill_ref_no.trim()}`;
    const normalizedCoveredCns = Array.isArray(covered_cn_nos)
        ? covered_cn_nos.map((value) => String(value).trim()).filter(Boolean)
        : null;
    const normalizedExtraChargeItems = normalizeExtraChargeItems(extra_charge_items);

    const { data, error } = await supabase
        .from('party_billing_records')
        .insert({
            party_ledger_account_id: account.id,
            party_id: partyId,
            billing_date,
            billing_period_from: billing_period_from || null,
            billing_period_to: billing_period_to || null,
            amount: amountNum,
            bill_ref_no: bill_ref_no.trim(),
            narration: normalizedNarration,
            covered_cn_nos: normalizedCoveredCns,
            extra_charge_items: normalizedExtraChargeItems,
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
