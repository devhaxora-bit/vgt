import { NextResponse } from 'next/server';
import { AuthServiceFactory } from '@/lib/services/auth/AuthServiceFactory';

const authService = AuthServiceFactory.create();

export async function GET() {
    try {
        const result = await authService.getCurrentUser();

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.data,
        });
    } catch (error) {
        console.error('Get current user error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
