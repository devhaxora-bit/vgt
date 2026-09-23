export const normalizeCnKey = (value: unknown): string => {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (!/^\d+$/.test(normalized)) return normalized;

    try {
        return BigInt(normalized).toString();
    } catch {
        return normalized;
    }
};
