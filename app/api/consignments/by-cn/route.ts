import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { compareCnNo } from '@/lib/sortLinkedConsignments';
import { requireAuthz } from '@/lib/server/requireAuthz';

const CN_SEARCH_FIELDS = 'id, cn_no, bkg_date, consignor_name, packages, no_of_pkg, total_qty, goods_class, goods_desc, actual_weight, charged_weight, load_unit, dest_branch, delivery_point, loading_point, booking_branch, basic_freight, freight_rate, unload_charges, retention_charges, extra_km_charges, mhc_charges, door_coll_charges, door_del_charges, traffic_challan_charges, other_charges, total_freight, advance_amount, balance_amount, freight_pending';

const CN_SELECT_FIELDS = `${CN_SEARCH_FIELDS}, parent_cn_id, freight_included`;

const MISSING_COLUMN_CODE = '42703';

type ConsignmentSearchRow = Record<string, unknown>;

const getConsignmentsClient = (supabase: SupabaseClient) =>
    supabase as SupabaseClient<Record<string, unknown>>;

async function runCnSearch(
    supabase: SupabaseClient,
    search: string,
    options: {
        excludeChildren: boolean;
        excludeId: string | null;
        useParentFields: boolean;
        bookingBranch?: string | null;
    }
): Promise<{ data: ConsignmentSearchRow[] | null; error: { code?: string; message: string } | null }> {
    const fields = options.useParentFields ? CN_SELECT_FIELDS : CN_SEARCH_FIELDS;
    const client = getConsignmentsClient(supabase);

    let query = client
        .from('consignments')
        .select(fields)
        .ilike('cn_no', `%${search}%`)
        .order('cn_no', { ascending: false })
        .limit(20);

    if (options.bookingBranch) {
        query = query.eq('booking_branch', options.bookingBranch);
    }

    if (options.useParentFields && options.excludeChildren) {
        query = query.is('parent_cn_id', null);
    }

    if (options.excludeId) {
        query = query.neq('id', options.excludeId);
    }

    const { data, error } = await query;
    return { data: data as ConsignmentSearchRow[] | null, error };
}

export async function GET(request: Request) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const supabase = auth.supabase;
    const { searchParams } = new URL(request.url);
    const cnNo = searchParams.get('cn')?.trim();
    const search = searchParams.get('search')?.trim();
    const listBranch = auth.resolveListBranch(searchParams.get('branch'));

    // --- Autocomplete search mode (partial match) ---
    if (search !== undefined && search !== null) {
        if (search.length < 1) return NextResponse.json([]);

        const excludeChildren = searchParams.get('exclude_children') === 'true';
        const excludeId = searchParams.get('exclude_id');

        let { data, error } = await runCnSearch(supabase, search, {
            excludeChildren,
            excludeId,
            useParentFields: true,
            bookingBranch: listBranch,
        });

        // Fallback when parent_cn_id / freight_included columns are not migrated yet
        if (error?.code === MISSING_COLUMN_CODE) {
            ({ data, error } = await runCnSearch(supabase, search, {
                excludeChildren: false,
                excludeId,
                useParentFields: false,
                bookingBranch: listBranch,
            }));
        }

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
        const client = getConsignmentsClient(supabase);
        let { data, error } = await client
            .from('consignments')
            .select(CN_SELECT_FIELDS)
            .in('cn_no', cnArray);
        if (error?.code === MISSING_COLUMN_CODE) {
            ({ data, error } = await client
                .from('consignments')
                .select(CN_SEARCH_FIELDS)
                .in('cn_no', cnArray));
        }
        if (error) return NextResponse.json([], { status: 200 });
        let rows = (data ?? []) as Array<{ cn_no?: string; booking_branch?: string }>;
        if (listBranch) {
            rows = rows.filter(
                (row) => String(row.booking_branch || '').trim().toUpperCase() === listBranch,
            );
        }
        rows.sort((a, b) => compareCnNo(String(a.cn_no || ''), String(b.cn_no || '')));
        return NextResponse.json(rows);
    }

    // --- Exact lookup mode ---
    if (!cnNo) {
        return NextResponse.json({ error: 'CN number is required' }, { status: 400 });
    }

    const client = getConsignmentsClient(supabase);
    let { data, error } = await client
        .from('consignments')
        .select(CN_SELECT_FIELDS)
        .ilike('cn_no', cnNo)
        .single();

    if (error?.code === MISSING_COLUMN_CODE) {
        ({ data, error } = await client
            .from('consignments')
            .select(CN_SEARCH_FIELDS)
            .ilike('cn_no', cnNo)
            .single());
    }

    if (error) {
        return NextResponse.json({ error: 'CN number not found' }, { status: 404 });
    }

    const bookingBranch = (data as { booking_branch?: string } | null)?.booking_branch;
    const forbidden = auth.forbidIfForeignBranch(bookingBranch);
    if (forbidden) return forbidden;

    return NextResponse.json(data);
}
