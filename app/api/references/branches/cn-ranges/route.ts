import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const parseRangeValue = (value: unknown) => {
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const isMissingCnManagementSchema = (error: { code?: string; message?: string } | null) => {
    if (!error) return false;
    if (error.code === '42P01' || error.code === '42883') return true;

    const message = String(error.message || '').toLowerCase();
    return message.includes('branch_cn_ranges') || message.includes('create_branch_cn_range');
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
    const rangeStart = parseRangeValue(body.range_start);
    const rangeEnd = parseRangeValue(body.range_end);
    const note = typeof body.note === 'string' ? body.note.trim() : null;

    if (!branchId || rangeStart === null || rangeEnd === null) {
        return NextResponse.json({ error: 'Branch, range start and range end are required.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('create_branch_cn_range', {
        p_branch_id: branchId,
        p_range_start: rangeStart,
        p_range_end: rangeEnd,
        p_note: note,
    });

    if (error) {
        if (isMissingCnManagementSchema(error)) {
            return NextResponse.json({ error: 'Apply the branch CN range migration first, then try again.' }, { status: 409 });
        }

        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(Array.isArray(data) ? data[0] : data, { status: 201 });
}
