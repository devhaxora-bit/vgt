import { createHmac } from 'node:crypto';

import { authConfig } from '@/config/auth.config';

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/**
 * Mint a Supabase-compatible access token (HS256, signed with the project JWT secret)
 * so PostgREST applies RLS and `auth.uid()` resolves to this user.
 */
export function mintSupabaseAccessToken(userId: string): string {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set');

    const iat = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({
        iss: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`,
        sub: userId,
        aud: 'authenticated',
        role: 'authenticated',
        iat,
        exp: iat + authConfig.dbAccessTokenTtlSeconds,
        aal: 'aal1',
        is_anonymous: false,
    }));
    const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');

    return `${header}.${payload}.${signature}`;
}
