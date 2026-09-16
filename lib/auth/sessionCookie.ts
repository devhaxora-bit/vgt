/** Cookie / session lifetime helpers for Supabase SSR auth. */

/**
 * Match @supabase/ssr DEFAULT_COOKIE_OPTIONS (400 days).
 * Browsers cap near this; shorter Max-Age is a common cause of “random” logouts
 * even when the refresh token is still valid.
 */
export const SESSION_MAX_AGE_REMEMBERED_SEC = 400 * 24 * 60 * 60;

/** Only when the user explicitly turns off “Keep me signed in”. */
export const SESSION_MAX_AGE_SHORT_SEC = 60 * 60 * 24 * 7;

/**
 * Long-term session is the default (Amazon / Flipkart style).
 * Pass `false` only when the user unchecks “Keep me signed in”.
 */
export function sessionCookieMaxAge(rememberMe?: boolean | null): number {
    if (rememberMe === false) return SESSION_MAX_AGE_SHORT_SEC;
    return SESSION_MAX_AGE_REMEMBERED_SEC;
}

export function withSessionCookieOptions<T extends { maxAge?: number; path?: string; sameSite?: string | boolean }>(
    options: T | undefined,
    rememberMe?: boolean | null,
): T & { maxAge: number; path: string } {
    const desired = sessionCookieMaxAge(rememberMe);
    const existing = typeof options?.maxAge === 'number' ? options.maxAge : 0;

    return {
        ...(options || ({} as T)),
        path: options?.path || '/',
        // Never shorten below the library default when staying signed in.
        maxAge: rememberMe === false ? desired : Math.max(existing, desired),
    };
}
