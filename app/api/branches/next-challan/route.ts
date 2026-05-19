import { createClient } from '@/utils/supabase/server';
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const rawBranch = searchParams.get("branch")?.trim();

    if (!rawBranch) {
        return NextResponse.json({ error: "Branch code is required" }, { status: 400 });
    }

    const branchUpper = rawBranch.toUpperCase();

    // Try exact code match first
    let { data, error } = await supabase
        .from("branches")
        .select("code, challan_prefix, next_challan_no")
        .eq("code", branchUpper)
        .maybeSingle();

    // Fall back to case-insensitive match on name or city if no code matched
    if (!data) {
        const fallback = await supabase
            .from("branches")
            .select("code, challan_prefix, next_challan_no")
            .or(`name.ilike.${rawBranch},city.ilike.${rawBranch}`)
            .limit(1)
            .maybeSingle();
        data = fallback.data;
        error = fallback.error;
    }

    if (!data) {
        if (error) console.error("Failed to fetch branch details:", error);
        return NextResponse.json({ error: `Branch not found: ${rawBranch}` }, { status: 404 });
    }

    return NextResponse.json({
        code: data.code,
        prefix: data.challan_prefix || '',
        nextNo: data.next_challan_no || 300066955
    });
}
