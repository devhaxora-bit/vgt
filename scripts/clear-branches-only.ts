import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://flhakggyiykhimbvolfc.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearBranchesOnly() {
  console.log('Clearing branches so you can test the new UI...');
  const { error } = await supabase.from('branches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
      console.error('Error clearing branches:', error);
  } else {
      console.log('Branches cleared successfully.');
  }
}

clearBranchesOnly();
