import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const vehicleNo = searchParams.get('vehicleNo')?.trim().toUpperCase();

    if (!vehicleNo) {
        return NextResponse.json({ error: 'Vehicle number is required' }, { status: 400 });
    }

    const { data, error } = await supabase
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
            tds_percent
        `)
        .eq('vehicle_no', vehicleNo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || null);
}
