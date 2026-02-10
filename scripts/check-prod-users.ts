import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual env parsing
const envPath = path.resolve(process.cwd(), '.env.production.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars: { [key: string]: string } = {};

envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
        }
        envVars[match[1]] = value;
    }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'] || envVars['SUPABASE_URL'];
const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPolicies() {
    console.log('Checking production RLS policies for table "users"...\n');

    const { data: policies, error } = await supabase.rpc('get_policies', { table_name: 'users' });

    if (error) {
        // If RPC doesn't exist, try raw SQL query via standard query (might fail if not allowed)
        // Actually we can use the 'supabase' client to query pg_policies if the service role has permissions
        const { data: rawPolicies, error: rawError } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'users');

        if (rawError) {
            // Let's try another way: query the information_schema or just check if we can read the table as anon
            console.log('Could not fetch policies via pg_policies directly. Trying direct SQL...');
            const { data: sqlResult, error: sqlError } = await supabase.rpc('run_sql', {
                sql: "SELECT * FROM pg_policies WHERE tablename = 'users'"
            });
            if (sqlError) {
                console.error('Final failure to fetch policies:', sqlError.message);
                return;
            }
            console.table(sqlResult);
        } else {
            console.table(rawPolicies);
        }
    } else {
        console.table(policies);
    }
}

// Since I might not have 'run_sql' or 'get_policies' RPCs, I'll try a simpler approach
// querying pg_catalog.pg_policies directly via a raw SQL execution if possible, 
// but Supabase usually blocks this. 
// I'll just check if the is_admin function exists.

async function checkIsAdminFunction() {
    const { data, error } = await supabase.rpc('is_admin', { user_id: '9c41e5b0-d3f4-456d-94a0-30a1979aab58' });
    if (error) {
        console.log('is_admin function check: NOT FOUND or error:', error.message);
    } else {
        console.log('is_admin function check: FOUND. Result:', data);
    }
}

async function main() {
    await checkIsAdminFunction();
    // Also try to list policies using a common trick if available
    const { data: pol, error: polErr } = await supabase.from('pg_policies').select('*').eq('tablename', 'users');
    if (pol) console.table(pol);
}

main();
