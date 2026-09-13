/** Cookie / session lifetime helpers for Supabase SSR auth. */

/** Default long-term stay signed in: 30 days */
export const SESSION_MAX_AGE_REMEMBERED_SEC = 60 * 60 * 24 * 30;

/** Shorter window only when user explicitly turns off "Keep me signed in" */
export const SESSION_MAX_AGE_SHORT_SEC = 60 * 60 * 24 * 7;

/**
 * Long-term session is the default.
 * Pass `false` only when the user unchecks "Keep me signed in".
 */
export function sessionCookieMaxAge(rememberMe?: boolean | null): number {
    if (rememberMe === false) return SESSION_MAX_AGE_SHORT_SEC;
    return SESSION_MAX_AGE_REMEMBERED_SEC;
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
