'use client';

import * as React from 'react';
import { ReceiptText } from 'lucide-react';
import { QueryPageShell } from '@/components/features/query/QueryPageShell';
import { QueryWorkbench } from '@/components/features/query/QueryWorkbench';
import { BillResultSheet } from '@/components/features/query/BillResultSheet';
import { money, fmtDate } from '@/components/features/query/queryFormat';
import type { QuerySuggestion, QueryBillSummary, QueryBillDetail } from '@/lib/types/query.types';

export default function BillQueryPage() {
    const searchSuggestions = React.useCallback(async (term: string): Promise<QuerySuggestion[]> => {
        const res = await fetch(`/api/query/bills?q=${encodeURIComponent(term)}`);
        if (!res.ok) return [];
        const rows = (await res.json()) as QueryBillSummary[];
        return rows.map((row) => ({
            value: row.id,
            primary: row.bill_ref_no || '(no reference)',
            secondary: [row.party_name, fmtDate(row.billing_date)].filter(Boolean).join(' · '),
            trailing: money(row.amount, true),
            raw: row as unknown as Record<string, unknown>,
        }));
    }, []);

    const loadDetail = React.useCallback(async (suggestion: QuerySuggestion): Promise<QueryBillDetail> => {
        const res = await fetch(`/api/query/bills?id=${encodeURIComponent(suggestion.value)}`);
        if (!res.ok) throw new Error('Bill not found.');
        return (await res.json()) as QueryBillDetail;
    }, []);

    return (
        <QueryPageShell
            icon={<ReceiptText className="h-6 w-6" />}
            accentClass="bg-emerald-500/10 text-emerald-600"
            title="Bill Query"
            description="Search a freight bill by reference number or party to review every billed line item."
        >
            <QueryWorkbench
                placeholder="Enter bill number or party name…"
                helperText="Search by bill reference number or the billed party’s name."
                searchSuggestions={searchSuggestions}
                loadDetail={loadDetail}
                renderResult={(detail, { reset }) => <BillResultSheet detail={detail} reset={reset} />}
            />
        </QueryPageShell>
    );
}
