'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit,
    Trash2,
    MapPin,
    Phone,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    RefreshCw,
    Loader2,
    Building2,
} from 'lucide-react';
import { AddPartyDialog } from '@/components/AddPartyDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Party } from '@/lib/types/party.types';
import { getParties, deleteParty } from '@/lib/services/party.service';
import { toast } from 'sonner';
import { canManageMasterData } from '@/lib/branchAccess';
import { useCurrentUserScope } from '@/lib/hooks/useCurrentUserScope';

type SortField = 'code' | 'name' | 'branch_code' | 'city' | 'gstin';
type SortDir = 'asc' | 'desc';

export default function PartiesPage() {
    const userScope = useCurrentUserScope();
    const canManage = canManageMasterData({ role: userScope.role, branch_access: userScope.branchAccess });
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [editingParty, setEditingParty] = useState<Party | undefined>();
    const [parties, setParties] = useState<Party[]>([]);
    const [sortField, setSortField] = useState<SortField>('code');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);

    const fetchParties = async () => {
        setIsLoading(true);
        try {
            const data = await getParties();
            setParties(data);
        } catch (error) {
            console.error('Failed to fetch parties:', error);
            toast.error('Failed to load parties');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchParties();
    }, []);

    useEffect(() => {
        fetch('/api/references/branches')
            .then(r => r.json())
            .then((data: { code: string; name: string }[]) => {
                setBranchOptions(data.map(b => ({ value: b.code, label: `${b.code} – ${b.name}` })));
            })
            .catch(console.error);
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await deleteParty(id);
            toast.success('Party deleted successfully');
            fetchParties();
        } catch (error) {
            console.error('Failed to delete party:', error);
            toast.error('Failed to delete party');
        }
    };

    const handleEdit = (party: Party) => {
        setEditingParty(party);
        setIsAddDialogOpen(true);
    };

    const handleAddNew = () => {
        setEditingParty(undefined);
        setIsAddDialogOpen(true);
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 inline text-muted-foreground/40" />;
        return sortDir === 'asc'
            ? <ArrowUp className="h-3.5 w-3.5 ml-1 inline text-primary" />
            : <ArrowDown className="h-3.5 w-3.5 ml-1 inline text-primary" />;
    };

    const filteredParties = useMemo(() => {
        let list = [...parties];

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.code.includes(q) ||
                (p.gstin && p.gstin.toLowerCase().includes(q)) ||
                (p.branch_code && p.branch_code.toLowerCase().includes(q))
            );
        }

        list.sort((a, b) => {
            let va: string = '';
            let vb: string = '';

            switch (sortField) {
                case 'code':     va = a.code || ''; vb = b.code || ''; break;
                case 'name':     va = a.name || ''; vb = b.name || ''; break;
                case 'branch_code': va = a.branch_code || ''; vb = b.branch_code || ''; break;
                case 'city':     va = a.city || ''; vb = b.city || ''; break;
                case 'gstin':    va = a.gstin || ''; vb = b.gstin || ''; break;
            }

            const cmp = va.localeCompare(vb);
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return list;
    }, [parties, searchTerm, sortField, sortDir]);

    const SortableHead = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
        <TableHead
            className={`cursor-pointer select-none hover:bg-slate-100 transition-colors ${className ?? ''}`}
            onClick={() => toggleSort(field)}
        >
            {children}
            <SortIcon field={field} />
        </TableHead>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Party Management</h1>
                    <p className="text-muted-foreground">Manage all your parties.</p>
                </div>
                <Button onClick={handleAddNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Party
                </Button>
                <AddPartyDialog
                    open={isAddDialogOpen}
                    onOpenChange={setIsAddDialogOpen}
                    editParty={editingParty}
                    branchOptions={branchOptions}
                    onSave={() => {
                        fetchParties();
                        toast.success(`Party ${editingParty ? 'updated' : 'created'} successfully`);
                    }}
                />
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <CardTitle className="text-lg">
                            Party List
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                {filteredParties.length} of {parties.length}
                            </span>
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-2"
                                onClick={fetchParties}
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search name, code, GST, branch..."
                                    className="pl-9 h-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <SortableHead field="code" className="w-[110px]">Code</SortableHead>
                                        <SortableHead field="name">Party Name</SortableHead>
                                        <SortableHead field="branch_code" className="w-[130px]">Branch</SortableHead>
                                        <SortableHead field="gstin" className="w-[180px]">GSTIN</SortableHead>
                                        <SortableHead field="city" className="w-[150px]">Location</SortableHead>
                                        <TableHead className="text-right sticky right-0 bg-slate-50 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.02)] border-l w-[120px]">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" /> Fetching parties...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredParties.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                No parties found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredParties.map((party) => (
                                            <TableRow key={party.id} className="group hover:bg-slate-50/80 transition-colors">
                                                <TableCell className="font-mono font-bold text-primary">{party.code}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-[#101828]">{party.name}</div>
                                                    {party.phone && (
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                            <Phone className="h-3 w-3" /> {party.phone}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {party.branch_code ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                            <span className="font-mono text-xs font-semibold">{party.branch_code}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground/40 text-xs">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{party.gstin || <span className="text-muted-foreground/40">—</span>}</TableCell>
                                                <TableCell>
                                                    <div className="text-xs flex flex-col">
                                                        {party.city && <span className="font-medium">{party.city}</span>}
                                                        {party.pincode && (
                                                            <span className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                <MapPin className="h-3 w-3" /> {party.pincode}
                                                            </span>
                                                        )}
                                                        {!party.city && !party.pincode && <span className="text-muted-foreground/40">—</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right sticky right-0 bg-white z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.02)] border-l group-hover:bg-slate-50/80 transition-colors">
                                                    {canManage ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                                            onClick={() => handleEdit(party)}
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleDelete(party.id, party.name)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">View only</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {filteredParties.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-3 px-1">
                            Sorted by <span className="font-semibold capitalize">{sortField.replace('_', ' ')}</span> ({sortDir === 'asc' ? 'ascending' : 'descending'}) · Click any column header to sort
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
