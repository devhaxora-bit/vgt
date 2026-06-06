import { createClient } from '@/utils/supabase/server';
import { NextResponse } from "next/server";

const isMissingCnManagementSchema = (error: { code?: string; message?: string } | null) => {
    if (!error) return false;
    if (error.code === '42P01' || error.code === '42883') return true;

    const message = String(error.message || '').toLowerCase();
    return message.includes('branch_cn_ranges') || message.includes('next_available_branch_cn');
};

const countRemaining = (nextNo: number, rangeEnd: number) => {
    if (nextNo > rangeEnd) return 0;
    return rangeEnd - nextNo + 1;
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
        if (isMissingCnManagementSchema(cnRangesError)) {
            return NextResponse.json({
                status: 'ready',
                mode: 'legacy',
                prefix: branch.cn_prefix || 'S',
                nextNo: Number(branch.next_cn_no || 800001),
                message: `Branch ${branch.code} is using the legacy CN counter.`,
            });
        }

        console.error('Failed to fetch branch CN ranges:', cnRangesError);
        return NextResponse.json({ error: 'Failed to fetch branch CN range details' }, { status: 500 });
    }

    const activeRange = (cnRanges || []).find((range) => range.status === 'active') || null;
    const latestRange = (cnRanges || [])[0] || null;

    if (activeRange) {
        const nextNo = Number(activeRange.next_cn_no);
        const rangeEnd = Number(activeRange.range_end);

        if (nextNo > rangeEnd) {
            return NextResponse.json({
                status: 'range_exhausted',
                mode: 'range',
                prefix: branch.cn_prefix || 'S',
                rangeStart: Number(activeRange.range_start),
                rangeEnd,
                nextNo,
                message: `CN range ${activeRange.range_start}-${rangeEnd} is exhausted for branch ${branch.code}. Update Branch Management with a new range.`,
            });
        }

        const remainingCount = countRemaining(nextNo, rangeEnd);

        return NextResponse.json({
            status: 'ready',
            mode: 'range',
            prefix: branch.cn_prefix || 'S',
            rangeStart: Number(activeRange.range_start),
            rangeEnd,
            nextNo,
            remainingCount,
            isLowCn: remainingCount > 0 && remainingCount <= 5,
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
        message: `Branch ${branch.code} is using the legacy CN counter. Configure a branch CN range in Branch Management to enforce assigned ranges.`,
    });
}
