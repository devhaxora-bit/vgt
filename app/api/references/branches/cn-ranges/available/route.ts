import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/** POST — list free vs used CN numbers inside a numeric block (live consignments only). */
export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rangeStart = parseInt(String(body.range_start), 10);
    const rangeEnd = parseInt(String(body.range_end), 10);

    if (Number.isNaN(rangeStart) || Number.isNaN(rangeEnd)) {
        return NextResponse.json(
            { error: 'range_start and range_end are required.' },
            { status: 400 },
        );
    }

    if (rangeStart > rangeEnd) {
        return NextResponse.json(
            { error: 'range_start must be less than or equal to range_end.' },
            { status: 400 },
        );
    }

    const span = rangeEnd - rangeStart + 1;
    if (span > 5000) {
        return NextResponse.json(
            { error: 'Range is too large to list (max 5000 numbers).' },
            { status: 400 },
        );
    }

    const { data: existingCnsRaw, error } = await supabase.rpc('get_existing_cns_in_range', {
        p_range_start: rangeStart,
        p_range_end: rangeEnd,
    });

    if (error) {
        const isSchemaError = error.code === '42883' || error.code === '42P01';
        if (!isSchemaError) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    const usedSet = new Set<number>(
        (existingCnsRaw || []).map((row: { cn_num: number }) => Number(row.cn_num)),
    );

    const available: number[] = [];
    const used: number[] = [];
    for (let cn = rangeStart; cn <= rangeEnd; cn += 1) {
        if (usedSet.has(cn)) used.push(cn);
        else available.push(cn);
    }

    return NextResponse.json({
        range_start: rangeStart,
        range_end: rangeEnd,
        total: span,
        available_count: available.length,
        used_count: used.length,
        available,
        used,
    });
}
