import { NextResponse } from 'next/server';

import { getServerSession } from '@/lib/auth/serverSession';
import { AuthServiceFactory } from '@/lib/services/auth/AuthServiceFactory';
import { createAdminClient } from '@/utils/supabase/admin';

const authService = AuthServiceFactory.create();

export async function GET() {
    try {
        const session = await getServerSession();
        if (session.status === 'error') {
            return NextResponse.json(
                { success: false, error: 'Session service temporarily unavailable' },
                { status: 503 },
            );
        }
        if (session.status === 'invalid') {
            return NextResponse.json({ success: false, data: null, error: 'Unauthorized' }, { status: 401 });
        }

        const result = await authService.getCurrentUser();

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        const user = result.data;
        let branchName: string | null = null;
        const branchCode = String(user?.branch_code || '').trim().toUpperCase();
        if (branchCode) {
            const { data: branch } = await createAdminClient()
                .from('branches')
                .select('name')
                .ilike('code', branchCode)
                .maybeSingle();
            branchName = branch?.name || null;
        }

        return NextResponse.json({
            success: true,
            data: user ? { ...user, branch_name: branchName } : null,
        });
    } catch (error) {
        console.error('Get current user error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
