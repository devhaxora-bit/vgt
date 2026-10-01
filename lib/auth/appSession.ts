import { createHash, randomBytes } from 'node:crypto';

import {
    authConfig,
    rememberedSessionTtlSec,
    shortSessionTtlSec,
    slideIntervalMs,
} from '@/config/auth.config';
import { createAdminClient } from '@/utils/supabase/admin';
import { normalizeIp, normalizeUserAgent } from '@/lib/utils/requestMeta';

export const APP_SESSION_COOKIE = authConfig.sessionCookieName;

export type AppSessionProfile = {
    role: string;
    branch_access: string | null;
    branch_code: string | null;
    full_name: string | null;
    employee_code: string | null;
};

export type AppSession = {
    id: string;
    userId: string;
    rememberMe: boolean;
    profile: AppSessionProfile;
};

export type AppSessionLookup =
    | { status: 'valid'; session: AppSession; renewedMaxAgeSec: number | null }
    | { status: 'invalid' }
    | { status: 'error'; message: string };

type SessionRow = {
    id: string;
    user_id: string;
    remember_me: boolean;
    expires_at: string;
    last_seen_at: string;
    revoked_at: string | null;
    users: (AppSessionProfile & { is_active: boolean }) | null;
};

let adminClient: ReturnType<typeof createAdminClient> | null = null;
const admin = () => {
    adminClient ??= createAdminClient();
    return adminClient;
};

export const sessionTtlSec = (rememberMe: boolean) =>
    rememberMe ? rememberedSessionTtlSec() : shortSessionTtlSec();

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Cookie options. Omit maxAge for a browser-session cookie ("Keep me signed in" off). */
export function appSessionCookieOptions(maxAgeSec?: number) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        ...(maxAgeSec ? { maxAge: maxAgeSec } : {}),
    };
}

export async function createAppSession(input: {
    userId: string;
    rememberMe: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
}): Promise<{ token: string; maxAgeSec: number }> {
    const token = randomBytes(32).toString('base64url');
    const maxAgeSec = sessionTtlSec(input.rememberMe);

    const { error } = await admin().from('app_sessions').insert({
        user_id: input.userId,
        token_hash: hashToken(token),
        remember_me: input.rememberMe,
        expires_at: new Date(Date.now() + maxAgeSec * 1000).toISOString(),
        ip_address: normalizeIp(input.ipAddress),
        user_agent: normalizeUserAgent(input.userAgent),
    });

    if (error) throw new Error(`Failed to create session: ${error.message}`);
    return { token, maxAgeSec };
}

/**
 * Resolve a session token. `error` means the DB was unreachable — callers must
 * NOT treat that as signed out.
 */
export async function lookupAppSession(
    token: string,
    options: { slide?: boolean } = {},
): Promise<AppSessionLookup> {
    if (!token) return { status: 'invalid' };

    const { data, error } = await admin()
        .from('app_sessions')
        .select('id, user_id, remember_me, expires_at, last_seen_at, revoked_at, users(role, branch_access, branch_code, full_name, employee_code, is_active)')
        .eq('token_hash', hashToken(token))
        .maybeSingle<SessionRow>();

    if (error) return { status: 'error', message: error.message };
    if (!data || data.revoked_at || !data.users || !data.users.is_active) return { status: 'invalid' };

    const now = Date.now();
    if (new Date(data.expires_at).getTime() <= now) return { status: 'invalid' };

    let renewedMaxAgeSec: number | null = null;
    if (options.slide && now - new Date(data.last_seen_at).getTime() > slideIntervalMs()) {
        const ttl = sessionTtlSec(data.remember_me);
        const { error: slideError } = await admin()
            .from('app_sessions')
            .update({
                last_seen_at: new Date(now).toISOString(),
                expires_at: new Date(now + ttl * 1000).toISOString(),
            })
            .eq('id', data.id);
        if (!slideError) renewedMaxAgeSec = data.remember_me ? ttl : null;
    }

    const { is_active: _isActive, ...profile } = data.users;
    return {
        status: 'valid',
        session: {
            id: data.id,
            userId: data.user_id,
            rememberMe: data.remember_me,
            profile,
        },
        renewedMaxAgeSec,
    };
}

export async function revokeAppSession(token: string): Promise<void> {
    if (!token) return;
    const { error } = await admin()
        .from('app_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', hashToken(token))
        .is('revoked_at', null);
    if (error) throw new Error(`Failed to revoke session: ${error.message}`);
}
