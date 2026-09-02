'use client';

import * as React from 'react';
import { Printer, RotateCcw, Building2, FileText, Wallet, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { numberToWords } from '@/lib/utils';
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
import type { QueryBillDetail } from '@/lib/types/query.types';

type SnapRow = Record<string, unknown>;
const get = (record: Record<string, unknown>, key: string): unknown => record[key];
const str = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text || undefined;
};

export function BillResultSheet({ detail, reset }: { detail: QueryBillDetail; reset: () => void }) {
    const [printOpen, setPrintOpen] = React.useState(false);
    const { record, party } = detail;
    const summary = detail.party_summary;
    const payments = detail.payments ?? [];

    const status = String(get(record, 'status') || 'ACTIVE');
    const cancelled = status.toUpperCase() === 'CANCELLED';
    const amount = toNum(get(record, 'amount'));
    const billRef = str(get(record, 'bill_ref_no')) ?? '—';

    const snapshot = Array.isArray(get(record, 'consignment_snapshot'))
        ? (get(record, 'consignment_snapshot') as SnapRow[])
        : [];
    const vehicleCancel = Array.isArray(get(record, 'vehicle_cancel_items'))
        ? (get(record, 'vehicle_cancel_items') as SnapRow[])
        : [];
    const issuingBranch = upper(snapshot[0]?.booking_branch) || upper(party?.branch_code) || '—';

    const combinedOther = (row: SnapRow) =>
        toNum(get(row, 'other_charges')) +
        toNum(get(row, 'door_collection')) +
        toNum(get(row, 'door_delivery')) +
        toNum(get(row, 'traffic_challan'));

    const columns: SheetColumn<SnapRow>[] = [
        { key: 'sl', header: '#', align: 'center', cell: (_r, i) => i + 1, width: '36px' },
        { key: 'cn', header: 'CN No', cell: (r) => <span className="font-mono font-semibold">{str(get(r, 'cn_no')) ?? '—'}</span> },
        { key: 'date', header: 'Date', cell: (r) => fmtDate(get(r, 'bkg_date') as string) },
        { key: 'inv', header: 'Invoice', cell: (r) => str(get(r, 'invoice_no')) ?? '—' },
        { key: 'veh', header: 'Vehicle', cell: (r) => upper(get(r, 'vehicle_no')) || '—' },
        { key: 'load', header: 'Loading', cell: (r) => upper(get(r, 'loading_station') || get(r, 'booking_branch')) || '—' },
        { key: 'dest', header: 'Destination', cell: (r) => upper(get(r, 'delivery_station')) || '—' },
        { key: 'wt', header: 'Charge Wt', align: 'right', cell: (r) => str(get(r, 'charge_wt')) ?? '—' },
        { key: 'rate', header: 'Rate', align: 'right', cell: (r) => num(get(r, 'freight_rate')) },
        { key: 'freight', header: 'Freight', align: 'right', cell: (r) => money(get(r, 'freight')), className: 'font-mono' },
        { key: 'detention', header: 'Detention', align: 'right', cell: (r) => money(get(r, 'detention')), className: 'font-mono' },
        { key: 'loading', header: 'Loading', align: 'right', cell: (r) => money(get(r, 'loading')), className: 'font-mono' },
        { key: 'unload', header: 'Unload', align: 'right', cell: (r) => money(get(r, 'unloading')), className: 'font-mono' },
        { key: 'extrakm', header: 'Extra KM', align: 'right', cell: (r) => money(get(r, 'extra_km')), className: 'font-mono' },
        { key: 'other', header: 'Other', align: 'right', cell: (r) => money(combinedOther(r)), className: 'font-mono' },
        { key: 'total', header: 'Total', align: 'right', cell: (r) => money(get(r, 'total_amount')), className: 'font-mono font-semibold' },
    ];

    return (
        <>
            <DocumentSheet
                eyebrow="Freight Bill"
                title={billRef}
                status={cancelled ? 'Cancelled' : status}
                statusTone={cancelled ? 'danger' : 'success'}
                meta={
                    <span>
                        {party?.name ?? 'Party'} · Billed {fmtDate(get(record, 'billing_date') as string)}
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
                <div className="grid gap-5 lg:grid-cols-2">
                    <SheetSection title="Billed Party" icon={<Building2 className="h-3.5 w-3.5" />}>
                        <SheetInfoGrid columns={2}>
                            <SheetField label="Party" value={upper(party?.name)} accent />
                            <SheetField label="Code" value={upper(party?.code)} mono />
                            <SheetField label="Phone" value={str(party?.phone)} mono />
                            <SheetField label="GSTIN" value={upper(party?.gstin)} mono />
                            <SheetField label="Home Branch" value={upper(party?.branch_name) || upper(party?.branch_code)} />
                            <SheetField label="Issuing Branch" value={issuingBranch} />
                            <SheetField label="Address" value={upper(party?.address)} className="col-span-full" />
                        </SheetInfoGrid>
                    </SheetSection>

                    <SheetSection title="Bill Summary" icon={<FileText className="h-3.5 w-3.5" />}>
                        <SheetInfoGrid columns={2}>
                            <SheetField label="Bill Ref No" value={billRef} mono accent />
                            <SheetField label="Bill Date" value={fmtDate(get(record, 'billing_date') as string)} />
                            <SheetField label="Covered CNs" value={num(snapshot.length || (Array.isArray(get(record, 'covered_cn_nos')) ? (get(record, 'covered_cn_nos') as unknown[]).length : 0))} mono />
                            <SheetField label="Bill Amount" value={money(amount, true)} mono accent />
                            <SheetField label="Amount In Words" value={numberToWords(amount)} className="col-span-full" />
                        </SheetInfoGrid>
                    </SheetSection>
                </div>

                {summary ? (
                    <SheetSection title="Party Ledger Snapshot" icon={<Wallet className="h-3.5 w-3.5" />}>
                        <SheetInfoGrid>
                            <SheetField label="Opening Balance" value={money(summary.opening_balance, true)} mono />
                            <SheetField label="Total Billed" value={money(summary.total_billed, true)} mono />
                            <SheetField label="Total Received" value={money(summary.total_paid, true)} mono />
                            <SheetField label="Unbilled Amount" value={money(summary.unbilled_amount, true)} mono />
                            <SheetField
                                label="Outstanding"
                                value={
                                    <span className={summary.outstanding > 0.005 ? 'text-amber-600' : 'text-emerald-600'}>
                                        {money(summary.outstanding, true)}
                                    </span>
                                }
                            />
                        </SheetInfoGrid>
                    </SheetSection>
                ) : null}

                {/* Payments Received against this bill */}
                <SheetSection
                    title="Payments Received"
                    icon={<CreditCard className="h-3.5 w-3.5" />}
                    right={
                        payments.length > 0
                            ? `${payments.length} receipt${payments.length > 1 ? 's' : ''} · ${money(payments.filter(p => p.status !== 'REVERSED').reduce((s, p) => s + p.settled_amount, 0), true)} settled`
                            : 'No payments'
                    }
                >
                    {payments.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-1">No payment receipts linked to this bill yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-muted/50">
                                        <th className="text-left px-3 py-2 font-semibold border border-border">#</th>
                                        <th className="text-left px-3 py-2 font-semibold border border-border">Date</th>
                                        <th className="text-left px-3 py-2 font-semibold border border-border">Mode</th>
                                        <th className="text-left px-3 py-2 font-semibold border border-border">Ref / Bank</th>
                                        <th className="text-right px-3 py-2 font-semibold border border-border">Settled</th>
                                        <th className="text-right px-3 py-2 font-semibold border border-border">Received</th>
                                        <th className="text-right px-3 py-2 font-semibold border border-border">Deductions</th>
                                        <th className="text-left px-3 py-2 font-semibold border border-border">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p, idx) => {
                                        const deductionTotal = p.deduction_items.reduce((s, d) => s + d.amount, 0);
                                        const isReversed = p.status === 'REVERSED';
                                        return (
                                            <tr key={p.id} className={isReversed ? 'opacity-50 line-through' : idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                                                <td className="px-3 py-2 border border-border text-center text-muted-foreground">{idx + 1}</td>
                                                <td className="px-3 py-2 border border-border">{fmtDate(p.receipt_date)}</td>
                                                <td className="px-3 py-2 border border-border font-medium">{p.payment_mode ?? '—'}</td>
                                                <td className="px-3 py-2 border border-border font-mono text-muted-foreground">
                                                    {[p.reference_no, p.bank_name].filter(Boolean).join(' · ') || '—'}
                                                </td>
                                                <td className="px-3 py-2 border border-border text-right font-mono font-semibold">{money(p.settled_amount)}</td>
                                                <td className="px-3 py-2 border border-border text-right font-mono text-emerald-700">{money(p.actual_received_amount)}</td>
                                                <td className="px-3 py-2 border border-border text-right font-mono text-amber-700">
                                                    {deductionTotal > 0 ? (
                                                        <span title={p.deduction_items.map(d => `${d.label}: ₹${d.amount}`).join(', ')}>
                                                            {money(deductionTotal)}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-3 py-2 border border-border">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${isReversed ? 'bg-destructive/10 text-destructive' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {payments.length > 1 && (
                                    <tfoot>
                                        <tr className="bg-muted font-semibold">
                                            <td colSpan={4} className="px-3 py-2 border border-border text-right uppercase text-[10px] tracking-wide">Total</td>
                                            <td className="px-3 py-2 border border-border text-right font-mono">
                                                {money(payments.filter(p => p.status !== 'REVERSED').reduce((s, p) => s + p.settled_amount, 0))}
                                            </td>
                                            <td className="px-3 py-2 border border-border text-right font-mono text-emerald-700">
                                                {money(payments.filter(p => p.status !== 'REVERSED').reduce((s, p) => s + p.actual_received_amount, 0))}
                                            </td>
                                            <td className="px-3 py-2 border border-border text-right font-mono text-amber-700">
                                                {money(payments.filter(p => p.status !== 'REVERSED').reduce((s, p) => s + p.deduction_items.reduce((d, i) => d + i.amount, 0), 0))}
                                            </td>
                                            <td className="px-3 py-2 border border-border"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                </SheetSection>

                <SheetSection title="Covered Consignments" icon={<FileText className="h-3.5 w-3.5" />} right={`${snapshot.length} rows`}>
                    <SheetDataTable
                        columns={columns}
                        rows={snapshot}
                        getRowKey={(r, i) => `${str(get(r, 'cn_no')) ?? 'row'}-${i}`}
                        emptyText="This bill has no frozen line items. Open the official copy to view the full bill."
                        footer={
                            snapshot.length > 0 || vehicleCancel.length > 0 ? (
                                <>
                                    {vehicleCancel.map((item, index) => (
                                        <tr key={`vc-${index}`} className="bg-amber-50/50">
                                            <td className="border border-[var(--doc-line-soft)] px-2.5 py-1.5 text-center">
                                                {snapshot.length + index + 1}
                                            </td>
                                            <td className="border border-[var(--doc-line-soft)] px-2.5 py-1.5">—</td>
                                            <td className="border border-[var(--doc-line-soft)] px-2.5 py-1.5">
                                                {fmtDate(get(item, 'cancellation_date') as string)}
                                            </td>
                                            <td className="border border-[var(--doc-line-soft)] px-2.5 py-1.5">—</td>
                                            <td className="border border-[var(--doc-line-soft)] px-2.5 py-1.5 font-mono">
                                                {upper(get(item, 'vehicle_no')) || '—'}
                                            </td>
                                            <td className="border border-[var(--doc-line-soft)] px-2.5 py-1.5">
                                                {upper(get(item, 'from_station')) || '—'}
                                            </td>
                                            <td className="border border-[var(--doc-line-soft)] px-2.5 py-1.5">
                                                {upper(get(item, 'to_station')) || '—'}
                                            </td>
                                            <td
                                                colSpan={8}
                                                className="border border-[var(--doc-line-soft)] px-2.5 py-1.5 text-xs font-bold uppercase text-amber-800"
                                            >
                                                Vehicle Cancellation Charges
                                            </td>
                                            <td className="border border-[var(--doc-line-soft)] px-2.5 py-1.5 text-right font-mono font-semibold text-amber-700">
                                                {money(get(item, 'charges'))}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td
                                            colSpan={15}
                                            className="border border-[var(--doc-line-soft)] bg-[var(--doc-head-bg)] px-2.5 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-[var(--doc-head-fg)]"
                                        >
                                            Total
                                        </td>
                                        <td className="border border-[var(--doc-line-soft)] bg-[var(--doc-head-bg)] px-2.5 py-2 text-right font-mono text-sm font-black text-foreground">
                                            {money(amount, true)}
                                        </td>
                                    </tr>
                                </>
                            ) : null
                        }
                    />
                </SheetSection>

                {str(get(record, 'narration')) ? (
                    <SheetSection title="Narration">
                        <p className="text-sm text-foreground">{String(get(record, 'narration'))}</p>
                    </SheetSection>
                ) : null}

                {cancelled && str(get(record, 'cancel_reason')) ? (
                    <SheetSection title="Cancellation Reason">
                        <p className="text-sm text-destructive">{String(get(record, 'cancel_reason'))}</p>
                    </SheetSection>
                ) : null}
            </DocumentSheet>

            <BillingRecordViewDialog
                open={printOpen}
                onClose={() => setPrintOpen(false)}
                party={party as unknown as React.ComponentProps<typeof BillingRecordViewDialog>['party']}
                record={record as unknown as React.ComponentProps<typeof BillingRecordViewDialog>['record']}
                consignments={detail.consignments as unknown as React.ComponentProps<typeof BillingRecordViewDialog>['consignments']}
                isAdmin={false}
                onEdit={() => setPrintOpen(false)}
            />
        </>
    );
}
