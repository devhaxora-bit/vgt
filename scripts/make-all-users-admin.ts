import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://flhakggyiykhimbvolfc.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function makeAdmin() {
  console.log('Promoting all users to admin so you can create branches...');
  const { data, error } = await supabase
    .from('users')
    .update({ role: 'admin', is_active: true })
    .neq('id', '00000000-0000-0000-0000-000000000000');
    
  if (error) {
    console.error('Error updating users:', error);
  } else {
    console.log('Successfully updated users to admin role!');
  }
}

makeAdmin();
