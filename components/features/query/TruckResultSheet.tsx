'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SheetDataTable, type SheetColumn } from './DocumentSheet';
import { QueryRefLink, useQueryDocDialogs } from './QueryDocDialogs';
import {
    TrackPanel,
    PartyLine,
    SummaryTable,
    PLACEHOLDER,
    withPlaceholderRow,
    PlaceholderCell,
} from './QueryTrackLayout';
import { money, num, upper, fmtDate } from './queryFormat';
import type { QueryTruckDetail, QueryConsignment } from '@/lib/types/query.types';

type ChallanRow = Record<string, unknown>;
const get = (record: ChallanRow, key: string): unknown => record[key];
const str = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text || undefined;
};

const EMPTY_DETAIL: QueryTruckDetail = {
    vehicle_no: '',
    vehicle: null,
    consignments: [],
    challans: [],
    totals: { cn_count: 0, challan_count: 0, total_freight: 0, total_hire: 0 },
};

const emptyCn: QueryConsignment = { id: '', cn_no: '' };
const emptyChallan: ChallanRow = {};

export function TruckResultSheet({ detail, reset }: { detail: QueryTruckDetail | null; reset: () => void }) {
    const data = detail ?? EMPTY_DETAIL;
    const hasRecord = Boolean(detail);
    const { vehicle, totals } = data;
    const v = (vehicle ?? {}) as Record<string, unknown>;
    const docs = useQueryDocDialogs();

    const consignments = withPlaceholderRow(data.consignments, emptyCn);
    const challans = withPlaceholderRow(data.challans, emptyChallan);

    const cnColumns: SheetColumn<QueryConsignment>[] = [
        {
            key: 'cn',
            header: 'CN No',
            cell: (r) => r.id || r.cn_no ? (
                <QueryRefLink loading={docs.isLoading(`cn:${r.id || r.cn_no}`)} onClick={() => void docs.openCn(r)}>
                    {r.cn_no}
                </QueryRefLink>
            ) : <PlaceholderCell>{PLACEHOLDER}</PlaceholderCell>,
        },
        { key: 'date', header: 'Date', cell: (r) => <PlaceholderCell>{fmtDate(r.bkg_date)}</PlaceholderCell> },
        { key: 'route', header: 'Route', cell: (r) => <PlaceholderCell>{r.id ? `${upper(r.loading_point || r.booking_branch) || PLACEHOLDER} → ${upper(r.delivery_point || r.dest_branch) || PLACEHOLDER}` : PLACEHOLDER}</PlaceholderCell> },
        { key: 'consignor', header: 'Consignor', cell: (r) => <PlaceholderCell>{upper(r.consignor_name) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'pkg', header: 'Pkg', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? num(r.total_qty ?? r.no_of_pkg) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'wt', header: 'Charged Wt', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? num(r.charged_weight) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'freight', header: 'Freight', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? money(r.total_freight, true) : PLACEHOLDER}</PlaceholderCell> },
    ];

    const challanColumns: SheetColumn<ChallanRow>[] = [
        {
            key: 'no',
            header: 'Challan No',
            cell: (r) => {
                const challanNo = str(get(r, 'challan_no'));
                if (!challanNo) return <PlaceholderCell>{PLACEHOLDER}</PlaceholderCell>;
                return (
                    <QueryRefLink
                        loading={docs.isLoading(`challan:${String(get(r, 'id') || challanNo)}`)}
                        onClick={() => void docs.openChallan(r)}
                    >
                        {challanNo}
                    </QueryRefLink>
                );
            },
        },
        { key: 'date', header: 'Date', cell: (r) => <PlaceholderCell>{fmtDate(get(r, 'date_from') as string)}</PlaceholderCell> },
        { key: 'route', header: 'Route', cell: (r) => <PlaceholderCell>{str(get(r, 'challan_no')) ? `${upper(get(r, 'loading_point')) || PLACEHOLDER} → ${upper(get(r, 'destination_point')) || PLACEHOLDER}` : PLACEHOLDER}</PlaceholderCell> },
        { key: 'driver', header: 'Driver', cell: (r) => <PlaceholderCell>{upper(get(r, 'driver_name')) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'party', header: 'Broker / Owner', cell: (r) => <PlaceholderCell>{upper(get(r, 'broker_name') || get(r, 'owner_name')) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'hire', header: 'Hire', align: 'right', cell: (r) => <PlaceholderCell>{str(get(r, 'challan_no')) ? money(get(r, 'total_hire_amount'), true) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'status', header: 'Status', cell: (r) => <PlaceholderCell>{upper(get(r, 'status')) || PLACEHOLDER}</PlaceholderCell> },
    ];

    return (
        <>
            <div className="animate-slideUp space-y-3">
                {hasRecord ? (
                    <div className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-lg font-black text-primary">{data.vehicle_no}</span>
                            <Badge variant={vehicle ? 'default' : 'secondary'}>{vehicle ? 'In Master' : 'Not in Master'}</Badge>
                            <span className="text-xs text-muted-foreground">
                                {totals.cn_count} consignments · {totals.challan_count} challans
                            </span>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={reset}>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> New search
                        </Button>
                    </div>
                ) : null}

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="min-w-0 space-y-3">
                        <TrackPanel title="Vehicle Master">
                            <SummaryTable
                                minWidth={900}
                                headers={['Vehicle No', 'Type', 'Make', 'Model', 'Owner', 'Mobile', 'Permit No', 'Permit Validity']}
                                cells={[
                                    upper(get(v, 'vehicle_no')) || (hasRecord ? data.vehicle_no : PLACEHOLDER),
                                    upper(get(v, 'vehicle_type')) || PLACEHOLDER,
                                    upper(get(v, 'vehicle_make')) || PLACEHOLDER,
                                    upper(get(v, 'vehicle_model')) || PLACEHOLDER,
                                    upper(get(v, 'owner_name')) || PLACEHOLDER,
                                    str(get(v, 'owner_mobile')) || PLACEHOLDER,
                                    upper(get(v, 'permit_no')) || PLACEHOLDER,
                                    fmtDate(get(v, 'permit_validity') as string),
                                ]}
                            />
                            <div className="grid gap-2 border-t px-3 py-2 sm:grid-cols-2">
                                <PartyLine label="Owner PAN" value={upper(get(v, 'owner_pan'))} />
                                <PartyLine label="Insurance Policy" value={upper(get(v, 'insurance_policy_no'))} />
                                <PartyLine label="Insurance Validity" value={fmtDate(get(v, 'insurance_validity') as string)} />
                                <PartyLine label="Engine No" value={upper(get(v, 'engine_no'))} />
                                <PartyLine label="Chassis No" value={upper(get(v, 'chasis_no'))} />
                                <PartyLine label="Tax Token" value={upper(get(v, 'tax_token_no'))} />
                            </div>
                        </TrackPanel>

                        <TrackPanel title="Consignment History" bodyClassName="p-2">
                            <SheetDataTable columns={cnColumns} rows={consignments} getRowKey={(r, i) => `${r.cn_no}-${i}`} />
                        </TrackPanel>

                        <TrackPanel title="Challan History" bodyClassName="p-2">
                            <SheetDataTable columns={challanColumns} rows={challans} getRowKey={(r, i) => `${str(get(r, 'challan_no')) ?? 'ch'}-${i}`} />
                        </TrackPanel>
                    </div>

                    <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
                        <TrackPanel title="Movement Totals" bodyClassName="space-y-1 p-3 text-xs">
                            <div className="flex justify-between"><span className="text-muted-foreground">Consignments</span><span className="font-mono font-semibold">{hasRecord ? num(totals.cn_count) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Challans</span><span className="font-mono font-semibold">{hasRecord ? num(totals.challan_count) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between border-t pt-1.5"><span className="text-muted-foreground">CN Freight</span><span className="font-mono font-bold">{hasRecord ? money(totals.total_freight, true) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Lorry Hire</span><span className="font-mono font-bold">{hasRecord ? money(totals.total_hire, true) : PLACEHOLDER}</span></div>
                        </TrackPanel>
                    </aside>
                </div>
            </div>
            {docs.dialogs}
        </>
    );
}
