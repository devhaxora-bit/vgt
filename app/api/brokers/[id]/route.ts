import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/brokers/[id] — update
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    const { id } = await params;
    const body = await req.json();

    const { data, error } = await supabase
        .from('brokers')
        .update({
            code: body.code?.toUpperCase(),
            name: body.name,
            mobile: body.mobile,
            address: body.address,
            is_active: body.is_active,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
}

// DELETE /api/brokers/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    const { id } = await params;

    const { error } = await supabase
        .from('brokers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
}
