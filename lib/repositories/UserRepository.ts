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
        // Service role: profile bootstrap must not depend on users RLS self-select.
        const adminClient = createAdminClient();
        const { data, error } = await adminClient
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to find user: ${error.message}`);
        }

        return data;
    }

    async findByEmployeeCode(employeeCode: string): Promise<UserWithAuth | null> {
        const supabase = await this.getClient();
        const adminClient = createAdminClient();

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('employee_code', employeeCode)
            .single();

        if (userError) {
            if (userError.code === 'PGRST116') return null;
            throw new Error(`Failed to find user: ${userError.message}`);
        }

        // Prefer real auth email so login works for admin-created users.
        // Do NOT guess email when no auth row exists for this profile id —
        // that can sign into a different auth user and cause "User profile not found".
        const { data: authData, error: authLookupError } = await adminClient.auth.admin.getUserById(user.id);
        if (authLookupError || !authData.user?.email) {
            return {
                ...user,
                email: '',
            };
        }

        return {
            ...user,
            email: authData.user.email,
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
        const adminClient = createAdminClient();

        // Auth insert fires handle_new_user() which creates a placeholder profile row
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: {
                full_name: data.full_name,
                employee_code: data.employee_code,
                role: data.role,
            },
        });

        if (authError || !authData.user) {
            throw new Error(`Failed to create auth user: ${authError?.message}`);
        }

        const branchAccess = (data.branch_access || 'global') as string;
        let branchCode: string | null = null;

        if (branchAccess !== 'global') {
            const raw = String(data.branch_code || '').trim().toUpperCase();
            // Guard against sentinel / empty values that would break the FK
            if (!raw || raw === '__GLOBAL__' || raw === '__NONE__') {
                await adminClient.auth.admin.deleteUser(authData.user.id);
                throw new Error('A valid branch is required for Main / Branch Only users');
            }

            const { data: branchRow, error: branchError } = await adminClient
                .from('branches')
                .select('code')
                .ilike('code', raw)
                .maybeSingle();

            if (branchError || !branchRow) {
                await adminClient.auth.admin.deleteUser(authData.user.id);
                throw new Error(
                    `Branch "${raw}" was not found. Pick an existing branch and try again.`,
                );
            }

            branchCode = branchRow.code;
        }

        // Update the trigger-created row with real employee details
        const { data: userData, error: userError } = await adminClient
            .from('users')
            .update({
                employee_code: data.employee_code,
                full_name: data.full_name,
                role: data.role,
                department: data.department || null,
                phone: data.phone || null,
                branch_access: branchAccess,
                branch_code: branchCode,
                created_by: createdBy,
                is_active: true,
            })
            .eq('id', authData.user.id)
            .select()
            .single();

        if (userError) {
            await adminClient.auth.admin.deleteUser(authData.user.id);
            throw new Error(`Failed to create user profile: ${userError.message}`);
        }

        return userData;
    }

    async update(id: string, data: UpdateUserInput): Promise<User> {
        const supabase = await this.getClient();
        const adminClient = createAdminClient();

        const patch: UpdateUserInput = { ...data };

        if (patch.branch_access === 'global') {
            patch.branch_code = null;
        } else if (patch.branch_code !== undefined && patch.branch_code !== null) {
            const raw = String(patch.branch_code).trim().toUpperCase();
            if (!raw || raw === '__GLOBAL__' || raw === '__NONE__') {
                throw new Error('A valid branch is required for Main / Branch Only users');
            }

            const { data: branchRow, error: branchError } = await adminClient
                .from('branches')
                .select('code')
                .ilike('code', raw)
                .maybeSingle();

            if (branchError || !branchRow) {
                throw new Error(`Branch "${raw}" was not found. Pick an existing branch and try again.`);
            }

            patch.branch_code = branchRow.code;
        }

        const { data: userData, error } = await supabase
            .from('users')
            .update(patch)
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
