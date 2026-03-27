import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://flhakggyiykhimbvolfc.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { data, error } = await supabase
        .from('branches')
        .insert([{ 
            code: 'TEST202', 
            name: 'Test Branch', 
            type: 'Branch', 
            city: 'Test', 
            state: 'Test', 
            phone: null,
            next_cn_no: 800001,
            next_challan_no: 300066955
        }])
        .select()
        .single();
  console.log('Error:', error);
  console.log('Data:', data);
}

testInsert();
