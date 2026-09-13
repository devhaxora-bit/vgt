export type BillCnIncludeInfo = {
    freight_included?: boolean | null;
    parent_cn_no?: string | null;
};

/** Always the original CN number (included rows no longer replace this with INCL). */
export const formatBillCnNo = (cnNo: string, _include?: BillCnIncludeInfo | null): string => {
    const normalizedCn = String(cnNo || '').trim();
    return normalizedCn || '—';
};

/** Rate-column label for CNs whose freight is included in a main CN. */
export const formatBillIncludeRateLabel = (include?: BillCnIncludeInfo | null): string | null => {
    if (include?.freight_included && include.parent_cn_no) {
        const mainCn = String(include.parent_cn_no).trim();
        if (mainCn) return `INCL ${mainCn}`;
    }
    return null;
};

export const isFreightIncludedCn = (include?: BillCnIncludeInfo | null): boolean =>
    Boolean(include?.freight_included && include.parent_cn_no);

/**
 * @deprecated Included CN amounts are now shown (value or 0). Kept for call-site compatibility.
 */
export const shouldBlankIncludedCnAmounts = (_include?: BillCnIncludeInfo | null): boolean =>
    false;
