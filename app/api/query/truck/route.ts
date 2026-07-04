import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const CN_SELECT_FIELDS =
    'id, cn_no, bkg_date, booking_branch, loading_point, dest_branch, delivery_point, consignor_name, consignee_name, invoice_no, vehicle_no, no_of_pkg, total_qty, goods_class, goods_desc, actual_weight, charged_weight, load_unit, total_freight, balance_amount';

const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

// GET /api/query/truck?no=VEHICLE -> vehicle master + linked consignments + challans
export async function GET(request: Request) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const no = searchParams.get('no')?.trim();
    if (!no) return NextResponse.json({ error: 'Provide ?no=' }, { status: 400 });

    const vehicleNo = no.toUpperCase();

    const { data: vehicle } = await supabase
        .from('vehicles')
        .select('*')
        .ilike('vehicle_no', vehicleNo)
        .eq('is_active', true)
        .maybeSingle();

    const { data: consignments } = await supabase
        .from('consignments')
        .select(CN_SELECT_FIELDS)
        .ilike('vehicle_no', vehicleNo)
        .order('bkg_date', { ascending: false })
        .limit(200);

    const { data: challans } = await supabase
        .from('challans')
        .select(`
            id, challan_no, challan_type, engagement_type, status, date_from, date_to,
            loading_point, destination_point, vehicle_no, driver_name, driver_mobile,
            broker_name, owner_name, total_hire_amount, advance_amount, balance_amount,
            linked_cn_nos, created_at,
            origin_branch:branches!origin_branch_code(name, city),
            destination_branch:branches!destination_branch_code(name, city)
        `)
        .ilike('vehicle_no', vehicleNo)
        .order('date_from', { ascending: false })
        .limit(200);

    const cnRows = consignments ?? [];
    const challanRows = challans ?? [];

    const totals = {
        cn_count: cnRows.length,
        challan_count: challanRows.length,
        total_freight: cnRows.reduce((sum, c) => sum + toNumber(c.total_freight), 0),
        total_hire: challanRows.reduce((sum, c) => sum + toNumber(c.total_hire_amount), 0),
    };

    return NextResponse.json({
        vehicle_no: vehicleNo,
        vehicle: vehicle ?? null,
        consignments: cnRows,
        challans: challanRows,
        totals,
    });
}
