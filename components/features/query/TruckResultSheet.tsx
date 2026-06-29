'use client';

import * as React from 'react';
import { RotateCcw, Truck, Package, FileText, IndianRupee, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DocumentSheet,
    SheetSection,
    SheetInfoGrid,
    SheetField,
    SheetDataTable,
    type SheetColumn,
} from './DocumentSheet';
import { money, num, upper, fmtDate } from './queryFormat';
import type { QueryTruckDetail, QueryConsignment } from '@/lib/types/query.types';

type ChallanRow = Record<string, unknown>;
const get = (record: ChallanRow, key: string): unknown => record[key];
const str = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text || undefined;
};

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--doc-line-soft)] bg-[var(--doc-head-bg)]/40 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--doc-head-bg)] text-[var(--doc-head-fg)]">
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="truncate text-lg font-black text-foreground">{value}</div>
            </div>
        </div>
    );
}

export function TruckResultSheet({ detail, reset }: { detail: QueryTruckDetail; reset: () => void }) {
    const { vehicle, consignments, challans, totals } = detail;
    const v = (vehicle ?? {}) as Record<string, unknown>;

    const cnColumns: SheetColumn<QueryConsignment>[] = [
        { key: 'cn', header: 'CN No', cell: (r) => <span className="font-mono font-semibold">{r.cn_no}</span> },
        { key: 'date', header: 'Date', cell: (r) => fmtDate(r.bkg_date) },
        {
            key: 'route',
            header: 'Route',
            cell: (r) => `${upper(r.loading_point || r.booking_branch) || '—'} → ${upper(r.delivery_point || r.dest_branch) || '—'}`,
        },
        { key: 'consignor', header: 'Consignor', cell: (r) => upper(r.consignor_name) || '—' },
        { key: 'pkg', header: 'Pkg', align: 'right', cell: (r) => num(r.total_qty ?? r.no_of_pkg) },
        { key: 'wt', header: 'Charged Wt', align: 'right', cell: (r) => num(r.charged_weight) },
        { key: 'freight', header: 'Freight', align: 'right', cell: (r) => money(r.total_freight), className: 'font-mono' },
    ];

    const challanColumns: SheetColumn<ChallanRow>[] = [
        { key: 'no', header: 'Challan No', cell: (r) => <span className="font-mono font-semibold">{str(get(r, 'challan_no')) ?? '—'}</span> },
        { key: 'date', header: 'Date', cell: (r) => fmtDate(get(r, 'date_from') as string) },
        {
            key: 'route',
            header: 'Route',
            cell: (r) => `${upper(get(r, 'loading_point')) || '—'} → ${upper(get(r, 'destination_point')) || '—'}`,
        },
        { key: 'driver', header: 'Driver', cell: (r) => upper(get(r, 'driver_name')) || '—' },
        {
            key: 'party',
            header: 'Broker / Owner',
            cell: (r) => upper(get(r, 'broker_name') || get(r, 'owner_name')) || '—',
        },
        { key: 'hire', header: 'Hire', align: 'right', cell: (r) => money(get(r, 'total_hire_amount')), className: 'font-mono' },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            cell: (r) => (
                <span className="text-[11px] font-semibold uppercase">{str(get(r, 'status')) ?? '—'}</span>
            ),
        },
    ];

    return (
        <DocumentSheet
            eyebrow="Truck / Vehicle"
            title={detail.vehicle_no}
            status={vehicle ? 'In Master' : 'Not in Master'}
            statusTone={vehicle ? 'success' : 'warning'}
            meta={<span>{totals.cn_count} consignments · {totals.challan_count} challans</span>}
            actions={
                <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
                    <RotateCcw className="h-4 w-4" /> New search
                </Button>
            }
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat icon={<Package className="h-4 w-4" />} label="Consignments" value={num(totals.cn_count)} />
                <Stat icon={<ClipboardList className="h-4 w-4" />} label="Challans" value={num(totals.challan_count)} />
                <Stat icon={<IndianRupee className="h-4 w-4" />} label="CN Freight" value={money(totals.total_freight, true)} />
                <Stat icon={<IndianRupee className="h-4 w-4" />} label="Lorry Hire" value={money(totals.total_hire, true)} />
            </div>

            {vehicle ? (
                <SheetSection title="Vehicle Master" icon={<Truck className="h-3.5 w-3.5" />}>
                    <SheetInfoGrid>
                        <SheetField label="Vehicle No" value={upper(get(v, 'vehicle_no'))} mono accent />
                        <SheetField label="Type" value={upper(get(v, 'vehicle_type'))} />
                        <SheetField label="Make" value={upper(get(v, 'vehicle_make'))} />
                        <SheetField label="Model" value={upper(get(v, 'vehicle_model'))} />
                        <SheetField label="Owner Name" value={upper(get(v, 'owner_name'))} />
                        <SheetField label="Owner Mobile" value={str(get(v, 'owner_mobile'))} mono />
                        <SheetField label="Owner PAN" value={upper(get(v, 'owner_pan'))} mono />
                        <SheetField label="Permit No" value={upper(get(v, 'permit_no'))} mono />
                        <SheetField label="Permit Validity" value={fmtDate(get(v, 'permit_validity') as string)} />
                        <SheetField label="Insurance Policy" value={upper(get(v, 'insurance_policy_no'))} mono />
                        <SheetField label="Insurance Validity" value={fmtDate(get(v, 'insurance_validity') as string)} />
                        <SheetField label="Engine No" value={upper(get(v, 'engine_no'))} mono />
                        <SheetField label="Chassis No" value={upper(get(v, 'chasis_no'))} mono />
                        <SheetField label="Tax Token No" value={upper(get(v, 'tax_token_no'))} mono />
                        <SheetField label="Tax Token Validity" value={fmtDate(get(v, 'tax_token_validity') as string)} />
                        <SheetField label="Finance Detail" value={upper(get(v, 'finance_detail'))} />
                    </SheetInfoGrid>
                </SheetSection>
            ) : (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
                    This vehicle is not registered in the vehicle master. Showing movement history matched by vehicle number.
                </div>
            )}

            <SheetSection title="Consignment History" icon={<FileText className="h-3.5 w-3.5" />} right={`${consignments.length} CNs`}>
                <SheetDataTable
                    columns={cnColumns}
                    rows={consignments}
                    getRowKey={(r, i) => `${r.cn_no}-${i}`}
                    emptyText="No consignments found for this truck."
                />
            </SheetSection>

            <SheetSection title="Challan History" icon={<ClipboardList className="h-3.5 w-3.5" />} right={`${challans.length} challans`}>
                <SheetDataTable
                    columns={challanColumns}
                    rows={challans}
                    getRowKey={(r, i) => `${str(get(r, 'challan_no')) ?? 'ch'}-${i}`}
                    emptyText="No challans found for this truck."
                />
            </SheetSection>
        </DocumentSheet>
    );
}
