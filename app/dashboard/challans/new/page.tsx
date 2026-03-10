'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Save, RotateCcw, FileText, MapPin, Truck, Users,
    Shield, CreditCard, Search, Upload, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

// Branch interface
interface Branch {
    id: string;
    code: string;
    name: string;
    city: string;
}

export default function NewChallanPage() {
    const router = useRouter();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Basic Details
    const [originBranch, setOriginBranch] = useState('MRG');
    const [challanNo, setChallanNo] = useState('');
    const [challanPrefix, setChallanPrefix] = useState('KC');
    const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
    const [challanTime, setChallanTime] = useState(new Date().toTimeString().slice(0, 5));
    const [subType, setSubType] = useState('Route');
    const [destBranch, setDestBranch] = useState('');
    
    // Lane Details
    const [loadingPincode, setLoadingPincode] = useState('');
    const [loadingArea, setLoadingArea] = useState('VERNA GOA');
    const [unloadingBranch, setUnloadingBranch] = useState('');
    const [unloadingPincode, setUnloadingPincode] = useState('');
    const [unloadingArea, setUnloadingArea] = useState('');
    const [tripDistance, setTripDistance] = useState(0);
    const [expectedTripDate, setExpectedTripDate] = useState('');
    const [expectedTripTime, setExpectedTripTime] = useState('');

    // Owner/Broker
    const [ownerType, setOwnerType] = useState('Market');
    const [ownerPan, setOwnerPan] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerMobile, setOwnerMobile] = useState('');
    const [ownerAddress, setOwnerAddress] = useState('');
    const [ownerTel, setOwnerTel] = useState('');
    const [brokerName, setBrokerName] = useState('');
    const [brokerCode, setBrokerCode] = useState('');
    const [brokerMobile, setBrokerMobile] = useState('');
    const [brokerAddress, setBrokerAddress] = useState('');
    const [slipNo, setSlipNo] = useState('');
    const [slipDate, setSlipDate] = useState('');

    // Vehicle
    const [vehicleNo, setVehicleNo] = useState('');
    const [vehicleType, setVehicleType] = useState('open');
    const [permitNo, setPermitNo] = useState('');
    const [permitValidity, setPermitValidity] = useState('');
    const [vehicleMake, setVehicleMake] = useState('tata');
    const [engineNo, setEngineNo] = useState('');
    const [chasisNo, setChasisNo] = useState('');
    const [taxTokenNo, setTaxTokenNo] = useState('');
    const [taxTokenValidity, setTaxTokenValidity] = useState('');
    const [taxTokenIssuedBy, setTaxTokenIssuedBy] = useState('');
    const [vehicleModel, setVehicleModel] = useState('lpt');

    // Driver
    const [driverDlNo, setDriverDlNo] = useState('');
    const [driverName, setDriverName] = useState('');
    const [driverDlValidity, setDriverDlValidity] = useState('');
    const [driverMobile, setDriverMobile] = useState('');
    const [driverRto, setDriverRto] = useState('goa');

    // Insurance & eWaybill
    const [policyNo, setPolicyNo] = useState('');
    const [policyValidity, setPolicyValidity] = useState('');
    const [insCompany, setInsCompany] = useState('');
    const [insCity, setInsCity] = useState('');
    const [financeDetail, setFinanceDetail] = useState('');
    const [ewaybillNo, setEwaybillNo] = useState('');
    const [ewaybillDate, setEwaybillDate] = useState('');

    // ITDS Declaration
    const [itdsRefBranch, setItdsRefBranch] = useState('');
    const [itdsDeclareDate, setItdsDeclareDate] = useState('');
    const [itdsFinYear, setItdsFinYear] = useState('2025-2026');

    // Other Info
    const [engagedBy, setEngagedBy] = useState('emp1');
    const [engagedDate, setEngagedDate] = useState(new Date().toISOString().split('T')[0]);
    const [remarks, setRemarks] = useState('');
    const [challanType, setChallanType] = useState('MAIN');
    const [onScheduleRoute, setOnScheduleRoute] = useState(true);
    const [loadingAt, setLoadingAt] = useState('arc');
    const [unloadingAt, setUnloadingAt] = useState('arc');
    const [engagedThroughOwner, setEngagedThroughOwner] = useState(false);
    const [slipAttached, setSlipAttached] = useState(false);
    const [tripTracking, setTripTracking] = useState(false);

    // Financial state for Hire Details computed fields
    const [hireDetails, setHireDetails] = useState({
        noOfCns: 1, noOfPackage: 0, actualWeight: 0, chargeWeight: 0,
        vehicleCapacity: 0, noOfLoadingPoints: 0, noOfUnloadingPoints: 0,
        ratePerKg: 0, hire: 0, extraOverWeight: 0, overLength: 0,
        overHeight: 0, overWidth: 0, extraKmCharges: 0,
        detentCharges: 0, transitPass: 0, totalExtra: 0, totalHire: 0,
        advPayment: 0, tdsPercent: 0, lessTds: 0,
        creditDate: '', cardAmount: 0, genericNo: '', cardNo: '',
        balAmount: 0, balPaymentBranch: '',
        petroCardBranch: ''
    });

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await fetch('/api/references/branches');
                if (res.ok) {
                    const data = await res.json();
                    setBranches(data);
                }
            } catch (error) {
                console.error('Failed to fetch branches', error);
                toast.error('Failed to load branches');
            }
        };
        fetchBranches();
    }, []);

    // Fetch next Challan No when origin branch changes
    useEffect(() => {
        const fetchNextChallan = async () => {
            try {
                const res = await fetch(`/api/branches/next-challan?branch=${originBranch}`);
                if (res.ok) {
                    const data = await res.json();
                    setChallanPrefix(data.prefix);
                    setChallanNo(data.nextNo.toString());
                }
            } catch (error) {
                console.error('Failed to fetch next challan no', error);
            }
        };
        if (originBranch) fetchNextChallan();
    }, [originBranch]);

    const updateHire = (field: string, value: number | string) => {
        setHireDetails(prev => {
            const next = { ...prev, [field]: value };
            // Recalculate derived fields
            next.totalExtra = (next.extraOverWeight || 0) + (next.overLength || 0) + (next.overHeight || 0) + (next.overWidth || 0) + (next.extraKmCharges || 0);
            next.totalHire = (next.hire || 0) + (next.totalExtra || 0) + (next.detentCharges || 0) + (next.transitPass || 0);
            next.lessTds = Math.round(next.totalHire * (next.tdsPercent / 100));
            next.balAmount = next.totalHire - (next.advPayment || 0) - next.lessTds;
            return next;
        });
    };

    const handleSave = async () => {
        if (!vehicleNo) {
            toast.error('Vehicle Number is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const body = {
                challan_no: `${challanPrefix}${challanNo}`,
                origin_branch_code: originBranch,
                destination_branch_code: destBranch,
                challan_type: challanType,
                sub_type: subType,
                owner_type: ownerType,
                vehicle_no: vehicleNo.toUpperCase(),
                driver_name: driverName,
                driver_mobile: driverMobile,
                
                // Lane Details
                loading_at: loadingAt === 'arc' ? 'ARC' : 'Party',
                unloading_at: unloadingAt === 'arc' ? 'ARC' : 'Party',
                loading_branch_code: originBranch,
                unloading_branch_code: unloadingBranch,
                loading_pincode: loadingPincode,
                unloading_pincode: unloadingPincode,
                loading_area: loadingArea,
                unloading_area: unloadingArea,
                trip_distance: tripDistance,
                expected_trip_complete_at: expectedTripDate && expectedTripTime ? `${expectedTripDate}T${expectedTripTime}` : null,

                // Owner/Broker
                owner_pan: ownerPan.toUpperCase(),
                owner_name: ownerName,
                owner_mobile: ownerMobile,
                owner_address: ownerAddress,
                owner_tel: ownerTel,
                broker_name: brokerName,
                broker_code: brokerCode,
                broker_mobile: brokerMobile,
                broker_address: brokerAddress,
                slip_no: slipNo,
                slip_date: slipDate || null,

                // Vehicle
                vehicle_type: vehicleType,
                permit_no: permitNo,
                permit_validity: permitValidity || null,
                vehicle_make: vehicleMake,
                engine_no: engineNo,
                chasis_no: chasisNo,
                tax_token_no: taxTokenNo,
                tax_token_validity: taxTokenValidity || null,
                tax_token_issued_by: taxTokenIssuedBy,
                vehicle_model: vehicleModel,

                // Insurance
                insurance_policy_no: policyNo,
                insurance_validity: policyValidity || null,
                insurance_company_name: insCompany,
                insurance_city: insCity,
                finance_detail: financeDetail,
                ewaybill_no: ewaybillNo,
                ewaybill_date: ewaybillDate || null,

                // ITDS
                itds_ref_branch: itdsRefBranch,
                itds_declare_date: itdsDeclareDate || null,
                itds_financial_year: itdsFinYear,

                // Driver
                driver_dl_no: driverDlNo,
                driver_dl_validity: driverDlValidity || null,
                driver_rto: driverRto,
                trip_tracking_consent: tripTracking,

                // Financials
                total_hire_amount: hireDetails.totalHire,
                extra_hire_amount: hireDetails.totalExtra,
                advance_amount: hireDetails.advPayment,
                hire_rate_per_kg: hireDetails.ratePerKg,
                hire_amount: hireDetails.hire,
                extra_over_weight: hireDetails.extraOverWeight,
                extra_over_length: hireDetails.overLength,
                extra_over_height: hireDetails.overHeight,
                extra_over_width: hireDetails.overWidth,
                extra_km_charges: hireDetails.extraKmCharges,
                detent_charges: hireDetails.detentCharges,
                transit_pass_charges: hireDetails.transitPass,
                total_extra_charges: hireDetails.totalExtra,
                tds_percent: hireDetails.tdsPercent,
                less_tds: hireDetails.lessTds,
                bal_payment_branch_code: hireDetails.balPaymentBranch,
                card_amount: hireDetails.cardAmount,
                generic_no: hireDetails.genericNo,
                card_no: hireDetails.cardNo,
                credit_date: hireDetails.creditDate || null,
                petro_card_branch_code: hireDetails.petroCardBranch,

                // Others
                engaged_by: engagedBy,
                engaged_date: engagedDate || null,
                remarks
            };

            const res = await fetch('/api/challans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to save challan');
            }

            toast.success('Challan saved successfully!');
            router.push('/dashboard/challans');
        } catch (error: any) {
            toast.error(error.message || 'Failed to save');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reusable field label style (matches consignment form)
    const labelCls = "text-[11px] font-bold uppercase text-muted-foreground";
    const inputCls = "h-9 text-sm";
    const redValueCls = "h-9 text-sm font-bold text-red-600 bg-transparent border-0 border-b border-slate-200 rounded-none px-1 focus-visible:ring-0 focus-visible:border-primary";

    return (
        <div className="flex flex-col min-h-screen bg-[#f8f9fa]">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
                <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/challans">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-primary/10">
                                <ArrowLeft className="h-5 w-5 text-primary" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Challan Entry</h1>
                            <p className="text-xs text-muted-foreground font-medium">
                                Last Challan No. <span className="text-primary font-bold">KC300066954</span> DATE: 10/02/2026
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="gap-2 h-9 text-sm">
                            <RotateCcw className="h-4 w-4" /> Reset
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="gap-2 h-9 shadow-lg shadow-primary/20 text-sm">
                            <Save className="h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Save Challan'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex-1 p-4 md:p-6 max-w-[1920px] mx-auto w-full">
                <Tabs defaultValue="challan-details" className="w-full">
                    <TabsList className="w-full justify-start h-10 bg-slate-100 p-1 rounded-lg mb-4">
                        <TabsTrigger value="challan-details" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            <FileText className="h-3.5 w-3.5" /> Challan Details
                        </TabsTrigger>
                        <TabsTrigger value="consignment-list" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            Consignment List
                        </TabsTrigger>
                        <TabsTrigger value="vehicle-challan-list" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            Vehicle Challan List
                        </TabsTrigger>
                    </TabsList>

                    {/* ===================== CHALLAN DETAILS TAB ===================== */}
                    <TabsContent value="challan-details">
                        <div className="space-y-5">

                            {/* Challan Type Radio Bar */}
                            <div className="flex flex-wrap gap-6 px-4 py-2 bg-card rounded-lg border shadow-sm items-center">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="challan_mode" value="MAIN" checked={challanType === 'MAIN'} onChange={() => setChallanType('MAIN')} className="accent-primary" />
                                    <span className="text-sm font-bold">Main</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="challan_mode" value="INCLUDE" checked={challanType === 'INCLUDE'} onChange={() => setChallanType('INCLUDE')} className="accent-primary" />
                                    <span className="text-sm font-bold">Include</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="challan_mode" value="FOC" checked={challanType === 'FOC'} onChange={() => setChallanType('FOC')} className="accent-primary" />
                                    <span className="text-sm font-bold">FOC</span>
                                </label>
                            </div>

                            {/* ---- SECTION 1: General Details ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Info className="h-4 w-4" /> General Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Challan Branch</Label>
                                            <Select value={originBranch} onValueChange={setOriginBranch}>
                                                <SelectTrigger className={inputCls + " bg-slate-50"}>
                                                    <SelectValue placeholder="Select Branch" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {branches.map(b => (
                                                        <SelectItem key={b.code} value={b.code}>{b.code} - {b.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Challan Type</Label>
                                            <Select value={subType} onValueChange={setSubType}>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Route">1 - Route</SelectItem>
                                                    <SelectItem value="Local">2 - Local</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Challan Date & Time</Label>
                                            <div className="flex gap-2">
                                                <Input type="date" className={inputCls + " flex-1"} value={challanDate} onChange={(e) => setChallanDate(e.target.value)} />
                                                <Input type="time" className={inputCls + " w-28"} value={challanTime} onChange={(e) => setChallanTime(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Challan No</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground select-none">{challanPrefix}</span>
                                                <Input className={inputCls + " pl-10 font-mono font-bold bg-yellow-50/60 border-yellow-200"} value={challanNo} onChange={(e) => setChallanNo(e.target.value)} placeholder="Auto Generated" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Owner Type</Label>
                                            <Select value={ownerType} onValueChange={setOwnerType}>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select Owner Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Market">1 - Market</SelectItem>
                                                    <SelectItem value="ARC">2 - ARC</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Vehicle No</Label>
                                            <div className="flex gap-2">
                                                <Input className={inputCls + " flex-1 uppercase"} value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="AUTO EXTENDER VEHICLE NO." />
                                                <Button type="button" variant="outline" className="h-9 text-xs bg-slate-100 font-bold px-3">FLEET CODE</Button>
                                            </div>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Destination Branch</Label>
                                            <Select value={destBranch} onValueChange={setDestBranch}>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="DESTINATION BRANCH" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {branches.map(b => (
                                                        <SelectItem key={b.code} value={b.code}>{b.code} - {b.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1 flex items-end gap-3">
                                            <div className="space-y-1 flex-1">
                                                <Label className={labelCls}>On Schedule Route?</Label>
                                                <div className="flex items-center gap-2 h-9">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant={onScheduleRoute ? "default" : "outline"}
                                                        className={`h-7 px-4 text-xs font-bold ${onScheduleRoute ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                                        onClick={() => setOnScheduleRoute(true)}
                                                    >Yes</Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant={!onScheduleRoute ? "destructive" : "outline"}
                                                        className="h-7 px-4 text-xs font-bold"
                                                        onClick={() => setOnScheduleRoute(false)}
                                                    >No</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 2: Challan Lane Details ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <MapPin className="h-4 w-4" /> Challan Lane Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Loading Side */}
                                        <div className="space-y-4 border rounded-md p-4 bg-slate-50/50">
                                            <div className="flex items-center gap-4">
                                                <Label className={labelCls + " min-w-[80px]"}>Loading At</Label>
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input type="radio" name="loading_at" value="arc" checked={loadingAt === 'arc'} onChange={() => setLoadingAt('arc')} className="accent-primary" />
                                                    <span className="text-xs font-bold">ARC Godown</span>
                                                </label>
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input type="radio" name="loading_at" value="party" checked={loadingAt === 'party'} onChange={() => setLoadingAt('party')} className="accent-primary" />
                                                    <span className="text-xs font-bold">Party Godown</span>
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1 sm:col-span-2">
                                                    <Label className={labelCls}>Loading Branch</Label>
                                                    <div className="flex gap-2">
                                                        <Input className={inputCls + " w-20 bg-slate-100 font-mono font-bold"} value={originBranch} readOnly />
                                                        <Input className={inputCls + " flex-1 bg-slate-100"} value={branches.find(b => b.code === originBranch)?.name || ''} readOnly />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Pin Code</Label>
                                                    <Input className={inputCls} value={loadingPincode} onChange={(e) => setLoadingPincode(e.target.value)} placeholder="Pin Code" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Area Name</Label>
                                                    <Input className={inputCls} value={loadingArea} onChange={(e) => setLoadingArea(e.target.value)} placeholder="Area Name" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Trip Distance (KM)</Label>
                                                    <Input type="number" className={inputCls} value={tripDistance} onChange={(e) => setTripDistance(Number(e.target.value))} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Next Loading Points</Label>
                                                    <Select>
                                                        <SelectTrigger className={inputCls}>
                                                            <SelectValue placeholder="NEXT LOADING POINT" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">None</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Unloading Side */}
                                        <div className="space-y-4 border rounded-md p-4 bg-slate-50/50">
                                            <div className="flex items-center gap-4">
                                                <Label className={labelCls + " min-w-[80px]"}>Unloading At</Label>
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input type="radio" name="unloading_at" value="arc" checked={unloadingAt === 'arc'} onChange={() => setUnloadingAt('arc')} className="accent-primary" />
                                                    <span className="text-xs font-bold">ARC Godown</span>
                                                </label>
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input type="radio" name="unloading_at" value="party" checked={unloadingAt === 'party'} onChange={() => setUnloadingAt('party')} className="accent-primary" />
                                                    <span className="text-xs font-bold">Party Godown</span>
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1 sm:col-span-2">
                                                    <Label className={labelCls}>Unloading Branch</Label>
                                                    <Select value={unloadingBranch} onValueChange={setUnloadingBranch}>
                                                        <SelectTrigger className={inputCls}>
                                                            <SelectValue placeholder="UNLOADING BRANCH" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {branches.map(b => (
                                                                <SelectItem key={b.code} value={b.code}>{b.code} - {b.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Pin Code</Label>
                                                    <Input className={inputCls} value={unloadingPincode} onChange={(e) => setUnloadingPincode(e.target.value)} placeholder="PIN CODE" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Area Name</Label>
                                                    <Input className={inputCls} value={unloadingArea} onChange={(e) => setUnloadingArea(e.target.value)} placeholder="Area Name" />
                                                </div>
                                                <div className="space-y-1 sm:col-span-2">
                                                    <Label className={labelCls}>Expected Trip Complete Date & Time</Label>
                                                    <div className="flex gap-2">
                                                        <Input type="date" className={inputCls + " flex-1"} value={expectedTripDate} onChange={(e) => setExpectedTripDate(e.target.value)} />
                                                        <Input type="time" className={inputCls + " w-28"} value={expectedTripTime} onChange={(e) => setExpectedTripTime(e.target.value)} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 3: Broker & Owner Information ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Users className="h-4 w-4" /> Broker & Owner Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Broker Side */}
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Broker / Owner Name</Label>
                                                    <Input className={inputCls} value={brokerName} onChange={(e) => setBrokerName(e.target.value)} placeholder="Engaged Broker/Owner Name" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Broker Code / Phone</Label>
                                                    <div className="flex gap-2">
                                                        <Input className={inputCls + " w-24"} value={brokerCode} onChange={(e) => setBrokerCode(e.target.value)} placeholder="CODE" />
                                                        <Input className={inputCls + " flex-1"} value={brokerMobile} onChange={(e) => setBrokerMobile(e.target.value)} placeholder="Phone Number" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1 sm:col-span-2">
                                                    <Label className={labelCls}>Address</Label>
                                                    <Input className={inputCls} value={brokerAddress} onChange={(e) => setBrokerAddress(e.target.value)} placeholder="Full Address" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Owner Side */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-4">
                                                <Label className={labelCls + " min-w-[120px]"}>Engaged Through Owner</Label>
                                                <Checkbox checked={engagedThroughOwner} onCheckedChange={(checked) => setEngagedThroughOwner(!!checked)} id="engaged_owner" />
                                                <Label htmlFor="engaged_owner" className="text-xs font-bold cursor-pointer">Yes</Label>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Owner Name / Mobile</Label>
                                                    <div className="flex gap-2">
                                                        <Input className={inputCls + " flex-1"} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner Name" />
                                                        <Input className={inputCls + " w-32"} value={ownerMobile} onChange={(e) => setOwnerMobile(e.target.value)} placeholder="Mobile No" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>PAN No / Tel No</Label>
                                                    <div className="flex gap-2">
                                                        <Input className={inputCls + " flex-1 uppercase"} value={ownerPan} onChange={(e) => setOwnerPan(e.target.value)} placeholder="PAN NO." />
                                                        <Input className={inputCls + " w-32"} value={ownerTel} onChange={(e) => setOwnerTel(e.target.value)} placeholder="TEL NO." />
                                                    </div>
                                                </div>
                                                <div className="space-y-1 sm:col-span-2">
                                                    <Label className={labelCls}>Address</Label>
                                                    <Input className={inputCls} value={ownerAddress} onChange={(e) => setOwnerAddress(e.target.value)} placeholder="Owner Address" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Owner Slip No.</Label>
                                                    <Input className={inputCls} value={slipNo} onChange={(e) => setSlipNo(e.target.value)} placeholder="Slip No" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Slip Date</Label>
                                                    <Input type="date" className={inputCls} value={slipDate} onChange={(e) => setSlipDate(e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 4: Vehicle Information ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Truck className="h-4 w-4" /> Vehicle Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Vehicle Type</Label>
                                            <Select value={vehicleType} onValueChange={setVehicleType}>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="open">Open Body</SelectItem>
                                                    <SelectItem value="container">Container</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Permit No</Label>
                                            <Input className={inputCls} value={permitNo} onChange={(e) => setPermitNo(e.target.value)} placeholder="Permit No" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Permit Validity</Label>
                                            <Input type="date" className={inputCls} value={permitValidity} onChange={(e) => setPermitValidity(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Vehicle Make</Label>
                                            <Select value={vehicleMake} onValueChange={setVehicleMake}>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select Make" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="tata">TATA MOTORS</SelectItem>
                                                    <SelectItem value="ashok">ASHOK LEYLAND</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Engine No</Label>
                                            <Input className={inputCls} value={engineNo} onChange={(e) => setEngineNo(e.target.value)} placeholder="Engine No" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Chasis No</Label>
                                            <Input className={inputCls} value={chasisNo} onChange={(e) => setChasisNo(e.target.value)} placeholder="Chasis No" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Tax Token No</Label>
                                            <Input className={inputCls} value={taxTokenNo} onChange={(e) => setTaxTokenNo(e.target.value)} placeholder="Tax Token No" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Tax Token Validity</Label>
                                            <Input type="date" className={inputCls} value={taxTokenValidity} onChange={(e) => setTaxTokenValidity(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Tax Token Issued By</Label>
                                            <Input className={inputCls} value={taxTokenIssuedBy} onChange={(e) => setTaxTokenIssuedBy(e.target.value)} placeholder="Issued By" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Vehicle Model</Label>
                                            <Select value={vehicleModel} onValueChange={setVehicleModel}>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select Model" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="lpt">LPT 1613</SelectItem>
                                                    <SelectItem value="lpk">LPK 2518</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 5: Insurance & eWaybill ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Shield className="h-4 w-4" /> Insurance & eWaybill Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Policy No & Valid Date</Label>
                                            <div className="flex gap-2">
                                                <Input className={inputCls + " flex-1"} placeholder="Policy No" value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} />
                                                <Input type="date" className={inputCls + " w-36"} value={policyValidity} onChange={(e) => setPolicyValidity(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Ins Company Name & City</Label>
                                            <Select value={insCompany} onValueChange={setInsCompany}>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select Insurance Company" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="lic">LIC</SelectItem>
                                                    <SelectItem value="bajaj">BAJAJ ALLIANZ</SelectItem>
                                                    <SelectItem value="icici">ICICI LOMBARD</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Insurance City</Label>
                                            <Select value={insCity} onValueChange={setInsCity}>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Insurance City" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="goa">GOA</SelectItem>
                                                    <SelectItem value="mumbai">MUMBAI</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Finance Detail</Label>
                                            <Input className={inputCls} placeholder="Finance Detail" value={financeDetail} onChange={(e) => setFinanceDetail(e.target.value)} />
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Cons. eWaybill No & Date</Label>
                                            <div className="flex gap-2">
                                                <Input className={inputCls + " flex-1"} placeholder="eWaybill No" value={ewaybillNo} onChange={(e) => setEwaybillNo(e.target.value)} />
                                                <Input type="date" className={inputCls + " w-36"} value={ewaybillDate} onChange={(e) => setEwaybillDate(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 6: Driver Details ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Users className="h-4 w-4" /> Driver Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Driver DL No</Label>
                                            <Input className={inputCls} value={driverDlNo} onChange={(e) => setDriverDlNo(e.target.value)} placeholder="DL No" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Driver Name</Label>
                                            <Input className={inputCls} value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver Name" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>DL Validity Date</Label>
                                            <Input type="date" className={inputCls} value={driverDlValidity} onChange={(e) => setDriverDlValidity(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Driver Mobile</Label>
                                            <Input className={inputCls} value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} placeholder="Driver Mobile" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Driver RTO State</Label>
                                            <Select value={driverRto} onValueChange={setDriverRto}>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="RTO State" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="goa">GOA</SelectItem>
                                                    <SelectItem value="maharashtra">MAHARASHTRA</SelectItem>
                                                    <SelectItem value="karnataka">KARNATAKA</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-end pb-1 h-9 space-y-1">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <Checkbox checked={tripTracking} onCheckedChange={(checked) => setTripTracking(!!checked)} />
                                                <span className="text-xs font-bold text-slate-700">Trip Tracking Consent?</span>
                                            </label>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 7: Owner ITDS 194C Declaration ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-yellow-50 py-3 px-6 border-b border-yellow-200">
                                    <CardTitle className="text-sm font-bold text-red-700">
                                        Owner ITDS 194C Declaration Information
                                    </CardTitle>
                                    <p className="text-xs text-green-700 font-bold mt-1">
                                        Ref. Branch:&lt;&lt; Branch Code & Name&gt;&gt; Declare Date:&lt;&lt; Date &gt;&gt; Fin Year : &lt;&lt; Declare Year &gt;&gt;
                                    </p>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6 bg-yellow-50/30">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Ref Branch</Label>
                                            <Input className={inputCls + " bg-white"} placeholder="Branch Code & Name" value={itdsRefBranch} onChange={(e) => setItdsRefBranch(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Declare Date</Label>
                                            <Input type="date" className={inputCls + " bg-white"} value={itdsDeclareDate} onChange={(e) => setItdsDeclareDate(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Financial Year</Label>
                                            <Input className={inputCls + " bg-white"} placeholder="2025-2026" value={itdsFinYear} onChange={(e) => setItdsFinYear(e.target.value)} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 8: Hire Details ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <CreditCard className="h-4 w-4" /> Hire Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-4">
                                        {/* Column 1: Quantities */}
                                        <div className="lg:col-span-2 space-y-3">
                                            <div className="space-y-1">
                                                <Label className={labelCls}>No Of CNs</Label>
                                                <Input type="number" className={inputCls} defaultValue="1"
                                                    onChange={(e) => updateHire('noOfCns', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>No Of Package</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('noOfPackage', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Actual Weight (KG)</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('actualWeight', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Charge Weight (KG)</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('chargeWeight', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Vehicle Capacity (KG)</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('vehicleCapacity', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>No Of Loading Points</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('noOfLoadingPoints', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>No Of Unloading Points</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('noOfUnloadingPoints', Number(e.target.value))} />
                                            </div>
                                        </div>

                                        {/* Column 2: Rate / Extras */}
                                        <div className="lg:col-span-2 space-y-3">
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Rate / KG (Rs.)</Label>
                                                <Input type="number" className={redValueCls} value={hireDetails.ratePerKg}
                                                    onChange={(e) => updateHire('ratePerKg', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Hire (Rs.)</Label>
                                                <Input type="number" className={redValueCls} value={hireDetails.hire}
                                                    onChange={(e) => updateHire('hire', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Extra: Over weight (Rs.)</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('extraOverWeight', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Over Length (Rs.)</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('overLength', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Over Height (Rs.)</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('overHeight', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Over Width (Rs.)</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('overWidth', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Extra KM Charges (Rs.)</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('extraKmCharges', Number(e.target.value))} />
                                            </div>
                                        </div>

                                        {/* Column 3: Charges / Totals */}
                                        <div className="lg:col-span-2 space-y-3">
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Detent Charges (Rs.)</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('detentCharges', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Transit Pass (Rs.)</Label>
                                                <Input type="number" className={inputCls} defaultValue="0"
                                                    onChange={(e) => updateHire('transitPass', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Total Extra (Rs.)</Label>
                                                <div className={redValueCls + " flex items-center"}>{hireDetails.totalExtra.toFixed(0)}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Total Hire (Rs.)</Label>
                                                <div className={redValueCls + " flex items-center"}>{hireDetails.totalHire.toFixed(0)}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Adv Payment (Rs.)</Label>
                                                <Input type="number" className={redValueCls} value={hireDetails.advPayment}
                                                    onChange={(e) => updateHire('advPayment', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>TDS % & Less TDS</Label>
                                                <div className="flex gap-2 items-center">
                                                    <Input type="number" className={inputCls + " w-16"} defaultValue="0"
                                                        onChange={(e) => updateHire('tdsPercent', Number(e.target.value))} />
                                                    <span className="text-xs font-bold text-muted-foreground">%</span>
                                                    <div className="h-9 px-2 flex items-center text-sm font-bold text-red-600 flex-1">{hireDetails.lessTds}</div>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Petro Card Branch</Label>
                                                <Select value={hireDetails.petroCardBranch} onValueChange={(v) => updateHire('petroCardBranch', v)}>
                                                    <SelectTrigger className={inputCls}>
                                                        <SelectValue placeholder="Petro card Branch" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">None</SelectItem>
                                                        {branches.map(b => (
                                                            <SelectItem key={b.code} value={b.code}>{b.code} - {b.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Column 4: Card / Balance */}
                                        <div className="lg:col-span-2 space-y-3">
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Credit Date</Label>
                                                <Input type="date" className={inputCls} value={hireDetails.creditDate} onChange={(e) => updateHire('creditDate', e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Card Amount (Rs.)</Label>
                                                <Input type="number" className={redValueCls} value={hireDetails.cardAmount} onChange={(e) => updateHire('cardAmount', Number(e.target.value))} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Generic No</Label>
                                                <Input className={inputCls} value={hireDetails.genericNo} onChange={(e) => updateHire('genericNo', e.target.value)} placeholder="Generic No" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Card No</Label>
                                                <Input className={inputCls} value={hireDetails.cardNo} onChange={(e) => updateHire('cardNo', e.target.value)} placeholder="Card No" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Bal Amount (Rs.)</Label>
                                                <div className={redValueCls + " flex items-center font-bold text-lg"}>{hireDetails.balAmount.toFixed(0)}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Bal Payment Branch</Label>
                                                <Select value={hireDetails.balPaymentBranch} onValueChange={(v) => updateHire('balPaymentBranch', v)}>
                                                    <SelectTrigger className={inputCls}>
                                                        <SelectValue placeholder="LBH BRANCH" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {branches.map(b => (
                                                            <SelectItem key={b.code} value={b.code}>{b.code} - {b.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 9: Other Information ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Info className="h-4 w-4" /> Other Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Engaged By</Label>
                                            <Select value={engagedBy} onValueChange={setEngagedBy}>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select Employee" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="emp1">AMIT PANDEY [A8644]</SelectItem>
                                                    <SelectItem value="emp2">RAHUL SHARMA [R1234]</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Engaged Date</Label>
                                            <Input type="date" className={inputCls} value={engagedDate} onChange={(e) => setEngagedDate(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Remarks</Label>
                                            <Input className={inputCls} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Bottom Action Bar */}
                            <div className="flex justify-end gap-3 py-4">
                                <Button type="button" variant="outline" onClick={() => router.back()} className="min-w-[100px]">Cancel</Button>
                                <Button type="button" variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" /> Reset</Button>
                                <Button onClick={handleSave} disabled={isSubmitting} className="gap-2 min-w-[140px] shadow-lg shadow-primary/20">
                                    <Save className="h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Save Challan'}
                                </Button>
                            </div>

                        </div>
                    </TabsContent>

                    {/* ===================== CONSIGNMENT LIST TAB ===================== */}
                    <TabsContent value="consignment-list">
                        <Card className="border-none shadow-md bg-white">
                            <CardContent className="p-6">
                                <p className="text-sm text-muted-foreground">Consignment list will appear here after saving the challan.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ===================== VEHICLE CHALLAN LIST TAB ===================== */}
                    <TabsContent value="vehicle-challan-list">
                        <Card className="border-none shadow-md bg-white">
                            <CardContent className="p-6">
                                <p className="text-sm text-muted-foreground">Vehicle challan list will appear here after saving the challan.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
            </div>
        </div>
    );
}
