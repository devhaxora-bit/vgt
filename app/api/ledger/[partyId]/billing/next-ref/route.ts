import { NextRequest, NextResponse } from 'next/server';
import { requireAuthz, requirePartyBranchAccess } from '@/lib/server/requireAuthz';
import { getBillRefPrefix } from '@/lib/billRef';

const PAGE_SIZE = 1000;

const suffixNumber = (billRefNo: string, prefix: string): number => {
    if (!billRefNo.toUpperCase().startsWith(prefix.toUpperCase())) return 0;
    const suffix = billRefNo.slice(prefix.length).trim();
    const num = parseInt(suffix, 10);
    return Number.isNaN(num) ? 0 : num;
};

// GET /api/ledger/[partyId]/billing/next-ref?date=YYYY-MM-DD
// Returns the next suggested bill reference suffix for the given date's financial year
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ partyId: string }> }
) {
    const auth = await requireAuthz({ adminOnly: true });
    if (!auth.ok) return auth.response;

    const { partyId } = await params;
    const partyAccess = await requirePartyBranchAccess(auth, partyId);
    if (!partyAccess.ok) return partyAccess.response;

    const supabase = auth.supabase;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const prefix = getBillRefPrefix(date);
    const branchCode = partyAccess.entity.branch_code;

    let maxNum = 0;
    let from = 0;

    while (true) {
        let query = supabase
            .from('party_billing_records')
            .select('bill_ref_no')
            .like('bill_ref_no', `${prefix}%`)
            .range(from, from + PAGE_SIZE - 1);

        if (branchCode) {
            query = query.eq('branch_code', branchCode);
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = data ?? [];
        for (const row of rows) {
            const num = suffixNumber(String(row.bill_ref_no || ''), prefix);
            if (num > maxNum) maxNum = num;
        }

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    const nextNumber = maxNum + 1;

    return NextResponse.json({
        prefix,
        next_suffix: String(nextNumber),
        next_ref_no: `${prefix}${nextNumber}`,
    });
}
