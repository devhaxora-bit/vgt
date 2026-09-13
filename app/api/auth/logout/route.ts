import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { AuthServiceFactory } from '@/lib/services/auth/AuthServiceFactory';

const authService = AuthServiceFactory.create();

export async function POST(request: NextRequest) {
    try {
        // Close app session audit row (user_sessions.logout_at)
        const result = await authService.logout();

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 },
            );
        }

        const response = NextResponse.json({
            success: true,
            message: 'Logout successful',
        });

        // Clear Supabase auth cookies on this response so the browser truly ends the session.
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
                            response.cookies.set(name, value, {
                                ...options,
                                path: options?.path || '/',
                                maxAge: 0,
                            });
                        });
                    },
                },
            },
        );

        await supabase.auth.signOut();

        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
