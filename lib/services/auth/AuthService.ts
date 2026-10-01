import { createAdminClient } from '@/utils/supabase/admin';
import { createAuthClient } from '@/utils/supabase/authClient';
import { lookupAppSession, revokeAppSession } from '@/lib/auth/appSession';
import { getSessionUser } from '@/lib/auth/serverSession';
import { normalizeIp, normalizeUserAgent } from '@/lib/utils/requestMeta';
import type { LoginInput, LoginResponse, Result, User } from '../../types/user.types';
import type { IUserRepository } from '../../repositories/UserRepository';

export type LoginRequestMeta = {
    ipAddress?: string | null;
    userAgent?: string | null;
};

export interface IAuthService {
    login(credentials: LoginInput, meta?: LoginRequestMeta): Promise<Result<LoginResponse>>;
    logout(sessionToken: string | null): Promise<Result<void>>;
    getCurrentUser(): Promise<Result<User | null>>;
}

export class AuthService implements IAuthService {
    constructor(private userRepository: IUserRepository) { }

    private async recordLoginAttempt(input: {
        employeeCode: string | null;
        role: string | null;
        success: boolean;
        failureReason?: string | null;
        userId?: string | null;
        meta?: LoginRequestMeta;
    }): Promise<void> {
        try {
            const adminClient = createAdminClient();
            const { error } = await adminClient.from('auth_login_attempts').insert({
                employee_code: input.employeeCode,
                role: input.role,
                success: input.success,
                failure_reason: input.failureReason || null,
                user_id: input.userId || null,
                ip_address: normalizeIp(input.meta?.ipAddress),
                user_agent: normalizeUserAgent(input.meta?.userAgent),
            });
            if (error) {
                console.warn('Failed to record login attempt:', error.message);
            }
        } catch (error) {
            console.warn('Failed to record login attempt:', error);
        }
    }

    async login(credentials: LoginInput, meta?: LoginRequestMeta): Promise<Result<LoginResponse>> {
        const employeeCode = String(credentials.employee_code || '').trim().toUpperCase();
        const role = String(credentials.role || '').trim();

        try {
            // Find user by employee code
            const user = await this.userRepository.findByEmployeeCode(employeeCode);

            if (!user) {
                await this.recordLoginAttempt({
                    employeeCode,
                    role,
                    success: false,
                    failureReason: 'unknown_employee_code',
                    meta,
                });
                return { success: false, error: 'Invalid employee code or password' };
            }

            // Verify role matches
            if (user.role !== credentials.role) {
                await this.recordLoginAttempt({
                    employeeCode,
                    role,
                    success: false,
                    failureReason: 'role_mismatch',
                    userId: user.id,
                    meta,
                });
                return { success: false, error: 'Invalid role selected' };
            }

            // Check if user is active
            if (!user.is_active) {
                await this.recordLoginAttempt({
                    employeeCode,
                    role,
                    success: false,
                    failureReason: 'account_deactivated',
                    userId: user.id,
                    meta,
                });
                return { success: false, error: 'Account is deactivated. Contact administrator.' };
            }

            // Authenticate with Supabase — must use the auth account linked to this profile id
            const adminClient = createAdminClient();
            const { data: linkedAuth, error: linkedAuthError } = await adminClient.auth.admin.getUserById(user.id);

            if (linkedAuthError || !linkedAuth.user?.email) {
                console.error('❌ Profile has no linked auth user:', user.employee_code, user.id, linkedAuthError?.message);
                await this.recordLoginAttempt({
                    employeeCode,
                    role,
                    success: false,
                    failureReason: 'auth_not_linked',
                    userId: user.id,
                    meta,
                });
                return {
                    success: false,
                    error: 'Login is not linked for this employee. Ask an admin to repair the account.',
                };
            }

            // Ephemeral client: do not write cookies here — login route setSession owns that.
            const authClient = createAuthClient();
            console.log('🔐 Attempting to sign in with email:', linkedAuth.user.email);
            const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
                email: linkedAuth.user.email,
                password: credentials.password,
            });

            if (authError || !authData.session || !authData.user) {
                console.error('❌ Sign in failed:', authError?.message || 'No session returned');
                await this.recordLoginAttempt({
                    employeeCode,
                    role,
                    success: false,
                    failureReason: 'invalid_password',
                    userId: user.id,
                    meta,
                });
                return { success: false, error: 'Invalid employee code or password' };
            }

            // Guard against rare email→different-uuid mismatches
            if (authData.user.id !== user.id) {
                console.error('❌ Auth/profile id mismatch:', {
                    employee_code: user.employee_code,
                    profileId: user.id,
                    authId: authData.user.id,
                });
                await this.recordLoginAttempt({
                    employeeCode,
                    role,
                    success: false,
                    failureReason: 'auth_profile_mismatch',
                    userId: user.id,
                    meta,
                });
                return {
                    success: false,
                    error: 'Account is misconfigured (auth/profile mismatch). Ask an admin to repair the account.',
                };
            }

            // Audit row (service role — avoids depending on request cookies during login)
            {
                const { error: sessionInsertError } = await adminClient.from('user_sessions').insert({
                    user_id: user.id,
                    login_at: new Date().toISOString(),
                    ip_address: normalizeIp(meta?.ipAddress),
                    user_agent: normalizeUserAgent(meta?.userAgent),
                });
                if (sessionInsertError) {
                    console.warn('Failed to write user_sessions row:', sessionInsertError.message);
                }
            }

            await this.recordLoginAttempt({
                employeeCode,
                role,
                success: true,
                userId: user.id,
                meta,
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
            await this.recordLoginAttempt({
                employeeCode,
                role,
                success: false,
                failureReason: 'login_exception',
                meta,
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Login failed',
            };
        }
    }

    /** Revokes only this browser's session; other devices stay signed in. */
    async logout(sessionToken: string | null): Promise<Result<void>> {
        try {
            if (!sessionToken) return { success: true, data: undefined };

            const lookup = await lookupAppSession(sessionToken);
            await revokeAppSession(sessionToken);

            if (lookup.status === 'valid') {
                const { error } = await createAdminClient()
                    .from('user_sessions')
                    .update({ logout_at: new Date().toISOString() })
                    .eq('user_id', lookup.session.userId)
                    .is('logout_at', null);
                if (error) console.warn('Failed to close user_sessions row:', error.message);
            }

            return { success: true, data: undefined };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Logout failed',
            };
        }
    }

    async getCurrentUser(): Promise<Result<User | null>> {
        try {
            const sessionUser = await getSessionUser();
            if (!sessionUser) {
                return { success: true, data: null };
            }

            const user = await this.userRepository.findById(sessionUser.id);
            return { success: true, data: user };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get current user',
            };
        }
    }
}
