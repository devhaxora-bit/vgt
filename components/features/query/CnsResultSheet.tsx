'use client';

import * as React from 'react';
import { Printer, RotateCcw, MapPin, User, Package, Receipt, Building2, Link2, Wallet, Truck, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConsignmentDetailsDialog } from '@/components/features/consignments/ConsignmentDetailsDialog';
import { BillingRecordViewDialog } from '@/components/features/ledger/BillingRecordDialogs';
import {
    DocumentSheet,
    SheetSection,
    SheetInfoGrid,
    SheetField,
    SheetDataTable,
    type SheetColumn,
} from './DocumentSheet';
import { money, num, upper, fmtDate, toNum } from './queryFormat';
import type { QueryCnsDetail, QueryConsignment, QueryCnsChallan, QueryLinkedBill } from '@/lib/types/query.types';

type Cn = Record<string, unknown>;

interface ChargeRow {
    label: string;
    amount: unknown;
    note?: string;
}

const get = (record: Cn, key: string): unknown => record[key];
const str = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text || undefined;
};

export function CnsResultSheet({ detail, reset }: { detail: QueryCnsDetail; reset: () => void }) {
    const [printOpen, setPrintOpen] = React.useState(false);
    const [billOpen, setBillOpen] = React.useState(false);
    const [billDetail, setBillDetail] = React.useState<{
        party: Record<string, unknown> | null;
        record: Record<string, unknown> | null;
        consignments: QueryConsignment[];
    } | null>(null);
    const [loadingBillId, setLoadingBillId] = React.useState<string | null>(null);

    const consignment = detail.consignment;
    const c = consignment;

    const cancelled = Boolean(get(c, 'cancel_cn'));
    const loadUnit = upper(get(c, 'load_unit')) || 'MT';

    const children = detail.children ?? [];
    const challans = detail.challans ?? [];
    const bills = detail.bills ?? (detail.bill ? [detail.bill] : []);
    const isChild = Boolean(get(c, 'parent_cn_id'));
    const freightPending = Boolean(get(c, 'freight_pending'));

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
            // fall through
        } finally {
            setLoadingBillId(null);
        }
    };

    const childColumns: SheetColumn<QueryConsignment>[] = [
        { key: 'cn', header: 'CN No', cell: (r) => <span className="font-mono font-semibold">{r.cn_no}</span> },
        { key: 'date', header: 'Date', cell: (r) => fmtDate(r.bkg_date) },
        { key: 'consignor', header: 'Consignor', cell: (r) => upper(r.consignor_name) || '—' },
        {
            key: 'route',
            header: 'Route',
            cell: (r) => `${upper(r.loading_point || r.booking_branch) || '—'} → ${upper(r.delivery_point || r.dest_branch) || '—'}`,
        },
        { key: 'pkg', header: 'Pkg', align: 'right', cell: (r) => num(r.total_qty ?? r.no_of_pkg) },
        { key: 'wt', header: 'Charged Wt', align: 'right', cell: (r) => num(r.charged_weight) },
    ];

    const challanColumns: SheetColumn<QueryCnsChallan>[] = [
        { key: 'no', header: 'Challan No', cell: (r) => <span className="font-mono font-semibold">{r.challan_no}</span> },
        { key: 'date', header: 'Date', cell: (r) => fmtDate(r.date_from) },
        { key: 'vehicle', header: 'Vehicle', cell: (r) => upper(r.vehicle_no) || '—' },
        { key: 'broker', header: 'Broker', cell: (r) => upper(r.broker_name) || '—' },
        { key: 'branch', header: 'Branch', cell: (r) => upper(r.branch) || '—' },
        {
            key: 'status',
            header: 'Status',
            cell: (r) => (
                <Badge
                    variant="outline"
                    className={
                        r.status === 'settled'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : r.status === 'cancelled'
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                    }
                >
                    {r.status ?? '—'}
                </Badge>
            ),
        },
        { key: 'hire', header: 'Total Hire', align: 'right', cell: (r) => money(r.total_hire, true), className: 'font-mono' },
    ];

    const chargeRows: ChargeRow[] = [
        { label: 'Basic Freight', amount: get(c, 'basic_freight'), note: str(get(c, 'freight_rate')) ? `Rate ${num(get(c, 'freight_rate'))}` : undefined },
        { label: 'Unloading Charges', amount: get(c, 'unload_charges') },
        { label: 'Detention Charges', amount: get(c, 'retention_charges') },
        { label: 'Extra KM Charges', amount: get(c, 'extra_km_charges') },
        { label: 'Loading / MHC Charges', amount: get(c, 'mhc_charges') },
        { label: 'Door Collection', amount: get(c, 'door_coll_charges') },
        { label: 'Door Delivery', amount: get(c, 'door_del_charges') },
        { label: 'Traffic Challan Charges', amount: get(c, 'traffic_challan_charges') },
        { label: 'Other Charges', amount: get(c, 'other_charges') },
    ];

    const chargeColumns: SheetColumn<ChargeRow>[] = [
        {
            key: 'label',
            header: 'Particulars',
            cell: (row) => (
                <span className="font-medium">
                    {row.label}
                    {row.note ? <span className="ml-2 text-[11px] text-muted-foreground">({row.note})</span> : null}
                </span>
            ),
        },
        { key: 'amount', header: 'Amount', align: 'right', cell: (row) => money(row.amount), className: 'font-mono' },
    ];

    return (
        <>
            <DocumentSheet
                eyebrow="Consignment Note"
                title={str(get(c, 'cn_no')) ?? 'CNS'}
                status={cancelled ? 'Cancelled' : 'Active'}
                statusTone={cancelled ? 'danger' : 'success'}
                meta={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                            Booked {fmtDate(get(c, 'bkg_date') as string)} · {upper(get(c, 'booking_branch')) || '—'}
                            {' → '}
                            {upper(get(c, 'dest_branch')) || upper(get(c, 'delivery_point')) || '—'}
                        </span>
                        {isChild && detail.parent_cn_no ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                <Link2 className="h-3 w-3" /> Freight included in {detail.parent_cn_no}
                            </span>
                        ) : null}
                    </span>
                }
                actions={
                    <>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
                            <RotateCcw className="h-4 w-4" /> New search
                        </Button>
                        {bills.length === 1 && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => handleOpenBill(bills[0])}
                                disabled={loadingBillId === bills[0].id}
                            >
                                <Download className="h-4 w-4" />
                                {loadingBillId === bills[0].id ? 'Loading…' : 'Download Bill'}
                            </Button>
                        )}
                        <Button size="sm" className="gap-1.5" onClick={() => setPrintOpen(true)}>
                            <Printer className="h-4 w-4" /> Official copy
                        </Button>
                    </>
                }
            >
                <SheetSection title="Route & Booking" icon={<MapPin className="h-3.5 w-3.5" />}>
                    <SheetInfoGrid>
                        <SheetField label="Booking Branch" value={upper(get(c, 'booking_branch'))} />
                        <SheetField label="Destination Branch" value={upper(get(c, 'dest_branch'))} />
                        <SheetField label="Loading Point" value={upper(get(c, 'loading_point'))} />
                        <SheetField label="Delivery Point" value={upper(get(c, 'delivery_point'))} />
                        <SheetField label="Delivery Type" value={upper(get(c, 'delivery_type'))} />
                        <SheetField label="Booking Basis" value={upper(get(c, 'bkg_basis'))} />
                        <SheetField label="Vehicle No" value={upper(get(c, 'vehicle_no'))} mono />
                        <SheetField label="Invoice No" value={str(get(c, 'invoice_no'))} mono />
                    </SheetInfoGrid>
                </SheetSection>

                <div className="grid gap-5 lg:grid-cols-2">
                    <SheetSection title="Consignor" icon={<User className="h-3.5 w-3.5" />}>
                        <SheetInfoGrid columns={2}>
                            <SheetField label="Name" value={upper(get(c, 'consignor_name'))} accent />
                            <SheetField label="GSTIN" value={upper(get(c, 'consignor_gst'))} mono />
                            <SheetField label="Mobile" value={str(get(c, 'consignor_mobile'))} mono />
                            <SheetField label="Pincode" value={str(get(c, 'consignor_pincode'))} mono />
                            <SheetField label="Address" value={upper(get(c, 'consignor_address'))} className="col-span-full" />
                        </SheetInfoGrid>
                    </SheetSection>

                    <SheetSection title="Consignee" icon={<User className="h-3.5 w-3.5" />}>
                        <SheetInfoGrid columns={2}>
                            <SheetField label="Name" value={upper(get(c, 'consignee_name'))} accent />
                            <SheetField label="GSTIN" value={upper(get(c, 'consignee_gst'))} mono />
                            <SheetField label="Mobile" value={str(get(c, 'consignee_mobile'))} mono />
                            <SheetField label="Pincode" value={str(get(c, 'consignee_pincode'))} mono />
                            <SheetField label="Address" value={upper(get(c, 'consignee_address'))} className="col-span-full" />
                        </SheetInfoGrid>
                    </SheetSection>
                </div>

                <SheetSection title="Billing Party" icon={<Building2 className="h-3.5 w-3.5" />}>
                    <SheetInfoGrid>
                        <SheetField label="Party" value={upper(get(c, 'billing_party'))} accent />
                        <SheetField label="Code" value={upper(get(c, 'billing_party_code'))} mono />
                        <SheetField label="GSTIN" value={upper(get(c, 'billing_party_gst'))} mono />
                        <SheetField label="Bill For Station" value={upper(get(c, 'billing_branch'))} />
                    </SheetInfoGrid>
                </SheetSection>

                <SheetSection title="Goods Details" icon={<Package className="h-3.5 w-3.5" />}>
                    <SheetInfoGrid>
                        <SheetField label="No. of Packages" value={num(get(c, 'no_of_pkg'))} mono />
                        <SheetField label="Total Quantity" value={num(get(c, 'total_qty'))} mono />
                        <SheetField label="Actual Weight" value={`${num(get(c, 'actual_weight'))} ${loadUnit}`} mono />
                        <SheetField label="Charged Weight" value={`${num(get(c, 'charged_weight'))} ${loadUnit}`} mono />
                        <SheetField label="Goods Class" value={upper(get(c, 'goods_class'))} />
                        <SheetField label="HSN / Description" value={upper(get(c, 'hsn_desc')) || upper(get(c, 'goods_desc'))} />
                        <SheetField label="Goods Value" value={money(get(c, 'goods_value'))} mono />
                        <SheetField label="Private Mark" value={upper(get(c, 'private_mark'))} />
                    </SheetInfoGrid>
                </SheetSection>

                <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                    <SheetSection title="Freight Breakdown" icon={<Receipt className="h-3.5 w-3.5" />}>
                        <SheetDataTable
                            columns={chargeColumns}
                            rows={chargeRows}
                            getRowKey={(row) => row.label}
                            footer={
                                <tr>
                                    <td className="border border-[var(--doc-line-soft)] bg-[var(--doc-head-bg)] px-2.5 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-[var(--doc-head-fg)]">
                                        Total Freight
                                    </td>
                                    <td className="border border-[var(--doc-line-soft)] bg-[var(--doc-head-bg)] px-2.5 py-2 text-right font-mono text-sm font-black text-foreground">
                                        {money(get(c, 'total_freight'), true)}
                                    </td>
                                </tr>
                            }
                        />
                    </SheetSection>

                    <SheetSection title="Settlement">
                        <div className="space-y-3">
                            <SheetField label="Total Freight" value={money(get(c, 'total_freight'), true)} mono accent />
                            <SheetField label="Advance Paid" value={money(get(c, 'advance_amount'))} mono />
                            <SheetField label="Balance Payable" value={money(get(c, 'balance_amount'), true)} mono />
                            <SheetField label="Amount In Words" value={str(get(c, 'amount_in_words'))} />
                        </div>
                    </SheetSection>
                </div>

                <SheetSection title="Billing & Payment" icon={<Wallet className="h-3.5 w-3.5" />}>
                    <SheetInfoGrid>
                        <SheetField
                            label="Billing Status"
                            value={
                                <span
                                    className={
                                        bills.length > 0
                                            ? 'text-emerald-600'
                                            : freightPending
                                                ? 'text-amber-600'
                                                : 'text-muted-foreground'
                                    }
                                >
                                    {bills.length > 0
                                        ? `Billed (${bills.length} bill${bills.length === 1 ? '' : 's'})`
                                        : freightPending
                                            ? 'Freight Pending'
                                            : 'Not Billed'}
                                </span>
                            }
                        />
                        <SheetField label="Freight Pending" value={freightPending ? 'Yes' : 'No'} />
                        <SheetField label="Advance Received" value={money(get(c, 'advance_amount'))} mono />
                        <SheetField
                            label="Balance Pending"
                            value={
                                <span className={toNum(get(c, 'balance_amount')) > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                                    {money(get(c, 'balance_amount'), true)}
                                </span>
                            }
                        />
                    </SheetInfoGrid>

                    {bills.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {bills.map((b) => (
                                <div
                                    key={b.id}
                                    className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2.5"
                                >
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <div>
                                            <p className="font-mono text-sm font-semibold">{b.bill_ref_no ?? '—'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {fmtDate(b.billing_date)} · {upper(b.party_name) || '—'} ·{' '}
                                                <span className={b.status === 'ACTIVE' ? 'text-emerald-600' : 'text-red-500'}>
                                                    {b.status}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-sm font-semibold">{money(b.amount, true)}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1 text-xs"
                                            onClick={() => handleOpenBill(b)}
                                            disabled={loadingBillId === b.id}
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                            {loadingBillId === b.id ? 'Loading…' : 'Download'}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SheetSection>

                {challans.length > 0 ? (
                    <SheetSection
                        title="Linked Challans"
                        icon={<Truck className="h-3.5 w-3.5" />}
                        right={`${challans.length} challan${challans.length === 1 ? '' : 's'}`}
                    >
                        <SheetDataTable
                            columns={challanColumns}
                            rows={challans}
                            getRowKey={(r) => r.id}
                        />
                    </SheetSection>
                ) : null}

                {children.length > 0 ? (
                    <SheetSection
                        title="Included Consignments"
                        icon={<Link2 className="h-3.5 w-3.5" />}
                        right={`${children.length} freight-included CN${children.length === 1 ? '' : 's'}`}
                    >
                        <p className="mb-3 text-xs text-muted-foreground">
                            These consignments have their freight included in this CN, so their own freight is nil.
                        </p>
                        <SheetDataTable
                            columns={childColumns}
                            rows={children}
                            getRowKey={(r, i) => `${r.cn_no}-${i}`}
                        />
                    </SheetSection>
                ) : null}

                {str(get(c, 'remarks')) ? (
                    <SheetSection title="Remarks">
                        <p className="text-sm text-foreground">{String(get(c, 'remarks'))}</p>
                    </SheetSection>
                ) : null}
            </DocumentSheet>

            <ConsignmentDetailsDialog
                isOpen={printOpen}
                onClose={() => setPrintOpen(false)}
                consignment={consignment}
                isAdmin={false}
            />

            {billDetail && (
                <BillingRecordViewDialog
                    open={billOpen}
                    onClose={() => { setBillOpen(false); setBillDetail(null); }}
                    party={billDetail.party as never}
                    record={billDetail.record as never}
                    consignments={billDetail.consignments as never}
                    isAdmin={false}
                    onEdit={() => setBillOpen(false)}
                />
            )}
        </>
    );
}
