'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    Save,
    RotateCcw,
    Calculator,
    User,
    Building,
    Package,
    Truck,
    Info,
    ChevronRight,
    Plus
} from 'lucide-react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

import { PartyAutocomplete } from "@/components/PartyAutocomplete";
import { AddPartyDialog } from "@/components/AddPartyDialog";
import { Party, PartyType } from "@/lib/types/party.types";

interface PackageItem {
    id: string;
    method: string;
    qty: number;
}

// We fetch branch options dynamically now, so just a helper if we ever need it static
const getBranchLabel = (branchCode: string, options: {value: string, label: string}[]) => {
    const normalizedCode = branchCode.trim().toLowerCase();
    const match = options.find((branch) => branch.value === normalizedCode);
    return match?.label || branchCode.toUpperCase();
};

export default function NewConsignmentPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <NewConsignmentForm />
        </Suspense>
    );
}

function NewConsignmentForm() {
    const MANUAL_BILLING_CODE = 'PERSONAL DELIVERY';
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('edit');
    const isEditMode = Boolean(editId);
    const [isOwnersRisk, setIsOwnersRisk] = useState(true);
    const [isCancelCn, setIsCancelCn] = useState(false);
    const [consignor, setConsignor] = useState<Party | null>(null);
    const [consignee, setConsignee] = useState<Party | null>(null);
    const [billingParty, setBillingParty] = useState<Party | null>(null);
    const [billingBranch, setBillingBranch] = useState("");
    const [billingMode, setBillingMode] = useState<'party' | 'manual'>('party');
    const [manualBillingName, setManualBillingName] = useState("");
    const [manualBillingAddress, setManualBillingAddress] = useState("");
    const [manualBillingGst, setManualBillingGst] = useState("");
    const [manualBillingStation, setManualBillingStation] = useState("");

    // Add Party Dialog State
    const [isAddPartyDialogOpen, setIsAddPartyDialogOpen] = useState(false);
    const [pendingPartyName, setPendingPartyName] = useState("");
    const [pendingPartyType, setPendingPartyType] = useState<PartyType>('consignor');

    // Package State
    const [isLoose, setIsLoose] = useState(false);
    const [packages, setPackages] = useState<PackageItem[]>([]);
    const [currentPackageMethod, setCurrentPackageMethod] = useState("box");
    const [currentPackageQty, setCurrentPackageQty] = useState("");

    // Freight State
    const [isFreightPending, setIsFreightPending] = useState(false);
    const [freightType, setFreightType] = useState("per_tone"); // 'fixed' or 'per_tone'
    const [freightRate, setFreightRate] = useState("");
    const [basicFreight, setBasicFreight] = useState("");
    const [chargedWeight, setChargedWeight] = useState("");

    // Freight Charges
    const [charges, setCharges] = useState({
        unloading: "",
        detention: "",
        extraKm: "",
        loading: "",
        doorColl: "",
        doorDel: "",
        other: ""
    });

    // General fields state
    const [bookingBranchCode, setBookingBranchCode] = useState("");
    const [cnNo, setCnNo] = useState("");
    const [cnDate, setCnDate] = useState(new Date().toLocaleDateString('en-GB'));
    const [deliveryType, setDeliveryType] = useState("");
    const [isDoorCollection, setIsDoorCollection] = useState(false);
    const [bkgBasis, setBkgBasis] = useState("");
    const [destBranch, setDestBranch] = useState("");
    
    // Dynamic branch fetching
    const [branchOptions, setBranchOptions] = useState<{value: string, label: string}[]>([]);

    React.useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await fetch('/api/references/branches');
                if (res.ok) {
                    const data = await res.json();
                    const options = data.map((b: { code: string; name: string }) => ({
                        value: b.code.toLowerCase(),
                        label: `${b.code} - ${b.name}`.toUpperCase()
                    }));
                    setBranchOptions(options);
                }
            } catch (err) {
                console.error('Failed to fetch branches:', err);
            }
        };
        fetchBranches();
    }, []);
    const [docType, setDocType] = useState("physical"); // 'physical' or 'electronic'

    // Goods fields
    const [goodsValue, setGoodsValue] = useState("");
    const [hsnDesc, setHsnDesc] = useState("");
    const [actualWeight, setActualWeight] = useState("");
    const [loadUnit, setLoadUnit] = useState("mt");
    const [dimL, setDimL] = useState("");
    const [dimW, setDimW] = useState("");
    const [dimH, setDimH] = useState("");
    const [volume, setVolume] = useState("");
    const [privateMark, setPrivateMark] = useState("");

    // Invoice fields
    const [invoiceNo, setInvoiceNo] = useState("");
    const [invoiceDate, setInvoiceDate] = useState("");
    const [invoiceAmt, setInvoiceAmt] = useState("");
    const [ewayBill, setEwayBill] = useState("");
    const [ewayFrom, setEwayFrom] = useState("");
    const [ewayTo, setEwayTo] = useState("");

    // Insurance fields
    const [insuranceComp, setInsuranceComp] = useState("not-known");
    const [policyNo, setPolicyNo] = useState("");
    const [policyDate, setPolicyDate] = useState("");
    const [policyAmount, setPolicyAmount] = useState("");
    const [poNo, setPoNo] = useState("");
    const [poDate, setPoDate] = useState("");
    const [stfNo, setStfNo] = useState("");
    const [stfDate, setStfDate] = useState("");
    const [stfValidUpto, setStfValidUpto] = useState("");

    // Others fields
    const [businessType, setBusinessType] = useState("regular");
    const [transportMode, setTransportMode] = useState("road");
    const [docPreparedBy, setDocPreparedBy] = useState("amit");
    const [remarks, setRemarks] = useState("");
    const [otherPrivateMark, setOtherPrivateMark] = useState("");

    // Advance
    const [advanceAmount, setAdvanceAmount] = useState("");

    // Saving state
    const [isSaving, setIsSaving] = useState(false);

    const formatDateForUi = (value?: string | null) => {
        if (!value) return "";
        if (value.includes('/')) return value;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        const day = String(parsed.getDate()).padStart(2, '0');
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const year = parsed.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const buildPartyFromConsignment = (
        type: PartyType,
        details: {
            name?: string | null;
            code?: string | null;
            gstin?: string | null;
            address?: string | null;
            phone?: string | null;
            email?: string | null;
        }
    ): Party | null => {
        if (!details.name && !details.address && !details.gstin) return null;

        return {
            id: `${type}-${details.code || details.name || 'manual'}`,
            name: details.name || '',
            code: details.code || '',
            type,
            gstin: details.gstin || '',
            address: details.address || '',
            city: '',
            pincode: '',
            state: '',
            phone: details.phone || '',
            email: details.email || '',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    };

    // Fetch next CN no when branch changes
    React.useEffect(() => {
        const fetchNextCN = async () => {
            try {
                const response = await fetch(`/api/branches/next-cn?branch=${bookingBranchCode}`);
                if (response.ok) {
                    const data = await response.json();
                    setCnNo(data.nextNo.toString());
                }
            } catch (error) {
                console.error("Error fetching next CN No:", error);
            }
        };

        if (bookingBranchCode && !isEditMode) {
            fetchNextCN();
        }
    }, [bookingBranchCode, isEditMode]);

    React.useEffect(() => {
        if (billingMode !== 'party') return;
        if (!bookingBranchCode) return;
        if (billingBranch) return;

        setBillingBranch(bookingBranchCode);
    }, [billingBranch, billingMode, bookingBranchCode]);

    React.useEffect(() => {
        const loadConsignmentForEdit = async () => {
            if (!editId) return;

            try {
                const authResponse = await fetch('/api/auth/me');
                const authResult = await authResponse.json();
                if (authResult?.data?.role !== 'admin') {
                    toast.error('Admin access required');
                    router.replace('/dashboard/consignments');
                    return;
                }

                const response = await fetch(`/api/consignments/${editId}`);
                if (!response.ok) {
                    throw new Error('Failed to load consignment');
                }

                const data = await response.json();

                setBookingBranchCode(data.booking_branch || "");
                setCnNo(data.cn_no || "");
                setCnDate(formatDateForUi(data.bkg_date) || new Date().toLocaleDateString('en-GB'));
                setDeliveryType(
                    data.delivery_type === 'Door Delivery'
                        ? 'dd'
                        : data.delivery_type === 'Godown Delivery'
                            ? 'gd'
                            : (data.delivery_type || "")
                );
                setIsOwnersRisk(data.owner_risk ?? true);
                setIsDoorCollection(data.door_collection ?? false);
                setIsCancelCn(data.cancel_cn ?? false);
                setBkgBasis(
                    data.bkg_basis === 'TOPAY'
                        ? 'topay'
                        : data.bkg_basis === 'PAID'
                            ? 'paid'
                            : data.bkg_basis === 'TO BE BILLED'
                                ? 'tbb'
                                : (data.bkg_basis || "")
                );
                setDestBranch(data.dest_branch || "");

                setConsignor(buildPartyFromConsignment('consignor', {
                    name: data.consignor_name,
                    code: data.consignor_code,
                    gstin: data.consignor_gst,
                    address: data.consignor_address,
                    phone: data.consignor_mobile,
                    email: data.consignor_email,
                }));
                setConsignee(buildPartyFromConsignment('consignee', {
                    name: data.consignee_name,
                    code: data.consignee_code,
                    gstin: data.consignee_gst,
                    address: data.consignee_address,
                    phone: data.consignee_mobile,
                    email: data.consignee_email,
                }));

                if (data.billing_party_code === MANUAL_BILLING_CODE) {
                    setBillingMode('manual');
                    setBillingParty(null);
                    setManualBillingName(data.billing_party || "");
                    setManualBillingGst(data.billing_party_gst || "");
                    setManualBillingAddress(data.billing_party_address || "");
                    setManualBillingStation(data.billing_branch || "");
                    setBillingBranch("");
                } else {
                    setBillingMode('party');
                    setBillingParty(buildPartyFromConsignment('billing', {
                        name: data.billing_party,
                        code: data.billing_party_code,
                        gstin: data.billing_party_gst,
                        address: data.billing_party_address,
                    }));
                    setBillingBranch(data.billing_branch || "");
                    setManualBillingName("");
                    setManualBillingGst("");
                    setManualBillingAddress("");
                    setManualBillingStation("");
                }

                setIsLoose(data.is_loose ?? false);
                setPackages(Array.isArray(data.packages) ? data.packages : []);
                setGoodsValue(String(data.goods_value ?? ""));
                setHsnDesc(data.hsn_desc || "");
                setChargedWeight(String(data.charged_weight ?? ""));
                setActualWeight(String(data.actual_weight ?? ""));
                setLoadUnit((data.load_unit || "mt").toLowerCase());
                setDimL(String(data.dimension_l ?? ""));
                setDimW(String(data.dimension_w ?? ""));
                setDimH(String(data.dimension_h ?? ""));
                setVolume(String(data.volume ?? ""));
                setPrivateMark(data.private_mark || "");
                setIsFreightPending(data.freight_pending ?? false);
                setFreightRate(String(data.freight_rate ?? ""));
                setBasicFreight(String(data.basic_freight ?? ""));
                setCharges({
                    unloading: String(data.unload_charges ?? ""),
                    detention: String(data.retention_charges ?? ""),
                    extraKm: String(data.extra_km_charges ?? ""),
                    loading: String(data.mhc_charges ?? ""),
                    doorColl: String(data.door_coll_charges ?? ""),
                    doorDel: String(data.door_del_charges ?? ""),
                    other: String(data.other_charges ?? "")
                });
                setAdvanceAmount(String(data.advance_amount ?? ""));
                setInvoiceNo(data.invoice_no || "");
                setInvoiceDate(formatDateForUi(data.invoice_date));
                setInvoiceAmt(String(data.invoice_amount ?? ""));
                setEwayBill(data.eway_bill || "");
                setEwayFrom(formatDateForUi(data.eway_from_date));
                setEwayTo(formatDateForUi(data.eway_to_date));
                setRemarks(data.remarks || "");
            } catch (error) {
                console.error('Failed to load consignment for edit:', error);
                toast.error(error instanceof Error ? error.message : 'Failed to load consignment');
                router.replace('/dashboard/consignments');
            }
        };

        void loadConsignmentForEdit();
    }, [editId, router]);

    const handleAddPackage = () => {
        if (isLoose) {
            const newPackage: PackageItem = {
                id: Math.random().toString(36).substr(2, 9),
                method: "LOOSE",
                qty: 0
            };
            setPackages([...packages, newPackage]);
            return;
        }

        if (!currentPackageQty) return;
        const newPackage: PackageItem = {
            id: Math.random().toString(36).substr(2, 9),
            method: currentPackageMethod,
            qty: parseInt(currentPackageQty) || 0
        };
        setPackages([...packages, newPackage]);
        setCurrentPackageQty("");
    };

    const totalPackages = packages.length; // Or sum of qtys? Requirement says "Add more means we can multiplr package method it will dispalyed in the table then it will be shown in the toral packages"
    // Usually total packages is sum of Quantity.
    const totalQty = packages.reduce((sum, p) => sum + p.qty, 0);

    // If loose is selected, package count might be different? "If losse is selected no need of qty" -> implies Qty=0 or 1?
    // "Loose (Zero Package)" label suggests it counts as 0 packages?

    const calculateFreight = () => {
        if (isFreightPending) return 0;
        let basic = 0;
        if (freightType === 'fixed') {
            basic = parseFloat(basicFreight) || 0;
        } else {
            const rate = parseFloat(freightRate) || 0;
            const weight = parseFloat(chargedWeight) || 0;
            // If weight is in KG and rate is per tonne, basic = (weight / 1000) * rate
            // Assuming the system implies weight is KG when loadUnit is KG.
            if (loadUnit.toLowerCase() === 'kg') {
                basic = (weight / 1000) * rate;
            } else {
                basic = rate * weight; // If already MT or ODC
            }
        }

        const extra = Object.values(charges).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        return basic + extra;
    };

    // Parse DD/MM/YYYY to YYYY-MM-DD for DB, or return null
    const parseDateForDB = (val: string) => {
        if (!val || val.trim() === '') return null;
        const parts = val.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return val; // assume already ISO
    };

    const handleSave = async () => {
        if (isSaving) return;

        const fullCnNo = cnNo;
        if (!cnNo) {
            alert('CN No. is required.');
            return;
        }

        if (docType === 'electronic') {
            if (!dimL || !dimW || !dimH) {
                alert('Length, Width, and Height are required when Document Type is Electronic.');
                return;
            }
        }

        setIsSaving(true);
        try {
            const totalFrt = calculateFreight();
            const adv = parseFloat(advanceAmount) || 0;
            const billingName = billingMode === 'manual' ? manualBillingName.trim() : (billingParty?.name || '');
            const billingCode = billingMode === 'manual' ? MANUAL_BILLING_CODE : (billingParty?.code || '');
            const billingGstValue = billingMode === 'manual' ? manualBillingGst.trim() : (billingParty?.gstin || '');
            const billingAddressValue = billingMode === 'manual' ? manualBillingAddress.trim() : (billingParty?.address || '');
            const billingStationValue = billingMode === 'manual' ? manualBillingStation.trim() : billingBranch.toUpperCase();

            if (bkgBasis === 'tbb' && billingMode === 'manual' && (!billingName || !billingAddressValue)) {
                alert('Manual billing requires name and address.');
                return;
            }

            const basicFrt = freightType === 'fixed' 
                ? (parseFloat(basicFreight) || 0) 
                : (loadUnit.toLowerCase() === 'kg' 
                    ? ((parseFloat(chargedWeight) || 0) / 1000) * (parseFloat(freightRate) || 0)
                    : (parseFloat(chargedWeight) || 0) * (parseFloat(freightRate) || 0));

            const body = {
                cn_no: cnNo,
                bkg_date: cnDate.split('/').reverse().join('-'), // DD/MM/YYYY to YYYY-MM-DD
                booking_branch: bookingBranchCode.toUpperCase(),
                dest_branch: destBranch,
                delivery_type: deliveryType === 'dd' ? 'Door Delivery' : deliveryType === 'gd' ? 'Godown Delivery' : deliveryType,
                owner_risk: isOwnersRisk,
                door_collection: isDoorCollection,
                cancel_cn: isCancelCn,
                bkg_basis: bkgBasis === 'topay' ? 'TOPAY' : bkgBasis === 'paid' ? 'PAID' : bkgBasis === 'tbb' ? 'TO BE BILLED' : bkgBasis,

                consignor_name: consignor?.name,
                consignor_code: consignor?.code,
                consignor_gst: consignor?.gstin,
                consignor_address: consignor?.address,
                consignor_mobile: consignor?.phone,
                consignor_email: consignor?.email,

                consignee_name: consignee?.name,
                consignee_code: consignee?.code,
                consignee_gst: consignee?.gstin,
                consignee_address: consignee?.address,
                consignee_mobile: consignee?.phone,
                consignee_email: consignee?.email,

                billing_party: billingName,
                billing_party_code: billingCode,
                billing_party_gst: billingGstValue,
                billing_party_address: billingAddressValue,
                billing_branch: billingStationValue,

                no_of_pkg: packages.length,
                total_qty: isLoose ? packages.length : totalQty,
                is_loose: isLoose,
                packages: packages,
                goods_value: goodsValue,
                hsn_desc: hsnDesc,
                actual_weight: actualWeight,
                charged_weight: chargedWeight,
                load_unit: loadUnit.toUpperCase(),
                dimension_l: dimL,
                dimension_w: dimW,
                dimension_h: dimH,
                volume: volume,
                private_mark: privateMark || otherPrivateMark,

                freight_pending: isFreightPending,
                freight_rate: freightRate,
                basic_freight: basicFrt.toFixed(2),
                unload_charges: charges.unloading,
                retention_charges: charges.detention,
                extra_km_charges: charges.extraKm,
                mhc_charges: charges.loading,
                door_coll_charges: charges.doorColl,
                door_del_charges: charges.doorDel,
                other_charges: charges.other,
                total_freight: totalFrt.toFixed(2),
                advance_amount: advanceAmount,
                balance_amount: (totalFrt - adv).toFixed(2),

                invoice_no: invoiceNo,
                invoice_date: parseDateForDB(invoiceDate),
                invoice_amount: invoiceAmt,
                eway_bill: ewayBill,
                eway_from_date: parseDateForDB(ewayFrom),
                eway_to_date: parseDateForDB(ewayTo),

                insurance_company: insuranceComp === 'not-known' ? 'NOT KNOWN' : insuranceComp,
                policy_no: policyNo,
                policy_date: parseDateForDB(policyDate),
                policy_amount: policyAmount,
                po_no: poNo,
                po_date: parseDateForDB(poDate),
                stf_no: stfNo,
                stf_date: parseDateForDB(stfDate),
                stf_valid_upto: parseDateForDB(stfValidUpto),

                business_type: businessType === 'regular' ? 'REGULAR' : businessType,
                transport_mode: transportMode === 'road' ? 'BY ROAD' : transportMode,
                doc_prepared_by: docPreparedBy === 'amit' ? 'AMIT PANDEY [A8644]' : docPreparedBy,
                remarks: remarks,
            };

            const endpoint = isEditMode ? `/api/consignments/${editId}` : '/api/consignments';
            const method = isEditMode ? 'PATCH' : 'POST';

            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save consignment');
            }

            alert(`Consignment ${fullCnNo} ${isEditMode ? 'updated' : 'saved'} successfully!`);

            router.push('/dashboard/consignments');
            router.refresh();
        } catch (error: unknown) {
            console.error('Save error:', error);
            alert((error as Error).message || 'Failed to save consignment');
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className="flex flex-col min-h-screen bg-[#f8f9fa] animate-fadeIn">
            {/* Sticky Top Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
                <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/consignments">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-primary/10">
                                <ArrowLeft className="h-5 w-5 text-primary" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">CNS Entry</h1>
                            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                {isEditMode ? (
                                    <>Editing CNS: <span className="text-primary">{cnNo || '---'}</span></>
                                ) : (
                                    <>Last entered: <span className="text-primary">801191</span> on 17/01/2026</>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="gap-2 h-9">
                            <RotateCcw className="h-4 w-4" /> Reset Form
                        </Button>
                        <Button className="gap-2 h-9 shadow-lg shadow-primary/20" onClick={handleSave} disabled={isSaving}>
                            <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : (isEditMode ? 'Update Consignment' : 'Save Consignment')}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6 max-w-[1920px] mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Main Form Area */}
                    <div className="lg:col-span-9 space-y-6">

                        {/* Quick Options Bar */}
                        <div className="flex flex-wrap gap-8 px-4 py-2 bg-card rounded-lg border shadow-sm">
                            <div className="flex items-center space-x-2">
                                <Switch id="owners-risk" checked={isOwnersRisk} onCheckedChange={setIsOwnersRisk} />
                                <Label htmlFor="owners-risk" className="text-sm font-bold cursor-pointer">Owner&apos;s Risk</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="door-collection" checked={isDoorCollection} onCheckedChange={(c) => setIsDoorCollection(!!c)} />
                                <Label htmlFor="door-collection" className="text-sm font-bold cursor-pointer">Door Collection</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="cancel-flag" checked={isCancelCn} onCheckedChange={(c) => setIsCancelCn(!!c)} />
                                <Label htmlFor="cancel-flag" className="text-sm font-bold text-destructive cursor-pointer">Cancel CN</Label>
                            </div>
                            <Separator orientation="vertical" className="h-6" />
                            <div className="flex items-center text-[11px] font-bold text-primary uppercase bg-primary/5 px-2 py-1 rounded">
                                Non-Negotiable
                            </div>
                            <div className="flex-1" />
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground">Booking Mode:</span>
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">System (Online)</Badge>
                            </div>
                        </div>

                        {/* Section 1: General Details */}
                        <Card className="border-none shadow-md overflow-hidden bg-white">
                            <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                    <Info className="h-4 w-4" /> General Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">Booking Branch</Label>
                                        <Select value={bookingBranchCode} onValueChange={setBookingBranchCode}>
                                            <SelectTrigger className="h-9 bg-slate-50">
                                                <SelectValue placeholder="Select Branch" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {branchOptions.map(branch => (
                                                    <SelectItem key={branch.value} value={branch.value}>{branch.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">Delivery Branch</Label>
                                        <Select value={destBranch} onValueChange={setDestBranch}>
                                            <SelectTrigger className="h-9 bg-slate-50">
                                                <SelectValue placeholder="Select Branch" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {branchOptions.map(branch => (
                                                    <SelectItem key={branch.value} value={branch.value}>{branch.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1 lg:col-span-2">
                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">CN No & Date</Label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Input className="h-9 font-mono font-bold" value={cnNo} onChange={(e) => setCnNo(e.target.value)} />
                                            </div>
                                            <Input type="text" className="w-32 h-9 text-center" value={cnDate} onChange={(e) => setCnDate(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">Delivery Type</Label>
                                        <Select value={deliveryType} onValueChange={setDeliveryType}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="dd">Door Delivery</SelectItem>
                                                <SelectItem value="gd">Godown Delivery</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1 lg:col-span-2">
                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">Document Type</Label>
                                        <Select value={docType} onValueChange={setDocType}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select Doc Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="physical">Physical</SelectItem>
                                                <SelectItem value="electronic">Electronic (Doc Elect)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Section 2: Entities Side-by-Side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Consignor Card */}
                            <Card className="border-none shadow-md bg-white">
                                <CardHeader className="bg-indigo-50/50 py-3 px-6 border-b flex flex-row justify-between items-center">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-700">
                                        <User className="h-4 w-4" /> Consignor Details
                                    </CardTitle>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="save-consignor" />
                                        <Label htmlFor="save-consignor" className="text-[10px] font-bold cursor-pointer uppercase text-indigo-700">Save</Label>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Consignor Name</Label>
                                        <PartyAutocomplete
                                            type="consignor"
                                            onSelect={(p) => {
                                                if (p?.id === 'new') {
                                                    setPendingPartyName(p.name);
                                                    setPendingPartyType('consignor');
                                                    setIsAddPartyDialogOpen(true);
                                                } else {
                                                    setConsignor(p);
                                                }
                                            }}
                                            value={consignor?.name}
                                            placeholder="Select Consignor"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold text-muted-foreground">Code</Label>
                                        <Input
                                            className="h-8 text-xs"
                                            value={consignor?.code || ''}
                                            readOnly
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold text-muted-foreground">GST</Label>
                                        <Input
                                            className="h-8 font-mono text-xs"
                                            placeholder="GSTIN"
                                            value={consignor?.gstin || ''}
                                            readOnly
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Address</Label>
                                        <Input
                                            className="h-9"
                                            value={consignor?.address || ''}
                                            readOnly
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Mobile</Label>
                                            <Input
                                                className="h-8 text-xs"
                                                value={consignor?.phone || ''}
                                                readOnly
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Email</Label>
                                            <Input
                                                className="h-8 text-xs"
                                                value={consignor?.email || ''}
                                                readOnly
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Consignee Card */}
                            <Card className="border-none shadow-md bg-white">
                                <CardHeader className="bg-emerald-50/50 py-3 px-6 border-b flex flex-row justify-between items-center">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-700">
                                        <User className="h-4 w-4" /> Consignee Details
                                    </CardTitle>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="save-consignee" />
                                        <Label htmlFor="save-consignee" className="text-[10px] font-bold cursor-pointer uppercase text-emerald-700">Save</Label>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Consignee Name</Label>
                                        <PartyAutocomplete
                                            type="consignee"
                                            onSelect={(p) => {
                                                if (p?.id === 'new') {
                                                    setPendingPartyName(p.name);
                                                    setPendingPartyType('consignee');
                                                    setIsAddPartyDialogOpen(true);
                                                } else {
                                                    setConsignee(p);
                                                }
                                            }}
                                            value={consignee?.name}
                                            placeholder="Select Consignee"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold text-muted-foreground">Code</Label>
                                        <Input
                                            className="h-8 text-xs"
                                            value={consignee?.code || ''}
                                            readOnly
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold text-muted-foreground">GST</Label>
                                        <Input
                                            className="h-8 font-mono text-xs"
                                            placeholder="GSTIN"
                                            value={consignee?.gstin || ''}
                                            readOnly
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Address</Label>
                                        <Input
                                            className="h-9"
                                            value={consignee?.address || ''}
                                            readOnly
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Mobile</Label>
                                            <Input
                                                className="h-8 text-xs"
                                                value={consignee?.phone || ''}
                                                readOnly
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Email</Label>
                                            <Input
                                                className="h-8 text-xs"
                                                value={consignee?.email || ''}
                                                readOnly
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>



                        {/* Section 3: Package & Goods Details */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Package Details */}
                            <Card className="border-none shadow-md bg-white h-full">
                                <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Package Details</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex items-center space-x-2 bg-yellow-50 p-2 rounded border border-yellow-100">
                                        <Checkbox id="loose" checked={isLoose} onCheckedChange={(c) => setIsLoose(!!c)} />
                                        <Label htmlFor="loose" className="text-xs font-bold cursor-pointer text-yellow-800">LOOSE</Label>
                                    </div>

                                    <div className="grid grid-cols-12 gap-2 items-end">
                                        <div className="col-span-5 space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Package Method</Label>
                                            <Select value={currentPackageMethod} onValueChange={setCurrentPackageMethod} disabled={isLoose}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Select Method" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="box">Box</SelectItem>
                                                    <SelectItem value="bag">Bag</SelectItem>
                                                    <SelectItem value="drum">Drum</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-3 space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Qty</Label>
                                            <Input type="number" className="h-8 text-xs" value={currentPackageQty} onChange={(e) => setCurrentPackageQty(e.target.value)} />
                                        </div>
                                        <div className="col-span-4">
                                            <Button size="sm" className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={handleAddPackage}>Add More</Button>
                                        </div>
                                    </div>

                                    {/* Mini Table for Packages */}
                                    <div className="border rounded-md overflow-hidden bg-slate-50">
                                        <div className="grid grid-cols-12 bg-slate-100 p-2 text-[10px] font-bold text-muted-foreground uppercase border-b">
                                            <div className="col-span-2 text-center">Sr.No.</div>
                                            <div className="col-span-6">Package Method</div>
                                            <div className="col-span-2 text-center">Qty</div>
                                            <div className="col-span-2 text-center">Action</div>
                                        </div>
                                        {packages.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-muted-foreground italic">
                                                No packages added
                                            </div>
                                        ) : (
                                            <div className="max-h-32 overflow-y-auto">
                                                {packages.map((pkg, idx) => (
                                                    <div key={pkg.id} className="grid grid-cols-12 p-2 text-xs border-b last:border-0 hover:bg-slate-100">
                                                        <div className="col-span-2 text-center">{idx + 1}</div>
                                                        <div className="col-span-6">{pkg.method}</div>
                                                        <div className="col-span-2 text-center">{pkg.qty}</div>
                                                        <div className="col-span-2 text-center text-destructive cursor-pointer hover:underline" onClick={() => setPackages(packages.filter(p => p.id !== pkg.id))}>X</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Total Qty</Label>
                                            <Input className="h-8 text-xs font-bold bg-slate-50" readOnly value={isLoose ? packages.length : totalQty} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Goods Details */}
                            <Card className="border-none shadow-md bg-white h-full">
                                <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Goods Details</CardTitle>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="unloading" />
                                            <Label htmlFor="unloading" className="text-[10px] font-bold cursor-pointer uppercase">Unloading By Cnee</Label>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Value Of Goods</Label>
                                            <Input className="h-8 text-xs" value={goodsValue} onChange={(e) => setGoodsValue(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">HSN Description</Label>
                                            <Input className="h-8 text-xs" placeholder="AUTO EXTENDER" value={hsnDesc} onChange={(e) => setHsnDesc(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Charged Wt (kg)</Label>
                                            <Input className="h-8 text-xs bg-yellow-50/50" value={chargedWeight} onChange={(e) => setChargedWeight(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Actual Weight (kg)</Label>
                                            <Input className="h-8 text-xs" value={actualWeight} onChange={(e) => setActualWeight(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Load Unit</Label>
                                            <Select value={loadUnit} onValueChange={(val) => setLoadUnit(val)}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Unit" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="mt">MT</SelectItem>
                                                    <SelectItem value="kg">KG</SelectItem>
                                                    <SelectItem value="odc">ODC</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">
                                                L x W x H (inch) {docType === 'electronic' && <span className="text-red-500">*</span>}
                                            </Label>
                                            <div className="flex gap-1">
                                                <Input className="h-8 text-xs px-1 text-center" placeholder="L" value={dimL} onChange={(e) => setDimL(e.target.value)} required={docType === 'electronic'} />
                                                <Input className="h-8 text-xs px-1 text-center" placeholder="W" value={dimW} onChange={(e) => setDimW(e.target.value)} required={docType === 'electronic'} />
                                                <Input className="h-8 text-xs px-1 text-center" placeholder="H" value={dimH} onChange={(e) => setDimH(e.target.value)} required={docType === 'electronic'} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Private Mark</Label>
                                            <Input className="h-8 text-xs" value={privateMark} onChange={(e) => setPrivateMark(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-muted-foreground">Volume</Label>
                                            <Input className="h-8 text-xs bg-yellow-50/50" value={volume} onChange={(e) => setVolume(e.target.value)} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Section 4: Secondary Tabs */}
                        <Tabs defaultValue="billing" className="w-full">
                            <TabsList className="w-full justify-start h-10 bg-slate-100 p-1 rounded-lg">
                                <TabsTrigger value="billing" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <Calculator className="h-3.5 w-3.5" /> Billing Details
                                </TabsTrigger>
                                <TabsTrigger value="invoice" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <ChevronRight className="h-3.5 w-3.5" /> Invoice & Others
                                </TabsTrigger>
                                <TabsTrigger value="insurance" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <Truck className="h-3.5 w-3.5" /> Insurance & PO
                                </TabsTrigger>
                            </TabsList>

                            <div className="mt-4">
                                <TabsContent value="billing">
                                    <Card className="border-none shadow-md bg-white">
                                        <CardHeader className="bg-orange-50/50 py-3 px-6 border-b">
                                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-orange-800">
                                                <Calculator className="h-4 w-4" /> Billing Details
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Booking Basis</Label>
                                                    <Select value={bkgBasis} onValueChange={setBkgBasis}>
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue placeholder="Select Basis" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="topay">TOPAY</SelectItem>
                                                            <SelectItem value="paid">PAID</SelectItem>
                                                            <SelectItem value="tbb">TO BE BILLED</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Billing Destination</Label>
                                                    <Select
                                                        value={billingMode}
                                                        onValueChange={(value: 'party' | 'manual') => {
                                                            setBillingMode(value);
                                                            if (value === 'party') {
                                                                setManualBillingName("");
                                                                setManualBillingAddress("");
                                                                setManualBillingGst("");
                                                                setManualBillingStation("");
                                                                setBillingBranch((current) => current || bookingBranchCode);
                                                            } else {
                                                                setBillingParty(null);
                                                                setBillingBranch("");
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="party">Saved Billing Party</SelectItem>
                                                            <SelectItem value="manual">Personal Delivery</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Bill For (Branch)</Label>
                                                    {billingMode === 'party' ? (
                                                        <Select value={billingBranch} onValueChange={setBillingBranch}>
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="Select Branch" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {branchOptions.map((branch) => (
                                                                    <SelectItem key={branch.value} value={branch.value}>
                                                                        {branch.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Input
                                                            className="h-9"
                                                            placeholder="Enter station / location"
                                                            value={manualBillingStation}
                                                            onChange={(e) => setManualBillingStation(e.target.value)}
                                                        />
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Code Station Name</Label>
                                                    <Input
                                                        className="h-9 bg-slate-50 font-bold"
                                                        value={billingMode === 'manual' ? manualBillingStation.toUpperCase() : getBranchLabel(billingBranch, branchOptions)}
                                                        readOnly
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                                                        {billingMode === 'manual' ? 'Delivery Name' : 'Billing Party'}
                                                    </Label>
                                                    {billingMode === 'party' ? (
                                                        <PartyAutocomplete
                                                            type="billing"
                                                            onSelect={(p) => {
                                                                if (p?.id === 'new') {
                                                                    setPendingPartyName(p.name);
                                                                    setPendingPartyType('billing');
                                                                    setIsAddPartyDialogOpen(true);
                                                                } else {
                                                                    setBillingParty(p);
                                                                }
                                                            }}
                                                            value={billingParty?.name}
                                                            placeholder="Select Billing Party"
                                                        />
                                                    ) : (
                                                        <Input
                                                            className="h-9"
                                                            placeholder="Enter personal delivery name"
                                                            value={manualBillingName}
                                                            onChange={(e) => setManualBillingName(e.target.value)}
                                                        />
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Party Code</Label>
                                                    <Input
                                                        className="h-9 bg-yellow-50/30"
                                                        value={billingMode === 'manual' ? MANUAL_BILLING_CODE : (billingParty?.code || '')}
                                                        readOnly
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Billing Party GST</Label>
                                                    <Input
                                                        className="h-9 font-mono bg-yellow-50/30"
                                                        value={billingMode === 'manual' ? manualBillingGst : (billingParty?.gstin || '')}
                                                        onChange={(e) => {
                                                            if (billingMode === 'manual') {
                                                                setManualBillingGst(e.target.value);
                                                            }
                                                        }}
                                                        readOnly={billingMode === 'party'}
                                                    />
                                                </div>

                                                <div className="space-y-1 lg:col-span-2">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Address</Label>
                                                    <Input
                                                        className="h-9 bg-yellow-50/30"
                                                        value={billingMode === 'manual' ? manualBillingAddress : (billingParty?.address || '')}
                                                        onChange={(e) => {
                                                            if (billingMode === 'manual') {
                                                                setManualBillingAddress(e.target.value);
                                                            }
                                                        }}
                                                        readOnly={billingMode === 'party'}
                                                    />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="insurance">
                                    <div className="space-y-6">
                                        <Card className="border-none shadow-md bg-white">
                                            <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Insurance & PO Details</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                                    {/* Left Column */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-4">
                                                            <Label className="w-24 text-[10px] font-bold text-muted-foreground uppercase">Ins Comp</Label>
                                                            <div className="flex-1">
                                                                <Select defaultValue="not-known">
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="not-known">NOT KNOWN</SelectItem>
                                                                        <SelectItem value="lic">LIC</SelectItem>
                                                                        <SelectItem value="bajaj">BAJAJ ALLIANZ</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <Label className="w-24 text-[10px] font-bold text-muted-foreground uppercase">PO No & Date</Label>
                                                            <div className="flex-1 flex gap-2">
                                                                <Input className="h-8 text-xs" placeholder="PO Number" />
                                                                <Input className="h-8 text-xs w-32" placeholder="DD/MM/YYYY" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right Column */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-4">
                                                            <Label className="w-24 text-[10px] font-bold text-muted-foreground uppercase">Policy No & Date</Label>
                                                            <div className="flex-1 flex gap-2">
                                                                <Input className="h-8 text-xs" placeholder="Policy Number" />
                                                                <Input className="h-8 text-xs w-32" placeholder="DD/MM/YYYY" />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <Label className="w-24 text-[10px] font-bold text-muted-foreground uppercase">Policy Amount</Label>
                                                            <Input className="h-8 text-xs flex-1" placeholder="0.00" />
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <Label className="w-24 text-[10px] font-bold text-muted-foreground uppercase">STF No & Date</Label>
                                                            <div className="flex-1 flex gap-2">
                                                                <Input className="h-8 text-xs" placeholder="STF Number" />
                                                                <Input className="h-8 text-xs w-32" placeholder="DD/MM/YYYY" />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <Label className="w-24 text-[10px] font-bold text-muted-foreground uppercase">STF Valid Upto</Label>
                                                            <Input className="h-8 text-xs w-32" placeholder="DD/MM/YYYY" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                <TabsContent value="invoice">
                                    <div className="space-y-6">
                                        {/* Invoice Details Card */}
                                        <Card className="border-none shadow-md bg-white">
                                            <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                                                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Invoice Details</CardTitle>
                                                <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50">
                                                    <Plus className="h-3 w-3 mr-1" /> Add More Invoice
                                                </Button>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Invoice No</Label>
                                                        <Input className="h-8 text-xs" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Invoice Date</Label>
                                                        <Input className="h-8 text-xs" placeholder="DD/MM/YYYY" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Invoice Amt</Label>
                                                        <Input className="h-8 text-xs" value={invoiceAmt} onChange={(e) => setInvoiceAmt(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">eWay Bill</Label>
                                                        <Input className="h-8 text-xs" value={ewayBill} onChange={(e) => setEwayBill(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">eWay From Date</Label>
                                                        <Input className="h-8 text-xs" placeholder="DD/MM/YYYY" value={ewayFrom} onChange={(e) => setEwayFrom(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">eWay To Date</Label>
                                                        <Input className="h-8 text-xs" placeholder="DD/MM/YYYY" value={ewayTo} onChange={(e) => setEwayTo(e.target.value)} />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Others Details Card */}
                                        <Card className="border-none shadow-md bg-white">
                                            <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                                                <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Others Details</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Type Of Business</Label>
                                                        <Select defaultValue="regular">
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="regular">1 - REGULAR</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Transport Mode</Label>
                                                        <Select defaultValue="road">
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="road">1 - BY ROAD</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Private Mark</Label>
                                                        <Input className="h-8 text-xs" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Doc Prepared By</Label>
                                                        <Select defaultValue="amit">
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="amit">AMIT PANDEY [A8644]</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Remarks</Label>
                                                        <Input className="h-8 text-xs" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>

                    {/* Pricing Sidebar */}
                    <div className="lg:col-span-3">
                        <div className="sticky top-[88px] space-y-6">
                            <Card className="border-2 border-primary/20 shadow-xl shadow-primary/5 bg-white overflow-hidden">
                                <CardHeader className="bg-primary py-4 px-6">
                                    <CardTitle className="text-white text-sm font-bold uppercase tracking-widest flex items-center justify-between">
                                        Freight Details
                                        <Calculator className="h-4 w-4 opacity-50" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[calc(100vh-250px)] px-6 py-4">
                                        <div className="space-y-3 pb-6">
                                            <div className="flex flex-col space-y-2 pb-2 border-b border-primary/10">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox id="freight-pending" checked={isFreightPending} onCheckedChange={(c) => setIsFreightPending(!!c)} />
                                                    <Label htmlFor="freight-pending" className="text-xs font-bold cursor-pointer">Freight Pending</Label>
                                                </div>
                                                <div className="flex items-center justify-between gap-4 pt-2">
                                                    <Label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">Freight Type</Label>
                                                    <Select value={freightType} onValueChange={setFreightType} disabled={isFreightPending}>
                                                        <SelectTrigger className="h-7 w-32 text-xs font-mono">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="per_tone">Per Tonne/Unit</SelectItem>
                                                            <SelectItem value="fixed">Fixed</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-4">
                                                <Label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">Rate</Label>
                                                <Input
                                                    type="text"
                                                    className="h-7 w-28 text-right font-mono text-xs"
                                                    disabled={isFreightPending || freightType === 'fixed'}
                                                    value={isFreightPending ? "0" : freightRate}
                                                    onChange={(e) => setFreightRate(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <Label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">Basic Freight</Label>
                                                <Input
                                                    type="text"
                                                    className={`h-7 w-28 text-right font-mono text-xs ${freightType === 'fixed' ? '' : 'bg-primary/5 border-primary/20 font-bold'}`}
                                                    readOnly={freightType !== 'fixed'}
                                                    disabled={isFreightPending}
                                                    value={isFreightPending ? "0.00" : (freightType === 'fixed' ? basicFreight : (loadUnit.toLowerCase() === 'kg' ? (((parseFloat(chargedWeight) || 0) / 1000) * (parseFloat(freightRate) || 0)).toFixed(2) : ((parseFloat(freightRate) || 0) * parseFloat(chargedWeight || "0")).toFixed(2)))}
                                                    onChange={(e) => setBasicFreight(e.target.value)}
                                                />
                                            </div>

                                            {[
                                                { key: 'unloading', label: "Unloading Charges" },
                                                { key: 'detention', label: "Detention Charges" },
                                                { key: 'extraKm', label: "Extra KM Charges" },
                                                { key: 'loading', label: "Loading Charges" },
                                                { key: 'doorColl', label: "Door Coll Charges" },
                                                { key: 'doorDel', label: "Door Del Charges" },
                                                { key: 'other', label: "Other Charges" },
                                            ].map((field) => (
                                                <div key={field.key} className="flex items-center justify-between gap-4">
                                                    <Label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">{field.label}</Label>
                                                    <Input
                                                        type="text"
                                                        disabled={isFreightPending}
                                                        className="h-7 w-28 text-right font-mono text-xs"
                                                        value={isFreightPending ? "0" : charges[field.key as keyof typeof charges]}
                                                        onChange={(e) => setCharges({ ...charges, [field.key]: e.target.value })}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <Separator className="my-4" />

                                        <div className="space-y-6 pt-2">
                                            <div className="bg-yellow-100/50 p-4 rounded-lg border border-yellow-200">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-black uppercase text-yellow-800">Total Freight</Label>
                                                    <div className="text-xl font-black text-yellow-900">₹ {calculateFreight().toFixed(2)}</div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Advance</Label>
                                                <Input className="h-9 text-right font-mono font-bold" placeholder="0.00" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
                                            </div>

                                            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-black uppercase text-primary">Balance Due</Label>
                                                    <div className="text-xl font-black text-primary">₹ {calculateFreight().toFixed(2)}</div>
                                                </div>
                                            </div>

                                            <div className="p-3 bg-muted/30 rounded-md border border-dashed text-center">
                                                <p className="text-[10px] font-bold text-destructive italic">
                                                    Rs. Two Hundred Fifty Five Zero Paise Only
                                                </p>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            <Button className="w-full h-12 text-lg font-bold shadow-xl shadow-primary/20" onClick={handleSave} disabled={isSaving}>
                                <Save className="mr-2" /> {isSaving ? 'Saving...' : (isEditMode ? 'Update Booking' : 'Finalize Booking')}
                            </Button>
                        </div>
                    </div>
                </div>

                <AddPartyDialog
                    open={isAddPartyDialogOpen}
                    onOpenChange={setIsAddPartyDialogOpen}
                    initialName={pendingPartyName}
                    defaultType={pendingPartyType}
                    onSave={(newParty) => {
                        // Update the appropriate state based on pendingPartyType
                        if (pendingPartyType === 'consignor') {
                            setConsignor(newParty);
                        } else if (pendingPartyType === 'consignee') {
                            setConsignee(newParty);
                        } else if (pendingPartyType === 'billing') {
                            setBillingParty(newParty);
                        }
                    }}
                />
            </div>

            {/* Footer is handled by layout */}
        </div >
    );
}
