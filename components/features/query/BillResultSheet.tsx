'use client';

import * as React from 'react';
import { Printer, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { numberToWords } from '@/lib/utils';
import { BillingRecordViewDialog } from '@/components/features/ledger/BillingRecordDialogs';
import { SheetDataTable, type SheetColumn } from './DocumentSheet';
import { QueryRefLink, useQueryDocDialogs } from './QueryDocDialogs';
import {
    TrackPanel,
    PartyLine,
    PlaceholderCell,
    SummaryTable,
    PLACEHOLDER,
    withPlaceholderRow,
} from './QueryTrackLayout';
import { money, num, upper, fmtDate, toNum } from './queryFormat';
import type { QueryBillDetail, QueryBillPayment } from '@/lib/types/query.types';

type SnapRow = Record<string, unknown>;
const get = (record: Record<string, unknown>, key: string): unknown => record[key];
const str = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text || undefined;
};

const EMPTY_DETAIL: QueryBillDetail = {
    record: {},
    party: { id: '', name: '', code: '', phone: null, gstin: null, address: null, branch_code: null },
    consignments: [],
    party_summary: null,
    payments: [],
};

const emptySnap: SnapRow = {};
const emptyPayment: QueryBillPayment = {
    id: '',
    receipt_date: null,
    amount: 0,
    actual_received_amount: 0,
    payment_mode: null,
    reference_no: null,
    bank_name: null,
    narration: null,
    status: '',
    settled_amount: 0,
    deduction_items: [],
};

export function BillResultSheet({ detail, reset }: { detail: QueryBillDetail | null; reset: () => void }) {
    const [printOpen, setPrintOpen] = React.useState(false);
    const docs = useQueryDocDialogs();

    const data = detail ?? EMPTY_DETAIL;
    const hasRecord = Boolean(detail);
    const { record, party } = data;
    const summary = data.party_summary;
    const realPayments = data.payments ?? [];
    const payments = withPlaceholderRow(realPayments, emptyPayment);
    const consignments = data.consignments ?? [];

    const status = String(get(record, 'status') || 'ACTIVE');
    const cancelled = status.toUpperCase() === 'CANCELLED';
    const amount = toNum(get(record, 'amount'));
    const billRef = str(get(record, 'bill_ref_no'));

    const snapshot = Array.isArray(get(record, 'consignment_snapshot'))
        ? (get(record, 'consignment_snapshot') as SnapRow[])
        : [];
    const snapRows = withPlaceholderRow(snapshot, emptySnap);
    const issuingBranch = upper(snapshot[0]?.booking_branch) || upper(party?.branch_code) || PLACEHOLDER;

    const resolveCnId = (cnNo?: string | null) => {
        if (!cnNo) return undefined;
        return consignments.find((row) => row.cn_no === cnNo)?.id;
    };

    const lineColumns: SheetColumn<SnapRow>[] = [
        { key: 'sl', header: '#', align: 'center', cell: (_r, i) => (hasRecord && snapshot.length ? i + 1 : PLACEHOLDER), width: '36px' },
        {
            key: 'cn',
            header: 'CN No',
            cell: (r) => {
                const cnNo = str(get(r, 'cn_no'));
                if (!cnNo) return <PlaceholderCell>{PLACEHOLDER}</PlaceholderCell>;
                return (
                    <QueryRefLink
                        loading={docs.isLoading(`cn:${resolveCnId(cnNo) || cnNo}`)}
                        onClick={() => void docs.openCn({ id: resolveCnId(cnNo), cn_no: cnNo })}
                    >
                        {cnNo}
                    </QueryRefLink>
                );
            },
        },
        { key: 'date', header: 'Date', cell: (r) => <PlaceholderCell>{fmtDate(get(r, 'bkg_date') as string)}</PlaceholderCell> },
        { key: 'inv', header: 'Invoice', cell: (r) => <PlaceholderCell>{str(get(r, 'invoice_no')) ?? PLACEHOLDER}</PlaceholderCell> },
        { key: 'veh', header: 'Vehicle', cell: (r) => <PlaceholderCell>{upper(get(r, 'vehicle_no')) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'load', header: 'Loading', cell: (r) => <PlaceholderCell>{upper(get(r, 'loading_station') || get(r, 'booking_branch')) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'dest', header: 'Destination', cell: (r) => <PlaceholderCell>{upper(get(r, 'delivery_station')) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'freight', header: 'Freight', align: 'right', cell: (r) => <PlaceholderCell>{str(get(r, 'cn_no')) ? money(get(r, 'freight'), true) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'total', header: 'Total', align: 'right', cell: (r) => <PlaceholderCell>{str(get(r, 'cn_no')) ? money(get(r, 'total_amount'), true) : PLACEHOLDER}</PlaceholderCell> },
    ];

    const paymentColumns: SheetColumn<QueryBillPayment>[] = [
        { key: 'date', header: 'Date', cell: (r) => <PlaceholderCell>{fmtDate(r.receipt_date)}</PlaceholderCell> },
        { key: 'mode', header: 'Mode', cell: (r) => <PlaceholderCell>{r.payment_mode ?? PLACEHOLDER}</PlaceholderCell> },
        { key: 'ref', header: 'Ref / Bank', cell: (r) => <PlaceholderCell>{[r.reference_no, r.bank_name].filter(Boolean).join(' · ') || PLACEHOLDER}</PlaceholderCell> },
        { key: 'settled', header: 'Settled', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? money(r.settled_amount, true) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'received', header: 'Received', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? money(r.actual_received_amount, true) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'status', header: 'Status', cell: (r) => <PlaceholderCell>{upper(r.status) || PLACEHOLDER}</PlaceholderCell> },
    ];

    return (
        <>
            <div className="animate-slideUp space-y-3">
                {hasRecord ? (
                    <div className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-lg font-black text-primary">{billRef ?? PLACEHOLDER}</span>
                            <Badge variant={cancelled ? 'destructive' : 'default'}>{cancelled ? 'Cancelled' : upper(status)}</Badge>
                            <span className="text-xs text-muted-foreground">
                                {upper(party?.name) || PLACEHOLDER} · Billed {fmtDate(get(record, 'billing_date') as string)}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={reset}>
                                <RotateCcw className="mr-1 h-3.5 w-3.5" /> New search
                            </Button>
                            <Button type="button" size="sm" onClick={() => setPrintOpen(true)}>
                                <Printer className="mr-1 h-3.5 w-3.5" /> Official copy
                            </Button>
                        </div>
                    </div>
                ) : null}

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="min-w-0 space-y-3">
                        <TrackPanel title="Bill Summary">
                            <SummaryTable
                                minWidth={800}
                                headers={['Bill Ref', 'Bill Date', 'Party', 'Code', 'GSTIN', 'Issuing Branch', 'Covered CNs', 'Bill Amount']}
                                cells={[
                                    billRef ?? PLACEHOLDER,
                                    fmtDate(get(record, 'billing_date') as string),
                                    upper(party?.name) || PLACEHOLDER,
                                    upper(party?.code) || PLACEHOLDER,
                                    upper(party?.gstin) || PLACEHOLDER,
                                    issuingBranch,
                                    hasRecord ? num(snapshot.length || (Array.isArray(get(record, 'covered_cn_nos')) ? (get(record, 'covered_cn_nos') as unknown[]).length : 0)) : PLACEHOLDER,
                                    hasRecord ? money(amount, true) : PLACEHOLDER,
                                ]}
                            />
                            <div className="grid gap-2 border-t bg-muted/20 px-3 py-2 md:grid-cols-2">
                                <PartyLine label="Phone" value={str(party?.phone)} />
                                <PartyLine label="Home Branch" value={upper(party?.branch_name) || upper(party?.branch_code)} />
                                <PartyLine label="Address" value={upper(party?.address)} />
                                <PartyLine label="Amount In Words" value={hasRecord ? numberToWords(amount) : undefined} />
                            </div>
                        </TrackPanel>

                        <TrackPanel title="Payments Received" bodyClassName="p-2">
                            <SheetDataTable
                                columns={paymentColumns}
                                rows={payments}
                                getRowKey={(r, i) => r.id || `bill-pay-${i}`}
                            />
                        </TrackPanel>

                        <TrackPanel title="Covered Consignments" bodyClassName="p-2">
                            <SheetDataTable
                                columns={lineColumns}
                                rows={snapRows}
                                getRowKey={(r, i) => `${str(get(r, 'cn_no')) ?? 'row'}-${i}`}
                            />
                        </TrackPanel>

                        <TrackPanel title="Narration" bodyClassName="p-3 text-xs">
                            <span className={!str(get(record, 'narration')) ? 'text-muted-foreground/70' : undefined}>
                                {str(get(record, 'narration')) || PLACEHOLDER}
                            </span>
                        </TrackPanel>
                    </div>

                    <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
                        {summary || !hasRecord ? (
                            <TrackPanel title="Party Ledger Snapshot" bodyClassName="space-y-1 p-3 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Opening</span><span className="font-mono">{summary ? money(summary.opening_balance, true) : PLACEHOLDER}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Total Billed</span><span className="font-mono">{summary ? money(summary.total_billed, true) : PLACEHOLDER}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Total Received</span><span className="font-mono">{summary ? money(summary.total_paid, true) : PLACEHOLDER}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Unbilled</span><span className="font-mono">{summary ? money(summary.unbilled_amount, true) : PLACEHOLDER}</span></div>
                                <div className="flex justify-between border-t pt-1.5 font-bold"><span>Outstanding</span><span className="font-mono text-primary">{summary ? money(summary.outstanding, true) : PLACEHOLDER}</span></div>
                            </TrackPanel>
                        ) : null}
                        <TrackPanel title="Bill Total" bodyClassName="p-3">
                            <div className="text-center font-mono text-xl font-black text-primary">{hasRecord ? money(amount, true) : PLACEHOLDER}</div>
                        </TrackPanel>
                    </aside>
                </div>
            </div>

            <BillingRecordViewDialog
                open={printOpen}
                onClose={() => setPrintOpen(false)}
                party={party as unknown as React.ComponentProps<typeof BillingRecordViewDialog>['party']}
                record={record as unknown as React.ComponentProps<typeof BillingRecordViewDialog>['record']}
                consignments={consignments as unknown as React.ComponentProps<typeof BillingRecordViewDialog>['consignments']}
                isAdmin={false}
                onEdit={() => setPrintOpen(false)}
            />
            {docs.dialogs}
        </>
    );
}
