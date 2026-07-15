'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    RotateCcw,
    Building2,
    Wallet,
    FileText,
    CreditCard,
    Package,
    ClipboardList,
    ExternalLink,
} from 'lucide-react';
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
import type {
    QueryPartyDetail,
    QueryPartyBillRow,
    QueryPartyPaymentRow,
    QueryPartyChallanRow,
    QueryConsignment,
} from '@/lib/types/query.types';

export function PartyResultSheet({ detail, reset }: { detail: QueryPartyDetail; reset: () => void }) {
    const { party, summary } = detail;
    const due = summary.outstanding;

    const billColumns: SheetColumn<QueryPartyBillRow>[] = [
        { key: 'bill', header: 'Bill No', cell: (r) => <span className="font-mono font-semibold">{r.bill_ref_no || '—'}</span> },
        { key: 'date', header: 'Date', cell: (r) => fmtDate(r.billing_date) },
        { key: 'cns', header: 'CNs', align: 'center', cell: (r) => num(r.covered_count) },
        { key: 'amount', header: 'Billed', align: 'right', cell: (r) => money(r.amount, true), className: 'font-mono' },
        { key: 'paid', header: 'Received', align: 'right', cell: (r) => money(r.paid_amount, true), className: 'font-mono text-emerald-700' },
        {
            key: 'balance',
            header: 'Due',
            align: 'right',
            cell: (r) => (
                <span className={r.balance_amount > 0.005 ? 'text-amber-700 font-semibold' : 'text-muted-foreground'}>
                    {money(r.balance_amount, true)}
                </span>
            ),
            className: 'font-mono',
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            cell: (r) => (
                <span className={String(r.status).toUpperCase() === 'CANCELLED' ? 'text-destructive' : 'text-emerald-700'}>
                    {upper(r.status) || '—'}
                </span>
            ),
        },
    ];

    const paymentColumns: SheetColumn<QueryPartyPaymentRow>[] = [
        { key: 'date', header: 'Date', cell: (r) => fmtDate(r.receipt_date) },
        { key: 'mode', header: 'Mode', cell: (r) => upper(r.payment_mode) || '—' },
        { key: 'ref', header: 'Reference', cell: (r) => r.reference_no || '—', className: 'font-mono' },
        { key: 'bills', header: 'Linked Bills', cell: (r) => r.linked_bills || '—' },
        { key: 'amount', header: 'Amount', align: 'right', cell: (r) => money(r.amount, true), className: 'font-mono font-semibold' },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            cell: (r) => (
                <span className={String(r.status).toUpperCase() === 'REVERSED' ? 'text-destructive' : 'text-emerald-700'}>
                    {upper(r.status) || '—'}
                </span>
            ),
        },
    ];

    const cnColumns: SheetColumn<QueryConsignment>[] = [
        { key: 'cn', header: 'CN No', cell: (r) => <span className="font-mono font-semibold">{r.cn_no}</span> },
        { key: 'date', header: 'Date', cell: (r) => fmtDate(r.bkg_date) },
        { key: 'invoice', header: 'Invoice', cell: (r) => r.invoice_no || '—' },
        { key: 'vehicle', header: 'Vehicle', cell: (r) => upper(r.vehicle_no) || '—' },
        {
            key: 'route',
            header: 'Route',
            cell: (r) => `${upper(r.loading_point || r.booking_branch) || '—'} → ${upper(r.delivery_point || r.dest_branch) || '—'}`,
        },
        { key: 'freight', header: 'Freight', align: 'right', cell: (r) => money(r.total_freight, true), className: 'font-mono' },
    ];

    const challanColumns: SheetColumn<QueryPartyChallanRow>[] = [
        { key: 'no', header: 'Challan No', cell: (r) => <span className="font-mono font-semibold">{r.challan_no}</span> },
        { key: 'date', header: 'Date', cell: (r) => fmtDate(r.date_from) },
        { key: 'vehicle', header: 'Vehicle', cell: (r) => upper(r.vehicle_no) || '—' },
        { key: 'broker', header: 'Broker', cell: (r) => upper(r.broker_name) || '—' },
        { key: 'cns', header: 'Linked CNs', align: 'center', cell: (r) => num(r.linked_cn_count) },
        { key: 'hire', header: 'Hire', align: 'right', cell: (r) => money(r.total_hire_amount, true), className: 'font-mono' },
    ];

    return (
        <DocumentSheet
            eyebrow="Party Ledger Query"
            title={upper(party.name) || 'Party'}
            status={due > 0.005 ? 'Amount Due' : 'Settled'}
            statusTone={due > 0.005 ? 'warning' : 'success'}
            meta={
                <span>
                    {upper(party.code) || '—'}
                    {party.gstin ? ` · GSTIN ${upper(party.gstin)}` : ''}
                    {' · '}
                    {upper(party.branch_name) || upper(party.branch_code) || '—'}
                </span>
            }
            actions={
                <>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
                        <RotateCcw className="h-4 w-4" /> New search
                    </Button>
                    <Button asChild size="sm" className="gap-1.5">
                        <Link href={`/dashboard/ledger/${party.id}`}>
                            <ExternalLink className="h-4 w-4" /> Open ledger
                        </Link>
                    </Button>
                </>
            }
        >
            <div className="grid gap-5 lg:grid-cols-2">
                <SheetSection title="Party Details" icon={<Building2 className="h-3.5 w-3.5" />}>
                    <SheetInfoGrid columns={2}>
                        <SheetField label="Party" value={upper(party.name)} accent />
                        <SheetField label="Code" value={upper(party.code)} mono />
                        <SheetField label="Type" value={upper(party.type)} />
                        <SheetField label="Phone" value={party.phone || '—'} mono />
                        <SheetField label="GSTIN" value={upper(party.gstin) || '—'} mono />
                        <SheetField label="Branch" value={upper(party.branch_name) || upper(party.branch_code) || '—'} />
                        <SheetField label="Address" value={upper(party.address) || '—'} className="col-span-full" />
                    </SheetInfoGrid>
                </SheetSection>

                <SheetSection title="Dues & Ledger Snapshot" icon={<Wallet className="h-3.5 w-3.5" />}>
                    <SheetInfoGrid columns={2}>
                        <SheetField label="Opening Balance" value={money(summary.opening_balance, true)} mono />
                        <SheetField label="Total CNS Amount" value={money(summary.total_cns_amount, true)} mono />
                        <SheetField label="Total Billed" value={money(summary.total_billed, true)} mono />
                        <SheetField label="Total Received" value={money(summary.total_paid, true)} mono />
                        <SheetField label="Unbilled" value={money(summary.unbilled_amount, true)} mono />
                        <SheetField
                            label="Outstanding / Due"
                            value={
                                <span className={due > 0.005 ? 'text-amber-700 font-black' : 'text-emerald-700 font-black'}>
                                    {money(due, true)}
                                </span>
                            }
                            accent
                        />
                    </SheetInfoGrid>
                </SheetSection>
            </div>

            <SheetSection
                title="Bills"
                icon={<FileText className="h-3.5 w-3.5" />}
                right={`${detail.bills.length} shown · ${summary.total_bills_count} active`}
            >
                <SheetDataTable
                    columns={billColumns}
                    rows={detail.bills}
                    getRowKey={(row) => row.id}
                    emptyText="No bills found for this party."
                />
            </SheetSection>

            <SheetSection
                title="Payments"
                icon={<CreditCard className="h-3.5 w-3.5" />}
                right={`${detail.payments.length} receipts`}
            >
                <SheetDataTable
                    columns={paymentColumns}
                    rows={detail.payments}
                    getRowKey={(row) => row.id}
                    emptyText="No payments recorded for this party."
                />
            </SheetSection>

            <SheetSection
                title="Consignments"
                icon={<Package className="h-3.5 w-3.5" />}
                right={`${detail.consignments.length} of ${summary.total_cns_count} shown`}
            >
                <SheetDataTable
                    columns={cnColumns}
                    rows={detail.consignments}
                    getRowKey={(row) => row.id || row.cn_no}
                    emptyText="No consignments billed to this party."
                />
            </SheetSection>

            <SheetSection
                title="Related Challans"
                icon={<ClipboardList className="h-3.5 w-3.5" />}
                right={`${detail.challans.length} challans`}
            >
                <SheetDataTable
                    columns={challanColumns}
                    rows={detail.challans}
                    getRowKey={(row) => row.id}
                    emptyText="No challans linked to this party’s consignments."
                />
            </SheetSection>
        </DocumentSheet>
    );
}
