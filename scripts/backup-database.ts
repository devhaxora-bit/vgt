/**
 * Daily production database backup to Google Drive.
 *
 * Runs only when IS_PROD=true.
 *
 * System cron example (daily at 2:00 AM):
 *   0 2 * * * cd /path/to/vgt && /usr/bin/npm run backup:database >> /var/log/vgt-db-backup.log 2>&1
 *
 * Required env:
 *   IS_PROD=true
 *   POSTGRES_URL_NON_POOLING (or POSTGRES_URL / DATABASE_URL / SUPABASE_CONNECTION_STRING)
 *   GOOGLE_DRIVE_CLIENT_EMAIL
 *   GOOGLE_DRIVE_PRIVATE_KEY
 *   GOOGLE_DRIVE_FOLDER_ID
 *
 * Requires PostgreSQL client tools: pg_dump
 */

import * as dotenv from 'dotenv';
import path from 'node:path';
import { BACKUP_SKIP_REASON, isProductionEnvironment } from '../lib/backup/env';
import { DatabaseBackupServiceFactory } from '../lib/services/backup/DatabaseBackupServiceFactory';

// Preserve IS_PROD when set by system cron before loading .env files.
const systemIsProd = process.env.IS_PROD;

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local') });

if (systemIsProd !== undefined) {
    process.env.IS_PROD = systemIsProd;
}

async function main() {
    if (!isProductionEnvironment()) {
        console.log(BACKUP_SKIP_REASON);
        return;
    }

    const backupService = DatabaseBackupServiceFactory.create();
    const result = await backupService.run();

    if (!result.success) {
        console.error(`Database backup failed: ${result.error}`);
        process.exit(1);
    }

    if (result.data.skipped) {
        console.log(result.data.reason ?? 'Backup skipped.');
        return;
    }

    console.log(
        `Database backup uploaded to Google Drive: ${result.data.driveFileName} (${result.data.driveFileId})`
    );
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Database backup crashed:', message);
    process.exit(1);
});
