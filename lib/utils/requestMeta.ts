/** Accept IPv4 / IPv6-ish values only; drop garbage to avoid inet cast failures. */
export const normalizeIp = (value: string | null | undefined): string | null => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) return trimmed;
    if (trimmed.includes(':') && /^[0-9a-fA-F:.]+$/.test(trimmed)) return trimmed;
    return null;
};

export const normalizeUserAgent = (value: string | null | undefined): string | null => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 500);
};

/** First hop of x-forwarded-for, else x-real-ip. */
export const clientIpFromHeaders = (headers: Headers): string | null => {
    const forwardedFor = headers.get('x-forwarded-for');
    return (forwardedFor ? forwardedFor.split(',')[0]?.trim() : null)
        || headers.get('x-real-ip')
        || null;
};
