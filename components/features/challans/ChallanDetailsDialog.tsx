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
import { formatLoadWeightDisplay, normalizeLoadUnit } from '@/lib/loadWeightDisplay';
import { sortLinkedConsignments } from '@/lib/sortLinkedConsignments';
import {
    loadPdfLogo,
    PDF_HEADER_LOGO_IMG_CSS,
    PDF_HEADER_TITLE_COLOR,
    PDF_LOGO_BOX_IMG_CSS,
    PDF_TABLE_HEADER_BG,
    PDF_TABLE_HEADER_TEXT_COLOR,
    VGT_LOGO_PATH,
} from '@/lib/pdfLogo';

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
    const [isLoadingCns, setIsLoadingCns] = useState(false);
    const [logoBase64, setLogoBase64] = React.useState<string | null>(null);
    const [linkedDetails, setLinkedDetails] = React.useState<any[]>([]);
    const [officerName, setOfficerName] = React.useState('---');

    React.useEffect(() => {
        let isMounted = true;
        const fetchLinkedConsignments = async () => {
            if (!challan?.linked_cn_nos || !Array.isArray(challan.linked_cn_nos) || challan.linked_cn_nos.length === 0) {
                if (isMounted) {
                    setLinkedDetails([]);
                    setIsLoadingCns(false);
                }
                return;
            }
            setIsLoadingCns(true);
            try {
                const res = await fetch(`/api/consignments/by-cn?cns=${challan.linked_cn_nos.join(',')}`);
                if (!res.ok) throw new Error('Failed');
                const data = await res.json();
                if (isMounted) {
                    setLinkedDetails(
                        Array.isArray(data) ? sortLinkedConsignments(data, 'cn_no', 'asc') : []
                    );
                }
            } catch (err) {
                console.error('Error resolving CN details:', err);
                if (isMounted) setLinkedDetails([]);
            } finally {
                if (isMounted) setIsLoadingCns(false);
            }
        };
        if (isOpen && challan) {
            fetchLinkedConsignments();
        }
        return () => { isMounted = false; };
    }, [isOpen, challan]);

    React.useEffect(() => {
        let isMounted = true;
        const loadCurrentUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (!res.ok) return;
                const result = await res.json();
                const fullName = result?.data?.full_name;
                if (isMounted && fullName) setOfficerName(fullName);
            } catch (err) {
                console.error('Failed loading officer:', err);
            }
        };
        loadCurrentUser();
        return () => { isMounted = false; };
    }, []);

    React.useEffect(() => {
        let isMounted = true;
        const loadLogo = async () => {
            try {
                const logoDataUrl = await loadPdfLogo();
                if (isMounted) setLogoBase64(logoDataUrl);
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
            // Ensure CN details are loaded before rendering — fetch inline if not yet available
            let resolvedLinkedDetails = linkedDetails;
            if (resolvedLinkedDetails.length === 0 && Array.isArray(c.linked_cn_nos) && c.linked_cn_nos.length > 0) {
                try {
                    const res = await fetch(`/api/consignments/by-cn?cns=${c.linked_cn_nos.join(',')}`);
                    if (res.ok) {
                        const data = await res.json();
                        resolvedLinkedDetails = Array.isArray(data)
                            ? sortLinkedConsignments(data, 'cn_no', 'asc')
                            : [];
                        setLinkedDetails(resolvedLinkedDetails);
                    }
                } catch { /* fall through with empty array */ }
            }

            const totalHireAmount = Number(c.total_hire_amount) || 0;
            const advance = Number(c.advance_amount) || 0;
            const lessTds = Number(c.less_tds || 0);
            const balance = totalHireAmount - advance - lessTds;
            const totalPkg = resolvedLinkedDetails.reduce((sum: number, item: any) => sum + (Number(item.total_qty) || Number(item.no_of_pkg) || 0), 0);
            const totalActualWeight = resolvedLinkedDetails.reduce((sum: number, item: any) => sum + (Number(item.actual_weight) || 0), 0);
            const totalChargedWeight = resolvedLinkedDetails.reduce((sum: number, item: any) => sum + (Number(item.charged_weight) || 0), 0);
            const weightUnit = normalizeLoadUnit(resolvedLinkedDetails[0]?.load_unit || 'MT');
            const formatChallanWeight = (weight: unknown, unit: unknown) => formatLoadWeightDisplay(weight, unit, 'challan');

            const formatNumber = (val: any) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const toUpperValue = (value: any) => String(value ?? '').trim() ? String(value).toUpperCase() : '---';
            const logoUrl = logoBase64 || `${window.location.origin}${VGT_LOGO_PATH}`;

            const html = `<!DOCTYPE html>
<html>
<head>
<title>CHALLAN - ${c.challan_no}</title>
<style>
@page { size: A4 portrait; margin: 5mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: "Times New Roman", Georgia, serif; font-size: 11px; color: #111; }
.page { position: relative; background: #ffffff; width: 198mm; min-height: 285mm; margin: 0 auto; padding-right: 2.5mm; padding-bottom: 8mm; overflow: hidden; box-shadow: inset 0 0 0 2px #1d2f7a; }
.row { display: flex; width: 100%; }
.box { border: 1px solid #1d2f7a; border-radius: 6px; padding: 4px 6px; }
.tiny { font-size: 11px; line-height: 1.25; }
.lbl { font-size: 11px; font-weight: 700; color: #1d2f7a; }
.strong { font-weight: 700; }
.head-blue { color: ${PDF_HEADER_TITLE_COLOR}; font-weight: 800; }
.lr-red { color: #cc1a1a; font-weight: 900; font-size: 20px; letter-spacing: 1px; }
.hdr { border-bottom: 2px solid #1d2f7a; padding: 8px 10px 8px; }
.logo-box { width: 120px; height: 60px; display:flex; align-items:center; justify-content:center; }
.logo-box img { ${PDF_LOGO_BOX_IMG_CSS} }
.top-grid { display: grid; gap: 6px; padding: 6px; border-bottom: 1px solid #1d2f7a; }
.mid-grid { display:grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 6px; padding: 6px; border-bottom:1px solid #1d2f7a; }
.right-stack > div { border-bottom: 1px solid #1d2f7a; padding: 4px 5px; min-height: 28px; }
.right-stack > div:last-child { border-bottom: none; }
.main-table { width:100%; border-collapse: collapse; }
.main-table th, .main-table td { border:1px solid #1d2f7a; padding: 10px 8px; vertical-align: middle; line-height:1.4; }
.main-table th { background: ${PDF_TABLE_HEADER_BG}; color: ${PDF_TABLE_HEADER_TEXT_COLOR}; font-size: 10px; font-weight: 800; text-align: center; }
.panel-heading { background: ${PDF_TABLE_HEADER_BG}; color: ${PDF_TABLE_HEADER_TEXT_COLOR}; text-align: center; padding: 4px 6px; font-weight: 900; letter-spacing: 0.5px; font-size: 11px; }
.section-heading { display: block; font-size: 12px; font-weight: 900; color: ${PDF_HEADER_TITLE_COLOR}; text-transform: uppercase; text-align: left; margin-bottom: 10px; padding: 5px 0; }
.main-table tbody td { text-align: center; }
.summary-heading { background: ${PDF_TABLE_HEADER_BG}; color: ${PDF_TABLE_HEADER_TEXT_COLOR}; font-weight: 900; }
.hire-table .summary-heading td { background: ${PDF_TABLE_HEADER_BG}; color: ${PDF_TABLE_HEADER_TEXT_COLOR}; font-weight: 900; vertical-align: middle !important; padding: 10px 8px !important; line-height: 1 !important; }
.gross-hire-label { font-size: 12px; }
.gross-hire-amount { font-size: 16px; color: #111 !important; font-weight: 900; }
.hire-table .net-balance-row td { padding: 10px 8px !important; vertical-align: middle !important; line-height: 1 !important; }
.net-balance-label { font-size: 13px; }
.net-balance-amount { font-size: 16px; color: #111 !important; font-weight: 900; }
.ink { font-family: Arial, Helvetica, sans-serif; color: #111; font-weight: 700; letter-spacing: 0.2px; }
.hire-table { width: 100%; border-collapse: collapse; }
.hire-table th { background: ${PDF_TABLE_HEADER_BG}; color: ${PDF_TABLE_HEADER_TEXT_COLOR}; font-weight: 800; }
.hire-table th, .hire-table td { border: 1px solid #1d2f7a; vertical-align: middle !important; padding: 6px 8px !important; }
.note-section { border-top: 1px solid #1d2f7a; padding: 10px; }
.note-box { border: 1px solid #1d2f7a; padding: 8px; font-size: 12px; line-height: 1.5; }
.footer-signs { display:flex; justify-content:space-between; padding:20px 20px 5px; font-size: 14px; font-weight: bold; }
</style>
</head>
<body>
<div class="page">
    <div class="hdr">
        <div style="display:grid; grid-template-columns: auto 1fr auto; gap:10px; align-items:center;">
            <!-- LEFT: Challan Number -->
            <div style="text-align:left; padding-left:4px;">
                <div style="font-size:20px; color:#555; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Lorry Challan</div>
                <div style="font-size:16px; font-weight:900; color:#cc1a1a; line-height:1; letter-spacing:1px;">Challan No. ${c.challan_no}</div>
                <div style="font-size:16px; color:#444; margin-top:5px; font-weight:600;">Date: ${formatDateSafe(c.date_from || c.created_at, 'dd/MM/yyyy')}</div>
                <div style="font-size:11px; margin-top:8px; line-height:1.4;">
                    <div style="color:#555; font-weight:700;">From: <span class="ink">${toUpperValue(c.loading_point || c.origin_branch?.name)}</span></div>
                    <div style="color:#555; font-weight:700;">To: <span class="ink">${toUpperValue(c.destination_point || c.destination_branch?.name || c.unloading_area)}</span></div>
                </div>
            </div>
            <!-- CENTER: Logo + Company -->
            <div style="text-align:center;">
                <img src="${logoUrl}" alt="VGT Logo" style="${PDF_HEADER_LOGO_IMG_CSS}; display:block; margin:0 auto 8px;" />
                <div class="head-blue" style="font-size:22px; line-height:1; font-weight:900; margin-bottom:12px; white-space:nowrap;">Visakha Golden Transport</div>
            </div>
            <!-- RIGHT: Address + Contact -->
            <div style="text-align:right; padding-right:4px;">
                <div class="strong" style="font-size:11px; margin-bottom:3px;">D.No. 8-19-58/A, Gopal Nagar,</div>
                <div class="strong" style="font-size:11px; margin-bottom:3px;">Near Bank Colony,<br/>Vizianagaram-535003 (A.P.)</div>
                <div style="font-size:10px; color:#444;">Cell : 9392223404</div>
                <div style="font-size:10px; color:#444;">Email : support@visakhagolden.com</div>
            </div>
        </div>
    </div>
    <!-- 4-BOX GRID: Driver | Vehicle | Broker/Owner | Owner/Lorry Party -->
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; padding: 6px 8px 0;">
        <!-- BOX 1: DRIVER DETAILS -->
        <div class="box right-stack tiny" style="padding:0; overflow:hidden;">
            <div class="panel-heading">DRIVER DETAILS</div>
            <div style="padding:3px 6px;"><span class="lbl">Driver Name:</span><br/><span class="strong ink" style="font-size:12px;">${toUpperValue(c.driver_name)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">Mobile:</span><span class="strong ink">${toUpperValue(c.driver_mobile)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">DL No:</span><span class="strong ink" style="font-size:10px;">${toUpperValue(c.driver_dl_no)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">Validity:</span><span class="strong ink">${formatDateSafe(c.driver_dl_validity, 'dd/MM/yyyy')}</span></div>
            <div style="padding:2px 6px 5px;"><span class="lbl">Address:</span><br/><span class="strong ink" style="font-size:10px;">${toUpperValue(c.driver_address)}</span></div>
        </div>
        <!-- BOX 2: VEHICLE INFO -->
        <div class="box right-stack tiny" style="padding:0; overflow:hidden;">
            <div class="panel-heading">VEHICLE INFO</div>
            <div style="padding:3px 6px;"><span class="lbl">Vehicle No:</span><br/><span class="strong ink" style="font-size:13px;">${toUpperValue(c.vehicle_no)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">Permit:</span><span class="strong ink" style="font-size:10px;">${toUpperValue(c.permit_no)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">Insurance:</span><span class="strong ink" style="font-size:10px;">${toUpperValue(c.insurance_policy_no)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">Engine No:</span><span class="strong ink" style="font-size:9px;">${toUpperValue(c.engine_no)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px 5px;"><span class="lbl">Chassis:</span><span class="strong ink" style="font-size:9px;">${toUpperValue(c.chasis_no)}</span></div>
        </div>
        <!-- BOX 3: BROKER / OWNER DETAILS -->
        <div class="box right-stack tiny" style="padding:0; overflow:hidden;">
            ${c.engagement_type === 'direct' ? `
            <div class="panel-heading">OWNER DETAILS</div>
            <div style="padding:3px 6px;"><span class="lbl">Owner Name:</span><br/><span class="strong ink" style="font-size:12px;">${toUpperValue(c.owner_name)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">PAN:</span><span class="strong ink">${toUpperValue(c.owner_pan)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">Mobile:</span><span class="strong ink">${toUpperValue(c.owner_mobile)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px 5px;"><span class="lbl">Slip:</span><span class="strong ink">${toUpperValue(c.slip_no)}</span></div>
            ` : `
            <div class="panel-heading">BROKER DETAILS</div>
            <div style="padding:3px 6px;"><span class="lbl">Broker Name:</span><br/><span class="strong ink" style="font-size:12px;">${toUpperValue(c.broker_name)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">Phone:</span><span class="strong ink">${toUpperValue(c.broker_mobile)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">Slip:</span><span class="strong ink">${toUpperValue(c.slip_no)}</span></div>
            <div style="padding:2px 6px 5px;"><span class="lbl">Address:</span><br/><span class="strong ink" style="font-size:10px;">${toUpperValue(c.broker_address)}</span></div>
            `}
        </div>
        <!-- BOX 4: OWNER / LORRY PARTY -->
        <div class="box right-stack tiny" style="padding:0; overflow:hidden;">
            <div class="panel-heading">OWNER / LORRY PARTY</div>
            <div style="padding:3px 6px;"><span class="lbl">Name:</span><br/><span class="strong ink" style="font-size:12px;">${toUpperValue(c.owner_name || c.broker_name)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">PAN:</span><span class="strong ink">${toUpperValue(c.owner_pan)}</span></div>
            <div style="display:flex; justify-content:space-between; padding:2px 6px;"><span class="lbl">Mobile:</span><span class="strong ink">${toUpperValue(c.owner_mobile || c.broker_mobile)}</span></div>
            <div style="padding:2px 6px 5px;"><span class="lbl">Address:</span><br/><span class="strong ink" style="font-size:10px;">${toUpperValue(c.owner_address || c.broker_address)}</span></div>
        </div>
    </div>

    <!-- CONSIGNMENT DETAILS (full width) -->
    <div style="padding: 4px 6px 0;">
        <div class="section-heading">Consignment Details</div>
        <table class="main-table" style="margin-bottom:6px;">
            <thead>
                <tr style="font-size:10px;">
                    <th style="width:12%; padding:6px 6px 8px;">CN Number</th>
                    <th style="width:16%; padding:6px 6px 8px;">Loading Point</th>
                    <th style="width:16%; padding:6px 6px 8px;">Unloading Point</th>
                    <th style="width:24%; padding:6px 6px 8px;">Goods Description</th>
                    <th style="width:10%; padding:6px 6px 8px; text-align:center;">Pkg</th>
                    <th style="width:11%; padding:6px 6px 8px; text-align:center;">Actual Wt</th>
                    <th style="width:11%; padding:6px 6px 8px; text-align:center;">Charged Wt</th>
                </tr>
            </thead>
            <tbody style="font-size:11px;">
                ${(() => {
                    const FIXED_ROWS = 5;
                    const renderRow = (item: any) => {
                        const qty = Number(item.total_qty) || Number(item.no_of_pkg) || 0;
                        return `<tr style="height:28px;">
                            <td style="font-weight:700; padding:6px 6px 8px; text-align:center;" class="ink">${item.cn_no}</td>
                            <td style="font-size:10px; padding:6px 6px 8px; text-align:center;">${toUpperValue(item.loading_point || item.booking_branch || item.bkg_branch)}</td>
                            <td style="font-size:10px; padding:6px 6px 8px; text-align:center;">${toUpperValue(item.delivery_point || item.dest_branch)}</td>
                            <td style="font-size:10px; padding:6px 6px 8px; text-align:center;">${toUpperValue(item.goods_class || item.goods_desc || 'GENERAL GOODS')}</td>
                            <td style="text-align:center; padding:6px 6px 8px;">${qty || '0'}</td>
                            <td style="text-align:center; padding:6px 6px 8px;">${formatChallanWeight(item.actual_weight, item.load_unit)}</td>
                            <td style="text-align:center; font-weight:bold; color:#111; padding:6px 6px 8px;">${formatChallanWeight(item.charged_weight, item.load_unit)}</td>
                        </tr>`;
                    };
                    const firstPage = resolvedLinkedDetails.slice(0, FIXED_ROWS).map(renderRow);
                    const emptyCount = Math.max(0, FIXED_ROWS - firstPage.length);
                    const emptyRows = Array(emptyCount).fill('<tr style="height:28px;"><td style="padding:6px 6px 8px;">&nbsp;</td><td style="padding:6px 6px 8px;"></td><td style="padding:6px 6px 8px;"></td><td style="padding:6px 6px 8px;"></td><td style="padding:6px 6px 8px;"></td><td style="padding:6px 6px 8px;"></td><td style="padding:6px 6px 8px;"></td></tr>');
                    return [...firstPage, ...emptyRows].join('');
                })()}
            </tbody>
            <tfoot>
                <tr style="font-weight:900; font-size:10px;">
                    <td colspan="4" style="padding:6px 6px 8px; font-weight:600; font-size:10px; background:#fff; color:#111;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span>Remarks: <span style="font-weight:400;">${c.remarks ? String(c.remarks).toUpperCase() : ''}</span></span>
                            <span style="font-weight:900; color:#1d2f7a;">GRAND TOTAL</span>
                        </div>
                    </td>
                    <td style="padding:6px 6px 8px; text-align:center; font-weight:900; color:#1d2f7a;">${totalPkg} Pkg</td>
                    <td style="padding:6px 6px 8px; text-align:center; font-weight:900; color:#1d2f7a;">${formatChallanWeight(totalActualWeight, weightUnit)}</td>
                    <td style="padding:6px 6px 8px; text-align:center; font-weight:900; color:#111;">${formatChallanWeight(totalChargedWeight, weightUnit)}</td>
                </tr>
            </tfoot>
        </table>
    </div>
    ${resolvedLinkedDetails.length > 5 ? `
    <!-- PAGE 2: Overflow CNs only -->
    <div style="page-break-before: always; padding: 10px 8px;">
        <div class="section-heading" style="margin-bottom:6px;">Challan No: ${c.challan_no} &nbsp;|&nbsp; Consignment Details (Continued)</div>
        <table class="main-table">
            <thead>
                <tr style="font-size:10px;">
                    <th style="width:12%; padding:6px 4px;">CN Number</th>
                    <th style="width:16%; padding:6px 4px;">Loading Point</th>
                    <th style="width:16%; padding:6px 4px;">Unloading Point</th>
                    <th style="width:24%; padding:6px 4px;">Goods Description</th>
                    <th style="width:10%; padding:6px 4px; text-align:center;">Qty</th>
                    <th style="width:11%; padding:6px 4px; text-align:center;">Actual Wt</th>
                    <th style="width:11%; padding:6px 4px; text-align:center;">Charged Wt</th>
                </tr>
            </thead>
            <tbody style="font-size:11px;">
                ${resolvedLinkedDetails.slice(5).map(item => {
                    const qty = Number(item.total_qty) || Number(item.no_of_pkg) || 0;
                    return `<tr style="height:30px;">
                        <td style="font-weight:700; padding:6px 4px; text-align:center;" class="ink">${item.cn_no}</td>
                        <td style="font-size:10px; padding:6px 4px; text-align:center;">${toUpperValue(item.loading_point || item.booking_branch || item.bkg_branch)}</td>
                        <td style="font-size:10px; padding:6px 4px; text-align:center;">${toUpperValue(item.delivery_point || item.dest_branch)}</td>
                        <td style="font-size:10px; padding:6px 4px; text-align:center;">${toUpperValue(item.goods_class || item.goods_desc || 'GENERAL GOODS')}</td>
                        <td style="text-align:center; padding:6px 4px;">${qty || '0'}</td>
                        <td style="text-align:center; padding:6px 4px;">${formatChallanWeight(item.actual_weight, item.load_unit)}</td>
                        <td style="text-align:center; font-weight:bold; color:#111; padding:6px 4px;">${formatChallanWeight(item.charged_weight, item.load_unit)}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>` : ''}
    <div style="padding: 0 6px 0;">

        <div class="section-heading">Lorry Hire Details</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
            <!-- LEFT: individual line items -->
            <table class="hire-table" style="font-size:10px;">
                <thead>
                    <tr>
                        <th style="text-align:left;">Particulars</th>
                        <th style="text-align:right; width:30%;">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Basic Lorry Hire <span style="color:#555;">(Rate: ${c.hire_rate_per_kg || '---'} * ${totalChargedWeight} ${weightUnit})</span></td>
                        <td style="text-align:right; font-weight:700; color:#111;">${Number(c.hire_amount) > 0 ? formatNumber(c.hire_amount) : ''}</td>
                    </tr>
                    <tr>
                        <td>Detention Charges</td>
                        <td style="text-align:right; font-weight:700; color:#111;">${Number(c.detent_charges) > 0 ? formatNumber(c.detent_charges) : ''}</td>
                    </tr>
                    <tr>
                        <td>Unloading Charges</td>
                        <td style="text-align:right; font-weight:700; color:#111;">${Number(c.unloading_charges) > 0 ? formatNumber(c.unloading_charges) : ''}</td>
                    </tr>
                    <tr>
                        <td>Extra Over Weight</td>
                        <td style="text-align:right; font-weight:700; color:#111;">${Number(c.extra_over_weight) > 0 ? formatNumber(c.extra_over_weight) : ''}</td>
                    </tr>
                    <tr>
                        <td>Extra Over Length</td>
                        <td style="text-align:right; font-weight:700; color:#111;">${Number(c.extra_over_length) > 0 ? formatNumber(c.extra_over_length) : ''}</td>
                    </tr>
                    <tr>
                        <td>Extra Over Width</td>
                        <td style="text-align:right; font-weight:700; color:#111;">${Number(c.extra_over_width) > 0 ? formatNumber(c.extra_over_width) : ''}</td>
                    </tr>
                    <tr>
                        <td>Extra Over Height</td>
                        <td style="text-align:right; font-weight:700; color:#111;">${Number(c.extra_over_height) > 0 ? formatNumber(c.extra_over_height) : ''}</td>
                    </tr>
                    <tr>
                        <td>Extra KM Charges</td>
                        <td style="text-align:right; font-weight:700; color:#111;">${Number(c.extra_km_charges) > 0 ? formatNumber(c.extra_km_charges) : ''}</td>
                    </tr>
                </tbody>
            </table>
            <!-- RIGHT: totals and deductions -->
            <table class="hire-table" style="font-size:10px; align-self:start;">
                <tbody>
                    <tr class="summary-heading">
                        <td class="gross-hire-label">TOTAL GROSS HIRE</td>
                        <td class="gross-hire-amount" style="text-align:right;">₹ ${formatNumber(totalHireAmount)}</td>
                    </tr>
                    <tr>
                        <td style="color:#c2410c; font-weight:700;">Less: TDS (${c.tds_percent || 0}%)</td>
                        <td style="text-align:right; color:#c2410c; font-weight:700;">- ₹ ${formatNumber(lessTds)}</td>
                    </tr>
                    <tr>
                        <td style="color:#c2410c; font-weight:700;">Less: Advance Paid</td>
                        <td style="text-align:right; color:#c2410c; font-weight:700;">- ₹ ${formatNumber(advance)}</td>
                    </tr>
                    <tr class="summary-heading net-balance-row">
                        <td class="net-balance-label">NET BALANCE PAYABLE</td>
                        <td class="net-balance-amount" style="text-align:right;">₹ ${formatNumber(balance)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <div class="note-section" style="border-top:none; padding-top:10px;">
        <div style="font-size:14px; font-weight:bold; margin-bottom:10px;">Truck Should reach on Date : <span style="color:#cc1a1a; text-decoration:underline;">${c.truck_schedule_date ? formatDateSafe(c.truck_schedule_date, 'dd/MM/yyyy') : '............................'}</span></div>
        <div class="note-box" style="font-size:14px; line-height:1.5;">
            <div style="font-weight:bold; text-decoration:underline; margin-bottom:3px;">NOTE :</div>
            <div>1. Materials Should Be Delivered On Or Before Schedule Date &Time As Mentioned Above Other Wise Delay DeliveryCharges 2% Per Day On Total Lorry Hire Well Be Deducted.</div>
            <div>2. Goods Loaded In Good & Sound Condition Hence All Risks & Responsblities For Safe Movement and Safe Delivery of Goods Rest With Lorry Owner / Driver / Agent</div>
            <div>3. Received Sign Acknowledgement Should be deposited in 20 days Otherwise Penalty of Rs. 100/- per day will be deducted from Balance Hire</div>
            <div style="margin-top:5px; font-weight:bold; font-style:italic;">We agree to all The Terms & Conditions Mentioned Above And Overleaf</div>
        </div>
    </div>
    <div class="footer-signs" style="padding-top:10px; align-items: flex-end; margin-bottom: 15px;">
        <div style="font-size:14px; font-weight:bold;">Driver Signature : _____________________</div>
        <div style="text-align:right; font-size:13px; font-weight:bold;">
            <div class="ink" style="margin-bottom:8px; font-size:15px; font-weight:900; text-decoration:underline;">${toUpperValue(officerName)}</div>
            <div>Signature of Issuing Officer ..............................</div>
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
                const pdf = new jsPDF('p', 'mm', 'a4');
                pdf.addImage(imgData, 'PNG', 5, 5, 200, 287);
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
                        <Button variant="outline" size="sm" onClick={() => handlePrint('print')} disabled={isLoadingCns} className="gap-2">
                            <Printer className="h-4 w-4" /> {isLoadingCns ? 'Loading Data...' : 'Print PDF'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrint('download')} disabled={isDownloading || isLoadingCns} className="gap-2">
                            <Download className="h-4 w-4" /> {isDownloading ? 'Exporting...' : isLoadingCns ? 'Loading Data...' : 'Download PDF'}
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
