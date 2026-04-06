import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/ledger/summary
// Returns vw_party_ledger_summary with optional filters
export async function GET(request: Request) {
    const supabase = await createClient();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const branch = searchParams.get('branch');
    const hasOutstanding = searchParams.get('has_outstanding');

    let query = supabase
        .from('vw_party_ledger_summary')
        .select('*')
        .order('party_name');

    if (search) {
        query = query.or(`party_name.ilike.%${search}%,party_code.ilike.%${search}%`);
    }
    if (branch) {
        query = query.eq('branch_code', branch);
    }
    if (hasOutstanding === 'true') {
        query = query.gt('outstanding', 0);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Failed to fetch ledger summary:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
}
