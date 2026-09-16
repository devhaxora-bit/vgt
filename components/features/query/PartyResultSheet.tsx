'use client';

import * as React from 'react';
import Link from 'next/link';
import { RotateCcw, ExternalLink } from 'lucide-react';
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
import type {
    QueryPartyDetail,
    QueryPartyBillRow,
    QueryPartyPaymentRow,
    QueryPartyChallanRow,
    QueryConsignment,
} from '@/lib/types/query.types';

const EMPTY_DETAIL: QueryPartyDetail = {
    party: { id: '', name: '', code: '', gstin: null, phone: null, address: null, branch_code: null },
    summary: {
        opening_balance: 0,
        total_billed: 0,
        total_paid: 0,
        outstanding: 0,
        unbilled_amount: 0,
        total_cns_amount: 0,
        total_cns_count: 0,
        total_bills_count: 0,
        overbilled_amount: 0,
    },
    bills: [],
    payments: [],
    consignments: [],
    challans: [],
};

const emptyBill: QueryPartyBillRow = {
    id: '',
    bill_ref_no: null,
    billing_date: null,
    amount: 0,
    paid_amount: 0,
    balance_amount: 0,
    status: '',
    covered_count: 0,
};
const emptyPayment: QueryPartyPaymentRow = {
    id: '',
    receipt_date: null,
    amount: 0,
    payment_mode: null,
    reference_no: null,
    status: '',
    linked_bills: '',
};
const emptyCn: QueryConsignment = { id: '', cn_no: '' };
const emptyChallan: QueryPartyChallanRow = {
    id: '',
    challan_no: '',
    date_from: null,
    vehicle_no: null,
    broker_name: null,
    total_hire_amount: 0,
    linked_cn_count: 0,
};

export function PartyResultSheet({ detail, reset }: { detail: QueryPartyDetail | null; reset: () => void }) {
    const data = detail ?? EMPTY_DETAIL;
    const hasRecord = Boolean(detail);
    const { party, summary } = data;
    const due = summary.outstanding;
    const docs = useQueryDocDialogs();

    const bills = withPlaceholderRow(data.bills, emptyBill);
    const payments = withPlaceholderRow(data.payments, emptyPayment);
    const consignments = withPlaceholderRow(data.consignments, emptyCn);
    const challans = withPlaceholderRow(data.challans, emptyChallan);

    const billColumns: SheetColumn<QueryPartyBillRow>[] = [
        {
            key: 'bill',
            header: 'Bill No',
            cell: (r) => r.id ? (
                <QueryRefLink loading={docs.isLoading(`bill:${r.id}`)} onClick={() => void docs.openBill(r.id)}>
                    {r.bill_ref_no || PLACEHOLDER}
                </QueryRefLink>
            ) : <PlaceholderCell>{PLACEHOLDER}</PlaceholderCell>,
        },
        { key: 'date', header: 'Date', cell: (r) => <PlaceholderCell>{fmtDate(r.billing_date)}</PlaceholderCell> },
        { key: 'cns', header: 'CNs', align: 'center', cell: (r) => <PlaceholderCell>{r.id ? num(r.covered_count) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'amount', header: 'Billed', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? money(r.amount, true) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'paid', header: 'Received', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? money(r.paid_amount, true) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'balance', header: 'Due', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? money(r.balance_amount, true) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'status', header: 'Status', cell: (r) => <PlaceholderCell>{upper(r.status) || PLACEHOLDER}</PlaceholderCell> },
    ];

    const paymentColumns: SheetColumn<QueryPartyPaymentRow>[] = [
        { key: 'date', header: 'Date', cell: (r) => <PlaceholderCell>{fmtDate(r.receipt_date)}</PlaceholderCell> },
        { key: 'mode', header: 'Mode', cell: (r) => <PlaceholderCell>{upper(r.payment_mode) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'ref', header: 'Reference', cell: (r) => <PlaceholderCell>{r.reference_no || PLACEHOLDER}</PlaceholderCell> },
        { key: 'bills', header: 'Linked Bills', cell: (r) => <PlaceholderCell>{r.linked_bills || PLACEHOLDER}</PlaceholderCell> },
        { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? money(r.amount, true) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'status', header: 'Status', cell: (r) => <PlaceholderCell>{upper(r.status) || PLACEHOLDER}</PlaceholderCell> },
    ];

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
        { key: 'invoice', header: 'Invoice', cell: (r) => <PlaceholderCell>{r.invoice_no || PLACEHOLDER}</PlaceholderCell> },
        { key: 'vehicle', header: 'Vehicle', cell: (r) => <PlaceholderCell>{upper(r.vehicle_no) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'route', header: 'Route', cell: (r) => <PlaceholderCell>{r.id ? `${upper(r.loading_point || r.booking_branch) || PLACEHOLDER} → ${upper(r.delivery_point || r.dest_branch) || PLACEHOLDER}` : PLACEHOLDER}</PlaceholderCell> },
        { key: 'freight', header: 'Freight', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? money(r.total_freight, true) : PLACEHOLDER}</PlaceholderCell> },
    ];

    const challanColumns: SheetColumn<QueryPartyChallanRow>[] = [
        {
            key: 'no',
            header: 'Challan No',
            cell: (r) => r.id ? (
                <QueryRefLink loading={docs.isLoading(`challan:${r.id}`)} onClick={() => void docs.openChallan(r)}>
                    {r.challan_no}
                </QueryRefLink>
            ) : <PlaceholderCell>{PLACEHOLDER}</PlaceholderCell>,
        },
        { key: 'date', header: 'Date', cell: (r) => <PlaceholderCell>{fmtDate(r.date_from)}</PlaceholderCell> },
        { key: 'vehicle', header: 'Vehicle', cell: (r) => <PlaceholderCell>{upper(r.vehicle_no) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'broker', header: 'Broker', cell: (r) => <PlaceholderCell>{upper(r.broker_name) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'cns', header: 'Linked CNs', align: 'center', cell: (r) => <PlaceholderCell>{r.id ? num(r.linked_cn_count) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'hire', header: 'Hire', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? money(r.total_hire_amount, true) : PLACEHOLDER}</PlaceholderCell> },
    ];

    return (
        <>
            <div className="animate-slideUp space-y-3">
                {hasRecord ? (
                    <div className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-black text-primary">{upper(party.name)}</span>
                            <Badge variant={due > 0.005 ? 'secondary' : 'default'}>
                                {due > 0.005 ? 'Amount Due' : 'Settled'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                {upper(party.code) || PLACEHOLDER}
                                {party.gstin ? ` · GSTIN ${upper(party.gstin)}` : ''}
                                {' · '}
                                {upper(party.branch_name) || upper(party.branch_code) || PLACEHOLDER}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={reset}>
                                <RotateCcw className="mr-1 h-3.5 w-3.5" /> New search
                            </Button>
                            <Button asChild size="sm">
                                <Link href={`/dashboard/ledger/${party.id}`}>
                                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open ledger
                                </Link>
                            </Button>
                        </div>
                    </div>
                ) : null}

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="min-w-0 space-y-3">
                        <TrackPanel title="Party Details">
                            <SummaryTable
                                headers={['Party', 'Code', 'Phone', 'GSTIN', 'Branch']}
                                cells={[
                                    upper(party.name) || PLACEHOLDER,
                                    upper(party.code) || PLACEHOLDER,
                                    party.phone || PLACEHOLDER,
                                    upper(party.gstin) || PLACEHOLDER,
                                    upper(party.branch_name) || upper(party.branch_code) || PLACEHOLDER,
                                ]}
                            />
                            <div className="border-t px-3 py-2">
                                <PartyLine label="Address" value={upper(party.address)} />
                            </div>
                        </TrackPanel>

                        <TrackPanel title="Bills" bodyClassName="p-2">
                            <SheetDataTable columns={billColumns} rows={bills} getRowKey={(r, i) => r.id || `bill-${i}`} />
                        </TrackPanel>

                        <TrackPanel title="Payments" bodyClassName="p-2">
                            <SheetDataTable columns={paymentColumns} rows={payments} getRowKey={(r, i) => r.id || `pay-${i}`} />
                        </TrackPanel>

                        <TrackPanel title="Consignments" bodyClassName="p-2">
                            <SheetDataTable columns={cnColumns} rows={consignments} getRowKey={(r, i) => r.id || r.cn_no || `cn-${i}`} />
                        </TrackPanel>

                        <TrackPanel title="Related Challans" bodyClassName="p-2">
                            <SheetDataTable columns={challanColumns} rows={challans} getRowKey={(r, i) => r.id || `ch-${i}`} />
                        </TrackPanel>
                    </div>

                    <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
                        <TrackPanel title="Ledger Snapshot" bodyClassName="space-y-1 p-3 text-xs">
                            <div className="flex justify-between"><span className="text-muted-foreground">Opening</span><span className="font-mono">{hasRecord ? money(summary.opening_balance, true) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total CNS</span><span className="font-mono">{hasRecord ? money(summary.total_cns_amount, true) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Billed</span><span className="font-mono">{hasRecord ? money(summary.total_billed, true) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Received</span><span className="font-mono">{hasRecord ? money(summary.total_paid, true) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Unbilled</span><span className="font-mono">{hasRecord ? money(summary.unbilled_amount, true) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between border-t pt-1.5 font-bold"><span>Outstanding</span><span className="font-mono text-primary">{hasRecord ? money(due, true) : PLACEHOLDER}</span></div>
                        </TrackPanel>
                        <TrackPanel title="Counts" bodyClassName="space-y-1 p-3 text-xs">
                            <div className="flex justify-between"><span className="text-muted-foreground">Bills</span><span className="font-mono">{hasRecord ? num(summary.total_bills_count) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">CNs</span><span className="font-mono">{hasRecord ? num(summary.total_cns_count) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Payments shown</span><span className="font-mono">{hasRecord ? num(data.payments.length) : PLACEHOLDER}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Challans shown</span><span className="font-mono">{hasRecord ? num(data.challans.length) : PLACEHOLDER}</span></div>
                        </TrackPanel>
                    </aside>
                </div>
            </div>
            {docs.dialogs}
        </>
    );
}
