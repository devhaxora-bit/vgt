import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/vehicles?q=partial — search, or ?no=exact — fetch one
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const q = req.nextUrl.searchParams.get('q') || '';
    const no = req.nextUrl.searchParams.get('no') || '';

    if (no) {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .ilike('vehicle_no', no.toUpperCase())
            .eq('is_active', true)
            .single();
        if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(data);
    }

    let query = supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_no');
    if (q.trim()) query = query.ilike('vehicle_no', `%${q.trim().toUpperCase()}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// POST /api/vehicles — create
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const body = await req.json();

    const { data, error } = await supabase
        .from('vehicles')
        .insert({ ...body, vehicle_no: body.vehicle_no?.toUpperCase() })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
}
