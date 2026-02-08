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
import { Party, PartyType } from '@/lib/types/party.types';

interface AddPartyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (party: Party) => void;
    initialName?: string;
    defaultType?: PartyType;
}

export function AddPartyDialog({ open, onOpenChange, onSave, initialName = '', defaultType = 'both' }: AddPartyDialogProps) {
    const [name, setName] = React.useState(initialName);
    const [type, setType] = React.useState(defaultType);
    const [code, setCode] = React.useState(''); // Editable for now
    const [gstin, setGstin] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [pincode, setPincode] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [email, setEmail] = React.useState('');

    React.useEffect(() => {
        if (open) {
            setName(initialName);
            setType(defaultType);
            // Reset other fields or generate code
            setCode(Math.floor(100000 + Math.random() * 900000).toString()); // Random 6 digit for demo
            setGstin('');
            setAddress('');
            setPincode('');
            setPhone('');
            setEmail('');
        }
    }, [open, initialName, defaultType]);

    const handleSave = () => {
        // Validation logic here if needed
        const newParty: Party = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            code,
            type: type,
            gstin,
            address,
            pincode,
            city: '', // Inferred or added if we had a city field
            state: '',
            phone,
            email,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        onSave(newParty);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Add New Party</DialogTitle>
                    <DialogDescription>
                        Enter the details of the party. The party code is pre-generated but can be edited.
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
                                <SelectItem value="both">Both (Consignor & Consignee)</SelectItem>
                                <SelectItem value="billing">Billing Party</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="code">Party Code (6 Digits)</Label>
                        <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="100003" className="bg-slate-50" />
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
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Party</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
