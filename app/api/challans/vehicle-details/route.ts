import { NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';

export async function GET(request: Request) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const vehicleNo = searchParams.get('vehicleNo')?.trim().toUpperCase();

    if (!vehicleNo) {
        return NextResponse.json({ error: 'Vehicle number is required' }, { status: 400 });
    }

    const listBranch = auth.resolveListBranch(searchParams.get('branch'));

    let query = auth.supabase
        .from('challans')
        .select(`
            vehicle_no,
            owner_pan,
            owner_name,
            owner_mobile,
            owner_address,
            owner_tel,
            itds_ref_branch,
            itds_declare_date,
            itds_financial_year,
            tds_percent,
            origin_branch_code
        `)
        .eq('vehicle_no', vehicleNo)
        .order('created_at', { ascending: false })
        .limit(1);

    if (listBranch) {
        query = query.eq('origin_branch_code', listBranch);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data) {
        const forbidden = auth.forbidIfForeignBranch(data.origin_branch_code);
        if (forbidden) return forbidden;
    }

    return NextResponse.json(data || null);
}
