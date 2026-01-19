import { createClient } from '@/utils/supabase/server';
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
            const user = await this.userRepository.findByEmployeeCode(credentials.employee_code);

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

            // Authenticate with Supabase
            console.log('🔐 Attempting to sign in with email:', user.email);
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: credentials.password,
            });

            if (authError || !authData.session) {
                console.error('❌ Sign in failed:', authError?.message || 'No session returned');
                return { success: false, error: 'Invalid employee code or password' };
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
