import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { id } = await params;

    const { data, error } = await supabase
        .from('challans')
        .select(`
            *,
            origin_branch:branches!origin_branch_code(name, city),
            destination_branch:branches!destination_branch_code(name, city)
        `)
        .eq('id', id)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(data);
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
        challan_no: body.challan_no,
        challan_type: body.challan_type || 'MAIN',
        date_from: body.date_from,
        origin_branch_code: body.origin_branch_code,
        destination_branch_code: body.destination_branch_code || null,
        engagement_type: body.engagement_type || 'broker',
        vehicle_no: body.vehicle_no,
        driver_name: body.driver_name,
        driver_mobile: body.driver_mobile,
        loading_point: body.loading_point,
        destination_point: body.destination_point,
        owner_pan: body.owner_pan,
        owner_name: body.owner_name,
        owner_mobile: body.owner_mobile,
        owner_address: body.owner_address,
        owner_tel: body.owner_tel,
        broker_name: body.broker_name,
        broker_code: body.broker_code,
        broker_mobile: body.broker_mobile,
        broker_address: body.broker_address,
        slip_no: body.slip_no,
        slip_date: body.slip_date,
        vehicle_type: body.vehicle_type,
        permit_no: body.permit_no,
        permit_validity: body.permit_validity,
        vehicle_make: body.vehicle_make,
        engine_no: body.engine_no,
        chasis_no: body.chasis_no,
        tax_token_no: body.tax_token_no,
        tax_token_validity: body.tax_token_validity,
        tax_token_issued_by: body.tax_token_issued_by,
        vehicle_model: body.vehicle_model,
        insurance_policy_no: body.insurance_policy_no,
        insurance_validity: body.insurance_validity,
        insurance_company_name: body.insurance_company_name,
        insurance_city: body.insurance_city,
        finance_detail: body.finance_detail,
        itds_ref_branch: body.itds_ref_branch,
        itds_declare_date: body.itds_declare_date,
        itds_financial_year: body.itds_financial_year,
        driver_dl_no: body.driver_dl_no,
        driver_dl_validity: body.driver_dl_validity,
        driver_address: body.driver_address,
        trip_tracking_consent: body.trip_tracking_consent || false,
        total_hire_amount: body.total_hire_amount || 0,
        extra_hire_amount: body.extra_hire_amount || 0,
        advance_amount: body.advance_amount || 0,
        hire_rate_per_kg: body.hire_rate_per_kg || 0,
        hire_amount: body.hire_amount || 0,
        extra_over_weight: body.extra_over_weight || 0,
        extra_over_length: body.extra_over_length || 0,
        extra_over_height: body.extra_over_height || 0,
        extra_over_width: body.extra_over_width || 0,
        extra_km_charges: body.extra_km_charges || 0,
        detent_charges: body.detent_charges || 0,
        transit_pass_charges: body.transit_pass_charges || 0,
        total_extra_charges: body.total_extra_charges || 0,
        tds_percent: body.tds_percent || 0,
        less_tds: body.less_tds || 0,
        remarks: body.remarks,
        linked_cn_nos: Array.isArray(body.linked_cn_nos) ? body.linked_cn_nos : [],
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('challans')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Failed to update challan:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
