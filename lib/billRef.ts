const BILL_REF_BRANCH_PREFIX = 'VZM';

const getFinancialYearRange = (value?: string | null) => {
    const parsed = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const year = safeDate.getFullYear();
    const month = safeDate.getMonth();

    if (month >= 3) {
        return {
            startYear: year,
            endYear: year + 1,
        };
    }

    return {
        startYear: year - 1,
        endYear: year,
    };
};

const toShortYear = (year: number) => String(year).slice(-2);

export const getBillRefFinancialYearLabel = (value?: string | null) => {
    const { startYear, endYear } = getFinancialYearRange(value);
    return `${toShortYear(startYear)}-${toShortYear(endYear)}`;
};

export const getBillRefPrefix = (value?: string | null) =>
    `${BILL_REF_BRANCH_PREFIX}/${getBillRefFinancialYearLabel(value)}/`;

export const splitBillRefSuffix = (billRefNo?: string | null, value?: string | null) => {
    const normalizedBillRefNo = String(billRefNo || '').trim();
    if (!normalizedBillRefNo) return '';

    const prefix = getBillRefPrefix(value);
    if (normalizedBillRefNo.toUpperCase().startsWith(prefix.toUpperCase())) {
        return normalizedBillRefNo.slice(prefix.length).trim();
    }

    return normalizedBillRefNo;
};

export const composeBillRefNo = (value: string | null | undefined, suffix: string | null | undefined) => {
    const normalizedSuffix = String(suffix || '').trim();
    if (!normalizedSuffix) return '';
    return `${getBillRefPrefix(value)}${normalizedSuffix}`;
};
