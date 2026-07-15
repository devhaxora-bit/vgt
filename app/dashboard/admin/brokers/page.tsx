'use client';

import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Edit, Trash2, Phone, MapPin, Hash, Loader2, RefreshCw, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCurrentUserScope } from '@/lib/hooks/useCurrentUserScope';

interface Broker {
    id: string;
    code: string;
    name: string;
    mobile?: string;
    address?: string;
    branch_code: string;
    is_active: boolean;
}

type BranchOption = {
    code: string;
    name: string;
    is_head_branch?: boolean;
};

const emptyForm = { code: '', name: '', mobile: '', address: '', branch_code: '' };

export default function BrokersAdminPage() {
    const userScope = useCurrentUserScope();
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Broker | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [isSaving, setIsSaving] = useState(false);

    const headBranchCode = branches.find((b) => b.is_head_branch)?.code || branches[0]?.code || '';
    const defaultBranchCode = userScope.branchCode || headBranchCode;

    const fetchBranches = async () => {
        try {
            const res = await fetch('/api/references/branches');
            if (!res.ok) throw new Error('Failed to load branches');
            const data = await res.json();
            const options: BranchOption[] = (Array.isArray(data) ? data : [])
                .filter((b: { code?: string }) => Boolean(b.code))
                .map((b: { code: string; name?: string; is_head_branch?: boolean }) => ({
                    code: String(b.code).trim().toUpperCase(),
                    name: String(b.name || b.code).trim(),
                    is_head_branch: Boolean(b.is_head_branch),
                }))
                .sort((a: BranchOption, b: BranchOption) => {
                    if (a.is_head_branch && !b.is_head_branch) return -1;
                    if (!a.is_head_branch && b.is_head_branch) return 1;
                    return a.name.localeCompare(b.name);
                });
            setBranches(options);
        } catch {
            toast.error('Failed to load branches');
            setBranches([]);
        }
    };

    const fetchBrokers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/brokers');
            const data = await res.json();
            setBrokers(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Failed to load brokers');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void fetchBranches();
        void fetchBrokers();
    }, []);

    const openAdd = () => {
        setEditing(null);
        setForm({ ...emptyForm, branch_code: defaultBranchCode });
        setDialogOpen(true);
    };

    const openEdit = (b: Broker) => {
        setEditing(b);
        setForm({
            code: b.code,
            name: b.name,
            mobile: b.mobile || '',
            address: b.address || '',
            branch_code: b.branch_code || defaultBranchCode,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.code.trim() || !form.name.trim()) {
            toast.error('Code and Name are required');
            return;
        }
        if (!form.branch_code.trim()) {
            toast.error('Branch is required');
            return;
        }
        setIsSaving(true);
        try {
            const url = editing ? `/api/brokers/${editing.id}` : '/api/brokers';
            const method = editing ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Save failed');
            }
            toast.success(`Broker ${editing ? 'updated' : 'added'} successfully`);
            setDialogOpen(false);
            fetchBrokers();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (b: Broker) => {
        if (!confirm(`Deactivate broker "${b.name}"?`)) return;
        try {
            const res = await fetch(`/api/brokers/${b.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            toast.success('Broker deactivated');
            fetchBrokers();
        } catch {
            toast.error('Failed to deactivate broker');
        }
    };

    const branchLabel = (code?: string) => {
        if (!code) return '—';
        const match = branches.find((b) => b.code === code);
        return match ? `${match.name} (${match.code})` : code;
    };

    const filtered = brokers.filter((b) =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.branch_code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Broker Management</h1>
                    <p className="text-muted-foreground">
                        Brokers are branch-specific. Their details auto-fill in Challan entry.
                    </p>
                </div>
                <Button onClick={openAdd}>
                    <Plus className="mr-2 h-4 w-4" /> Add Broker
                </Button>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <CardTitle className="text-lg">Broker List</CardTitle>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={fetchBrokers} disabled={isLoading}>
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search name, code or branch..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[120px]">Code</TableHead>
                                    <TableHead>Broker Name</TableHead>
                                    <TableHead>Branch</TableHead>
                                    <TableHead>Mobile</TableHead>
                                    <TableHead>Address</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right sticky right-0 bg-slate-50 z-10 border-l">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading brokers...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            No brokers found.
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.map((b) => (
                                    <TableRow key={b.id}>
                                        <TableCell>
                                            <span className="font-mono font-bold text-primary flex items-center gap-1">
                                                <Hash className="h-3 w-3" />{b.code}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium">{b.name}</TableCell>
                                        <TableCell>
                                            <span className="flex items-center gap-1 text-sm">
                                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="font-mono text-xs font-semibold">{b.branch_code || '—'}</span>
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {b.mobile && (
                                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                                    <Phone className="h-3 w-3" /> {b.mobile}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {b.address && (
                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <MapPin className="h-3 w-3" /> {b.address}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={b.is_active ? 'default' : 'secondary'}>
                                                {b.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right sticky right-0 bg-white border-l">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="outline" size="sm"
                                                    className="h-8 gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                                    onClick={() => openEdit(b)}
                                                >
                                                    <Edit className="h-3.5 w-3.5" /> Edit
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(b)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Broker' : 'Add New Broker'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Branch *</Label>
                            <Select
                                value={form.branch_code}
                                onValueChange={(value) => setForm((f) => ({ ...f, branch_code: value }))}
                                disabled={userScope.isBranchScoped}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map((b) => (
                                        <SelectItem key={b.code} value={b.code}>
                                            {b.name} ({b.code}){b.is_head_branch ? ' · Main' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">
                                This broker belongs only to {branchLabel(form.branch_code)}.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Broker Code *</Label>
                                <Input
                                    className="h-9 text-sm uppercase"
                                    placeholder="e.g. BRK001"
                                    value={form.code}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Mobile</Label>
                                <Input
                                    className="h-9 text-sm"
                                    placeholder="Phone number"
                                    value={form.mobile}
                                    onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Broker Name *</Label>
                            <Input
                                className="h-9 text-sm"
                                placeholder="Full name"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Address</Label>
                            <Input
                                className="h-9 text-sm"
                                placeholder="Full address"
                                value={form.address}
                                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            {editing ? 'Update' : 'Save'} Broker
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
