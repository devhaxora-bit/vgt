import { NextResponse } from 'next/server';

import { requireAuthz } from '@/lib/server/requireAuthz';

// GET /api/consignments/bill-previews
// Active billing records + their parties, used to show bill links on the CN list.
export async function GET() {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const { data: records, error } = await auth.supabase
        .from('party_billing_records')
        .select('*')
        .eq('status', 'ACTIVE');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const partyIds = Array.from(
        new Set((records || []).map((record) => record.party_id).filter(Boolean)),
    ) as string[];

    if (partyIds.length === 0) {
        return NextResponse.json({ records: records || [], parties: [] });
    }

    const { data: parties, error: partiesError } = await auth.supabase
        .from('parties')
        .select('id, name, code, phone, gstin, address, branch_code')
        .in('id', partyIds);

    if (partiesError) {
        return NextResponse.json({ error: partiesError.message }, { status: 500 });
    }

    return NextResponse.json({ records: records || [], parties: parties || [] });
}
