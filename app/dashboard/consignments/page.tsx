'use client';

import React, { useState, useMemo, useEffect, type ComponentProps } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Search,
    Calendar as CalendarIcon,
    Plus,
    RotateCcw,
    Filter,
    MoreHorizontal,
    ArrowUpDown,
    Download,
    Package,
    Truck,
    Hash,
    Printer,
    Pencil,
    Link2,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    DollarSign,
    X,
} from 'lucide-react';
import { compareCnNo } from '@/lib/sortLinkedConsignments';
import { Button } from "@/components/ui/button";
import { createClient as createSupabaseClient } from "@/utils/supabase/client";
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
import { ConsignmentDetailsDialog } from '@/components/features/consignments/ConsignmentDetailsDialog';
import {
    ConsignmentBillCell,
    type BillPartyPreview,
    type BillRecordPreview,
} from '@/components/features/consignments/ConsignmentBillCell';
import { BillingRecordViewDialog } from '@/components/features/ledger/BillingRecordDialogs';

const BRANCH_MAP: Record<string, string> = {
    'MRG': 'MRG - VERNA GOA',
    'PNJ': 'PNJ - PANAJI',
    'PTLG': 'PTLG - PATALGANGA',
    'NSK': 'NSK - NASHIK',
    'JGN': 'JGN - JALGAON',
    'TPR': 'TPR - TIRUPUR',
};

const getFullBranchName = (code?: string, options: {value: string; label: string}[] = []) => {
    if (!code) return '---';
    const upperCode = code.toUpperCase();
    const match = options.find(o => o.value === upperCode);
    if (match) return match.label;
    return BRANCH_MAP[upperCode] || upperCode;
};

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

type ConsignmentSortField =
    | 'cn_no'
    | 'booking_branch'
    | 'bkg_date'
    | 'dest_branch'
    | 'consignor_name'
    | 'no_of_pkg'
    | 'actual_weight'
    | 'delivery_type'
    | 'bkg_basis'
    | 'total_freight';

type KpiFilter = 'none' | 'billed' | 'unbilled' | 'freight';

interface ConsignmentRow {
    id: string;
    cn_no: string;
    bkg_date?: string;
    booking_branch?: string;
    dest_branch?: string;
    delivery_point?: string;
    consignor_name?: string;
    no_of_pkg?: number;
    actual_weight?: number;
    load_unit?: string;
    delivery_type?: string;
    bkg_basis?: string;
    total_freight?: number;
    freight_included?: boolean;
    parent_cn_id?: string | null;
}

export default function ConsignmentsPage() {
    const router = useRouter();
    const [consignments, setConsignments] = useState<ConsignmentRow[]>([]);
    const [billingRecords, setBillingRecords] = useState<BillRecordPreview[]>([]);
    const [partiesById, setPartiesById] = useState<Record<string, BillPartyPreview>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [sortField, setSortField] = useState<ConsignmentSortField>('cn_no');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [kpiFilter, setKpiFilter] = useState<KpiFilter>('none');

    const [searchTerm, setSearchTerm] = useState('');
    const [cnNoFilter, setCnNoFilter] = useState('');
    const [selectedConsignment, setSelectedConsignment] = useState<any>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedBillingRecord, setSelectedBillingRecord] = useState<BillRecordPreview | null>(null);
    const [selectedBillParty, setSelectedBillParty] = useState<BillPartyPreview | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // Fetch active billing records on mount
    const fetchBillingRecords = async () => {
        try {
            const supabase = createSupabaseClient();
            const { data, error: err } = await supabase
                .from('party_billing_records')
                .select('*')
                .eq('status', 'ACTIVE');
            if (err || !data) return;

            setBillingRecords(data as BillRecordPreview[]);

            const partyIds = Array.from(
                new Set(data.map((record) => record.party_id).filter(Boolean))
            ) as string[];

            if (partyIds.length === 0) {
                setPartiesById({});
                return;
            }

            const { data: parties } = await supabase
                .from('parties')
                .select('id, name, code, type, phone, gstin, address, branch_code')
                .in('id', partyIds);

            const nextParties: Record<string, BillPartyPreview> = {};
            (parties || []).forEach((party) => {
                nextParties[party.id] = party as BillPartyPreview;
            });
            setPartiesById(nextParties);
        } catch (err) {
            console.error('Failed to fetch billing records:', err);
        }
    };

    // Fetch consignments on mount
    const fetchConsignments = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/consignments');
            if (!res.ok) throw new Error('Failed to fetch consignments');
            const data = await res.json();
            setConsignments(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchConsignments();
        fetchBillingRecords();
    }, []);

    React.useEffect(() => {
        const loadCurrentUser = async () => {
            try {
                const response = await fetch('/api/auth/me');
                if (!response.ok) return;
                const result = await response.json();
                setIsAdmin(result?.data?.role === 'admin');
            } catch (err) {
                console.error('Failed to load current user', err);
            }
        };

        void loadCurrentUser();
    }, []);

    const [branchOptions, setBranchOptions] = useState<{value: string, label: string}[]>([]);

    React.useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await fetch('/api/references/branches');
                if (res.ok) {
                    const data = await res.json();
                    const options = data.map((b: { code: string; name: string }) => ({
                        value: b.code.toUpperCase(),
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
        dateFrom: new Date('2025-01-01'), // Broader range
        dateTo: new Date('2026-12-31')    // Broader range
    });

    const billingRecordsById = useMemo(() => {
        const map = new Map<string, BillRecordPreview>();
        (billingRecords || []).forEach((record) => {
            map.set(record.id, record);
        });
        return map;
    }, [billingRecords]);

    const consignmentBillingMap = useMemo(() => {
        const recordsByCn = new Map<string, { status: 'BILLED' | 'CANCELLED'; billRef: string; recordId: string }>();

        (billingRecords || []).forEach((record) => {
            (record.covered_cn_nos || []).forEach((cnNo: string) => {
                const normalizedCnNo = cnNo.trim();
                if (!normalizedCnNo) return;

                const billRef = record.bill_ref_no || record.id.slice(0, 8).toUpperCase();
                if (record.status === 'ACTIVE') {
                    recordsByCn.set(normalizedCnNo, { status: 'BILLED', billRef, recordId: record.id });
                } else if (!recordsByCn.has(normalizedCnNo)) {
                    recordsByCn.set(normalizedCnNo, { status: 'CANCELLED', billRef, recordId: record.id });
                }
            });
        });

        return recordsByCn;
    }, [billingRecords]);

    const handleOpenBill = (record: BillRecordPreview, party: BillPartyPreview | null) => {
        setSelectedBillingRecord(record);
        setSelectedBillParty(party);
    };

    const parentMap = useMemo(() => {
        const map = new Map<string, string[]>();
        (consignments || []).forEach((item) => {
            if (item.parent_cn_id) {
                const parentId = item.parent_cn_id;
                if (!map.has(parentId)) {
                    map.set(parentId, []);
                }
                map.get(parentId)?.push(item.cn_no);
            }
        });
        return map;
    }, [consignments]);

    const getDestLabel = (item: ConsignmentRow) =>
        item.dest_branch || item.delivery_point || '';

    const getSortValue = (item: ConsignmentRow, field: ConsignmentSortField): string | number => {
        switch (field) {
            case 'cn_no':
                return item.cn_no || '';
            case 'booking_branch':
                return item.booking_branch || '';
            case 'bkg_date':
                return item.bkg_date || '';
            case 'dest_branch':
                return getDestLabel(item).toLowerCase();
            case 'consignor_name':
                return (item.consignor_name || '').toLowerCase();
            case 'no_of_pkg':
                return Number(item.no_of_pkg) || 0;
            case 'actual_weight':
                return Number(item.actual_weight) || 0;
            case 'delivery_type':
                return (item.delivery_type || '').toLowerCase();
            case 'bkg_basis':
                return (item.bkg_basis || '').toLowerCase();
            case 'total_freight':
                return Number(item.total_freight) || 0;
            default:
                return '';
        }
    };

    const compareConsignments = (a: ConsignmentRow, b: ConsignmentRow) => {
        if (sortField === 'cn_no') {
            const cmp = compareCnNo(a.cn_no || '', b.cn_no || '');
            return sortDir === 'asc' ? cmp : -cmp;
        }

        const va = getSortValue(a, sortField);
        const vb = getSortValue(b, sortField);

        if (typeof va === 'number' && typeof vb === 'number') {
            return sortDir === 'asc' ? va - vb : vb - va;
        }

        const sa = String(va);
        const sb = String(vb);
        const cmp = sa.localeCompare(sb);
        return sortDir === 'asc' ? cmp : -cmp;
    };

    const filteredList = useMemo(() => {
        return (consignments || []).filter((item) => {
            const matchesSearch =
                item.cn_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                getDestLabel(item).toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.consignor_name || '').toLowerCase().includes(searchTerm.toLowerCase());

            const { cnNo, bkgBranch: ab, deliveryBranch: ad, bookingType: at, deliveryType: adt, dateFrom: df, dateTo: dt } = appliedFilters;

            const matchesCn = cnNo === '' || item.cn_no?.toLowerCase().includes(cnNo.toLowerCase());
            const matchesBkgBranch = ab === 'all' || item.booking_branch === ab;
            const matchesDestBranch = ad === 'all' || getDestLabel(item).includes(ad);
            const matchesBkgBasis = at === 'all' || item.bkg_basis === at;
            const matchesDelType = adt === 'all' || item.delivery_type === adt;

            const itemDateStr = item.bkg_date || '';
            const fromStr = df ? format(df, 'yyyy-MM-dd') : null;
            const toStr = dt ? format(dt, 'yyyy-MM-dd') : null;
            const matchesDateFrom = !fromStr || itemDateStr >= fromStr;
            const matchesDateTo = !toStr || itemDateStr <= toStr;

            return matchesSearch && matchesCn && matchesBkgBranch && matchesDestBranch &&
                matchesBkgBasis && matchesDelType && matchesDateFrom && matchesDateTo;
        });
    }, [searchTerm, appliedFilters, consignments]);

    const groupedList = useMemo(() => {
        const sortedBase = [...filteredList].sort((a, b) => compareCnNo(a.cn_no || '', b.cn_no || ''));
        const processed = new Set<string>();
        const grouped: ConsignmentRow[] = [];

        sortedBase.forEach((c) => {
            if (processed.has(c.cn_no)) return;

            grouped.push(c);
            processed.add(c.cn_no);

            const billing = consignmentBillingMap.get(c.cn_no);
            const isBilled = billing?.status === 'BILLED' && billing.billRef;

            if (isBilled) {
                const billRef = billing.billRef;
                sortedBase.forEach((item) => {
                    if (!processed.has(item.cn_no)) {
                        const itemBilling = consignmentBillingMap.get(item.cn_no);
                        if (itemBilling?.status === 'BILLED' && itemBilling.billRef === billRef) {
                            grouped.push(item);
                            processed.add(item.cn_no);
                        }
                    }
                });
            }
        });

        return grouped;
    }, [filteredList, consignmentBillingMap]);

    const filteredData = useMemo(() => {
        let list = [...groupedList];

        if (kpiFilter === 'billed') {
            list = list.filter((item) => consignmentBillingMap.get(item.cn_no)?.status === 'BILLED');
        } else if (kpiFilter === 'unbilled') {
            list = list.filter((item) => consignmentBillingMap.get(item.cn_no)?.status !== 'BILLED');
        } else if (kpiFilter === 'freight') {
            list = list.filter((item) => Number(item.total_freight || 0) > 0);
        }

        list.sort(compareConsignments);
        return list;
    }, [groupedList, kpiFilter, consignmentBillingMap, sortField, sortDir]);

    const totals = useMemo(() => {
        let totalFreight = 0;
        let billedFreight = 0;
        let unbilledFreight = 0;
        let billedCount = 0;

        filteredData.forEach((item) => {
            const freight = Number(item.total_freight) || 0;
            totalFreight += freight;
            if (consignmentBillingMap.get(item.cn_no)?.status === 'BILLED') {
                billedFreight += freight;
                billedCount += 1;
            } else {
                unbilledFreight += freight;
            }
        });

        return {
            count: filteredData.length,
            totalFreight,
            billedFreight,
            unbilledFreight,
            billedCount,
            unbilledCount: filteredData.length - billedCount,
        };
    }, [filteredData, consignmentBillingMap]);

    const toggleSort = (field: ConsignmentSortField) => {
        if (sortField === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir(field === 'cn_no' || field === 'bkg_date' ? 'asc' : 'desc');
        }
    };

    const SortIcon = ({ field }: { field: ConsignmentSortField }) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-3.5 w-3.5 ml-1 inline text-muted-foreground/40" />;
        }
        return sortDir === 'asc'
            ? <ArrowUpDown className="h-3.5 w-3.5 ml-1 inline text-primary" />
            : <ArrowUpDown className="h-3.5 w-3.5 ml-1 inline text-primary rotate-180" />;
    };

    const toggleKpiFilter = (next: KpiFilter) => {
        setKpiFilter((prev) => (prev === next ? 'none' : next));
    };

    // Reset to page 1 whenever filters or rows-per-page change
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredData, rowsPerPage]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
    const paginatedData = filteredData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    const getPageNumbers = () => {
        const pages: number[] = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    };

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
        setKpiFilter('none');
    };

    const handleExportCSV = () => {
        const columns = [
            { header: 'CNs No',          key: 'cn_no' },
            { header: 'Booking Branch',  key: 'booking_branch' },
            { header: 'Booking Date',    key: 'bkg_date' },
            { header: 'Dest Branch',     key: 'dest_branch' },
            { header: 'Delivery Point',  key: 'delivery_point' },
            { header: 'No of Pkgs',      key: 'no_of_pkg' },
            { header: 'Actual Weight',   key: 'actual_weight' },
            { header: 'Load Unit',       key: 'load_unit' },
            { header: 'Delivery Type',   key: 'delivery_type' },
            { header: 'Bkg Basis',       key: 'bkg_basis' },
            { header: 'Total Freight',   key: 'total_freight' },
            { header: 'Consignor',       key: 'consignor_name' },
            { header: 'Consignee',       key: 'consignee_name' },
        ];

        const escape = (val: any) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            // Wrap in quotes if it contains comma, quote, or newline
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const header = columns.map(c => escape(c.header)).join(',');
        const rows = filteredData.map(item =>
            columns.map(c => escape((item as any)[c.key])).join(',')
        );

        const csvContent = [header, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = `consignments_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
                    <Button
                        variant="outline"
                        className="gap-2 shadow-sm border-primary/20 hover:bg-primary/5"
                        onClick={handleExportCSV}
                        disabled={filteredData.length === 0}
                        title={`Export ${filteredData.length} filtered rows as CSV`}
                    >
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
                                    {branchOptions.map(b => (
                                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                                    ))}
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
                                    {branchOptions.map(b => (
                                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                                    ))}
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

            {/* KPI Summary — click to filter */}
            {kpiFilter !== 'none' && (
                <div className="flex items-center gap-2 text-xs text-primary font-medium bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                    <Filter className="h-3.5 w-3.5 shrink-0" />
                    <span>
                        Showing CNS filtered by:{' '}
                        <strong className="capitalize">
                            {kpiFilter === 'freight' ? 'With Freight' : kpiFilter}
                        </strong>
                    </span>
                    <button type="button" onClick={() => setKpiFilter('none')} className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-3.5 w-3.5" /> Clear
                    </button>
                </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                    type="button"
                    onClick={() => toggleKpiFilter('freight')}
                    className={`text-left rounded-xl border-2 shadow-md bg-white transition-all hover:shadow-lg ${kpiFilter === 'freight' ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'}`}
                >
                    <div className="p-4 flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${kpiFilter === 'freight' ? 'bg-primary' : 'bg-primary/10'}`}>
                            <Package className={`h-5 w-5 ${kpiFilter === 'freight' ? 'text-white' : 'text-primary'}`} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Total CNS</p>
                            <p className="text-lg font-black">{totals.count}</p>
                            <p className="text-[10px] text-muted-foreground">₹{fmt(totals.totalFreight)} freight</p>
                        </div>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => toggleKpiFilter('billed')}
                    className={`text-left rounded-xl border-2 shadow-md bg-white transition-all hover:shadow-lg ${kpiFilter === 'billed' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-transparent'}`}
                >
                    <div className="p-4 flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${kpiFilter === 'billed' ? 'bg-emerald-500' : 'bg-emerald-50'}`}>
                            <TrendingUp className={`h-5 w-5 ${kpiFilter === 'billed' ? 'text-white' : 'text-emerald-600'}`} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Billed CNS</p>
                            <p className="text-lg font-black text-emerald-700">{totals.billedCount}</p>
                            <p className="text-[10px] text-emerald-600">₹{fmt(totals.billedFreight)}</p>
                        </div>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => toggleKpiFilter('unbilled')}
                    className={`text-left rounded-xl border-2 shadow-md bg-white transition-all hover:shadow-lg ${kpiFilter === 'unbilled' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-transparent'}`}
                >
                    <div className="p-4 flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${kpiFilter === 'unbilled' ? 'bg-amber-500' : 'bg-amber-50'}`}>
                            <AlertCircle className={`h-5 w-5 ${kpiFilter === 'unbilled' ? 'text-white' : 'text-amber-600'}`} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Unbilled CNS</p>
                            <p className="text-lg font-black text-amber-700">{totals.unbilledCount}</p>
                            <p className="text-[10px] text-amber-600">₹{fmt(totals.unbilledFreight)}</p>
                        </div>
                    </div>
                </button>
                <div className="rounded-xl border-2 border-transparent shadow-md bg-white">
                    <div className="p-4 flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50">
                            <DollarSign className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Total Freight</p>
                            <p className="text-lg font-black text-indigo-700">₹{fmt(totals.totalFreight)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CNS Table — ledger style */}
            <Card className="border shadow-lg overflow-hidden bg-card/60 backdrop-blur-xl border-border/40">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-6 border-b bg-muted/20">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" /> CNS List
                    </CardTitle>
                    <div className="relative w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter table content..."
                            className="pl-9 h-9 bg-background"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/40 border-b">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-bold py-4 cursor-pointer select-none hover:bg-muted/60 transition-colors" onClick={() => toggleSort('booking_branch')}>
                                        Bkg Branch <SortIcon field="booking_branch" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 cursor-pointer select-none hover:bg-muted/60 transition-colors" onClick={() => toggleSort('cn_no')}>
                                        CNS No <SortIcon field="cn_no" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 cursor-pointer select-none hover:bg-muted/60 transition-colors" onClick={() => toggleSort('bkg_date')}>
                                        Bkg Date <SortIcon field="bkg_date" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 cursor-pointer select-none hover:bg-muted/60 transition-colors" onClick={() => toggleSort('dest_branch')}>
                                        Dest Branch <SortIcon field="dest_branch" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 cursor-pointer select-none hover:bg-muted/60 transition-colors" onClick={() => toggleSort('consignor_name')}>
                                        Consignor <SortIcon field="consignor_name" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 text-center cursor-pointer select-none hover:bg-muted/60 transition-colors" onClick={() => toggleSort('no_of_pkg')}>
                                        Pkgs <SortIcon field="no_of_pkg" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 text-right cursor-pointer select-none hover:bg-muted/60 transition-colors" onClick={() => toggleSort('actual_weight')}>
                                        Weight <SortIcon field="actual_weight" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 cursor-pointer select-none hover:bg-muted/60 transition-colors" onClick={() => toggleSort('delivery_type')}>
                                        Del. Type <SortIcon field="delivery_type" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 cursor-pointer select-none hover:bg-muted/60 transition-colors" onClick={() => toggleSort('bkg_basis')}>
                                        Basis <SortIcon field="bkg_basis" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 text-right cursor-pointer select-none hover:bg-muted/60 transition-colors" onClick={() => toggleSort('total_freight')}>
                                        Freight <SortIcon field="total_freight" />
                                    </TableHead>
                                    <TableHead className="font-bold py-4 min-w-[100px]">Bill No</TableHead>
                                    <TableHead className="text-right py-4" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                                            Loading consignments...
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedData.length > 0 ? (
                                    paginatedData.map((item) => (
                                        <TableRow key={item.id || item.cn_no} className="hover:bg-primary/5 transition-colors border-b last:border-0 group">
                                            <TableCell>
                                                <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                                                    {item.booking_branch || '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 items-start">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedConsignment(item);
                                                            setIsDetailsOpen(true);
                                                        }}
                                                        className="font-mono font-bold text-primary text-xs hover:underline underline-offset-4"
                                                    >
                                                        {item.cn_no}
                                                    </button>
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.freight_included && (
                                                            (() => {
                                                                const parentCnNo = item.parent_cn_id ? (consignments || []).find(c => c.id === item.parent_cn_id)?.cn_no : null;
                                                                return (
                                                                    <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0 font-bold" title={parentCnNo ? `Included in CN ${parentCnNo}` : 'Included in parent CN'}>
                                                                        <Link2 className="h-2.5 w-2.5 mr-0.5 inline-block shrink-0" />
                                                                        ↳ Incl. {parentCnNo ? `(${parentCnNo})` : ''}
                                                                    </Badge>
                                                                );
                                                            })()
                                                        )}
                                                        {(() => {
                                                            const children = parentMap.get(item.id) || [];
                                                            if (children.length > 0) {
                                                                return (
                                                                    <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 py-0 font-bold" title={`Linked child CNs: ${children.join(', ')}`}>
                                                                        Parent ({children.length})
                                                                    </Badge>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">{item.bkg_date || '—'}</TableCell>
                                            <TableCell className="text-xs font-semibold max-w-[140px] truncate" title={getDestLabel(item)}>
                                                {item.dest_branch ? getFullBranchName(item.dest_branch, branchOptions) : (item.delivery_point?.toUpperCase() || '—')}
                                            </TableCell>
                                            <TableCell className="text-xs max-w-[140px] truncate" title={item.consignor_name || ''}>
                                                {item.consignor_name || '—'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="font-mono text-xs font-bold">{item.no_of_pkg ?? 0}</span>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs font-bold">
                                                {Number(item.actual_weight || 0).toLocaleString()} {item.load_unit?.toLowerCase() || 'kg'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                                                    {item.delivery_type || '—'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] font-mono">
                                                    {item.bkg_basis || '—'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {Number(item.total_freight || 0) > 0 ? (
                                                    <span className="font-mono font-bold text-sm text-primary">₹{fmt(Number(item.total_freight))}</span>
                                                ) : (
                                                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">No Freight</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const billing = consignmentBillingMap.get(item.cn_no);
                                                    if (billing?.status !== 'BILLED') {
                                                        return <span className="text-xs text-muted-foreground">—</span>;
                                                    }
                                                    const record = billingRecordsById.get(billing.recordId);
                                                    const party = record?.party_id ? partiesById[record.party_id] : undefined;
                                                    return (
                                                        <ConsignmentBillCell
                                                            record={record}
                                                            party={party}
                                                            onOpenBill={handleOpenBill}
                                                        />
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                                                    onClick={() => {
                                                        setSelectedConsignment(item);
                                                        setIsDetailsOpen(true);
                                                    }}
                                                    title="View & Print"
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                                {isAdmin && (
                                                    <Link href={`/dashboard/consignments/new?edit=${item.id}`}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                                            title="Edit CNS"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={12} className="h-64 text-center">
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

                    {filteredData.length > 0 && (
                        <div className="px-6 py-4 border-t bg-muted/20 grid grid-cols-12 gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            <div className="col-span-4">Total ({filteredData.length} CNS)</div>
                            <div className="col-span-3" />
                            <div className="text-right font-mono text-emerald-700">{totals.billedCount} billed</div>
                            <div className="text-right font-mono text-amber-700">{totals.unbilledCount} unbilled</div>
                            <div className="text-right font-mono text-primary col-span-2">₹{fmt(totals.totalFreight)}</div>
                            <div className="col-span-2" />
                        </div>
                    )}

                    {/* Enhanced Pagination */}
                    <div className="px-6 py-4 flex items-center justify-between border-t bg-muted/5">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                            <span>
                                Showing{' '}
                                <strong>{filteredData.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}</strong>
                                {' '}–{' '}
                                <strong>{Math.min(currentPage * rowsPerPage, filteredData.length)}</strong>
                                {' '}of{' '}
                                <strong>{filteredData.length}</strong> entries
                            </span>
                            <div className="h-4 w-[1px] bg-border" />
                            <div className="flex items-center gap-2">
                                <span>Show</span>
                                <Select
                                    value={String(rowsPerPage)}
                                    onValueChange={(val) => setRowsPerPage(Number(val))}
                                >
                                    <SelectTrigger className="h-7 w-16 bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span>rows</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="h-8 px-4 text-xs font-bold uppercase tracking-wider"
                            >
                                Previous
                            </Button>
                            <div className="flex gap-1">
                                {getPageNumbers().map((page) => (
                                    <Button
                                        key={page}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(page)}
                                        className={`h-8 w-8 p-0 transition-colors ${
                                            page === currentPage
                                                ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                                                : 'hover:border-primary hover:text-primary'
                                        }`}
                                    >
                                        {page}
                                    </Button>
                                ))}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className="h-8 px-4 text-xs font-bold uppercase tracking-wider hover:border-primary hover:text-primary"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Details Modal */}
            <ConsignmentDetailsDialog
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                consignment={selectedConsignment}
                isAdmin={isAdmin}
            />

            <BillingRecordViewDialog
                open={!!selectedBillingRecord}
                onClose={() => {
                    setSelectedBillingRecord(null);
                    setSelectedBillParty(null);
                }}
                party={selectedBillParty as ComponentProps<typeof BillingRecordViewDialog>['party']}
                record={selectedBillingRecord as ComponentProps<typeof BillingRecordViewDialog>['record']}
                consignments={consignments as ComponentProps<typeof BillingRecordViewDialog>['consignments']}
                isAdmin={isAdmin}
                onEdit={() => {
                    if (!selectedBillParty?.id) return;
                    const partyId = selectedBillParty.id;
                    setSelectedBillingRecord(null);
                    setSelectedBillParty(null);
                    router.push(`/dashboard/ledger/${partyId}`);
                }}
            />
        </div>
    );
}
