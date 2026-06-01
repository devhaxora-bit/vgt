import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const CN_SELECT_FIELDS = 'id, cn_no, packages, no_of_pkg, total_qty, goods_class, goods_desc, actual_weight, charged_weight, load_unit, dest_branch, delivery_point, loading_point, booking_branch, basic_freight, freight_rate, unload_charges, retention_charges, extra_km_charges, mhc_charges, door_coll_charges, door_del_charges, traffic_challan_charges, other_charges, total_freight, advance_amount, balance_amount, parent_cn_id, freight_included, freight_pending';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const cnNo = searchParams.get('cn')?.trim();
    const search = searchParams.get('search')?.trim();

    // --- Autocomplete search mode (partial match) ---
    if (search !== undefined && search !== null) {
        if (search.length < 1) return NextResponse.json([]);

        // Require auth — RLS would otherwise silently return empty
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let query = supabase
            .from('consignments')
            .select(CN_SELECT_FIELDS)
            .ilike('cn_no', `%${search}%`)
            .order('cn_no', { ascending: false })
            .limit(20);

        // Exclude CNs that are already children (have a parent)
        if (searchParams.get('exclude_children') === 'true') {
            query = query.is('parent_cn_id', null);
        }

        // Exclude a specific CN (e.g., the one being edited)
        const excludeId = searchParams.get('exclude_id');
        if (excludeId) {
            query = query.neq('id', excludeId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[by-cn search error]', error);
            return NextResponse.json([]);
        }
        return NextResponse.json(data ?? []);
    }

    const cns = searchParams.get('cns')?.trim();

    // --- Batch lookup mode ---
    if (cns) {
        const cnArray = cns.split(',').map(c => c.trim()).filter(Boolean);
        if (cnArray.length === 0) return NextResponse.json([]);
        const { data, error } = await supabase
            .from('consignments')
            .select(CN_SELECT_FIELDS)
            .in('cn_no', cnArray);
        if (error) return NextResponse.json([], { status: 200 });
        return NextResponse.json(data ?? []);
    }

    // --- Exact lookup mode ---
    if (!cnNo) {
        return NextResponse.json({ error: 'CN number is required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('consignments')
        .select(CN_SELECT_FIELDS)
        .ilike('cn_no', cnNo)
        .single();

    if (error) {
        return NextResponse.json({ error: 'CN number not found' }, { status: 404 });
    }

    return NextResponse.json(data);
}
