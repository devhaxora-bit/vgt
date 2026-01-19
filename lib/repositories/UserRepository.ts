import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { User, UserWithAuth, CreateUserInput, UpdateUserInput } from '../types/user.types';

export interface IUserRepository {
    findById(id: string): Promise<User | null>;
    findByEmployeeCode(employeeCode: string): Promise<UserWithAuth | null>;
    findAll(filters?: { role?: string; is_active?: boolean }): Promise<User[]>;
    create(data: CreateUserInput, createdBy: string): Promise<User>;
    update(id: string, data: UpdateUserInput): Promise<User>;
    delete(id: string): Promise<void>;
}

export class UserRepository implements IUserRepository {
    private async getClient() {
        return await createClient();
    }

    async findById(id: string): Promise<User | null> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw new Error(`Failed to find user: ${error.message}`);
        }

        return data;
    }

    async findByEmployeeCode(employeeCode: string): Promise<UserWithAuth | null> {
        const supabase = await this.getClient();

        // First get user profile
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('employee_code', employeeCode)
            .single();

        if (userError) {
            if (userError.code === 'PGRST116') return null;
            throw new Error(`Failed to find user: ${userError.message}`);
        }

        // Map employee codes to emails
        // In production, this should be stored in the users table or retrieved differently
        const emailMap: Record<string, string> = {
            'EMP001': 'admin@vgt.com',
            'EMP002': 'employee@vgt.com',
            'AGT001': 'agent@vgt.com',
        };

        const email = emailMap[user.employee_code] || `${user.employee_code.toLowerCase()}@vgt.com`;
        console.log('✅ Using email for', user.employee_code, ':', email);

        return {
            ...user,
            email,
        };
    }

    async findAll(filters?: { role?: string; is_active?: boolean }): Promise<User[]> {
        const supabase = await this.getClient();
        let query = supabase.from('users').select('*');

        if (filters?.role) {
            query = query.eq('role', filters.role);
        }

        if (filters?.is_active !== undefined) {
            query = query.eq('is_active', filters.is_active);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch users: ${error.message}`);
        }

        return data || [];
    }

    async create(data: CreateUserInput, createdBy: string): Promise<User> {
        const supabase = await this.getClient();
        const adminClient = createAdminClient();

        // Create auth user first (requires admin client)
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
        });

        if (authError || !authData.user) {
            throw new Error(`Failed to create auth user: ${authError?.message}`);
        }

        // Create user profile
        const { data: userData, error: userError } = await supabase
            .from('users')
            .insert({
                id: authData.user.id,
                employee_code: data.employee_code,
                full_name: data.full_name,
                role: data.role,
                department: data.department || null,
                phone: data.phone || null,
                created_by: createdBy,
            })
            .select()
            .single();

        if (userError) {
            // Rollback: delete auth user if profile creation fails (requires admin client)
            await adminClient.auth.admin.deleteUser(authData.user.id);
            throw new Error(`Failed to create user profile: ${userError.message}`);
        }

        return userData;
    }

    async update(id: string, data: UpdateUserInput): Promise<User> {
        const supabase = await this.getClient();
        const { data: userData, error } = await supabase
            .from('users')
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update user: ${error.message}`);
        }

        return userData;
    }

    async delete(id: string): Promise<void> {
        // Soft delete: set is_active to false
        const supabase = await this.getClient();
        const { error } = await supabase
            .from('users')
            .update({ is_active: false })
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to delete user: ${error.message}`);
        }
    }
}
