import { UserRepository } from '../../repositories/UserRepository';
import { UserService, type IUserService } from './UserService';

export class UserServiceFactory {
    private static instance: IUserService | null = null;

    static create(): IUserService {
        // Singleton pattern for service instance
        if (!this.instance) {
            const repository = new UserRepository();
            this.instance = new UserService(repository);
        }
        return this.instance;
    }

    static reset(): void {
        this.instance = null;
    }
}
