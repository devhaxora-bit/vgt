import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const LOW_CN_THRESHOLD = 5;

type BranchRow = {
    id: string;
    code: string;
    name: string;
    type?: string;
    city?: string;
    state?: string;
    next_cn_no?: number;
    is_head_branch?: boolean;
};

const countRemaining = (nextNo: number, rangeEnd: number) => {
    if (nextNo > rangeEnd) return 0;
    return rangeEnd - nextNo + 1;
};

const isMissingSchemaColumn = (error: { code?: string; message?: string } | null) => {
    if (!error) return false;
    if (error.code === '42703' || error.code === 'PGRST200') return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('does not exist') || message.includes('could not find');
};

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile || profile.role !== 'admin') {
        return { error: NextResponse.json({ error: 'Admin privileges required' }, { status: 403 }) };
    }

    return { user };
}

async function findBranchByCode(
    supabase: Awaited<ReturnType<typeof createClient>>,
    branchCode: string
): Promise<BranchRow | null> {
    const normalizedCode = branchCode.trim().toUpperCase();

    const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .ilike('code', normalizedCode)
        .limit(1);

    if (error) {
        console.error('Failed to fetch branch for CN assigning:', error);
        return null;
    }

    const branch = (data || [])[0] as BranchRow | undefined;
    if (!branch) return null;

    return {
        ...branch,
        code: branch.code.toUpperCase(),
        is_head_branch: branch.is_head_branch ?? branch.code.toUpperCase() === 'VZM',
    };
}

async function findHeadBranch(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data, error } = await supabase
        .from('branches')
        .select('code, name, is_head_branch')
        .eq('is_active', true);

    if (error) {
        if (isMissingSchemaColumn(error)) {
            const { data: fallback } = await supabase
                .from('branches')
                .select('code, name')
                .eq('is_active', true)
                .ilike('code', 'VZM')
                .limit(1);
            return fallback?.[0] ?? null;
        }
        return null;
    }

    const flagged = (data || []).find((row) => row.is_head_branch === true);
    if (flagged) return { code: flagged.code, name: flagged.name };

    const vzm = (data || []).find((row) => String(row.code).toUpperCase() === 'VZM');
    return vzm ? { code: vzm.code, name: vzm.name } : null;
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ branchCode: string }> }
) {
    const supabase = await createClient();
    const authResult = await requireAdmin(supabase);
    if ('error' in authResult && authResult.error) return authResult.error;

    const { branchCode } = await params;
    const branch = await findBranchByCode(supabase, branchCode);

    if (!branch) {
        return NextResponse.json(
            { error: `Branch "${branchCode.toUpperCase()}" not found or is inactive.` },
            { status: 404 }
        );
    }

    const headBranch = await findHeadBranch(supabase);

    const { data: cnRanges, error: rangesError } = await supabase
        .from('branch_cn_ranges')
        .select(`
            id,
            branch_id,
            range_start,
            range_end,
            next_cn_no,
            status,
            note,
            created_at,
            assigned_by,
            assigner:users!branch_cn_ranges_assigned_by_fkey(full_name, employee_code)
        `)
        .eq('branch_id', branch.id)
        .order('created_at', { ascending: false });

    if (rangesError) {
        const isMissingColumn = isMissingSchemaColumn(rangesError);

        if (!isMissingColumn) {
            console.error('Failed to fetch CN ranges:', rangesError);
            return NextResponse.json({ error: rangesError.message }, { status: 500 });
        }

        const { data: fallbackRanges, error: fallbackError } = await supabase
            .from('branch_cn_ranges')
            .select('*')
            .eq('branch_id', branch.id)
            .order('created_at', { ascending: false });

        if (fallbackError) {
            return NextResponse.json({ error: fallbackError.message }, { status: 500 });
        }

        const activeRange = (fallbackRanges || []).find((r) => r.status === 'active') || null;
        const remainingCount = activeRange
            ? countRemaining(Number(activeRange.next_cn_no), Number(activeRange.range_end))
            : null;

        return NextResponse.json({
            branch,
            head_branch: headBranch,
            active_range: activeRange,
            remaining_count: remainingCount,
            is_low_cn: remainingCount !== null && remainingCount > 0 && remainingCount <= LOW_CN_THRESHOLD,
            history: (fallbackRanges || []).map((range) => ({
                id: range.id,
                range_start: Number(range.range_start),
                range_end: Number(range.range_end),
                next_cn_no: Number(range.next_cn_no),
                status: range.status,
                note: range.note,
                created_at: range.created_at,
                assigned_by_name: null,
                assigned_by_code: null,
            })),
        });
    }

    const activeRange = (cnRanges || []).find((r) => r.status === 'active') || null;
    const pendingRanges = (cnRanges || [])
        .filter((r) => r.status === 'pending')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const remainingCount = activeRange
        ? countRemaining(Number(activeRange.next_cn_no), Number(activeRange.range_end))
        : null;

    const history = (cnRanges || []).map((range) => {
        const assignerRaw = range.assigner;
        const assigner = Array.isArray(assignerRaw) ? assignerRaw[0] : assignerRaw;
        return {
            id: range.id,
            range_start: Number(range.range_start),
            range_end: Number(range.range_end),
            next_cn_no: Number(range.next_cn_no),
            status: range.status,
            note: range.note,
            created_at: range.created_at,
            assigned_by: range.assigned_by,
            assigned_by_name: assigner?.full_name ?? null,
            assigned_by_code: assigner?.employee_code ?? null,
            can_edit: range.status === 'pending' || range.status === 'inactive',
            can_delete: range.status === 'pending' || range.status === 'inactive',
        };
    });

    return NextResponse.json({
        branch,
        head_branch: headBranch,
        active_range: activeRange
            ? {
                id: activeRange.id,
                range_start: Number(activeRange.range_start),
                range_end: Number(activeRange.range_end),
                next_cn_no: Number(activeRange.next_cn_no),
                status: activeRange.status,
                note: activeRange.note,
                created_at: activeRange.created_at,
            }
            : null,
        remaining_count: remainingCount,
        is_low_cn: remainingCount !== null && remainingCount > 0 && remainingCount <= LOW_CN_THRESHOLD,
        pending_ranges: pendingRanges.map((range) => ({
            id: range.id,
            range_start: Number(range.range_start),
            range_end: Number(range.range_end),
            next_cn_no: Number(range.next_cn_no),
            status: range.status,
            note: range.note,
            created_at: range.created_at,
        })),
        history,
    });
}
