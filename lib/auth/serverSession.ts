import { cookies } from 'next/headers';

import { APP_SESSION_COOKIE, lookupAppSession, type AppSessionLookup } from '@/lib/auth/appSession';

// One lookup per request even when several helpers ask for the session.
const lookups = new WeakMap<object, Promise<AppSessionLookup>>();

/** Session for the current request (route handlers / server components). */
export async function getServerSession(): Promise<AppSessionLookup> {
    const store = await cookies();
    let lookup = lookups.get(store);
    if (!lookup) {
        const token = store.get(APP_SESSION_COOKIE)?.value;
        lookup = token ? lookupAppSession(token) : Promise.resolve({ status: 'invalid' as const });
        lookups.set(store, lookup);
    }
    return lookup;
}

/** Signed-in user id, or null when signed out / session store unreachable. */
export async function getSessionUser(): Promise<{ id: string } | null> {
    const result = await getServerSession();
    return result.status === 'valid' ? { id: result.session.userId } : null;
}
