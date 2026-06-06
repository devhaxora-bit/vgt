'use client';

import React, { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Truck, TrendingUp, AlertCircle, DollarSign, Plus, FileText,
    Banknote, Search, RotateCcw, Eye, XCircle, Package, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ChallanDetailsDialog } from '@/components/features/challans/ChallanDetailsDialog';
import {
    CreateChallanBillDialog,
    RecordChallanPaymentDialog,
    ViewChallanBillDialog,
    CancelReasonDialog,
    type ChallanBillingRecord,
    type ChallanPaymentReceipt,
} from '@/components/features/challan-ledger/ChallanBillingRecordDialogs';
import type { ChallanBillingChallanOption } from '@/components/features/challan-ledger/ChallanBillingChallanPicker';

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

export default function BrokerChallanLedgerDetailPage({ params }: { params: Promise<{ brokerId: string }> }) {
    const { brokerId } = use(params);

    const [data, setData] = useState<{
        broker: { id: string; code: string; name: string; mobile?: string | null } | null;
        account: { opening_balance: number } | null;
        summary: {
            total_challan_amount: number;
            total_challan_count: number;
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
            total_challan_amount: 0, total_challan_count: 0, total_billed: 0,
            total_paid: 0, unbilled_amount: 0, outstanding: 0,
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

    const [showBillDialog, setShowBillDialog] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [selectedBill, setSelectedBill] = useState<ChallanBillingRecord | null>(null);
    const [selectedChallan, setSelectedChallan] = useState<Record<string, unknown> | null>(null);
    const [cancelTarget, setCancelTarget] = useState<{ type: 'billing' | 'payment'; id: string } | null>(null);

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

    const billedChallanNos = useMemo(() => {
        const set = new Set<string>();
        data.billing_records
            .filter((b) => b.status === 'ACTIVE')
            .forEach((b) => (b.covered_challan_nos || []).forEach((no) => set.add(no)));
        return Array.from(set);
    }, [data.billing_records]);

    const handleCancelBilling = async (reason: string) => {
        if (!cancelTarget) return;
        const res = await fetch(`/api/challan-ledger/${brokerId}/billing/${cancelTarget.id}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cancel_reason: reason }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        toast.success('Bill cancelled');
        fetchData();
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
                        <Button onClick={() => setShowBillDialog(true)} className="gap-2">
                            <Plus className="h-4 w-4" /> Create Bill
                        </Button>
                        <Button variant="outline" onClick={() => setShowPaymentDialog(true)} className="gap-2">
                            <Banknote className="h-4 w-4" /> Record Payment
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                {[
                    { label: 'Opening Balance', value: data.account?.opening_balance || 0 },
                    { label: 'Challan Amount', value: summary.total_challan_amount, icon: Truck },
                    { label: 'Total Billed', value: summary.total_billed, color: 'text-emerald-700' },
                    { label: 'Unbilled', value: summary.unbilled_amount, color: 'text-amber-700' },
                    { label: 'Total Received', value: summary.total_paid, color: 'text-indigo-700' },
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
                    <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
                        <RotateCcw className="h-4 w-4" /> Refresh
                    </Button>
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="challans">Challans ({data.challans.length})</TabsTrigger>
                    <TabsTrigger value="billing">Billing ({data.billing_records.length})</TabsTrigger>
                    <TabsTrigger value="payments">Payments ({data.payment_receipts.length})</TabsTrigger>
                    <TabsTrigger value="unchallaned">Unchallaned CNS ({summary.unchallaned_cns_count})</TabsTrigger>
                </TabsList>

                <TabsContent value="challans" className="mt-4">
                    <Card>
                        <CardContent className="p-0 overflow-x-auto">
                            {isLoading ? (
                                <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline mr-2" />Loading...</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Challan No</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Vehicle</TableHead>
                                            <TableHead>Driver</TableHead>
                                            <TableHead>Owner</TableHead>
                                            <TableHead>Linked CNs</TableHead>
                                            <TableHead className="text-right">Full Hire</TableHead>
                                            <TableHead>Bill Status</TableHead>
                                            <TableHead />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.challans.map((ch) => (
                                            <TableRow key={ch.id}>
                                                <TableCell className="font-mono font-bold text-primary">{ch.challan_no}</TableCell>
                                                <TableCell>{fmtDate(ch.date_from)}</TableCell>
                                                <TableCell>{ch.vehicle_no}</TableCell>
                                                <TableCell>{ch.driver_name || '—'}</TableCell>
                                                <TableCell>{ch.owner_name || '—'}</TableCell>
                                                <TableCell className="text-xs max-w-[180px] truncate">{(ch.linked_cn_nos || []).join(', ') || '—'}</TableCell>
                                                <TableCell className="text-right font-mono font-bold">₹{fmt(Number(ch.full_hire_amount || 0))}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={ch.bill_status === 'BILLED' ? 'text-emerald-700' : 'text-amber-700'}>
                                                        {ch.bill_status || 'UNBILLED'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Button size="sm" variant="ghost" onClick={() => setSelectedChallan(ch as unknown as Record<string, unknown>)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="billing" className="mt-4">
                    <Card>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Bill No</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Challans</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.billing_records.map((bill) => (
                                        <TableRow key={bill.id}>
                                            <TableCell className="font-mono font-bold text-primary">{bill.bill_ref_no || bill.id.slice(0, 8)}</TableCell>
                                            <TableCell>{fmtDate(bill.billing_date)}</TableCell>
                                            <TableCell className="text-xs max-w-[180px] truncate">{(bill.covered_challan_nos || []).join(', ')}</TableCell>
                                            <TableCell className="text-right font-mono">₹{fmt(Number(bill.amount || 0))}</TableCell>
                                            <TableCell className="text-right font-mono text-indigo-700">₹{fmt(Number(bill.settled_amount || 0))}</TableCell>
                                            <TableCell className="text-right font-mono text-amber-700">₹{fmt(Number(bill.remaining_amount || 0))}</TableCell>
                                            <TableCell>
                                                {bill.status === 'ACTIVE' ? (
                                                    <Badge className={PAYMENT_STATUS_BADGE[bill.payment_status || 'UNPAID'] || ''}>{bill.payment_status || 'UNPAID'}</Badge>
                                                ) : (
                                                    <Badge variant="destructive">CANCELLED</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="space-x-1">
                                                <Button size="sm" variant="ghost" onClick={() => setSelectedBill(bill)}><Eye className="h-4 w-4" /></Button>
                                                {isAdmin && bill.status === 'ACTIVE' && (
                                                    <Button size="sm" variant="ghost" onClick={() => setCancelTarget({ type: 'billing', id: bill.id })}>
                                                        <XCircle className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
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
                                        <TableHead>Reference</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.payment_receipts.map((receipt) => (
                                        <TableRow key={receipt.id}>
                                            <TableCell>{fmtDate(receipt.receipt_date)}</TableCell>
                                            <TableCell>{receipt.payment_mode}</TableCell>
                                            <TableCell className="font-mono text-xs">{receipt.reference_no || '—'}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">₹{fmt(Number(receipt.amount || 0))}</TableCell>
                                            <TableCell>
                                                <Badge variant={receipt.status === 'ACTIVE' ? 'outline' : 'destructive'}>{receipt.status}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {isAdmin && receipt.status === 'ACTIVE' && (
                                                    <Button size="sm" variant="ghost" onClick={() => setCancelTarget({ type: 'payment', id: receipt.id })}>
                                                        <XCircle className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
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

            <CreateChallanBillDialog
                open={showBillDialog}
                onClose={() => setShowBillDialog(false)}
                brokerId={brokerId}
                challans={data.challans}
                billedChallanNos={billedChallanNos}
                onSuccess={fetchData}
            />

            <RecordChallanPaymentDialog
                open={showPaymentDialog}
                onClose={() => setShowPaymentDialog(false)}
                brokerId={brokerId}
                billingRecords={data.billing_records}
                paymentReceipts={data.payment_receipts}
                onSuccess={fetchData}
            />

            <ViewChallanBillDialog
                open={!!selectedBill}
                onClose={() => setSelectedBill(null)}
                record={selectedBill}
            />

            <ChallanDetailsDialog
                isOpen={!!selectedChallan}
                onClose={() => setSelectedChallan(null)}
                challan={selectedChallan}
            />

            <CancelReasonDialog
                open={!!cancelTarget}
                onClose={() => setCancelTarget(null)}
                title={cancelTarget?.type === 'billing' ? 'Cancel Bill' : 'Reverse Payment'}
                description={cancelTarget?.type === 'billing'
                    ? 'Provide a reason for cancelling this bill. Linked challans will become billable again.'
                    : 'Provide a reason for reversing this payment receipt.'}
                onConfirm={cancelTarget?.type === 'billing' ? handleCancelBilling : handleReversePayment}
            />
        </div>
    );
}
