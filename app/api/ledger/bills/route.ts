import { NextResponse } from 'next/server';

import { requireAuthz } from '@/lib/server/requireAuthz';

/** Extract trailing serial number from bill refs like VZM/26-27/2152 → 2152 */
const billSerialNumber = (billRefNo: string | null | undefined): number => {
    const raw = String(billRefNo || '').trim();
    if (!raw) return 0;
    const match = raw.match(/(\d+)\s*$/);
    if (!match) return 0;
    const num = parseInt(match[1], 10);
    return Number.isNaN(num) ? 0 : num;
};

// GET /api/ledger/bills
// Global party billing records list (with party name)
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
        .from('party_billing_records')
        .select(`
            id,
            party_id,
            billing_date,
            billing_period_from,
            billing_period_to,
            amount,
            bill_ref_no,
            narration,
            covered_cn_nos,
            status,
            cn_total_amount,
            added_other_charges_amount,
            vehicle_cancel_items,
            vehicle_cancel_charges_total,
            consignment_snapshot,
            extra_charge_items,
            cancel_reason,
            cancelled_at,
            created_at,
            parties:party_id (
                name,
                code,
                branch_code
            )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status) query = query.eq('status', status.toUpperCase());
    if (dateFrom) query = query.gte('billing_date', dateFrom);
    if (dateTo) query = query.lte('billing_date', dateTo);

    const { data, error } = await query;
    if (error) {
        console.error('Failed to list billing records:', error);
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
            billing_date: row.billing_date,
            billing_period_from: row.billing_period_from,
            billing_period_to: row.billing_period_to,
            amount: Number(row.amount || 0),
            bill_ref_no: row.bill_ref_no,
            narration: row.narration || '',
            covered_cn_nos: row.covered_cn_nos || [],
            status: row.status,
            cn_total_amount: Number(row.cn_total_amount || 0),
            added_other_charges_amount: Number(row.added_other_charges_amount || 0),
            vehicle_cancel_items: row.vehicle_cancel_items || [],
            vehicle_cancel_charges_total: Number(row.vehicle_cancel_charges_total || 0),
            consignment_snapshot: row.consignment_snapshot || [],
            extra_charge_items: row.extra_charge_items || [],
            cancel_reason: row.cancel_reason,
            cancelled_at: row.cancelled_at,
            created_at: row.created_at,
        };
    });

    const filtered = search
        ? rows.filter((row) => {
            const hay = `${row.bill_ref_no || ''} ${row.party_name} ${row.party_code} ${(row.covered_cn_nos || []).join(' ')} ${row.narration || ''}`.toLowerCase();
            return hay.includes(search.toLowerCase());
        })
        : rows;

    // Serial order: highest bill number (latest) first, then newest created_at
    const sorted = [...filtered].sort((a, b) => {
        const serialDiff = billSerialNumber(b.bill_ref_no) - billSerialNumber(a.bill_ref_no);
        if (serialDiff !== 0) return serialDiff;
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bCreated - aCreated;
    });

    const totalAmount = sorted
        .filter((row) => row.status === 'ACTIVE')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return NextResponse.json({
        data: sorted,
        summary: {
            count: sorted.length,
            active_count: sorted.filter((row) => row.status === 'ACTIVE').length,
            total_amount: totalAmount,
        },
    });
}
