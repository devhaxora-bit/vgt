import { NextResponse } from 'next/server';

import { requireAuthz } from '@/lib/server/requireAuthz';

// GET /api/ledger/payments
// Global party payment receipts list (with party name)
export async function GET(request: Request) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const dateFrom = searchParams.get('date_from')?.trim() || '';
    const dateTo = searchParams.get('date_to')?.trim() || '';
    const limit = Math.min(Number(searchParams.get('limit') || 200) || 200, 500);

    let query = auth.supabase
        .from('party_payment_receipts')
        .select(`
            id,
            party_id,
            receipt_date,
            amount,
            actual_received_amount,
            payment_mode,
            reference_no,
            bank_name,
            narration,
            status,
            related_billing_record_ids,
            bill_allocations,
            created_at,
            parties:party_id (
                name,
                code,
                branch_code
            )
        `)
        .order('receipt_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status) query = query.eq('status', status.toUpperCase());
    if (dateFrom) query = query.gte('receipt_date', dateFrom);
    if (dateTo) query = query.lte('receipt_date', dateTo);

    const { data, error } = await query;
    if (error) {
        console.error('Failed to list payment receipts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []).map((row) => {
        const party = Array.isArray(row.parties) ? row.parties[0] : row.parties;
        return {
            id: row.id,
            party_id: row.party_id,
            party_name: party?.name || '—',
            party_code: party?.code || '',
            branch_code: party?.branch_code || '',
            receipt_date: row.receipt_date,
            amount: Number(row.amount || 0),
            actual_received_amount: Number(row.actual_received_amount ?? row.amount ?? 0),
            payment_mode: row.payment_mode,
            reference_no: row.reference_no,
            bank_name: row.bank_name,
            narration: row.narration,
            status: row.status,
            related_billing_record_ids: row.related_billing_record_ids || [],
            bill_allocations: row.bill_allocations || [],
            created_at: row.created_at,
        };
    });

    const filtered = search
        ? rows.filter((row) => {
            const hay = `${row.party_name} ${row.party_code} ${row.payment_mode || ''} ${row.reference_no || ''} ${row.bank_name || ''} ${row.narration || ''}`.toLowerCase();
            return hay.includes(search.toLowerCase());
        })
        : rows;

    return NextResponse.json({ data: filtered });
}
