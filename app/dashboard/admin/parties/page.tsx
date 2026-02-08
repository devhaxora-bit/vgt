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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface Party {
    id: string;
    code: string;
    name: string;
    type: 'consignor' | 'consignee' | 'both';
    gstin: string;
    address: string;
    pincode: string;
    phone: string;
    email: string;
    status: 'active' | 'inactive';
}

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
            pincode: '403722',
            phone: '9876543210',
            email: 'admin@acme.com',
            status: 'active'
        },
        {
            id: '2',
            code: '100002',
            name: 'Bharat Logistics',
            type: 'consignee',
            gstin: '27BBABA5678B2Z2',
            address: 'Main St, Near Station',
            pincode: '403001',
            phone: '9822113344',
            email: 'ops@bharat.in',
            status: 'active'
        }
    ]);

    const filteredParties = parties.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.includes(searchTerm) ||
        p.gstin.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Party Management</h1>
                    <p className="text-muted-foreground">Manage your consignors, consignees, and billing parties.</p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" /> Add New Party
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Add New Party</DialogTitle>
                            <DialogDescription>
                                Enter the details of the party. The party code will be automatically generated as a 6-digit number.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Party Name</Label>
                                <Input id="name" placeholder="Enter party name" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Party Type</Label>
                                <Select defaultValue="both">
                                    <SelectTrigger id="type">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="consignor">Consignor Only</SelectItem>
                                        <SelectItem value="consignee">Consignee Only</SelectItem>
                                        <SelectItem value="both">Both (Consignor & Consignee)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code">Party Code (6 Digits)</Label>
                                <Input id="code" placeholder="100003" defaultValue="100003" readOnly className="bg-slate-50" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gstin">GST Number</Label>
                                <Input id="gstin" placeholder="27XXXXX0000X0Z0" className="font-mono uppercase" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="address">Full Address</Label>
                                <Input id="address" placeholder="Address line 1, Area, Landmark" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pincode">Pincode</Label>
                                <Input id="pincode" placeholder="6-digit PIN" maxLength={6} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone / Mobile</Label>
                                <Input id="phone" placeholder="10-digit mobile" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input id="email" type="email" placeholder="email@example.com" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                            <Button onClick={() => setIsAddDialogOpen(false)}>Save Party</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
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
