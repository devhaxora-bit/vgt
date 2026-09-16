'use client';

import * as React from 'react';
import { Printer, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChallanDetailsDialog } from '@/components/features/challans/ChallanDetailsDialog';
import { sortLinkedConsignments } from '@/lib/sortLinkedConsignments';
import { SheetDataTable, type SheetColumn } from './DocumentSheet';
import { QueryRefLink, useQueryDocDialogs } from './QueryDocDialogs';
import {
    TrackPanel,
    PartyLine,
    FreightLine,
    PlaceholderCell,
    SummaryTable,
    PLACEHOLDER,
    withPlaceholderRow,
    queryCell,
} from './QueryTrackLayout';
import { money, num, upper, fmtDate } from './queryFormat';
import type { QueryConsignment, QueryChallanDetail, QueryLinkedPayment } from '@/lib/types/query.types';

type Challan = Record<string, unknown>;

const get = (record: Challan, key: string): unknown => record[key];
const str = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text || undefined;
};

const EMPTY_DETAIL: QueryChallanDetail = {
    challan: {},
    settlement: { gross_hire: 0, advance: 0, tds: 0, balance_payable: 0 },
    broker_bill: null,
    payments: [],
    paid_total: 0,
    pending_amount: 0,
};

const emptyCn: QueryConsignment = { id: '', cn_no: '' };
const emptyPayment: QueryLinkedPayment = {
    id: '',
    receipt_date: null,
    amount: 0,
    payment_mode: null,
    reference_no: null,
    status: '',
};

interface ChargeRow {
    label: string;
    amount: unknown;
}

export function ChallanResultSheet({ detail, reset }: { detail: QueryChallanDetail | null; reset: () => void }) {
    const [printOpen, setPrintOpen] = React.useState(false);
    const [linked, setLinked] = React.useState<QueryConsignment[]>([]);
    const [loadingLinked, setLoadingLinked] = React.useState(false);
    const docs = useQueryDocDialogs();

    const data = detail ?? EMPTY_DETAIL;
    const hasRecord = Boolean(detail);
    const challan = data.challan;
    const c = challan;

    const linkedCnNos = React.useMemo(() => {
        const raw = get(c, 'linked_cn_nos');
        return Array.isArray(raw) ? (raw as string[]).filter(Boolean) : [];
    }, [c]);

    React.useEffect(() => {
        let cancelled = false;
        if (!hasRecord || linkedCnNos.length === 0) {
            setLinked([]);
            return;
        }
        setLoadingLinked(true);
        fetch(`/api/consignments/by-cn?cns=${encodeURIComponent(linkedCnNos.join(','))}`)
            .then((res) => (res.ok ? res.json() : []))
            .then((rows) => {
                if (cancelled) return;
                setLinked(Array.isArray(rows) ? sortLinkedConsignments(rows, 'cn_no', 'asc') : []);
            })
            .catch(() => {
                if (!cancelled) setLinked([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingLinked(false);
            });
        return () => {
            cancelled = true;
        };
    }, [hasRecord, linkedCnNos]);

    const isDirect = String(get(c, 'engagement_type') || 'broker') === 'direct';
    const originBranch = get(c, 'origin_branch') as { name?: string } | null;
    const destBranch = get(c, 'destination_branch') as { name?: string } | null;
    const status = String(get(c, 'status') || 'ACTIVE');
    const cancelled = status.toUpperCase() === 'CANCELLED';

    const { gross_hire: totalHire, advance, tds: lessTds, balance_payable: balance } = data.settlement;
    const brokerBill = data.broker_bill;
    const realPayments = data.payments ?? [];
    const payments = withPlaceholderRow(realPayments, emptyPayment);
    const paidTotal = data.paid_total ?? 0;
    const pending = data.pending_amount ?? balance;
    const lastReceiptDate = realPayments.length > 0 ? realPayments[0].receipt_date : null;
    const isPaid = hasRecord && pending <= 0.005 && (brokerBill != null || paidTotal > 0);

    const linkedRows = withPlaceholderRow(linked, emptyCn);

    const chargeRows: ChargeRow[] = [
        { label: 'Basic Lorry Hire', amount: get(c, 'hire_amount') },
        { label: 'Detention Charges', amount: get(c, 'detent_charges') },
        { label: 'Unloading Charges', amount: get(c, 'unloading_charges') },
        { label: 'Extra Over Weight', amount: get(c, 'extra_over_weight') },
        { label: 'Extra KM Charges', amount: get(c, 'extra_km_charges') },
        { label: 'Transit Pass Charges', amount: get(c, 'transit_pass_charges') },
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
        { key: 'from', header: 'Loading', cell: (r) => <PlaceholderCell>{upper(r.loading_point || r.booking_branch) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'to', header: 'Unloading', cell: (r) => <PlaceholderCell>{upper(r.delivery_point || r.dest_branch) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'goods', header: 'Goods', cell: (r) => <PlaceholderCell>{upper(r.goods_class || r.goods_desc) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'pkg', header: 'Pkg', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? num(r.total_qty ?? r.no_of_pkg) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'actual', header: 'Actual Wt', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? num(r.actual_weight) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'charged', header: 'Charged Wt', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? num(r.charged_weight) : PLACEHOLDER}</PlaceholderCell> },
    ];

    const chargeColumns: SheetColumn<ChargeRow>[] = [
        { key: 'label', header: 'Particulars', cell: (r) => <span className="font-medium">{r.label}</span> },
        { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <PlaceholderCell>{hasRecord ? money(r.amount, true) : PLACEHOLDER}</PlaceholderCell> },
    ];

    const paymentColumns: SheetColumn<QueryLinkedPayment>[] = [
        { key: 'date', header: 'Received Date', cell: (r) => <PlaceholderCell>{fmtDate(r.receipt_date)}</PlaceholderCell> },
        { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <PlaceholderCell>{r.id ? money(r.amount, true) : PLACEHOLDER}</PlaceholderCell> },
        { key: 'mode', header: 'Mode', cell: (r) => <PlaceholderCell>{upper(r.payment_mode) || PLACEHOLDER}</PlaceholderCell> },
        { key: 'ref', header: 'Reference', cell: (r) => <PlaceholderCell>{r.reference_no || PLACEHOLDER}</PlaceholderCell> },
    ];

    return (
        <div className="animate-slideUp space-y-3">
            {hasRecord ? (
                <div className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-black text-primary">{str(get(c, 'challan_no'))}</span>
                        <Badge variant={cancelled ? 'destructive' : 'default'}>{cancelled ? 'Cancelled' : upper(status)}</Badge>
                        <span className="text-xs text-muted-foreground">
                            {fmtDate(get(c, 'date_from') as string)} · {upper(get(c, 'loading_point')) || originBranch?.name || PLACEHOLDER}
                            {' → '}
                            {upper(get(c, 'destination_point')) || destBranch?.name || PLACEHOLDER}
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
                    <TrackPanel title="Trip & Vehicle">
                        <SummaryTable
                            headers={['Vehicle', 'Type', 'Date From', 'Date To', 'Loading', 'Destination', 'Reach By', 'Distance']}
                            cells={[
                                upper(get(c, 'vehicle_no')) || PLACEHOLDER,
                                upper(get(c, 'vehicle_type')) || PLACEHOLDER,
                                fmtDate(get(c, 'date_from') as string),
                                fmtDate(get(c, 'date_to') as string),
                                upper(get(c, 'loading_point')) || PLACEHOLDER,
                                upper(get(c, 'destination_point')) || PLACEHOLDER,
                                fmtDate(get(c, 'truck_schedule_date') as string),
                                str(get(c, 'trip_distance')) || PLACEHOLDER,
                            ]}
                        />
                    </TrackPanel>

                    <div className="grid gap-3 lg:grid-cols-2">
                        <TrackPanel title="Driver" bodyClassName="px-3 py-2">
                            <div className="grid gap-1.5">
                                <PartyLine label="Name" value={upper(get(c, 'driver_name'))} />
                                <PartyLine label="Mobile" value={str(get(c, 'driver_mobile'))} />
                                <PartyLine label="DL No" value={upper(get(c, 'driver_dl_no'))} />
                                <PartyLine label="DL Validity" value={fmtDate(get(c, 'driver_dl_validity') as string)} />
                                <PartyLine label="Address" value={upper(get(c, 'driver_address'))} />
                            </div>
                        </TrackPanel>
                        <TrackPanel title={isDirect ? 'Owner' : 'Broker'} bodyClassName="px-3 py-2">
                            <div className="grid gap-1.5">
                                {isDirect ? (
                                    <>
                                        <PartyLine label="Owner" value={upper(get(c, 'owner_name'))} />
                                        <PartyLine label="PAN" value={upper(get(c, 'owner_pan'))} />
                                        <PartyLine label="Mobile" value={str(get(c, 'owner_mobile'))} />
                                        <PartyLine label="Slip No" value={upper(get(c, 'slip_no'))} />
                                        <PartyLine label="Address" value={upper(get(c, 'owner_address'))} />
                                    </>
                                ) : (
                                    <>
                                        <PartyLine label="Broker" value={upper(get(c, 'broker_name'))} />
                                        <PartyLine label="Code" value={upper(get(c, 'broker_code'))} />
                                        <PartyLine label="Mobile" value={str(get(c, 'broker_mobile'))} />
                                        <PartyLine label="Slip No" value={upper(get(c, 'slip_no'))} />
                                        <PartyLine label="Address" value={upper(get(c, 'broker_address'))} />
                                    </>
                                )}
                            </div>
                        </TrackPanel>
                    </div>

                    <TrackPanel
                        title="Linked Consignments"
                        right={hasRecord ? `${linkedCnNos.length} CN${linkedCnNos.length === 1 ? '' : 's'}` : undefined}
                        bodyClassName="p-2"
                    >
                        {loadingLinked ? (
                            <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading linked consignments…
                            </div>
                        ) : (
                            <SheetDataTable
                                columns={cnColumns}
                                rows={linkedRows}
                                getRowKey={(r, i) => r.id || r.cn_no || `cn-ph-${i}`}
                            />
                        )}
                    </TrackPanel>

                    <TrackPanel title="Lorry Hire Breakup" bodyClassName="p-2">
                        <SheetDataTable
                            columns={chargeColumns}
                            rows={chargeRows}
                            getRowKey={(r) => r.label}
                        />
                    </TrackPanel>

                    <TrackPanel title="Payment Receipts" bodyClassName="p-2">
                        <SheetDataTable
                            columns={paymentColumns}
                            rows={payments}
                            getRowKey={(r, i) => r.id || `pay-ph-${i}`}
                        />
                    </TrackPanel>

                    <TrackPanel title="Remarks" bodyClassName="p-3 text-xs">
                        <span className={!str(get(c, 'remarks')) ? 'text-muted-foreground/70' : undefined}>
                            {str(get(c, 'remarks')) || PLACEHOLDER}
                        </span>
                    </TrackPanel>
                </div>

                <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
                    <TrackPanel title="Settlement" bodyClassName="space-y-1.5 p-3">
                        <FreightLine label="Gross Hire" amount={totalHire} emphasize />
                        <FreightLine label={`Less TDS (${hasRecord ? num(get(c, 'tds_percent')) : PLACEHOLDER})`} amount={lessTds} />
                        <FreightLine label="Less Advance" amount={advance} />
                        <FreightLine label="Balance Payable" amount={balance} emphasize />
                    </TrackPanel>

                    <TrackPanel title="Payment Status" bodyClassName="space-y-1 p-3 text-xs">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="font-semibold">{hasRecord ? (isPaid ? 'Settled' : 'Pending') : PLACEHOLDER}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Pending</span>
                            <span className="font-mono font-semibold">{hasRecord ? money(pending, true) : PLACEHOLDER}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Received</span>
                            <span className="font-mono font-semibold">{hasRecord ? money(paidTotal, true) : PLACEHOLDER}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Broker Bill</span>
                            <span className="font-mono text-[11px]">{brokerBill?.bill_ref_no || PLACEHOLDER}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Receipt</span>
                            <span>{lastReceiptDate ? fmtDate(lastReceiptDate) : PLACEHOLDER}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Receipts</span>
                            <span className="font-mono">{hasRecord ? queryCell(realPayments.length) : PLACEHOLDER}</span>
                        </div>
                    </TrackPanel>
                </aside>
            </div>

            <ChallanDetailsDialog isOpen={printOpen} onClose={() => setPrintOpen(false)} challan={challan} />
            {docs.dialogs}
        </div>
    );
}
