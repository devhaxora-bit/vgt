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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function syncUsers() {
    console.log('🔄 Starting user synchronization...\n');

    // 1. Fetch all auth users
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('❌ Failed to list auth users:', authError.message);
        return;
    }

    console.log(`Found ${authUsers.length} users in Auth.\n`);

    for (const authUser of authUsers) {
        // Check if profile exists
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

        if (profile) {
            console.log(`✅ Profile exists for ${authUser.email} (${profile.employee_code})`);

            // Fix: If it's EMP001 and name is System Administrator, but user wants to verify it
            if (profile.employee_code === 'EMP001') {
                console.log(`   Current Name: ${profile.full_name}`);
            }
            continue;
        }

        // Profile missing - Create it
        console.log(`⚠️ Profile missing for ${authUser.email}. creating...`);

        let employeeCode = 'EMP-' + authUser.id.substring(0, 5).toUpperCase();
        // Special case for the admin email if it's missing profile
        if (authUser.email === 'admin@vgt.com') employeeCode = 'EMP001';

        const { error: insertError } = await supabase
            .from('users')
            .insert({
                id: authUser.id,
                full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Unknown User',
                employee_code: employeeCode,
                role: authUser.email === 'admin@vgt.com' ? 'admin' : 'employee',
                is_active: true
            });

        if (insertError) {
            console.error(`❌ Failed to create profile for ${authUser.email}:`, insertError.message);
        } else {
            console.log(`✨ Created profile for ${authUser.email} with code ${employeeCode}`);
        }
    }

    console.log('\n✅ Sync complete!');
}

syncUsers();
