'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    Search,
    Calendar as CalendarIcon,
    FileDown,
    Plus,
    RotateCcw,
    Filter,
    MoreHorizontal,
    ArrowUpDown,
    Download,
    Building2,
    Package,
    Truck,
    Hash
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import consignmentsData from '@/lib/data/consignments.json';
import { ConsignmentDetailsDialog } from '@/components/features/consignments/ConsignmentDetailsDialog';

export default function ConsignmentsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [cnNoFilter, setCnNoFilter] = useState('');
    const [selectedConsignment, setSelectedConsignment] = useState<any>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // New Filters from Image
    const [bkgBranch, setBkgBranch] = useState<string>('all');
    const [deliveryBranch, setDeliveryBranch] = useState<string>('all');
    const [bookingType, setBookingType] = useState<string>('all');
    const [deliveryType, setDeliveryType] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date('2026-01-17'));
    const [dateTo, setDateTo] = useState<Date | undefined>(new Date('2026-01-19'));

    // Applied Filters State (updates only on Search click)
    const [appliedFilters, setAppliedFilters] = useState({
        cnNo: '',
        bkgBranch: 'all',
        deliveryBranch: 'all',
        bookingType: 'all',
        deliveryType: 'all',
        dateFrom: new Date('2026-01-17'),
        dateTo: new Date('2026-01-19')
    });

    // Filtering logic
    const filteredData = useMemo(() => {
        return consignmentsData.filter(item => {
            // Table Search (Live)
            const matchesSearch =
                item.cn_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.dest_branch.toLowerCase().includes(searchTerm.toLowerCase());

            // Form Filters (Applied on Click)
            const { cnNo, bkgBranch: ab, deliveryBranch: ad, bookingType: at, deliveryType: adt, dateFrom: df, dateTo: dt } = appliedFilters;

            const matchesCn = cnNo === '' || item.cn_no.toLowerCase().includes(cnNo.toLowerCase());
            const matchesBkgBranch = ab === 'all' || item.bkg_branch === ab;
            const matchesDestBranch = ad === 'all' || item.dest_branch.includes(ad);
            const matchesBkgBasis = at === 'all' || item.bkg_basis === at;
            const matchesDelType = adt === 'all' || item.delivery_type === adt;

            // Date Range Filter (String-based comparison to avoid timezone issues)
            const itemDateStr = item.bkg_date; // Format: "YYYY-MM-DD"
            const fromStr = df ? format(df, "yyyy-MM-dd") : null;
            const toStr = dt ? format(dt, "yyyy-MM-dd") : null;

            const matchesDateFrom = !fromStr || itemDateStr >= fromStr;
            const matchesDateTo = !toStr || itemDateStr <= toStr;

            return matchesSearch && matchesCn && matchesBkgBranch && matchesDestBranch &&
                matchesBkgBasis && matchesDelType && matchesDateFrom && matchesDateTo;
        });
    }, [searchTerm, appliedFilters]);

    const handleSearch = () => {
        setAppliedFilters({
            cnNo: cnNoFilter,
            bkgBranch: bkgBranch,
            deliveryBranch: deliveryBranch,
            bookingType: bookingType,
            deliveryType: deliveryType,
            dateFrom: dateFrom || new Date('2026-01-17'),
            dateTo: dateTo || new Date('2026-01-19')
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const resetFilters = () => {
        setSearchTerm('');
        setCnNoFilter('');
        setBkgBranch('all');
        setDeliveryBranch('all');
        setBookingType('all');
        setDeliveryType('all');
        const defaultFrom = new Date('2026-01-17');
        const defaultTo = new Date('2026-01-19');
        setDateFrom(defaultFrom);
        setDateTo(defaultTo);
        setAppliedFilters({
            cnNo: '',
            bkgBranch: 'all',
            deliveryBranch: 'all',
            bookingType: 'all',
            deliveryType: 'all',
            dateFrom: defaultFrom,
            dateTo: defaultTo
        });
    };

    return (
        <div className="p-6 space-y-6 animate-fadeIn">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">VGT Consignments</h1>
                    <p className="text-muted-foreground">Comprehensive overview of all shipment bookings</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2 shadow-sm border-primary/20 hover:bg-primary/5">
                        <Download className="h-4 w-4 text-primary" /> Export Data
                    </Button>
                    <Link href="/dashboard/consignments/new">
                        <Button className="gap-2 shadow-lg shadow-primary/20">
                            <Plus className="h-4 w-4" /> Book New CNS
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Modern Filter Card - "Search Consignment" */}
            <Card className="border shadow-lg bg-card/60 backdrop-blur-xl border-border/40 overflow-hidden">
                <div className="bg-muted/30 px-6 py-3 border-b border-border/40 flex items-center justify-between">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Search className="h-3.5 w-3.5" /> Search Consignment
                    </Label>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground hover:text-primary" onClick={resetFilters}>
                            <RotateCcw className="h-3 w-3 mr-1.5" /> Reset
                        </Button>
                        <Button size="sm" className="h-8 px-4 text-xs font-bold" onClick={handleSearch}>
                            <Search className="h-3 w-3 mr-1.5" /> Search
                        </Button>
                    </div>
                </div>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Row 1: Branch, No, Range */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground/70 tracking-tight">Booking Branch</Label>
                            <Select value={bkgBranch} onValueChange={setBkgBranch}>
                                <SelectTrigger className="bg-background/80 focus:ring-primary h-10">
                                    <SelectValue placeholder="Select Branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Branches</SelectItem>
                                    <SelectItem value="VERNA GOA">VERNA GOA</SelectItem>
                                    <SelectItem value="MRG - VERNA GOA">MRG - VERNA GOA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground/70 tracking-tight">CNs No</Label>
                            <div className="relative">
                                <div className="absolute left-0 top-0 h-full px-3 flex items-center border-r bg-muted/30 rounded-l-md pointer-events-none">
                                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <Input
                                    placeholder="Enter CN No..."
                                    className="pl-12 bg-background/80 h-10"
                                    value={cnNoFilter}
                                    onChange={(e) => setCnNoFilter(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground/70 tracking-tight">Booking Date Range</Label>
                            <div className="flex items-center gap-2 bg-background/80 rounded-md border h-10 px-3 overflow-hidden group focus-within:ring-2 focus-within:ring-primary/20">
                                <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className="text-xs focus:outline-none flex-1 text-left truncate">
                                            {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "From"}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                                    </PopoverContent>
                                </Popover>
                                <span className="text-muted-foreground/20 px-1">|</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className="text-xs focus:outline-none flex-1 text-left truncate">
                                            {dateTo ? format(dateTo, "dd/MM/yyyy") : "To"}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* Row 2: Delivery Branch, Bkg Type, Del Type */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground/70 tracking-tight">Delivery Branch</Label>
                            <Select value={deliveryBranch} onValueChange={setDeliveryBranch}>
                                <SelectTrigger className="bg-background/80 h-10">
                                    <SelectValue placeholder="Delivery Branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Branches</SelectItem>
                                    <SelectItem value="PTLG">PTLG - PATALGANGA</SelectItem>
                                    <SelectItem value="NSK">NSK - NASHIK</SelectItem>
                                    <SelectItem value="JGN">JGN - JALGAON</SelectItem>
                                    <SelectItem value="TPR">TPR - TIRUPUR</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground/70 tracking-tight">Booking Type</Label>
                            <Select value={bookingType} onValueChange={setBookingType}>
                                <SelectTrigger className="bg-background/80 h-10">
                                    <SelectValue placeholder="Booking Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="TO BE BILLED">TO BE BILLED</SelectItem>
                                    <SelectItem value="TOPAY">TOPAY</SelectItem>
                                    <SelectItem value="PAID">PAID</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground/70 tracking-tight">Delivery Type</Label>
                            <Select value={deliveryType} onValueChange={setDeliveryType}>
                                <SelectTrigger className="bg-background/80 h-10">
                                    <SelectValue placeholder="Delivery Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="DDLY-WITH CC">DDLY-WITH CC</SelectItem>
                                    <SelectItem value="GDN DLY WITH CC">GDN DLY WITH CC</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-3 pt-6 border-t border-border/30">
                        <Button className="px-8 shadow-md" size="sm" onClick={handleSearch}>
                            <Search className="h-3.5 w-3.5 mr-2" /> Search
                        </Button>
                        <Link href="/dashboard/consignments/new">
                            <Button variant="outline" className="px-8 shadow-sm border-primary/20 text-primary hover:bg-primary/5" size="sm">
                                Book New CNs [Alt+1]
                            </Button>
                        </Link>
                        <Button variant="ghost" className="px-8 text-muted-foreground hover:text-foreground" size="sm" onClick={resetFilters}>
                            <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset [Ctrl+R]
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Enhanced Table Section */}
            <Card className="border shadow-lg overflow-hidden bg-card/60 backdrop-blur-xl border-border/40">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-6">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" /> CNs List
                    </CardTitle>
                    <div className="relative w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter table content..."
                            className="pl-9 h-9 bg-background/50 border-none shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/40 backdrop-blur-sm border-b overflow-hidden">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-bold py-4">Bkg Branch</TableHead>
                                    <TableHead className="font-bold py-4">CNs No</TableHead>
                                    <TableHead className="font-bold py-4">Bkg Date</TableHead>
                                    <TableHead className="font-bold py-4">Dest Branch</TableHead>
                                    <TableHead className="font-bold py-4 text-center">No Of Pkg</TableHead>
                                    <TableHead className="font-bold py-4 text-right">Actual Weight</TableHead>
                                    <TableHead className="font-bold py-4">Delivery Type</TableHead>
                                    <TableHead className="font-bold py-4 text-right">Freight</TableHead>
                                    <TableHead className="text-right py-4"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.length > 0 ? (
                                    filteredData.map((item) => (
                                        <TableRow key={item.cn_no} className="hover:bg-primary/5 transition-colors border-b last:border-0 group">
                                            <TableCell className="text-[12px] font-medium text-muted-foreground">{item.bkg_branch}</TableCell>
                                            <TableCell>
                                                <button
                                                    onClick={() => {
                                                        setSelectedConsignment(item);
                                                        setIsDetailsOpen(true);
                                                    }}
                                                    className="font-bold text-primary hover:underline underline-offset-4 decoration-primary/30 flex items-center gap-2"
                                                >
                                                    {item.cn_no}
                                                </button>
                                            </TableCell>
                                            <TableCell className="text-xs font-medium text-foreground/80">{item.bkg_date}</TableCell>
                                            <TableCell className="text-xs font-bold text-foreground/90">{item.dest_branch}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="font-bold bg-background shadow-sm border-muted/50 text-foreground/70">
                                                    {item.no_of_pkg}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-mono font-bold text-foreground/70">
                                                {item.actual_weight.toLocaleString()} kg
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px] px-2 py-0 border-none bg-indigo-50 text-indigo-700 font-bold tracking-tight"
                                                >
                                                    {item.delivery_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-xs">
                                                {(item.total_freight || 0) > 0 ? (
                                                    <span className="bg-primary/5 px-2 py-1 rounded text-primary">₹{(item.total_freight || 0).toLocaleString()}</span>
                                                ) : (
                                                    <span className="text-muted-foreground/30">---</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                                <Package className="h-12 w-12 text-muted-foreground" />
                                                <div className="text-sm font-medium">No results found matching your criteria.</div>
                                                <Button variant="link" onClick={resetFilters} className="text-primary p-0 h-auto">Clear all filters</Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Enhanced Pagination */}
                    <div className="px-6 py-4 flex items-center justify-between border-t bg-muted/5">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                            <span>Showing <strong>{filteredData.length}</strong> of <strong>{consignmentsData.length}</strong> entries</span>
                            <div className="h-4 w-[1px] bg-border" />
                            <div className="flex items-center gap-2">
                                <span>Show</span>
                                <Select defaultValue="10">
                                    <SelectTrigger className="h-7 w-16 bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span>rows</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled className="h-8 px-4 text-xs font-bold uppercase tracking-wider">Previous</Button>
                            <div className="flex gap-1">
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-primary text-primary-foreground border-primary hover:bg-primary/90">1</Button>
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:border-primary hover:text-primary transition-colors">2</Button>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 px-4 text-xs font-bold uppercase tracking-wider hover:border-primary hover:text-primary">Next</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Details Modal */}
            <ConsignmentDetailsDialog
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                consignment={selectedConsignment}
            />
        </div>
    );
}
