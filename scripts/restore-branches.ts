import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://flhakggyiykhimbvolfc.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreBranches() {
  console.log('Restoring branches...');
  
  const branches = [
    { code: 'MRG', name: 'Margao Hub', type: 'Hub', city: 'Margao', state: 'Goa', cn_prefix: 'K', next_cn_no: 730001 },
    { code: 'PNJ', name: 'Panjim Branch', type: 'Branch', city: 'Panjim', state: 'Goa', cn_prefix: 'S', next_cn_no: 800001 },
    { code: 'VZG', name: 'Vasco Branch', type: 'Branch', city: 'Vasco', state: 'Goa', cn_prefix: 'V', next_cn_no: 100001 },
    { code: 'MAP', name: 'Mapusa Hub', type: 'Hub', city: 'Mapusa', state: 'Goa', cn_prefix: 'M', next_cn_no: 200001 },
    { code: 'PND', name: 'Ponda Branch', type: 'Branch', city: 'Ponda', state: 'Goa', cn_prefix: 'P', next_cn_no: 300001 },
    { code: 'HBL', name: 'Hubballi Branch', type: 'Branch', city: 'Hubballi', state: 'Karnataka', cn_prefix: 'H', next_cn_no: 400001 }
  ];

  for (const b of branches) {
    const { error } = await supabase.from('branches').upsert(b, { onConflict: 'code' });
    if (error) console.error('Error inserting branch', b.code, error);
  }
  console.log('Branches restored successfully.');
}

restoreBranches();
