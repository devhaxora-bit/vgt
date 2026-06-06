export const parseLoadWeightValue = (value: unknown): number => {
    if (value === null || value === undefined) return 0;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed === '---') return 0;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const normalizeLoadUnit = (unit: unknown): string => {
    const normalized = String(unit ?? '').trim().toUpperCase();
    return normalized || 'KG';
};

export type LoadWeightDisplayVariant = 'cn' | 'challan';

/** Format weight for CN or challan PDFs. FTL with no weight shows "FTL"; FTL with weight shows the value. */
export const formatLoadWeightDisplay = (
    weight: unknown,
    unit: unknown,
    variant: LoadWeightDisplayVariant = 'cn'
): string => {
    const loadUnit = normalizeLoadUnit(unit);
    const numericWeight = parseLoadWeightValue(weight);

    if (numericWeight <= 0) {
        if (loadUnit === 'FTL') return 'FTL';
        if (variant === 'challan') return `0 ${loadUnit}`;
        return '---';
    }

    const weightText = String(weight).trim().toUpperCase();

    if (variant === 'challan' || loadUnit === 'FTL') {
        return `${weightText} ${loadUnit}`;
    }

    return `${weightText}${loadUnit}`;
};

export const resolveLoadWeight = (...candidates: unknown[]): unknown => {
    for (const candidate of candidates) {
        if (parseLoadWeightValue(candidate) > 0) return candidate;
    }

    return candidates.find((candidate) => candidate !== null && candidate !== undefined) ?? null;
};
