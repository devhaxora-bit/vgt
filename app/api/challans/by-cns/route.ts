import { NextResponse } from 'next/server';

import { requireAuthz } from '@/lib/server/requireAuthz';

// GET /api/challans/by-cns?cns=CN1,CN2
// Returns challan numbers that include any of the given CN nos in linked_cn_nos
export async function GET(request: Request) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('cns')?.trim() || '';
    const cnNos = raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 100);

    if (cnNos.length === 0) {
        return NextResponse.json({ data: [] });
    }

    const { data, error } = await auth.supabase
        .from('challans')
        .select('id, challan_no, linked_cn_nos, vehicle_no, status')
        .overlaps('linked_cn_nos', cnNos)
        .limit(200);

    if (error) {
        console.error('Failed to resolve challans by CN:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const cnSet = new Set(cnNos.map((cn) => cn.toUpperCase()));
    const rows = (data || [])
        .filter((row) =>
            (row.linked_cn_nos || []).some((cn: string) => cnSet.has(String(cn).toUpperCase()))
        )
        .map((row) => ({
            id: row.id,
            challan_no: row.challan_no,
            vehicle_no: row.vehicle_no,
            status: row.status,
            linked_cn_nos: row.linked_cn_nos || [],
        }));

    return NextResponse.json({ data: rows });
}
