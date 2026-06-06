import { execFile } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { promisify } from 'node:util';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

function formatBackupTimestamp(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-');
}

export async function createDatabaseDump(connectionString: string): Promise<{
    sqlPath: string;
    gzipPath: string;
    fileName: string;
}> {
    const timestamp = formatBackupTimestamp(new Date());
    const fileName = `vgt-db-backup-${timestamp}.sql.gz`;
    const backupDir = path.join(tmpdir(), 'vgt-db-backups');
    const sqlPath = path.join(backupDir, `vgt-db-backup-${timestamp}.sql`);
    const gzipPath = path.join(backupDir, fileName);

    await mkdir(backupDir, { recursive: true });

    try {
        await execFileAsync(
            'pg_dump',
            ['--dbname', connectionString, '--no-owner', '--no-acl', '-F', 'p', '-f', sqlPath],
            {
                env: {
                    ...process.env,
                    PGSSLMODE: 'require',
                },
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
            `pg_dump failed. Install PostgreSQL client tools (pg_dump) and verify the database connection string. ${message}`
        );
    }

    await pipeline(createReadStream(sqlPath), createGzip(), createWriteStream(gzipPath));
    await unlink(sqlPath);

    return { sqlPath: gzipPath, gzipPath, fileName };
}

export async function removeBackupFile(filePath: string): Promise<void> {
    try {
        await unlink(filePath);
    } catch {
        // Best-effort cleanup for temporary backup files.
    }
}
