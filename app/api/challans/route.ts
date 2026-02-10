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
    try {
        const supabase = await createClient();

        // Check auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const json = await request.json();
        const body = createChallanSchema.parse(json);

        // Generate Challan Number if not provided logic 
        // For now, let's use a simple timestamp-based one or random if db doesn't handle it
        // But better to generate one: KC + 10 digits
        const challanNo = `KC${Date.now().toString().slice(-10)}`;

        const { data, error } = await supabase
            .from('challans')
            .insert({
                ...body,
                challan_no: challanNo,
                created_by: user.id,
                status: 'ACTIVE'
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: (error as any).errors }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
