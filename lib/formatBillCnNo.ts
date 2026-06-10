export type BillCnIncludeInfo = {
    freight_included?: boolean | null;
    parent_cn_no?: string | null;
};

/** Bill/PDF label for CNS numbers when freight is included in a parent CN. */
export const formatBillCnNo = (cnNo: string, include?: BillCnIncludeInfo | null): string => {
    const normalizedCn = String(cnNo || '').trim();
    if (include?.freight_included && include.parent_cn_no) {
        return `INCL ${String(include.parent_cn_no).trim()}`;
    }
    return normalizedCn || '—';
};

export const isFreightIncludedCn = (include?: BillCnIncludeInfo | null): boolean =>
    Boolean(include?.freight_included && include.parent_cn_no);
