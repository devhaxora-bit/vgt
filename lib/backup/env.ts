export function isProductionEnvironment(): boolean {
    const raw = process.env.IS_PROD;
    if (!raw?.trim()) {
        return false;
    }

    const value = raw.trim().toLowerCase();
    return value === 'true' || value === '1';
}

export const BACKUP_SKIP_REASON =
    'IS_PROD is not set or not true. Backup cron skipped.';

export function getDatabaseConnectionString(): string | undefined {
    return (
        process.env.POSTGRES_URL_NON_POOLING ||
        process.env.POSTGRES_URL ||
        process.env.DATABASE_URL ||
        process.env.SUPABASE_CONNECTION_STRING ||
        process.env.SUPABASE_CONNETION_STRING
    );
}

export function getGoogleDriveConfig(): {
    clientEmail: string;
    privateKey: string;
    folderId: string;
} | null {
    const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

    if (!clientEmail || !privateKey || !folderId) {
        return null;
    }

    return {
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        folderId,
    };
}
