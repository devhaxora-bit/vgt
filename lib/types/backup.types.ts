export type BackupResult =
    | { success: true; data: DatabaseBackupResult }
    | { success: false; error: string };

export type DatabaseBackupResult = {
    skipped: boolean;
    reason?: string;
    dumpPath?: string;
    fileName?: string;
    driveFileId?: string;
    driveFileName?: string;
};

export type GoogleDriveUploadResult = {
    fileId: string;
    fileName: string;
};
