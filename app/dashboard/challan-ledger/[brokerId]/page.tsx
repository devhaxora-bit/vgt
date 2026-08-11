'use client';

import React, { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Truck,
    Banknote, Search, RotateCcw, Eye, XCircle, Package, Loader2, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChallanDetailsDialog } from '@/components/features/challans/ChallanDetailsDialog';
import {
    RecordChallanPaymentDialog,
    ViewChallanPaymentDialog,
    CancelReasonDialog,
    type ChallanBillingRecord,
    type ChallanPaymentReceipt,
} from '@/components/features/challan-ledger/ChallanBillingRecordDialogs';
import type { ChallanBillingChallanOption } from '@/components/features/challan-ledger/ChallanBillingChallanPicker';
import {
    downloadChallanLedgerReportPdf,
    type ChallanLedgerFilter,
    type ChallanLedgerReportPayload,
} from '@/lib/challanLedgerReportPdf';

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    try {
        const parsed = new Date(d);
        if (Number.isNaN(parsed.getTime())) return d;
        return parsed.toLocaleDateString('en-IN');
    } catch {
        return d;
    }
};

const PAYMENT_STATUS_BADGE: Record<string, string> = {
    UNPAID: 'bg-amber-50 text-amber-700 border-amber-200',
    PARTIAL: 'bg-blue-50 text-blue-700 border-blue-200',
    COMPLETE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const fmtPdfDate = (d?: string | null) => {
    if (!d) return '—';
    const iso = d.slice(0, 10);
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return fmtDate(d);
};

const generatedAtLabel = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

function LedgerReportDownloadDialog({
    open,
    onClose,
    reportPayload,
    isDownloading,
    onDownload,
}: {
    open: boolean;
    onClose: () => void;
    reportPayload: ChallanLedgerReportPayload | null;
    isDownloading: boolean;
    onDownload: (filter: ChallanLedgerFilter) => Promise<void>;
}) {
    const [filter, setFilter] = useState<ChallanLedgerFilter>('all');

    useEffect(() => {
        if (open) setFilter('all');
    }, [open]);

    const counts = useMemo(() => {
        if (!reportPayload) return { all: 0, paid: 0, unpaid: 0 };
        const paid = reportPayload.challanRows.filter((row) => row.paymentStatus === 'COMPLETE').length;
        return {
            all: reportPayload.challanRows.length,
            paid,
            unpaid: reportPayload.challanRows.length - paid,
        };
    }, [reportPayload]);

    const filteredCount = filter === 'all' ? counts.all : filter === 'paid' ? counts.paid : counts.unpaid;

    const handleDownload = async () => {
        if (filteredCount === 0) {
            toast.error(`No ${filter === 'paid' ? 'paid' : filter === 'unpaid' ? 'unpaid' : ''} challans for the selected period`);
            return;
        }
        await onDownload(filter);
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next && !isDownloading) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-4 w-4" /> Download Ledger Report
                    </DialogTitle>
                    <DialogDescription>
                        Choose which challans to include in the PDF for this period.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 mt-2">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Challan entries</Label>
                        <Select
                            value={filter}
                            onValueChange={(value: ChallanLedgerFilter) => setFilter(value)}
                            disabled={isDownloading}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="paid">Paid Challans ({counts.paid})</SelectItem>
                                <SelectItem value="unpaid">Unpaid Challans ({counts.unpaid})</SelectItem>
                                <SelectItem value="all">All Challans ({counts.all})</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {filteredCount} challan{filteredCount === 1 ? '' : 's'} will be included.
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose} disabled={isDownloading}>Cancel</Button>
                        <Button onClick={() => void handleDownload()} disabled={isDownloading || filteredCount === 0} className="gap-2">
                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Download PDF
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function BrokerChallanLedgerDetailPage({ params }: { params: Promise<{ brokerId: string }> }) {
    const { brokerId } = use(params);

    const [data, setData] = useState<{
        broker: {
            id: string;
            code: string;
            name: string;
            mobile?: string | null;
            address?: string | null;
            branch_code?: string | null;
        } | null;
        account: { opening_balance: number } | null;
        summary: {
            total_challan_amount: number;
            total_challan_count: number;
            total_advance_amount: number;
            total_tds_amount: number;
            net_payable_amount: number;
            total_billed: number;
            total_paid: number;
            unbilled_amount: number;
            outstanding: number;
            unchallaned_cns_count: number;
            unchallaned_cns_amount: number;
        };
        challans: ChallanBillingChallanOption[];
        billing_records: ChallanBillingRecord[];
        payment_receipts: ChallanPaymentReceipt[];
        unchallaned_cns: Array<{
            id: string;
            cn_no: string;
            bkg_date: string;
            booking_branch: string;
            dest_branch: string;
            total_freight: number;
            vehicle_no?: string;
        }>;
    }>({
        broker: null,
        account: null,
        summary: {
            total_challan_amount: 0, total_challan_count: 0,
            total_advance_amount: 0, total_tds_amount: 0, net_payable_amount: 0,
            total_billed: 0, total_paid: 0, unbilled_amount: 0, outstanding: 0,
            unchallaned_cns_count: 0, unchallaned_cns_amount: 0,
        },
        challans: [],
        billing_records: [],
        payment_receipts: [],
        unchallaned_cns: [],
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [challanSearch, setChallanSearch] = useState('');
    const [activeTab, setActiveTab] = useState('challans');

    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [stackedChallanNos, setStackedChallanNos] = useState<string[]>([]);
    const [paymentInitialNos, setPaymentInitialNos] = useState<string[]>([]);
    const [selectedReceipt, setSelectedReceipt] = useState<ChallanPaymentReceipt | null>(null);
    const [selectedChallan, setSelectedChallan] = useState<Record<string, unknown> | null>(null);
    const [cancelTarget, setCancelTarget] = useState<{ type: 'payment'; id: string } | null>(null);
    const [showLedgerDownloadDialog, setShowLedgerDownloadDialog] = useState(false);
    const [isDownloadingReport, setIsDownloadingReport] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const paramsObj = new URLSearchParams();
            if (dateFrom) paramsObj.set('dateFrom', dateFrom);
            if (dateTo) paramsObj.set('dateTo', dateTo);
            if (challanSearch) paramsObj.set('search', challanSearch);

            const res = await fetch(`/api/challan-ledger/${brokerId}?${paramsObj.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch');
            setData(await res.json());
        } catch (err) {
            console.error(err);
            toast.error('Failed to load broker ledger');
        } finally {
            setIsLoading(false);
        }
    }, [brokerId, dateFrom, dateTo, challanSearch]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((r) => r.json())
            .then((r) => setIsAdmin(r?.data?.role === 'admin'))
            .catch(console.error);
    }, []);

    const payableChallans = useMemo(
        () => data.challans.filter((ch) => Number(ch.balance_amount || 0) > 0.009),
        [data.challans],
    );

    const allPayableSelected = payableChallans.length > 0
        && payableChallans.every((ch) => stackedChallanNos.includes(ch.challan_no));

    const toggleStackedChallan = (challanNo: string) => {
        setStackedChallanNos((prev) => (
            prev.includes(challanNo)
                ? prev.filter((no) => no !== challanNo)
                : [...prev, challanNo]
        ));
    };

    const openPaymentDialog = (challanNos?: string[]) => {
        setPaymentInitialNos(challanNos ?? stackedChallanNos);
        setShowPaymentDialog(true);
    };

    const closePaymentDialog = () => {
        setShowPaymentDialog(false);
        setPaymentInitialNos([]);
    };

    const handleReversePayment = async (reason: string) => {
        if (!cancelTarget) return;
        const res = await fetch(`/api/challan-ledger/${brokerId}/payments/${cancelTarget.id}/reverse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reversal_reason: reason }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        toast.success('Payment reversed');
        fetchData();
    };

    const summary = data.summary;

    const reportPeriodLabel = useMemo(() => {
        if (dateFrom && dateTo) {
            const fmtPeriod = (s: string) => {
                const [y, m, d] = s.split('-');
                return `${d}/${m}/${y}`;
            };
            return `${fmtPeriod(dateFrom)} to ${fmtPeriod(dateTo)}`;
        }
        if (dateFrom) {
            const [y, m, d] = dateFrom.split('-');
            return `From ${d}/${m}/${y}`;
        }
        if (dateTo) {
            const [y, m, d] = dateTo.split('-');
            return `Up to ${d}/${m}/${y}`;
        }
        return 'All Dates';
    }, [dateFrom, dateTo]);

    const reportPayload = useMemo((): ChallanLedgerReportPayload | null => {
        if (!data.broker) return null;

        const challanRows = data.challans.map((ch) => {
            const extra = ch as ChallanBillingChallanOption & {
                loading_point?: string | null;
                destination_point?: string | null;
            };
            const paymentStatus = (ch.payment_status === 'COMPLETE' || ch.payment_status === 'PARTIAL')
                ? ch.payment_status
                : 'UNPAID';

            return {
                challanNo: ch.challan_no,
                date: fmtPdfDate(ch.date_from),
                dateIso: (ch.date_from || '').slice(0, 10),
                vehicleNo: ch.vehicle_no || '—',
                ownerName: ch.owner_name || ch.driver_name || '—',
                origin: extra.origin_branch_code || extra.loading_point || '—',
                destination: extra.destination_branch_code || extra.destination_point || '—',
                hireAmount: Number(ch.full_hire_amount || 0),
                advanceAmount: Number(ch.advance_amount || 0),
                netPayable: Number(ch.net_payable_amount || 0),
                paidAmount: Number(ch.paid_amount || 0),
                balanceAmount: Number(ch.balance_amount || 0),
                paymentStatus,
            };
        });

        return {
            broker: {
                name: data.broker.name,
                code: data.broker.code,
                mobile: data.broker.mobile,
                address: data.broker.address,
                branch_code: data.broker.branch_code,
            },
            periodLabel: reportPeriodLabel,
            generatedAt: generatedAtLabel(),
            summary: {
                openingBalance: Number(data.account?.opening_balance || 0),
                totalChallanCount: challanRows.length,
                totalHireAmount: Number(summary.total_challan_amount || 0),
                unpaidCount: challanRows.filter((row) => row.paymentStatus !== 'COMPLETE').length,
                unpaidAmount: challanRows
                    .filter((row) => row.paymentStatus !== 'COMPLETE')
                    .reduce((sum, row) => sum + row.balanceAmount, 0),
                paidCount: challanRows.filter((row) => row.paymentStatus === 'COMPLETE').length,
                netPayable: Number(summary.net_payable_amount || 0),
                totalAdvance: Number(summary.total_advance_amount || 0),
                totalPaid: Number(summary.total_paid || 0),
                outstanding: Number(summary.outstanding || 0),
            },
            challanRows,
        };
    }, [data.account?.opening_balance, data.broker, data.challans, reportPeriodLabel, summary]);

    const openLedgerDownloadDialog = () => {
        if (!reportPayload || reportPayload.challanRows.length === 0) {
            toast.error('No ledger entries found for the selected period');
            return;
        }
        setShowLedgerDownloadDialog(true);
    };

    const handleDownloadLedgerReport = async (filter: ChallanLedgerFilter) => {
        if (!reportPayload) return;
        setIsDownloadingReport(true);
        try {
            await downloadChallanLedgerReportPdf(reportPayload, filter);
            toast.success('Ledger report downloaded');
            setShowLedgerDownloadDialog(false);
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to download ledger report');
        } finally {
            setIsDownloadingReport(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <Link href="/dashboard/challan-ledger">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{data.broker?.name || 'Broker Ledger'}</h1>
                        <p className="text-sm text-muted-foreground">
                            {data.broker?.code} {data.broker?.mobile ? `• ${data.broker.mobile}` : ''}
                        </p>
                    </div>
                </div>
                {isAdmin && (
                    <div className="flex items-center gap-2">
                        <Button onClick={() => openPaymentDialog()} className="gap-2">
                            <Banknote className="h-4 w-4" />
                            {stackedChallanNos.length > 0
                                ? `Record Payment (${stackedChallanNos.length})`
                                : 'Record Payment'}
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                {[
                    { label: 'Opening Balance', value: data.account?.opening_balance || 0 },
                    { label: 'Challan Amount', value: summary.total_challan_amount, icon: Truck },
                    { label: 'Advance Paid', value: summary.total_advance_amount, color: 'text-amber-700' },
                    { label: 'Net Payable', value: summary.net_payable_amount, color: 'text-emerald-700' },
                    { label: 'Total Paid', value: summary.total_paid, color: 'text-indigo-700' },
                    { label: 'Outstanding', value: summary.outstanding, color: 'text-red-700' },
                ].map(({ label, value, color }) => (
                    <Card key={label} className="min-w-0">
                        <CardContent className="p-3 sm:p-4">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase text-muted-foreground leading-tight">{label}</p>
                            <p className={`text-base sm:text-lg xl:text-xl font-black truncate ${color || ''}`}>₹{fmt(Number(value || 0))}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <Input type="date" className="h-9 w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <span className="text-xs">to</span>
                    <Input type="date" className="h-9 w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search challan no..." className="pl-9 h-9" value={challanSearch} onChange={(e) => setChallanSearch(e.target.value)} />
                    </div>
                    <div className="text-[11px] font-medium text-muted-foreground">
                        {reportPeriodLabel}
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
                        <RotateCcw className="h-4 w-4" /> Refresh
                    </Button>
                    <Button
                        size="sm"
                        className="h-9 gap-2 ml-auto"
                        onClick={openLedgerDownloadDialog}
                        disabled={isDownloadingReport || data.challans.length === 0}
                    >
                        {isDownloadingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Download Ledger Report
                    </Button>
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="challans">Challans ({data.challans.length})</TabsTrigger>
                    <TabsTrigger value="payments">Payments ({data.payment_receipts.length})</TabsTrigger>
                    <TabsTrigger value="unchallaned">Unchallaned CNS ({summary.unchallaned_cns_count})</TabsTrigger>
                </TabsList>

                <TabsContent value="challans" className="mt-4">
                    {isAdmin && stackedChallanNos.length > 0 && (
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                            <span>
                                <strong>{stackedChallanNos.length}</strong> challan{stackedChallanNos.length > 1 ? 's' : ''} stacked for one payment
                            </span>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setStackedChallanNos([])}>
                                    Clear
                                </Button>
                                <Button size="sm" className="gap-1.5" onClick={() => openPaymentDialog()}>
                                    <Banknote className="h-4 w-4" /> Pay stacked challans
                                </Button>
                            </div>
                        </div>
                    )}
                    <Card>
                        <CardContent className="p-0 overflow-x-auto">
                            {isLoading ? (
                                <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline mr-2" />Loading...</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {isAdmin && (
                                                <TableHead className="w-10">
                                                    <Checkbox
                                                        checked={
                                                            allPayableSelected
                                                                ? true
                                                                : stackedChallanNos.length > 0
                                                                    ? 'indeterminate'
                                                                    : false
                                                        }
                                                        disabled={payableChallans.length === 0}
                                                        onCheckedChange={(checked) => {
                                                            setStackedChallanNos(
                                                                checked === true
                                                                    ? payableChallans.map((ch) => ch.challan_no)
                                                                    : [],
                                                            );
                                                        }}
                                                        aria-label="Select all unpaid challans"
                                                    />
                                                </TableHead>
                                            )}
                                            <TableHead>Challan No</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Vehicle</TableHead>
                                            <TableHead>Owner</TableHead>
                                            <TableHead className="text-right">Full Hire</TableHead>
                                            <TableHead className="text-right">Advance</TableHead>
                                            <TableHead className="text-right">Net Payable</TableHead>
                                            <TableHead className="text-right">Paid</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.challans.map((ch) => (
                                            <TableRow key={ch.id} className={stackedChallanNos.includes(ch.challan_no) ? 'bg-primary/5' : undefined}>
                                                {isAdmin && (
                                                    <TableCell>
                                                        {Number(ch.balance_amount || 0) > 0.009 ? (
                                                            <Checkbox
                                                                checked={stackedChallanNos.includes(ch.challan_no)}
                                                                onCheckedChange={() => toggleStackedChallan(ch.challan_no)}
                                                                aria-label={`Stack challan ${ch.challan_no}`}
                                                            />
                                                        ) : null}
                                                    </TableCell>
                                                )}
                                                <TableCell className="font-mono font-bold text-primary">{ch.challan_no}</TableCell>
                                                <TableCell>{fmtDate(ch.date_from)}</TableCell>
                                                <TableCell>{ch.vehicle_no}</TableCell>
                                                <TableCell>{ch.owner_name || '—'}</TableCell>
                                                <TableCell className="text-right font-mono">₹{fmt(Number(ch.full_hire_amount || 0))}</TableCell>
                                                <TableCell className="text-right font-mono text-amber-700">₹{fmt(Number(ch.advance_amount || 0))}</TableCell>
                                                <TableCell className="text-right font-mono font-bold">₹{fmt(Number(ch.net_payable_amount || 0))}</TableCell>
                                                <TableCell className="text-right font-mono text-indigo-700">₹{fmt(Number(ch.paid_amount || 0))}</TableCell>
                                                <TableCell className="text-right font-mono text-red-700">₹{fmt(Number(ch.balance_amount || 0))}</TableCell>
                                                <TableCell>
                                                    <Badge className={PAYMENT_STATUS_BADGE[ch.payment_status || 'UNPAID'] || ''}>
                                                        {ch.payment_status || 'UNPAID'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" variant="ghost" title="View challan" onClick={() => setSelectedChallan(ch as unknown as Record<string, unknown>)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {isAdmin && Number(ch.balance_amount || 0) > 0.009 && (
                                                            <Button size="sm" variant="ghost" className="text-primary" title="Record payment" onClick={() => openPaymentDialog([ch.challan_no])}>
                                                                <Banknote className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                    <Card>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Mode</TableHead>
                                        <TableHead>Paid To</TableHead>
                                        <TableHead>Challans</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead className="text-right">Settled</TableHead>
                                        <TableHead className="text-right">Deduct</TableHead>
                                        <TableHead className="text-right">Extra</TableHead>
                                        <TableHead className="text-right">Net Cash</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.payment_receipts.map((receipt) => {
                                        const allocations = receipt.challan_allocations || [];
                                        const challanNos = allocations.map((a) => a.challan_no).join(', ');
                                        const deduct = allocations.reduce((sum, a) => sum + (a.deduction_items || []).reduce((i, x) => i + Number(x.amount || 0), 0), 0);
                                        const extra = allocations.reduce((sum, a) => sum + (a.addition_items || []).reduce((i, x) => i + Number(x.amount || 0), 0), 0);
                                        const settled = Number(receipt.amount || 0);
                                        const netCash = settled - deduct + extra;
                                        return (
                                            <TableRow key={receipt.id}>
                                                <TableCell>{fmtDate(receipt.receipt_date)}</TableCell>
                                                <TableCell>{receipt.payment_mode}</TableCell>
                                                <TableCell>{receipt.payer_name || '—'}</TableCell>
                                                <TableCell className="text-xs max-w-[160px] truncate font-mono">{challanNos || '—'}</TableCell>
                                                <TableCell className="font-mono text-xs">{receipt.reference_no || '—'}</TableCell>
                                                <TableCell className="text-right font-mono font-bold text-indigo-700">₹{fmt(settled)}</TableCell>
                                                <TableCell className="text-right font-mono text-destructive">₹{fmt(deduct)}</TableCell>
                                                <TableCell className="text-right font-mono text-emerald-700">₹{fmt(extra)}</TableCell>
                                                <TableCell className="text-right font-mono">₹{fmt(netCash)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={receipt.status === 'ACTIVE' ? 'outline' : 'destructive'}>{receipt.status}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" variant="ghost" title="View receipt" onClick={() => setSelectedReceipt(receipt)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {isAdmin && receipt.status === 'ACTIVE' && (
                                                            <Button size="sm" variant="ghost" title="Reverse payment" onClick={() => setCancelTarget({ type: 'payment', id: receipt.id })}>
                                                                <XCircle className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="unchallaned" className="mt-4">
                    <Card>
                        <CardContent className="p-4 border-b bg-muted/20">
                            <div className="flex items-center gap-2 text-sm">
                                <Package className="h-4 w-4 text-orange-600" />
                                <span>{summary.unchallaned_cns_count} consignments without a loading challan • ₹{fmt(summary.unchallaned_cns_amount)} total freight</span>
                            </div>
                        </CardContent>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>CN No</TableHead>
                                        <TableHead>Bkg Date</TableHead>
                                        <TableHead>From</TableHead>
                                        <TableHead>To</TableHead>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead className="text-right">Freight</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.unchallaned_cns.slice(0, 200).map((cns) => (
                                        <TableRow key={cns.id}>
                                            <TableCell className="font-mono font-bold text-primary">{cns.cn_no}</TableCell>
                                            <TableCell>{fmtDate(cns.bkg_date)}</TableCell>
                                            <TableCell>{cns.booking_branch}</TableCell>
                                            <TableCell>{cns.dest_branch}</TableCell>
                                            <TableCell>{cns.vehicle_no || '—'}</TableCell>
                                            <TableCell className="text-right font-mono">₹{fmt(Number(cns.total_freight || 0))}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <RecordChallanPaymentDialog
                open={showPaymentDialog}
                onClose={closePaymentDialog}
                brokerId={brokerId}
                challans={data.challans}
                initialChallanNos={paymentInitialNos}
                onSuccess={() => {
                    setStackedChallanNos([]);
                    fetchData();
                }}
            />

            <ViewChallanPaymentDialog
                open={!!selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
                receipt={selectedReceipt}
            />

            <ChallanDetailsDialog
                isOpen={!!selectedChallan}
                onClose={() => setSelectedChallan(null)}
                challan={selectedChallan}
            />

            <CancelReasonDialog
                open={!!cancelTarget}
                onClose={() => setCancelTarget(null)}
                title="Reverse Payment"
                description="Provide a reason for reversing this payment receipt."
                onConfirm={handleReversePayment}
            />

            <LedgerReportDownloadDialog
                open={showLedgerDownloadDialog}
                onClose={() => setShowLedgerDownloadDialog(false)}
                reportPayload={reportPayload}
                isDownloading={isDownloadingReport}
                onDownload={handleDownloadLedgerReport}
            />
        </div>
    );
}
