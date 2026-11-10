import { normalizeCnKey } from '@/lib/utils/cnKey';

/** Typed range / note values (e.g. "LR 8084 TO 5158") are not real CN numbers. */
export const isPlaceholderCoveredCn = (cnNo: unknown): boolean => {
    const trimmed = String(cnNo ?? '').trim();
    if (!trimmed) return true;
    return /\s/.test(trimmed);
};

export const makeInvalidCoveredCnStub = (cnNo: string) => {
    const trimmed = String(cnNo || '').trim();
    return {
        id: `invalid-cn:${normalizeCnKey(trimmed) || trimmed}`,
        cn_no: trimmed,
        invoice_no: trimmed,
        bkg_date: '',
        booking_branch: '',
        dest_branch: '',
        loading_point: '',
        delivery_point: '',
        no_of_pkg: 0,
        actual_weight: 0,
        charged_weight: 0,
        load_unit: '',
        total_freight: 0,
        bkg_basis: '',
        cancel_cn: false,
        _ghost: true as const,
        _invalid: true as const,
    };
};
