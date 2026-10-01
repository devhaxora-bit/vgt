'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { fetchCurrentUser } from '@/lib/auth/clientAuth';

/**
 * The only client-side place that sends a user to /login.
 * Checks on mount and whenever the tab regains focus; transient errors never log out.
 */
export function SessionGuard() {
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;

        const check = async (fresh: boolean) => {
            const auth = await fetchCurrentUser({ fresh });
            if (!cancelled && auth.status === 'signed_out') {
                router.replace('/login');
            }
        };

        void check(false);

        const onVisible = () => {
            if (document.visibilityState === 'visible') void check(true);
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [router]);

    return null;
}
