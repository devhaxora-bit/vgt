'use client';

import * as React from 'react';
import { Printer, RotateCcw, MapPin, User, Package, Receipt, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConsignmentDetailsDialog } from '@/components/features/consignments/ConsignmentDetailsDialog';
import {
    DocumentSheet,
    SheetSection,
    SheetInfoGrid,
    SheetField,
    SheetDataTable,
    type SheetColumn,
} from './DocumentSheet';
import { money, num, upper, fmtDate } from './queryFormat';

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

export function CnsResultSheet({ consignment, reset }: { consignment: Cn; reset: () => void }) {
    const [printOpen, setPrintOpen] = React.useState(false);
    const c = consignment;

    const cancelled = Boolean(get(c, 'cancel_cn'));
    const loadUnit = upper(get(c, 'load_unit')) || 'MT';

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
                    <span>
                        Booked {fmtDate(get(c, 'bkg_date') as string)} · {upper(get(c, 'booking_branch')) || '—'}
                        {' → '}
                        {upper(get(c, 'dest_branch')) || upper(get(c, 'delivery_point')) || '—'}
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
        </>
    );
}
