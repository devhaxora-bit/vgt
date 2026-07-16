import { NextResponse } from "next/server";
import { requireAuthz } from '@/lib/server/requireAuthz';

export async function GET(request: Request) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const supabase = auth.supabase;
    const { searchParams } = new URL(request.url);
    const rawBranch = searchParams.get("branch")?.trim();

    if (!rawBranch && !auth.isBranchScoped) {
        return NextResponse.json({ error: "Branch code is required" }, { status: 400 });
    }

    const requested = auth.isBranchScoped
        ? auth.branchCode!
        : String(rawBranch || '').toUpperCase();

    const forbidden = auth.forbidIfForeignBranch(requested);
    if (forbidden) return forbidden;

    // Try exact code match first
    let { data, error } = await supabase
        .from("branches")
        .select("code, challan_prefix, next_challan_no")
        .eq("code", requested)
        .maybeSingle();

    // Fall back to case-insensitive match on name or city if no code matched
    // (only for full-access users — scoped users must use exact branch code)
    if (!data && !auth.isBranchScoped && rawBranch) {
        const fallback = await supabase
            .from("branches")
            .select("code, challan_prefix, next_challan_no")
            .or(`name.ilike.${rawBranch},city.ilike.${rawBranch}`)
            .limit(1)
            .maybeSingle();
        data = fallback.data;
        error = fallback.error;

        if (data) {
            const fallbackForbidden = auth.forbidIfForeignBranch(data.code);
            if (fallbackForbidden) return fallbackForbidden;
        }
    }

    if (!data) {
        if (error) console.error("Failed to fetch branch details:", error);
        return NextResponse.json({ error: `Branch not found: ${requested}` }, { status: 404 });
    }

    return NextResponse.json({
        code: data.code,
        prefix: data.challan_prefix || '',
        nextNo: data.next_challan_no || 300066955
    });
}
