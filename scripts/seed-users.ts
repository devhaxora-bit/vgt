/**
 * Seed script to create test users for local development
 * 
 * Usage:
 *   npx tsx scripts/seed-users.ts
 * 
 * Or with ts-node:
 *   ts-node scripts/seed-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import type { CreateUserInput } from '../lib/schemas/user.schema';

// Test users to create
const testUsers: CreateUserInput[] = [
  {
    employee_code: 'EMP001',
    email: 'admin@vgt.com',
    password: 'Admin@123',
    role: 'admin',
    full_name: 'System Administrator',
    department: 'IT',
    phone: '+91-9999999999',
  },
  {
    employee_code: 'EMP002',
    email: 'employee@vgt.com',
    password: 'Employee@123',
    role: 'employee',
    full_name: 'John Doe',
    department: 'Operations',
    phone: '+91-9876543210',
  },
  {
    employee_code: 'AGT001',
    email: 'agent@vgt.com',
    password: 'Agent@123',
    role: 'agent',
    full_name: 'Jane Smith',
    department: 'Sales',
    phone: '+91-9876543211',
  },
];

async function seedUsers() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Get it from Supabase Studio > Settings > API');
  }

  // Create admin client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🌱 Starting user seeding...\n');

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, employee_code')
        .eq('employee_code', userData.employee_code)
        .single();

      if (existingUser) {
        console.log(`⏭️  User ${userData.employee_code} already exists, skipping...`);
        continue;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
      });

      if (authError) {
        console.error(`❌ Failed to create auth user for ${userData.employee_code}:`, authError.message);
        continue;
      }

      if (!authData.user) {
        console.error(`❌ No user returned for ${userData.employee_code}`);
        continue;
      }

      // Create user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          employee_code: userData.employee_code,
          full_name: userData.full_name,
          role: userData.role,
          department: userData.department || null,
          phone: userData.phone || null,
          is_active: true,
        })
        .select()
        .single();

      if (profileError) {
        // Rollback: delete auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        console.error(`❌ Failed to create profile for ${userData.employee_code}:`, profileError.message);
        continue;
      }

      console.log(`✅ Created user: ${userData.employee_code} (${userData.role})`);
    } catch (error) {
      console.error(`❌ Error creating user ${userData.employee_code}:`, error);
    }
  }

  console.log('\n✨ Seeding complete!');
  console.log('\n📝 Test Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  testUsers.forEach((user) => {
    console.log(`\n${user.role.toUpperCase()}:`);
    console.log(`  Employee Code: ${user.employee_code}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Password: ${user.password}`);
  });
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the script
seedUsers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
