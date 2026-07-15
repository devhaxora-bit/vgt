import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { createClient } from '@/utils/supabase/server';
import { updateUserSchema } from '@/lib/schemas/user.schema';
import { hasFullBranchAccess } from '@/lib/branchAccess';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const repo = new UserRepository();
        const requester = await repo.findById(authUser.id);

        if (!requester || requester.role !== 'admin' || !hasFullBranchAccess(requester)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const users = await repo.findAll();

        return NextResponse.json(users);
    } catch (error: unknown) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch users' },
            { status: 500 },
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const repo = new UserRepository();
        const requester = await repo.findById(authUser.id);

        if (!requester || requester.role !== 'admin' || !hasFullBranchAccess(requester)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { id, ...rawData } = body;

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const validation = updateUserSchema.safeParse(rawData);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validation.error.issues },
                { status: 400 },
            );
        }

        const data = { ...validation.data };
        if (data.branch_access === 'global') {
            data.branch_code = null;
        }

        const updatedUser = await repo.update(id, data);
        return NextResponse.json(updatedUser);
    } catch (error: unknown) {
        console.error('Error updating user:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update user' },
            { status: 500 },
        );
    }
}
