'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface BillingExtraChargeDraftItem {
    id: string;
    label: string;
    amount: string;
}

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const createEmptyChargeItem = (): BillingExtraChargeDraftItem => ({
    id: Math.random().toString(36).slice(2, 10),
    label: '',
    amount: '',
});

export function BillingExtraChargesEditor({
    items,
    onChange,
    title = 'Extra Charge Breakup',
    description = 'Add manual charges that should appear in the bill remark section.',
    emptyMessage = 'No extra charge lines added.',
    lineLabel = 'Charge',
    descriptionPlaceholder = 'e.g. Local unloading / labour / document charges',
    addButtonLabel = 'Add Charge Line',
}: {
    items: BillingExtraChargeDraftItem[];
    onChange: (next: BillingExtraChargeDraftItem[]) => void;
    title?: string;
    description?: string;
    emptyMessage?: string;
    lineLabel?: string;
    descriptionPlaceholder?: string;
    addButtonLabel?: string;
}) {
    const total = items.reduce((sum, item) => {
        const amount = Number(item.amount || 0);
        return sum + (Number.isNaN(amount) ? 0 : amount);
    }, 0);

    const updateItem = (id: string, patch: Partial<BillingExtraChargeDraftItem>) => {
        onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    };

    const removeItem = (id: string) => {
        onChange(items.filter((item) => item.id !== id));
    };

    const addItem = () => {
        onChange([...items, createEmptyChargeItem()]);
    };

    return (
        <div className="rounded-lg border bg-muted/10">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                </div>
                <div className="text-xs font-semibold text-emerald-700">₹{fmt(total)}</div>
            </div>
            <div className="space-y-3 p-4">
                {items.length === 0 ? (
                    <div className="rounded-md border border-dashed bg-background/80 px-3 py-4 text-xs text-muted-foreground">
                        {emptyMessage}
                    </div>
                ) : items.map((item, index) => (
                    <div key={item.id} className="grid gap-3 rounded-md border bg-background/80 p-3 md:grid-cols-[1fr_180px_auto]">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">{lineLabel} {index + 1} Description</Label>
                            <Input
                                value={item.label}
                                onChange={(e) => updateItem(item.id, { label: e.target.value })}
                                placeholder={descriptionPlaceholder}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Amount (₹)</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.amount}
                                onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                                placeholder="0.00"
                                className="h-9 font-mono"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button type="button" variant="outline" size="icon" onClick={() => removeItem(item.id)} aria-label="Remove charge line">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    </div>
                ))}

                <Button type="button" variant="outline" onClick={addItem} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {addButtonLabel}
                </Button>
            </div>
        </div>
    );
}

export const billingExtraChargeDraftItem = createEmptyChargeItem;
