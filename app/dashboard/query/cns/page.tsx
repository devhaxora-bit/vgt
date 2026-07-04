'use client';

import * as React from 'react';
import { FileText } from 'lucide-react';
import { QueryPageShell } from '@/components/features/query/QueryPageShell';
import { QueryWorkbench } from '@/components/features/query/QueryWorkbench';
import { CnsResultSheet } from '@/components/features/query/CnsResultSheet';
import { fmtDate, upper } from '@/components/features/query/queryFormat';
import type { QuerySuggestion, QueryCnsDetail } from '@/lib/types/query.types';

export default function CnsQueryPage() {
    const searchSuggestions = React.useCallback(async (term: string): Promise<QuerySuggestion[]> => {
        const res = await fetch(`/api/consignments/by-cn?search=${encodeURIComponent(term)}`);
        if (!res.ok) return [];
        const rows = (await res.json()) as Array<Record<string, unknown>>;
        return rows.map((row) => ({
            value: String(row.id),
            primary: String(row.cn_no ?? ''),
            secondary: [fmtDate(row.bkg_date as string), upper(row.consignor_name)].filter(Boolean).join(' · '),
            trailing: upper(row.dest_branch) || undefined,
            raw: row,
        }));
    }, []);

    const loadDetail = React.useCallback(async (suggestion: QuerySuggestion): Promise<QueryCnsDetail> => {
        const res = await fetch(`/api/query/cns?id=${encodeURIComponent(suggestion.value)}`);
        if (!res.ok) throw new Error('Consignment not found.');
        return (await res.json()) as QueryCnsDetail;
    }, []);

    return (
        <QueryPageShell
            icon={<FileText className="h-6 w-6" />}
            accentClass="bg-blue-500/10 text-blue-600"
            title="CNS Query"
            description="Search a consignment note number to view its complete details."
        >
            <QueryWorkbench
                placeholder="Enter CNS number…"
                helperText="Start typing a CN number — matching consignments appear as you type."
                searchSuggestions={searchSuggestions}
                loadDetail={loadDetail}
                renderResult={(detail, { reset }) => <CnsResultSheet detail={detail} reset={reset} />}
            />
        </QueryPageShell>
    );
}
