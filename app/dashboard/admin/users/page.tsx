'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Search, User, Mail, Shield, MoreHorizontal, Building2, Pencil, KeyRound, Ban } from 'lucide-react';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ApiUser = {
    id: string;
    employee_code: string;
    full_name: string;
    role: 'admin' | 'employee' | 'agent';
    department: string | null;
    phone: string | null;
    is_active: boolean;
};

type UiUser = {
    id: string;
    code: string;
    name: string;
    email: string;
    role: ApiUser['role'];
    department: string;
    phone: string;
    status: 'Active' | 'Inactive';
};

const branches = [
    { code: 'MRG', name: 'Margao Hub' },
    { code: 'PNJ', name: 'Panjim Branch' },
    { code: 'VZG', name: 'Vasco Branch' },
    { code: 'MAP', name: 'Mapusa Hub' },
    { code: 'HO', name: 'Head Office' },
];

function getBranchNameFromEmployeeCode(employeeCode: string): string {
    const branch = branches.find((b) => employeeCode.startsWith(`${b.code}-`) || employeeCode.startsWith(b.code));
    return branch?.name || 'Unassigned';
}

function normalizeUser(user: ApiUser): UiUser {
    const emailLocalPart = user.employee_code ? user.employee_code.toLowerCase() : 'unknown';
    return {
        id: user.id,
        code: user.employee_code,
        name: user.full_name,
        email: `${emailLocalPart}@vgt.com`,
        role: user.role,
        department: user.department || '',
        phone: user.phone || '',
        status: user.is_active ? 'Active' : 'Inactive',
    };
}

export default function UserManagementPage() {
    const [users, setUsers] = useState<UiUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);

    const [mode, setMode] = useState<'create' | 'edit'>('create');
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedRole, setSelectedRole] = useState<'admin' | 'employee' | 'agent'>('employee');
    const [generatedCode, setGeneratedCode] = useState('');

    const [editingUser, setEditingUser] = useState<UiUser | null>(null);
    const [editName, setEditName] = useState('');
    const [editDepartment, setEditDepartment] = useState('');
    const [editPhone, setEditPhone] = useState('');

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (!res.ok) {
                throw new Error('Failed to fetch users');
            }
            const data: ApiUser[] = await res.json();
            setUsers(data.map(normalizeUser));
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error('Failed to load users');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter((user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const generateCode = (branchCode: string, role: string) => {
        if (!branchCode) return '';
        const rolePrefix = role === 'admin' ? 'ADM' : role === 'agent' ? 'AGT' : 'EMP';
        const randomNum = Math.floor(100 + Math.random() * 900);
        return `${branchCode}-${rolePrefix}-${randomNum}`;
    };

    const handleBranchChange = (value: string) => {
        setSelectedBranch(value);
        setGeneratedCode(generateCode(value, selectedRole));
    };

    const handleRoleChange = (value: 'admin' | 'employee' | 'agent') => {
        setSelectedRole(value);
        if (selectedBranch) {
            setGeneratedCode(generateCode(selectedBranch, value));
        }
    };

    const resetForm = () => {
        setSelectedBranch('');
        setSelectedRole('employee');
        setGeneratedCode('');
        setEditingUser(null);
        setEditName('');
        setEditDepartment('');
        setEditPhone('');
        setMode('create');
    };

    const openEditModel = (user: UiUser) => {
        setMode('edit');
        setEditingUser(user);
        const branchMatch = branches.find((b) => user.code.startsWith(`${b.code}-`) || user.code.startsWith(b.code))?.code || 'HO';
        setSelectedBranch(branchMatch);
        setSelectedRole(user.role);
        setGeneratedCode(user.code);
        setEditName(user.name);
        setEditDepartment(user.department);
        setEditPhone(user.phone);
        setIsAddOpen(true);
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === 'edit' && editingUser) {
            try {
                const payload = {
                    id: editingUser.id,
                    full_name: editName.trim(),
                    department: editDepartment || null,
                    phone: editPhone.trim() || null,
                };

                const res = await fetch('/api/admin/users', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to update user');
                }

                toast.success('User updated successfully');
                await fetchUsers();
                setIsAddOpen(false);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'An error occurred while updating');
            } finally {
                resetForm();
            }
            return;
        }

        toast.info('Create functionality is currently limited to seed scripts');
        setIsAddOpen(false);
        resetForm();
    };

    const handlePasswordReset = () => {
        toast.info('Password reset feature coming soon');
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="branch">Branch</Label>
                                        <Select
                                            onValueChange={handleBranchChange}
                                            value={selectedBranch}
                                            disabled={mode === 'edit'}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Branch" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {branches.map((b) => (
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
                                            onValueChange={(value) => handleRoleChange(value as 'admin' | 'employee' | 'agent')}
                                            disabled={mode === 'edit'}
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
                                        name="name"
                                        placeholder="John Doe"
                                        required
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="john@company.com"
                                        required
                                        value={editingUser?.email ?? ''}
                                        readOnly={mode === 'edit'}
                                        onChange={() => undefined}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="dept">Department</Label>
                                        <Select value={editDepartment.toLowerCase()} onValueChange={setEditDepartment}>
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
                                        <Input
                                            id="phone"
                                            name="phone"
                                            placeholder="+91-..."
                                            value={editPhone}
                                            onChange={(e) => setEditPhone(e.target.value)}
                                        />
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

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm max-w-md">
                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                <Input
                    placeholder="Search users by name, code or email..."
                    className="border-none shadow-none focus-visible:ring-0 h-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

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
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                        Loading users...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredUsers.length > 0 ? (
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
                                        <div className="flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-sm">{getBranchNameFromEmployeeCode(user.code)}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={
                                            user.role === 'admin'
                                                ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                : user.role === 'employee'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                    : 'bg-orange-50 text-orange-700 border-orange-100'
                                        }>
                                            <Shield className="h-3 w-3 mr-1" />
                                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={
                                            user.status === 'Active'
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-gray-50 text-gray-700 border-gray-200'
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
