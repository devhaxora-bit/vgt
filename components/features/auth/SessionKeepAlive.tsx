'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

/**
 * Quietly refreshes the Supabase session while the dashboard is open so
 * short-lived access tokens do not force another login mid-shift.
 */
export function SessionKeepAlive() {
    useEffect(() => {
        const supabase = createClient();
        let cancelled = false;

        const refresh = async () => {
            if (cancelled || document.visibilityState === 'hidden') return;
            try {
                await supabase.auth.getSession();
            } catch {
                // Ignore transient network errors; next tick will retry.
            }
        };

        void refresh();

        const intervalId = window.setInterval(() => {
            void refresh();
        }, 10 * 60 * 1000);

        const onVisible = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    return null;
}
