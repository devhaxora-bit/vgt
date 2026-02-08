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

export default function PartiesPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    // Mock data
    const [parties, setParties] = useState<Party[]>([
        {
            id: '1',
            code: '100001',
            name: 'ACME Corporation',
            type: 'both',
            gstin: '27AAACA1234A1Z1',
            address: 'Industrial Area, Phase II',
            city: 'Goa',
            state: 'Goa',
            pincode: '403722',
            phone: '9876543210',
            email: 'admin@acme.com',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: '2',
            code: '100002',
            name: 'Bharat Logistics',
            type: 'consignee',
            gstin: '27BBABA5678B2Z2',
            address: 'Main St, Near Station',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '403001',
            phone: '9822113344',
            email: 'ops@bharat.in',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ]);

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
                <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Party
                </Button>
                <AddPartyDialog
                    open={isAddDialogOpen}
                    onOpenChange={setIsAddDialogOpen}
                    onSave={(newParty) => {
                        setParties([...parties, newParty]);
                        // In a real app, this would also save to backend
                    }}
                />
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <CardTitle className="text-lg">Party List</CardTitle>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search name, code, GST..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon">
                                <Filter className="h-4 w-4" />
                            </Button>
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
                                {filteredParties.map((party) => (
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
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
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
        </div>
    );
}
