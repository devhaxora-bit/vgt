import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const parseRangeValue = (value: unknown) => {
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : parsed;
};

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const branchId = String(body.branch_id || '').trim();
    const rangeType = String(body.range_type || '').trim().toLowerCase();
    const rangeStart = parseRangeValue(body.range_start);
    const rangeEnd = parseRangeValue(body.range_end);
    const note = typeof body.note === 'string' ? body.note.trim() : null;

    if (!branchId || rangeStart === null || rangeEnd === null) {
        return NextResponse.json({ error: 'Branch, range start and range end are required.' }, { status: 400 });
    }

    if (rangeType !== 'system' && rangeType !== 'physical') {
        return NextResponse.json({ error: 'range_type must be either "system" or "physical".' }, { status: 400 });
    }

    const rpcName = rangeType === 'system'
        ? 'create_branch_cn_range'
        : 'create_branch_cn_reserved_range';

    const { data, error } = await supabase.rpc(rpcName, {
        p_branch_id: branchId,
        p_range_start: rangeStart,
        p_range_end: rangeEnd,
        p_note: note,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(Array.isArray(data) ? data[0] : data, { status: 201 });
}
