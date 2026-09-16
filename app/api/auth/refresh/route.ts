import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { withSessionCookieOptions } from '@/lib/auth/sessionCookie';

/**
 * Quietly ensure the auth session is valid and re-write cookies with a long Max-Age.
 * Called by SessionKeepAlive while the dashboard is open.
 *
 * Uses getUser() only (refreshes when the JWT needs it) — avoid always calling
 * refreshSession(), which races with proxy refreshes under token rotation.
 */
export async function POST(request: NextRequest) {
    try {
        const response = NextResponse.json({ success: true });

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            response.cookies.set(
                                name,
                                value,
                                withSessionCookieOptions(options, true),
                            );
                        });
                    },
                },
            },
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { success: false, error: 'Session expired' },
                { status: 401 },
            );
        }

        return response;
    } catch (error) {
        console.error('Session refresh error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
