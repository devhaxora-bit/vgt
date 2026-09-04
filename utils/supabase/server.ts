import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { withSessionCookieOptions } from '@/lib/auth/sessionCookie'

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        try {
                            cookieStore.set(name, value, withSessionCookieOptions(options, true))
                        } catch {
                            // Ignore errors from Server Components — middleware/proxy refreshes cookies.
                        }
                    })
                },
            },
        }
    )
}
