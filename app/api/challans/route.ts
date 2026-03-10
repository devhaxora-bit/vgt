import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Validation schema for creating a challan
const createChallanSchema = z.object({
    origin_branch_code: z.string().min(1, 'Origin branch is required'),
    destination_branch_code: z.string().min(1, 'Destination branch is required'),
    owner_type: z.string().default('MARKET'),
    challan_type: z.enum(['MAIN', 'FOC']),
    vehicle_no: z.string().min(1, 'Vehicle number is required'),
    driver_name: z.string().optional(),
    driver_mobile: z.string().optional(),
    total_hire_amount: z.number().min(0).default(0),
    extra_hire_amount: z.number().min(0).default(0),
    advance_amount: z.number().min(0).default(0),
    date_from: z.string().optional(), // ISO date string
    date_to: z.string().optional(),   // ISO date string
});

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Filters
    const search = searchParams.get('search');
    const branch = searchParams.get('branch');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    let query = supabase
        .from('challans')
        .select(`
            *,
            origin_branch:branches!origin_branch_code(name, city),
            destination_branch:branches!destination_branch_code(name, city)
        `)
        .order('created_at', { ascending: false });

    if (search) {
        query = query.or(`challan_no.ilike.%${search}%,vehicle_no.ilike.%${search}%`);
    }

    if (branch) {
        query = query.or(`origin_branch_code.eq.${branch},destination_branch_code.eq.${branch}`);
    }

    if (type) {
        query = query.eq('challan_type', type);
    }

    if (status) {
        query = query.eq('status', status);
    }

    if (dateFrom) {
        query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
        query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: Request) {
    const supabase = await createClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Prepare insert data from body
    const insertData: any = {
        challan_no: body.challan_no,
        origin_branch_code: body.origin_branch_code,
        destination_branch_code: body.destination_branch_code,
        challan_mode: body.challan_type || 'MAIN',
        sub_type: body.sub_type || 'Route',
        owner_type: body.owner_type || 'MARKET',
        vehicle_no: body.vehicle_no,
        driver_name: body.driver_name,
        driver_mobile: body.driver_mobile,
        
        // Lane Details
        loading_at: body.loading_at,
        unloading_at: body.unloading_at,
        loading_branch_code: body.loading_branch_code,
        unloading_branch_code: body.unloading_branch_code,
        loading_pincode: body.loading_pincode,
        unloading_pincode: body.unloading_pincode,
        loading_area: body.loading_area,
        unloading_area: body.unloading_area,
        trip_distance: body.trip_distance || 0,
        expected_trip_complete_at: body.expected_trip_complete_at,

        // Owner/Broker
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

        // Vehicle
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

        // Insurance
        insurance_policy_no: body.insurance_policy_no,
        insurance_validity: body.insurance_validity,
        insurance_company_name: body.insurance_company_name,
        insurance_city: body.insurance_city,
        finance_detail: body.finance_detail,
        ewaybill_no: body.ewaybill_no,
        ewaybill_date: body.ewaybill_date,

        // ITDS
        itds_ref_branch: body.itds_ref_branch,
        itds_declare_date: body.itds_declare_date,
        itds_financial_year: body.itds_financial_year,

        // Driver
        driver_dl_no: body.driver_dl_no,
        driver_dl_validity: body.driver_dl_validity,
        driver_rto: body.driver_rto,
        trip_tracking_consent: body.trip_tracking_consent || false,

        // Financials
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
        bal_payment_branch_code: body.bal_payment_branch_code,
        card_amount: body.card_amount || 0,
        generic_no: body.generic_no,
        card_no: body.card_no,
        credit_date: body.credit_date,
        petro_card_branch_code: body.petro_card_branch_code,

        // Others
        engaged_by: body.engaged_by,
        engaged_date: body.engaged_date,
        remarks: body.remarks,

        created_by: user.id,
        status: 'ACTIVE'
    };

    const { data, error } = await supabase
        .from('challans')
        .insert(insertData)
        .select()
        .single();

    if (error) {
        console.error("Failed to create challan:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Increment sequence in branches table
    if (insertData.origin_branch_code) {
        const { data: branchData } = await supabase
            .from("branches")
            .select("next_challan_no")
            .eq("code", insertData.origin_branch_code.toUpperCase())
            .single();

        if (branchData) {
            await supabase
                .from("branches")
                .update({ next_challan_no: (branchData.next_challan_no || 0) + 1 })
                .eq("code", insertData.origin_branch_code.toUpperCase());
        }
    }

    return NextResponse.json(data, { status: 201 });
}
