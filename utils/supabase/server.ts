import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

import { getServerSession } from '@/lib/auth/serverSession'
import { mintSupabaseAccessToken, resolveJwtSecret } from '@/lib/auth/supabaseJwt'
import { createAdminClient } from '@/utils/supabase/admin'

let warnedMissingJwt = false

/**
 * Request-scoped Supabase client acting as the signed-in user (RLS + auth.uid()).
 * Identity comes from the app session cookie; without one this is an anon client.
 *
 * If SUPABASE_JWT_SECRET is missing (common until next-dev is restarted, or on a
 * misconfigured host), falls back to the service-role client so the app stays up.
 * Access control still runs in requireAuthz; only RLS/auth.uid() is skipped.
 */
export async function createClient(): Promise<SupabaseClient> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

    if (!url || !anonKey) {
        throw new Error('Supabase URL / anon key is not set (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)')
    }

    const session = await getServerSession()
    if (session.status !== 'valid') {
        return createSupabaseClient(url, anonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        })
    }

    try {
        resolveJwtSecret()
        const headers = {
            Authorization: `Bearer ${mintSupabaseAccessToken(session.session.userId)}`,
        }
        return createSupabaseClient(url, anonKey, {
            global: { headers },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        })
    } catch (error) {
        if (!warnedMissingJwt) {
            warnedMissingJwt = true
            console.warn(
                '[auth] Falling back to service-role DB client:',
                error instanceof Error ? error.message : error,
                '— restart `npm run dev` after adding SUPABASE_JWT_SECRET to .env.local',
            )
        }
        return createAdminClient()
    }
}
