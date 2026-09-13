import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const LOW_CN_THRESHOLD = 5;

type BranchJoin = { code: string; name: string; is_active?: boolean };

type RangeConflictRow = {
    id: string;
    range_start: number;
    range_end: number;
    status: string;
    branch_id: string;
    branches: BranchJoin | BranchJoin[] | null;
};

const computeSuggestedStart = (
    rangeStart: number,
    rangeEnd: number,
    existingCns: number[]
): number | null => {
    const existingSet = new Set(existingCns);
    let cursor = rangeStart;

    while (cursor <= rangeEnd) {
        if (existingSet.has(cursor)) {
            cursor++;
            continue;
        }
        return cursor;
    }
    return null;
};

const rangesOverlap = (
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
) => aStart <= bEnd && bStart <= aEnd;

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
    const excludeRangeId = String(body.exclude_range_id || '').trim() || null;
    const rangeStart = parseInt(String(body.range_start), 10);
    const rangeEnd = parseInt(String(body.range_end), 10);

    if (!branchId || Number.isNaN(rangeStart) || Number.isNaN(rangeEnd)) {
        return NextResponse.json(
            { error: 'branch_id, range_start, and range_end are required.' },
            { status: 400 }
        );
    }

    if (rangeStart > rangeEnd) {
        return NextResponse.json(
            { error: 'range_start must be less than or equal to range_end.' },
            { status: 400 }
        );
    }

    // Live CNs only (soft-deleted excluded by get_existing_cns_in_range).
    const { data: existingCnsRaw, error: existingError } = await supabase.rpc(
        'get_existing_cns_in_range',
        { p_range_start: rangeStart, p_range_end: rangeEnd }
    );

    if (existingError) {
        const isSchemaError = existingError.code === '42883' || existingError.code === '42P01';
        if (!isSchemaError) {
            return NextResponse.json({ error: existingError.message }, { status: 500 });
        }
    }

    const existingCns: number[] = (existingCnsRaw || []).map((row: { cn_num: number }) =>
        Number(row.cn_num)
    );
    const existingSet = new Set(existingCns);

    let conflictQuery = supabase
        .from('branch_cn_ranges')
        .select('id, range_start, range_end, status, branch_id, branches!inner(code, name, is_active)')
        .in('status', ['active', 'pending', 'exhausted'])
        .lte('range_start', rangeEnd)
        .gte('range_end', rangeStart);

    if (excludeRangeId) {
        conflictQuery = conflictQuery.neq('id', excludeRangeId);
    }

    const { data: conflictingRanges, error: conflictError } = await conflictQuery;

    if (conflictError) {
        return NextResponse.json({ error: conflictError.message }, { status: 500 });
    }

    const conflicts = ((conflictingRanges || []) as RangeConflictRow[])
        .filter((row) => {
            const otherStart = Number(row.range_start);
            const otherEnd = Number(row.range_end);
            if (!rangesOverlap(rangeStart, rangeEnd, otherStart, otherEnd)) return false;

            // Active / queued always block.
            if (row.status === 'active' || row.status === 'pending') return true;

            // Exhausted only blocks if live CNs still exist in the overlap.
            if (row.status === 'exhausted') {
                const overlapFrom = Math.max(rangeStart, otherStart);
                const overlapTo = Math.min(rangeEnd, otherEnd);
                for (let cn = overlapFrom; cn <= overlapTo; cn += 1) {
                    if (existingSet.has(cn)) return true;
                }
                return false;
            }

            return false;
        })
        .map((row) => {
            const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
            return {
                range_start: Number(row.range_start),
                range_end: Number(row.range_end),
                status: row.status,
                branch_code: branch?.code ?? '?',
                branch_name: branch?.name ?? '?',
                same_branch: row.branch_id === branchId,
            };
        });

    const suggestedStart = computeSuggestedStart(rangeStart, rangeEnd, existingCns);
    const remainingAfterStart =
        suggestedStart !== null ? Math.max(0, rangeEnd - suggestedStart + 1) : 0;

    return NextResponse.json({
        conflicts,
        existing_cns: existingCns,
        suggested_start: suggestedStart,
        remaining_after_start: remainingAfterStart,
        is_low: remainingAfterStart > 0 && remainingAfterStart <= LOW_CN_THRESHOLD,
        has_conflicts: conflicts.length > 0,
        has_existing: existingCns.length > 0,
        all_used: suggestedStart === null,
    });
}
