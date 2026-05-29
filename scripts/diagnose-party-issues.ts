/**
 * Diagnostic script to check party data issues
 * Run with: npx tsx scripts/diagnose-party-issues.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface PartyRow {
    id: string;
    code: string;
    name: string;
    gstin: string | null;
    is_active: boolean;
    created_at: string;
}

async function getCnsCount(partyId: string): Promise<{ count: number; total: number }> {
    const { data } = await supabase
        .from('consignments')
        .select('total_freight')
        .eq('billing_party_id', partyId)
        .eq('cancel_cn', false);
    return {
        count: data?.length || 0,
        total: (data || []).reduce((s, c) => s + Number(c.total_freight || 0), 0),
    };
}

async function diagnose() {
    console.log('\n========================================');
    console.log('PARTY GSTIN GROUP DIAGNOSTIC');
    console.log('========================================\n');
    console.log(`Database: ${supabaseUrl}\n`);

    // Get ALL parties (active + inactive)
    const { data: allParties, error } = await supabase
        .from('parties')
        .select('id, code, name, gstin, is_active, created_at')
        .order('created_at');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    // Group by normalized GSTIN
    const byGstin = new Map<string, PartyRow[]>();
    for (const p of (allParties || []) as PartyRow[]) {
        if (!p.gstin || p.gstin.trim() === '') continue;
        const key = p.gstin.trim().toUpperCase();
        if (!byGstin.has(key)) byGstin.set(key, []);
        byGstin.get(key)!.push(p);
    }

    // Find GSTIN groups with more than one party
    const dupGroups = Array.from(byGstin.entries()).filter(([_, ps]) => ps.length > 1);

    console.log(`--- GSTIN GROUPS WITH DUPLICATES: ${dupGroups.length} ---\n`);

    for (const [gstin, parties] of dupGroups) {
        console.log(`GSTIN: ${gstin}`);
        // Sort: active first, then by code
        const sorted = [...parties].sort((a, b) => {
            if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
            return a.code.localeCompare(b.code);
        });
        for (const p of sorted) {
            const cns = await getCnsCount(p.id);
            console.log(`  ${p.code} | ${p.name} | active=${p.is_active} | CNS=${cns.count} (₹${cns.total.toLocaleString('en-IN')})`);
        }
        console.log('');
    }

    // Find inactive parties with consignments (the actual bug)
    console.log('--- INACTIVE PARTIES WITH CONSIGNMENTS (need fixing) ---\n');
    let problemCount = 0;
    for (const p of (allParties || []) as PartyRow[]) {
        if (p.is_active) continue;
        const cns = await getCnsCount(p.id);
        if (cns.count > 0) {
            problemCount++;
            console.log(`  ${p.code} | ${p.name} | GSTIN=${p.gstin || '(none)'} | CNS=${cns.count} (₹${cns.total.toLocaleString('en-IN')})`);
        }
    }
    if (problemCount === 0) {
        console.log('  None! All consignments point to active parties.\n');
    } else {
        console.log(`\n  Total: ${problemCount} inactive parties still holding consignments.\n`);
    }

    console.log('========================================');
    console.log('DIAGNOSIS COMPLETE');
    console.log('========================================\n');
}

diagnose().catch(console.error);
