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

export async function PUT(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rangeId = String(body.range_id || '').trim();
    const rangeStart = parseRangeValue(body.range_start);
    const rangeEnd = parseRangeValue(body.range_end);
    const note = typeof body.note === 'string' ? body.note.trim() : null;

    if (!rangeId || rangeStart === null || rangeEnd === null) {
        return NextResponse.json({ error: 'Range id, start and end are required.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('update_branch_cn_range', {
        p_range_id: rangeId,
        p_range_start: rangeStart,
        p_range_end: rangeEnd,
        p_note: note,
    });

    if (error) {
        if (isMissingCnManagementSchema(error)) {
            return NextResponse.json({ error: 'Apply the CN range queue migration first, then try again.' }, { status: 409 });
        }

        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(Array.isArray(data) ? data[0] : data, { status: 200 });
}

export async function DELETE(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rangeId = String(searchParams.get('id') || '').trim();

    if (!rangeId) {
        return NextResponse.json({ error: 'Range id is required.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('delete_branch_cn_range', {
        p_range_id: rangeId,
    });

    if (error) {
        if (isMissingCnManagementSchema(error)) {
            return NextResponse.json({ error: 'Apply the CN range queue migration first, then try again.' }, { status: 409 });
        }

        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: Boolean(data) }, { status: 200 });
}
