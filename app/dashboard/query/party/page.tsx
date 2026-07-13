'use client';

import * as React from 'react';
import { Building2 } from 'lucide-react';
import { QueryPageShell } from '@/components/features/query/QueryPageShell';
import { QueryWorkbench } from '@/components/features/query/QueryWorkbench';
import { PartyResultSheet } from '@/components/features/query/PartyResultSheet';
import { money } from '@/components/features/query/queryFormat';
import type { QuerySuggestion, QueryPartySummaryRow, QueryPartyDetail } from '@/lib/types/query.types';

export default function PartyQueryPage() {
    const searchSuggestions = React.useCallback(async (term: string): Promise<QuerySuggestion[]> => {
        const res = await fetch(`/api/query/parties?q=${encodeURIComponent(term)}`);
        if (!res.ok) return [];
        const rows = (await res.json()) as QueryPartySummaryRow[];
        return rows.map((row) => ({
            value: row.id,
            primary: row.name,
            secondary: [row.code, row.gstin, row.branch_name || row.branch_code].filter(Boolean).join(' · '),
            trailing: money(row.outstanding, true),
            raw: row as unknown as Record<string, unknown>,
        }));
    }, []);

    const loadDetail = React.useCallback(async (suggestion: QuerySuggestion): Promise<QueryPartyDetail> => {
        const res = await fetch(`/api/query/parties?id=${encodeURIComponent(suggestion.value)}`);
        if (!res.ok) throw new Error('Party not found.');
        return (await res.json()) as QueryPartyDetail;
    }, []);

    return (
        <QueryPageShell
            icon={<Building2 className="h-6 w-6" />}
            accentClass="bg-sky-500/10 text-sky-600"
            title="Party Query"
            description="Search a party by name, code, or GSTIN to review bills, payments, dues, consignments, and related challans."
        >
            <QueryWorkbench
                placeholder="Enter party name, code, or GSTIN…"
                helperText="Start typing a party name to see matches, then open the full ledger snapshot."
                searchSuggestions={searchSuggestions}
                loadDetail={loadDetail}
                renderResult={(detail, { reset }) => <PartyResultSheet detail={detail} reset={reset} />}
            />
        </QueryPageShell>
    );
}
