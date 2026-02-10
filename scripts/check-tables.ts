
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
// import dotenv from 'dotenv'; // We might not have dotenv installed, so let's try manual parsing if needed, but let's see.

// Simple env parser
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf-8');
            envConfig.split('\n').forEach(line => {
                const [key, ...value] = line.split('=');
                if (key && value) {
                    process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
                }
            });
        }
    } catch (e) {
        console.error('Error loading .env.local', e);
    }
}

loadEnv();

async function checkTables() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing env vars');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking tables in public schema...');

    // We can't easily query information_schema via supabase-js without a function
    // So we will try to select from 'branches' and see if it errors

    try {
        const { data, error } = await supabase.from('branches').select('*').limit(1);

        if (error) {
            console.log('❌ Error querying branches:', error.message);
            if (error.code === '42P01') {
                console.log('   -> Table "branches" does not exist.');
            }
        } else {
            console.log('✅ Table "branches" exists!');
            console.log('   Sample row:', data);
        }
    } catch (e) {
        console.log('Exception:', e);
    }

    // Also check for 'consignments' while we are at it
    try {
        const { data, error } = await supabase.from('consignments').select('*').limit(1);

        if (error) {
            console.log('❌ Error querying consignments:', error.message);
        } else {
            console.log('✅ Table "consignments" exists!');
            console.log('   Sample row:', data);
        }
    } catch (e) {
        console.log('Exception:', e);
    }
}

checkTables();
