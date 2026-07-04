'use client';

import * as React from 'react';
import { Printer, RotateCcw, Truck, User, Users, Receipt, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChallanDetailsDialog } from '@/components/features/challans/ChallanDetailsDialog';
import { sortLinkedConsignments } from '@/lib/sortLinkedConsignments';
import {
    DocumentSheet,
    SheetSection,
    SheetInfoGrid,
    SheetField,
    SheetDataTable,
    type SheetColumn,
} from './DocumentSheet';
import { money, num, upper, fmtDate } from './queryFormat';
import type { QueryConsignment, QueryChallanDetail, QueryLinkedPayment } from '@/lib/types/query.types';

type Challan = Record<string, unknown>;

const get = (record: Challan, key: string): unknown => record[key];
const str = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text || undefined;
};

interface ChargeRow {
    label: string;
    amount: unknown;
}

export function ChallanResultSheet({ detail, reset }: { detail: QueryChallanDetail; reset: () => void }) {
    const [printOpen, setPrintOpen] = React.useState(false);
    const [linked, setLinked] = React.useState<QueryConsignment[]>([]);
    const [loadingLinked, setLoadingLinked] = React.useState(false);
    const challan = detail.challan;
    const c = challan;

    const linkedCnNos = React.useMemo(() => {
        const raw = get(c, 'linked_cn_nos');
        return Array.isArray(raw) ? (raw as string[]).filter(Boolean) : [];
    }, [c]);

    React.useEffect(() => {
        let cancelled = false;
        if (linkedCnNos.length === 0) {
            setLinked([]);
            return;
        }
        setLoadingLinked(true);
        fetch(`/api/consignments/by-cn?cns=${encodeURIComponent(linkedCnNos.join(','))}`)
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => {
                if (cancelled) return;
                setLinked(Array.isArray(data) ? sortLinkedConsignments(data, 'cn_no', 'asc') : []);
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
    }, [linkedCnNos]);

    const isDirect = String(get(c, 'engagement_type') || 'broker') === 'direct';
    const originBranch = get(c, 'origin_branch') as { name?: string } | null;
    const destBranch = get(c, 'destination_branch') as { name?: string } | null;

    const status = String(get(c, 'status') || 'ACTIVE');
    const cancelled = status.toUpperCase() === 'CANCELLED';

    const { gross_hire: totalHire, advance, tds: lessTds, balance_payable: balance } = detail.settlement;
    const brokerBill = detail.broker_bill;
    const payments: QueryLinkedPayment[] = detail.payments ?? [];
    const paidTotal = detail.paid_total ?? 0;
    const pending = detail.pending_amount ?? balance;
    const lastReceiptDate = payments.length > 0 ? payments[0].receipt_date : null;
    const isPaid = pending <= 0.005 && (brokerBill != null || paidTotal > 0);

    const cnColumns: SheetColumn<QueryConsignment>[] = [
        { key: 'cn', header: 'CN No', cell: (r) => <span className="font-mono font-semibold">{r.cn_no}</span> },
        { key: 'from', header: 'Loading', cell: (r) => upper(r.loading_point || r.booking_branch) || '—' },
        { key: 'to', header: 'Unloading', cell: (r) => upper(r.delivery_point || r.dest_branch) || '—' },
        { key: 'goods', header: 'Goods', cell: (r) => upper(r.goods_class || r.goods_desc) || '—' },
        { key: 'pkg', header: 'Pkg', align: 'right', cell: (r) => num(r.total_qty ?? r.no_of_pkg) },
        { key: 'actual', header: 'Actual Wt', align: 'right', cell: (r) => num(r.actual_weight) },
        { key: 'charged', header: 'Charged Wt', align: 'right', cell: (r) => num(r.charged_weight) },
    ];

    const chargeRows: ChargeRow[] = [
        { label: 'Basic Lorry Hire', amount: get(c, 'hire_amount') },
        { label: 'Detention Charges', amount: get(c, 'detent_charges') },
        { label: 'Unloading Charges', amount: get(c, 'unloading_charges') },
        { label: 'Extra Over Weight', amount: get(c, 'extra_over_weight') },
        { label: 'Extra KM Charges', amount: get(c, 'extra_km_charges') },
        { label: 'Transit Pass Charges', amount: get(c, 'transit_pass_charges') },
    ];

    const chargeColumns: SheetColumn<ChargeRow>[] = [
        { key: 'label', header: 'Particulars', cell: (r) => <span className="font-medium">{r.label}</span> },
        { key: 'amount', header: 'Amount', align: 'right', cell: (r) => money(r.amount), className: 'font-mono' },
    ];

    const paymentColumns: SheetColumn<QueryLinkedPayment>[] = [
        { key: 'date', header: 'Received Date', cell: (r) => fmtDate(r.receipt_date) },
        { key: 'amount', header: 'Amount', align: 'right', cell: (r) => money(r.amount, true), className: 'font-mono font-semibold' },
        { key: 'mode', header: 'Mode', cell: (r) => upper(r.payment_mode) || '—' },
        { key: 'ref', header: 'Reference', cell: (r) => r.reference_no || '—' },
    ];

    return (
        <>
            <DocumentSheet
                eyebrow="Lorry Challan"
                title={str(get(c, 'challan_no')) ?? 'Challan'}
                status={cancelled ? 'Cancelled' : status}
                statusTone={cancelled ? 'danger' : 'success'}
                meta={
                    <span>
                        {fmtDate(get(c, 'date_from') as string)} · {upper(get(c, 'loading_point')) || originBranch?.name || '—'}
                        {' → '}
                        {upper(get(c, 'destination_point')) || destBranch?.name || '—'}
                    </span>
                }
                actions={
                    <>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
                            <RotateCcw className="h-4 w-4" /> New search
                        </Button>
                        <Button size="sm" className="gap-1.5" onClick={() => setPrintOpen(true)}>
                            <Printer className="h-4 w-4" /> Official copy
                        </Button>
                    </>
                }
            >
                <SheetSection title="Trip & Vehicle" icon={<Truck className="h-3.5 w-3.5" />}>
                    <SheetInfoGrid>
                        <SheetField label="Vehicle No" value={upper(get(c, 'vehicle_no'))} mono accent />
                        <SheetField label="Vehicle Type" value={upper(get(c, 'vehicle_type'))} />
                        <SheetField label="Date From" value={fmtDate(get(c, 'date_from') as string)} />
                        <SheetField label="Date To" value={fmtDate(get(c, 'date_to') as string)} />
                        <SheetField label="Loading Point" value={upper(get(c, 'loading_point'))} />
                        <SheetField label="Destination Point" value={upper(get(c, 'destination_point'))} />
                        <SheetField label="Truck Reach By" value={fmtDate(get(c, 'truck_schedule_date') as string)} />
                        <SheetField label="Trip Distance" value={str(get(c, 'trip_distance'))} />
                    </SheetInfoGrid>
                </SheetSection>

                <div className="grid gap-5 lg:grid-cols-2">
                    <SheetSection title="Driver" icon={<User className="h-3.5 w-3.5" />}>
                        <SheetInfoGrid columns={2}>
                            <SheetField label="Name" value={upper(get(c, 'driver_name'))} accent />
                            <SheetField label="Mobile" value={str(get(c, 'driver_mobile'))} mono />
                            <SheetField label="DL No" value={upper(get(c, 'driver_dl_no'))} mono />
                            <SheetField label="DL Validity" value={fmtDate(get(c, 'driver_dl_validity') as string)} />
                            <SheetField label="Address" value={upper(get(c, 'driver_address'))} className="col-span-full" />
                        </SheetInfoGrid>
                    </SheetSection>

                    <SheetSection title={isDirect ? 'Owner' : 'Broker'} icon={<Users className="h-3.5 w-3.5" />}>
                        <SheetInfoGrid columns={2}>
                            {isDirect ? (
                                <>
                                    <SheetField label="Owner Name" value={upper(get(c, 'owner_name'))} accent />
                                    <SheetField label="PAN" value={upper(get(c, 'owner_pan'))} mono />
                                    <SheetField label="Mobile" value={str(get(c, 'owner_mobile'))} mono />
                                    <SheetField label="Slip No" value={upper(get(c, 'slip_no'))} mono />
                                    <SheetField label="Address" value={upper(get(c, 'owner_address'))} className="col-span-full" />
                                </>
                            ) : (
                                <>
                                    <SheetField label="Broker Name" value={upper(get(c, 'broker_name'))} accent />
                                    <SheetField label="Code" value={upper(get(c, 'broker_code'))} mono />
                                    <SheetField label="Mobile" value={str(get(c, 'broker_mobile'))} mono />
                                    <SheetField label="Slip No" value={upper(get(c, 'slip_no'))} mono />
                                    <SheetField label="Address" value={upper(get(c, 'broker_address'))} className="col-span-full" />
                                </>
                            )}
                        </SheetInfoGrid>
                    </SheetSection>
                </div>

                <SheetSection
                    title="Linked Consignments"
                    icon={<Receipt className="h-3.5 w-3.5" />}
                    right={`${linkedCnNos.length} CN${linkedCnNos.length === 1 ? '' : 's'}`}
                >
                    {loadingLinked ? (
                        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading linked consignments…
                        </div>
                    ) : (
                        <SheetDataTable
                            columns={cnColumns}
                            rows={linked}
                            getRowKey={(r, i) => `${r.cn_no}-${i}`}
                            emptyText="No consignments linked to this challan."
                        />
                    )}
                </SheetSection>

                <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                    <SheetSection title="Lorry Hire Details" icon={<Receipt className="h-3.5 w-3.5" />}>
                        <SheetDataTable
                            columns={chargeColumns}
                            rows={chargeRows}
                            getRowKey={(r) => r.label}
                            footer={
                                <tr>
                                    <td className="border border-[var(--doc-line-soft)] bg-[var(--doc-head-bg)] px-2.5 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-[var(--doc-head-fg)]">
                                        Total Gross Hire
                                    </td>
                                    <td className="border border-[var(--doc-line-soft)] bg-[var(--doc-head-bg)] px-2.5 py-2 text-right font-mono text-sm font-black text-foreground">
                                        {money(totalHire, true)}
                                    </td>
                                </tr>
                            }
                        />
                    </SheetSection>

                    <SheetSection title="Settlement">
                        <div className="space-y-3">
                            <SheetField label="Total Gross Hire" value={money(totalHire, true)} mono accent />
                            <SheetField label={`Less TDS (${num(get(c, 'tds_percent'))}%)`} value={money(lessTds)} mono />
                            <SheetField label="Less Advance" value={money(advance)} mono />
                            <SheetField label="Net Balance Payable" value={money(balance, true)} mono />
                        </div>
                    </SheetSection>
                </div>

                <SheetSection title="Payment Status" icon={<Wallet className="h-3.5 w-3.5" />}>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        <span
                            className={
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ' +
                                (isPaid
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-amber-200 bg-amber-50 text-amber-700')
                            }
                        >
                            {isPaid ? 'Fully Settled' : 'Payment Pending'}
                        </span>
                        {!isPaid ? (
                            <span className="text-sm text-muted-foreground">
                                Pending amount:{' '}
                                <span className="font-mono font-bold text-amber-700">{money(pending, true)}</span>
                            </span>
                        ) : lastReceiptDate ? (
                            <span className="text-sm text-muted-foreground">
                                Last received on <span className="font-semibold text-foreground">{fmtDate(lastReceiptDate)}</span>
                            </span>
                        ) : null}
                    </div>

                    <SheetInfoGrid>
                        <SheetField
                            label="Broker Bill Status"
                            value={brokerBill ? 'Billed to broker' : 'Not yet billed'}
                            accent={Boolean(brokerBill)}
                        />
                        <SheetField label="Broker Bill Ref" value={brokerBill?.bill_ref_no ?? undefined} mono />
                        <SheetField label="Billed On" value={brokerBill ? fmtDate(brokerBill.billing_date) : undefined} />
                        <SheetField label="Billed Amount" value={brokerBill ? money(brokerBill.amount, true) : undefined} mono />
                        <SheetField label="Amount Received" value={money(paidTotal, true)} mono />
                        <SheetField label="Last Received Date" value={lastReceiptDate ? fmtDate(lastReceiptDate) : undefined} />
                        <SheetField
                            label="Amount Pending"
                            value={
                                <span className={pending > 0.005 ? 'text-amber-600' : 'text-emerald-600'}>
                                    {money(pending, true)}
                                </span>
                            }
                        />
                        <SheetField label="Receipts" value={num(payments.length)} mono />
                    </SheetInfoGrid>

                    {payments.length > 0 ? (
                        <div className="mt-4">
                            <SheetDataTable
                                columns={paymentColumns}
                                rows={payments}
                                getRowKey={(r) => r.id}
                                emptyText="No payments recorded."
                            />
                        </div>
                    ) : null}
                </SheetSection>

                {str(get(c, 'remarks')) ? (
                    <SheetSection title="Remarks">
                        <p className="text-sm text-foreground">{String(get(c, 'remarks'))}</p>
                    </SheetSection>
                ) : null}
            </DocumentSheet>

            <ChallanDetailsDialog isOpen={printOpen} onClose={() => setPrintOpen(false)} challan={challan} />
        </>
    );
}
