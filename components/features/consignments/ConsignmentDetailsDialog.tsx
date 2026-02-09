'use client';

import React from 'react';
import {
    X,
    User,
    Building,
    Package,
    Truck,
    Info,
    Calculator,
    Calendar as CalendarIcon,
    Hash,
    MapPin,
    FileText,
    Printer
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ConsignmentDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    consignment: any;
}

export function ConsignmentDetailsDialog({ isOpen, onClose, consignment }: ConsignmentDetailsDialogProps) {
    if (!consignment) return null;

    // Helper to safely access nested data
    const c = consignment;
    const consignor = c.consignor || {};
    const consignee = c.consignee || {};
    const billing = c.billing_details || {};
    const freight = c.freight_details || {};
    const history = c.tracking_history || [];

    // Print handler
    const handlePrint = () => {
        // Build package table rows
        const packageRows = c.package_details?.packages?.map((pkg: any) => `
            <tr>
                <td style="border:1px solid #ccc; padding:4px; text-align:center;">${pkg.sr_no}</td>
                <td style="border:1px solid #ccc; padding:4px;">${pkg.method}</td>
                <td style="border:1px solid #ccc; padding:4px; text-align:center;">${pkg.qty}</td>
            </tr>
        `).join('') || '<tr><td colspan="3" style="border:1px solid #ccc; padding:8px; text-align:center; color:#666;">No packages</td></tr>';

        // Build invoice table rows
        const invoiceRows = c.invoice_details?.invoices?.map((inv: any) => `
            <tr>
                <td style="border:1px solid #ccc; padding:4px;">${inv.invoice_no}</td>
                <td style="border:1px solid #ccc; padding:4px;">${inv.date}</td>
                <td style="border:1px solid #ccc; padding:4px;">₹ ${inv.amount?.toLocaleString()}</td>
                <td style="border:1px solid #ccc; padding:4px;">${inv.eway_bill || '---'}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="border:1px solid #ccc; padding:8px; text-align:center; color:#666;">No invoices</td></tr>';

        // Build history rows
        const historyRows = history.map((event: any) => `
            <div style="margin-bottom:10px; padding-left:15px; border-left:3px solid #3b82f6;">
                <div style="font-weight:bold;">${event.status}</div>
                <div style="font-size:10px; color:#666;">${event.date} | ${event.location}</div>
                <div style="font-size:11px;">${event.description}</div>
            </div>
        `).join('') || '<div style="color:#666; text-align:center;">No tracking history</div>';

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Consignment Note - ${c.cn_no}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; font-size: 11px; padding: 15px; }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                    .header h1 { font-size: 18px; margin-bottom: 5px; }
                    .header .cn-no { font-size: 16px; font-weight: bold; }
                    .section { margin-bottom: 12px; page-break-inside: avoid; }
                    .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; background: #e5e7eb; padding: 5px 8px; margin-bottom: 8px; border-left: 3px solid #3b82f6; }
                    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
                    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
                    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
                    .field { margin-bottom: 6px; }
                    .field .label { font-size: 9px; text-transform: uppercase; color: #666; }
                    .field .value { font-size: 11px; font-weight: 500; }
                    .party-box { border: 1px solid #ccc; padding: 10px; }
                    .party-name { font-weight: bold; font-size: 12px; margin-bottom: 5px; }
                    .charges-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
                    .charge-item { border: 1px solid #ddd; padding: 6px; text-align: center; }
                    .charge-item .label { font-size: 8px; text-transform: uppercase; color: #666; }
                    .charge-item .value { font-size: 11px; font-weight: 600; }
                    .total-box { text-align: right; font-size: 14px; font-weight: bold; background: #ecfdf5; padding: 10px; border: 2px solid #10b981; margin-top: 8px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th { background: #f3f4f6; border: 1px solid #ccc; padding: 4px; text-align: left; font-size: 9px; text-transform: uppercase; }
                    .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
                    .remarks-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 8px; margin-top: 8px; }
                    @media print { 
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                        .section { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <!-- HEADER -->
                <div class="header">
                    <h1>VGT Transport</h1>
                    <div class="cn-no">CN No: ${c.cn_no}</div>
                    <div>Booking Date: ${c.bkg_date} | Branch: ${c.booking_branch} | Basis: ${c.bkg_basis}</div>
                </div>

                <!-- GENERAL DETAILS -->
                <div class="section">
                    <div class="section-title">General Details</div>
                    <div class="grid">
                        <div class="field"><div class="label">Booking Branch</div><div class="value">${c.booking_branch || '---'}</div></div>
                        <div class="field"><div class="label">CN Date</div><div class="value">${c.bkg_date || '---'}</div></div>
                        <div class="field"><div class="label">Destination</div><div class="value">${c.dest_branch || '---'}</div></div>
                        <div class="field"><div class="label">Delivery Type</div><div class="value">${c.delivery_type || '---'}</div></div>
                        <div class="field"><div class="label">Packages</div><div class="value">${c.no_of_pkg} ${c.package_method}</div></div>
                        <div class="field"><div class="label">Actual Weight</div><div class="value">${c.actual_weight} KG</div></div>
                        <div class="field"><div class="label">Charged Weight</div><div class="value">${c.charged_weight} KG</div></div>
                        <div class="field"><div class="label">Distance</div><div class="value">${c.distance_km} KM</div></div>
                        <div class="field"><div class="label">Delivery Location</div><div class="value">${c.delivery_drop_location || '---'}</div></div>
                        <div class="field"><div class="label">Landmark</div><div class="value">${c.del_loc_landmark || '---'}</div></div>
                        <div class="field"><div class="label">Risk Type</div><div class="value">${c.owner_risk ? 'OWNER RISK' : 'CARRIER RISK'}</div></div>
                        <div class="field"><div class="label">Door Collection</div><div class="value">${c.door_collection ? 'YES' : 'NO'}</div></div>
                    </div>
                </div>

                <!-- CONSIGNOR / CONSIGNEE -->
                <div class="section">
                    <div class="grid-2">
                        <div class="party-box">
                            <div class="section-title" style="margin:-10px -10px 10px -10px;">Consignor</div>
                            <div class="party-name">${consignor.name || '---'}</div>
                            <div style="font-size:10px; color:#444;">${consignor.legal_name || ''}</div>
                            <div style="font-size:10px; margin:5px 0;">${consignor.address || ''}</div>
                            <div style="font-size:10px;">Code: ${consignor.code || '---'} | Unit: ${consignor.unit || '---'}</div>
                            <div style="font-size:10px;">GST: ${consignor.gst || '---'} | Trade: ${consignor.trade_name || '---'}</div>
                            <div style="font-size:10px;">Mobile: ${consignor.mobile || '---'} | Email: ${consignor.email || '---'}</div>
                        </div>
                        <div class="party-box">
                            <div class="section-title" style="margin:-10px -10px 10px -10px;">Consignee</div>
                            <div class="party-name">${consignee.name || '---'}</div>
                            <div style="font-size:10px; color:#444;">${consignee.legal_name || ''}</div>
                            <div style="font-size:10px; margin:5px 0;">${consignee.address || ''}</div>
                            <div style="font-size:10px;">Code: ${consignee.code || '---'} | Unit: ${consignee.unit || '---'}</div>
                            <div style="font-size:10px;">GST: ${consignee.gst || '---'} | Trade: ${consignee.trade_name || '---'}</div>
                            <div style="font-size:10px;">Mobile: ${consignee.mobile || '---'} | Email: ${consignee.email || '---'}</div>
                        </div>
                    </div>
                </div>

                <!-- PACKAGE DETAILS -->
                <div class="section">
                    <div class="section-title">Package Details</div>
                    <div class="grid-2">
                        <div>
                            <table>
                                <thead><tr><th>Sr.No.</th><th>Package Method</th><th>Qty</th></tr></thead>
                                <tbody>${packageRows}</tbody>
                            </table>
                            <div style="margin-top:8px; display:flex; gap:20px;">
                                <div class="field"><div class="label">Total Packages</div><div class="value">${c.package_details?.total_pkg || 0}</div></div>
                                <div class="field"><div class="label">Total Quantity</div><div class="value">${c.package_details?.total_qty || 0}</div></div>
                                <div class="field"><div class="label">Loose/Zero Pkg</div><div class="value">${c.package_details?.loose_pkg ? 'YES' : 'NO'}</div></div>
                            </div>
                        </div>
                        <div>
                            <div class="section-title" style="margin-top:0;">Goods Information</div>
                            <div class="grid-2">
                                <div class="field"><div class="label">Goods Class</div><div class="value">${c.goods_details?.goods_class || '---'}</div></div>
                                <div class="field"><div class="label">Value of Goods</div><div class="value">₹ ${c.goods_details?.value_of_goods?.toLocaleString() || 0}</div></div>
                                <div class="field"><div class="label">HSN Description</div><div class="value">${c.goods_details?.hsn_desc || '---'}</div></div>
                                <div class="field"><div class="label">COD Amount</div><div class="value">₹ ${c.goods_details?.cod_amount || 0}</div></div>
                                <div class="field"><div class="label">Dimensions (LxWxH)</div><div class="value">${c.goods_details?.dimensions ? `${c.goods_details.dimensions.l} x ${c.goods_details.dimensions.w} x ${c.goods_details.dimensions.h}` : '---'}</div></div>
                                <div class="field"><div class="label">Volume</div><div class="value">${c.goods_details?.volume || '---'}</div></div>
                            </div>
                            <div class="field"><div class="label">Goods Description</div><div class="value">${c.goods_details?.goods_desc || '---'}</div></div>
                        </div>
                    </div>
                </div>

                <!-- BILLING DETAILS -->
                <div class="section">
                    <div class="section-title">Billing Information</div>
                    <div class="grid">
                        <div class="field"><div class="label">Booking Basis</div><div class="value">${c.bkg_basis || '---'}</div></div>
                        <div class="field"><div class="label">Billing Party</div><div class="value">${billing.billing_party || '---'}</div></div>
                        <div class="field"><div class="label">Party Code</div><div class="value">${billing.party_code_unit || '---'}</div></div>
                        <div class="field"><div class="label">Party GST</div><div class="value">${billing.billing_party_gst || '---'}</div></div>
                        <div class="field"><div class="label">Sector / DCC</div><div class="value">${billing.sector_dcc || '---'}</div></div>
                        <div class="field"><div class="label">Bill Station</div><div class="value">${billing.bill_for_station || '---'}</div></div>
                        <div class="field"><div class="label">Consignee Type</div><div class="value">${billing.cnee_type || '---'}</div></div>
                    </div>
                </div>

                <!-- FREIGHT CHARGES -->
                <div class="section">
                    <div class="section-title">Freight Charges Breakdown</div>
                    <div class="charges-grid">
                        <div class="charge-item"><div class="label">Rate/KG</div><div class="value">₹ ${freight.rate_kg || 0}</div></div>
                        <div class="charge-item"><div class="label">Basic Freight</div><div class="value" style="font-weight:bold;">₹ ${freight.basic_freight || 0}</div></div>
                        <div class="charge-item"><div class="label">AOC Charges</div><div class="value">₹ ${freight.aoc_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">FOV Charges</div><div class="value">₹ ${freight.fov_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">Cover Charges</div><div class="value">₹ ${freight.cover_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">MHC Charges</div><div class="value">₹ ${freight.mhc_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">Door Coll.</div><div class="value">₹ ${freight.door_collection_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">Door Del.</div><div class="value">₹ ${freight.door_delivery_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">With Pass</div><div class="value">₹ ${freight.with_pass_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">Enroute</div><div class="value">₹ ${freight.enroute_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">Statistical</div><div class="value">₹ ${freight.statistical_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">Misc Charges</div><div class="value">₹ ${freight.misc_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">COD Charges</div><div class="value">₹ ${freight.cod_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">Toll Charges</div><div class="value">₹ ${freight.toll_charges || 0}</div></div>
                        <div class="charge-item"><div class="label">Green Tax</div><div class="value">₹ ${freight.green_tax || 0}</div></div>
                        <div class="charge-item"><div class="label">E-Way Bill</div><div class="value">₹ ${freight.eway_bill_charges || 0}</div></div>
                    </div>
                    <div class="total-box">
                        <div style="font-size:10px; color:#666; margin-bottom:4px;">${freight.amount_in_words || ''}</div>
                        Total Freight: ₹ ${freight.total_freight?.toLocaleString() || 0}
                    </div>
                </div>

                <!-- INSURANCE & PO -->
                <div class="section">
                    <div class="grid-2">
                        <div>
                            <div class="section-title">Insurance Details</div>
                            <div class="grid-2">
                                <div class="field"><div class="label">Company</div><div class="value">${c.insurance_details?.insurance_comp || '---'}</div></div>
                                <div class="field"><div class="label">Policy Amount</div><div class="value">${c.insurance_details?.policy_amount || '---'}</div></div>
                                <div class="field"><div class="label">Policy No</div><div class="value">${c.insurance_details?.policy_no || '---'}</div></div>
                                <div class="field"><div class="label">Valid Date</div><div class="value">${c.insurance_details?.policy_valid_date || '---'}</div></div>
                            </div>
                        </div>
                        <div>
                            <div class="section-title">Purchase Order</div>
                            <div class="grid-2">
                                <div class="field"><div class="label">PO No</div><div class="value">${c.insurance_details?.po_no || '---'}</div></div>
                                <div class="field"><div class="label">PO Date</div><div class="value">${c.insurance_details?.po_date || '---'}</div></div>
                                <div class="field"><div class="label">STF No</div><div class="value">${c.insurance_details?.stf_no || '---'}</div></div>
                                <div class="field"><div class="label">STF Valid Date</div><div class="value">${c.insurance_details?.stf_valid_upto || '---'}</div></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- INVOICE DETAILS -->
                <div class="section">
                    <div class="section-title">Invoice Details</div>
                    <table>
                        <thead><tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>eWay Bill</th></tr></thead>
                        <tbody>${invoiceRows}</tbody>
                    </table>
                    <div style="margin-top:8px; display:flex; gap:20px;">
                        <div class="field"><div class="label">Indent No</div><div class="value">${c.invoice_details?.indent_no || '---'}</div></div>
                        <div class="field"><div class="label">Indent Date</div><div class="value">${c.invoice_details?.indent_date || '---'}</div></div>
                        <div class="field"><div class="label">eWay From</div><div class="value">${c.invoice_details?.eway_from_date || '---'}</div></div>
                        <div class="field"><div class="label">eWay To</div><div class="value">${c.invoice_details?.eway_to_date || '---'}</div></div>
                    </div>
                </div>

                <!-- OTHER DETAILS -->
                <div class="section">
                    <div class="section-title">Other Details</div>
                    <div class="grid">
                        <div class="field"><div class="label">Type of Business</div><div class="value">${c.other_details?.type_of_business || '---'}</div></div>
                        <div class="field"><div class="label">Transport Mode</div><div class="value">${c.other_details?.transport_mode || '---'}</div></div>
                        <div class="field"><div class="label">Doc Prepared By</div><div class="value">${c.other_details?.doc_prepared_by || '---'}</div></div>
                    </div>
                </div>

                <!-- TRACKING HISTORY -->
                <div class="section">
                    <div class="section-title">Tracking History</div>
                    ${historyRows}
                </div>

                <!-- REMARKS -->
                <div class="section">
                    <div class="grid-2">
                        <div class="remarks-box">
                            <div style="font-size:9px; font-weight:bold; text-transform:uppercase; margin-bottom:4px;">Private Marks</div>
                            <div>${c.private_marks || '---'}</div>
                        </div>
                        <div style="background:#f1f5f9; border:1px solid #cbd5e1; padding:8px;">
                            <div style="font-size:9px; font-weight:bold; text-transform:uppercase; margin-bottom:4px;">Remarks</div>
                            <div>${c.remarks || '---'}</div>
                        </div>
                    </div>
                </div>

                <!-- FOOTER -->
                <div class="footer">
                    Printed on ${new Date().toLocaleString()} | System ID: VGT-${c.cn_no}
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col sm:max-w-[95vw]">
                {/* Header */}
                <DialogHeader className="bg-primary px-6 py-4 flex-shrink-0 flex flex-row items-center justify-between space-y-0 text-white">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <FileText className="h-5 w-5 opacity-80" />
                                <span className="opacity-70">CN No:</span>
                                <span className="tracking-wide">{c.cn_no}</span>
                            </DialogTitle>
                            <Badge className="bg-white/20 text-white border-white/20 hover:bg-white/30 text-[10px] uppercase tracking-wider px-2 py-0.5">
                                {c.bkg_basis}
                            </Badge>
                        </div>
                        <DialogDescription className="text-white/70 text-xs mt-1">
                            Booked on <span className="font-mono">{c.bkg_date}</span> at <span className="font-bold">{c.booking_branch}</span>
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto bg-slate-50/50">
                    <Tabs defaultValue="general" className="w-full h-full flex flex-col">
                        <div className="px-6 py-3 bg-white border-b sticky top-0 z-10 shadow-sm">
                            <TabsList className="h-9 bg-slate-100 p-1 w-auto inline-flex">
                                <TabsTrigger value="general" className="text-xs px-4 h-7 data-[state=active]:bg-primary data-[state=active]:text-white">General</TabsTrigger>
                                <TabsTrigger value="goods" className="text-xs px-4 h-7 data-[state=active]:bg-primary data-[state=active]:text-white">Package & Goods</TabsTrigger>
                                <TabsTrigger value="financials" className="text-xs px-4 h-7 data-[state=active]:bg-primary data-[state=active]:text-white">Financials</TabsTrigger>
                                <TabsTrigger value="docs" className="text-xs px-4 h-7 data-[state=active]:bg-primary data-[state=active]:text-white">Docs & Insurance</TabsTrigger>
                                <TabsTrigger value="history" className="text-xs px-4 h-7 data-[state=active]:bg-primary data-[state=active]:text-white">History</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="p-6">
                            <TabsContent value="general" className="mt-0 space-y-6">
                                {/* General Section */}
                                <Card>
                                    <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                            <Info className="h-3.5 w-3.5" /> General Details
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <InfoItem label="Booking Branch" value={c.booking_branch} />
                                        <InfoItem label="CN Date" value={c.bkg_date} />
                                        <InfoItem label="Destination" value={c.dest_branch} />
                                        <InfoItem label="Delivery Type" value={c.delivery_type} />
                                        <InfoItem label="Packages" value={`${c.no_of_pkg} ${c.package_method}`} />
                                        <InfoItem label="Actual Weight" value={`${c.actual_weight} KG`} />
                                        <InfoItem label="Charged Weight" value={`${c.charged_weight} KG`} />
                                        <InfoItem label="Distance" value={`${c.distance_km} KM`} />
                                        <InfoItem label="Delivery Location" value={c.delivery_drop_location} />
                                        <InfoItem label="Landmark" value={c.del_loc_landmark} />
                                        <InfoItem label="Risk Type" value={c.owner_risk ? "OWNER RISK" : "CARRIER RISK"} />
                                        <InfoItem label="Door Collection" value={c.door_collection ? "YES" : "NO"} />
                                    </CardContent>
                                </Card>

                                {/* Entities Grid */}
                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Consignor */}
                                    <Card>
                                        <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                            <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                <User className="h-3.5 w-3.5" /> Consignor Details
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-3">
                                            <div>
                                                <div className="text-sm font-bold">{consignor.name}</div>
                                                <div className="text-xs text-muted-foreground">{consignor.legal_name}</div>
                                            </div>
                                            <Separator />
                                            <div className="grid grid-cols-2 gap-3">
                                                <InfoItem label="Code / Unit" value={`${consignor.code} / ${consignor.unit}`} />
                                                <InfoItem label="GST (Trade)" value={consignor.gst} sub={consignor.trade_name} />
                                                <InfoItem label="Mobile" value={consignor.mobile} />
                                                <InfoItem label="Email" value={consignor.email} />
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 border border-slate-100">
                                                {consignor.address}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Consignee */}
                                    <Card>
                                        <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                            <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                <User className="h-3.5 w-3.5" /> Consignee Details
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-3">
                                            <div>
                                                <div className="text-sm font-bold">{consignee.name}</div>
                                                <div className="text-xs text-muted-foreground">{consignee.legal_name}</div>
                                            </div>
                                            <Separator />
                                            <div className="grid grid-cols-2 gap-3">
                                                <InfoItem label="Code / Unit" value={`${consignee.code} / ${consignee.unit}`} />
                                                <InfoItem label="GST (Trade)" value={consignee.gst} sub={consignee.trade_name} />
                                                <InfoItem label="Mobile" value={consignee.mobile} />
                                                <InfoItem label="Email" value={consignee.email} />
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 border border-slate-100">
                                                {consignee.address}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            <TabsContent value="goods" className="mt-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card className="h-full">
                                        <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                            <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                <Package className="h-3.5 w-3.5" /> Package Details
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex items-center justify-between bg-yellow-50 p-2 rounded border border-yellow-100">
                                                <span className="text-xs font-bold text-yellow-800 uppercase">Loose / Zero Pkg</span>
                                                <Badge variant={c.package_details?.loose_pkg ? "default" : "outline"} className="bg-white text-yellow-800 border-yellow-200">
                                                    {c.package_details?.loose_pkg ? "YES" : "NO"}
                                                </Badge>
                                            </div>

                                            <div className="border rounded-md overflow-hidden">
                                                <div className="grid grid-cols-12 bg-slate-100 p-2 text-[10px] font-bold text-muted-foreground uppercase border-b">
                                                    <div className="col-span-2 text-center">Sr.No.</div>
                                                    <div className="col-span-8 px-2">Package Method</div>
                                                    <div className="col-span-2 text-center">Qty</div>
                                                </div>
                                                {c.package_details?.packages?.length > 0 ? (
                                                    c.package_details.packages.map((pkg: any) => (
                                                        <div key={pkg.sr_no} className="grid grid-cols-12 p-2 text-xs border-b last:border-0 hover:bg-slate-50">
                                                            <div className="col-span-2 text-center text-muted-foreground">{pkg.sr_no}</div>
                                                            <div className="col-span-8 px-2 font-medium">{pkg.method}</div>
                                                            <div className="col-span-2 text-center font-bold">{pkg.qty}</div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-4 text-center text-xs text-muted-foreground italic">No packages listed</div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <InfoItem label="Total Packages" value={c.package_details?.total_pkg} />
                                                <InfoItem label="Total Quantity" value={c.package_details?.total_qty} />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="h-full">
                                        <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                            <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                <Package className="h-3.5 w-3.5" /> Goods Information
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <InfoItem label="Goods Class" value={c.goods_details?.goods_class} />
                                                <InfoItem label="Value of Goods" value={`₹ ${c.goods_details?.value_of_goods?.toLocaleString()}`} />
                                            </div>
                                            <InfoItem label="Goods Description" value={c.goods_details?.goods_desc} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <InfoItem label="HSN Description" value={c.goods_details?.hsn_desc} />
                                                <InfoItem label="COD Amount" value={`₹ ${c.goods_details?.cod_amount}`} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <InfoItem label="Dimensions (LxWxH)" value={c.goods_details?.dimensions ? `${c.goods_details.dimensions.l} x ${c.goods_details.dimensions.w} x ${c.goods_details.dimensions.h}` : '---'} />
                                                <InfoItem label="Volume" value={c.goods_details?.volume} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <InfoItem label="Odd Package" value={c.goods_details?.odd_package} />
                                                <InfoItem label="Single Piece" value={c.goods_details?.single_piece} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            <TabsContent value="financials" className="mt-0 space-y-6">
                                {/* Billing Details */}
                                <Card>
                                    <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                            <Calculator className="h-3.5 w-3.5" /> Billing Information
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <InfoItem label="Booking Basis" value={c.bkg_basis} />
                                        <InfoItem label="Billing Party" value={billing.billing_party} />
                                        <InfoItem label="Party Code" value={billing.party_code_unit} />
                                        <InfoItem label="Party GST" value={billing.billing_party_gst} />
                                        <InfoItem label="Sector / DCC" value={billing.sector_dcc} />
                                        <InfoItem label="Bill Station" value={billing.bill_for_station} />
                                        <InfoItem label="Consignee Type" value={billing.cnee_type} />
                                    </CardContent>
                                </Card>

                                {/* Freight Breakdown */}
                                <Card className="border-emerald-100/50 ring-1 ring-emerald-50">
                                    <CardHeader className="py-3 px-4 bg-emerald-50/30 border-b border-emerald-50">
                                        <CardTitle className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-2">
                                            <Calculator className="h-3.5 w-3.5" /> Freight Charges Breakdown
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y border-b">
                                            <ChargeItem label="Rate / KG" value={freight.rate_kg} />
                                            <ChargeItem label="Basic Freight" value={freight.basic_freight} bold />
                                            <ChargeItem label="AOC Charges" value={freight.aoc_charges} />
                                            <ChargeItem label="FOV Charges" value={freight.fov_charges} />
                                            <ChargeItem label="Cover Charges" value={freight.cover_charges} />
                                            <ChargeItem label="MHC Charges" value={freight.mhc_charges} />
                                            <ChargeItem label="Door Coll." value={freight.door_collection_charges} />
                                            <ChargeItem label="Door Del." value={freight.door_delivery_charges} />
                                            <ChargeItem label="With Pass" value={freight.with_pass_charges} />
                                            <ChargeItem label="Enroute" value={freight.enroute_charges} />
                                            <ChargeItem label="Statistical" value={freight.statistical_charges} />
                                            <ChargeItem label="Misc Charges" value={freight.misc_charges} />
                                            <ChargeItem label="COD Charges" value={freight.cod_charges} />
                                            <ChargeItem label="Toll Charges" value={freight.toll_charges} />
                                            <ChargeItem label="Green Tax" value={freight.green_tax} />
                                            <ChargeItem label="E-Way Bill" value={freight.eway_bill_charges} />
                                        </div>
                                        <div className="p-4 bg-emerald-50/20 flex flex-col md:flex-row justify-between items-center gap-4">
                                            <div className="text-xs text-muted-foreground font-medium italic">
                                                {freight.amount_in_words}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Total Freight</div>
                                                    <div className="text-2xl font-black text-emerald-700">₹ {freight.total_freight?.toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="docs" className="mt-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Insurance & PO */}
                                    <Card className="h-full">
                                        <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                            <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                <Truck className="h-3.5 w-3.5" /> Insurance & PO
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-4">
                                            <div>
                                                <h4 className="text-[10px] font-bold text-primary uppercase mb-2">Insurance</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <InfoItem label="Company" value={c.insurance_details?.insurance_comp} />
                                                    <InfoItem label="Policy Amount" value={c.insurance_details?.policy_amount} />
                                                    <InfoItem label="Policy No" value={c.insurance_details?.policy_no} />
                                                    <InfoItem label="Valid Date" value={c.insurance_details?.policy_valid_date} />
                                                </div>
                                            </div>
                                            <Separator />
                                            <div>
                                                <h4 className="text-[10px] font-bold text-primary uppercase mb-2">Purchase Order</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <InfoItem label="PO No" value={c.insurance_details?.po_no} />
                                                    <InfoItem label="PO Date" value={c.insurance_details?.po_date} />
                                                    <InfoItem label="STF No" value={c.insurance_details?.stf_no} />
                                                    <InfoItem label="STF Valid Date" value={c.insurance_details?.stf_valid_upto} />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Other Details */}
                                    <Card className="h-full">
                                        <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                            <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                <FileText className="h-3.5 w-3.5" /> Other Details
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <InfoItem label="Type of Business" value={c.other_details?.type_of_business} />
                                                <InfoItem label="Transport Mode" value={c.other_details?.transport_mode} />
                                            </div>
                                            <InfoItem label="Doc Prepared By" value={c.other_details?.doc_prepared_by} />
                                            <Separator />
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-bold text-muted-foreground uppercase">eWay Bill Dates</div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <InfoItem label="From" value={c.invoice_details?.eway_from_date} />
                                                    <InfoItem label="To" value={c.invoice_details?.eway_to_date} />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Invoice Table */}
                                <Card>
                                    <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                            <Hash className="h-3.5 w-3.5" /> Invoice Details
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="grid grid-cols-4 bg-slate-100 p-3 text-[10px] font-bold text-muted-foreground uppercase border-b">
                                            <div>Invoice No</div>
                                            <div>Date</div>
                                            <div>Amount</div>
                                            <div>eWay Bill</div>
                                        </div>
                                        {c.invoice_details?.invoices?.length > 0 ? (
                                            c.invoice_details.invoices.map((inv: any, i: number) => (
                                                <div key={i} className="grid grid-cols-4 p-3 text-xs border-b last:border-0 hover:bg-slate-50">
                                                    <div className="font-medium">{inv.invoice_no}</div>
                                                    <div>{inv.date}</div>
                                                    <div className="font-mono">₹ {inv.amount?.toLocaleString()}</div>
                                                    <div className="text-muted-foreground">{inv.eway_bill}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-xs text-muted-foreground italic">No invoices listed</div>
                                        )}
                                        <div className="p-3 bg-slate-50 border-t flex gap-8">
                                            <InfoItem label="Indent No" value={c.invoice_details?.indent_no} />
                                            <InfoItem label="Indent Date" value={c.invoice_details?.indent_date} />
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="history" className="mt-0 space-y-6">
                                <Card>
                                    <CardContent className="p-6">
                                        {history.length > 0 ? (
                                            <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
                                                {history.map((event: any, index: number) => (
                                                    <div key={index} className="relative pl-8">
                                                        <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-primary border-4 border-white shadow-sm ring-1 ring-slate-200" />
                                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1 mb-1">
                                                            <span className="text-sm font-bold text-foreground">{event.status}</span>
                                                            <span className="text-xs font-mono text-muted-foreground">{event.date}</span>
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">{event.description}</div>
                                                        <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                            <MapPin className="h-3 w-3" /> {event.location}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center text-muted-foreground text-sm py-8">No History</div>
                                        )}
                                    </CardContent>
                                </Card>

                                <div className="grid grid-cols-2 gap-4">
                                    <Card className="bg-yellow-50/50 border-yellow-100">
                                        <CardHeader className="py-2 px-4 border-b border-yellow-100">
                                            <CardTitle className="text-xs font-bold text-yellow-800 uppercase">Private Marks</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 text-sm font-medium text-yellow-900">
                                            {c.private_marks}
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-slate-50 border-slate-100">
                                        <CardHeader className="py-2 px-4 border-b border-slate-100">
                                            <CardTitle className="text-xs font-bold text-slate-700 uppercase">Remarks</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 text-sm text-slate-600 italic">
                                            {c.remarks}
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                <div className="bg-white border-t p-3 flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-20">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                        <Info className="h-3 w-3 text-primary" /> System ID: <span className="text-foreground">VGT-{c.cn_no}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={handlePrint} className="gap-2">
                            <Printer className="h-4 w-4" />
                            Print
                        </Button>
                        <Button size="sm" onClick={onClose} className="bg-slate-900 text-white hover:bg-slate-800">Close</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function InfoItem({ label, value, sub }: { label: string, value: any, sub?: string }) {
    return (
        <div className="space-y-0.5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">{label}</Label>
            <div className="text-sm font-semibold text-foreground truncate" title={String(value)}>{value || '---'}</div>
            {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
        </div>
    );
}

function ChargeItem({ label, value, bold }: { label: string, value: any, bold?: boolean }) {
    return (
        <div className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
            <div className={`text-sm font-mono ${bold ? 'font-black text-foreground' : 'font-medium text-slate-700'}`}>
                {value !== undefined ? `₹ ${Number(value).toFixed(2)}` : '---'}
            </div>
        </div>
    );
}
