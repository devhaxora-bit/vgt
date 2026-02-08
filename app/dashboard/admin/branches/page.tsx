'use client';

import React, { useState } from 'react';
import { Plus, Search, MapPin, Building2, MoreHorizontal } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Dummy data for branches
const initialBranches = [
    { id: 1, code: 'MRG', name: 'Margao Hub', type: 'Hub', city: 'Margao', state: 'Goa', status: 'Active' },
    { id: 2, code: 'PNJ', name: 'Panjim Branch', type: 'Branch', city: 'Panjim', state: 'Goa', status: 'Active' },
    { id: 3, code: 'VZG', name: 'Vasco Branch', type: 'Branch', city: 'Vasco', state: 'Goa', status: 'Active' },
    { id: 4, code: 'MAP', name: 'Mapusa Hub', type: 'Hub', city: 'Mapusa', state: 'Goa', status: 'Active' },
    { id: 5, code: 'PND', name: 'Ponda Branch', type: 'Branch', city: 'Ponda', state: 'Goa', status: 'Inactive' },
];

export default function BranchManagementPage() {
    const [branches, setBranches] = useState(initialBranches);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Filter branches
    const filteredBranches = branches.filter(branch =>
        branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.city.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddBranch = (e: React.FormEvent) => {
        e.preventDefault();
        // Here we would typically make an API call
        toast.success('Branch added successfully (Mock)');
        setIsAddOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#101828]">Branch Management</h2>
                    <p className="text-sm text-muted-foreground">Manage your hubs and branch offices across locations.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 shadow-sm">
                            <Plus className="h-4 w-4" />
                            Add Branch
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleAddBranch}>
                            <DialogHeader>
                                <DialogTitle>Add New Branch</DialogTitle>
                                <DialogDescription>
                                    Create a new branch or hub location.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="code">Branch Code</Label>
                                        <Input id="code" placeholder="e.g. BLR" required className="uppercase" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="type">Type</Label>
                                        <Select defaultValue="branch">
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="hub">Hub</SelectItem>
                                                <SelectItem value="branch">Branch</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Branch Name</Label>
                                    <Input id="name" placeholder="e.g. Bangalore Central" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="city">City</Label>
                                        <Input id="city" placeholder="City" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="state">State</Label>
                                        <Input id="state" placeholder="State" required />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Contact Phone</Label>
                                    <Input id="phone" placeholder="+91-..." />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                                <Button type="submit">Create Branch</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
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
                        {filteredBranches.length > 0 ? (
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
                                            branch.status === 'Active'
                                                ? "bg-green-50 text-green-700 border-green-200"
                                                : "bg-red-50 text-red-700 border-red-200"
                                        }>
                                            {branch.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
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
