import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

import { getServerSession } from '@/lib/auth/serverSession'
import { mintSupabaseAccessToken } from '@/lib/auth/supabaseJwt'

/**
 * Request-scoped Supabase client acting as the signed-in user (RLS + auth.uid()).
 * Identity comes from the app session cookie; without one this is an anon client.
 */
export async function createClient(): Promise<SupabaseClient> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

    if (!url || !anonKey) {
        throw new Error('Supabase URL / anon key is not set (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)')
    }

    const session = await getServerSession()
    const headers: Record<string, string> = {}
    if (session.status === 'valid') {
        headers.Authorization = `Bearer ${mintSupabaseAccessToken(session.session.userId)}`
    }

    return createSupabaseClient(url, anonKey, {
        global: { headers },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    })
}
