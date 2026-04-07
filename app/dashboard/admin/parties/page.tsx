'use client';

import React, { useState } from 'react';
import {
    Building,
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Edit,
    Trash2,
    MapPin,
    Phone,
    Mail,
    Hash
} from 'lucide-react';
import { AddPartyDialog } from '@/components/AddPartyDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';


import { Party } from '@/lib/types/party.types';
import { getParties, deleteParty } from '@/lib/services/party.service';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function PartiesPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [editingParty, setEditingParty] = useState<Party | undefined>();
    const [parties, setParties] = useState<Party[]>([]);

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

    React.useEffect(() => {
        fetchParties();
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

    const filteredParties = parties.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.includes(searchTerm) ||
        (p.gstin && p.gstin.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Party Management</h1>
                    <p className="text-muted-foreground">Manage your consignors, consignees, and billing parties.</p>
                </div>
                <Button onClick={handleAddNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Party
                </Button>
                <AddPartyDialog
                    open={isAddDialogOpen}
                    onOpenChange={setIsAddDialogOpen}
                    editParty={editingParty}
                    onSave={() => {
                        fetchParties();
                        toast.success(`Party ${editingParty ? 'updated' : 'created'} successfully`);
                    }}
                />
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <CardTitle className="text-lg">Party List</CardTitle>
                        <div className="flex items-center gap-2 w-full md:w-auto">
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
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search name, code, GST..."
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
                                    <TableHead className="w-[100px]">Code</TableHead>
                                    <TableHead>Party Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>GSTIN</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
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
                                        <TableRow key={party.id}>
                                            <TableCell className="font-mono font-bold text-primary">{party.code}</TableCell>
                                            <TableCell>
                                                <div className="font-medium text-[#101828]">{party.name}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Phone className="h-3 w-3" /> {party.phone}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {party.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{party.gstin}</TableCell>
                                            <TableCell>
                                                <div className="text-xs flex flex-col">
                                                    <span>{party.address}</span>
                                                    <span className="text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                                                        <MapPin className="h-3 w-3" /> {party.pincode}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-8 gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                                        onClick={() => handleEdit(party)}
                                                    >
                                                        <Edit className="h-3.5 w-3.5" />
                                                        <span>Edit</span>
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
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
