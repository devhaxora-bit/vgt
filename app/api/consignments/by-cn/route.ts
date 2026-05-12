import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const cnNo = searchParams.get('cn')?.trim();
    const search = searchParams.get('search')?.trim();

    // --- Autocomplete search mode ---
    if (search) {
        const { data, error } = await supabase
            .from('consignments')
            .select('id, cn_no, packages, no_of_pkg, total_qty, goods_class, goods_desc, actual_weight, charged_weight, load_unit, dest_branch, delivery_point')
            .ilike('cn_no', `%${search}%`)
            .limit(8);

        if (error) return NextResponse.json([], { status: 200 });
        return NextResponse.json(data ?? []);
    }

    // --- Exact lookup mode ---
    if (!cnNo) {
        return NextResponse.json({ error: 'CN number is required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('consignments')
        .select('id, cn_no, packages, no_of_pkg, total_qty, goods_class, goods_desc, actual_weight, charged_weight, load_unit, dest_branch, delivery_point')
        .ilike('cn_no', cnNo)
        .single();

    if (error) {
        return NextResponse.json({ error: 'CN number not found' }, { status: 404 });
    }

    return NextResponse.json(data);
}
