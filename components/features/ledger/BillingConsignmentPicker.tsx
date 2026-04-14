'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface BillingConsignmentOption {
    id: string;
    cn_no: string;
    bkg_date: string;
    booking_branch: string;
    dest_branch: string;
    total_freight: number;
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

export function BillingConsignmentPicker({
    consignments,
    value,
    onChange,
}: {
    consignments: BillingConsignmentOption[];
    value: string[];
    onChange: (next: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const selectedConsignments = useMemo(
        () => consignments.filter((consignment) => value.includes(consignment.cn_no)),
        [consignments, value]
    );

    const filteredConsignments = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return consignments;
        return consignments.filter((consignment) =>
            [
                consignment.cn_no,
                consignment.booking_branch,
                consignment.dest_branch,
                consignment.bkg_date,
            ].join(' ').toLowerCase().includes(query)
        );
    }, [consignments, search]);

    const toggleConsignment = (cnNo: string) => {
        if (value.includes(cnNo)) {
            onChange(value.filter((entry) => entry !== cnNo));
            return;
        }
        onChange([...value, cnNo]);
    };

    const selectedTotal = selectedConsignments.reduce(
        (sum, consignment) => sum + (Number(consignment.total_freight) || 0),
        0
    );

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between h-9 font-normal">
                        <span className="truncate">
                            {value.length > 0 ? `${value.length} CN${value.length > 1 ? 's' : ''} selected` : 'Select Covered CNs'}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="start">
                    <div className="p-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search CN, route or date..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 pl-8 text-xs"
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-72">
                        <div className="p-2 space-y-2">
                            {filteredConsignments.length === 0 ? (
                                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                                    No consignments found
                                </div>
                            ) : filteredConsignments.map((consignment) => {
                                const checked = value.includes(consignment.cn_no);
                                return (
                                    <button
                                        key={consignment.id}
                                        type="button"
                                        onClick={() => toggleConsignment(consignment.cn_no)}
                                        className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                                    >
                                        <div className="flex items-start gap-3">
                                            <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="font-mono text-xs font-bold text-primary">{consignment.cn_no}</div>
                                                    {checked && <Check className="h-4 w-4 text-primary shrink-0" />}
                                                </div>
                                                <div className="mt-1 text-[11px] text-muted-foreground">
                                                    {fmtDate(consignment.bkg_date)} • {consignment.booking_branch} → {consignment.dest_branch}
                                                </div>
                                                <div className="mt-1 text-[11px] font-semibold text-emerald-700">
                                                    ₹{fmt(Number(consignment.total_freight || 0))}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>

            {selectedConsignments.length > 0 && (
                <div className="rounded-md border bg-muted/10">
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                        <div className="text-[11px] font-bold uppercase text-muted-foreground">Selected CN Summary</div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                            ₹{fmt(selectedTotal)}
                        </Badge>
                    </div>
                    <div className="divide-y">
                        {selectedConsignments.map((consignment) => (
                            <div key={consignment.id} className="px-3 py-2 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-mono text-xs font-bold text-primary">{consignment.cn_no}</div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {fmtDate(consignment.bkg_date)} • {consignment.booking_branch} → {consignment.dest_branch}
                                    </div>
                                </div>
                                <div className="text-xs font-semibold text-emerald-700 shrink-0">
                                    ₹{fmt(Number(consignment.total_freight || 0))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
