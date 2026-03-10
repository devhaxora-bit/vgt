import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load production environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Supabase URL or Service Role Key not found in .env.production.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('🔍 Checking tables in production database...\n');

  const tablesToCheck = ['notes', 'users', 'parties', 'branches', 'challans'];
  const results: Record<string, boolean> = {};

  for (const table of tablesToCheck) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      
      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ Table '${table}' does NOT exist.`);
          results[table] = false;
        } else {
          console.error(`⚠️ Error checking table '${table}':`, error.message);
        }
      } else {
        console.log(`✅ Table '${table}' exists.`);
        results[table] = true;
      }
    } catch (err) {
      console.error(`💥 Unexpected error checking table '${table}':`, err);
    }
  }

  const missingTables = Object.entries(results)
    .filter(([_, exists]) => !exists)
    .map(([name]) => name);

  if (missingTables.length > 0) {
    console.log(`\n⚠️ Missing tables: ${missingTables.join(', ')}`);
  } else {
    console.log('\n✨ All expected tables exist!');
  }
}

checkTables().catch(console.error);
