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
import { Party, PartyType, PartyInput } from '@/lib/types/party.types';
import { createParty, updateParty, getPartyByCode } from '@/lib/services/party.service';
import { Loader2, AlertCircle } from 'lucide-react';

interface AddPartyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (party: Party) => void;
    initialName?: string;
    defaultType?: PartyType;
    editParty?: Party; // Add this
}

export function AddPartyDialog({ 
    open, 
    onOpenChange, 
    onSave, 
    initialName = '', 
    defaultType = 'both',
    editParty 
}: AddPartyDialogProps) {
    const [name, setName] = React.useState(initialName);
    const [type, setType] = React.useState(defaultType);
    const [code, setCode] = React.useState(''); // Editable for now
    const [gstin, setGstin] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [pincode, setPincode] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [codeError, setCodeError] = React.useState<string | null>(null);
    const [isCheckingCode, setIsCheckingCode] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            if (editParty) {
                setName(editParty.name || '');
                setType(editParty.type || 'both');
                setCode(editParty.code || '');
                setGstin(editParty.gstin || '');
                setAddress(editParty.address || '');
                setPincode(editParty.pincode || '');
                setPhone(editParty.phone || '');
                setEmail(editParty.email || '');
            } else {
                setName(initialName);
                setType(defaultType);
                setCode(Math.floor(100000 + Math.random() * 900000).toString());
                setGstin('');
                setAddress('');
                setPincode('');
                setPhone('');
                setEmail('');
            }
            setError(null);
            setCodeError(null);
        }
    }, [open, initialName, defaultType, editParty]);

    const handleCodeBlur = async () => {
        const trimmedCode = code.trim();
        if (!trimmedCode || trimmedCode.length !== 6) {
            setCodeError(trimmedCode.length > 0 && trimmedCode.length !== 6 ? 'Code must be exactly 6 digits' : null);
            return;
        }
        // Skip check if code hasn't changed during edit
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
            // If lookup fails, don't block — the server will catch duplicates on save
            setCodeError(null);
        } finally {
            setIsCheckingCode(false);
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

        setIsSaving(true);
        setError(null);
        try {
            const partyInput: PartyInput = {
                name,
                code,
                type: type,
                gstin: gstin || null,
                address: address || null,
                pincode: pincode || null,
                phone: phone || null,
                email: email || null,
                is_active: true,
                city: null, // Basic fields
                state: null,
            };

            const savedParty = editParty 
                ? await updateParty(editParty.id, partyInput)
                : await createParty(partyInput);

            onSave(savedParty);
            onOpenChange(false);
        } catch (err: any) {
            console.error('Failed to save party:', err);
            setError(err.message || 'Failed to save party');
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
                    <div className="space-y-2">
                        <Label htmlFor="name">Party Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter party name" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="type">Party Type</Label>
                        <Select value={type} onValueChange={(v: any) => setType(v)}>
                            <SelectTrigger id="type">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="consignor">Consignor Only</SelectItem>
                                <SelectItem value="consignee">Consignee Only</SelectItem>
                                <SelectItem value="both">Both (Consignor &amp; Consignee)</SelectItem>
                                <SelectItem value="billing">Billing Party</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="code">Party Code (6 Digits)</Label>
                        <div className="relative">
                            <Input
                                id="code"
                                value={code}
                                onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
                                onBlur={handleCodeBlur}
                                placeholder="100003"
                                className={`bg-slate-50 ${codeError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
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
                    <div className="space-y-2">
                        <Label htmlFor="gstin">GST Number</Label>
                        <Input id="gstin" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="27XXXXX0000X0Z0" className="font-mono uppercase" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address">Full Address</Label>
                        <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address line 1, Area, Landmark" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pincode">Pincode</Label>
                        <Input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="6-digit PIN" maxLength={6} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone / Mobile</Label>
                        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
                    </div>
                </div>
                {error && <p className="text-xs text-destructive px-1">{error}</p>}
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving || isCheckingCode || !!codeError}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSaving ? 'Saving...' : (editParty ? 'Update Party' : 'Save Party')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
