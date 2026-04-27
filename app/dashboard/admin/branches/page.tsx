'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Building2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

type BranchCnRange = {
    id: string;
    branch_id: string;
    range_start: number;
    range_end: number;
    next_cn_no: number;
    status: 'active' | 'exhausted' | 'inactive';
    note?: string | null;
    created_at: string;
};

type BranchCnReservedRange = {
    id: string;
    branch_id: string;
    range_start: number;
    range_end: number;
    reservation_type: 'physical_copy';
    note?: string | null;
    created_at: string;
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
    next_cn_no?: number;
    next_challan_no?: number;
    cn_mode?: 'range' | 'legacy';
    cn_status?: 'ready' | 'needs_update' | 'legacy';
    active_cn_range?: BranchCnRange | null;
    latest_cn_range?: BranchCnRange | null;
    cn_ranges?: BranchCnRange[];
    cn_reserved_ranges?: BranchCnReservedRange[];
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

const defaultRangeForm = {
    range_start: '',
    range_end: '',
    note: '',
};

const formatRange = (rangeStart?: number | null, rangeEnd?: number | null) => {
    if (rangeStart === null || rangeStart === undefined || rangeEnd === null || rangeEnd === undefined) {
        return '—';
    }

    return `${rangeStart} - ${rangeEnd}`;
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
    const [dialogTab, setDialogTab] = useState<'details' | 'cn'>('details');
    const [rangeSubmittingType, setRangeSubmittingType] = useState<'system' | 'physical' | null>(null);
    const [form, setForm] = useState(defaultForm);
    const [systemRangeForm, setSystemRangeForm] = useState(defaultRangeForm);
    const [physicalRangeForm, setPhysicalRangeForm] = useState(defaultRangeForm);

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
        () => branches.filter((branch) =>
            branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            branch.city.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [branches, searchTerm]
    );

    const selectedBranch = useMemo(
        () => branches.find((branch) => branch.id === selectedBranchId) || null,
        [branches, selectedBranchId]
    );

    const usesManagedCn = Boolean(selectedBranch?.cn_ranges && selectedBranch.cn_ranges.length > 0);

    const resetDialogState = () => {
        setSelectedBranchId(null);
        setDialogTab('details');
        setForm(defaultForm);
        setSystemRangeForm(defaultRangeForm);
        setPhysicalRangeForm(defaultRangeForm);
        setRangeSubmittingType(null);
    };

    const handleFormChange = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleRangeFormChange = (
        type: 'system' | 'physical',
        field: keyof typeof defaultRangeForm,
        value: string
    ) => {
        if (type === 'system') {
            setSystemRangeForm((prev) => ({ ...prev, [field]: value }));
            return;
        }

        setPhysicalRangeForm((prev) => ({ ...prev, [field]: value }));
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
        setDialogTab('details');
        setSystemRangeForm(defaultRangeForm);
        setPhysicalRangeForm(defaultRangeForm);
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
            fetchBranches();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete branch');
        }
    };

    const handleCreateCnRange = async (rangeType: 'system' | 'physical', e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedBranchId) {
            toast.error('Select a branch first.');
            return;
        }

        const currentForm = rangeType === 'system' ? systemRangeForm : physicalRangeForm;
        setRangeSubmittingType(rangeType);

        try {
            const res = await fetch('/api/references/branches/cn-ranges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    branch_id: selectedBranchId,
                    range_type: rangeType,
                    range_start: currentForm.range_start,
                    range_end: currentForm.range_end,
                    note: currentForm.note,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to save CN range');
            }

            toast.success(
                rangeType === 'system'
                    ? `Active CN range ${currentForm.range_start}-${currentForm.range_end} saved.`
                    : `Physical CN block ${currentForm.range_start}-${currentForm.range_end} reserved.`
            );

            if (rangeType === 'system') {
                setSystemRangeForm(defaultRangeForm);
            } else {
                setPhysicalRangeForm(defaultRangeForm);
            }

            await fetchBranches();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save CN range');
        } finally {
            setRangeSubmittingType(null);
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
                    <Select
                        value={form.type}
                        onValueChange={(value) => handleFormChange('type', value)}
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
                            ? 'Managed branches now advance CNs from the CN Control tab.'
                            : 'Used only until a branch-specific CN range is assigned.'}
                    </p>
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
    );

    const renderCnControlTab = () => {
        if (!selectedBranch) {
            return null;
        }

        const activeRange = selectedBranch.active_cn_range;
        const latestRange = selectedBranch.latest_cn_range;
        const reservedRanges = selectedBranch.cn_reserved_ranges || [];
        const cnRanges = selectedBranch.cn_ranges || [];

        return (
            <div className="space-y-3 py-2">
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                        <div className="text-[11px] font-bold uppercase text-muted-foreground">Current CN Control</div>
                        <div className="mt-2 flex items-center gap-2">
                            {getCnControlBadge(selectedBranch)}
                        </div>
                        <div className="mt-3 text-sm text-muted-foreground">
                            {selectedBranch.cn_mode === 'range'
                                ? activeRange
                                    ? `Auto-entry is using ${formatRange(activeRange.range_start, activeRange.range_end)} for this branch.`
                                    : 'This branch needs a new active CN range before online CN entry can continue.'
                                : 'This branch is still using the legacy CN counter. Add a CN range to enforce branch-owned CN numbers.'}
                        </div>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="text-[11px] font-bold uppercase text-muted-foreground">Current Next CN</div>
                        <div className="mt-2 font-mono text-2xl font-semibold text-[#101828]">
                            {activeRange ? activeRange.next_cn_no : (selectedBranch.next_cn_no || '—')}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                            {activeRange
                                ? `Live range: ${formatRange(activeRange.range_start, activeRange.range_end)}`
                                : latestRange
                                    ? `Last managed range: ${formatRange(latestRange.range_start, latestRange.range_end)}`
                                    : 'No managed range yet'}
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                    <form onSubmit={(e) => handleCreateCnRange('system', e)} className="rounded-lg border p-3 space-y-3">
                        <div>
                            <div className="font-semibold text-[#101828]">Set Active CN Range</div>
                            <p className="text-sm text-muted-foreground">
                                Assign the next official CN block for this branch. The system will auto-increase inside this range only.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="system-range-start">Range Start</Label>
                                <Input
                                    id="system-range-start"
                                    type="number"
                                    required
                                    value={systemRangeForm.range_start}
                                    onChange={(e) => handleRangeFormChange('system', 'range_start', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="system-range-end">Range End</Label>
                                <Input
                                    id="system-range-end"
                                    type="number"
                                    required
                                    value={systemRangeForm.range_end}
                                    onChange={(e) => handleRangeFormChange('system', 'range_end', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="system-range-note">Note <span className="text-muted-foreground">(optional)</span></Label>
                            <Input
                                id="system-range-note"
                                placeholder="e.g. April 2026 branch allocation"
                                value={systemRangeForm.note}
                                onChange={(e) => handleRangeFormChange('system', 'note', e.target.value)}
                            />
                        </div>
                        <Button type="submit" disabled={rangeSubmittingType !== null}>
                            {rangeSubmittingType === 'system' ? 'Saving Range...' : 'Save Active Range'}
                        </Button>
                    </form>

                    <form onSubmit={(e) => handleCreateCnRange('physical', e)} className="rounded-lg border p-3 space-y-3">
                        <div>
                            <div className="font-semibold text-[#101828]">Reserve Physical Copy Block</div>
                            <p className="text-sm text-muted-foreground">
                                Mark printed or manual CN books for this branch so the online CN series skips those numbers.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="physical-range-start">Range Start</Label>
                                <Input
                                    id="physical-range-start"
                                    type="number"
                                    required
                                    value={physicalRangeForm.range_start}
                                    onChange={(e) => handleRangeFormChange('physical', 'range_start', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="physical-range-end">Range End</Label>
                                <Input
                                    id="physical-range-end"
                                    type="number"
                                    required
                                    value={physicalRangeForm.range_end}
                                    onChange={(e) => handleRangeFormChange('physical', 'range_end', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="physical-range-note">Note <span className="text-muted-foreground">(optional)</span></Label>
                            <Input
                                id="physical-range-note"
                                placeholder="e.g. Office printed book"
                                value={physicalRangeForm.note}
                                onChange={(e) => handleRangeFormChange('physical', 'note', e.target.value)}
                            />
                        </div>
                        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                            Physical ranges must stay inside a CN range already assigned to this branch.
                        </div>
                        <Button type="submit" disabled={rangeSubmittingType !== null}>
                            {rangeSubmittingType === 'physical' ? 'Saving Block...' : 'Reserve Physical Block'}
                        </Button>
                    </form>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="font-semibold text-[#101828]">Assigned CN Ranges</div>
                                <p className="text-sm text-muted-foreground">All branch-owned CN blocks for this branch.</p>
                            </div>
                            <Badge variant="outline">{cnRanges.length}</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                            {cnRanges.length > 0 ? cnRanges.map((range) => (
                                <div key={range.id} className="rounded-md border p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-mono font-semibold">{formatRange(range.range_start, range.range_end)}</div>
                                        <Badge
                                            variant="outline"
                                            className={
                                                range.status === 'active'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : range.status === 'exhausted'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-slate-50 text-slate-700 border-slate-200'
                                            }
                                        >
                                            {range.status}
                                        </Badge>
                                    </div>
                                    <div className="mt-2 text-sm text-muted-foreground">
                                        Next CN: <span className="font-mono text-foreground">{range.next_cn_no}</span>
                                    </div>
                                    {range.note && (
                                        <div className="mt-1 text-sm text-muted-foreground">{range.note}</div>
                                    )}
                                </div>
                            )) : (
                                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                    No managed CN ranges have been assigned to this branch yet.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="font-semibold text-[#101828]">Physical CN Reservations</div>
                                <p className="text-sm text-muted-foreground">Printed or offline CN blocks excluded from system auto-entry.</p>
                            </div>
                            <Badge variant="outline">{reservedRanges.length}</Badge>
                        </div>
                        <div className="mt-4 space-y-3">
                            {reservedRanges.length > 0 ? reservedRanges.map((range) => (
                                <div key={range.id} className="rounded-md border p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-mono font-semibold">{formatRange(range.range_start, range.range_end)}</div>
                                        <Badge className="bg-slate-100 text-slate-700 border-slate-200">Physical</Badge>
                                    </div>
                                    {range.note && (
                                        <div className="mt-2 text-sm text-muted-foreground">{range.note}</div>
                                    )}
                                </div>
                            )) : (
                                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                    No physical CN blocks are reserved for this branch yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#101828]">Branch Management</h2>
                    <p className="text-sm text-muted-foreground">
                        Manage your hubs, branch offices, and the CN number ranges assigned to each branch.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchBranches} disabled={loading} title="Refresh">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Dialog
                        open={isAddOpen}
                        onOpenChange={(open) => {
                            setIsAddOpen(open);
                            if (!open) {
                                resetDialogState();
                            }
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button
                                className="gap-2 shadow-sm"
                                onClick={() => {
                                    resetDialogState();
                                }}
                            >
                                <Plus className="h-4 w-4" />
                                Add Branch
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[760px] max-h-[90vh] my-4 flex flex-col overflow-hidden">
                            {selectedBranchId ? (
                                <Tabs value={dialogTab} onValueChange={(value) => setDialogTab(value as 'details' | 'cn')}>
                                    <DialogHeader>
                                        <DialogTitle>Edit Branch</DialogTitle>
                                        <DialogDescription>
                                            Update the branch details and manage the CN ranges reserved for this branch.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="details">Branch Details</TabsTrigger>
                                        <TabsTrigger value="cn">CN Control</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="details" className="overflow-y-auto max-h-[calc(90vh-140px)] pr-1">
                                        <form onSubmit={handleAddBranch}>
                                            {renderBranchFormFields()}
                                            <DialogFooter>
                                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={submitting}>
                                                    Cancel
                                                </Button>
                                                <Button type="submit" disabled={submitting}>
                                                    {submitting ? 'Updating...' : 'Update Branch'}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </TabsContent>

                                    <TabsContent value="cn" className="overflow-y-auto max-h-[calc(90vh-140px)] pr-1">
                                        {renderCnControlTab()}
                                    </TabsContent>
                                </Tabs>
                            ) : (
                                <form onSubmit={handleAddBranch}>
                                    <DialogHeader>
                                        <DialogTitle>Add New Branch</DialogTitle>
                                        <DialogDescription>
                                            Create a new branch or hub location. After the branch is created you can assign its CN range from the edit dialog.
                                        </DialogDescription>
                                    </DialogHeader>
                                    {renderBranchFormFields()}
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={submitting}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={submitting}>
                                            {submitting ? 'Creating...' : 'Create Branch'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm max-w-md">
                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                <Input
                    placeholder="Search branches by name, code or city..."
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
                                        <div className="space-y-2">
                                            {getCnControlBadge(branch)}
                                            <div className="text-xs text-muted-foreground">{getCnStatusText(branch)}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <div className="font-mono font-semibold text-[#101828]">
                                                {branch.active_cn_range ? branch.active_cn_range.next_cn_no : (branch.next_cn_no || '—')}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {branch.active_cn_range
                                                    ? formatRange(branch.active_cn_range.range_start, branch.active_cn_range.range_end)
                                                    : branch.latest_cn_range
                                                        ? formatRange(branch.latest_cn_range.range_start, branch.latest_cn_range.range_end)
                                                        : 'Legacy only'}
                                            </div>
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
                            Each branch should have its own assigned CN range. Physical-copy blocks can be reserved only inside that branch range, and the online CN counter will skip those reserved numbers.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
