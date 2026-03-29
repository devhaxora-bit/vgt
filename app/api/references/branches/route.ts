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

    const branchCode = code.toUpperCase();

    // Check if branch with same code already exists (even if inactive)
    const { data: existingBranch } = await supabase
        .from('branches')
        .select('*')
        .eq('code', branchCode)
        .maybeSingle();

    if (existingBranch) {
        if (existingBranch.is_active) {
            return NextResponse.json({ error: `Branch with code ${branchCode} already exists and is active.` }, { status: 409 });
        }

        // If it exists but is inactive, reactivate it and update its details
        const { data, error } = await supabase
            .from('branches')
            .update({
                name,
                type,
                city,
                state,
                phone: phone || null,
                is_active: true,
                next_cn_no: next_cn_no ? parseInt(next_cn_no) : 800001,
                next_challan_no: next_challan_no ? parseInt(next_challan_no) : 300066955
            })
            .eq('id', existingBranch.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 200 }); // Or 201
    }

    // Normal insert for new branch
    const { data, error } = await supabase
        .from('branches')
        .insert([{ 
            code: branchCode, 
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

export async function PUT(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing branch id' }, { status: 400 });
    }

    const body = await request.json();
    const { name, type, city, state, phone, next_cn_no, next_challan_no } = body;

    const updateData = {
        name,
        type,
        city,
        state,
        phone: phone || null,
        next_cn_no: next_cn_no ? parseInt(next_cn_no) : 800001,
        next_challan_no: next_challan_no ? parseInt(next_challan_no) : 300066955
    };

    const { data, error } = await supabase
        .from('branches')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
}

export async function DELETE(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing branch id' }, { status: 400 });
    }

    const { error } = await supabase
        .from('branches')
        .update({ is_active: false })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
}
