'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ChallanBillingChallanOption {
    id: string;
    challan_no: string;
    date_from: string;
    vehicle_no: string;
    driver_name?: string | null;
    owner_name?: string | null;
    origin_branch_code?: string | null;
    destination_branch_code?: string | null;
    linked_cn_nos?: string[] | null;
    total_hire_amount: number;
    extra_hire_amount: number;
    full_hire_amount?: number;
    bill_status?: string;
    advance_amount?: number;
    less_tds?: number;
    net_payable_amount?: number;
    paid_amount?: number;
    balance_amount?: number;
    payment_status?: string;
}

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
};

const getFullHire = (challan: ChallanBillingChallanOption) =>
    Number(challan.full_hire_amount) || (Number(challan.total_hire_amount) || 0) + (Number(challan.extra_hire_amount) || 0);

export function ChallanBillingChallanPicker({
    challans,
    value,
    onChange,
    billedChallanNos = [],
}: {
    challans: ChallanBillingChallanOption[];
    value: string[];
    onChange: (next: string[]) => void;
    billedChallanNos?: string[];
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const availableChallans = useMemo(
        () => challans.filter((ch) => !billedChallanNos.includes(ch.challan_no) || value.includes(ch.challan_no)),
        [challans, billedChallanNos, value]
    );

    const selectedChallans = useMemo(
        () => availableChallans.filter((ch) => value.includes(ch.challan_no)),
        [availableChallans, value]
    );

    const filteredChallans = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return availableChallans;
        return availableChallans.filter((ch) =>
            [
                ch.challan_no,
                ch.vehicle_no,
                ch.driver_name,
                ch.owner_name,
                ch.origin_branch_code,
                ch.destination_branch_code,
                (ch.linked_cn_nos || []).join(' '),
            ].join(' ').toLowerCase().includes(query)
        );
    }, [availableChallans, search]);

    const toggleChallan = (challanNo: string) => {
        if (value.includes(challanNo)) {
            onChange(value.filter((entry) => entry !== challanNo));
            return;
        }
        onChange([...value, challanNo]);
    };

    const selectedTotal = selectedChallans.reduce((sum, ch) => sum + getFullHire(ch), 0);

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between h-9 font-normal">
                        <span className="truncate">
                            {value.length > 0 ? `${value.length} challan${value.length > 1 ? 's' : ''} selected` : 'Select Covered Challans'}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[440px] p-0" align="start">
                    <div className="p-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search challan, vehicle, driver..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 pl-8 text-xs"
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-72">
                        <div className="p-2 space-y-2">
                            {filteredChallans.length === 0 ? (
                                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                                    No unbilled challans found
                                </div>
                            ) : filteredChallans.map((challan) => {
                                const checked = value.includes(challan.challan_no);
                                return (
                                    <button
                                        key={challan.id}
                                        type="button"
                                        onClick={() => toggleChallan(challan.challan_no)}
                                        className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                                    >
                                        <div className="flex items-start gap-3">
                                            <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="font-mono text-xs font-bold text-primary">{challan.challan_no}</div>
                                                    {checked && <Check className="h-4 w-4 text-primary shrink-0" />}
                                                </div>
                                                <div className="mt-1 text-[11px] text-muted-foreground">
                                                    {fmtDate(challan.date_from)} • {challan.vehicle_no} • {challan.driver_name || '—'}
                                                </div>
                                                <div className="mt-1 text-[11px] font-semibold text-emerald-700">
                                                    Full Hire ₹{fmt(getFullHire(challan))}
                                                </div>
                                                {(challan.linked_cn_nos || []).length > 0 && (
                                                    <div className="mt-1 text-[11px] text-muted-foreground truncate">
                                                        CNs: {(challan.linked_cn_nos || []).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>

            {selectedChallans.length > 0 && (
                <div className="rounded-md border bg-muted/10">
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                        <div className="text-[11px] font-bold uppercase text-muted-foreground">Selected Challans</div>
                        <Badge variant="outline" className="font-mono text-[10px]">₹{fmt(selectedTotal)}</Badge>
                    </div>
                    <div className="divide-y">
                        {selectedChallans.map((challan) => (
                            <div key={challan.id} className="px-3 py-2 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-mono text-xs font-bold text-primary">{challan.challan_no}</div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {fmtDate(challan.date_from)} • {challan.vehicle_no}
                                    </div>
                                </div>
                                <div className="font-semibold text-emerald-700 text-xs shrink-0">
                                    ₹{fmt(getFullHire(challan))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
