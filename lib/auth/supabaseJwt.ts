import { createHmac } from 'node:crypto';

import { authConfig } from '@/config/auth.config';

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/**
 * Supabase project JWT signing secret (Settings → API → JWT Secret).
 * next dev does NOT load .env.production.local — keep this in .env.local too.
 */
export function resolveJwtSecret(): string {
    const secret =
        process.env.SUPABASE_JWT_SECRET
        || process.env.JWT_SECRET
        || '';
    if (!secret.trim()) {
        throw new Error(
            'SUPABASE_JWT_SECRET is not set. Add it to .env.local (and hosting env). '
            + 'Find it in Supabase Dashboard → Project Settings → API → JWT Secret.',
        );
    }
    return secret.trim();
}

/**
 * Mint a Supabase-compatible access token (HS256, signed with the project JWT secret)
 * so PostgREST applies RLS and `auth.uid()` resolves to this user.
 * Never sent to the browser — minted fresh per request on the server.
 */
export function mintSupabaseAccessToken(userId: string): string {
    const secret = resolveJwtSecret();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
    }

    const iat = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({
        iss: `${supabaseUrl.replace(/\/$/, '')}/auth/v1`,
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
