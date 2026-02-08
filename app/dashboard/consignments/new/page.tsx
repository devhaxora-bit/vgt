'use client';

import React, { useState } from 'react';
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

import { PartyAutocomplete } from "@/components/PartyAutocomplete";
import { AddPartyDialog } from "@/components/AddPartyDialog";
import { Party, PartyType } from "@/lib/types/party.types";

interface PackageItem {
    id: string;
    method: string;
    qty: number;
}

export default function NewConsignmentPage() {
    const [isOwnersRisk, setIsOwnersRisk] = useState(true);
    const [isCancelCn, setIsCancelCn] = useState(false);
    const [consignor, setConsignor] = useState<Party | null>(null);
    const [consignee, setConsignee] = useState<Party | null>(null);
    const [billingParty, setBillingParty] = useState<Party | null>(null);
    const [billingBranch, setBillingBranch] = useState("mrg");

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
    const [freightRate, setFreightRate] = useState("");
    const [chargedWeight, setChargedWeight] = useState("");

    // Freight Charges
    const [charges, setCharges] = useState({
        unload: "",
        retention: "",
        extraKm: "",
        mhc: "",
        doorColl: "",
        doorDel: "",
        other: ""
    });

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
        const rate = parseFloat(freightRate) || 0;
        const weight = parseFloat(chargedWeight) || 0;
        const basic = rate * weight;

        const extra = Object.values(charges).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        return basic + extra;
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
                                Last entered: <span className="text-primary">S801191</span> on 17/01/2026
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="gap-2 h-9">
                            <RotateCcw className="h-4 w-4" /> Reset Form
                        </Button>
                        <Button className="gap-2 h-9 shadow-lg shadow-primary/20">
                            <Save className="h-4 w-4" /> Save Consignment
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
                                <Label htmlFor="owners-risk" className="text-sm font-bold cursor-pointer">Owner's Risk</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="door-collection" />
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
                                        <Select defaultValue="mrg">
                                            <SelectTrigger className="h-9 bg-slate-50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="mrg">MRG - VERNA GOA</SelectItem>
                                                <SelectItem value="pnj">PNJ - PANAJI</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1 lg:col-span-2">
                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">CN No & Date</Label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground select-none">S</span>
                                                <Input className="pl-6 h-9 font-mono font-bold" defaultValue="801191" />
                                            </div>
                                            <Input type="text" className="w-32 h-9 text-center" defaultValue="19/01/2026" />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">Delivery Type</Label>
                                        <Select>
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
                                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">Distance</Label>
                                        <div className="flex gap-2">
                                            <Input placeholder="Distance in KM" className="w-full h-9 bg-yellow-50/50" />
                                        </div>
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

                        {/* Section 3: Billing Details (Moved out of tabs) */}
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
                                        <Select>
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
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Bill For (Branch)</Label>
                                        <Select value={billingBranch} onValueChange={setBillingBranch}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select Branch" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="mrg">MRG - MARGAO</SelectItem>
                                                <SelectItem value="pnj">PNJ - PANAJI</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Code Station Name</Label>
                                        <Input className="h-9 bg-slate-50 font-bold" value={billingBranch.toUpperCase()} readOnly />
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Billing Party</Label>
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
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Party Code</Label>
                                        <Input className="h-9 bg-yellow-50/30" value={billingParty?.code || ''} readOnly />
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Billing Party GST</Label>
                                        <Input className="h-9 font-mono bg-yellow-50/30" value={billingParty?.gstin || ''} readOnly />
                                    </div>

                                    <div className="space-y-1 lg:col-span-2">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Address</Label>
                                        <Input className="h-9 bg-yellow-50/30" value={billingParty?.address || ''} readOnly />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>


                        {/* Section 4: Secondary Tabs */}
                        <Tabs defaultValue="package" className="w-full">
                            <TabsList className="w-full justify-start h-10 bg-slate-100 p-1 rounded-lg">
                                <TabsTrigger value="package" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <Package className="h-3.5 w-3.5" /> Package & Goods
                                </TabsTrigger>
                                <TabsTrigger value="insurance" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <Truck className="h-3.5 w-3.5" /> Insurance & PO
                                </TabsTrigger>
                                <TabsTrigger value="invoice" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                    <ChevronRight className="h-3.5 w-3.5" /> Invoice & Others
                                </TabsTrigger>
                            </TabsList>

                            <div className="mt-4">
                                <TabsContent value="package">
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
                                                        <Input type="number" className="h-8 text-xs" disabled={isLoose} value={currentPackageQty} onChange={(e) => setCurrentPackageQty(e.target.value)} />
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
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Total Packages</Label>
                                                        <Input className="h-8 text-xs font-bold bg-slate-50" readOnly value={packages.length} />
                                                    </div>
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
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Goods Class</Label>
                                                        <Select>
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="Select Class" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="general">General Goods</SelectItem>
                                                                <SelectItem value="hazardous">Hazardous</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Value Of Goods</Label>
                                                        <Input className="h-8 text-xs" />
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-muted-foreground">Goods Description</Label>
                                                    <Input className="h-8 text-xs" />
                                                </div>

                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="col-span-2 space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">HSN Description</Label>
                                                        <Input className="h-8 text-xs" placeholder="AUTO EXTENDER" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">COD Amount</Label>
                                                        <Input className="h-8 text-xs bg-yellow-50/50" />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Actual Weight (kg)</Label>
                                                        <Input className="h-8 text-xs" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Load Unit</Label>
                                                        <Select>
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="Unit" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="mt">MT</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-4 gap-2">
                                                    <div className="col-span-2 space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">L x W x H (inch)</Label>
                                                        <div className="flex gap-1">
                                                            <Input className="h-8 text-xs px-1 text-center" placeholder="L" />
                                                            <Input className="h-8 text-xs px-1 text-center" placeholder="W" />
                                                            <Input className="h-8 text-xs px-1 text-center" placeholder="H" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Charged Wt</Label>
                                                        <Input className="h-8 text-xs bg-yellow-50/50" value={chargedWeight} onChange={(e) => setChargedWeight(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Volume</Label>
                                                        <Input className="h-8 text-xs bg-yellow-50/50" />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Private Mark</Label>
                                                        <Input className="h-8 text-xs" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
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
                                                        <Input className="h-8 text-xs" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Invoice Date</Label>
                                                        <Input className="h-8 text-xs" placeholder="DD/MM/YYYY" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Invoice Amt</Label>
                                                        <Input className="h-8 text-xs" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Indent No</Label>
                                                        <Input className="h-8 text-xs" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Indent Date</Label>
                                                        <Input className="h-8 text-xs" placeholder="DD/MM/YYYY" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">eWay Bill</Label>
                                                        <Input className="h-8 text-xs" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">eWay From Date</Label>
                                                        <Input className="h-8 text-xs" placeholder="DD/MM/YYYY" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">eWay To Date</Label>
                                                        <Input className="h-8 text-xs" placeholder="DD/MM/YYYY" />
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
                                            <div className="flex flex-col space-y-2">
                                                <div className="flex items-center space-x-2 pb-2">
                                                    <Checkbox id="freight-pending" checked={isFreightPending} onCheckedChange={(c) => setIsFreightPending(!!c)} />
                                                    <Label htmlFor="freight-pending" className="text-xs font-bold cursor-pointer">Freight Pending</Label>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-4">
                                                <Label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">Rate</Label>
                                                <Input
                                                    type="text"
                                                    className="h-7 w-28 text-right font-mono text-xs"
                                                    disabled={isFreightPending}
                                                    value={isFreightPending ? "0" : freightRate}
                                                    onChange={(e) => setFreightRate(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <Label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">Basic Freight</Label>
                                                <Input
                                                    type="text"
                                                    className="h-7 w-28 text-right font-mono text-xs bg-primary/5 border-primary/20 font-bold"
                                                    value={isFreightPending ? "0.00" : (parseFloat(freightRate || "0") * parseFloat(chargedWeight || "0")).toFixed(2)}
                                                    readOnly
                                                />
                                            </div>

                                            {[
                                                { key: 'unload', label: "Unload Charges" },
                                                { key: 'retention', label: "Retention Charges" },
                                                { key: 'extraKm', label: "Extra KM Charges" },
                                                { key: 'mhc', label: "MHC Charges" },
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
                                                <Input className="h-9 text-right font-mono font-bold" placeholder="0.00" />
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

                            <Button className="w-full h-12 text-lg font-bold shadow-xl shadow-primary/20">
                                <Save className="mr-2" /> Finalize Booking
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
