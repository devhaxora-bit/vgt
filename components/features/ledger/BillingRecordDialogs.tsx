'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Loader2, Pencil, Printer } from 'lucide-react';

import { numberToWords } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { BillingConsignmentPicker, type BillingConsignmentOption } from '@/components/features/ledger/BillingConsignmentPicker';

interface PartyInfo {
    id: string;
    name: string;
    code: string;
    type: string;
    phone?: string;
    gstin?: string;
    address?: string;
    branch_code?: string;
}

interface BillingRecord {
    id: string;
    billing_date: string;
    billing_period_from?: string;
    billing_period_to?: string;
    amount: number;
    bill_ref_no?: string;
    narration: string;
    covered_cn_nos?: string[];
    status: string;
    cancel_reason?: string;
    cancelled_at?: string;
}

interface Consignment {
    id: string;
    cn_no: string;
    bkg_date: string;
    booking_branch: string;
    dest_branch: string;
    no_of_pkg: number;
    actual_weight: number;
    charged_weight: number;
    load_unit: string;
    total_freight: number;
    bkg_basis: string;
    goods_desc?: string;
    delivery_type?: string;
}

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
};

const normalizeDate = (value?: string | null) => {
    if (!value) return '';
    return value.slice(0, 10);
};

function buildCoveredConsignments(record: BillingRecord, consignments: Consignment[]) {
    const covered = new Set((record.covered_cn_nos || []).map((cn) => cn.trim()).filter(Boolean));
    if (covered.size > 0) {
        return consignments.filter((c) => covered.has(c.cn_no));
    }

    if (record.billing_period_from || record.billing_period_to) {
        return consignments.filter((c) => {
            const bookingDate = c.bkg_date?.slice(0, 10) || '';
            if (record.billing_period_from && bookingDate < record.billing_period_from) return false;
            if (record.billing_period_to && bookingDate > record.billing_period_to) return false;
            return true;
        });
    }

    return [];
}

export function EditBillingDialog({
    open,
    onClose,
    partyId,
    record,
    onSuccess,
    consignments,
}: {
    open: boolean;
    onClose: () => void;
    partyId: string;
    record: BillingRecord | null;
    onSuccess: () => void;
    consignments: BillingConsignmentOption[];
}) {
    const [form, setForm] = useState({
        billing_date: '',
        amount: '',
        bill_ref_no: '',
        narration: '',
        covered_cn_nos: [] as string[],
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!record) return;
        setForm({
            billing_date: normalizeDate(record.billing_date),
            amount: String(record.amount || ''),
            bill_ref_no: record.bill_ref_no || '',
            narration: record.narration || '',
            covered_cn_nos: record.covered_cn_nos || [],
        });
    }, [record]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!record) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/ledger/${partyId}/billing/${record.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    billing_date: form.billing_date,
                    bill_ref_no: form.bill_ref_no || null,
                    narration: form.narration.trim(),
                    covered_cn_nos: form.covered_cn_nos.length > 0 ? form.covered_cn_nos : null,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update billing record');
            }

            toast.success('Billing record updated');
            onSuccess();
            onClose();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to update billing record');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-primary" /> Edit Billing Record
                    </DialogTitle>
                    <DialogDescription>
                        Bill amount is immutable after save. You can update bill dates, reference, narration, and covered CNs.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Billing Date *</Label>
                            <Input type="date" value={form.billing_date} onChange={(e) => setForm((f) => ({ ...f, billing_date: e.target.value }))} className="h-9" required />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Bill Ref No</Label>
                            <Input value={form.bill_ref_no} onChange={(e) => setForm((f) => ({ ...f, bill_ref_no: e.target.value }))} className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Amount</Label>
                        <Input value={form.amount} className="h-9 font-mono bg-muted/40" readOnly />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Description</Label>
                        <Input value={form.narration} onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">CNs Covered</Label>
                        <BillingConsignmentPicker
                            consignments={consignments}
                            value={form.covered_cn_nos}
                            onChange={(covered_cn_nos) => setForm((f) => ({ ...f, covered_cn_nos }))}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function BillingRecordViewDialog({
    open,
    onClose,
    party,
    record,
    consignments,
    isAdmin,
    onEdit,
}: {
    open: boolean;
    onClose: () => void;
    party: PartyInfo | null;
    record: BillingRecord | null;
    consignments: Consignment[];
    isAdmin: boolean;
    onEdit: () => void;
}) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [logoBase64, setLogoBase64] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const loadLogo = async () => {
            try {
                const res = await fetch('/vgt_logo.png');
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (active) setLogoBase64(typeof reader.result === 'string' ? reader.result : null);
                };
                reader.readAsDataURL(blob);
            } catch {
                if (active) setLogoBase64(null);
            }
        };
        void loadLogo();
        return () => { active = false; };
    }, []);

    const coveredConsignments = useMemo(() => {
        if (!record) return [];
        return buildCoveredConsignments(record, consignments);
    }, [record, consignments]);

    const handlePrint = async (mode: 'print' | 'download') => {
        if (!party || !record) return;

        const logoUrl = logoBase64 || `${window.location.origin}/vgt_logo.png`;
        const coveredRows = coveredConsignments.length > 0
            ? coveredConsignments.map((consignment, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${consignment.cn_no}</td>
                    <td>${fmtDate(consignment.bkg_date)}</td>
                    <td>${consignment.booking_branch || '—'}</td>
                    <td>${consignment.dest_branch || '—'}</td>
                    <td>${consignment.no_of_pkg || 0}</td>
                    <td>${consignment.charged_weight || consignment.actual_weight || 0} ${consignment.load_unit || ''}</td>
                    <td class="amount">₹${fmt(Number(consignment.total_freight || 0))}</td>
                </tr>
            `).join('')
            : `
                <tr>
                    <td>1</td>
                    <td colspan="6">${record.narration || 'Manual billing record'}</td>
                    <td class="amount">₹${fmt(Number(record.amount || 0))}</td>
                </tr>
            `;

        const html = `<!DOCTYPE html>
<html>
<head>
<title>${record.bill_ref_no || record.id}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Times New Roman", Georgia, serif; color: #172554; background: #fff; }
.page { width: 190mm; margin: 0 auto; padding: 10mm; border: 2px solid #1d2f7a; }
.header { display: flex; gap: 12px; align-items: center; border-bottom: 2px solid #1d2f7a; padding-bottom: 10px; }
.logo { width: 72px; height: 72px; object-fit: contain; }
.brand { flex: 1; text-align: center; }
.brand h1 { margin: 0; font-size: 30px; color: #17308b; line-height: 1; }
.brand p { margin: 4px 0 0; font-size: 12px; color: #334155; }
.meta { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.box { border: 1px solid #1d2f7a; padding: 10px; min-height: 94px; }
.label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
.value { font-size: 15px; font-weight: 700; color: #0f172a; }
.small { font-size: 12px; line-height: 1.45; color: #334155; }
.bill-title { margin: 14px 0 10px; text-align: center; font-size: 24px; font-weight: 800; color: #17308b; letter-spacing: 1px; }
.table { width: 100%; border-collapse: collapse; margin-top: 8px; }
.table th, .table td { border: 1px solid #1d2f7a; padding: 8px 6px; font-size: 12px; vertical-align: top; }
.table th { background: #eff6ff; color: #17308b; }
.amount { text-align: right; font-weight: 700; white-space: nowrap; }
.summary { margin-top: 12px; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 12px; }
.amount-words { border: 1px solid #1d2f7a; padding: 10px; min-height: 70px; }
.totals { border: 1px solid #1d2f7a; padding: 10px; }
.totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; }
.totals-row:last-child { border-bottom: none; font-size: 16px; font-weight: 800; color: #17308b; }
.footer { margin-top: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
.signature { text-align: right; font-size: 12px; min-width: 240px; }
.signature strong { display: block; margin-bottom: 20px; font-size: 13px; color: #17308b; }
</style>
</head>
<body>
<div class="page">
    <div class="header">
        <img class="logo" src="${logoUrl}" alt="VGT Logo" />
        <div class="brand">
            <h1>Visakha Golden Transport</h1>
            <p>D.No. 8-19-58/A, Gopal Nagar, Near Bank Colony, Vizianagaram-535003 (A.P.)</p>
            <p>Cell: 9701523640 | Website: https://visakhagolden.com | Email: support@visakhagolden.com</p>
            <p>PAN: AAWFV7670H | GSTIN: 37AAWFV7670H1Z8</p>
        </div>
    </div>

    <div class="bill-title">BILL / FREIGHT INVOICE</div>

    <div class="meta">
        <div class="box">
            <div class="label">Bill To</div>
            <div class="value">${party.name}</div>
            <div class="small">Code: ${party.code || '—'}</div>
            <div class="small">GSTIN: ${party.gstin || '—'}</div>
            <div class="small">${party.address || 'Address not available'}</div>
        </div>
        <div class="box">
            <div class="small"><span class="label">Bill No</span><br/><span class="value">${record.bill_ref_no || `VGT-${record.id.slice(0, 8).toUpperCase()}`}</span></div>
            <div class="small" style="margin-top:8px;"><span class="label">Bill Date</span><br/><span class="value">${fmtDate(record.billing_date)}</span></div>
            <div class="small" style="margin-top:8px;"><span class="label">Billing Period</span><br/><span class="value">${record.billing_period_from ? `${fmtDate(record.billing_period_from)} to ${fmtDate(record.billing_period_to)}` : '—'}</span></div>
        </div>
    </div>

    <table class="table">
        <thead>
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 12%;">CN No</th>
                <th style="width: 12%;">Date</th>
                <th style="width: 12%;">From</th>
                <th style="width: 12%;">To</th>
                <th style="width: 10%;">Pkgs</th>
                <th style="width: 17%;">Weight</th>
                <th style="width: 20%;">Amount</th>
            </tr>
        </thead>
        <tbody>
            ${coveredRows}
        </tbody>
    </table>

    <div class="summary">
        <div class="amount-words">
            <div class="label">Narration</div>
            <div class="small" style="min-height: 24px; margin-bottom: 10px;">${record.narration || '—'}</div>
            <div class="label">Amount In Words</div>
            <div class="value" style="font-size: 14px;">${numberToWords(Number(record.amount || 0))}</div>
        </div>
        <div class="totals">
            <div class="totals-row"><span>Covered CNs</span><strong>${coveredConsignments.length || (record.covered_cn_nos?.length || 0) || 1}</strong></div>
            <div class="totals-row"><span>Status</span><strong>${record.status}</strong></div>
            <div class="totals-row"><span>Total Bill Amount</span><strong>₹${fmt(Number(record.amount || 0))}</strong></div>
        </div>
    </div>

    <div class="footer">
        <div class="small">System Bill ID: ${record.id}</div>
        <div class="signature">
            <strong>For Visakha Golden Transport</strong>
            <div>Authorised Signatory</div>
        </div>
    </div>
</div>
</body>
</html>`;

        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;

        doc.open();
        doc.write(html);
        doc.close();

        await Promise.all(
            Array.from(doc.images).map((image) => {
                if (image.complete) return Promise.resolve();
                return new Promise<void>((resolve) => {
                    image.onload = () => resolve();
                    image.onerror = () => resolve();
                });
            })
        );

        await new Promise((resolve) => setTimeout(resolve, 250));

        if (mode === 'print') {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            return;
        }

        const page = doc.querySelector('.page') as HTMLElement | null;
        if (!page) return;

        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ]);

        const canvas = await html2canvas(page, {
            scale: 3,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: page.scrollWidth,
            height: page.scrollHeight,
            windowWidth: page.scrollWidth,
            windowHeight: page.scrollHeight,
        });

        const imageData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true,
        });

        pdf.addImage(imageData, 'PNG', 8, 8, 194, 281, undefined, 'FAST');
        const safeBillNo = String(record.bill_ref_no || record.id).replace(/[^a-zA-Z0-9-_]/g, '');
        pdf.save(`${safeBillNo || 'billing-record'}.pdf`);
    };

    if (!party || !record) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
                <iframe
                    ref={iframeRef}
                    style={{
                        position: 'fixed',
                        left: '-10000px',
                        top: 0,
                        width: '1400px',
                        height: '1000px',
                        border: 'none',
                        opacity: 0,
                        pointerEvents: 'none',
                    }}
                />
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" /> Billing Record Details
                    </DialogTitle>
                    <DialogDescription>
                        View complete bill details and print or download the same bill in PDF format.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 justify-end">
                        <Button variant="outline" className="gap-2" onClick={() => void handlePrint('print')}>
                            <Printer className="h-4 w-4" /> Print
                        </Button>
                        <Button variant="outline" className="gap-2" onClick={() => void handlePrint('download')}>
                            <Download className="h-4 w-4" /> Download PDF
                        </Button>
                        {isAdmin && record.status === 'ACTIVE' && (
                            <Button className="gap-2" onClick={onEdit}>
                                <Pencil className="h-4 w-4" /> Edit Bill
                            </Button>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <Card><CardContent className="p-4 space-y-2">
                            <div className="text-[11px] font-bold uppercase text-muted-foreground">Party</div>
                            <div className="text-base font-black text-primary">{party.name}</div>
                            <div className="text-sm text-muted-foreground">Code: {party.code || '—'}</div>
                            <div className="text-sm text-muted-foreground">GSTIN: {party.gstin || '—'}</div>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{party.address || 'Address not available'}</div>
                        </CardContent></Card>
                        <Card><CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-[11px] font-bold uppercase text-muted-foreground">Bill Ref No</div>
                                    <div className="text-base font-black">{record.bill_ref_no || '—'}</div>
                                </div>
                                <Badge variant={record.status === 'ACTIVE' ? 'default' : 'outline'}
                                    className={record.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                    {record.status}
                                </Badge>
                            </div>
                            <div className="text-sm">Bill Date: <span className="font-medium">{fmtDate(record.billing_date)}</span></div>
                            <div className="text-sm">Billing Period: <span className="font-medium">{record.billing_period_from ? `${fmtDate(record.billing_period_from)} – ${fmtDate(record.billing_period_to)}` : '—'}</span></div>
                            <div className="text-sm">Amount: <span className="font-black text-emerald-700 font-mono">₹{fmt(Number(record.amount || 0))}</span></div>
                        </CardContent></Card>
                    </div>

                    <Card>
                        <CardContent className="p-4 space-y-3">
                            <div className="text-[11px] font-bold uppercase text-muted-foreground">Narration</div>
                            <div className="text-sm">{record.narration || '—'}</div>
                            <div className="text-[11px] font-bold uppercase text-muted-foreground pt-2">Amount In Words</div>
                            <div className="text-sm font-semibold text-primary">{numberToWords(Number(record.amount || 0))}</div>
                            {record.status === 'CANCELLED' && (
                                <>
                                    <div className="text-[11px] font-bold uppercase text-muted-foreground pt-2">Cancel Reason</div>
                                    <div className="text-sm text-destructive">{record.cancel_reason || '—'}</div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-[11px] font-bold uppercase text-muted-foreground">Covered CN Details</div>
                                <div className="text-xs text-muted-foreground">{coveredConsignments.length} matched consignments</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left p-2 font-bold text-xs">CN No</th>
                                            <th className="text-left p-2 font-bold text-xs">Date</th>
                                            <th className="text-left p-2 font-bold text-xs">From</th>
                                            <th className="text-left p-2 font-bold text-xs">To</th>
                                            <th className="text-right p-2 font-bold text-xs">Freight</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {coveredConsignments.length > 0 ? coveredConsignments.map((consignment) => (
                                            <tr key={consignment.id} className="border-b last:border-0">
                                                <td className="p-2 font-mono text-xs text-primary font-bold">{consignment.cn_no}</td>
                                                <td className="p-2 text-xs">{fmtDate(consignment.bkg_date)}</td>
                                                <td className="p-2 text-xs">{consignment.booking_branch || '—'}</td>
                                                <td className="p-2 text-xs">{consignment.dest_branch || '—'}</td>
                                                <td className="p-2 text-right text-xs font-mono">₹{fmt(Number(consignment.total_freight || 0))}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="p-3 text-center text-xs text-muted-foreground">
                                                    No exact CN rows matched this bill. The PDF will still include the saved narration and bill amount.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {(record.covered_cn_nos || []).length > 0 && (
                                <div className="mt-3 text-xs text-muted-foreground">
                                    Saved CN list: <span className="font-mono">{record.covered_cn_nos?.join(', ')}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}
