'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Calendar, Filter, FileText } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Challan {
    id: string;
    challan_no: string;
    owner_type?: string;
    date_from: string;
    origin_branch: { name: string; city: string };
    destination_branch: { name: string; city: string };
    challan_type: string;
    vehicle_no: string;
    total_hire_amount: number;
    extra_hire_amount: number;
    advance_amount: number;
    status: string;
    created_at: string;
}

export default function ChallanListPage() {
    const [challans, setChallans] = useState<Challan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        fetchChallans();
    }, [searchTerm, typeFilter, dateFrom, dateTo]);

    const fetchChallans = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
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
    };

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
                        <span className="text-xs font-medium text-muted-foreground">Challan Type</span>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Types</SelectItem>
                                <SelectItem value="MAIN">MAIN</SelectItem>
                                <SelectItem value="FOC">FOC</SelectItem>
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
                            <TableHead>Challan No</TableHead>
                            <TableHead>Challan Date</TableHead>
                            <TableHead>Owner Type</TableHead>
                            <TableHead>Dest Branch</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Vehicle No</TableHead>
                            <TableHead className="text-right">Total Hire</TableHead>
                            <TableHead className="text-right">Extra Hire</TableHead>
                            <TableHead className="text-right">Advance Paid</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                        Loading...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : challans.length > 0 ? (
                            challans.map((challan) => (
                                <TableRow key={challan.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-medium">{challan.origin_branch?.name || 'N/A'}</TableCell>
                                    <TableCell className="font-mono text-primary font-semibold">{challan.challan_no}</TableCell>
                                    <TableCell>{format(new Date(challan.created_at), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{challan.owner_type || 'MARKET'}</TableCell>
                                    <TableCell>{challan.destination_branch?.name || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono">{challan.challan_type}</Badge>
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
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
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
        </div>
    );
}
