'use client';

import React, { useState } from 'react';
import { Plus, Search, User, Mail, Shield, MoreHorizontal, Building2 } from 'lucide-react';
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

// Dummy data mirroring seed-users.ts
const initialUsers = [
    { id: 1, code: 'EMP001', name: 'System Administrator', email: 'admin@vgt.com', role: 'admin', dept: 'IT', status: 'Active' },
    { id: 2, code: 'EMP002', name: 'John Doe', email: 'employee@vgt.com', role: 'employee', dept: 'Operations', status: 'Active' },
    { id: 3, code: 'AGT001', name: 'Jane Smith', email: 'agent@vgt.com', role: 'agent', dept: 'Sales', status: 'Active' },
    { id: 4, code: 'EMP003', name: 'Sarah Wilson', email: 'sarah@vgt.com', role: 'employee', dept: 'Finance', status: 'Inactive' },
];

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pencil, KeyRound, Ban } from 'lucide-react';

export default function UserManagementPage() {
    const [users, setUsers] = useState(initialUsers);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Form States
    const [mode, setMode] = useState<'create' | 'edit'>('create');
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedRole, setSelectedRole] = useState('employee');
    const [generatedCode, setGeneratedCode] = useState('');

    // Edit State
    const [editingUser, setEditingUser] = useState<any>(null);

    // Dummy branches for dropdown
    const branches = [
        { code: 'MRG', name: 'Margao Hub' },
        { code: 'PNJ', name: 'Panjim Branch' },
        { code: 'VZG', name: 'Vasco Branch' },
        { code: 'MAP', name: 'Mapusa Hub' },
        { code: 'HO', name: 'Head Office' },
    ];

    // Filter users
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const generateCode = (branchCode: string, role: string) => {
        if (!branchCode) return '';

        const rolePrefix = role === 'admin' ? 'ADM' : role === 'agent' ? 'AGT' : 'EMP';
        const randomNum = Math.floor(100 + Math.random() * 900); // 3 digit random
        return `${branchCode}-${rolePrefix}-${randomNum}`;
    };

    const handleBranchChange = (value: string) => {
        setSelectedBranch(value);
        const code = generateCode(value, selectedRole);
        setGeneratedCode(code);
    };

    const handleRoleChange = (value: string) => {
        setSelectedRole(value);
        if (selectedBranch) {
            const code = generateCode(selectedBranch, value);
            setGeneratedCode(code);
        }
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        const action = mode === 'create' ? 'invite sent' : 'profile updated';
        toast.success(`User ${generatedCode} ${action} successfully (Mock)`);
        setIsAddOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setSelectedBranch('');
        setSelectedRole('employee');
        setGeneratedCode('');
        setEditingUser(null);
        setMode('create');
    };

    const openEditModel = (user: any) => {
        setMode('edit');
        setEditingUser(user);
        // Reverse engineer mock data to set dropdowns
        const branchCode = user.dept === 'IT' ? 'HO' : 'MRG';
        setSelectedBranch(branchCode);
        setSelectedRole(user.role);
        setGeneratedCode(user.code);
        setIsAddOpen(true);
    };

    const handlePasswordReset = () => {
        toast.success(`Password reset email sent to ${editingUser.email}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#101828]">User Management</h2>
                    <p className="text-sm text-muted-foreground">Manage authorized users, roles, and branch assignments.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={(open) => {
                    setIsAddOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 shadow-sm" onClick={() => setMode('create')}>
                            <Plus className="h-4 w-4" />
                            Add User
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleAddUser}>
                            <DialogHeader>
                                <DialogTitle>{mode === 'create' ? 'Add New User' : 'Edit User Profile'}</DialogTitle>
                                <DialogDescription>
                                    {mode === 'create'
                                        ? 'Assign user to a branch and role. Employee Code is auto-generated.'
                                        : 'Update user details or reset password.'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                {/* Only show Branch/Role/Code fields if Creating or if needed for Edit context (usually read-only in edit) */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="branch">Branch</Label>
                                        <Select
                                            onValueChange={handleBranchChange}
                                            value={selectedBranch}
                                            disabled={mode === 'edit'} // Lock branch on edit for now
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Branch" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {branches.map(b => (
                                                    <SelectItem key={b.code} value={b.code}>
                                                        {b.name} ({b.code})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="role">Role</Label>
                                        <Select
                                            value={selectedRole}
                                            onValueChange={handleRoleChange}
                                            disabled={mode === 'edit'} // Lock role on edit for now
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="employee">Employee</SelectItem>
                                                <SelectItem value="agent">Agent</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="code">Employee ID</Label>
                                    <div className="relative">
                                        <Input
                                            id="code"
                                            value={generatedCode}
                                            readOnly
                                            className="bg-slate-50 font-mono text-primary font-bold"
                                            placeholder="Select Branch & Role first..."
                                        />
                                        <Shield className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="John Doe"
                                        required
                                        defaultValue={editingUser?.name}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="john@company.com"
                                        required
                                        defaultValue={editingUser?.email}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="dept">Department</Label>
                                        <Select defaultValue={editingUser?.dept?.toLowerCase() || undefined}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select dept" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="operations">Operations</SelectItem>
                                                <SelectItem value="sales">Sales</SelectItem>
                                                <SelectItem value="finance">Finance</SelectItem>
                                                <SelectItem value="it">IT</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input id="phone" placeholder="+91-..." />
                                    </div>
                                </div>

                                {mode === 'create' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Initial Password</Label>
                                        <Input id="password" type="password" placeholder="••••••••" required />
                                    </div>
                                )}

                                {mode === 'edit' && (
                                    <div className="pt-2 border-t mt-2">
                                        <Label className="text-orange-600 mb-2 block">Security Actions</Label>
                                        <div className="flex gap-3">
                                            <Button type="button" variant="outline" size="sm" className="w-full gap-2 text-muted-foreground hover:text-foreground" onClick={handlePasswordReset}>
                                                <KeyRound className="h-4 w-4" />
                                                Reset Password
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                                                <Ban className="h-4 w-4" />
                                                Deactivate User
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={!generatedCode}>
                                    {mode === 'create' ? 'Create User' : 'Save Changes'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm max-w-md">
                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                <Input
                    placeholder="Search users by name, code or email..."
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
                            <TableHead className="w-[120px]">Code</TableHead>
                            <TableHead>User Details</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                                <TableRow key={user.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-mono font-medium">{user.code}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                <User className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-[#101828] text-sm">{user.name}</span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Mail className="h-3 w-3" /> {user.email}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {/* Mocking Branch display based on ID/Code for now since data is static */}
                                        <div className="flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-sm">
                                                {user.dept === 'IT' ? 'Head Office' : 'Margao Hub'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={
                                            user.role === 'admin'
                                                ? "bg-purple-50 text-purple-700 border-purple-100"
                                                : user.role === 'employee'
                                                    ? "bg-blue-50 text-blue-700 border-blue-100"
                                                    : "bg-orange-50 text-orange-700 border-orange-100"
                                        }>
                                            <Shield className="h-3 w-3 mr-1" />
                                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={
                                            user.status === 'Active'
                                                ? "bg-green-50 text-green-700 border-green-200"
                                                : "bg-gray-50 text-gray-700 border-gray-200"
                                        }>
                                            {user.status}
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
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => openEditModel(user)}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toast.success('Password reset sent')}>
                                                    <KeyRound className="mr-2 h-4 w-4" />
                                                    Reset Password
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-600">
                                                    <Ban className="mr-2 h-4 w-4" />
                                                    Deactivate
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No users found matching your search.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
