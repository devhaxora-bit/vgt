import { NextRequest, NextResponse } from 'next/server';
import { BACKUP_SKIP_REASON, isProductionEnvironment } from '@/lib/backup/env';
import { DatabaseBackupServiceFactory } from '@/lib/services/backup/DatabaseBackupServiceFactory';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorizedCronRequest(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
        return false;
    }

    const authHeader = request.headers.get('authorization');
    return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
    if (!isProductionEnvironment()) {
        return NextResponse.json({
            success: true,
            data: { skipped: true, reason: BACKUP_SKIP_REASON },
        });
    }

    if (!isAuthorizedCronRequest(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const backupService = DatabaseBackupServiceFactory.create();
    const result = await backupService.run();

    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
}
