import { NextResponse } from 'next/server';
import { branchAccessLabel } from '@/lib/branchAccess';
import { formatBranchLabel } from '@/lib/formatBranchLabel';
import { requireAuthz, resolveHeadBranchCode } from '@/lib/server/requireAuthz';

const toMoney = (value: number | string | null | undefined) => Number(value || 0) || 0;

const monthStartIso = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
};

type BranchRow = {
    code: string;
    name: string;
    city: string | null;
    state: string | null;
    is_head_branch: boolean;
};

export async function GET() {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const { supabase, user, hasFullAccess, isBranchScoped, branchCode } = auth;
    const listBranch = auth.resolveListBranch(null);

    const [
        branchRowResult,
        headBranchCode,
        consignmentsResult,
        partiesResult,
        challansResult,
        ledgerResult,
        recentResult,
    ] = await Promise.all([
        (async () => {
            const code = isBranchScoped
                ? branchCode
                : String(user.branch_access || '').toLowerCase() === 'main'
                    ? branchCode
                    : null;

            if (!code) return { data: null as BranchRow | null, error: null };

            return supabase
                .from('branches')
                .select('code, name, city, state, is_head_branch')
                .ilike('code', code)
                .maybeSingle();
        })(),
        hasFullAccess && !isBranchScoped ? resolveHeadBranchCode(supabase) : Promise.resolve(null),
        (() => {
            let query = supabase
                .from('consignments')
                .select('*', { count: 'exact', head: true })
                .eq('cancel_cn', false)
                .gte('bkg_date', monthStartIso());
            if (listBranch) query = query.eq('booking_branch', listBranch);
            return query;
        })(),
        (() => {
            let query = supabase
                .from('parties')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);
            if (listBranch) query = query.eq('branch_code', listBranch);
            return query;
        })(),
        (() => {
            let query = supabase
                .from('challans')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'ACTIVE');
            if (listBranch) query = query.eq('origin_branch_code', listBranch);
            return query;
        })(),
        (() => {
            let query = supabase
                .from('vw_party_ledger_summary')
                .select('outstanding, unbilled_amount, total_cns_count, total_billed, total_paid');
            if (listBranch) query = query.eq('branch_code', listBranch);
            return query;
        })(),
        (() => {
            let query = supabase
                .from('consignments')
                .select('cn_no, booking_branch, bkg_date, total_freight, consignor_name, destination')
                .eq('cancel_cn', false)
                .order('bkg_date', { ascending: false })
                .limit(5);
            if (listBranch) query = query.eq('booking_branch', listBranch);
            return query;
        })(),
    ]);

    const queryError =
        consignmentsResult.error
        || partiesResult.error
        || challansResult.error
        || ledgerResult.error
        || recentResult.error
        || branchRowResult.error;

    if (queryError) {
        console.error('Dashboard stats error:', queryError);
        return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    const ledgerRows = ledgerResult.data || [];
    const ledgerTotals = ledgerRows.reduce(
        (acc, row) => ({
            outstanding: acc.outstanding + toMoney(row.outstanding),
            unbilled_amount: acc.unbilled_amount + Math.max(toMoney(row.unbilled_amount), 0),
            total_cns_count: acc.total_cns_count + toMoney(row.total_cns_count),
            total_billed: acc.total_billed + toMoney(row.total_billed),
            total_paid: acc.total_paid + toMoney(row.total_paid),
        }),
        {
            outstanding: 0,
            unbilled_amount: 0,
            total_cns_count: 0,
            total_billed: 0,
            total_paid: 0,
        },
    );

    const branchRow = branchRowResult.data as BranchRow | null;
    const access = String(user.branch_access || 'global').toLowerCase();

    let locationLabel = 'All Branches';
    let locationDetail: string | null = null;

    if (isBranchScoped && branchRow) {
        locationLabel = formatBranchLabel(branchRow.code, branchRow.name);
        locationDetail = [branchRow.city, branchRow.state].filter(Boolean).join(', ') || null;
    } else if (access === 'main' && branchRow) {
        locationLabel = `${formatBranchLabel(branchRow.code, branchRow.name)} · Main`;
        locationDetail = [branchRow.city, branchRow.state].filter(Boolean).join(', ') || null;
    } else if (hasFullAccess) {
        locationLabel = 'All Branches';
        if (headBranchCode) {
            const { data: headBranch } = await supabase
                .from('branches')
                .select('code, name, city, state')
                .ilike('code', headBranchCode)
                .maybeSingle();
            if (headBranch) {
                locationDetail = `Head office: ${formatBranchLabel(headBranch.code, headBranch.name)}${
                    headBranch.city ? ` · ${headBranch.city}` : ''
                }`;
            }
        }
    } else if (branchRow) {
        locationLabel = formatBranchLabel(branchRow.code, branchRow.name);
        locationDetail = [branchRow.city, branchRow.state].filter(Boolean).join(', ') || null;
    }

    return NextResponse.json({
        user: {
            full_name: user.full_name,
            employee_code: user.employee_code,
            role: user.role,
            branch_access: access,
            branch_access_label: branchAccessLabel(access),
        },
        branch: {
            code: listBranch,
            scope: isBranchScoped ? 'branch' : hasFullAccess ? 'full' : 'branch',
            label: locationLabel,
            detail: locationDetail,
            is_filtered: Boolean(listBranch),
        },
        stats: {
            consignments_this_month: consignmentsResult.count ?? 0,
            active_parties: partiesResult.count ?? 0,
            active_challans: challansResult.count ?? 0,
            outstanding_amount: Number(ledgerTotals.outstanding.toFixed(2)),
            unbilled_amount: Number(ledgerTotals.unbilled_amount.toFixed(2)),
            total_cns: Math.round(ledgerTotals.total_cns_count),
            total_billed: Number(ledgerTotals.total_billed.toFixed(2)),
            total_paid: Number(ledgerTotals.total_paid.toFixed(2)),
        },
        recent_consignments: (recentResult.data || []).map((row) => ({
            cn_no: row.cn_no,
            booking_branch: row.booking_branch,
            bkg_date: row.bkg_date,
            total_freight: toMoney(row.total_freight),
            consignor_name: row.consignor_name,
            destination: row.destination,
        })),
    });
}
