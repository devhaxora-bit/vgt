import { createClient } from '@supabase/supabase-js';

/**
 * Ephemeral anon client for password login.
 * Does not touch cookies — the login API route is the single place that
 * writes the SSR session cookie (avoids double-write / lost Max-Age races).
 */
export function createAuthClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    return createClient(supabaseUrl, anonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    });
}
