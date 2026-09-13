'use client';

import * as React from 'react';
import {
    RotateCcw,
    Download,
    FileText,
    AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConsignmentDetailsDialog } from '@/components/features/consignments/ConsignmentDetailsDialog';
import { BillingRecordViewDialog } from '@/components/features/ledger/BillingRecordDialogs';
import { SheetDataTable, type SheetColumn } from './DocumentSheet';
import { QueryRefLink, useQueryDocDialogs } from './QueryDocDialogs';
import { money, upper, fmtDate, toNum } from './queryFormat';
import type {
    QueryCnsDetail,
    QueryConsignment,
    QueryCnsChallan,
    QueryLinkedBill,
    QueryLinkedPayment,
} from '@/lib/types/query.types';
import { cn } from '@/lib/utils';

type Cn = Record<string, unknown>;

const get = (record: Cn, key: string): unknown => record[key];
const str = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text || undefined;
};

function TrackPanel({
    title,
    right,
    children,
    className,
    bodyClassName,
}: {
    title: React.ReactNode;
    right?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={cn('overflow-hidden rounded-md border bg-card', className)}>
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground">{title}</h3>
                {right}
            </div>
            <div className={cn('p-0', bodyClassName)}>{children}</div>
        </section>
    );
}

function PartyLine({ label, value }: { label: string; value?: string }) {
    return (
        <div className="min-w-0 text-xs">
            <span className="font-bold text-primary">{label}</span>
            <span className="mx-1 text-muted-foreground">:</span>
            <span className="font-semibold text-foreground">{value || '—'}</span>
        </div>
    );
}

function FreightLine({ label, amount, emphasize }: { label: string; amount: number; emphasize?: boolean }) {
    if (!emphasize && Math.abs(amount) < 0.005) return null;
    return (
        <div className={cn('flex items-center justify-between gap-3 text-xs', emphasize && 'border-t pt-1.5 font-bold')}>
            <span className={emphasize ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
            <span className={cn('font-mono tabular-nums', emphasize ? 'text-primary' : 'text-foreground')}>
                ₹{money(amount)}
            </span>
        </div>
    );
}

export function CnsResultSheet({ detail, reset }: { detail: QueryCnsDetail; reset: () => void }) {
    const [printOpen, setPrintOpen] = React.useState(false);
    const [billOpen, setBillOpen] = React.useState(false);
    const [billDetail, setBillDetail] = React.useState<{
        party: Record<string, unknown> | null;
        record: Record<string, unknown> | null;
        consignments: QueryConsignment[];
    } | null>(null);
    const [loadingBillId, setLoadingBillId] = React.useState<string | null>(null);
    const docs = useQueryDocDialogs();

    const c = detail.consignment;
    const cancelled = Boolean(get(c, 'cancel_cn'));
    const loadUnit = upper(get(c, 'load_unit')) || 'MT';
    const children = detail.children ?? [];
    const challans = detail.challans ?? [];
    const bills = detail.bills ?? (detail.bill ? [detail.bill] : []);
    const payments = detail.payments ?? [];
    const freightPending = Boolean(get(c, 'freight_pending'));

    const basicFreight = toNum(get(c, 'basic_freight'));
    const unload = toNum(get(c, 'unload_charges'));
    const detention = toNum(get(c, 'retention_charges'));
    const extraKm = toNum(get(c, 'extra_km_charges'));
    const mhc = toNum(get(c, 'mhc_charges'));
    const doorColl = toNum(get(c, 'door_coll_charges'));
    const doorDel = toNum(get(c, 'door_del_charges'));
    const traffic = toNum(get(c, 'traffic_challan_charges'));
    const other = toNum(get(c, 'other_charges'));
    const totalFreight = toNum(get(c, 'total_freight'));
    const advance = toNum(get(c, 'advance_amount'));
    const balance = toNum(get(c, 'balance_amount'));
    const subTotal = basicFreight + unload + detention + extraKm + mhc + doorColl + doorDel + traffic + other;

    const eway = str(get(c, 'eway_bill')) || str(get(c, 'eway_bill_no'));
    const ewayTo = str(get(c, 'eway_to_date'));
    const ewayExpired = ewayTo ? new Date(ewayTo) < new Date() : false;

    const handleOpenBill = async (targetBill: QueryLinkedBill) => {
        if (!targetBill.id) return;
        setLoadingBillId(targetBill.id);
        try {
            const res = await fetch(`/api/query/bills?id=${encodeURIComponent(targetBill.id)}`);
            if (!res.ok) throw new Error('Could not load bill');
            const data = await res.json() as {
                record: Record<string, unknown>;
                party: Record<string, unknown>;
                consignments: QueryConsignment[];
            };
            setBillDetail({
                party: data.party ?? null,
                record: data.record ?? null,
                consignments: data.consignments ?? [],
            });
            setBillOpen(true);
        } catch {
            // ignore
        } finally {
            setLoadingBillId(null);
        }
    };

    const challanColumns: SheetColumn<QueryCnsChallan>[] = [
        {
            key: 'challan',
            header: 'Challan No',
            cell: (r) => (
                <QueryRefLink loading={docs.isLoading(`challan:${r.id}`)} onClick={() => void docs.openChallan(r)}>
                    {r.challan_no}
                </QueryRefLink>
            ),
        },
        { key: 'date', header: 'Date', cell: (r) => fmtDate(r.date_from) },
        { key: 'type', header: 'Type', cell: (r) => upper(r.challan_type) || '—' },
        { key: 'vehicle', header: 'Vehicle', cell: (r) => upper(r.vehicle_no) || '—' },
        { key: 'broker', header: 'Broker', cell: (r) => upper(r.broker_name) || '—' },
        { key: 'branch', header: 'Branch', cell: (r) => upper(r.branch) || '—' },
        { key: 'status', header: 'Status', cell: (r) => upper(r.status) || '—' },
        { key: 'hire', header: 'Hire', align: 'right', cell: (r) => `₹${money(r.total_hire)}` },
    ];

    const billColumns: SheetColumn<QueryLinkedBill>[] = [
        {
            key: 'bill',
            header: 'Bill No',
            cell: (r) => (
                <QueryRefLink
                    loading={docs.isLoading(`bill:${r.id}`) || loadingBillId === r.id}
                    onClick={() => void handleOpenBill(r)}
                >
                    {r.bill_ref_no || r.id.slice(0, 8).toUpperCase()}
                </QueryRefLink>
            ),
        },
        { key: 'date', header: 'Bill Date', cell: (r) => fmtDate(r.billing_date) },
        { key: 'party', header: 'Party', cell: (r) => upper(r.party_name) || '—' },
        { key: 'status', header: 'Status', cell: (r) => upper(r.status) || '—' },
        { key: 'amt', header: 'Amount', align: 'right', cell: (r) => `₹${money(r.amount)}` },
    ];

    const paymentColumns: SheetColumn<QueryLinkedPayment>[] = [
        { key: 'date', header: 'MR Date', cell: (r) => fmtDate(r.receipt_date) },
        { key: 'mode', header: 'Mode', cell: (r) => upper(r.payment_mode) || '—' },
        { key: 'ref', header: 'Reference', cell: (r) => r.reference_no || '—' },
        { key: 'status', header: 'Status', cell: (r) => upper(r.status) || '—' },
        { key: 'amt', header: 'Frt Recd', align: 'right', cell: (r) => `₹${money(r.amount)}` },
    ];

    const childColumns: SheetColumn<QueryConsignment>[] = [
        {
            key: 'cn',
            header: 'CN No',
            cell: (r) => (
                <QueryRefLink loading={docs.isLoading(`cn:${r.id || r.cn_no}`)} onClick={() => void docs.openCn(r)}>
                    {r.cn_no}
                </QueryRefLink>
            ),
        },
        { key: 'date', header: 'Date', cell: (r) => fmtDate(r.bkg_date) },
        { key: 'route', header: 'Route', cell: (r) => `${upper(r.loading_point || r.booking_branch) || '—'} → ${upper(r.delivery_point || r.dest_branch) || '—'}` },
        { key: 'pkg', header: 'Pkgs', align: 'right', cell: (r) => String(r.no_of_pkg ?? '—') },
        { key: 'wt', header: 'Act Wt', align: 'right', cell: (r) => r.actual_weight != null ? `${money(r.actual_weight)} ${upper(r.load_unit) || ''}` : '—' },
        { key: 'frt', header: 'Freight', align: 'right', cell: (r) => `₹${money(r.total_freight)}` },
    ];

    return (
        <div className="animate-slideUp space-y-3">
            {/* Top status / alert bar */}
            <div className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-black text-primary">{str(get(c, 'cn_no'))}</span>
                    <Badge variant={cancelled ? 'destructive' : 'default'}>
                        {cancelled ? 'Cancelled' : 'Active'}
                    </Badge>
                    {freightPending && <Badge variant="secondary">Freight Pending</Badge>}
                    {detail.parent_cn_no && (
                        <Badge variant="outline" className="font-mono">
                            Included in {detail.parent_cn_no}
                        </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                        Booked {fmtDate(get(c, 'bkg_date') as string)} · {upper(get(c, 'booking_branch')) || '—'} → {upper(get(c, 'dest_branch')) || '—'}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={reset}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> New search
                    </Button>
                    {bills[0] && (
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleOpenBill(bills[0])}>
                            <Download className="mr-1 h-3.5 w-3.5" /> Bill
                        </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
                        <FileText className="mr-1 h-3.5 w-3.5" /> CN Copy
                    </Button>
                </div>
            </div>

            {ewayExpired && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    eWay bill {eway || ''} already expired{ewayTo ? ` on ${fmtDate(ewayTo)}` : ''}.
                </div>
            )}

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
                <div className="min-w-0 space-y-3">
                    {/* Summary table */}
                    <TrackPanel title="Consignment Summary">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] border-collapse text-xs">
                                <thead>
                                    <tr className="bg-muted/50">
                                        {['Booking Dt', 'Dstn', 'Pkgs', 'Act Wt', 'Chrg Wt', 'Basis', 'Bill Stn', 'Delivery Type', 'Load Type', 'Goods Value', 'Goods Desc', 'Vehicle'].map((h) => (
                                            <th key={h} className="border-b px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border-b px-2 py-1.5 whitespace-nowrap">{fmtDate(get(c, 'bkg_date') as string)}</td>
                                        <td className="border-b px-2 py-1.5 font-semibold">{upper(get(c, 'delivery_point') || get(c, 'dest_branch')) || '—'}</td>
                                        <td className="border-b px-2 py-1.5 font-mono">{String(get(c, 'no_of_pkg') ?? '—')}</td>
                                        <td className="border-b px-2 py-1.5 font-mono whitespace-nowrap">{get(c, 'actual_weight') != null ? `${money(get(c, 'actual_weight'))} ${loadUnit}` : '—'}</td>
                                        <td className="border-b px-2 py-1.5 font-mono whitespace-nowrap">{get(c, 'charged_weight') != null ? `${money(get(c, 'charged_weight'))} ${loadUnit}` : '—'}</td>
                                        <td className="border-b px-2 py-1.5">{upper(get(c, 'bkg_basis')) || '—'}</td>
                                        <td className="border-b px-2 py-1.5">{upper(get(c, 'billing_branch') || get(c, 'booking_branch')) || '—'}</td>
                                        <td className="border-b px-2 py-1.5">{upper(get(c, 'delivery_type')) || '—'}</td>
                                        <td className="border-b px-2 py-1.5">{loadUnit}</td>
                                        <td className="border-b px-2 py-1.5 font-mono">{get(c, 'goods_value') != null ? `₹${money(get(c, 'goods_value'))}` : '—'}</td>
                                        <td className="border-b px-2 py-1.5 max-w-[180px] truncate" title={str(get(c, 'goods_desc'))}>{upper(get(c, 'goods_desc')) || '—'}</td>
                                        <td className="border-b px-2 py-1.5 font-mono">{upper(get(c, 'vehicle_no')) || '—'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="grid gap-2 border-t bg-muted/20 px-3 py-2 md:grid-cols-3">
                            <PartyLine label="Cnor" value={upper(get(c, 'consignor_name'))} />
                            <PartyLine label="Cnee" value={upper(get(c, 'consignee_name'))} />
                            <PartyLine label="Billing" value={upper(get(c, 'billing_party') || get(c, 'billing_party_name'))} />
                        </div>
                        <div className="grid gap-x-4 gap-y-1 border-t px-3 py-2 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                            <div>Cnor GST: <span className="font-mono text-foreground">{str(get(c, 'consignor_gst')) || '—'}</span></div>
                            <div>Cnee GST: <span className="font-mono text-foreground">{str(get(c, 'consignee_gst')) || '—'}</span></div>
                            <div>Billing GST: <span className="font-mono text-foreground">{str(get(c, 'billing_party_gst')) || '—'}</span></div>
                            <div>Invoice: <span className="font-mono text-foreground">{str(get(c, 'invoice_no')) || '—'}</span></div>
                            <div>eWay: <span className="font-mono text-foreground">{eway || '—'}</span></div>
                            <div>Loading: <span className="text-foreground">{upper(get(c, 'loading_point') || get(c, 'booking_branch')) || '—'}</span></div>
                            <div>Delivery Pt: <span className="text-foreground">{upper(get(c, 'delivery_point')) || '—'}</span></div>
                            <div>Insurance: <span className="text-foreground">{upper(get(c, 'insurance_comp')) || '—'}</span></div>
                        </div>
                    </TrackPanel>

                    {/* Delivery / movement status */}
                    <TrackPanel
                        title={
                            <span>
                                CNS Status :{' '}
                                <span className="normal-case tracking-normal font-semibold text-primary">
                                    {cancelled
                                        ? 'Cancelled'
                                        : challans.length > 0
                                            ? `On movement · last challan ${challans[0]?.challan_no || '—'}`
                                            : 'Booked / awaiting dispatch'}
                                </span>
                            </span>
                        }
                    >
                        <div className="overflow-x-auto p-2">
                            <table className="w-full min-w-[700px] border-collapse text-xs">
                                <thead>
                                    <tr className="bg-muted/50">
                                        {['Branch', 'Loading', 'Delivery', 'Vehicle', 'Pkgs', 'Act Wt', 'Deliv Type', 'Challan'].map((h) => (
                                            <th key={h} className="border-b px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="px-2 py-1.5">{upper(get(c, 'booking_branch')) || '—'}</td>
                                        <td className="px-2 py-1.5">{upper(get(c, 'loading_point')) || '—'}</td>
                                        <td className="px-2 py-1.5">{upper(get(c, 'delivery_point') || get(c, 'dest_branch')) || '—'}</td>
                                        <td className="px-2 py-1.5 font-mono">{upper(get(c, 'vehicle_no')) || '—'}</td>
                                        <td className="px-2 py-1.5 font-mono">{String(get(c, 'no_of_pkg') ?? '—')}</td>
                                        <td className="px-2 py-1.5 font-mono">{get(c, 'actual_weight') != null ? `${money(get(c, 'actual_weight'))}` : '—'}</td>
                                        <td className="px-2 py-1.5">{upper(get(c, 'delivery_type')) || '—'}</td>
                                        <td className="px-2 py-1.5 font-mono">{challans[0]?.challan_no || '—'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </TrackPanel>

                    {/* Bill | Payment side by side */}
                    <div className="grid gap-3 lg:grid-cols-2">
                        <TrackPanel title="Bill Dtl" bodyClassName="p-2">
                            <SheetDataTable
                                columns={billColumns}
                                rows={bills}
                                getRowKey={(r) => r.id}
                                emptyText="No bill linked to this CN."
                            />
                        </TrackPanel>
                        <TrackPanel title="MR Dtl / Payments" bodyClassName="p-2">
                            <SheetDataTable
                                columns={paymentColumns}
                                rows={payments}
                                getRowKey={(r) => r.id}
                                emptyText="No payment receipt linked yet."
                            />
                        </TrackPanel>
                    </div>

                    {/* Challans */}
                    <TrackPanel title="Challan & Transit Details" bodyClassName="p-2">
                        <SheetDataTable
                            columns={challanColumns}
                            rows={challans}
                            getRowKey={(r) => r.id}
                            emptyText="No challan linked to this CN."
                        />
                    </TrackPanel>

                    {children.length > 0 && (
                        <TrackPanel title={`Included Consignments (${children.length})`} bodyClassName="p-2">
                            <SheetDataTable
                                columns={childColumns}
                                rows={children}
                                getRowKey={(r) => r.id || r.cn_no}
                            />
                        </TrackPanel>
                    )}

                    {str(get(c, 'remarks')) && (
                        <TrackPanel title="Remarks" bodyClassName="p-3 text-xs">
                            {str(get(c, 'remarks'))}
                        </TrackPanel>
                    )}
                </div>

                {/* Freight sidebar */}
                <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
                    <TrackPanel title="Freight Details" bodyClassName="space-y-1.5 p-3">
                        <FreightLine label="Basic Freight" amount={basicFreight} />
                        <FreightLine label="Unloading" amount={unload} />
                        <FreightLine label="Detention" amount={detention} />
                        <FreightLine label="Extra KM" amount={extraKm} />
                        <FreightLine label="MHC / Loading" amount={mhc} />
                        <FreightLine label="Door Collection" amount={doorColl} />
                        <FreightLine label="Door Delivery" amount={doorDel} />
                        <FreightLine label="Traffic Challan" amount={traffic} />
                        <FreightLine label="Other Charges" amount={other} />
                        <FreightLine label="Sub Total" amount={subTotal || totalFreight} emphasize />
                        <FreightLine label="Advance" amount={advance} />
                        <FreightLine label="Balance" amount={balance || Math.max((subTotal || totalFreight) - advance, 0)} />
                        <FreightLine label="Grand Total" amount={totalFreight || subTotal} emphasize />
                        {str(get(c, 'freight_rate')) && (
                            <div className="pt-1 text-[10px] text-muted-foreground">
                                Rate {money(get(c, 'freight_rate'))} / {loadUnit}
                            </div>
                        )}
                    </TrackPanel>

                    <TrackPanel title="Quick Flags" bodyClassName="space-y-1 p-3 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Billed</span><span className="font-semibold">{bills.some((b) => b.status === 'ACTIVE') ? 'Yes' : 'No'}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-semibold">{payments.length > 0 ? 'Partial/Yes' : 'No'}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Challans</span><span className="font-mono font-semibold">{challans.length}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Included CNs</span><span className="font-mono font-semibold">{children.length}</span></div>
                    </TrackPanel>
                </aside>
            </div>

            {docs.dialogs}

            <ConsignmentDetailsDialog
                isOpen={printOpen}
                onClose={() => setPrintOpen(false)}
                consignment={c}
            />

            <BillingRecordViewDialog
                open={billOpen}
                onClose={() => setBillOpen(false)}
                party={billDetail?.party as never}
                record={billDetail?.record as never}
                consignments={(billDetail?.consignments || []) as never}
                isAdmin={false}
                onEdit={() => undefined}
            />
        </div>
    );
}
