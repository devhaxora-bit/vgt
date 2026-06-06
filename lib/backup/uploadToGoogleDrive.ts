import { createReadStream } from 'node:fs';
import { google } from 'googleapis';
import type { GoogleDriveUploadResult } from '@/lib/types/backup.types';

type UploadToGoogleDriveInput = {
    filePath: string;
    fileName: string;
    clientEmail: string;
    privateKey: string;
    folderId: string;
};

export async function uploadToGoogleDrive(
    input: UploadToGoogleDriveInput
): Promise<GoogleDriveUploadResult> {
    const auth = new google.auth.JWT({
        email: input.clientEmail,
        key: input.privateKey,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.create({
        requestBody: {
            name: input.fileName,
            parents: [input.folderId],
        },
        media: {
            mimeType: 'application/gzip',
            body: createReadStream(input.filePath),
        },
        fields: 'id, name',
    });

    const fileId = response.data.id;
    const fileName = response.data.name;

    if (!fileId || !fileName) {
        throw new Error('Google Drive upload succeeded but file metadata was missing.');
    }

    return { fileId, fileName };
}
