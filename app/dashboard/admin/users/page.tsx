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
import { branchAccessLabel } from '@/lib/branchAccess';
import type { BranchAccess } from '@/lib/types/user.types';

type ApiUser = {
    id: string;
    employee_code: string;
    full_name: string;
    role: 'admin' | 'employee' | 'agent';
    department: string | null;
    phone: string | null;
    branch_access?: BranchAccess | null;
    branch_code?: string | null;
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
    branchAccess: BranchAccess;
    branchCode: string | null;
    status: 'Active' | 'Inactive';
};

type BranchOption = {
    code: string;
    name: string;
    is_head_branch?: boolean;
};

function normalizeUser(user: ApiUser): UiUser {
    const emailLocalPart = user.employee_code ? user.employee_code.toLowerCase() : 'unknown';
    const access = (user.branch_access || 'global') as BranchAccess;
    return {
        id: user.id,
        code: user.employee_code,
        name: user.full_name,
        email: `${emailLocalPart}@vgt.com`,
        role: user.role,
        department: user.department || '',
        phone: user.phone || '',
        branchAccess: access,
        branchCode: user.branch_code || null,
        status: user.is_active ? 'Active' : 'Inactive',
    };
}

export default function UserManagementPage() {
    const [users, setUsers] = useState<UiUser[]>([]);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);

    const [mode, setMode] = useState<'create' | 'edit'>('create');
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedRole, setSelectedRole] = useState<'admin' | 'employee' | 'agent'>('employee');
    const [selectedBranchAccess, setSelectedBranchAccess] = useState<BranchAccess>('global');
    const [generatedCode, setGeneratedCode] = useState('');

    const [editingUser, setEditingUser] = useState<UiUser | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editDepartment, setEditDepartment] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const headBranchCode = branches.find((b) => b.is_head_branch)?.code || branches[0]?.code || '';

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

    const fetchBranches = async () => {
        try {
            const res = await fetch('/api/references/branches');
            if (!res.ok) throw new Error('Failed to fetch branches');
            const data = await res.json();
            const options: BranchOption[] = (Array.isArray(data) ? data : [])
                .filter((branch: { code?: string; name?: string; is_active?: boolean }) => Boolean(branch.code))
                .map((branch: { code: string; name?: string; is_head_branch?: boolean }) => ({
                    code: String(branch.code).trim().toUpperCase(),
                    name: String(branch.name || branch.code).trim(),
                    is_head_branch: Boolean(branch.is_head_branch),
                }))
                .sort((a: BranchOption, b: BranchOption) => {
                    if (a.is_head_branch && !b.is_head_branch) return -1;
                    if (!a.is_head_branch && b.is_head_branch) return 1;
                    return a.name.localeCompare(b.name);
                });
            setBranches(options);
        } catch (error) {
            console.error('Failed to fetch branches:', error);
            toast.error('Failed to load branches');
            setBranches([]);
        }
    };

    useEffect(() => {
        void fetchUsers();
        void fetchBranches();
    }, []);

    const GLOBAL_BRANCH_VALUE = '__GLOBAL__';

    const deriveBranchAccess = (branchValue: string): BranchAccess => {
        if (!branchValue || branchValue === GLOBAL_BRANCH_VALUE) return 'global';
        if (headBranchCode && branchValue === headBranchCode) return 'main';
        return 'branch';
    };

    const resolveCodePrefix = (branchValue: string): string => {
        if (!branchValue || branchValue === GLOBAL_BRANCH_VALUE) {
            return headBranchCode || '';
        }
        return branchValue;
    };

    const roleCodePrefix = (role: string) => {
        if (role === 'admin') return 'ADM';
        if (role === 'agent') return 'AGT';
        return 'EMP';
    };

    /**
     * Employee ID used for login — letters + numbers only (no hyphens).
     * Format: {BRANCH}{ROLE}{NN} e.g. VZMADM01, PNJEMP02
     * Sequence starts at 01 and increments for the same branch+role prefix.
     */
    const generateCode = (branchCode: string, role: string, existingUsers: UiUser[] = users) => {
        if (!branchCode) return '';
        const prefix = `${branchCode.toUpperCase()}${roleCodePrefix(role)}`;
        const pattern = new RegExp(`^${prefix}(\\d+)$`, 'i');

        let maxSeq = 0;
        for (const user of existingUsers) {
            const match = user.code.match(pattern);
            if (match) {
                const seq = parseInt(match[1], 10);
                if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
        }

        const nextSeq = maxSeq + 1;
        const padded = String(nextSeq).padStart(2, '0');
        return `${prefix}${padded}`;
    };

    const filteredUsers = users.filter((user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const emailFromCode = (code: string) => {
        if (!code) return '';
        return `${code.toLowerCase()}@vgt.com`;
    };

    const handleBranchChange = (value: string) => {
        setSelectedBranch(value);
        setSelectedBranchAccess(deriveBranchAccess(value));
        const nextCode = generateCode(resolveCodePrefix(value), selectedRole);
        setGeneratedCode(nextCode);
        if (mode === 'create') {
            setEditEmail(emailFromCode(nextCode));
        }
    };

    const handleRoleChange = (value: 'admin' | 'employee' | 'agent') => {
        setSelectedRole(value);
        if (selectedBranch) {
            const nextCode = generateCode(resolveCodePrefix(selectedBranch), value);
            setGeneratedCode(nextCode);
            if (mode === 'create') {
                setEditEmail(emailFromCode(nextCode));
            }
        }
    };

    const resetForm = () => {
        setSelectedBranch('');
        setSelectedRole('employee');
        setSelectedBranchAccess('global');
        setGeneratedCode('');
        setEditingUser(null);
        setEditName('');
        setEditEmail('');
        setEditDepartment('');
        setEditPhone('');
        setEditPassword('');
        setMode('create');
    };

    const openEditModel = (user: UiUser) => {
        setMode('edit');
        setEditingUser(user);

        let branchValue = '';
        if (user.branchAccess === 'global') {
            branchValue = GLOBAL_BRANCH_VALUE;
        } else if (user.branchCode) {
            branchValue = user.branchCode;
        } else if (user.branchAccess === 'main') {
            branchValue = headBranchCode;
        } else {
            branchValue = branches.find((b) => user.code.startsWith(`${b.code}-`) || user.code.startsWith(b.code))?.code
                || '';
        }

        setSelectedBranch(branchValue);
        setSelectedRole(user.role);
        setSelectedBranchAccess(user.branchAccess || deriveBranchAccess(branchValue));
        setGeneratedCode(user.code);
        setEditName(user.name);
        setEditEmail(user.email);
        setEditDepartment(user.department);
        setEditPhone(user.phone);
        setIsAddOpen(true);
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === 'edit' && editingUser) {
            setIsSaving(true);
            try {
                const access = deriveBranchAccess(selectedBranch);
                const resolvedBranchCode = access === 'global'
                    ? null
                    : String(selectedBranch || '').trim().toUpperCase();

                if (access !== 'global' && !resolvedBranchCode) {
                    toast.error('Please select a valid branch');
                    setIsSaving(false);
                    return;
                }

                if (access !== 'global' && !branches.some((b) => b.code === resolvedBranchCode)) {
                    toast.error(`Branch "${resolvedBranchCode}" is not in the active branch list`);
                    setIsSaving(false);
                    return;
                }

                const payload = {
                    id: editingUser.id,
                    full_name: editName.trim(),
                    department: editDepartment || null,
                    phone: editPhone.trim() || null,
                    branch_access: access,
                    branch_code: resolvedBranchCode,
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
                resetForm();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'An error occurred while updating');
            } finally {
                setIsSaving(false);
            }
            return;
        }

        if (!selectedBranch) {
            toast.error('Please select a branch');
            return;
        }
        if (!generatedCode) {
            toast.error('Employee ID could not be generated');
            return;
        }
        if (!editName.trim()) {
            toast.error('Full name is required');
            return;
        }
        if (!editEmail.trim()) {
            toast.error('Email is required');
            return;
        }
        if (!editPassword) {
            toast.error('Initial password is required');
            return;
        }

        const access = deriveBranchAccess(selectedBranch);
        const resolvedBranchCode = access === 'global'
            ? null
            : String(selectedBranch || '').trim().toUpperCase();

        if (access !== 'global' && !resolvedBranchCode) {
            toast.error('Please select a valid branch');
            return;
        }

        if (access !== 'global' && !branches.some((b) => b.code === resolvedBranchCode)) {
            toast.error(`Branch "${resolvedBranchCode}" is not in the active branch list`);
            return;
        }

        const sanitizedPhone = editPhone.replace(/[\s-]/g, '').trim();

        setIsSaving(true);
        try {
            const payload = {
                employee_code: generatedCode.toUpperCase(),
                full_name: editName.trim(),
                email: editEmail.trim().toLowerCase(),
                password: editPassword,
                role: selectedRole,
                department: editDepartment || undefined,
                phone: sanitizedPhone || undefined,
                branch_access: access,
                branch_code: resolvedBranchCode,
            };

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                const detail = result.details?.[0]?.message;
                throw new Error(detail || result.error || 'Failed to create user');
            }

            toast.success(`User created. Login ID: ${payload.employee_code}`);
            await fetchUsers();
            setIsAddOpen(false);
            resetForm();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create user');
        } finally {
            setIsSaving(false);
        }
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
                                <div className="space-y-2 min-w-0">
                                    <Label htmlFor="branch">Branch *</Label>
                                    <Select
                                        onValueChange={handleBranchChange}
                                        value={selectedBranch}
                                    >
                                        <SelectTrigger className="w-full min-w-0">
                                            <SelectValue placeholder="Select Branch" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={GLOBAL_BRANCH_VALUE}>
                                                Global (all branches)
                                            </SelectItem>
                                            {branches.length === 0 ? (
                                                <SelectItem value="__none" disabled>
                                                    No active branches found
                                                </SelectItem>
                                            ) : (
                                                branches.map((b) => (
                                                    <SelectItem key={b.code} value={b.code}>
                                                        {b.name} ({b.code})
                                                        {b.is_head_branch ? ' · Main' : ''}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-muted-foreground">
                                        {selectedBranchAccess === 'branch'
                                            ? 'Branch only — limited to the selected branch.'
                                            : selectedBranchAccess === 'main'
                                                ? 'Main branch — same full access as Global.'
                                                : 'Global — can access every branch.'}
                                    </p>
                                </div>

                                <div className="space-y-2 min-w-0">
                                    <Label htmlFor="role">Role</Label>
                                    <Select
                                        value={selectedRole}
                                        onValueChange={(value) => handleRoleChange(value as 'admin' | 'employee' | 'agent')}
                                        disabled={mode === 'edit'}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="employee">Employee</SelectItem>
                                            <SelectItem value="agent">Agent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="code">Employee ID (login ID)</Label>
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
                                    <p className="text-[11px] text-muted-foreground">
                                        No hyphens — user logs in with this ID (e.g. VZMEMP01, then VZMEMP02…).
                                    </p>
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
                                        name="email"
                                        placeholder="john@company.com"
                                        required
                                        value={editEmail}
                                        readOnly={mode === 'edit'}
                                        className={mode === 'edit' ? 'bg-slate-50' : undefined}
                                        onChange={(e) => setEditEmail(e.target.value)}
                                    />
                                    {mode === 'create' && (
                                        <p className="text-[11px] text-muted-foreground">
                                            Auto-fills from Employee ID; you can change it if needed.
                                        </p>
                                    )}
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
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            required
                                            value={editPassword}
                                            onChange={(e) => setEditPassword(e.target.value)}
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            Min 8 chars with uppercase, lowercase, number, and special (@$!%*?&).
                                        </p>
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
                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSaving}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={!generatedCode || isSaving}>
                                    {isSaving
                                        ? (mode === 'create' ? 'Creating...' : 'Saving...')
                                        : (mode === 'create' ? 'Create User' : 'Save Changes')}
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
                            <TableHead>Branch Access</TableHead>
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
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-sm font-medium">{branchAccessLabel(user.branchAccess)}</span>
                                            </div>
                                            <span className="text-[11px] text-muted-foreground pl-5">
                                                {user.branchAccess === 'global'
                                                    ? 'All branches'
                                                    : user.branchAccess === 'main'
                                                        ? 'Same rights as Global'
                                                        : (branches.find((b) => b.code === user.branchCode)?.name
                                                            || user.branchCode
                                                            || 'Unassigned')}
                                            </span>
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
