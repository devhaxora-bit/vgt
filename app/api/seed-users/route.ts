/**
 * One-time seed endpoint to create test users
 * 
 * Usage: POST /api/seed-users
 * 
 * This endpoint should only be used in development.
 * It requires SUPABASE_SERVICE_ROLE_KEY to be set.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CreateUserInput } from '@/lib/schemas/user.schema';

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

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    return NextResponse.json(
      { success: false, error: 'NEXT_PUBLIC_SUPABASE_URL is not set' },
      { status: 500 }
    );
  }

  if (!supabaseServiceKey) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'SUPABASE_SERVICE_ROLE_KEY is not set. Get it from: supabase start (local) or Supabase Dashboard > Settings > API (production)' 
      },
      { status: 500 }
    );
  }

  // Create admin client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const results: Array<{ employee_code: string; status: 'created' | 'exists' | 'error'; message?: string }> = [];

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, employee_code')
        .eq('employee_code', userData.employee_code)
        .single();

      if (existingUser) {
        results.push({
          employee_code: userData.employee_code,
          status: 'exists',
          message: 'User already exists',
        });
        continue;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        results.push({
          employee_code: userData.employee_code,
          status: 'error',
          message: authError?.message || 'Failed to create auth user',
        });
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
        results.push({
          employee_code: userData.employee_code,
          status: 'error',
          message: profileError.message,
        });
        continue;
      }

      results.push({
        employee_code: userData.employee_code,
        status: 'created',
      });
    } catch (error) {
      results.push({
        employee_code: userData.employee_code,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  const exists = results.filter(r => r.status === 'exists').length;
  const errors = results.filter(r => r.status === 'error').length;

  return NextResponse.json({
    success: true,
    message: `Seeding complete: ${created} created, ${exists} already exist, ${errors} errors`,
    results,
  });
}
