import { NextResponse } from 'next/server';
import { AuthServiceFactory } from '@/lib/services/auth/AuthServiceFactory';

const authService = AuthServiceFactory.create();

export async function POST() {
    try {
        const result = await authService.logout();

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Logout successful',
        });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
