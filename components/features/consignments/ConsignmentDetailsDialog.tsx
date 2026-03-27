'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
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
    Printer,
    Pencil
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
    isAdmin?: boolean;
}

type CopyType = 'consigner' | 'consignee' | 'lorry' | 'office';

const COPY_CONFIG: Record<CopyType, { label: string; paperTint: string }> = {
    consigner: { label: 'CONSIGNER COPY', paperTint: '#ffffff' },
    consignee: { label: 'CONSIGNEE COPY', paperTint: '#ffd9df' },
    lorry: { label: 'LORRY COPY', paperTint: '#fff6a6' },
    office: { label: 'OFFICE COPY', paperTint: '#cdefff' },
};

const BRANCH_MAP: Record<string, string> = {
    'MRG': 'MRG - VERNA GOA',
    'PNJ': 'PNJ - PANAJI',
    'PTLG': 'PTLG - PATALGANGA',
    'NSK': 'NSK - NASHIK',
    'JGN': 'JGN - JALGAON',
    'TPR': 'TPR - TIRUPUR',
};

const getFullBranchName = (code?: string) => {
    if (!code) return '---';
    const upperCode = code.toUpperCase();
    return BRANCH_MAP[upperCode] || upperCode;
};

export function ConsignmentDetailsDialog({ isOpen, onClose, consignment, isAdmin = false }: ConsignmentDetailsDialogProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [copyType, setCopyType] = React.useState<CopyType>('consignee');
    const [issuingOfficerName, setIssuingOfficerName] = React.useState('---');
    const [logoBase64, setLogoBase64] = React.useState<string | null>(null);

    React.useEffect(() => {
        let isMounted = true;

        const loadCurrentUser = async () => {
            try {
                const response = await fetch('/api/auth/me');
                if (!response.ok) return;
                const result = await response.json();
                const fullName = result?.data?.full_name;
                if (isMounted && fullName) {
                    setIssuingOfficerName(fullName);
                }
            } catch (error) {
                console.error('Failed to load issuing officer name:', error);
            }
        };

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

        loadCurrentUser();
        loadLogo();

        return () => {
            isMounted = false;
        };
    }, []);

    if (!consignment) return null;

    // Helper to safely access data (DB is flat, JSON was nested)
    const c = consignment;
    const consignor = {
        name: c.consignor_name || c.consignor?.name || '---',
        legal_name: c.consignor_name || c.consignor?.legal_name || '---',
        trade_name: c.consignor_name || c.consignor?.trade_name || '---',
        code: c.consignor_code || c.consignor?.code || '---',
        unit: c.consignor_unit || c.consignor?.unit || '---',
        address: c.consignor_address || c.consignor?.address || '---',
        pincode: c.consignor_pincode || c.consignor?.pincode || '',
        gst: c.consignor_gst || c.consignor?.gst || '---',
        mobile: c.consignor_mobile || c.consignor?.mobile || '---',
        email: c.consignor_email || c.consignor?.email || '---',
    };
    const consignee = {
        name: c.consignee_name || c.consignee?.name || '---',
        legal_name: c.consignee_name || c.consignee?.legal_name || '---',
        trade_name: c.consignee_name || c.consignee?.trade_name || '---',
        code: c.consignee_code || c.consignee?.code || '---',
        unit: c.consignee_unit || c.consignee?.unit || '---',
        address: c.consignee_address || c.consignee?.address || '---',
        pincode: c.consignee_pincode || c.consignee?.pincode || '',
        gst: c.consignee_gst || c.consignee?.gst || '---',
        mobile: c.consignee_mobile || c.consignee?.mobile || '---',
        email: c.consignee_email || c.consignee?.email || '---',
        state: c.consignee_state || c.consignee?.state || '',
    };
    const billing = {
        billing_party: c.billing_party || c.billing_details?.billing_party || '---',
        billing_party_gst: c.billing_party_gst || c.billing_details?.billing_party_gst || '---',
        address: c.billing_party_address || c.billing_details?.address || '---',
        party_code_unit: c.billing_party_code || c.billing_details?.party_code_unit || '---',
        sector_dcc: c.billing_sector || c.billing_details?.sector_dcc || '---',
        bill_for_station: c.billing_branch || c.billing_details?.bill_for_station || '---',
        cnee_type: c.consignee_type || c.billing_details?.cnee_type || '---',
    };
    const freight = {
        rate_kg: c.freight_rate || c.freight_details?.rate_kg || 0,
        basic_freight: c.basic_freight || c.freight_details?.basic_freight || 0,
        door_del_charges: c.door_del_charges || c.freight_details?.door_delivery_charges || 0,
        door_coll_charges: c.door_coll_charges || c.freight_details?.door_collection_charges || 0,
        statistical_charges: c.statistical_charges || c.freight_details?.statistical_charges || 0,
        misc_charges: c.other_charges || c.freight_details?.misc_charges || 0,
        aoc_charges: c.aoc_charges || c.freight_details?.aoc_charges || 0,
        fov_charges: c.fov_charges || c.freight_details?.fov_charges || 0,
        cover_charges: c.cover_charges || c.freight_details?.cover_charges || 0,
        mhc_charges: c.mhc_charges || c.freight_details?.mhc_charges || 0,
        with_pass_charges: c.with_pass_charges || c.freight_details?.with_pass_charges || 0,
        enroute_charges: c.enroute_charges || c.freight_details?.enroute_charges || 0,
        cod_charges: c.cod_charges || c.freight_details?.cod_charges || 0,
        toll_charges: c.toll_charges || c.freight_details?.toll_charges || 0,
        green_tax: c.green_tax || c.freight_details?.green_tax || 0,
        eway_bill_charges: c.eway_bill_charges || c.freight_details?.eway_bill_charges || 0,
        total_freight: c.total_freight || c.freight_details?.total_freight || 0,
        advance: c.advance_amount || c.freight_details?.advance || 0,
        balance: c.balance_amount || c.freight_details?.balance || 0,
        amount_in_words: c.amount_in_words || c.freight_details?.amount_in_words || '',
    };
    const history = c.tracking_history || [];

    // Print/Download handler
    const handlePrint = async (type: CopyType, mode: 'print' | 'download' = 'print') => {
        const config = COPY_CONFIG[type];
        const formatDate = (dateValue: string | null | undefined) => {
            if (!dateValue) return '---';
            const parsed = new Date(dateValue);
            if (Number.isNaN(parsed.getTime())) return dateValue;
            const day = String(parsed.getDate()).padStart(2, '0');
            const month = String(parsed.getMonth() + 1).padStart(2, '0');
            const year = String(parsed.getFullYear()).slice(-2);
            return `${day}/${month}/${year}`;
        };

        const toUpperValue = (value: unknown) => {
            const normalized = String(value ?? '').trim();
            return normalized ? normalized.toUpperCase() : '---';
        };

        const invoiceNo = c.invoice_no || c.invoice_details?.invoices?.[0]?.invoice_no || '---';
        const invoiceDate = formatDate(c.invoice_date || c.invoice_details?.invoices?.[0]?.date);
        const ewayNo = c.eway_bill || c.invoice_details?.invoices?.[0]?.eway_bill || '---';
        const ewayValidUpto = formatDate(c.eway_to_date || c.invoice_details?.eway_to_date);
        const cnDate = formatDate(c.bkg_date);
        const goodsValue = Number(c.goods_value || c.goods_details?.value_of_goods || 0);
        const actualWeight = c.actual_weight || c.goods_details?.actual_weight || '---';
        const chargedWeight = c.charged_weight || c.goods_details?.charged_weight || '---';

        let packageText = c.is_loose ? 'LOOSE' : (c.no_of_pkg || c.package_details?.total_pkg || '---');
        let packageDetailsStr = '';
        if (Array.isArray(c.packages) && c.packages.length > 0) {
            packageDetailsStr = c.packages.map((p: any) => {
                const method = String(p.method || '').charAt(0).toUpperCase() + String(p.method || '').slice(1).toLowerCase();
                return `${method} (Qty: ${p.qty || 0})`;
            }).join('<br/>');
        } else if (c.package_details?.packages && Array.isArray(c.package_details.packages) && c.package_details.packages.length > 0) {
            packageDetailsStr = c.package_details.packages.map((p: any) => {
                const method = String(p.method || '').charAt(0).toUpperCase() + String(p.method || '').slice(1).toLowerCase();
                return `${method} (Qty: ${p.qty || 0})`;
            }).join('<br/>');
        }
        const packagesList = packageDetailsStr || packageText;

        const goodsDescription = c.hsn_desc || c.goods_details?.hsn_desc || '---';
        const invoiceDescription = c.goods_desc || c.goods_details?.goods_desc || '';
        const topayLabel = c.bkg_basis || 'TOPAY';
        const totalFreight = Number(freight.total_freight || c.total_freight || 0);
        const truckNo = c.vehicle_no || c.truck_no || '---';
        const issuingOffice = getFullBranchName(c.booking_branch || c.bkg_branch);
        const officerName = toUpperValue(issuingOfficerName);
        const logoUrl = logoBase64 || `${window.location.origin}/vgt_logo.png`;
        const consignorName = toUpperValue(consignor.name);
        const consignorAddress = toUpperValue(`${consignor.address}${consignor.pincode ? ', ' + consignor.pincode : ''}`);
        const consigneeName = toUpperValue(consignee.name);
        const consigneeAddress = toUpperValue(`${consignee.address}${consignee.pincode ? ', ' + consignee.pincode : ''}`);
        const consigneeLocation = toUpperValue(`${toUpperValue(c.delivery_point || getFullBranchName(c.dest_branch))} ${consignee.state || ''}`.trim());

        const html = `<!DOCTYPE html>
<html>
<head>
<title>${config.label} - ${c.cn_no}</title>
<style>
@page { size: A4 landscape; margin: 4mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: "Times New Roman", Georgia, serif; font-size: 11px; color: #111; }
.page { border: 2px solid #1d2f7a; background: ${config.paperTint}; width: 279mm; min-height: 194mm; margin: 0 auto; padding-right: 2.5mm; padding-bottom: 8mm; }
.row { display: flex; width: 100%; }
.box { border: 1px solid #1d2f7a; border-radius: 6px; padding: 4px 6px; }
.tiny { font-size: 11px; line-height: 1.25; }
.mini { font-size: 10px; line-height: 1.2; }
.lbl { font-size: 11px; font-weight: 700; color: #1d2f7a; }
.strong { font-weight: 700; }
.head-blue { color: #17308b; font-weight: 800; }
.lr-red { color: #cc1a1a; font-weight: 900; font-size: 44px; letter-spacing: 1px; }
.line { border-bottom: 1px solid #1d2f7a; min-height: 24px; display: flex; align-items: center; }
.hdr { border-bottom: 2px solid #1d2f7a; padding: 8px 10px 28px; }
.logo-box { width: 90px; height: 60px; display:flex; align-items:center; justify-content:center; background:transparent; }
.logo-box img { width: 100%; height: 100%; object-fit: contain; display:block; }
.top-grid { display: grid; grid-template-columns: 1.22fr 1.1fr 1.02fr 0.72fr; gap: 6px; padding: 6px; border-bottom: 1px solid #1d2f7a; }
.mid-grid { display:grid; grid-template-columns: 1.8fr 0.58fr 0.82fr; gap: 6px; padding: 6px; border-bottom:1px solid #1d2f7a; }
.right-stack > div { border-bottom: 1px solid #1d2f7a; padding: 4px 5px; min-height: 28px; }
.right-stack > div:last-child { border-bottom: none; }
.main-table { width:100%; border-collapse: collapse; }
.main-table th, .main-table td { border:1px solid #1d2f7a; padding: 4px 6px; vertical-align: top; }
.main-table th { background: rgba(255,255,255,0.65); color:#122d7a; font-size: 12px; }
.main-table th:last-child, .main-table td:last-child { border-right: 1px solid #1d2f7a !important; }
.charges-list { font-size: 12px; line-height: 1.4; }
.footer { display:flex; justify-content:space-between; padding:10px 12px; align-items:flex-end; }
.copy-title { text-align:center; font-size: 24px; font-weight: 800; color:#163082; letter-spacing: 1px; border-bottom: 1px solid #1d2f7a; padding: 0 0 6px; margin: -4px -6px 6px; }
.address-wrap { padding-top: 2px; }
.address-line { border-bottom: 1px solid #1d2f7a; min-height: 40px; padding: 5px 8px 10px; display:flex; align-items:flex-end; flex-wrap:wrap; line-height: 1.12; overflow: visible; }
.address-line.tall { min-height: 50px; padding-top: 7px; padding-bottom: 12px; align-items:center; }
.address-label { font-size: 13px; color: #1d2f7a; margin-right: 8px; flex: 0 0 auto; }
.address-value { font-size: 21px; font-weight: 700; letter-spacing: 0.2px; white-space: normal; word-break: break-word; flex: 1; color: #132b94; }
.address-value.small { font-size: 17px; color: #132b94; }
.route-box .line { min-height: 54px; padding: 6px; font-size: 18px; font-weight: 700; align-items: center; }
.consignment-note-box { padding: 0; overflow: hidden; }
.consignment-note-box .note-head { text-align:center; font-size: 15px; font-weight: 700; color:#17308b; padding: 4px 0; border-bottom: 1px solid #1d2f7a; }
.consignment-note-box .note-row { display:flex; align-items:flex-end; gap:8px; padding: 8px 8px 4px; min-height: 58px; }
.consignment-note-box .note-date { border-top: 1px dotted #1d2f7a; margin: 4px 8px 8px; padding-top: 6px; font-size: 16px; }
.top-label { font-size: 10px; color:#1d2f7a; }
.subhead-cell { text-align:center; font-size: 11px; padding-bottom:10px; }
.amount-box { text-align:center; }
.amount-total { margin-top: 18px; font-weight: 700; }
.top-grid .right-stack .lbl { font-size: 8.5px; line-height: 1.05; }
.top-grid .right-stack .strong { font-size: 9.5px; line-height: 1.1; }
.ink { font-family: Arial, Helvetica, sans-serif; color: #132b94; font-weight: 700; letter-spacing: 0.2px; }
</style>
</head>
<body>
<div class="page">
    <div class="hdr">
        <div class="row" style="gap:10px; align-items:center;">
            <div class="logo-box"><img src="${logoUrl}" alt="VGT Logo" /></div>
            <div style="flex:1; text-align:center;">
                <div class="head-blue" style="font-size:64px; line-height:1; margin-bottom:20px;">Visakha Golden Transport</div>
                <div class="strong" style="font-size:18px; margin-bottom:6px;">D.No. 8-19-58/A, Gopal Nagar, Near Bank Colony, Vizianagaram-535003 (A.P.)</div>
                <div style="font-size:16px;">Cell : 9701523640, Website : https://visakhagolden.com, Email : support@visakhagolden.com</div>
            </div>
        </div>
    </div>

    <div class="top-grid">
        <div>
            <div class="box tiny" style="margin-bottom:6px;">
                <div class="lbl">SCHEDULE OF DEMURRAGE CHARGES</div>
                <div>Demurrage chargeable after .......... days from today @ Rs. .......... per day per Qtl / on weight charged.</div>
            </div>
            <div class="box tiny">
                <div class="lbl">NOTICE</div>
                <div>The consignment covered by this Lorry Receipt shall be stored at destination under the control of transporter. Delivery only on consignee bank instruction.</div>
            </div>
        </div>

        <div>
            <div class="box tiny" style="margin-bottom:6px;">
                <div class="copy-title">${config.label}</div>
                <div class="lbl" style="text-align:center; font-size:19px;">AT/CARRIER'S RISK/OWNER'S RISK</div>
                <div class="lbl" style="text-align:center; font-size:22px;">INSURANCE</div>
                <div class="line" style="padding:0 6px;">The consignor has stated that he has not insured the consignment</div>
                <div class="line" style="padding:0 6px;">OR he has insured the consignment</div>
                <div class="line" style="padding:0 6px;">Company ..................... Policy No ............. Date .............</div>
                <div>Amount ..................... Risk .............</div>
            </div>
        </div>

        <div>
            <div class="box tiny" style="margin-bottom:6px;">
                <div class="lbl" style="text-align:center;">CAUTION</div>
                <div>The consignment will not be detained/diverted/re-routed without Consignee Bank's written permission.</div>
                <div class="line">Address of Delivery office :</div>
                <div class="line">&nbsp;</div>
                <div class="line">&nbsp;</div>
            </div>

            <div class="box tiny consignment-note-box">
                <div class="note-head">CONSIGNMENT NOTE</div>
                <div class="note-row">
                    <span class="strong" style="font-size:16px;">No.</span>
                    <span class="lr-red">${c.cn_no || '---'}</span>
                </div>
                <div class="note-date"><span class="strong">Date</span>&nbsp;&nbsp;<span class="ink" style="font-size:18px;">${cnDate}</span></div>
            </div>
        </div>

        <div class="box right-stack tiny">
            <div style="font-size:16px;"><span class="lbl" style="font-size:15px;">PAN NO : </span><span class="strong" style="font-size:15px;" >AAWFV7670H</span></div>
            <div style="font-size:16px;"><span class="lbl" style="font-size:15px;">GSTIN : </span><span class="strong" style="font-size:15px;">37AAWFV7670H1Z8</span></div>
            <div style="font-size:15px;"><span class="lbl" style="font-size:15px;">E-Way Bill No. : </span><span class="strong" style="font-size:15px;">${ewayNo}</span><br/><span class="lbl" style="font-size:13px;">valid upto : </span><span class="strong">${ewayValidUpto}</span></div>
            <div style="font-size:15px;"><span class="lbl" style="font-size:15px;">HSN Desc : </span><span class="strong ink" style="font-size:15px;">${toUpperValue(goodsDescription)}</span></div>

        </div>
    </div>

    <div class="mid-grid">
        <div class="address-wrap">
            <div class="address-line">
                <span class="address-label">Consignor's Name & Address</span>
                <span class="address-value ink">${consignorName}</span>
            </div>
            <div class="address-line tall">
                <span class="address-value small ink">${consignorAddress}</span>
            </div>
            <div class="address-line">
                <span class="address-label">Consignee's Name & Address</span>
                <span class="address-value ink">${consigneeName}</span>
            </div>
            <div class="address-line tall">
                <span class="address-value small ink">${consigneeAddress}</span>
            </div>
            <div class="address-line" style="justify-content:center;">
                <span class="address-value small ink" style="text-align:center;">${consigneeLocation}</span>
            </div>
        </div>

        <div class="box tiny route-box">
            <div class="lbl">From</div>
            <div class="line ink">${toUpperValue(getFullBranchName(c.booking_branch || c.bkg_branch))}</div>
            <div class="lbl">To</div>
            <div class="line ink">${toUpperValue(c.delivery_point || getFullBranchName(c.dest_branch))}</div>
        </div>

        <div class="box right-stack tiny">
            <div><span class="lbl">Address of issuing office or name and address of agenta</span><br/><span class="strong ink">${toUpperValue(issuingOffice)}</span></div>
            <div><span class="lbl">GST No. of Consignor</span><br/><span class="strong ink" style="font-size:18px;">${toUpperValue(consignor.gst || '---')}</span></div>
            <div><span class="lbl">GST No. of Consignee</span><br/><span class="strong ink" style="font-size:18px;">${toUpperValue(consignee.gst || '---')}</span></div>
            <div><span class="lbl">GST payable by</span><br/><span class="strong">Consignor / Consignee</span></div>
        </div>
    </div>

    <table class="main-table">
        <thead>
            <tr>
                <th rowspan="2" style="width:11%;">Packages</th>
                <th rowspan="2" style="width:36%;">Description (Said to Contain)</th>
                <th colspan="2" style="width:16%;">Weight</th>
                <th rowspan="2" style="width:12%;">Rate</th>
                <th colspan="2" style="width:25%;">Amount to pay / paid</th>
            </tr>
            <tr>
                <th class="subhead-cell">Actual</th>
                <th class="subhead-cell">Charged</th>
                <th class="subhead-cell">Rs.</th>
                <th class="subhead-cell">P</th>
            </tr>
        </thead>
        <tbody>
            <tr style="height:162px;">
                <td class="strong ink" style="font-size:16px; text-align:center; padding-top: 15px;">${packagesList}</td>
                <td>
                    ${invoiceDescription ? `<div class="strong ink" style="font-size:20px; line-height:1.15; margin-bottom:8px;">${toUpperValue(invoiceDescription)}</div>` : ''}
                    <div style="margin-top:${invoiceDescription ? '8px' : '42px'}; font-size:16px;">Invoice No. <span class="strong ink">${invoiceNo}</span></div>
                    <div style="margin-top:8px; font-size:16px;">Invoice Date . <span class="strong ink">${invoiceDate}</span></div>
                </td>
                <td class="strong ink" style="text-align:center; font-size:23px;">${toUpperValue(actualWeight)}MT</td>
                <td class="strong ink" style="text-align:center; font-size:23px;">${toUpperValue(chargedWeight)}MT</td>
                <td class="charges-list">
                    <span style="font-size:16px;">Basic Freight</span><br/>
                    ${Number(c.unload_charges||0) > 0 ? `<span style="font-size:16px;">Unloading Ch.</span><br/>` : ''}
                    ${Number(c.retention_charges||0) > 0 ? `<span style="font-size:16px;">Detention Ch.</span><br/>` : ''}
                    ${Number(c.extra_km_charges||0) > 0 ? `<span style="font-size:16px;">Extra KM Ch.</span><br/>` : ''}
                    ${Number(c.mhc_charges||0) > 0 ? `<span style="font-size:16px;">Loading Ch.</span><br/>` : ''}
                    ${Number(c.door_coll_charges||0) > 0 ? `<span style="font-size:16px;">Door Coll. Ch.</span><br/>` : ''}
                    ${Number(c.door_del_charges||0) > 0 ? `<span style="font-size:16px;">Door Del. Ch.</span><br/>` : ''}
                    ${Number(c.other_charges||0) > 0 ? `<span style="font-size:16px;">Other Ch. ${topayLabel}</span><br/>` : ''}
                    <br/><span class="strong" style="font-size:16px;">TOTAL</span>
                </td>
                <td class="charges-list amount-box ink">
                    <span style="font-size:16px;">Rs. ${Number(c.basic_freight || 0).toFixed(2)}</span><br/>
                    ${Number(c.unload_charges||0) > 0 ? `<span style="font-size:16px;">Rs. ${Number(c.unload_charges).toFixed(2)}</span><br/>` : ''}
                    ${Number(c.retention_charges||0) > 0 ? `<span style="font-size:16px;">Rs. ${Number(c.retention_charges).toFixed(2)}</span><br/>` : ''}
                    ${Number(c.extra_km_charges||0) > 0 ? `<span style="font-size:16px;">Rs. ${Number(c.extra_km_charges).toFixed(2)}</span><br/>` : ''}
                    ${Number(c.mhc_charges||0) > 0 ? `<span style="font-size:16px;">Rs. ${Number(c.mhc_charges).toFixed(2)}</span><br/>` : ''}
                    ${Number(c.door_coll_charges||0) > 0 ? `<span style="font-size:16px;">Rs. ${Number(c.door_coll_charges).toFixed(2)}</span><br/>` : ''}
                    ${Number(c.door_del_charges||0) > 0 ? `<span style="font-size:16px;">Rs. ${Number(c.door_del_charges).toFixed(2)}</span><br/>` : ''}
                    ${Number(c.other_charges||0) > 0 ? `<span style="font-size:16px;">Rs. ${Number(c.other_charges).toFixed(2)}</span><br/>` : ''}
                    <br/><span class="strong amount-total ink" style="font-size:16px;">Rs. ${totalFreight.toFixed(2)}</span>
                </td>
                <td class="charges-list amount-box">&nbsp;</td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        <div style="font-size:19px; font-weight:700;">Value . <span class="ink">${goodsValue.toLocaleString('en-IN')}</span></div>
        <div style="font-size:19px; font-weight:700; text-align:right; margin-left:auto;">
            <div class="ink" style="font-size:16px; margin-bottom:3px;">${officerName}</div>
            <div>Signature of the Issuing Officer .......................................</div>
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

        await Promise.all(
            Array.from(doc.images).map((image) => {
                if (image.complete) {
                    return Promise.resolve();
                }
                return new Promise<void>((resolve) => {
                    image.onload = () => resolve();
                    image.onerror = () => resolve();
                });
            })
        );

        await new Promise((resolve) => setTimeout(resolve, 400));

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
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
            compress: true,
        });

        pdf.addImage(imageData, 'PNG', 2, 2, 293, 206, undefined, 'FAST');
        const safeCopyLabel = config.label.toLowerCase().replace(/\s+/g, '-');
        const safeCn = String(c.cn_no || 'cns').replace(/[^a-zA-Z0-9-_]/g, '');
        pdf.save(`${safeCn}-${safeCopyLabel}.pdf`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col sm:max-w-[95vw]">
                {/* Hidden iframe for printing */}
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
                                        <InfoItem label="Booking Branch" value={getFullBranchName(c.booking_branch)} />
                                        <InfoItem label="CN Date" value={c.bkg_date} />
                                        <InfoItem label="Destination" value={getFullBranchName(c.dest_branch)} />
                                        <InfoItem label="Delivery Type" value={c.delivery_type} />
                                        <InfoItem label="Packages" value={`${c.no_of_pkg} ${c.package_method}`} />
                                        <InfoItem label="Actual Weight" value={`${c.actual_weight} KG`} />
                                        <InfoItem label="Charged Weight" value={`${c.charged_weight} KG`} />
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
                                            <div className="flex justify-between text-xs py-1 border-b border-dashed">
                                                <span>Door Collection</span>
                                                <span className="font-mono">₹ {(freight.door_coll_charges || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs py-1 border-b border-dashed">
                                                <span>Door Delivery</span>
                                                <span className="font-mono">₹ ${(freight.door_del_charges || 0).toFixed(2)}</span>
                                            </div>
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
                                                <InfoItem label="Value of Goods" value={`₹ ${(c.goods_details?.value_of_goods || c.goods_value || 0).toLocaleString()}`} />
                                                <InfoItem label="HSN Description" value={c.hsn_desc || c.goods_details?.hsn_desc} />
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
                                        <InfoItem label="Billing Address" value={billing.address} />
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
                                            <ChargeItem label="Door Coll." value={freight.door_coll_charges} />
                                            <ChargeItem label="Door Del." value={freight.door_del_charges} />
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
                    <div className="flex items-center gap-3">
                        {/* Copy Type Selector */}
                        <div className="flex items-center gap-2 border rounded-md px-2 py-1 bg-slate-50">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Copy:</span>
                            <select
                                value={copyType}
                                onChange={(e) => setCopyType(e.target.value as CopyType)}
                                className="text-xs font-bold border-none bg-transparent focus:outline-none cursor-pointer pr-1"
                            >
                                <option value="consigner">Consigner (White)</option>
                                <option value="consignee">Consignee (Pink)</option>
                                <option value="lorry">Lorry (Yellow)</option>
                                <option value="office">Office (Blue)</option>
                            </select>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handlePrint(copyType, 'print')} className="gap-2">
                            <Printer className="h-4 w-4" />
                            Print
                        </Button>
                        <Button size="sm" onClick={() => handlePrint(copyType, 'download')} className="gap-2">
                            <FileText className="h-4 w-4" />
                            Download PDF
                        </Button>
                        {isAdmin && c.id && (
                            <Button size="sm" variant="outline" asChild className="gap-2">
                                <Link href={`/dashboard/consignments/new?edit=${c.id}`}>
                                    <Pencil className="h-4 w-4" />
                                    Edit CNS
                                </Link>
                            </Button>
                        )}
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
