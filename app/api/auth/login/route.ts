import { NextRequest, NextResponse } from 'next/server';
import { AuthServiceFactory } from '@/lib/services/auth/AuthServiceFactory';
import { loginSchema } from '@/lib/schemas/user.schema';

const authService = AuthServiceFactory.create();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate input
        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Validation failed',
                    details: validation.error.issues
                },
                { status: 400 }
            );
        }

        // Attempt login
        const result = await authService.login(validation.data);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 401 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                user: result.data.user,
                message: 'Login successful',
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
