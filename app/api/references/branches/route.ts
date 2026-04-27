import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const parseOptionalInteger = (value: unknown, fallback: number) => {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const includeCnConfig = searchParams.get('includeCnConfig') === '1';

    let query = supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (type) {
        query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!includeCnConfig || !data || data.length === 0) {
        return NextResponse.json(data);
    }

    const branchIds = data.map((branch) => branch.id);

    const [{ data: cnRanges, error: cnRangesError }, { data: reservedRanges, error: reservedRangesError }] = await Promise.all([
        supabase
            .from('branch_cn_ranges')
            .select('*')
            .in('branch_id', branchIds)
            .order('created_at', { ascending: false }),
        supabase
            .from('branch_cn_reserved_ranges')
            .select('*')
            .in('branch_id', branchIds)
            .order('created_at', { ascending: false }),
    ]);

    if (cnRangesError) {
        return NextResponse.json({ error: cnRangesError.message }, { status: 500 });
    }

    if (reservedRangesError) {
        return NextResponse.json({ error: reservedRangesError.message }, { status: 500 });
    }

    const cnRangesByBranch = new Map<string, typeof cnRanges>();
    const reservedRangesByBranch = new Map<string, typeof reservedRanges>();

    (cnRanges || []).forEach((range) => {
        const entries = cnRangesByBranch.get(range.branch_id) || [];
        entries.push(range);
        cnRangesByBranch.set(range.branch_id, entries);
    });

    (reservedRanges || []).forEach((range) => {
        const entries = reservedRangesByBranch.get(range.branch_id) || [];
        entries.push(range);
        reservedRangesByBranch.set(range.branch_id, entries);
    });

    const enrichedBranches = data.map((branch) => {
        const branchCnRanges = cnRangesByBranch.get(branch.id) || [];
        const branchReservedRanges = reservedRangesByBranch.get(branch.id) || [];
        const activeCnRange = branchCnRanges.find((range) => range.status === 'active') || null;
        const latestCnRange = branchCnRanges[0] || null;
        const hasManagedRanges = branchCnRanges.length > 0;
        const hasReadyManagedRange = Boolean(
            activeCnRange && Number(activeCnRange.next_cn_no) <= Number(activeCnRange.range_end)
        );

        const cnMode = hasManagedRanges ? 'range' : 'legacy';
        const cnStatus = hasReadyManagedRange
            ? 'ready'
            : hasManagedRanges
                ? 'needs_update'
                : 'legacy';

        return {
            ...branch,
            cn_mode: cnMode,
            cn_status: cnStatus,
            active_cn_range: activeCnRange,
            latest_cn_range: latestCnRange,
            cn_ranges: branchCnRanges,
            cn_reserved_ranges: branchReservedRanges,
        };
    });

    return NextResponse.json(enrichedBranches);
}

export async function POST(request: Request) {
    const supabase = await createClient();

    const body = await request.json();
    const { code, name, type, city, state, phone, next_cn_no, next_challan_no } = body;

    if (!code || !name || !type || !city || !state) {
        return NextResponse.json({ error: 'Missing required fields: code, name, type, city, state' }, { status: 400 });
    }

    const branchCode = code.toUpperCase();

    // Check if branch with same code already exists (even if inactive)
    const { data: existingBranch } = await supabase
        .from('branches')
        .select('*')
        .eq('code', branchCode)
        .maybeSingle();

    if (existingBranch) {
        if (existingBranch.is_active) {
            return NextResponse.json({ error: `Branch with code ${branchCode} already exists and is active.` }, { status: 409 });
        }

        // If it exists but is inactive, reactivate it and update its details
        const { data, error } = await supabase
            .from('branches')
            .update({
                name,
                type,
                city,
                state,
                phone: phone || null,
                is_active: true,
                next_cn_no: parseOptionalInteger(next_cn_no, 800001),
                next_challan_no: parseOptionalInteger(next_challan_no, 300066955),
            })
            .eq('id', existingBranch.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 200 }); // Or 201
    }

    // Normal insert for new branch
    const { data, error } = await supabase
        .from('branches')
        .insert([{ 
            code: branchCode, 
            name, 
            type, 
            city, 
            state, 
            phone: phone || null,
            next_cn_no: parseOptionalInteger(next_cn_no, 800001),
            next_challan_no: parseOptionalInteger(next_challan_no, 300066955),
        }])
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing branch id' }, { status: 400 });
    }

    const body = await request.json();
    const { name, type, city, state, phone, next_cn_no, next_challan_no } = body;

    const { data: existingRange } = await supabase
        .from('branch_cn_ranges')
        .select('id')
        .eq('branch_id', id)
        .limit(1);

    const updateData = {
        name,
        type,
        city,
        state,
        phone: phone || null,
        next_challan_no: parseOptionalInteger(next_challan_no, 300066955),
        ...(existingRange && existingRange.length > 0
            ? {}
            : { next_cn_no: parseOptionalInteger(next_cn_no, 800001) }),
    };

    const { data, error } = await supabase
        .from('branches')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
}

export async function DELETE(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing branch id' }, { status: 400 });
    }

    const { error } = await supabase
        .from('branches')
        .update({ is_active: false })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
}
