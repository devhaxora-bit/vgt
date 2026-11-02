/**
 * PostgREST / Supabase API caps rows (often 1000). Page through `.range()` until exhausted.
 */
export const SUPABASE_PAGE_SIZE = 1000;

type RangeQueryResult<T> = {
    data: T[] | null;
    error: { message: string } | null;
};

type RangeQuery<T> = {
    range: (from: number, to: number) => PromiseLike<RangeQueryResult<T>> | RangeQueryResult<T>;
};

export async function fetchAllRows<T>(
    buildQuery: () => RangeQuery<T>,
    pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<{ data: T[]; error: string | null }> {
    const all: T[] = [];
    let from = 0;

    while (true) {
        const { data, error } = await buildQuery().range(from, from + pageSize - 1);
        if (error) {
            return { data: all, error: error.message };
        }

        const rows = data || [];
        all.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
    }

    return { data: all, error: null };
}
