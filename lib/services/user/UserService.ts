import type { IUserRepository } from '../../repositories/UserRepository';
import type { User, CreateUserInput, UpdateUserInput, Result } from '../../types/user.types';

export interface IUserService {
    getUser(id: string): Promise<Result<User>>;
    getUserByEmployeeCode(employeeCode: string): Promise<Result<User>>;
    getAllUsers(filters?: { role?: string; is_active?: boolean }): Promise<Result<User[]>>;
    createUser(data: CreateUserInput, createdBy: string): Promise<Result<User>>;
    updateUser(id: string, data: UpdateUserInput): Promise<Result<User>>;
    deactivateUser(id: string): Promise<Result<void>>;
}

export class UserService implements IUserService {
    constructor(private repository: IUserRepository) { }

    async getUser(id: string): Promise<Result<User>> {
        try {
            const user = await this.repository.findById(id);

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            return { success: true, data: user };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get user'
            };
        }
    }

    async getUserByEmployeeCode(employeeCode: string): Promise<Result<User>> {
        try {
            const user = await this.repository.findByEmployeeCode(employeeCode);

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            return { success: true, data: user };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get user'
            };
        }
    }

    async getAllUsers(filters?: { role?: string; is_active?: boolean }): Promise<Result<User[]>> {
        try {
            const users = await this.repository.findAll(filters);
            return { success: true, data: users };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get users'
            };
        }
    }

    async createUser(data: CreateUserInput, createdBy: string): Promise<Result<User>> {
        try {
            const user = await this.repository.create(data, createdBy);
            return { success: true, data: user };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create user'
            };
        }
    }

    async updateUser(id: string, data: UpdateUserInput): Promise<Result<User>> {
        try {
            const user = await this.repository.update(id, data);
            return { success: true, data: user };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update user'
            };
        }
    }

    async deactivateUser(id: string): Promise<Result<void>> {
        try {
            await this.repository.delete(id);
            return { success: true, data: undefined };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to deactivate user'
            };
        }
    }
}
