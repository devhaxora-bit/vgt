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
import {
    createParty,
    updateParty,
    getPartyByCode,
    getNextPartyCode,
    getPartyByGstin,
    linkPartyToBranch,
    PartyCreateConflictError,
} from '@/lib/services/party.service';
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

type LinkPrompt = {
    party: Party;
    targetBranch: string;
};

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
    const [isLinking, setIsLinking] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [codeError, setCodeError] = React.useState<string | null>(null);
    const [gstinError, setGstinError] = React.useState<string | null>(null);
    const [isCheckingCode, setIsCheckingCode] = React.useState(false);
    const [isCheckingGstin, setIsCheckingGstin] = React.useState(false);
    const [linkPrompt, setLinkPrompt] = React.useState<LinkPrompt | null>(null);
    const [pendingLink, setPendingLink] = React.useState<LinkPrompt | null>(null);

    const resolvedBranch = React.useMemo(
        () => (branchCode || userScope.branchCode || '').toUpperCase(),
        [branchCode, userScope.branchCode],
    );

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
                const home = userScope.branchCode || '';
                const matched = branchOptions.find((b) => b.value.toUpperCase() === home.toUpperCase())?.value;
                setBranchCode(matched || home);
            }
            setError(null);
            setCodeError(null);
            setGstinError(null);
            setLinkPrompt(null);
            setPendingLink(null);
        }
    }, [open, initialName, editParty, userScope.branchCode, branchOptions]);

    React.useEffect(() => {
        if (!open || editParty || !userScope.branchCode || branchCode) return;
        const home = userScope.branchCode;
        const matched = branchOptions.find((b) => b.value.toUpperCase() === home.toUpperCase())?.value;
        setBranchCode(matched || home);
    }, [open, editParty, userScope.branchCode, branchOptions, branchCode]);

    const handleCodeBlur = async () => {
        const trimmedCode = code.trim();
        if (!trimmedCode || trimmedCode.length !== 6) {
            setCodeError(
                trimmedCode.length > 0 && trimmedCode.length !== 6
                    ? 'Party code must be exactly 6 digits'
                    : null,
            );
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
                setCodeError(`Code ${trimmedCode} is already used by ${existing.name}`);
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
            setGstinError('GSTIN format is invalid (15 characters)');
            return;
        }
        if (editParty && editParty.gstin?.toUpperCase() === trimmedGstin) {
            setGstinError(null);
            return;
        }
        setIsCheckingGstin(true);
        try {
            const existing = await getPartyByGstin(trimmedGstin, editParty?.id, resolvedBranch || undefined);
            if (!existing) {
                setGstinError(null);
                return;
            }

            if (existing.alreadyLinkedToBranch) {
                setGstinError(
                    `GSTIN already used by ${existing.name} (${existing.code}) on this branch`,
                );
                setPendingLink(null);
                return;
            }

            // Other branch — offer to link on save (no hard block)
            setGstinError(null);
            setPendingLink({
                party: existing,
                targetBranch: resolvedBranch || existing.checkBranch || 'this branch',
            });
        } catch {
            setGstinError(null);
        } finally {
            setIsCheckingGstin(false);
        }
    };

    const handleConfirmLink = async () => {
        if (!linkPrompt) return;
        setIsLinking(true);
        setError(null);
        try {
            const linked = await linkPartyToBranch(linkPrompt.party.id, linkPrompt.targetBranch);
            onSave(linked);
            setLinkPrompt(null);
            onOpenChange(false);
        } catch (err: unknown) {
            setError((err as Error)?.message || 'Could not add party to this branch');
        } finally {
            setIsLinking(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Party name is required');
            return;
        }
        if (code.length !== 6) {
            setError('Party code must be exactly 6 digits');
            return;
        }
        if (codeError) {
            setError(codeError);
            return;
        }
        if (gstinError) {
            setError(gstinError);
            return;
        }

        // If we already detected a cross-branch GSTIN match, show link popup instead of creating
        if (!editParty && pendingLink && gstin.trim()) {
            const promptGstin = (pendingLink.party.gstin || '').toUpperCase();
            if (promptGstin === gstin.trim().toUpperCase()) {
                setLinkPrompt({
                    ...pendingLink,
                    targetBranch: resolvedBranch || pendingLink.targetBranch,
                });
                return;
            }
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
                branch_code: branchCode || userScope.branchCode || null,
            };

            if (editParty) {
                const savedParty = await updateParty(editParty.id, partyInput);
                onSave(savedParty);
                onOpenChange(false);
                return;
            }

            const savedParty = await createParty(partyInput);
            onSave(savedParty);
            onOpenChange(false);
        } catch (err: unknown) {
            if (err instanceof PartyCreateConflictError) {
                if (err.conflict.code === 'GSTIN_EXISTS_OTHER_BRANCH' && err.conflict.existingParty) {
                    setLinkPrompt({
                        party: err.conflict.existingParty,
                        targetBranch: err.conflict.targetBranch || resolvedBranch || 'this branch',
                    });
                    setError(null);
                    return;
                }
                setError(err.conflict.error);
                return;
            }
            console.error('Failed to save party:', err);
            setError((err as Error)?.message || 'Could not save party. Try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editParty ? 'Edit Party' : 'Add New Party'}</DialogTitle>
                        <DialogDescription>
                            {editParty
                                ? `Update the details for ${editParty.name}.`
                                : 'Enter the details of the party. Party codes are global (shared across branches).'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Party Name <span className="text-destructive">*</span></Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter party name" />
                        </div>

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
                                    {branchOptions.map((b) => (
                                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="gstin">GST Number</Label>
                            <div className="relative">
                                <Input
                                    id="gstin"
                                    value={gstin}
                                    onChange={(e) => {
                                        setGstin(e.target.value.toUpperCase());
                                        setGstinError(null);
                                        setPendingLink(null);
                                    }}
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
                            {!gstinError && pendingLink && (
                                <p className="text-xs text-amber-700">
                                    GSTIN matches {pendingLink.party.name} ({pendingLink.party.code}) at{' '}
                                    {pendingLink.party.branch_code || 'another branch'}. Saving will ask to add it here.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone / Mobile</Label>
                            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" maxLength={10} />
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
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || isLinking}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving || isLinking || isCheckingCode || isCheckingGstin || !!codeError || !!gstinError}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isSaving ? 'Saving...' : (editParty ? 'Update Party' : 'Save Party')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!linkPrompt} onOpenChange={(next) => { if (!next) setLinkPrompt(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add existing party to this branch?</DialogTitle>
                        <DialogDescription>
                            This GSTIN already belongs to{' '}
                            <span className="font-semibold text-foreground">
                                {linkPrompt?.party.name}
                            </span>
                            {' '}({linkPrompt?.party.code})
                            {linkPrompt?.party.branch_code
                                ? <> at branch <span className="font-semibold text-foreground">{linkPrompt.party.branch_code}</span></>
                                : null}
                            . Ledger and calculations stay on the same party. Add it to branch{' '}
                            <span className="font-semibold text-foreground">{linkPrompt?.targetBranch}</span> so it appears in this branch list?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setLinkPrompt(null)} disabled={isLinking}>
                            No
                        </Button>
                        <Button onClick={handleConfirmLink} disabled={isLinking}>
                            {isLinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Yes, add to this branch
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
