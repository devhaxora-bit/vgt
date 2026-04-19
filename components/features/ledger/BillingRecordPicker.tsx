'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface BillingRecordOption {
    id: string;
    billing_date: string;
    amount: number;
    bill_ref_no?: string;
    narration: string;
    status: string;
    covered_cn_nos?: string[];
    settled_amount?: number;
    remaining_amount?: number;
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

export function BillingRecordPicker({
    billingRecords,
    value,
    onChange,
}: {
    billingRecords: BillingRecordOption[];
    value: string[];
    onChange: (next: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const selectedBillingRecords = useMemo(
        () => billingRecords.filter((record) => value.includes(record.id)),
        [billingRecords, value]
    );

    const filteredBillingRecords = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return billingRecords;
        return billingRecords.filter((record) =>
            [
                record.bill_ref_no || '',
                record.billing_date,
                record.narration,
                (record.covered_cn_nos || []).join(' '),
                String(record.amount || 0),
            ].join(' ').toLowerCase().includes(query)
        );
    }, [billingRecords, search]);

    const toggleRecord = (recordId: string) => {
        if (value.includes(recordId)) {
            onChange(value.filter((entry) => entry !== recordId));
            return;
        }
        onChange([...value, recordId]);
    };

    const selectedTotal = selectedBillingRecords.reduce(
        (sum, record) => sum + (Number(record.amount) || 0),
        0
    );

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between h-9 font-normal">
                        <span className="truncate">
                            {value.length > 0 ? `${value.length} bill${value.length > 1 ? 's' : ''} selected` : 'Select Bill Numbers'}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[440px] p-0" align="start">
                    <div className="p-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search bill no, date or narration..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 pl-8 text-xs"
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-72">
                        <div className="p-2 space-y-2">
                            {filteredBillingRecords.length === 0 ? (
                                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                                    No active bills found
                                </div>
                            ) : filteredBillingRecords.map((record) => {
                                const checked = value.includes(record.id);
                                return (
                                    <button
                                        key={record.id}
                                        type="button"
                                        onClick={() => toggleRecord(record.id)}
                                        className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                                    >
                                        <div className="flex items-start gap-3">
                                            <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="font-mono text-xs font-bold text-primary">
                                                        {record.bill_ref_no || record.id.slice(0, 8).toUpperCase()}
                                                    </div>
                                                    {checked && <Check className="h-4 w-4 text-primary shrink-0" />}
                                                </div>
                                                <div className="mt-1 text-[11px] text-muted-foreground">
                                                    {fmtDate(record.billing_date)} • ₹{fmt(Number(record.amount || 0))}
                                                </div>
                                                {(record.covered_cn_nos || []).length > 0 && (
                                                    <div className="mt-1 text-[11px] text-muted-foreground truncate">
                                                        CNs: {(record.covered_cn_nos || []).join(', ')}
                                                    </div>
                                                )}
                                                <div className="mt-1 text-[11px] text-muted-foreground truncate">
                                                    {record.narration || '—'}
                                                </div>
                                                {(record.settled_amount !== undefined || record.remaining_amount !== undefined) && (
                                                    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                                                        {record.settled_amount !== undefined && (
                                                            <span className="font-semibold text-indigo-700">Paid ₹{fmt(Number(record.settled_amount || 0))}</span>
                                                        )}
                                                        {record.remaining_amount !== undefined && (
                                                            <span className="font-semibold text-amber-700">Bal ₹{fmt(Number(record.remaining_amount || 0))}</span>
                                                        )}
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

            {selectedBillingRecords.length > 0 && (
                <div className="rounded-md border bg-muted/10">
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                        <div className="text-[11px] font-bold uppercase text-muted-foreground">Selected Bills</div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                            ₹{fmt(selectedTotal)}
                        </Badge>
                    </div>
                    <div className="divide-y">
                        {selectedBillingRecords.map((record) => (
                            <div key={record.id} className="px-3 py-2 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-mono text-xs font-bold text-primary">
                                        {record.bill_ref_no || record.id.slice(0, 8).toUpperCase()}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {fmtDate(record.billing_date)} • {record.narration || '—'}
                                    </div>
                                    {(record.covered_cn_nos || []).length > 0 && (
                                        <div className="text-[11px] text-muted-foreground truncate">
                                            CNs: {(record.covered_cn_nos || []).join(', ')}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right text-xs shrink-0">
                                    <div className="font-semibold text-emerald-700">
                                        ₹{fmt(Number(record.amount || 0))}
                                    </div>
                                    {record.remaining_amount !== undefined && (
                                        <div className="text-[11px] text-amber-700">
                                            Bal ₹{fmt(Number(record.remaining_amount || 0))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
