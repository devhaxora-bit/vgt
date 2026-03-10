import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Try loading production env first, fallback to local env
dotenv.config({ path: resolve(process.cwd(), '.env.production.local') });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: resolve(process.cwd(), '.env.local') });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking connection to Supabase Project...");
  
  const { data, error } = await supabase.from('branches').select('id').limit(1);
  
  if (error) {
    console.error("\n❌ Error querying 'branches' table:");
    console.error(error.message);
    if (error.code === '42P01') {
      console.log("The table does NOT exist.");
    }
  } else {
    console.log("\n✅ The 'branches' table exists in the database.");
  }
}

check();
