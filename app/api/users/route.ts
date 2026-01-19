import { NextRequest, NextResponse } from 'next/server';
import { UserServiceFactory } from '@/lib/services/user/UserServiceFactory';
import { AuthServiceFactory } from '@/lib/services/auth/AuthServiceFactory';
import { createUserSchema } from '@/lib/schemas/user.schema';

const userService = UserServiceFactory.create();
const authService = AuthServiceFactory.create();

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
    try {
        // Check if user is admin
        const currentUserResult = await authService.getCurrentUser();
        if (!currentUserResult.success || !currentUserResult.data) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        if (currentUserResult.data.role !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Forbidden: Admin access required' },
                { status: 403 }
            );
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role') || undefined;
        const is_active = searchParams.get('is_active') === 'true' ? true :
            searchParams.get('is_active') === 'false' ? false : undefined;

        const result = await userService.getAllUsers({ role, is_active });

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
        console.error('Get users error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
    try {
        // Check if user is admin
        const currentUserResult = await authService.getCurrentUser();
        if (!currentUserResult.success || !currentUserResult.data) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        if (currentUserResult.data.role !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Forbidden: Admin access required' },
                { status: 403 }
            );
        }

        const body = await request.json();

        // Validate input
        const validation = createUserSchema.safeParse(body);
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

        // Create user
        const result = await userService.createUser(
            validation.data,
            currentUserResult.data.id
        );

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.data,
            message: 'User created successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
