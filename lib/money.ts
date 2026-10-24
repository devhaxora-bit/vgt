/**
 * Money helpers for billing, challan, and party ledger.
 *
 * Amounts are stored/shown as whole rupees:
 * - fractional part ≤ 0.50 → round down (e.g. 567.49 → 567, 567.50 → 567)
 * - fractional part > 0.50 → round up (e.g. 567.55 → 568)
 */

export const parseMoney = (value: unknown): number => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Round to nearest rupee with half-down: ≤ .50 goes lower, > .50 goes higher.
 * Uses paise (×100) to avoid floating-point edge cases.
 */
export const roundMoney = (value: number): number => {
    if (!Number.isFinite(value)) return 0;

    const sign = value < 0 ? -1 : 1;
    const paise = Math.round(Math.abs(value) * 100);
    const rupees = Math.floor(paise / 100);
    const rem = paise % 100;

    return sign * (rem > 50 ? rupees + 1 : rupees);
};
