'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Truck, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Vehicle {
    id: string;
    vehicle_no: string;
    vehicle_type: string;
    vehicle_make: string;
    vehicle_model: string;
    engine_no: string;
    chasis_no: string;
    permit_no: string;
    permit_validity: string;
    owner_name: string;
    owner_mobile: string;
    owner_pan: string;
    owner_address: string;
    owner_tel: string;
    insurance_policy_no: string;
    insurance_validity: string;
    insurance_company: string;
    insurance_city: string;
    finance_detail: string;
    is_active: boolean;
}

const emptyForm = {
    vehicle_no: '', vehicle_type: 'open', vehicle_make: '', vehicle_model: '',
    engine_no: '', chasis_no: '', permit_no: '', permit_validity: '',
    owner_name: '', owner_mobile: '', owner_pan: '', owner_address: '', owner_tel: '',
    insurance_policy_no: '', insurance_validity: '', insurance_company: '',
    insurance_city: '', finance_detail: '',
};

const labelCls = 'text-[11px] font-bold uppercase text-muted-foreground';
const inputCls = 'h-9 text-sm';

export default function VehiclesAdminPage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Vehicle | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [isSaving, setIsSaving] = useState(false);

    const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

    const fetchVehicles = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/vehicles');
            const data = await res.json();
            setVehicles(Array.isArray(data) ? data : []);
        } catch { toast.error('Failed to load vehicles'); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchVehicles(); }, []);

    const openAdd = () => { setEditing(null); setForm({ ...emptyForm }); setDialogOpen(true); };

    const openEdit = (v: Vehicle) => {
        setEditing(v);
        const d = (s?: string) => s?.split('T')[0] || '';
        setForm({
            vehicle_no: v.vehicle_no || '', vehicle_type: v.vehicle_type || 'open',
            vehicle_make: v.vehicle_make || '', vehicle_model: v.vehicle_model || '',
            engine_no: v.engine_no || '', chasis_no: v.chasis_no || '',
            permit_no: v.permit_no || '', permit_validity: d(v.permit_validity),
            owner_name: v.owner_name || '', owner_mobile: v.owner_mobile || '',
            owner_pan: v.owner_pan || '', owner_address: v.owner_address || '', owner_tel: v.owner_tel || '',
            insurance_policy_no: v.insurance_policy_no || '', insurance_validity: d(v.insurance_validity),
            insurance_company: v.insurance_company || '', insurance_city: v.insurance_city || '',
            finance_detail: v.finance_detail || '',
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.vehicle_no.trim()) { toast.error('Vehicle No is required'); return; }
        setIsSaving(true);
        try {
            const url = editing ? `/api/vehicles/${editing.id}` : '/api/vehicles';
            const method = editing ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
            toast.success(`Vehicle ${editing ? 'updated' : 'added'} successfully`);
            setDialogOpen(false);
            fetchVehicles();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Save failed');
        } finally { setIsSaving(false); }
    };

    const handleDelete = async (v: Vehicle) => {
        if (!confirm(`Deactivate vehicle "${v.vehicle_no}"?`)) return;
        try {
            await fetch(`/api/vehicles/${v.id}`, { method: 'DELETE' });
            toast.success('Vehicle deactivated'); fetchVehicles();
        } catch { toast.error('Failed to deactivate'); }
    };

    const filtered = vehicles.filter(v =>
        v.vehicle_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Vehicle Management</h1>
                    <p className="text-muted-foreground">Add and manage vehicles. All details auto-fill in Challan entry (read-only).</p>
                </div>
                <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Vehicle</Button>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Truck className="h-5 w-5 text-primary" /> Vehicle List
                        </CardTitle>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={fetchVehicles} disabled={isLoading}>
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                            </Button>
                            <div className="relative flex-1 md:w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search vehicle no or owner..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Vehicle No</TableHead>
                                    <TableHead>Type / Make</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Mobile</TableHead>
                                    <TableHead>PAN</TableHead>
                                    <TableHead>Permit Valid</TableHead>
                                    <TableHead>Insurance Valid</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right sticky right-0 bg-slate-50 border-l">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={10} className="h-24 text-center">
                                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                        </div>
                                    </TableCell></TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">No vehicles found.</TableCell></TableRow>
                                ) : filtered.map((v) => (
                                    <TableRow key={v.id}>
                                        <TableCell className="font-mono font-bold text-primary">{v.vehicle_no}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <Badge variant="outline" className="w-fit text-[10px] capitalize">{v.vehicle_type}</Badge>
                                                <span className="text-xs text-muted-foreground">{v.vehicle_make || '—'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{v.owner_name || '—'}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{v.owner_mobile || '—'}</TableCell>
                                        <TableCell className="font-mono text-xs">{v.owner_pan || '—'}</TableCell>
                                        <TableCell className="text-xs">{v.permit_validity?.split('T')[0] || '—'}</TableCell>
                                        <TableCell className="text-xs">{v.insurance_validity?.split('T')[0] || '—'}</TableCell>
                                        <TableCell>
                                            <Badge variant={v.is_active ? 'default' : 'secondary'}>{v.is_active ? 'Active' : 'Inactive'}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right sticky right-0 bg-white border-l">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-blue-600 hover:bg-blue-50 border-blue-200" onClick={() => openEdit(v)}>
                                                    <Edit className="h-3.5 w-3.5" /> Edit
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleDelete(v)}>
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
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5" />{editing ? 'Edit Vehicle' : 'Add New Vehicle'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-2">

                        {/* ── Vehicle Identity ── */}
                        <div>
                            <p className={labelCls + ' mb-3 block'}>Vehicle Details</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1 md:col-span-2">
                                    <Label className={labelCls}>Vehicle No *</Label>
                                    <Input className={inputCls + ' uppercase font-mono font-bold'} value={form.vehicle_no}
                                        onChange={(e) => set('vehicle_no', e.target.value.toUpperCase())} placeholder="e.g. MH12AB1234" />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Vehicle Type</Label>
                                    <Select value={form.vehicle_type} onValueChange={(v) => set('vehicle_type', v)}>
                                        <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="open">Open Body</SelectItem>
                                            <SelectItem value="container">Container</SelectItem>
                                            <SelectItem value="trailer">Trailer</SelectItem>
                                            <SelectItem value="tanker">Tanker</SelectItem>
                                            <SelectItem value="flatbed">Flatbed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Vehicle Make</Label>
                                    <Input className={inputCls} value={form.vehicle_make} onChange={(e) => set('vehicle_make', e.target.value)} placeholder="e.g. TATA MOTORS" />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Vehicle Model</Label>
                                    <Input className={inputCls} value={form.vehicle_model} onChange={(e) => set('vehicle_model', e.target.value)} placeholder="e.g. LPT 1613" />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Engine No</Label>
                                    <Input className={inputCls} value={form.engine_no} onChange={(e) => set('engine_no', e.target.value)} placeholder="Engine No" />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Chasis No</Label>
                                    <Input className={inputCls} value={form.chasis_no} onChange={(e) => set('chasis_no', e.target.value)} placeholder="Chasis No" />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Permit No</Label>
                                    <Input className={inputCls} value={form.permit_no} onChange={(e) => set('permit_no', e.target.value)} placeholder="Permit No" />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Permit Validity</Label>
                                    <Input type="date" className={inputCls} value={form.permit_validity} onChange={(e) => set('permit_validity', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* ── Owner Details ── */}
                        <div className="border rounded-md p-4 bg-slate-50/50">
                            <p className={labelCls + ' mb-3 block'}>Vehicle Owner Details</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1 md:col-span-2">
                                    <Label className={labelCls}>Owner Name</Label>
                                    <Input className={inputCls} value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} placeholder="Full Name" />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Mobile</Label>
                                    <Input className={inputCls} value={form.owner_mobile} onChange={(e) => set('owner_mobile', e.target.value)} placeholder="Mobile No" />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Tel No</Label>
                                    <Input className={inputCls} value={form.owner_tel} onChange={(e) => set('owner_tel', e.target.value)} placeholder="Tel No" />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>PAN No</Label>
                                    <Input className={inputCls + ' uppercase'} value={form.owner_pan} onChange={(e) => set('owner_pan', e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
                                </div>
                                <div className="space-y-1 md:col-span-3">
                                    <Label className={labelCls}>Address</Label>
                                    <Input className={inputCls} value={form.owner_address} onChange={(e) => set('owner_address', e.target.value)} placeholder="Full address" />
                                </div>
                            </div>
                        </div>

                        {/* ── Insurance ── */}
                        <div className="border rounded-md p-4 bg-slate-50/50">
                            <p className={labelCls + ' mb-3 block'}>Insurance Details</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1 md:col-span-2">
                                    <Label className={labelCls}>Policy No</Label>
                                    <Input className={inputCls} value={form.insurance_policy_no} onChange={(e) => set('insurance_policy_no', e.target.value)} placeholder="Policy No" />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Insurance Validity</Label>
                                    <Input type="date" className={inputCls} value={form.insurance_validity} onChange={(e) => set('insurance_validity', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className={labelCls}>Insurance City</Label>
                                    <Input className={inputCls} value={form.insurance_city} onChange={(e) => set('insurance_city', e.target.value)} placeholder="City" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <Label className={labelCls}>Insurance Company</Label>
                                    <Input className={inputCls} value={form.insurance_company} onChange={(e) => set('insurance_company', e.target.value)} placeholder="Company name" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <Label className={labelCls}>Finance Detail</Label>
                                    <Input className={inputCls} value={form.finance_detail} onChange={(e) => set('finance_detail', e.target.value)} placeholder="Financer / bank detail" />
                                </div>
                            </div>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {editing ? 'Update' : 'Save'} Vehicle
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
