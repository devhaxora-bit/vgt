import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuthz } from '@/lib/server/requireAuthz';
import type { BookingRegisterRow } from '@/lib/types/bookingRegister.types';

const querySchema = z.object({
    branch: z.string().trim().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    today: z.enum(['true', 'false']).optional(),
    bkg_basis: z.string().trim().optional(),
    party_q: z.string().trim().optional(),
    cn_no: z.string().trim().optional(),
    dest_branch: z.string().trim().optional(),
    bill_status: z.enum(['all', 'billed', 'unbilled']).optional().default('all'),
    include_cancelled: z.enum(['true', 'false']).optional().default('false'),
    limit: z.coerce.number().int().min(1).max(5000).optional().default(2000),
});

const todayIso = () => new Date().toISOString().slice(0, 10);

// GET /api/reports/booking-register
export async function GET(request: NextRequest) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid query' }, { status: 400 });
    }

    const {
        branch,
        date_from,
        date_to,
        today,
        bkg_basis,
        party_q,
        cn_no,
        dest_branch,
        bill_status,
        include_cancelled,
        limit,
    } = parsed.data;

    const listBranch = auth.resolveListBranch(branch === 'all' ? null : branch || null);
    const dateFrom = today === 'true' ? todayIso() : date_from;
    const dateTo = today === 'true' ? todayIso() : date_to;
    const basis = bkg_basis && bkg_basis !== 'all' ? bkg_basis.trim().toUpperCase() : null;
    const partyQ = party_q?.trim() || '';
    const cnFilter = cn_no?.trim() || '';
    const dest = dest_branch && dest_branch !== 'all' ? dest_branch.trim().toUpperCase() : null;

    let query = auth.supabase
        .from('consignments')
        .select(
            'id, cn_no, bkg_date, booking_branch, dest_branch, delivery_point, delivery_type, bkg_basis, consignor_name, consignee_name, billing_party, billing_party_code, billing_party_id, no_of_pkg, total_qty, actual_weight, charged_weight, load_unit, total_freight, vehicle_no, cancel_cn',
        )
        .is('deleted_at', null)
        .order('bkg_date', { ascending: false })
        .order('cn_no', { ascending: false })
        .limit(limit);

    if (listBranch) query = query.eq('booking_branch', listBranch);
    if (dateFrom) query = query.gte('bkg_date', dateFrom);
    if (dateTo) query = query.lte('bkg_date', dateTo);
    if (basis) query = query.eq('bkg_basis', basis);
    if (dest) query = query.or(`dest_branch.eq.${dest},delivery_point.ilike.%${dest}%`);
    if (cnFilter) query = query.ilike('cn_no', `%${cnFilter}%`);
    if (include_cancelled !== 'true') query = query.eq('cancel_cn', false);
    if (partyQ) {
        query = query.or(
            `billing_party.ilike.%${partyQ}%,billing_party_code.ilike.%${partyQ}%,consignor_name.ilike.%${partyQ}%`,
        );
    }

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data || [];
    const cnNos = [...new Set(rows.map((row) => String(row.cn_no || '').trim()).filter(Boolean))];

    const billedByCn = new Map<string, { billRef: string; billId: string }>();
    if (cnNos.length > 0) {
        // Chunk IN queries — PostgREST URL length limits.
        const chunkSize = 200;
        for (let i = 0; i < cnNos.length; i += chunkSize) {
            const chunk = cnNos.slice(i, i + chunkSize);
            const { data: bills, error: billError } = await auth.supabase
                .from('party_billing_records')
                .select('id, bill_ref_no, covered_cn_nos, status')
                .eq('status', 'ACTIVE')
                .overlaps('covered_cn_nos', chunk);

            if (billError) {
                return NextResponse.json({ error: billError.message }, { status: 500 });
            }

            for (const bill of bills || []) {
                const billRef = String(bill.bill_ref_no || bill.id).trim();
                for (const cn of bill.covered_cn_nos || []) {
                    const key = String(cn || '').trim();
                    if (!key || billedByCn.has(key)) continue;
                    if (!cnNos.includes(key)) continue;
                    billedByCn.set(key, { billRef, billId: bill.id });
                }
            }
        }
    }

    const enriched: BookingRegisterRow[] = rows.map((row) => {
        const cn = String(row.cn_no || '').trim();
        const billed = billedByCn.get(cn);
        return {
            id: row.id,
            cn_no: cn,
            bkg_date: row.bkg_date,
            booking_branch: row.booking_branch,
            dest_branch: row.dest_branch,
            delivery_point: row.delivery_point,
            delivery_type: row.delivery_type,
            bkg_basis: row.bkg_basis,
            consignor_name: row.consignor_name,
            consignee_name: row.consignee_name,
            billing_party: row.billing_party,
            billing_party_code: row.billing_party_code,
            billing_party_id: row.billing_party_id,
            no_of_pkg: row.no_of_pkg,
            total_qty: row.total_qty,
            actual_weight: row.actual_weight,
            charged_weight: row.charged_weight,
            load_unit: row.load_unit,
            total_freight: Number(row.total_freight || 0),
            vehicle_no: row.vehicle_no,
            cancel_cn: Boolean(row.cancel_cn),
            bill_status: billed ? 'BILLED' : 'UNBILLED',
            bill_ref_no: billed?.billRef || null,
            bill_id: billed?.billId || null,
        };
    });

    const filtered =
        bill_status === 'all'
            ? enriched
            : enriched.filter((row) =>
                  bill_status === 'billed' ? row.bill_status === 'BILLED' : row.bill_status === 'UNBILLED',
              );

    const summary = {
        count: filtered.length,
        freight_total: Number(
            filtered.reduce((sum, row) => sum + (row.total_freight || 0), 0).toFixed(2),
        ),
        tbb_count: filtered.filter((row) => String(row.bkg_basis || '').toUpperCase() === 'TO BE BILLED').length,
        billed_count: filtered.filter((row) => row.bill_status === 'BILLED').length,
        unbilled_count: filtered.filter((row) => row.bill_status === 'UNBILLED').length,
        cancelled_count: filtered.filter((row) => row.cancel_cn).length,
    };

    return NextResponse.json({
        success: true,
        data: filtered,
        summary,
        filters: {
            branch: listBranch || 'all',
            date_from: dateFrom || null,
            date_to: dateTo || null,
            today: today === 'true',
            bkg_basis: basis || 'all',
            bill_status,
        },
    });
}
