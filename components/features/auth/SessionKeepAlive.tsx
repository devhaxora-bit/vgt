'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Keeps the Supabase session alive while the dashboard is open.
 * Hits a server endpoint so cookie Max-Age is rewritten correctly
 * (client-only getSession does not extend SSR cookies).
 */
export function SessionKeepAlive() {
    useEffect(() => {
        const supabase = createClient();
        let cancelled = false;
        let inFlight = false;

        const refresh = async () => {
            if (cancelled || inFlight || document.visibilityState === 'hidden') return;
            inFlight = true;
            try {
                const res = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (res.status === 401) {
                    // One recovery attempt via the browser client before giving up.
                    const { data, error } = await supabase.auth.refreshSession();
                    if (error || !data.session) return;
                    await fetch('/api/auth/refresh', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
            } catch {
                // Ignore transient network errors; next tick will retry.
            } finally {
                inFlight = false;
            }
        };

        void refresh();

        const intervalId = window.setInterval(() => {
            void refresh();
        }, REFRESH_INTERVAL_MS);

        const onVisible = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        };
    }, []);

    return null;
}
