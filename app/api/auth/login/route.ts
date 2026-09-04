import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { withSessionCookieOptions } from '@/lib/auth/sessionCookie';
import { AuthServiceFactory } from '@/lib/services/auth/AuthServiceFactory';
import { loginSchema } from '@/lib/schemas/user.schema';

const authService = AuthServiceFactory.create();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Validation failed',
                    details: validation.error.issues,
                },
                { status: 400 },
            );
        }

        const rememberMe = Boolean(validation.data.remember_me);
        const result = await authService.login(validation.data);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 401 },
            );
        }

        const response = NextResponse.json({
            success: true,
            data: {
                user: result.data.user,
                message: 'Login successful',
                remember_me: rememberMe,
            },
        });

        // Persist the session on this response so cookies survive the JSON reply.
        // AuthService already authenticated; setSession writes the SSR cookie jar.
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
                                withSessionCookieOptions(options, rememberMe),
                            );
                        });
                    },
                },
            },
        );

        const { error: sessionError } = await supabase.auth.setSession({
            access_token: result.data.session.access_token,
            refresh_token: result.data.session.refresh_token,
        });

        if (sessionError) {
            console.error('Login session cookie write failed:', sessionError.message);
            return NextResponse.json(
                { success: false, error: 'Login succeeded but session could not be saved. Please try again.' },
                { status: 500 },
            );
        }

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
