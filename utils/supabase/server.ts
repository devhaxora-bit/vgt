import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { getServerSession } from '@/lib/auth/serverSession'
import { mintSupabaseAccessToken } from '@/lib/auth/supabaseJwt'

/**
 * Request-scoped Supabase client acting as the signed-in user (RLS + auth.uid()).
 * Identity comes from the app session cookie; without one this is an anon client.
 */
export async function createClient() {
    const session = await getServerSession()
    const headers: Record<string, string> = {}
    if (session.status === 'valid') {
        headers.Authorization = `Bearer ${mintSupabaseAccessToken(session.session.userId)}`
    }

    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: { headers },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        },
    )
}
