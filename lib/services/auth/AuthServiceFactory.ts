import { UserRepository } from '../../repositories/UserRepository';
import { AuthService, type IAuthService } from './AuthService';

export class AuthServiceFactory {
    private static instance: IAuthService | null = null;

    static create(): IAuthService {
        if (!this.instance) {
            const userRepository = new UserRepository();
            this.instance = new AuthService(userRepository);
        }
        return this.instance;
    }

    static reset(): void {
        this.instance = null;
    }
}
