'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, FileText, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { compareCnNo } from '@/lib/sortLinkedConsignments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ChallanDetailsDialog } from '@/components/features/challans/ChallanDetailsDialog';
import { Printer, Pencil } from 'lucide-react';

interface Challan {
    id: string;
    challan_no: string;
    engagement_type?: string;
    owner_type?: string;
    date_from: string;
    date_to?: string;
    origin_branch: { name: string; city: string };
    destination_branch?: { name: string; city: string } | null;
    unloading_area?: string;
    challan_type: string;
    challan_mode?: string;
    vehicle_no: string;
    driver_name?: string;
    driver_mobile?: string;
    total_hire_amount: number;
    extra_hire_amount: number;
    advance_amount: number;
    status: string;
    created_at: string;
}

export default function ChallanListPage() {
    const router = useRouter();
    const [challans, setChallans] = useState<Challan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);

    // State for Details Dialog
    const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [sortField, setSortField] = useState<'challan_no' | 'created_at' | 'vehicle_no' | 'total_hire_amount'>('challan_no');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const fetchChallans = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (debouncedSearch) params.append('search', debouncedSearch);
            if (typeFilter !== 'ALL') params.append('type', typeFilter);
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);

            const res = await fetch(`/api/challans?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch data');
            const data = await res.json();
            setChallans(data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load challans');
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, debouncedSearch, typeFilter]);

    useEffect(() => {
        fetchChallans();
    }, [fetchChallans]);

    const handleViewDetails = (challan: Challan) => {
        setSelectedChallan(challan);
        setIsDetailsOpen(true);
    };

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir(field === 'challan_no' ? 'asc' : 'desc');
        }
    };

    const SortIcon = ({ field }: { field: typeof sortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 inline text-muted-foreground/50" />;
        return sortDir === 'asc'
            ? <ArrowUp className="h-3.5 w-3.5 ml-1 inline text-primary" />
            : <ArrowDown className="h-3.5 w-3.5 ml-1 inline text-primary" />;
    };

    const sortedChallans = useMemo(() => {
        const list = [...challans];
        list.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'challan_no') {
                cmp = compareCnNo(a.challan_no, b.challan_no);
            } else if (sortField === 'created_at') {
                cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            } else if (sortField === 'vehicle_no') {
                cmp = String(a.vehicle_no || '').localeCompare(String(b.vehicle_no || ''));
            } else {
                cmp = Number(a.total_hire_amount || 0) - Number(b.total_hire_amount || 0);
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return list;
    }, [challans, sortField, sortDir]);

    return (
        <div className="p-6 space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#101828] flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        Challan List
                    </h2>
                    <p className="text-sm text-muted-foreground">Manage your vehicle transport challans.</p>
                </div>
                <Button asChild className="gap-2 shadow-sm bg-primary hover:bg-primary/90">
                    <Link href="/dashboard/challans/new">
                        <Plus className="h-4 w-4" />
                        New Challan [Alt+2]
                    </Link>
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4 grid gap-4 grid-cols-1 md:grid-cols-4 items-end">
                    <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">Search Challan</span>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Challan No or Vehicle No..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">Engagement Via</span>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All</SelectItem>
                                <SelectItem value="broker">Broker</SelectItem>
                                <SelectItem value="direct">Direct</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">Date From</span>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">Date To</span>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="w-[120px]">Challan Branch</TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('challan_no')}>
                                Challan No <SortIcon field="challan_no" />
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('created_at')}>
                                Challan Date <SortIcon field="created_at" />
                            </TableHead>
                            <TableHead>Via</TableHead>
                            <TableHead>Dest Branch</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('vehicle_no')}>
                                Vehicle No <SortIcon field="vehicle_no" />
                            </TableHead>
                            <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('total_hire_amount')}>
                                Total Hire <SortIcon field="total_hire_amount" />
                            </TableHead>
                            <TableHead className="text-right">Extra Hire</TableHead>
                            <TableHead className="text-right">Advance Paid</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={12} className="h-24 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                        Loading...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : sortedChallans.length > 0 ? (
                            sortedChallans.map((challan) => (
                                <TableRow key={challan.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-medium">{challan.origin_branch?.name || 'N/A'}</TableCell>
                                    <TableCell className="font-mono text-primary font-semibold">{challan.challan_no}</TableCell>
                                    <TableCell>{format(new Date(challan.created_at), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={
                                            challan.engagement_type === 'direct'
                                                ? 'border-blue-200 text-blue-700 bg-blue-50'
                                                : 'border-orange-200 text-orange-700 bg-orange-50'
                                        }>
                                            {challan.engagement_type === 'direct' ? 'Direct' : 'Broker'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{challan.destination_branch?.name || challan.unloading_area || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono">{challan.challan_mode || challan.challan_type}</Badge>
                                    </TableCell>
                                    <TableCell className="font-mono font-medium text-[#101828]">{challan.vehicle_no}</TableCell>
                                    <TableCell className="text-right font-mono">{challan.total_hire_amount}</TableCell>
                                    <TableCell className="text-right font-mono">{challan.extra_hire_amount}</TableCell>
                                    <TableCell className="text-right font-mono">{challan.advance_amount}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={
                                            challan.status === 'ACTIVE'
                                                ? "bg-green-50 text-green-700 border-green-200"
                                                : "bg-gray-50 text-gray-700 border-gray-200"
                                        }>
                                            {challan.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                                onClick={() => handleViewDetails(challan)}
                                                title="View & Print"
                                            >
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                onClick={() => router.push(`/dashboard/challans/new?edit=${challan.id}`)}
                                                title="Edit Challan"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                                    No challans found matching your search.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                <div className="p-4 border-t text-sm text-muted-foreground bg-slate-50">
                    Showing {challans.length} entries
                </div>
            </div>

            <ChallanDetailsDialog
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                challan={selectedChallan}
            />
        </div>
    );
}
