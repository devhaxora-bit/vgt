/**
 * Purge transactional records through end of FY cutoff (default: 2026-03-31).
 *
 * Deletes (date ≤ cutoff, inclusive):
 *   - party_payment_receipts          (receipt_date)
 *   - broker_challan_payment_receipts  (receipt_date)
 *   - party_billing_records           (billing_date)
 *   - broker_challan_billing_records   (billing_date)
 *   - challans                        (date_from)
 *   - consignments                    (bkg_date)  — hard delete, incl. soft-deleted
 *   - ledger_audit_logs               (for purged entity ids + occurred_at ≤ cutoff EOD)
 *
 * Safety: CNs still covered by a bill dated AFTER the cutoff are KEPT
 * (and those post-cutoff bills are never modified). Example: bill
 * VZM/26-27/1954 dated 2026-06-30 keeps its CNs even if those CNs have
 * bkg_date ≤ cutoff.
 *
 * Does NOT delete master data: parties, brokers, branches, vehicles, users, CN ranges.
 *
 * Usage:
 *   # Dry run (default) — counts + samples + protected-CN report
 *   npx tsx scripts/purge-through-fy-cutoff.ts
 *   npx tsx scripts/purge-through-fy-cutoff.ts --cutoff=2026-03-31
 *
 *   # Actually delete (requires both flags)
 *   npx tsx scripts/purge-through-fy-cutoff.ts --execute --confirm=YES
 *
 * Requires in .env.local:
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DEFAULT_CUTOFF = '2026-03-31';
const PAGE = 1000;

type ArgMap = Record<string, string | boolean>;

function parseArgs(argv: string[]): ArgMap {
    const out: ArgMap = {};
    for (const arg of argv) {
        if (arg === '--execute') {
            out.execute = true;
            continue;
        }
        if (arg.startsWith('--cutoff=')) {
            out.cutoff = arg.slice('--cutoff='.length).trim();
            continue;
        }
        if (arg.startsWith('--confirm=')) {
            out.confirm = arg.slice('--confirm='.length).trim();
            continue;
        }
    }
    return out;
}

function assertCutoff(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`Invalid cutoff "${value}". Use YYYY-MM-DD.`);
    }
    const d = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`Invalid cutoff date: ${value}`);
    }
    return value;
}

function cutoffEndIso(cutoff: string): string {
    return `${cutoff}T23:59:59.999Z`;
}

function requireServiceClient(): SupabaseClient {
    const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL;
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
        throw new Error(
            'Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
        );
    }
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

async function countWhere(
    supabase: SupabaseClient,
    table: string,
    dateColumn: string,
    cutoff: string,
): Promise<number> {
    const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .lte(dateColumn, cutoff);

    if (error) throw new Error(`${table} count failed: ${error.message}`);
    return count ?? 0;
}

async function sampleWhere(
    supabase: SupabaseClient,
    table: string,
    dateColumn: string,
    cutoff: string,
    select: string,
    limit = 5,
): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
        .from(table)
        .select(select)
        .lte(dateColumn, cutoff)
        .order(dateColumn, { ascending: false })
        .limit(limit);

    if (error) throw new Error(`${table} sample failed: ${error.message}`);
    return (data || []) as Record<string, unknown>[];
}

async function fetchAllIds(
    supabase: SupabaseClient,
    table: string,
    dateColumn: string,
    cutoff: string,
): Promise<string[]> {
    const ids: string[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select('id')
            .lte(dateColumn, cutoff)
            .range(from, from + PAGE - 1);

        if (error) throw new Error(`${table} id fetch failed: ${error.message}`);
        const rows = data || [];
        for (const row of rows) ids.push(String(row.id));
        if (rows.length < PAGE) break;
        from += PAGE;
    }
    return ids;
}

async function fetchAllCnNos(
    supabase: SupabaseClient,
    cutoff: string,
): Promise<string[]> {
    const cnNos: string[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('consignments')
            .select('cn_no')
            .lte('bkg_date', cutoff)
            .range(from, from + PAGE - 1);

        if (error) throw new Error(`consignments cn_no fetch failed: ${error.message}`);
        const rows = data || [];
        for (const row of rows) {
            const cn = String(row.cn_no || '').trim();
            if (cn) cnNos.push(cn);
        }
        if (rows.length < PAGE) break;
        from += PAGE;
    }
    return cnNos;
}

async function findPostCutoffBillsCoveringCnNos(
    supabase: SupabaseClient,
    cutoff: string,
    cnNos: string[],
): Promise<{
    bills: Array<{
        id: string;
        bill_ref_no: string | null;
        billing_date: string;
        protected_cn_nos: string[];
    }>;
    protectedCnNos: Set<string>;
}> {
    const protectedCnNos = new Set<string>();
    const bills: Array<{
        id: string;
        bill_ref_no: string | null;
        billing_date: string;
        protected_cn_nos: string[];
    }> = [];

    if (cnNos.length === 0) return { bills, protectedCnNos };

    const cnSet = new Set(cnNos.map((c) => c.trim().toUpperCase()));
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('party_billing_records')
            .select('id, bill_ref_no, billing_date, covered_cn_nos')
            .gt('billing_date', cutoff)
            .range(from, from + PAGE - 1);

        if (error) throw new Error(`post-cutoff bill scan failed: ${error.message}`);
        const rows = data || [];
        for (const row of rows) {
            const covered = Array.isArray(row.covered_cn_nos) ? row.covered_cn_nos : [];
            const overlap = covered
                .map((cn) => String(cn || '').trim())
                .filter((cn) => cn && cnSet.has(cn.toUpperCase()));
            if (overlap.length > 0) {
                for (const cn of overlap) protectedCnNos.add(cn.toUpperCase());
                bills.push({
                    id: String(row.id),
                    bill_ref_no: row.bill_ref_no || null,
                    billing_date: String(row.billing_date),
                    protected_cn_nos: overlap,
                });
            }
        }
        if (rows.length < PAGE) break;
        from += PAGE;
    }

    return { bills, protectedCnNos };
}

async function fetchConsignmentIdsToDelete(
    supabase: SupabaseClient,
    cutoff: string,
    protectedCnNos: Set<string>,
): Promise<{ deleteIds: string[]; retained: Array<{ id: string; cn_no: string; bkg_date: string }> }> {
    const deleteIds: string[] = [];
    const retained: Array<{ id: string; cn_no: string; bkg_date: string }> = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('consignments')
            .select('id, cn_no, bkg_date')
            .lte('bkg_date', cutoff)
            .range(from, from + PAGE - 1);

        if (error) throw new Error(`consignments select failed: ${error.message}`);
        const rows = data || [];
        for (const row of rows) {
            const cn = String(row.cn_no || '').trim().toUpperCase();
            if (cn && protectedCnNos.has(cn)) {
                retained.push({
                    id: String(row.id),
                    cn_no: String(row.cn_no),
                    bkg_date: String(row.bkg_date),
                });
            } else {
                deleteIds.push(String(row.id));
            }
        }
        if (rows.length < PAGE) break;
        from += PAGE;
    }

    return { deleteIds, retained };
}

async function deleteByIds(
    supabase: SupabaseClient,
    table: string,
    ids: string[],
): Promise<number> {
    let deleted = 0;
    for (let i = 0; i < ids.length; i += PAGE) {
        const chunk = ids.slice(i, i + PAGE);
        const { error, count } = await supabase
            .from(table)
            .delete({ count: 'exact' })
            .in('id', chunk);

        if (error) throw new Error(`${table} delete failed: ${error.message}`);
        deleted += count ?? chunk.length;
    }
    return deleted;
}

async function deleteWhereLte(
    supabase: SupabaseClient,
    table: string,
    dateColumn: string,
    cutoff: string,
): Promise<number> {
    const ids = await fetchAllIds(supabase, table, dateColumn, cutoff);
    if (ids.length === 0) return 0;
    return deleteByIds(supabase, table, ids);
}

async function deleteAuditLogs(
    supabase: SupabaseClient,
    entityIds: string[],
    cutoff: string,
): Promise<number> {
    let deleted = 0;

    // By entity id (purged records)
    for (let i = 0; i < entityIds.length; i += PAGE) {
        const chunk = entityIds.slice(i, i + PAGE);
        const { error, count } = await supabase
            .from('ledger_audit_logs')
            .delete({ count: 'exact' })
            .in('entity_id', chunk);
        if (error) throw new Error(`ledger_audit_logs (entity) delete failed: ${error.message}`);
        deleted += count ?? 0;
    }

    // By time window through cutoff end-of-day
    const endIso = cutoffEndIso(cutoff);
    while (true) {
        const { data, error } = await supabase
            .from('ledger_audit_logs')
            .select('id')
            .lte('occurred_at', endIso)
            .limit(PAGE);

        if (error) throw new Error(`ledger_audit_logs (time) select failed: ${error.message}`);
        const rows = data || [];
        if (rows.length === 0) break;

        const ids = rows.map((r) => String(r.id));
        const { error: delErr, count } = await supabase
            .from('ledger_audit_logs')
            .delete({ count: 'exact' })
            .in('id', ids);
        if (delErr) throw new Error(`ledger_audit_logs (time) delete failed: ${delErr.message}`);
        deleted += count ?? ids.length;
        if (rows.length < PAGE) break;
    }

    return deleted;
}

type Target = {
    label: string;
    table: string;
    dateColumn: string;
    sampleSelect: string;
};

const TARGETS: Target[] = [
    {
        label: 'Party payments',
        table: 'party_payment_receipts',
        dateColumn: 'receipt_date',
        sampleSelect: 'id, receipt_date, amount, reference_no, status, party_id',
    },
    {
        label: 'Broker challan payments',
        table: 'broker_challan_payment_receipts',
        dateColumn: 'receipt_date',
        sampleSelect: 'id, receipt_date, amount, reference_no, status, broker_id',
    },
    {
        label: 'Party bills',
        table: 'party_billing_records',
        dateColumn: 'billing_date',
        sampleSelect: 'id, billing_date, bill_ref_no, amount, status, party_id',
    },
    {
        label: 'Broker challan bills',
        table: 'broker_challan_billing_records',
        dateColumn: 'billing_date',
        sampleSelect: 'id, billing_date, bill_ref_no, amount, status, broker_id',
    },
    {
        label: 'Challans',
        table: 'challans',
        dateColumn: 'date_from',
        sampleSelect: 'id, challan_no, date_from, vehicle_no, status',
    },
    {
        label: 'Consignments (CNs)',
        table: 'consignments',
        dateColumn: 'bkg_date',
        sampleSelect: 'id, cn_no, bkg_date, cancel_cn, deleted_at, billing_party_code',
    },
];

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const cutoff = assertCutoff(String(args.cutoff || DEFAULT_CUTOFF));
    const execute = Boolean(args.execute);
    const confirm = String(args.confirm || '');

    console.log('════════════════════════════════════════════════════════════');
    console.log(' VGT FY cutoff purge');
    console.log('════════════════════════════════════════════════════════════');
    console.log(` Cutoff (inclusive): ${cutoff}`);
    console.log(` Mode:               ${execute ? 'EXECUTE (destructive)' : 'DRY RUN (no deletes)'}`);
    console.log(' Rule:               post-cutoff bills + their covered CNs are KEPT');
    console.log(' Master data kept:   parties, brokers, branches, vehicles, users, CN ranges');
    console.log('════════════════════════════════════════════════════════════\n');

    const supabase = requireServiceClient();

    // Keep / delete split verification
    const keepChecks: Array<{ label: string; table: string; dateColumn: string }> = [
        { label: 'Party bills AFTER cutoff', table: 'party_billing_records', dateColumn: 'billing_date' },
        { label: 'Party payments AFTER cutoff', table: 'party_payment_receipts', dateColumn: 'receipt_date' },
        { label: 'Challans AFTER cutoff', table: 'challans', dateColumn: 'date_from' },
        { label: 'CNs AFTER cutoff', table: 'consignments', dateColumn: 'bkg_date' },
    ];

    // Resolve protected CNs first (covered by post-cutoff bills)
    const cnNosOnOrBeforeCutoff = await fetchAllCnNos(supabase, cutoff);
    const { bills: protectedBills, protectedCnNos } = await findPostCutoffBillsCoveringCnNos(
        supabase,
        cutoff,
        cnNosOnOrBeforeCutoff,
    );
    const { deleteIds: cnDeleteIds, retained: retainedCns } = await fetchConsignmentIdsToDelete(
        supabase,
        cutoff,
        protectedCnNos,
    );

    console.log('── Records TO DELETE (date ≤ cutoff) ───────────────────────');
    const counts: Record<string, number> = {};
    for (const t of TARGETS) {
        if (t.table === 'consignments') {
            counts[t.table] = cnDeleteIds.length;
            console.log(`\n${t.label}  [${t.table}.${t.dateColumn} ≤ ${cutoff}]`);
            console.log(`  count (will delete): ${cnDeleteIds.length}`);
            console.log(`  retained (on post-cutoff bills): ${retainedCns.length}`);
            if (cnDeleteIds.length > 0) {
                const samples = await sampleWhere(supabase, t.table, t.dateColumn, cutoff, t.sampleSelect);
                for (const s of samples) {
                    const cn = String(s.cn_no || '').trim().toUpperCase();
                    if (protectedCnNos.has(cn)) continue;
                    console.log(`  sample: ${JSON.stringify(s)}`);
                }
            }
            continue;
        }

        const n = await countWhere(supabase, t.table, t.dateColumn, cutoff);
        counts[t.table] = n;
        console.log(`\n${t.label}  [${t.table}.${t.dateColumn} ≤ ${cutoff}]`);
        console.log(`  count: ${n}`);
        if (n > 0) {
            const samples = await sampleWhere(supabase, t.table, t.dateColumn, cutoff, t.sampleSelect);
            for (const s of samples) {
                console.log(`  sample: ${JSON.stringify(s)}`);
            }
        }
    }

    const totalDelete = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`\nTotal transactional rows matched for delete: ${totalDelete}`);

    console.log('\n── Records TO KEEP (date > cutoff) ─────────────────────────');
    for (const k of keepChecks) {
        const { count, error } = await supabase
            .from(k.table)
            .select('id', { count: 'exact', head: true })
            .gt(k.dateColumn, cutoff);
        if (error) throw new Error(`${k.label} keep-count failed: ${error.message}`);
        console.log(`  ${k.label}: ${count ?? 0}`);
    }

    // Boundary day sanity: show max date on/before cutoff and min date after
    console.log('\n── Boundary sanity ─────────────────────────────────────────');
    for (const t of TARGETS) {
        const { data: maxBefore } = await supabase
            .from(t.table)
            .select(t.dateColumn)
            .lte(t.dateColumn, cutoff)
            .order(t.dateColumn, { ascending: false })
            .limit(1)
            .maybeSingle();
        const { data: minAfter } = await supabase
            .from(t.table)
            .select(t.dateColumn)
            .gt(t.dateColumn, cutoff)
            .order(t.dateColumn, { ascending: true })
            .limit(1)
            .maybeSingle();

        const beforeVal = maxBefore ? (maxBefore as Record<string, unknown>)[t.dateColumn] : null;
        const afterVal = minAfter ? (minAfter as Record<string, unknown>)[t.dateColumn] : null;
        console.log(
            `  ${t.table}: latest≤cutoff=${beforeVal ?? '—'} | earliest>cutoff=${afterVal ?? '—'}`,
        );
    }

    console.log('\n── Protected by post-cutoff bills (excluded from CN delete) ──');
    if (protectedBills.length === 0) {
        console.log('  none');
    } else {
        for (const b of protectedBills.slice(0, 20)) {
            console.log(
                `  KEEP bill ${b.bill_ref_no || b.id} dated ${b.billing_date} — CNs: ${b.protected_cn_nos.join(', ')}`,
            );
        }
        if (protectedBills.length > 20) console.log(`  … and ${protectedBills.length - 20} more bills`);
        console.log(`  Total protected CN(s) retained: ${retainedCns.length}`);
        for (const c of retainedCns.slice(0, 20)) {
            console.log(`    CN ${c.cn_no} (bkg_date ${c.bkg_date})`);
        }
        if (retainedCns.length > 20) console.log(`    … and ${retainedCns.length - 20} more`);
    }

    if (!execute) {
        console.log('\nDry run complete. No rows deleted.');
        console.log('To delete:');
        console.log(`  npx tsx scripts/purge-through-fy-cutoff.ts --cutoff=${cutoff} --execute --confirm=YES`);
        return;
    }

    if (confirm !== 'YES') {
        throw new Error('Refusing to delete: pass --confirm=YES together with --execute.');
    }

    console.log('\n── EXECUTING DELETES ───────────────────────────────────────');
    console.log(`Post-cutoff bills left untouched. Retaining ${retainedCns.length} protected CN(s).`);

    // Delete order: payments → bills → challans → consignments → audit
    const deleteOrder = [
        'party_payment_receipts',
        'broker_challan_payment_receipts',
        'party_billing_records',
        'broker_challan_billing_records',
        'challans',
    ] as const;

    const deletedEntityIds: string[] = [];

    for (const table of deleteOrder) {
        const target = TARGETS.find((t) => t.table === table);
        if (!target) continue;
        console.log(`Deleting ${table} where ${target.dateColumn} ≤ ${cutoff}…`);
        const ids = await fetchAllIds(supabase, table, target.dateColumn, cutoff);
        deletedEntityIds.push(...ids);
        const n = await deleteByIds(supabase, table, ids);
        console.log(`  deleted: ${n}`);
    }

    console.log(`Deleting consignments where bkg_date ≤ ${cutoff} (excluding protected)…`);
    deletedEntityIds.push(...cnDeleteIds);
    const cnDeleted = await deleteByIds(supabase, 'consignments', cnDeleteIds);
    console.log(`  deleted: ${cnDeleted} | retained: ${retainedCns.length}`);

    console.log('Deleting related ledger_audit_logs…');
    const auditDeleted = await deleteAuditLogs(supabase, deletedEntityIds, cutoff);
    console.log(`  deleted audit rows: ${auditDeleted}`);

    console.log('\n── Post-delete verification ────────────────────────────────');
    for (const t of TARGETS) {
        if (t.table === 'consignments') {
            const remaining = await countWhere(supabase, t.table, t.dateColumn, cutoff);
            const expected = retainedCns.length;
            console.log(
                `  consignments still ≤ cutoff: ${remaining} (expected retained ${expected})${remaining === expected ? ' ✓' : ' ✗'}`,
            );
            continue;
        }
        const remaining = await countWhere(supabase, t.table, t.dateColumn, cutoff);
        console.log(`  ${t.table} still ≤ cutoff: ${remaining}${remaining === 0 ? ' ✓' : ' ✗'}`);
    }

    console.log('\nPurge complete.');
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('\nFATAL:', message);
    process.exit(1);
});
