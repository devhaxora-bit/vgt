import { NextRequest, NextResponse } from 'next/server';
import { UserServiceFactory } from '@/lib/services/user/UserServiceFactory';
import { AuthServiceFactory } from '@/lib/services/auth/AuthServiceFactory';
import { updateUserSchema } from '@/lib/schemas/user.schema';

const userService = UserServiceFactory.create();
const authService = AuthServiceFactory.create();

// GET /api/users/[id] - Get user by ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const currentUserResult = await authService.getCurrentUser();
        if (!currentUserResult.success || !currentUserResult.data) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Users can view their own profile, admins can view any profile
        if (
            currentUserResult.data.id !== id &&
            currentUserResult.data.role !== 'admin'
        ) {
            return NextResponse.json(
                { success: false, error: 'Forbidden' },
                { status: 403 }
            );
        }

        const result = await userService.getUser(id);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.data,
        });
    } catch (error) {
        console.error('Get user error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PATCH /api/users/[id] - Update user (admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
        const validation = updateUserSchema.safeParse(body);
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

        const result = await userService.updateUser(id, validation.data);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.data,
            message: 'User updated successfully',
        });
    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/users/[id] - Deactivate user (admin only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        const result = await userService.deactivateUser(id);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'User deactivated successfully',
        });
    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
