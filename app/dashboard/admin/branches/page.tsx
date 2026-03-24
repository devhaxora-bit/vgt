'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Building2, MoreHorizontal, RefreshCw, Pencil, Trash2 } from 'lucide-react';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Branch = {
    id: string;
    code: string;
    name: string;
    type: string;
    city: string;
    state: string;
    phone: string | null;
    is_active: boolean;
    next_cn_no?: number;
    next_challan_no?: number;
};

const defaultForm = {
    code: '',
    name: '',
    type: 'Branch',
    city: '',
    state: '',
    phone: '',
    next_cn_no: '',
    next_challan_no: '',
};

export default function BranchManagementPage() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [form, setForm] = useState(defaultForm);

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/references/branches');
            if (!res.ok) throw new Error('Failed to fetch branches');
            const data = await res.json();
            setBranches(data);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to load branches');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    const filteredBranches = branches.filter(branch =>
        branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.city.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleFormChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleAddBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const url = selectedBranchId 
                ? `/api/references/branches?id=${selectedBranchId}` 
                : '/api/references/branches';
            const method = selectedBranchId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `Failed to ${selectedBranchId ? 'update' : 'add'} branch`);
            }

            toast.success(`Branch "${data.name}" ${selectedBranchId ? 'updated' : 'added'} successfully`);
            setIsAddOpen(false);
            setSelectedBranchId(null);
            setForm(defaultForm);
            fetchBranches(); // Refresh list
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : `Failed to ${selectedBranchId ? 'update' : 'add'} branch`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditBranch = (branch: Branch) => {
        setSelectedBranchId(branch.id);
        setForm({
            code: branch.code,
            name: branch.name,
            type: branch.type,
            city: branch.city,
            state: branch.state,
            phone: branch.phone || '',
            next_cn_no: branch.next_cn_no ? branch.next_cn_no.toString() : '',
            next_challan_no: branch.next_challan_no ? branch.next_challan_no.toString() : '',
        });
        setIsAddOpen(true);
    };

    const handleDeleteBranch = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete the branch "${name}"?`)) return;
        
        try {
            const res = await fetch(`/api/references/branches?id=${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete branch');
            }

            toast.success(`Branch "${name}" deleted successfully`);
            fetchBranches(); // Refresh list
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete branch');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#101828]">Branch Management</h2>
                    <p className="text-sm text-muted-foreground">Manage your hubs and branch offices across locations.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchBranches} disabled={loading} title="Refresh">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Dialog open={isAddOpen} onOpenChange={(open) => { 
                        setIsAddOpen(open); 
                        if (!open) {
                            setForm(defaultForm);
                            setSelectedBranchId(null);
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 shadow-sm" onClick={() => { setForm(defaultForm); setSelectedBranchId(null); }}>
                                <Plus className="h-4 w-4" />
                                Add Branch
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <form onSubmit={handleAddBranch}>
                                <DialogHeader>
                                    <DialogTitle>{selectedBranchId ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
                                    <DialogDescription>
                                        {selectedBranchId ? 'Update the branch details below.' : 'Create a new branch or hub location.'}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="code">Branch Code</Label>
                                            <Input
                                                id="code"
                                                placeholder="e.g. BLR"
                                                required
                                                className="uppercase"
                                                value={form.code}
                                                disabled={!!selectedBranchId}
                                                onChange={(e) => handleFormChange('code', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="type">Type</Label>
                                            <Select
                                                value={form.type}
                                                onValueChange={(val) => handleFormChange('type', val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Hub">Hub</SelectItem>
                                                    <SelectItem value="Branch">Branch</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Branch Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="e.g. Bangalore Central"
                                            required
                                            value={form.name}
                                            onChange={(e) => handleFormChange('name', e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="city">City</Label>
                                            <Input
                                                id="city"
                                                placeholder="City"
                                                required
                                                value={form.city}
                                                onChange={(e) => handleFormChange('city', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="state">State</Label>
                                            <Input
                                                id="state"
                                                placeholder="State"
                                                required
                                                value={form.state}
                                                onChange={(e) => handleFormChange('state', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="next_cn_no">Starting CN No. <span className="text-muted-foreground">(opt)</span></Label>
                                            <Input
                                                id="next_cn_no"
                                                type="number"
                                                placeholder="e.g. 800001"
                                                value={form.next_cn_no}
                                                onChange={(e) => handleFormChange('next_cn_no', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="next_challan_no">Starting Challan No. <span className="text-muted-foreground">(opt)</span></Label>
                                            <Input
                                                id="next_challan_no"
                                                type="number"
                                                placeholder="e.g. 300066955"
                                                value={form.next_challan_no}
                                                onChange={(e) => handleFormChange('next_challan_no', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Contact Phone <span className="text-muted-foreground">(optional)</span></Label>
                                        <Input
                                            id="phone"
                                            placeholder="+91-..."
                                            value={form.phone}
                                            onChange={(e) => handleFormChange('phone', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setSelectedBranchId(null); }} disabled={submitting}>Cancel</Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? (selectedBranchId ? 'Updating...' : 'Creating...') : (selectedBranchId ? 'Update Branch' : 'Create Branch')}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm max-w-md">
                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                <Input
                    placeholder="Search branches by name, code or city..."
                    className="border-none shadow-none focus-visible:ring-0 h-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="w-[100px]">Code</TableHead>
                            <TableHead>Branch Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    Loading branches...
                                </TableCell>
                            </TableRow>
                        ) : filteredBranches.length > 0 ? (
                            filteredBranches.map((branch) => (
                                <TableRow key={branch.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-mono font-medium">{branch.code}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                                <Building2 className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium text-[#101828]">{branch.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={
                                            branch.type === 'Hub'
                                                ? "bg-purple-50 text-purple-700 border-purple-100"
                                                : "bg-blue-50 text-blue-700 border-blue-100"
                                        }>
                                            {branch.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {branch.city}, {branch.state}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={
                                            branch.is_active
                                                ? "bg-green-50 text-green-700 border-green-200"
                                                : "bg-red-50 text-red-700 border-red-200"
                                        }>
                                            {branch.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEditBranch(branch)}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit Branch
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                                                    onClick={() => handleDeleteBranch(branch.id, branch.name)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No branches found matching your search.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
