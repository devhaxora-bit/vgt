/** Cookie / session lifetime helpers for Supabase SSR auth. */

/** Default stay signed in: 30 days */
export const SESSION_MAX_AGE_REMEMBERED_SEC = 60 * 60 * 24 * 30;

/** Without Remember me: still keep a week so users are not bounced hourly */
export const SESSION_MAX_AGE_DEFAULT_SEC = 60 * 60 * 24 * 7;

export function sessionCookieMaxAge(rememberMe?: boolean | null): number {
    return rememberMe ? SESSION_MAX_AGE_REMEMBERED_SEC : SESSION_MAX_AGE_DEFAULT_SEC;
}

export function withSessionCookieOptions<T extends { maxAge?: number; path?: string; sameSite?: string | boolean }>(
    options: T | undefined,
    rememberMe?: boolean | null,
): T & { maxAge: number; path: string } {
    return {
        ...(options || ({} as T)),
        path: options?.path || '/',
        maxAge: sessionCookieMaxAge(rememberMe),
    };
}
