'use client';

import React, { useRef, useState } from 'react';
import {
    Truck,
    Info,
    FileText,
    Printer,
    Download,
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

interface ChallanDetails {
    id: string;
    challan_no: string;
    challan_type: string;
    challan_mode?: string;
    status: string;
    owner_type?: string;
    date_from?: string | null;
    date_to?: string | null;
    vehicle_no: string;
    driver_name?: string | null;
    driver_mobile?: string | null;
    total_hire_amount?: number | string | null;
    extra_hire_amount?: number | string | null;
    advance_amount?: number | string | null;
    created_at: string;
    unloading_area?: string | null;
    origin_branch?: { name?: string | null; city?: string | null } | null;
    destination_branch?: { name?: string | null; city?: string | null } | null;
}

interface ChallanDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    challan: any;
}

export function ChallanDetailsDialog({ isOpen, onClose, challan }: ChallanDetailsDialogProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [logoBase64, setLogoBase64] = React.useState<string | null>(null);

    React.useEffect(() => {
        let isMounted = true;
        const loadLogo = async () => {
            try {
                const res = await fetch('/vgt_logo.png');
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (isMounted) setLogoBase64(String(reader.result));
                };
                reader.readAsDataURL(blob);
            } catch (err) {
                console.error('Failed to load logo base64:', err);
            }
        };
        loadLogo();
        return () => { isMounted = false; };
    }, []);

    if (!challan) return null;

    const c = challan;

    const formatDateSafe = (dateStr: string | number | Date | null | undefined, formatStr: string) => {
        try {
            if (!dateStr) return '---';
            return format(new Date(dateStr), formatStr);
        } catch {
            return '---';
        }
    };

    const handlePrint = async (mode: 'print' | 'download' = 'print') => {
        if (mode === 'download') setIsDownloading(true);
        try {
            const totalHireAmount = Number(c.total_hire_amount) || 0;
            const advance = Number(c.advance_amount) || 0;
            const lessTds = Number(c.less_tds || 0);
            const balance = totalHireAmount - advance - lessTds;

            const formatNumber = (val: any) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const toUpperValue = (value: any) => String(value ?? '').trim() ? String(value).toUpperCase() : '---';
            const logoUrl = logoBase64 || `${window.location.origin}/vgt_logo.png`;

            const html = `<!DOCTYPE html>
<html>
<head>
<title>CHALLAN - ${c.challan_no}</title>
<style>
@page { size: A4 landscape; margin: 5mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: "Times New Roman", Georgia, serif; font-size: 11px; color: #111; }
.page { position: relative; background: #ffffff; width: 274mm; min-height: 189mm; margin: 0 auto; padding-right: 2.5mm; padding-bottom: 8mm; overflow: hidden; box-shadow: inset 0 0 0 2px #1d2f7a; }
.row { display: flex; width: 100%; }
.box { border: 1px solid #1d2f7a; border-radius: 6px; padding: 4px 6px; }
.tiny { font-size: 11px; line-height: 1.25; }
.lbl { font-size: 11px; font-weight: 700; color: #1d2f7a; }
.strong { font-weight: 700; }
.head-blue { color: #17308b; font-weight: 800; }
.lr-red { color: #cc1a1a; font-weight: 900; font-size: 20px; letter-spacing: 1px; }
.hdr { border-bottom: 2px solid #1d2f7a; padding: 8px 10px 20px; }
.logo-box { width: 120px; height: 60px; display:flex; align-items:center; justify-content:center; }
.logo-box img { width: 100%; height: 100%; object-fit: contain; }
.top-grid { display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 6px; padding: 6px; border-bottom: 1px solid #1d2f7a; }
.mid-grid { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; padding: 6px; border-bottom:1px solid #1d2f7a; }
.right-stack > div { border-bottom: 1px solid #1d2f7a; padding: 4px 5px; min-height: 28px; }
.right-stack > div:last-child { border-bottom: none; }
.main-table { width:100%; border-collapse: collapse; }
.main-table th, .main-table td { border:1px solid #1d2f7a; padding: 6px 8px; vertical-align: middle; }
.main-table th { background: rgba(255,255,255,0.65); color:#122d7a; font-size: 13px; font-weight: 700; text-align: left; }
.ink { font-family: Arial, Helvetica, sans-serif; color: #132b94; font-weight: 700; letter-spacing: 0.2px; }
.note-section { border-top: 1px solid #1d2f7a; padding: 10px; }
.note-box { border: 1px solid #1d2f7a; padding: 8px; font-size: 12px; line-height: 1.5; }
.footer-signs { display:flex; justify-content:space-between; padding:20px 20px 5px; font-size: 14px; font-weight: bold; }
</style>
</head>
<body>
<div class="page">
    <div class="hdr">
        <div class="row" style="gap:10px; align-items:center;">
            <div class="logo-box"><img src="${logoUrl}" alt="VGT Logo" /></div>
            <div style="flex:1; text-align:center;">
                <div class="head-blue" style="font-size:48px; line-height:1; margin-bottom:15px;">Visakha Golden Transport</div>
                <div class="strong" style="font-size:14px; margin-bottom:4px;">D.No. 8-19-58/A, Gopal Nagar, Near Bank Colony, Vizianagaram-535003 (A.P.)</div>
                <div style="font-size:13px;">Cell : 9701523640, Website : https://visakhagolden.com, Email : support@visakhagolden.com</div>
            </div>
        </div>
    </div>
    <div class="top-grid">
        <div class="box right-stack tiny">
             <div style="text-align:center; background:#17308b; color:#fff; font-weight:900; font-size:18px; padding:6px 0;">TRUCK CHALLAN</div>
             <div><span class="lbl">Date: </span><span class="strong ink" style="font-size:16px;">${formatDateSafe(c.created_at, 'dd/MM/yyyy')}</span></div>
             <div><span class="lbl">Status: </span><span class="strong ink">${toUpperValue(c.status)}</span></div>
        </div>
        <div class="box right-stack tiny" style="display:flex; flex-direction:column; justify-content:center; align-items:center;">
             <div style="border:none;"><span class="lbl" style="font-size:16px;">Challan No: </span><span class="lr-red" style="font-size:32px;">${c.challan_no}</span></div>
             <div style="border:none; margin-top:5px;"><span class="lbl">Mode: </span><span class="strong ink">${toUpperValue(c.challan_mode || c.challan_type)}</span></div>
        </div>
        <div class="box right-stack tiny">
            <div><span class="lbl">PAN NO : </span><span class="strong ink">AAWFV7670H</span></div>
            <div><span class="lbl">GSTIN : </span><span class="strong ink">37AAWFV7670H1Z8</span></div>
            <div><span class="lbl">Load Date : </span><span class="strong ink">${formatDateSafe(c.date_from, 'dd/MM/yyyy')}</span></div>
        </div>
    </div>
    <div class="mid-grid">
        <div class="box right-stack tiny">
            <div style="background:#f0f4ff;"><span class="lbl">ROUTE / TRIP INFO</span></div>
            <div><span class="lbl">Loading Point:</span><br/><span class="strong ink" style="font-size:16px;">${toUpperValue(c.loading_point || c.origin_branch?.name)}</span></div>
            <div><span class="lbl">Destination Point:</span><br/><span class="strong ink" style="font-size:16px;">${toUpperValue(c.destination_point || c.destination_branch?.name || c.unloading_area)}</span></div>
        </div>
        <div class="box right-stack tiny">
            <div style="background:#f0f4ff;"><span class="lbl">VEHICLE & DRIVER INFO</span></div>
            <div><span class="lbl">Vehicle Number:</span><br/><span class="strong ink" style="font-size:18px; letter-spacing:1px;">${toUpperValue(c.vehicle_no)}</span></div>
            <div><span class="lbl">Driver Name:</span><br/><span class="strong ink" style="font-size:15px;">${toUpperValue(c.driver_name)}</span></div>
            <div><span class="lbl">Driver Mobile:</span><br/><span class="strong ink" style="font-size:15px;">${toUpperValue(c.driver_mobile)}</span></div>
        </div>
        <div class="box right-stack tiny">
            <div style="background:#f0f4ff;"><span class="lbl">BROKER / OWNER INFO</span></div>
            <div><span class="lbl">Broker Name:</span><br/><span class="strong ink" style="font-size:15px;">${toUpperValue(c.broker_name)}</span></div>
            <div><span class="lbl">Broker Mobile:</span><br/><span class="strong ink">${toUpperValue(c.broker_mobile)}</span></div>
            <div><span class="lbl">Slip / Order No:</span><br/><span class="strong ink">${toUpperValue(c.slip_no)}</span></div>
        </div>
    </div>
    <div style="padding: 6px;">
        <table class="main-table">
            <thead>
                <tr>
                    <th style="width:35%">Financial Particulars</th>
                    <th style="width:15%; text-align:center;">Rate Type</th>
                    <th style="width:15%; text-align:right;">Quantity/Value</th>
                    <th style="width:35%; text-align:right;">Line Amount (₹)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="strong">Basic Lorry Hire / Freight</td>
                    <td style="text-align:center;">MT / Fixed</td>
                    <td style="text-align:right;">${c.hire_rate_per_kg || '---'}</td>
                    <td class="ink" style="text-align:right; font-size:14px;">${formatNumber(c.hire_amount)}</td>
                </tr>
                <tr>
                    <td class="strong">Extra Charges (Weight/Height/Dim.)</td>
                    <td style="text-align:center;">Combined</td>
                    <td style="text-align:right;">---</td>
                    <td class="ink" style="text-align:right;">${formatNumber(Number(c.extra_over_weight || 0) + Number(c.extra_over_height || 0) + Number(c.extra_over_length || 0) + Number(c.extra_over_width || 0))}</td>
                </tr>
                <tr>
                    <td class="strong">Extra KM / Detention Charges</td>
                    <td style="text-align:center;">Combined</td>
                    <td style="text-align:right;">---</td>
                    <td class="ink" style="text-align:right;">${formatNumber(Number(c.extra_km_charges || 0) + Number(c.detent_charges || 0))}</td>
                </tr>
                <tr style="background:#f9fafb; border-top:2px solid #1d2f7a;">
                    <td colspan="3" class="strong" style="font-size:16px; text-align:right;">TOTAL LORRY HIRE (GROSS)</td>
                    <td class="ink" style="text-align:right; font-size:18px; color:#111;">₹ ${formatNumber(totalHireAmount)}</td>
                </tr>
                <tr>
                    <td colspan="3" class="strong" style="text-align:right; color:#c2410c;">Less: TDS Dedn (${c.tds_percent || 0}%)</td>
                    <td class="ink" style="text-align:right; color:#c2410c;">- ₹ ${formatNumber(lessTds)}</td>
                </tr>
                <tr>
                    <td colspan="3" class="strong" style="text-align:right; color:#c2410c;">Less: Advance Paid</td>
                    <td class="ink" style="text-align:right; color:#c2410c;">- ₹ ${formatNumber(advance)}</td>
                </tr>
                <tr style="background:#eef2ff;">
                    <td colspan="3" class="strong" style="font-size:18px; text-align:right; color:#1a3764;">NET BALANCE PAYABLE</td>
                    <td class="ink" style="text-align:right; font-size:24px; color:#1a3764; border: 2px solid #1a3764;">₹ ${formatNumber(balance)}</td>
                </tr>
            </tbody>
        </table>
    </div>
    <div class="note-section">
        <div style="font-size:14px; font-weight:bold; margin-bottom:5px;">Truck Should reach on Date ......................</div>
        <div class="note-box">
            <div style="font-weight:bold; text-decoration:underline; margin-bottom:4px;">NOTE :</div>
            <div>1. Materials Should Be Delivered On Or Before Schedule Date &Time As Mentioned Above Other Wise Delay DeliveyCharges 2% Per Day On Total Lorry Hire Well Be Deducted.</div>
            <div>2. Goods Loaded In Good & Sound Condition Hence All Risks & Responsblities For Safe Movement and Safe Delivery of Goods Rest With Lorry Owner / Driver / Agent</div>
            <div>3. Recerved Sign Acknowledgement Should be deposited in 20 days Otherwise Penaity of Rs. 100/- per day will be deducted from Balance Hire</div>
            <div style="margin-top:8px; font-weight:bold; font-style:italic;">Weagree to all The Terms & Conditions Mentioned Above And Overleaf</div>
        </div>
    </div>
    <div class="footer-signs">
        <div>Agent : _____________________</div>
        <div style="text-align:right;">Driver : _____________________</div>
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

            await new Promise((resolve) => setTimeout(resolve, 800));

            if (mode === 'print') {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            } else {
                const page = doc.querySelector('.page') as HTMLElement;
                const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                    import('html2canvas'),
                    import('jspdf'),
                ]);
                const canvas = await html2canvas(page, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('l', 'mm', 'a4');
                pdf.addImage(imgData, 'PNG', 5, 5, 287, 200);
                pdf.save(`challan-${c.challan_no}.pdf`);
            }
        } catch (err) {
            console.error(err);
            alert("Action failed");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] md:max-w-5xl lg:max-w-6xl max-h-[90vh] overflow-y-auto">
                <iframe ref={iframeRef} style={{ position: 'fixed', left: '-10000px', top: 0, width: '1400px', height: '1000px', opacity: 0 }} />

                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Challan: {c.challan_no}
                            </DialogTitle>
                            <DialogDescription>Detailed view of the lorry challan</DialogDescription>
                        </div>
                        <Badge variant="outline" className="font-mono">{c.status}</Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Origin</span>
                            <div className="font-bold">{c.origin_branch?.name || '---'}</div>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center border shadow-sm text-muted-foreground">→</div>
                        <div className="space-y-1 text-right">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Destination</span>
                            <div className="font-bold">{c.destination_branch?.name || c.unloading_area || '---'}</div>
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
                                <InfoItem label="Challan Type" value={c.challan_mode || c.challan_type} />
                                <InfoItem label="Owner Type" value={c.owner_type} />
                                <Separator />
                                <div className="grid grid-cols-2 gap-2">
                                    <InfoItem label="From" value={formatDateSafe(c.date_from, 'dd/MM/yyyy')} />
                                    <InfoItem label="To" value={formatDateSafe(c.date_to, 'dd/MM/yyyy')} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Created: {formatDateSafe(c.created_at, 'dd/MM/yyyy HH:mm')}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handlePrint('print')} className="gap-2">
                            <Printer className="h-4 w-4" /> Print PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrint('download')} disabled={isDownloading} className="gap-2">
                            <Download className="h-4 w-4" /> {isDownloading ? 'Exporting...' : 'Download PDF'}
                        </Button>
                        <Button size="sm" onClick={onClose}>Close</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function InfoItem({ label, value }: { label: string, value: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">{label}</Label>
            <div className="text-sm font-semibold text-foreground truncate">{value || '---'}</div>
        </div>
    );
}
