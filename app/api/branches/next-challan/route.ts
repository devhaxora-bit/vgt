import { createClient } from '@/utils/supabase/server';
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const branchCode = searchParams.get("branch")?.toUpperCase();

    if (!branchCode) {
        return NextResponse.json({ error: "Branch code is required" }, { status: 400 });
    }

    // Fetch next_challan_no and challan_prefix for the branch
    const { data, error } = await supabase
        .from("branches")
        .select("challan_prefix, next_challan_no")
        .eq("code", branchCode)
        .single();

    if (error) {
        console.error("Failed to fetch branch details:", error);
        return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    return NextResponse.json({
        prefix: data.challan_prefix || 'KC',
        nextNo: data.next_challan_no || 300066955
    });
}
