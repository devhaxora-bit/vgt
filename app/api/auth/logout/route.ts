import { NextRequest, NextResponse } from 'next/server';

import { AuthServiceFactory } from '@/lib/services/auth/AuthServiceFactory';
import { APP_SESSION_COOKIE } from '@/lib/auth/appSession';

const authService = AuthServiceFactory.create();

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get(APP_SESSION_COOKIE)?.value || null;
        const result = await authService.logout(token);

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

        response.cookies.delete(APP_SESSION_COOKIE);
        request.cookies.getAll()
            .filter((cookie) => cookie.name.startsWith('sb-'))
            .forEach((cookie) => response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 }));

        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
