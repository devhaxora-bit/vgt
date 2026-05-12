import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/brokers — list all or search by ?q=name
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const q = req.nextUrl.searchParams.get('q') || '';

    let query = supabase
        .from('brokers')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (q.trim()) {
        query = query.ilike('name', `%${q.trim()}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// POST /api/brokers — create a broker
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const body = await req.json();

    const code = String(body.code || '').trim().toUpperCase();
    const name = String(body.name || '').trim();

    if (!code) return NextResponse.json({ error: 'Broker code is required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Broker name is required' }, { status: 400 });

    const { data, error } = await supabase
        .from('brokers')
        .insert({
            code,
            name,
            mobile: body.mobile || null,
            address: body.address || null,
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: `Broker with code ${code} already exists.` }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data, { status: 201 });
}
