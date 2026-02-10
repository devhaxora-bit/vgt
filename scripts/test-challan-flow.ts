

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env vars manually
const envPath = path.resolve(process.cwd(), '.env.local');
let envConfig: Record<string, string> = {};

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            envConfig[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testChallanFlow() {
    console.log('🚀 Starting Challan Flow Test...');

    // 1. Check Branches
    console.log('\nChecking branches...');
    const { data: branches, error: branchError } = await supabase
        .from('branches')
        .select('*')
        .limit(1);

    if (branchError) {
        console.error('❌ Failed to fetch branches:', branchError.message);
        return;
    }

    if (!branches || branches.length === 0) {
        console.error('❌ No branches found. Seeding failed?');
        return;
    }
    console.log('✅ Branches found:', branches.length);
    const origin = branches[0];

    // Get another branch for destination (or same if only 1)
    const { data: destBranches } = await supabase.from('branches').select('*').limit(2);
    const destination = destBranches && destBranches.length > 1 ? destBranches[1] : origin;

    console.log(`Using Origin: ${origin.name} (${origin.code})`);
    console.log(`Using Destination: ${destination.name} (${destination.code})`);

    // 2. Create Challan
    // We need a user ID for created_by. Let's fetch one.
    const { data: users } = await supabase.from('auth.users').select('id').limit(1);
    // auth.users is not accessible directly via service key usually without schema mod or specific client config?
    // Actually service key bypasses RLS but `auth.users` might be tricky.
    // Let's use `public.users` to find a linked user, or just try to insert with a dummy UUID if FK allows? 
    // No, FK is to auth.users.
    // Let's rely on service key ability to insert.

    // Instead of auth.users, let's just pick a ID from public.users which should duplicate auth.users ids
    const { data: publicUsers } = await supabase.from('users').select('id').limit(1);
    const userId = publicUsers?.[0]?.id;

    if (!userId) {
        console.warn('⚠️ No users found to link created_by. Trying to proceed without or with random UUID (might fail FK).');
    }

    const newChallan = {
        challan_no: `TEST${Date.now()}`,
        origin_branch_code: origin.code,
        destination_branch_code: destination.code,
        challan_type: 'MAIN',
        vehicle_no: 'TEST-VEH-01',
        driver_name: 'Test Driver',
        driver_mobile: '9999999999',
        total_hire_amount: 5000,
        extra_hire_amount: 500,
        advance_amount: 1000,
        status: 'ACTIVE',
        created_by: userId
    };

    console.log('\nCreating Challan...', newChallan);
    const { data: createdChallan, error: createError } = await supabase
        .from('challans')
        .insert(newChallan)
        .select()
        .single();

    if (createError) {
        console.error('❌ Failed to create challan:', createError.message);
        return;
    }

    console.log('✅ Challan created successfully!');
    console.log('   ID:', createdChallan.id);
    console.log('   Challan No:', createdChallan.challan_no);
    console.log('   Balance:', createdChallan.balance_amount); // Computed column check

    // 3. Verify List
    console.log('\nVerifying List Fetch...');
    const { data: listData, error: listError } = await supabase
        .from('challans')
        .select('*, origin_branch:branches!origin_branch_code(name), destination_branch:branches!destination_branch_code(name)')
        .eq('id', createdChallan.id)
        .single();

    if (listError) {
        console.error('❌ Failed to fetch created challan from list:', listError.message);
        return;
    }

    if (listData) {
        console.log('✅ Fetched verify successful.');
        // @ts-ignore
        console.log(`   Route: ${listData.origin_branch?.name} -> ${listData.destination_branch?.name}`);
    }

    console.log('\n🎉 Test Flow Completed Successfully!');
}

testChallanFlow().catch(console.error);
