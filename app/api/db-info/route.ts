import { NextResponse } from 'next/server';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set';
    const isLocal = supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost');

    return NextResponse.json({
        environment: isLocal ? 'LOCAL' : 'PRODUCTION',
        supabaseUrl: supabaseUrl,
        message: isLocal
            ? '✅ Using LOCAL Supabase - Safe to develop!'
            : '⚠️ Using PRODUCTION Supabase'
    });
}
