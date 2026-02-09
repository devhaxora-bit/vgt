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

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing production Supabase credentials in .env.production.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUsers() {
    console.log('Fetching production users...\n');
    const { data: users, error } = await supabase
        .from('users')
        .select('*');

    if (error) {
        console.error('Error fetching users:', error.message);
        return;
    }

    console.log('Production Users:');
    console.table(users.map(u => ({
        employee_code: u.employee_code,
        full_name: u.full_name,
        role: u.role,
        is_active: u.is_active
    })));
}

checkUsers();
