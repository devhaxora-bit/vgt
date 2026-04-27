import { createClient } from '@/utils/supabase/server';
import { NextResponse } from "next/server";

type ReservedRange = {
    range_start: number;
    range_end: number;
};

const normalizeNextAvailable = (candidate: number, rangeEnd: number, reservedRanges: ReservedRange[]) => {
    let next = candidate;

    while (next <= rangeEnd) {
        const reserved = reservedRanges.find((range) => next >= range.range_start && next <= range.range_end);
        if (!reserved) {
            return next;
        }
        next = reserved.range_end + 1;
    }

    return next;
};

const countAvailableNumbers = (candidate: number, rangeEnd: number, reservedRanges: ReservedRange[]) => {
    if (candidate > rangeEnd) return 0;

    const sortedReserved = [...reservedRanges].sort((a, b) => a.range_start - b.range_start);
    let cursor = candidate;
    let available = 0;

    for (const reserved of sortedReserved) {
        if (reserved.range_end < cursor) continue;
        if (reserved.range_start > rangeEnd) break;

        if (reserved.range_start > cursor) {
            available += reserved.range_start - cursor;
        }

        cursor = Math.max(cursor, reserved.range_end + 1);
        if (cursor > rangeEnd) break;
    }

    if (cursor <= rangeEnd) {
        available += rangeEnd - cursor + 1;
    }

    return available;
};

export async function GET(request: Request) {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const branchCode = searchParams.get("branch")?.toUpperCase();

    if (!branchCode) {
        return NextResponse.json({ error: "Branch code is required" }, { status: 400 });
    }

    const { data: branch, error } = await supabase
        .from("branches")
        .select("id, code, cn_prefix, next_cn_no")
        .eq("code", branchCode)
        .single();

    if (error) {
        console.error("Failed to fetch branch details:", error);
        return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    const { data: cnRanges, error: cnRangesError } = await supabase
        .from('branch_cn_ranges')
        .select('id, range_start, range_end, next_cn_no, status')
        .eq('branch_id', branch.id)
        .order('created_at', { ascending: false });

    if (cnRangesError) {
        console.error('Failed to fetch branch CN ranges:', cnRangesError);
        return NextResponse.json({ error: 'Failed to fetch branch CN range details' }, { status: 500 });
    }

    const activeRange = (cnRanges || []).find((range) => range.status === 'active') || null;
    const latestRange = (cnRanges || [])[0] || null;

    if (activeRange) {
        const { data: reservedRanges, error: reservedRangesError } = await supabase
            .from('branch_cn_reserved_ranges')
            .select('range_start, range_end')
            .eq('branch_id', branch.id)
            .lte('range_start', activeRange.range_end)
            .gte('range_end', activeRange.range_start)
            .order('range_start', { ascending: true });

        if (reservedRangesError) {
            console.error('Failed to fetch reserved CN ranges:', reservedRangesError);
            return NextResponse.json({ error: 'Failed to fetch reserved CN ranges' }, { status: 500 });
        }

        const normalizedNextNo = normalizeNextAvailable(
            Number(activeRange.next_cn_no),
            Number(activeRange.range_end),
            (reservedRanges || []).map((range) => ({
                range_start: Number(range.range_start),
                range_end: Number(range.range_end),
            }))
        );

        if (normalizedNextNo > Number(activeRange.range_end)) {
            return NextResponse.json({
                status: 'range_exhausted',
                mode: 'range',
                prefix: branch.cn_prefix || 'S',
                rangeStart: Number(activeRange.range_start),
                rangeEnd: Number(activeRange.range_end),
                nextNo: normalizedNextNo,
                message: `CN range ${activeRange.range_start}-${activeRange.range_end} is exhausted for branch ${branch.code}. Update Branch Management with a new range.`,
            });
        }

        return NextResponse.json({
            status: 'ready',
            mode: 'range',
            prefix: branch.cn_prefix || 'S',
            rangeStart: Number(activeRange.range_start),
            rangeEnd: Number(activeRange.range_end),
            nextNo: normalizedNextNo,
            reservedCount: (reservedRanges || []).length,
            remainingCount: countAvailableNumbers(
                normalizedNextNo,
                Number(activeRange.range_end),
                (reservedRanges || []).map((range) => ({
                    range_start: Number(range.range_start),
                    range_end: Number(range.range_end),
                }))
            ),
        });
    }

    if ((cnRanges || []).length > 0) {
        const exhaustedRange = latestRange;

        return NextResponse.json({
            status: exhaustedRange?.status === 'exhausted' ? 'range_exhausted' : 'configuration_required',
            mode: 'range',
            prefix: branch.cn_prefix || 'S',
            rangeStart: exhaustedRange ? Number(exhaustedRange.range_start) : null,
            rangeEnd: exhaustedRange ? Number(exhaustedRange.range_end) : null,
            nextNo: exhaustedRange ? Number(exhaustedRange.next_cn_no) : null,
            message: exhaustedRange?.status === 'exhausted'
                ? `CN range ${exhaustedRange.range_start}-${exhaustedRange.range_end} is exhausted for branch ${branch.code}. Update Branch Management with a new range.`
                : `No active CN range is configured for branch ${branch.code}. Update Branch Management to continue.`,
        });
    }

    return NextResponse.json({
        status: 'ready',
        mode: 'legacy',
        prefix: branch.cn_prefix || 'S',
        nextNo: Number(branch.next_cn_no || 800001),
        message: `Branch ${branch.code} is using the legacy CN counter. Configure a branch CN range in Branch Management to enforce assigned ranges and physical-copy exclusions.`,
    });
}
