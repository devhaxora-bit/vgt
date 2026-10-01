import { NextRequest, NextResponse } from 'next/server';

import { AuthServiceFactory } from '@/lib/services/auth/AuthServiceFactory';
import { APP_SESSION_COOKIE, appSessionCookieOptions, createAppSession } from '@/lib/auth/appSession';
import { loginSchema } from '@/lib/schemas/user.schema';
import { createAdminClient } from '@/utils/supabase/admin';
import { clientIpFromHeaders } from '@/lib/utils/requestMeta';

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

        const rememberMe = validation.data.remember_me !== false;
        const ipAddress = clientIpFromHeaders(request.headers);
        const userAgent = request.headers.get('user-agent');
        const result = await authService.login(validation.data, {
            ipAddress,
            userAgent,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 401 },
            );
        }

        const { token, maxAgeSec } = await createAppSession({
            userId: result.data.user.id,
            rememberMe,
            ipAddress,
            userAgent,
        });

        // Password was verified via Supabase Auth; that session is not used by the app.
        try {
            await createAdminClient().auth.admin.signOut(result.data.session.access_token, 'local');
        } catch (error) {
            console.warn('Failed to discard Supabase auth session after login:', error);
        }

        const response = NextResponse.json({
            success: true,
            data: {
                user: result.data.user,
                message: 'Login successful',
                remember_me: rememberMe,
            },
        });

        response.cookies.set(
            APP_SESSION_COOKIE,
            token,
            appSessionCookieOptions(rememberMe ? maxAgeSec : undefined),
        );

        // Drop leftover cookies from the previous Supabase-session login.
        request.cookies.getAll()
            .filter((cookie) => cookie.name.startsWith('sb-'))
            .forEach((cookie) => response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 }));

        return response;
    } catch (error) {
        console.error('Login error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        const missingTable = /app_sessions|relation .* does not exist/i.test(message);
        return NextResponse.json(
            {
                success: false,
                error: missingTable
                    ? 'Session table is missing. Apply migration 20261001120000_app_sessions.sql, then try again.'
                    : message,
            },
            { status: 500 },
        );
    }
}
