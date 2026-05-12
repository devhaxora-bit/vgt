'use client';

import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Edit, Trash2, Phone, MapPin, Hash, Loader2, RefreshCw
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Broker {
    id: string;
    code: string;
    name: string;
    mobile?: string;
    address?: string;
    is_active: boolean;
}

const emptyForm = { code: '', name: '', mobile: '', address: '' };

export default function BrokersAdminPage() {
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Broker | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [isSaving, setIsSaving] = useState(false);

    const fetchBrokers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/brokers');
            const data = await res.json();
            setBrokers(data);
        } catch {
            toast.error('Failed to load brokers');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchBrokers(); }, []);

    const openAdd = () => {
        setEditing(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (b: Broker) => {
        setEditing(b);
        setForm({ code: b.code, name: b.name, mobile: b.mobile || '', address: b.address || '' });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.code.trim() || !form.name.trim()) {
            toast.error('Code and Name are required');
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

    const filtered = brokers.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Broker Management</h1>
                    <p className="text-muted-foreground">Add and manage transport brokers. Their details auto-fill in Challan entry.</p>
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
                                    placeholder="Search name or code..."
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
                                    <TableHead>Mobile</TableHead>
                                    <TableHead>Address</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right sticky right-0 bg-slate-50 z-10 border-l">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading brokers...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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

            {/* Add / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Broker' : 'Add New Broker'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Broker Code *</Label>
                                <Input
                                    className="h-9 text-sm uppercase"
                                    placeholder="e.g. BRK001"
                                    value={form.code}
                                    onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Mobile</Label>
                                <Input
                                    className="h-9 text-sm"
                                    placeholder="Phone number"
                                    value={form.mobile}
                                    onChange={(e) => setForm(f => ({ ...f, mobile: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Broker Name *</Label>
                            <Input
                                className="h-9 text-sm"
                                placeholder="Full name"
                                value={form.name}
                                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Address</Label>
                            <Input
                                className="h-9 text-sm"
                                placeholder="Full address"
                                value={form.address}
                                onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
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
