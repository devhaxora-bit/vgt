import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const [key, ...value] = line.split('=');
      if (key && value.length > 0) {
        process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log("--- PARTIES ---");
    const { data: parties } = await supabase.from('parties').select('id, code, name');
    console.log(`Total parties: ${parties?.length}`);
    console.log(parties);

    console.log("\n--- VW_PARTY_LEDGER_SUMMARY ---");
    const { data: summary } = await supabase.from('vw_party_ledger_summary').select('*');
    console.log(`Total summary rows: ${summary?.length}`);
    if (summary) {
        summary.forEach(r => console.log(`${r.party_code} - ${r.party_name} | CNS Cnt: ${r.total_cns_count} | Unbilled: ${r.unbilled_amount}`));
    }

    console.log("\n--- CONSIGNMENTS WITH NULL BILLING_PARTY_ID ---");
    const { count: nullCount } = await supabase.from('consignments').select('*', { count: 'exact', head: true }).is('billing_party_id', null);
    console.log(`Null billing_party_id count: ${nullCount}`);
    
    console.log("\n--- CONSIGNMENTS GROUP BY BILLING_PARTY_ID ---");
    const cns = await supabase.from('consignments').select('billing_party_id, cn_no, billing_party_code');
    const grp: any = {};
    cns.data?.forEach(c => {
        const key = c.billing_party_id || 'NULL';
        if (!grp[key]) grp[key] = {count: 0, sample_cn: c.cn_no, code: c.billing_party_code};
        grp[key].count++;
    });
    console.log(grp);
}

inspect().catch(console.error);
