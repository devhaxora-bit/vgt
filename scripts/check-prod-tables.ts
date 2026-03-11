import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Simple env parser to avoid dotenv dependency
function loadEnv() {
  try {
    // Try production env first, then local env
    const envFiles = ['.env.production.local', '.env.local'];
    for (const file of envFiles) {
      const envPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(envPath)) {
        console.log(`Loading env from ${file}...`);
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach(line => {
          const [key, ...value] = line.split('=');
          if (key && value.length > 0) {
            process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
          }
        });
        // If we found the primary vars, we can stop
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) break;
      }
    }
  } catch (e) {
    console.error('Error loading env files', e);
  }
}

loadEnv();

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
