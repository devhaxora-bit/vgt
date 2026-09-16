import { createBrowserClient } from '@supabase/ssr'

import { SESSION_MAX_AGE_REMEMBERED_SEC } from '@/lib/auth/sessionCookie'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookieOptions: {
                path: '/',
                sameSite: 'lax',
                maxAge: SESSION_MAX_AGE_REMEMBERED_SEC,
            },
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        },
    )
}
