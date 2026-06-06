import { createDatabaseDump, removeBackupFile } from '@/lib/backup/createDatabaseDump';
import {
    BACKUP_SKIP_REASON,
    getDatabaseConnectionString,
    getGoogleDriveConfig,
    isProductionEnvironment,
} from '@/lib/backup/env';
import { uploadToGoogleDrive } from '@/lib/backup/uploadToGoogleDrive';
import type { BackupResult } from '@/lib/types/backup.types';

export interface IDatabaseBackupService {
    run(): Promise<BackupResult>;
}

export class DatabaseBackupService implements IDatabaseBackupService {
    async run(): Promise<BackupResult> {
        if (!isProductionEnvironment()) {
            return {
                success: true,
                data: {
                    skipped: true,
                    reason: BACKUP_SKIP_REASON,
                },
            };
        }

        const connectionString = getDatabaseConnectionString();
        if (!connectionString) {
            return {
                success: false,
                error:
                    'Missing database connection string. Set POSTGRES_URL_NON_POOLING, POSTGRES_URL, DATABASE_URL, or SUPABASE_CONNECTION_STRING.',
            };
        }

        const driveConfig = getGoogleDriveConfig();
        if (!driveConfig) {
            return {
                success: false,
                error:
                    'Missing Google Drive credentials. Set GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID.',
            };
        }

        let dumpPath: string | undefined;

        try {
            const dump = await createDatabaseDump(connectionString);
            dumpPath = dump.gzipPath;

            const uploaded = await uploadToGoogleDrive({
                filePath: dump.gzipPath,
                fileName: dump.fileName,
                clientEmail: driveConfig.clientEmail,
                privateKey: driveConfig.privateKey,
                folderId: driveConfig.folderId,
            });

            return {
                success: true,
                data: {
                    skipped: false,
                    dumpPath: dump.gzipPath,
                    fileName: dump.fileName,
                    driveFileId: uploaded.fileId,
                    driveFileName: uploaded.fileName,
                },
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        } finally {
            if (dumpPath) {
                await removeBackupFile(dumpPath);
            }
        }
    }
}
