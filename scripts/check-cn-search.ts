import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Try local env first, fall back to development.local
const envFile = process.argv.includes('--prod') ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`Missing Supabase creds in ${envFile}`);
    process.exit(1);
}

console.log(`Using env: ${envFile}`);
console.log(`Supabase URL: ${supabaseUrl}\n`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const searchTerm = process.argv.find(a => a.startsWith('--search='))?.split('=')[1] ?? '501';

async function main() {
    // 1. Total consignments
    const { count: total, error: countErr } = await supabase
        .from('consignments')
        .select('id', { count: 'exact', head: true });
    if (countErr) {
        console.error('Count error:', countErr);
        return;
    }
    console.log(`Total consignments in DB: ${total}\n`);

    // 2. Sample 10 most recent cn_no values to see actual format
    const { data: recent, error: recentErr } = await supabase
        .from('consignments')
        .select('cn_no, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
    if (recentErr) {
        console.error('Recent fetch error:', recentErr);
        return;
    }
    console.log('Latest 10 cn_no values stored:');
    recent?.forEach((r, i) => console.log(`  ${i + 1}. "${r.cn_no}"  (type: ${typeof r.cn_no})`));

    // 3. Run the same ilike search the API uses
    console.log(`\nSearching for: %${searchTerm}%`);
    const { data: matches, error: matchErr, count: matchCount } = await supabase
        .from('consignments')
        .select('cn_no', { count: 'exact' })
        .ilike('cn_no', `%${searchTerm}%`)
        .limit(20);
    if (matchErr) {
        console.error('Match error:', matchErr);
        return;
    }
    console.log(`Matches found: ${matchCount}`);
    matches?.forEach((m, i) => console.log(`  ${i + 1}. "${m.cn_no}"`));

    // 4. Try alternative searches to understand the format
    console.log('\nAlternative searches:');
    for (const term of ['0', '1', '8', '%']) {
        const { count } = await supabase
            .from('consignments')
            .select('id', { count: 'exact', head: true })
            .ilike('cn_no', `%${term}%`);
        console.log(`  ilike '%${term}%' → ${count} matches`);
    }

    // 5. Inspect the cn_no column type from information_schema (proxy via a simple query)
    const { data: oneRow } = await supabase
        .from('consignments')
        .select('cn_no')
        .limit(1)
        .single();
    if (oneRow) {
        console.log(`\nSample cn_no JS-side: ${JSON.stringify(oneRow.cn_no)} (length: ${String(oneRow.cn_no).length})`);
    }
}

main().catch(console.error);
