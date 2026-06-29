const numberFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const toNum = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

/** Currency-like display; returns em dash for empty/zero unless keepZero. */
export const money = (value: unknown, keepZero = false): string => {
    const n = toNum(value);
    if (!keepZero && Math.abs(n) < 0.005) return '—';
    return `₹${numberFmt.format(n)}`;
};

export const num = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—';
    return numberFmt.format(toNum(value));
};

export const upper = (value: unknown): string => {
    const text = String(value ?? '').trim();
    return text ? text.toUpperCase() : '';
};

export const fmtDate = (value?: string | null): string => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${parsed.getFullYear()}`;
};
