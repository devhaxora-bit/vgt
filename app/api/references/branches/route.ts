import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let query = supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (type) {
        query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: Request) {
    const supabase = await createClient();

    const body = await request.json();
    const { code, name, type, city, state, phone, next_cn_no, next_challan_no } = body;

    if (!code || !name || !type || !city || !state) {
        return NextResponse.json({ error: 'Missing required fields: code, name, type, city, state' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('branches')
        .insert([{ 
            code: code.toUpperCase(), 
            name, 
            type, 
            city, 
            state, 
            phone: phone || null,
            next_cn_no: next_cn_no ? parseInt(next_cn_no) : 800001,
            next_challan_no: next_challan_no ? parseInt(next_challan_no) : 300066955
        }])
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
