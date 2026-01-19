/**
 * Admin Supabase client for operations requiring service role privileges
 * Use this ONLY for admin operations like creating users, getting user by ID, etc.
 * 
 * ⚠️ WARNING: This client bypasses RLS and has full access. Use with caution!
 */

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  console.log('✅ Creating admin client with service role key (length:', supabaseServiceKey.length, ')');

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
