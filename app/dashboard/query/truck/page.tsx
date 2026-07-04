'use client';

import * as React from 'react';
import { Truck } from 'lucide-react';
import { QueryPageShell } from '@/components/features/query/QueryPageShell';
import { QueryWorkbench } from '@/components/features/query/QueryWorkbench';
import { TruckResultSheet } from '@/components/features/query/TruckResultSheet';
import { upper } from '@/components/features/query/queryFormat';
import type { QuerySuggestion, QueryTruckDetail } from '@/lib/types/query.types';

export default function TruckQueryPage() {
    const searchSuggestions = React.useCallback(async (term: string): Promise<QuerySuggestion[]> => {
        const res = await fetch(`/api/vehicles?q=${encodeURIComponent(term)}`);
        if (!res.ok) return [];
        const rows = (await res.json()) as Array<Record<string, unknown>>;
        return rows.slice(0, 20).map((row) => ({
            value: String(row.vehicle_no),
            primary: String(row.vehicle_no ?? ''),
            secondary: [upper(row.owner_name), upper(row.vehicle_type)].filter(Boolean).join(' · ') || undefined,
            raw: row,
        }));
    }, []);

    const loadDetail = React.useCallback(async (suggestion: QuerySuggestion): Promise<QueryTruckDetail> => {
        const res = await fetch(`/api/query/truck?no=${encodeURIComponent(suggestion.value)}`);
        if (!res.ok) throw new Error('Unable to load truck records.');
        return (await res.json()) as QueryTruckDetail;
    }, []);

    return (
        <QueryPageShell
            icon={<Truck className="h-6 w-6" />}
            accentClass="bg-amber-500/10 text-amber-600"
            title="Truck Query"
            description="Enter a vehicle number to view its master record and full movement history."
        >
            <QueryWorkbench
                placeholder="Enter truck / vehicle number…"
                helperText="Pick a registered truck, or press Enter to search any vehicle number."
                searchSuggestions={searchSuggestions}
                loadDetail={loadDetail}
                allowFreeSubmit
                buildFreeSuggestion={(value) => ({ value: value.toUpperCase(), primary: value.toUpperCase() })}
                renderResult={(detail, { reset }) => <TruckResultSheet detail={detail} reset={reset} />}
            />
        </QueryPageShell>
    );
}
