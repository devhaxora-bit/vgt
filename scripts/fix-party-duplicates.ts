/**
 * Fix script: resolve inactive parties that still hold consignments.
 *
 * Strategy (automatic):
 *  For each inactive party that has consignments:
 *    - If an ACTIVE party with the same normalized GSTIN exists → merge into it
 *      (move consignments, billing records, payment receipts; deactivate loser ledger)
 *    - If NO active party with the same GSTIN exists → reactivate this party
 *      (it is a unique entity that was deactivated by mistake)
 *
 * Run dry run:   npx tsx scripts/fix-party-duplicates.ts
 * Apply changes: npx tsx scripts/fix-party-duplicates.ts --apply
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const APPLY = process.argv.includes('--apply');

interface PartyRow {
    id: string;
    code: string;
    name: string;
    gstin: string | null;
    is_active: boolean;
    created_at: string;
}

const norm = (g: string | null) => (g || '').trim().toUpperCase();

async function cnsCount(partyId: string) {
    const { data } = await supabase
        .from('consignments')
        .select('total_freight')
        .eq('billing_party_id', partyId)
        .eq('cancel_cn', false);
    return { count: data?.length || 0, total: (data || []).reduce((s, c) => s + Number(c.total_freight || 0), 0) };
}

async function mergeInto(loser: PartyRow, winner: PartyRow) {
    console.log(`  MERGE ${loser.code} → ${winner.code} (${winner.name})`);

    const billing = await supabase.from('party_billing_records').select('id').eq('party_id', loser.id);
    const payments = await supabase.from('party_payment_receipts').select('id').eq('party_id', loser.id);
    const billingCount = billing.data?.length || 0;
    const paymentCount = payments.data?.length || 0;

    if (billingCount > 0 || paymentCount > 0) {
        console.log(`    ⚠ Loser has ${billingCount} billing + ${paymentCount} payment records.`);
        console.log(`    ⚠ These need the SQL trigger-disable approach. SKIPPING this merge.`);
        console.log(`    ⚠ Handle ${loser.code} manually via SQL.`);
        return;
    }

    if (!APPLY) {
        const c = await cnsCount(loser.id);
        console.log(`    [DRY] would move ${c.count} consignments (₹${c.total.toLocaleString('en-IN')})`);
        console.log(`    [DRY] would deactivate loser ledger account`);
        return;
    }

    // Move consignments
    const { error: cErr } = await supabase
        .from('consignments')
        .update({ billing_party_id: winner.id, billing_party_code: winner.code })
        .eq('billing_party_id', loser.id);
    if (cErr) { console.error(`    ✗ consignments: ${cErr.message}`); return; }
    console.log(`    ✓ consignments moved`);

    // Deactivate loser ledger account
    const { error: lErr } = await supabase
        .from('party_ledger_accounts')
        .update({ is_active: false, opening_balance: 0 })
        .eq('party_id', loser.id);
    if (lErr) console.error(`    ✗ ledger: ${lErr.message}`);
    else console.log(`    ✓ loser ledger deactivated`);

    // Ensure loser party is inactive
    await supabase.from('parties').update({ is_active: false }).eq('id', loser.id);
}

async function reactivate(party: PartyRow) {
    console.log(`  REACTIVATE ${party.code} (${party.name}) — unique GSTIN, no active duplicate`);
    if (!APPLY) {
        console.log(`    [DRY] would set is_active = true`);
        return;
    }
    const { error } = await supabase.from('parties').update({ is_active: true }).eq('id', party.id);
    if (error) console.error(`    ✗ ${error.message}`);
    else console.log(`    ✓ reactivated`);

    // Make sure its ledger account is active too
    await supabase.from('party_ledger_accounts').update({ is_active: true }).eq('party_id', party.id);
}

async function main() {
    console.log('========================================');
    console.log('FIX INACTIVE PARTIES HOLDING CONSIGNMENTS');
    console.log(`MODE: ${APPLY ? 'APPLY (live changes)' : 'DRY RUN (no changes)'}`);
    console.log('========================================\n');

    const { data: allParties, error } = await supabase
        .from('parties')
        .select('id, code, name, gstin, is_active, created_at');
    if (error) { console.error(error.message); return; }

    const parties = (allParties || []) as PartyRow[];

    // Active parties by normalized GSTIN
    const activeByGstin = new Map<string, PartyRow>();
    for (const p of parties) {
        if (!p.is_active) continue;
        const g = norm(p.gstin);
        if (!g) continue;
        // keep lowest code as canonical winner
        const existing = activeByGstin.get(g);
        if (!existing || p.code < existing.code) activeByGstin.set(g, p);
    }

    // Find inactive parties holding consignments
    for (const p of parties) {
        if (p.is_active) continue;
        const c = await cnsCount(p.id);
        if (c.count === 0) continue;

        console.log(`Problem party ${p.code} | ${p.name} | GSTIN=${p.gstin || '(none)'} | CNS=${c.count} (₹${c.total.toLocaleString('en-IN')})`);

        const g = norm(p.gstin);
        const winner = g ? activeByGstin.get(g) : undefined;

        if (winner && winner.id !== p.id) {
            await mergeInto(p, winner);
        } else {
            await reactivate(p);
        }
        console.log('');
    }

    console.log('========================================');
    console.log(APPLY ? 'DONE (changes applied)' : 'DRY RUN COMPLETE — run with --apply to execute');
    console.log('========================================\n');
}

main().catch(console.error);
