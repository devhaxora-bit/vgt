export type CurrentUser = {
    id: string;
    full_name: string;
    employee_code: string;
    role: string;
    branch_access: string | null;
    branch_code: string | null;
    branch_name: string | null;
};

export type ClientAuthState =
    | { status: 'signed_in'; user: CurrentUser }
    | { status: 'signed_out' }
    | { status: 'error' };

/** Components mounting together share one /api/auth/me request. */
const SHARE_WINDOW_MS = 5_000;
let shared: { at: number; promise: Promise<ClientAuthState> } | null = null;

async function requestCurrentUser(): Promise<ClientAuthState> {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        if (res.status === 401) return { status: 'signed_out' };
        if (!res.ok) return { status: 'error' };

        const json = await res.json() as { data?: CurrentUser | null };
        return json.data ? { status: 'signed_in', user: json.data } : { status: 'signed_out' };
    } catch {
        return { status: 'error' };
    }
}

/**
 * Current user for client components (the session cookie is httpOnly, so ask the server).
 * Only `SessionGuard` acts on `signed_out`; pages should just skip work when not signed in.
 */
export function fetchCurrentUser(options: { fresh?: boolean } = {}): Promise<ClientAuthState> {
    const now = Date.now();
    if (!options.fresh && shared && now - shared.at < SHARE_WINDOW_MS) {
        return shared.promise;
    }
    const promise = requestCurrentUser();
    shared = { at: now, promise };
    return promise;
}
