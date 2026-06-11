export type LinkedCnSortField =
    | 'cn_no'
    | 'bkg_date'
    | 'consignor_name'
    | 'goods_desc'
    | 'weight'
    | 'destination'
    | 'packages';

/** Compare document numbers sequentially (branch prefix, then numeric suffix). */
export function compareCnNo(a: string, b: string): number {
    const na = String(a || '').trim().toUpperCase();
    const nb = String(b || '').trim().toUpperCase();

    if (na === nb) return 0;

    // Pure numeric values (common CN / challan numbers in this app)
    if (/^\d+$/.test(na) && /^\d+$/.test(nb)) {
        const lenDiff = na.length - nb.length;
        if (lenDiff !== 0) return lenDiff;
        const diff = Number(na) - Number(nb);
        if (diff !== 0) return diff;
    }

    const numA = na.match(/(\d+)$/);
    const numB = nb.match(/(\d+)$/);
    const prefixA = numA ? na.slice(0, -numA[1].length) : na;
    const prefixB = numB ? nb.slice(0, -numB[1].length) : nb;

    if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
    if (numA && numB) {
        const lenDiff = numA[1].length - numB[1].length;
        if (lenDiff !== 0) return lenDiff;
        const diff = Number(numA[1]) - Number(numB[1]);
        if (diff !== 0) return diff;
    }
    return na.localeCompare(nb);
}

function getSortValue(item: Record<string, unknown>, field: LinkedCnSortField): string | number {
    switch (field) {
        case 'cn_no':
            return String(item.cn_no || '');
        case 'bkg_date':
            return String(item.bkg_date || '');
        case 'consignor_name':
            return String(item.consignor_name || '').toLowerCase();
        case 'goods_desc':
            return String(item.goods_desc || item.goods_class || '').toLowerCase();
        case 'weight':
            return Number(item.charged_weight ?? item.actual_weight ?? 0);
        case 'destination':
            return String(item.delivery_point || item.dest_branch || '').toLowerCase();
        case 'packages': {
            const pkgs = item.packages;
            if (Array.isArray(pkgs) && pkgs.length > 0) {
                return pkgs.reduce((sum: number, p: { qty?: number }) => sum + (Number(p.qty) || 0), 0);
            }
            return Number(item.no_of_pkg ?? item.total_qty ?? 0);
        }
        default:
            return '';
    }
}

/** Append items and return a new array sorted by field/direction. */
export function mergeSortedLinkedConsignments<T>(
    existing: T[],
    incoming: T[],
    field: LinkedCnSortField = 'cn_no',
    direction: 'asc' | 'desc' = 'asc'
): T[] {
    return sortLinkedConsignments([...existing, ...incoming], field, direction);
}

export function sortLinkedConsignments<T>(
    items: T[],
    field: LinkedCnSortField = 'cn_no',
    direction: 'asc' | 'desc' = 'asc'
): T[] {
    const sorted = [...items].sort((a, b) => {
        const recA = a as Record<string, unknown>;
        const recB = b as Record<string, unknown>;

        if (field === 'cn_no') {
            const cmp = compareCnNo(String(recA.cn_no || ''), String(recB.cn_no || ''));
            return direction === 'asc' ? cmp : -cmp;
        }

        const va = getSortValue(recA, field);
        const vb = getSortValue(recB, field);

        if (typeof va === 'number' && typeof vb === 'number') {
            return direction === 'asc' ? va - vb : vb - va;
        }

        const sa = String(va);
        const sb = String(vb);
        const cmp = sa.localeCompare(sb);
        return direction === 'asc' ? cmp : -cmp;
    });

    return sorted;
}
