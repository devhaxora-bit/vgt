'use client';

import React, { useRef } from 'react';
import {
    Truck,
    Info,
    FileText,
    Printer,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

interface ChallanDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    challan: any;
}

export function ChallanDetailsDialog({ isOpen, onClose, challan }: ChallanDetailsDialogProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    if (!challan) return null;

    const c = challan;

    const formatDateSafe = (dateStr: any, formatStr: string) => {
        try {
            if (!dateStr) return '---';
            return format(new Date(dateStr), formatStr);
        } catch (e) {
            return '---';
        }
    };

    const handlePrint = () => {
        const balance = ((Number(c.total_hire_amount) + Number(c.extra_hire_amount)) - Number(c.advance_amount));

        const html = `<!DOCTYPE html>
<html>
<head>
<title>Challan - ${c.challan_no}</title>
<style>
@page { size: A4; margin: 10mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; }

.page { border: 2px solid #000; padding: 0; width: 100%; }

/* ─── HEADER ─── */
.header { display: flex; align-items: center; border-bottom: 2px solid #000; padding: 10px 15px; }
.header-logo { font-size: 36px; font-weight: 900; color: #1a3764; border: 3px solid #1a3764; border-radius: 8px; padding: 4px 10px; margin-right: 15px; line-height: 1; }
.header-text { flex: 1; }
.header-text h1 { font-size: 26px; font-weight: 900; color: #1a3764; letter-spacing: 1px; }
.header-text p { font-size: 9px; color: #333; margin-top: 2px; }
.header-right { text-align: right; font-size: 9px; line-height: 1.6; }
.header-right .pan { font-weight: 700; font-size: 10px; }

/* ─── TOP ROW: META ─── */
.meta-row { display: flex; border-bottom: 2px solid #000; }
.meta-cell { flex: 1; padding: 8px 12px; border-right: 1px solid #000; }
.meta-cell:last-child { border-right: none; }
.meta-cell .lbl { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #555; margin-bottom: 2px; }
.meta-cell .val { font-size: 14px; font-weight: 800; color: #1a3764; }

/* ─── BODY GRID ─── */
.body-grid { display: grid; grid-template-columns: 1fr 1fr; }
.body-left { border-right: 2px solid #000; }
.body-right { }

.field-row { display: flex; border-bottom: 1px solid #aaa; min-height: 30px; }
.field-label { width: 130px; font-size: 9px; font-weight: 700; padding: 6px 10px; text-transform: uppercase; color: #333; background: #f5f5f5; border-right: 1px solid #aaa; display: flex; align-items: center; }
.field-value { flex: 1; font-size: 12px; font-weight: 600; padding: 6px 10px; display: flex; align-items: center; }

.field-row-highlight { background: #eef4ff; }
.field-value-large { font-size: 16px; font-weight: 800; color: #1a3764; }

/* ─── CHARGES TABLE ─── */
.charges-section { border-top: 2px solid #000; }
.charges-title { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 6px 12px; background: #1a3764; color: #fff; letter-spacing: 1px; }
.charges-grid { display: grid; grid-template-columns: 1fr 1fr; }
.charge-cell { display: flex; border-bottom: 1px solid #aaa; border-right: 1px solid #aaa; }
.charge-cell:nth-child(even) { border-right: none; }
.charge-lbl { width: 120px; font-size: 9px; font-weight: 600; padding: 5px 10px; background: #f9f9f9; border-right: 1px solid #aaa; }
.charge-val { flex: 1; font-size: 11px; font-weight: 700; padding: 5px 10px; text-align: right; font-family: monospace; }

.total-row { display: flex; border-top: 2px solid #000; background: #eef4ff; }
.total-lbl { flex: 1; font-size: 12px; font-weight: 800; padding: 10px 15px; text-transform: uppercase; }
.total-val { font-size: 18px; font-weight: 900; padding: 10px 15px; color: #1a3764; font-family: monospace; }

/* ─── FOOTER ─── */
.footer { display: flex; justify-content: space-between; border-top: 2px solid #000; padding: 15px; }
.sig-box { text-align: center; width: 180px; }
.sig-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 5px; font-size: 9px; font-weight: 700; }
.gen-info { font-size: 8px; color: #888; text-align: center; padding-top: 60px; }
</style>
</head>
<body>
<div class="page">
    <!-- HEADER -->
    <div class="header">
        <div class="header-logo">VGT</div>
        <div class="header-text">
            <h1>Visakha Golden Transport</h1>
            <p>D.No. 8-19-58/A, Gopal Nagar, Near Bank Colony, Vizianagaram-535003 (A.P.)</p>
            <p>Cell: 9701523640 | Website: https://visakhagolden.com | Email: support@visakhagolden.com</p>
        </div>
        <div class="header-right">
            <div class="pan">PAN NO: AAWFV7670H</div>
            <div>GSTIN: 37AAWFV7670H1Z8</div>
        </div>
    </div>

    <!-- META ROW -->
    <div class="meta-row">
        <div class="meta-cell">
            <div class="lbl">Challan No</div>
            <div class="val">${c.challan_no}</div>
        </div>
        <div class="meta-cell">
            <div class="lbl">Date</div>
            <div class="val">${formatDateSafe(c.created_at, 'dd/MM/yyyy')}</div>
        </div>
        <div class="meta-cell">
            <div class="lbl">Challan Type</div>
            <div class="val">${c.challan_type}</div>
        </div>
        <div class="meta-cell">
            <div class="lbl">Status</div>
            <div class="val">${c.status}</div>
        </div>
    </div>

    <!-- BODY GRID -->
    <div class="body-grid">
        <div class="body-left">
            <div class="field-row field-row-highlight">
                <div class="field-label">From</div>
                <div class="field-value field-value-large">${c.origin_branch?.name || '---'}</div>
            </div>
            <div class="field-row field-row-highlight">
                <div class="field-label">To</div>
                <div class="field-value field-value-large">${c.destination_branch?.name || '---'}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Owner Type</div>
                <div class="field-value">${c.owner_type || 'MARKET'}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Reporting Date</div>
                <div class="field-value">${formatDateSafe(c.date_from, 'dd/MM/yyyy')}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Release Date</div>
                <div class="field-value">${formatDateSafe(c.date_to, 'dd/MM/yyyy')}</div>
            </div>
        </div>
        <div class="body-right">
            <div class="field-row">
                <div class="field-label">Vehicle No.</div>
                <div class="field-value" style="font-size:16px; font-weight:900; letter-spacing:2px;">${c.vehicle_no}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Driver Name</div>
                <div class="field-value">${c.driver_name || '---'}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Driver Mobile</div>
                <div class="field-value">${c.driver_mobile || '---'}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Origin City</div>
                <div class="field-value">${c.origin_branch?.city || '---'}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Dest. City</div>
                <div class="field-value">${c.destination_branch?.city || '---'}</div>
            </div>
        </div>
    </div>

    <!-- CHARGES -->
    <div class="charges-section">
        <div class="charges-title">Financial Details</div>
        <div class="charges-grid">
            <div class="charge-cell">
                <div class="charge-lbl">Total Hire Amt</div>
                <div class="charge-val">₹ ${Number(c.total_hire_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
            </div>
            <div class="charge-cell">
                <div class="charge-lbl">Extra Hire Amt</div>
                <div class="charge-val">₹ ${Number(c.extra_hire_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
            </div>
            <div class="charge-cell">
                <div class="charge-lbl">Advance Paid</div>
                <div class="charge-val" style="color: #c00;">- ₹ ${Number(c.advance_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
            </div>
            <div class="charge-cell">
                <div class="charge-lbl">Balance Amount</div>
                <div class="charge-val" style="font-weight:900; color:#1a3764;">₹ ${balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
            </div>
        </div>
        <div class="total-row">
            <div class="total-lbl">Balance Payable</div>
            <div class="total-val">₹ ${balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
        <div class="sig-box">
            <div class="sig-line">Authorized Signatory</div>
        </div>
        <div class="gen-info">Generated: ${new Date().toLocaleString('en-IN')}</div>
        <div class="sig-box">
            <div class="sig-line">Driver Signature</div>
        </div>
    </div>
</div>
</body>
</html>`;

        // Use hidden iframe to avoid screen blink
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;
        doc.open();
        doc.write(html);
        doc.close();

        // Wait for content to render, then print
        iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        };
        // Trigger onload for already-loaded content
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        }, 300);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                {/* Hidden iframe for printing */}
                <iframe ref={iframeRef} style={{ position: 'absolute', width: 0, height: 0, border: 'none', overflow: 'hidden' }} />

                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Challan: {c.challan_no}
                            </DialogTitle>
                            <DialogDescription>
                                Detailed view of the lorry challan
                            </DialogDescription>
                        </div>
                        <Badge variant="outline" className="font-mono">{c.status}</Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Location Info */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Origin</span>
                            <div className="font-bold">{c.origin_branch?.name}</div>
                            <div className="text-xs text-muted-foreground">{c.origin_branch?.city}</div>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center border shadow-sm text-muted-foreground">→</div>
                        <div className="space-y-1 text-right">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Destination</span>
                            <div className="font-bold">{c.destination_branch?.name}</div>
                            <div className="text-xs text-muted-foreground">{c.destination_branch?.city}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <Card>
                            <CardHeader className="py-2 px-4 bg-slate-50 border-b">
                                <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                    <Truck className="h-3.5 w-3.5" /> Vehicle & Driver
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                <InfoItem label="Vehicle No" value={c.vehicle_no} />
                                <Separator />
                                <InfoItem label="Driver Name" value={c.driver_name} />
                                <InfoItem label="Driver Mobile" value={c.driver_mobile} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="py-2 px-4 bg-slate-50 border-b">
                                <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                    <Info className="h-3.5 w-3.5" /> Additional Info
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                <InfoItem label="Challan Type" value={c.challan_type} />
                                <InfoItem label="Owner Type" value={c.owner_type} />
                                <Separator />
                                <div className="grid grid-cols-2 gap-2">
                                    <InfoItem label="From" value={formatDateSafe(c.date_from, 'dd/MM/yyyy')} />
                                    <InfoItem label="To" value={formatDateSafe(c.date_to, 'dd/MM/yyyy')} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-emerald-100 bg-emerald-50/20">
                        <CardHeader className="py-2 px-4 bg-emerald-50 border-b border-emerald-100">
                            <CardTitle className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-2">
                                Financial Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <InfoItem label="Total Hire" value={`₹ ${Number(c.total_hire_amount).toLocaleString()}`} />
                            <InfoItem label="Extra Hire" value={`₹ ${Number(c.extra_hire_amount).toLocaleString()}`} />
                            <InfoItem label="Advance Paid" value={`₹ ${Number(c.advance_amount).toLocaleString()}`} />
                            <div>
                                <Label className="text-[10px] uppercase font-bold text-emerald-700">Balance</Label>
                                <div className="text-sm font-black text-emerald-800">
                                    ₹ {((Number(c.total_hire_amount) + Number(c.extra_hire_amount)) - Number(c.advance_amount)).toLocaleString()}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Created: {formatDateSafe(c.created_at, 'dd/MM/yyyy HH:mm')}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                            <Printer className="h-4 w-4" /> Print PDF
                        </Button>
                        <Button size="sm" onClick={onClose}>Close</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function InfoItem({ label, value }: { label: string, value: any }) {
    return (
        <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">{label}</Label>
            <div className="text-sm font-semibold text-foreground truncate">{value || '---'}</div>
        </div>
    );
}
