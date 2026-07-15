import { NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';

const CN_SELECT_FIELDS =
    'id, cn_no, bkg_date, booking_branch, loading_point, dest_branch, delivery_point, consignor_name, consignee_name, invoice_no, vehicle_no, no_of_pkg, total_qty, goods_class, goods_desc, actual_weight, charged_weight, load_unit, total_freight, balance_amount';

const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

// GET /api/query/truck?no=VEHICLE -> vehicle master + linked consignments + challans
export async function GET(request: Request) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const supabase = auth.supabase;
    const { searchParams } = new URL(request.url);
    const no = searchParams.get('no')?.trim();
    if (!no) return NextResponse.json({ error: 'Provide ?no=' }, { status: 400 });

    const vehicleNo = no.toUpperCase();
    const listBranch = auth.resolveListBranch(searchParams.get('branch'));

    let vehicleQuery = supabase
        .from('vehicles')
        .select('*')
        .ilike('vehicle_no', vehicleNo)
        .eq('is_active', true);

    if (listBranch) {
        vehicleQuery = vehicleQuery.eq('branch_code', listBranch);
    }

    const { data: vehicle } = await vehicleQuery.maybeSingle();

    let cnQuery = supabase
        .from('consignments')
        .select(CN_SELECT_FIELDS)
        .ilike('vehicle_no', vehicleNo)
        .order('bkg_date', { ascending: false })
        .limit(200);

    if (listBranch) {
        cnQuery = cnQuery.eq('booking_branch', listBranch);
    }

    let challanQuery = supabase
        .from('challans')
        .select(`
            id, challan_no, challan_type, engagement_type, status, date_from, date_to,
            loading_point, destination_point, vehicle_no, driver_name, driver_mobile,
            broker_name, owner_name, total_hire_amount, advance_amount, balance_amount,
            linked_cn_nos, created_at, origin_branch_code,
            origin_branch:branches!origin_branch_code(name, city),
            destination_branch:branches!destination_branch_code(name, city)
        `)
        .ilike('vehicle_no', vehicleNo)
        .order('date_from', { ascending: false })
        .limit(200);

    if (listBranch) {
        challanQuery = challanQuery.eq('origin_branch_code', listBranch);
    }

    const [{ data: consignments }, { data: challans }] = await Promise.all([cnQuery, challanQuery]);

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
