import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { LoginInput, LoginResponse, Result, UserWithAuth } from '../../types/user.types';
import type { IUserRepository } from '../../repositories/UserRepository';

export interface IAuthService {
    login(credentials: LoginInput): Promise<Result<LoginResponse>>;
    logout(): Promise<Result<void>>;
    getCurrentUser(): Promise<Result<UserWithAuth | null>>;
}

export class AuthService implements IAuthService {
    constructor(private userRepository: IUserRepository) { }

    async login(credentials: LoginInput): Promise<Result<LoginResponse>> {
        try {
            const supabase = await createClient();

            // Find user by employee code
            const user = await this.userRepository.findByEmployeeCode(
                String(credentials.employee_code || '').trim().toUpperCase(),
            );

            if (!user) {
                return { success: false, error: 'Invalid employee code or password' };
            }

            // Verify role matches
            if (user.role !== credentials.role) {
                return { success: false, error: 'Invalid role selected' };
            }

            // Check if user is active
            if (!user.is_active) {
                return { success: false, error: 'Account is deactivated. Contact administrator.' };
            }

            // Authenticate with Supabase — must use the auth account linked to this profile id
            const adminClient = createAdminClient();
            const { data: linkedAuth, error: linkedAuthError } = await adminClient.auth.admin.getUserById(user.id);

            if (linkedAuthError || !linkedAuth.user?.email) {
                console.error('❌ Profile has no linked auth user:', user.employee_code, user.id, linkedAuthError?.message);
                return {
                    success: false,
                    error: 'Login is not linked for this employee. Ask an admin to repair the account.',
                };
            }

            console.log('🔐 Attempting to sign in with email:', linkedAuth.user.email);
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: linkedAuth.user.email,
                password: credentials.password,
            });

            if (authError || !authData.session || !authData.user) {
                console.error('❌ Sign in failed:', authError?.message || 'No session returned');
                return { success: false, error: 'Invalid employee code or password' };
            }

            // Guard against rare email→different-uuid mismatches
            if (authData.user.id !== user.id) {
                console.error('❌ Auth/profile id mismatch:', {
                    employee_code: user.employee_code,
                    profileId: user.id,
                    authId: authData.user.id,
                });
                await supabase.auth.signOut();
                return {
                    success: false,
                    error: 'Account is misconfigured (auth/profile mismatch). Ask an admin to repair the account.',
                };
            }

            // Create session record
            await supabase.from('user_sessions').insert({
                user_id: user.id,
                login_at: new Date().toISOString(),
            });

            return {
                success: true,
                data: {
                    user,
                    session: {
                        access_token: authData.session.access_token,
                        refresh_token: authData.session.refresh_token,
                    },
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Login failed',
            };
        }
    }

    async logout(): Promise<Result<void>> {
        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // Update session record
                await supabase
                    .from('user_sessions')
                    .update({ logout_at: new Date().toISOString() })
                    .eq('user_id', user.id)
                    .is('logout_at', null);
            }

            await supabase.auth.signOut();
            return { success: true, data: undefined };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Logout failed',
            };
        }
    }

    async getCurrentUser(): Promise<Result<UserWithAuth | null>> {
        try {
            const supabase = await createClient();
            const { data: { user: authUser } } = await supabase.auth.getUser();

            if (!authUser) {
                return { success: true, data: null };
            }

            const user = await this.userRepository.findById(authUser.id);

            if (!user) {
                return { success: true, data: null };
            }

            return {
                success: true,
                data: {
                    ...user,
                    email: authUser.email || '',
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get current user',
            };
        }
    }
}
