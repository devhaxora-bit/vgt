import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Party, PartyInput } from '@/lib/types/party.types';
import { createParty, updateParty, getPartyByCode, getNextPartyCode, getPartyByGstin } from '@/lib/services/party.service';
import { useCurrentUserScope } from '@/lib/hooks/useCurrentUserScope';
import { Loader2, AlertCircle } from 'lucide-react';

interface AddPartyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (party: Party) => void;
    initialName?: string;
    editParty?: Party;
    branchOptions?: { value: string; label: string }[];
}

export function AddPartyDialog({
    open,
    onOpenChange,
    onSave,
    initialName = '',
    editParty,
    branchOptions = [],
}: AddPartyDialogProps) {
    const userScope = useCurrentUserScope();
    const [name, setName] = React.useState(initialName);
    const [code, setCode] = React.useState('');
    const [gstin, setGstin] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [pincode, setPincode] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [branchCode, setBranchCode] = React.useState<string>('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [codeError, setCodeError] = React.useState<string | null>(null);
    const [gstinError, setGstinError] = React.useState<string | null>(null);
    const [isCheckingCode, setIsCheckingCode] = React.useState(false);
    const [isCheckingGstin, setIsCheckingGstin] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            if (editParty) {
                setName(editParty.name || '');
                setCode(editParty.code || '');
                setGstin(editParty.gstin || '');
                setAddress(editParty.address || '');
                setPincode(editParty.pincode || '');
                setPhone(editParty.phone || '');
                setEmail(editParty.email || '');
                setBranchCode(editParty.branch_code || '');
            } else {
                setName(initialName);
                setCode('');
                setGstin('');
                getNextPartyCode().then((nextCode) => setCode(nextCode)).catch(() => setCode('000001'));
                setAddress('');
                setPincode('');
                setPhone('');
                setEmail('');
                setBranchCode('');
            }
            setError(null);
            setCodeError(null);
            setGstinError(null);
        }
    }, [open, initialName, editParty]);

    // Default branch on create once user scope / options are ready
    React.useEffect(() => {
        if (!open || editParty || !userScope.branchCode) return;
        setBranchCode((prev) => {
            if (prev) return prev;
            const home = userScope.branchCode!;
            const matched = branchOptions.find((b) => b.value.toUpperCase() === home.toUpperCase())?.value;
            return matched || home;
        });
    }, [open, editParty, userScope.branchCode, branchOptions]);

    const handleCodeBlur = async () => {
        const trimmedCode = code.trim();
        if (!trimmedCode || trimmedCode.length !== 6) {
            setCodeError(trimmedCode.length > 0 && trimmedCode.length !== 6 ? 'Code must be exactly 6 digits' : null);
            return;
        }
        if (editParty && editParty.code === trimmedCode) {
            setCodeError(null);
            return;
        }
        setIsCheckingCode(true);
        try {
            const existing = await getPartyByCode(trimmedCode);
            if (existing) {
                setCodeError(`Party code "${trimmedCode}" is already used by "${existing.name}"`);
            } else {
                setCodeError(null);
            }
        } catch {
            setCodeError(null);
        } finally {
            setIsCheckingCode(false);
        }
    };

    const handleGstinBlur = async () => {
        const trimmedGstin = gstin.trim().toUpperCase();
        if (!trimmedGstin) {
            setGstinError(null);
            return;
        }
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(trimmedGstin)) {
            setGstinError('Invalid GSTIN format');
            return;
        }
        if (editParty && editParty.gstin?.toUpperCase() === trimmedGstin) {
            setGstinError(null);
            return;
        }
        setIsCheckingGstin(true);
        try {
            const existing = await getPartyByGstin(trimmedGstin, editParty?.id);
            if (existing) {
                setGstinError(`GSTIN "${trimmedGstin}" is already used by "${existing.name}" (${existing.code})`);
            } else {
                setGstinError(null);
            }
        } catch {
            setGstinError(null);
        } finally {
            setIsCheckingGstin(false);
        }
    };

    const handleSave = async () => {
        if (!name) {
            setError('Name is required');
            return;
        }
        if (code.length !== 6) {
            setError('Code must be exactly 6 digits');
            return;
        }
        if (codeError) {
            setError('Please fix the party code issue before saving.');
            return;
        }
        if (gstinError) {
            setError('Please fix the GSTIN issue before saving.');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            const partyInput: PartyInput = {
                name,
                code,
                gstin: gstin || null,
                address: address || null,
                pincode: pincode || null,
                phone: phone || null,
                email: email || null,
                is_active: true,
                city: null,
                state: null,
                branch_code: branchCode || userScope.branchCode || 'VZM',
            };

            const savedParty = editParty
                ? await updateParty(editParty.id, partyInput)
                : await createParty(partyInput);

            onSave(savedParty);
            onOpenChange(false);
        } catch (err: unknown) {
            console.error('Failed to save party:', err);
            setError((err as Error)?.message || 'Failed to save party');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{editParty ? 'Edit Party' : 'Add New Party'}</DialogTitle>
                    <DialogDescription>
                        {editParty
                            ? `Update the details for ${editParty.name}.`
                            : 'Enter the details of the party. The party code is pre-generated but can be edited.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    {/* Party Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Party Name <span className="text-destructive">*</span></Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter party name" />
                    </div>

                    {/* Party Code */}
                    <div className="space-y-2">
                        <Label htmlFor="code">Party Code <span className="text-destructive">*</span></Label>
                        <div className="relative">
                            <Input
                                id="code"
                                value={code}
                                onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
                                onBlur={handleCodeBlur}
                                placeholder="000001"
                                maxLength={6}
                                className={`font-mono bg-slate-50 ${codeError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                            />
                            {isCheckingCode && (
                                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                        </div>
                        {codeError && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                {codeError}
                            </p>
                        )}
                    </div>

                    {/* Branch */}
                    <div className="space-y-2">
                        <Label htmlFor="branch">Branch</Label>
                        <Select
                            value={branchCode || '__none__'}
                            onValueChange={(v) => setBranchCode(v === '__none__' ? '' : v)}
                            disabled={userScope.isBranchScoped}
                        >
                            <SelectTrigger id="branch">
                                <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                                {!userScope.isBranchScoped && (
                                    <SelectItem value="__none__">No Branch</SelectItem>
                                )}
                                {branchOptions.map(b => (
                                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* GSTIN */}
                    <div className="space-y-2">
                        <Label htmlFor="gstin">GST Number</Label>
                        <div className="relative">
                            <Input
                                id="gstin"
                                value={gstin}
                                onChange={(e) => { setGstin(e.target.value.toUpperCase()); setGstinError(null); }}
                                onBlur={handleGstinBlur}
                                placeholder="27XXXXX0000X0Z0"
                                className={`font-mono uppercase ${gstinError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                maxLength={15}
                            />
                            {isCheckingGstin && (
                                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                        </div>
                        {gstinError && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                {gstinError}
                            </p>
                        )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone / Mobile</Label>
                        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" maxLength={10} />
                    </div>

                    {/* Address */}
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address">Full Address</Label>
                        <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address line 1, Area, Landmark" />
                    </div>

                    {/* Pincode */}
                    <div className="space-y-2">
                        <Label htmlFor="pincode">Pincode</Label>
                        <Input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="6-digit PIN" maxLength={6} />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
                    </div>
                </div>

                {error && (
                    <p className="text-xs text-destructive px-1 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                    </p>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving || isCheckingCode || isCheckingGstin || !!codeError || !!gstinError}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSaving ? 'Saving...' : (editParty ? 'Update Party' : 'Save Party')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
