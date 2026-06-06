'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Building2,
    Crown,
    MoreHorizontal,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    ShieldAlert,
    Trash2,
} from 'lucide-react';
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

type BranchCnRange = {
    id: string;
    range_start: number;
    range_end: number;
    next_cn_no: number;
    status: 'active' | 'exhausted' | 'inactive';
};

type Branch = {
    id: string;
    code: string;
    name: string;
    type: string;
    city: string;
    state: string;
    phone: string | null;
    is_active: boolean;
    is_head_branch: boolean;
    next_cn_no?: number;
    next_challan_no?: number;
    cn_mode?: 'range' | 'legacy';
    cn_status?: 'ready' | 'needs_update' | 'legacy';
    active_cn_range?: BranchCnRange | null;
    latest_cn_range?: BranchCnRange | null;
    cn_ranges?: BranchCnRange[];
    remaining_count?: number | null;
    is_low_cn?: boolean;
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

const formatRange = (rangeStart?: number | null, rangeEnd?: number | null) => {
    if (rangeStart == null || rangeEnd == null) return '—';
    return `${rangeStart} – ${rangeEnd}`;
};

const getCnControlBadge = (branch: Branch) => {
    if (branch.cn_mode === 'range' && branch.cn_status === 'ready') {
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Managed Range</Badge>;
    }
    if (branch.cn_mode === 'range') {
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Update Needed</Badge>;
    }
    return <Badge variant="outline">Legacy Counter</Badge>;
};

const getCnStatusText = (branch: Branch) => {
    if (branch.active_cn_range && branch.cn_status === 'ready') {
        return `Range ${formatRange(branch.active_cn_range.range_start, branch.active_cn_range.range_end)}`;
    }
    if (branch.latest_cn_range) {
        return `Last range ${formatRange(branch.latest_cn_range.range_start, branch.latest_cn_range.range_end)}`;
    }
    return 'No managed CN range yet';
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
            const res = await fetch('/api/references/branches?includeCnConfig=1');
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

    const filteredBranches = useMemo(
        () =>
            branches.filter(
                (b) =>
                    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    b.city.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [branches, searchTerm]
    );

    const selectedBranch = useMemo(
        () => branches.find((b) => b.id === selectedBranchId) || null,
        [branches, selectedBranchId]
    );

    const usesManagedCn = Boolean(selectedBranch?.cn_ranges && selectedBranch.cn_ranges.length > 0);

    const resetDialogState = () => {
        setSelectedBranchId(null);
        setForm(defaultForm);
    };

    const handleFormChange = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
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
            resetDialogState();
            fetchBranches();
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
            const res = await fetch(`/api/references/branches?id=${id}`, { method: 'DELETE' });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete branch');
            }

            toast.success(`Branch "${name}" deleted successfully`);
            fetchBranches();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete branch');
        }
    };

    const renderBranchFormFields = () => (
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
                    <Select value={form.type} onValueChange={(value) => handleFormChange('type', value)}>
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
                    <Label htmlFor="next_cn_no">Legacy / Fallback Next CN No.</Label>
                    <Input
                        id="next_cn_no"
                        type="number"
                        placeholder="e.g. 800001"
                        value={form.next_cn_no}
                        disabled={usesManagedCn}
                        onChange={(e) => handleFormChange('next_cn_no', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        {usesManagedCn
                            ? 'CN ranges are managed in Documentation → CN Assigning.'
                            : 'Used only until a branch-specific CN range is assigned via Documentation.'}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="next_challan_no">
                        Starting Challan No. <span className="text-muted-foreground">(opt)</span>
                    </Label>
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
                <Label htmlFor="phone">
                    Contact Phone <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                    id="phone"
                    placeholder="+91-..."
                    value={form.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#101828]">Branch Management</h2>
                    <p className="text-sm text-muted-foreground">
                        Manage hubs and branch offices. CN number assigning is in Documentation.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchBranches}
                        disabled={loading}
                        title="Refresh"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Dialog
                        open={isAddOpen}
                        onOpenChange={(open) => {
                            setIsAddOpen(open);
                            if (!open) resetDialogState();
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button className="gap-2 shadow-sm" onClick={() => resetDialogState()}>
                                <Plus className="h-4 w-4" />
                                Add Branch
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                            <form onSubmit={handleAddBranch}>
                                <DialogHeader>
                                    <DialogTitle>
                                        {selectedBranchId ? 'Edit Branch' : 'Add New Branch'}
                                        {selectedBranch?.is_head_branch && (
                                            <Badge className="ml-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                                                <Crown className="h-3 w-3 mr-1" />
                                                Head Branch
                                            </Badge>
                                        )}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {selectedBranchId
                                            ? 'Update branch details. CN ranges are managed under Documentation.'
                                            : 'Create a new branch or hub location.'}
                                    </DialogDescription>
                                </DialogHeader>
                                {renderBranchFormFields()}
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsAddOpen(false)}
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting
                                            ? selectedBranchId ? 'Updating…' : 'Creating…'
                                            : selectedBranchId ? 'Update Branch' : 'Create Branch'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm max-w-md">
                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                <Input
                    placeholder="Search branches by name, code or city…"
                    className="border-none shadow-none focus-visible:ring-0 h-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableHead className="w-[100px]">Code</TableHead>
                            <TableHead>Branch Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>CN Control</TableHead>
                            <TableHead>Next CN</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                    Loading branches…
                                </TableCell>
                            </TableRow>
                        ) : filteredBranches.length > 0 ? (
                            filteredBranches.map((branch) => (
                                <TableRow key={branch.id} className="hover:bg-slate-50/50">
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-medium">{branch.code}</span>
                                            {branch.is_head_branch && (
                                                <Crown className="h-3.5 w-3.5 text-indigo-500" aria-label="Head Branch" />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                                <Building2 className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-[#101828]">{branch.name}</div>
                                                {branch.is_head_branch && (
                                                    <div className="text-[10px] text-indigo-600 font-semibold">
                                                        Head Branch · CN Issuing Authority
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="secondary"
                                            className={
                                                branch.type === 'Hub'
                                                    ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                    : 'bg-blue-50 text-blue-700 border-blue-100'
                                            }
                                        >
                                            {branch.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {branch.city}, {branch.state}
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {getCnControlBadge(branch)}
                                            <div className="text-xs text-muted-foreground">{getCnStatusText(branch)}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <div className="font-mono font-semibold text-[#101828]">
                                                {branch.active_cn_range
                                                    ? branch.active_cn_range.next_cn_no
                                                    : branch.next_cn_no || '—'}
                                            </div>
                                            {branch.is_low_cn && typeof branch.remaining_count === 'number' ? (
                                                <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                                    Only {branch.remaining_count} left
                                                </div>
                                            ) : typeof branch.remaining_count === 'number' && branch.remaining_count > 0 ? (
                                                <div className="text-xs text-muted-foreground">
                                                    {branch.remaining_count} remaining
                                                </div>
                                            ) : (
                                                <div className="text-xs text-muted-foreground">
                                                    {branch.active_cn_range
                                                        ? formatRange(
                                                              branch.active_cn_range.range_start,
                                                              branch.active_cn_range.range_end
                                                          )
                                                        : branch.latest_cn_range
                                                        ? formatRange(
                                                              branch.latest_cn_range.range_start,
                                                              branch.latest_cn_range.range_end
                                                          )
                                                        : 'Legacy only'}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={
                                                branch.is_active
                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                    : 'bg-red-50 text-red-700 border-red-200'
                                            }
                                        >
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
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                    No branches found matching your search.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="rounded-lg border bg-amber-50/60 p-4 text-sm text-amber-900">
                <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1">
                        <div className="font-semibold">CN range rules</div>
                        <div>
                            CN number assigning has moved to{' '}
                            <span className="font-semibold">More → Support → Documentation</span>.
                            Each branch has its own exclusive CN block issued by the Head Branch (VZM).
                            No two branches can share or overlap CN ranges.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
