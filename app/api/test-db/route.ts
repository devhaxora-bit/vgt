import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createClient();
        
        // 1. Check Challans (should exist)
        const { data: challans, error: challanError } = await supabase
            .from('challans')
            .select('id')
            .limit(1);

        // 2. Check Consignments
        const { data: consignments, error: consignmentError } = await supabase
            .from('consignments')
            .select('id')
            .limit(1);

        const envInfo = {
            url: process.env.NEXT_PUBLIC_SUPABASE_URL,
            // Don't show the full key, just first few chars
            keyShort: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'Not set'
        };

        return NextResponse.json({
            status: 'DIAGNOSTIC_REPORT',
            environment: envInfo,
            challans_table: {
                visible: !challanError,
                error: challanError ? {
                    code: challanError.code,
                    message: challanError.message
                } : null
            },
            consignments_table: {
                visible: !consignmentError,
                error: consignmentError ? {
                    code: consignmentError.code,
                    message: consignmentError.message
                } : null
            },
            suggestion: consignmentError?.message?.includes('schema cache') 
                ? "TABLE EXISTS BUT CACHE STALE. Run in SQL Editor: NOTIFY pgrst, 'reload schema';"
                : (consignmentError ? "TABLE MIGHT NOT EXIST. Check Supabase 'Table Editor' to see if 'consignments' is listed." : "Everything looks good!")
        });
    } catch (e: any) {
        return NextResponse.json({
            status: 'EXCEPTION',
            message: e.message
        }, { status: 500 });
    }
}
