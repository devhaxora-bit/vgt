import { formatLoadWeightDisplay, normalizeLoadUnit, resolveLoadWeight } from '@/lib/loadWeightDisplay';

const parseMoney = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const fmtRate = (value: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);

/** Fixed lump-sum freight: no per-unit rate but basic freight is set. */
export const isFixedFreightRate = (freightRate?: unknown, basicFreight?: unknown) =>
    parseMoney(freightRate) === 0 && parseMoney(basicFreight) > 0;

/** Charge weight cell for party bill PDF — FTL shows "FTL", MT/KG show weight + unit. */
export const formatBillChargeWeight = (
    chargedWeight?: unknown,
    actualWeight?: unknown,
    loadUnit?: unknown,
): string | null => {
    const display = formatLoadWeightDisplay(
        resolveLoadWeight(chargedWeight, actualWeight),
        loadUnit,
        'cn',
    );
    return display === '---' ? null : display;
};

/** Rate cell for party bill PDF — FIXED, FTL, or numeric per-unit rate. */
export const formatBillRateDisplay = (input: {
    freightRate?: unknown;
    basicFreight?: unknown;
    loadUnit?: unknown;
    isFixedRate?: boolean;
}): string => {
    if (input.isFixedRate || isFixedFreightRate(input.freightRate, input.basicFreight)) {
        return 'FIXED';
    }

    if (normalizeLoadUnit(input.loadUnit) === 'FTL') {
        return 'FTL';
    }

    const rate = parseMoney(input.freightRate);
    return rate > 0 ? fmtRate(rate) : '';
};

export const resolveBillChargeWeightDisplay = (row: {
    charge_wt?: string | null;
    charged_weight?: number | string | null;
    actual_weight?: number | string | null;
    load_unit?: string | null;
}): string =>
    formatBillChargeWeight(row.charged_weight, row.actual_weight, row.load_unit)
    || row.charge_wt
    || '—';

export const resolveBillRateDisplay = (row: {
    freight_rate?: number;
    basic_freight?: number | string | null;
    load_unit?: string | null;
    is_fixed_rate?: boolean;
}, emptyFallback = '—'): string => {
    const display = formatBillRateDisplay({
        freightRate: row.freight_rate,
        basicFreight: row.basic_freight,
        loadUnit: row.load_unit,
        isFixedRate: row.is_fixed_rate,
    });
    return display || emptyFallback;
};
