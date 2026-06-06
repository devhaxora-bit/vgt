import { DatabaseBackupService, type IDatabaseBackupService } from './DatabaseBackupService';

export class DatabaseBackupServiceFactory {
    static create(): IDatabaseBackupService {
        return new DatabaseBackupService();
    }
}
