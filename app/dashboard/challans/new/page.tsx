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
        setIsSubmitting(true);
        try {
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
                                            <Select>
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
                                            <Select defaultValue="1">
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">1 - Route</SelectItem>
                                                    <SelectItem value="2">2 - Local</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Challan Date & Time</Label>
                                            <div className="flex gap-2">
                                                <Input type="date" className={inputCls + " flex-1"} defaultValue="2026-02-10" />
                                                <Input type="time" className={inputCls + " w-28"} defaultValue="15:39" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Challan No</Label>
                                            <Input className={inputCls + " font-mono font-bold bg-yellow-50/60 border-yellow-200"} placeholder="Auto Generated" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Owner Type</Label>
                                            <Select defaultValue="MARKET">
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select Owner Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MARKET">1 - Market</SelectItem>
                                                    <SelectItem value="ARC">2 - ARC</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Vehicle No</Label>
                                            <div className="flex gap-2">
                                                <Input className={inputCls + " flex-1 uppercase"} placeholder="AUTO EXTENDER VEHICLE NO." />
                                                <Button type="button" variant="outline" className="h-9 text-xs bg-slate-100 font-bold px-3">FLEET CODE</Button>
                                            </div>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Destination Branch</Label>
                                            <Select>
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
                                                        <Input className={inputCls + " w-20 bg-slate-100 font-mono font-bold"} placeholder="CODE" readOnly />
                                                        <Input className={inputCls + " flex-1 bg-slate-100"} placeholder="BRANCH NAME" readOnly />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Pin Code</Label>
                                                    <Input className={inputCls} placeholder="Pin Code" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Area Name</Label>
                                                    <Select>
                                                        <SelectTrigger className={inputCls}>
                                                            <SelectValue placeholder="Select Area" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="verna">VERNA GOA</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Trip Distance (KM)</Label>
                                                    <Input type="number" className={inputCls} defaultValue="0" />
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
                                                    <div className="flex gap-2">
                                                        <Input className={inputCls + " w-20 font-mono font-bold"} placeholder="CODE" />
                                                        <Input className={inputCls + " flex-1"} placeholder="UNLOADING BRANCH" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Pin Code</Label>
                                                    <Input className={inputCls} placeholder="PIN CODE" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Area Name</Label>
                                                    <Select>
                                                        <SelectTrigger className={inputCls}>
                                                            <SelectValue placeholder="UNLOADING AREA NAME" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Select Area</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1 sm:col-span-2">
                                                    <Label className={labelCls}>Expected Trip Complete Date & Time</Label>
                                                    <div className="flex gap-2">
                                                        <Input type="date" className={inputCls + " flex-1"} />
                                                        <Input type="time" className={inputCls + " w-28"} />
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
                                        {/* Owner Side */}
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Owner PAN No</Label>
                                                    <Input className={inputCls + " uppercase"} placeholder="PAN Number" />
                                                </div>
                                                <div className="flex items-end pb-1">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <Checkbox checked={engagedThroughOwner} onCheckedChange={(c) => setEngagedThroughOwner(!!c)} />
                                                        <span className="text-xs font-bold text-green-700">Engaged through Owner</span>
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Owner Name</Label>
                                                <Input className={inputCls} placeholder="AUTO EXTENDER OWNER NAME" />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Owner Mobile No</Label>
                                                    <Input className={inputCls} placeholder="Mobile" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Tel. No</Label>
                                                    <Input className={inputCls} placeholder="Telephone" />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Owner Address</Label>
                                                <Input className={inputCls} placeholder="Address" />
                                            </div>
                                        </div>

                                        {/* Broker Side */}
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Broker Name</Label>
                                                <Input className={inputCls} placeholder="AUTO EXTENDER BROKER NAME" />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Broker Code & Mobile</Label>
                                                    <div className="flex gap-2">
                                                        <Input className={inputCls + " w-24 bg-yellow-50/60"} placeholder="Code" />
                                                        <Input className={inputCls + " flex-1"} placeholder="Mobile" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Broker Address</Label>
                                                <Input className={inputCls} placeholder="Broker Address" />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                                                <div className="flex items-center gap-2 h-9">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <Checkbox checked={slipAttached} onCheckedChange={(c) => setSlipAttached(!!c)} />
                                                        <span className="text-xs font-bold">Slip Attached?</span>
                                                    </label>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Slip No & Date</Label>
                                                    <div className="flex gap-2">
                                                        <Input className={inputCls + " flex-1"} placeholder="SLIP NO" />
                                                        <Input type="date" className={inputCls + " w-36"} />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Slip File</Label>
                                                    <Input type="file" className="h-9 text-xs file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary" />
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
                                            <Label className={labelCls}>Vehicle No</Label>
                                            <Input className={inputCls + " uppercase font-bold bg-yellow-50/60 border-yellow-200"} placeholder="Vehicle No" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Vehicle Type</Label>
                                            <Select>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="SELECT VEH TYPE" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="open">Open Body</SelectItem>
                                                    <SelectItem value="closed">Closed Container</SelectItem>
                                                    <SelectItem value="trailer">Trailer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Permit No & Validity</Label>
                                            <div className="flex gap-2">
                                                <Input className={inputCls + " flex-1"} placeholder="Permit No" />
                                                <Input type="date" className={inputCls + " w-36"} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Make</Label>
                                            <Select>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="SELECT VEH MAKE" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="tata">TATA</SelectItem>
                                                    <SelectItem value="ashok">ASHOK LEYLAND</SelectItem>
                                                    <SelectItem value="eicher">EICHER</SelectItem>
                                                    <SelectItem value="mahindra">MAHINDRA</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Engine No</Label>
                                            <Input className={inputCls} placeholder="Engine No" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Tax Token No/Valid</Label>
                                            <div className="flex gap-2">
                                                <Input className={inputCls + " flex-1"} placeholder="Token No" />
                                                <Input type="date" className={inputCls + " w-36"} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Token Issued By</Label>
                                            <Input className={inputCls} placeholder="Token Issued By" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Model</Label>
                                            <Select>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="VEHICLE MODEL" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="lpt">LPT 1109</SelectItem>
                                                    <SelectItem value="eicher-pro">EICHER PRO</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Chasis No</Label>
                                            <Input className={inputCls} placeholder="Chasis No" />
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
                                                <Input className={inputCls + " flex-1"} placeholder="Policy No" />
                                                <Input type="date" className={inputCls + " w-36"} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Ins Company Name & City</Label>
                                            <Select>
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
                                            <Select>
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
                                            <Input className={inputCls} placeholder="Finance Detail" />
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Cons. eWaybill No & Date</Label>
                                            <div className="flex gap-2">
                                                <Input className={inputCls + " flex-1"} placeholder="eWaybill No" />
                                                <Input type="date" className={inputCls + " w-36"} />
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
                                            <div className="relative">
                                                <Input className={inputCls + " pr-9 bg-slate-100 font-mono"} placeholder="DL NUMBER" />
                                                <Button type="button" size="icon" variant="ghost" className="absolute right-0 top-0 h-9 w-9 text-primary hover:bg-primary/10">
                                                    <Search className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Driver Name</Label>
                                            <Input className={inputCls} placeholder="Driver Name" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>DL Valid Upto</Label>
                                            <Input type="date" className={inputCls} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Mobile No</Label>
                                            <div className="relative">
                                                <Input className={inputCls + " pr-9"} placeholder="Mobile Number" />
                                                <Button type="button" size="icon" variant="ghost" className="absolute right-0 top-0 h-9 w-9 text-primary hover:bg-primary/10">
                                                    <Search className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>DL Issued By (RTO)</Label>
                                            <Select>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select RTO Name" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="goa">GOA RTO</SelectItem>
                                                    <SelectItem value="mumbai">MUMBAI RTO</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-end pb-1">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <Checkbox checked={tripTracking} onCheckedChange={(c) => setTripTracking(!!c)} />
                                                <span className="text-xs font-bold">Take Consent For Trip Tracking</span>
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
                                            <Input className={inputCls + " bg-white"} placeholder="Branch Code & Name" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Declare Date</Label>
                                            <Input type="date" className={inputCls + " bg-white"} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Financial Year</Label>
                                            <Input className={inputCls + " bg-white"} placeholder="2025-2026" />
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
                                                <Select>
                                                    <SelectTrigger className={inputCls}>
                                                        <SelectValue placeholder="Petro card Branch" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">None</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Column 4: Card / Balance */}
                                        <div className="lg:col-span-2 space-y-3">
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Credit Date</Label>
                                                <Input type="date" className={inputCls} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Card Amount (Rs.)</Label>
                                                <div className={redValueCls + " flex items-center"}>{hireDetails.cardAmount}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Generic No</Label>
                                                <Input className={inputCls} placeholder="Generic No" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Card No</Label>
                                                <Input className={inputCls} placeholder="Card No" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Bal Amount (Rs.)</Label>
                                                <div className={redValueCls + " flex items-center font-bold text-lg"}>{hireDetails.balAmount.toFixed(0)}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Bal Payment Branch</Label>
                                                <Select>
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
                                            <Select>
                                                <SelectTrigger className={inputCls}>
                                                    <SelectValue placeholder="Select Employee" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="emp1">AMIT PANDEY [A8644]</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Engaged Date</Label>
                                            <Input type="date" className={inputCls} defaultValue="2026-02-10" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Remarks</Label>
                                            <Input className={inputCls} placeholder="Remarks" />
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
