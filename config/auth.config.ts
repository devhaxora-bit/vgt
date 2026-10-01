/**
 * Single source of truth for login session behaviour.
 *
 * Sessions are owned by the app (table `app_sessions` + httpOnly cookie), not by
 * Supabase Auth, so these values work on any Supabase plan. Supabase is only used
 * to verify the password at login.
 *
 * Each value can be overridden with the env var named next to it (no code change).
 */

const DAY_SEC = 24 * 60 * 60;

const positiveNumber = (raw: string | undefined, fallback: number) => {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const authConfig = {
    /** Cookie that holds the opaque session token. */
    sessionCookieName: 'vgt_session',

    /**
     * "Keep me signed in" ON (default). Sliding: every visit pushes expiry forward,
     * so a user is only logged out after this many days of NOT using the app.
     * Env: AUTH_SESSION_DAYS
     */
    rememberedSessionDays: positiveNumber(process.env.AUTH_SESSION_DAYS, 180),

    /**
     * "Keep me signed in" OFF. Cookie also ends when the browser closes.
     * Env: AUTH_SHORT_SESSION_DAYS
     */
    shortSessionDays: positiveNumber(process.env.AUTH_SHORT_SESSION_DAYS, 7),

    /**
     * How often (minutes) the expiry is extended. Avoids a DB write on every request.
     * Env: AUTH_SESSION_SLIDE_MINUTES
     */
    slideIntervalMinutes: positiveNumber(process.env.AUTH_SESSION_SLIDE_MINUTES, 60),

    /**
     * Lifetime (seconds) of the internal DB access token minted per request for RLS.
     * Never sent to the browser and never refreshed — a new one is minted each request.
     * Env: AUTH_DB_TOKEN_TTL_SECONDS
     */
    dbAccessTokenTtlSeconds: positiveNumber(process.env.AUTH_DB_TOKEN_TTL_SECONDS, 600),
} as const;

export const rememberedSessionTtlSec = () => authConfig.rememberedSessionDays * DAY_SEC;
export const shortSessionTtlSec = () => authConfig.shortSessionDays * DAY_SEC;
export const slideIntervalMs = () => authConfig.slideIntervalMinutes * 60 * 1000;
