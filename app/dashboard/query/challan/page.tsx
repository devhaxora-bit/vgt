'use client';

import * as React from 'react';
import { ClipboardList } from 'lucide-react';
import { QueryPageShell } from '@/components/features/query/QueryPageShell';
import { QueryWorkbench } from '@/components/features/query/QueryWorkbench';
import { ChallanResultSheet } from '@/components/features/query/ChallanResultSheet';
import { fmtDate, upper } from '@/components/features/query/queryFormat';
import type { QuerySuggestion, QueryChallanDetail } from '@/lib/types/query.types';

export default function ChallanQueryPage() {
    const searchSuggestions = React.useCallback(async (term: string): Promise<QuerySuggestion[]> => {
        const res = await fetch(`/api/challans?search=${encodeURIComponent(term)}`);
        if (!res.ok) return [];
        const rows = (await res.json()) as Array<Record<string, unknown>>;
        return rows.slice(0, 20).map((row) => ({
            value: String(row.id),
            primary: String(row.challan_no ?? ''),
            secondary: [fmtDate(row.date_from as string), upper(row.vehicle_no)].filter(Boolean).join(' · '),
            trailing: upper(row.status) || undefined,
            raw: row,
        }));
    }, []);

    const loadDetail = React.useCallback(async (suggestion: QuerySuggestion): Promise<QueryChallanDetail> => {
        const res = await fetch(`/api/query/challan?id=${encodeURIComponent(suggestion.value)}`);
        if (!res.ok) throw new Error('Challan not found.');
        return (await res.json()) as QueryChallanDetail;
    }, []);

    return (
        <QueryPageShell
            icon={<ClipboardList className="h-6 w-6" />}
            accentClass="bg-violet-500/10 text-violet-600"
            title="Challan Query"
            description="Search a lorry challan number to view its vehicle, broker and linked consignments."
        >
            <QueryWorkbench
                placeholder="Enter challan number or vehicle no…"
                helperText="Search by challan number or vehicle number."
                searchSuggestions={searchSuggestions}
                loadDetail={loadDetail}
                renderResult={(detail, { reset }) => <ChallanResultSheet detail={detail} reset={reset} />}
            />
        </QueryPageShell>
    );
}
