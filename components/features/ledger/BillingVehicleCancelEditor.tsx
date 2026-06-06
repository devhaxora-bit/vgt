'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import type { BillingVehicleCancelDraftItem } from '@/lib/billingVehicleCancel';
import { createEmptyVehicleCancelDraft } from '@/lib/billingVehicleCancel';
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

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

interface VehicleOption {
    id: string;
    vehicle_no: string;
    vehicle_type?: string | null;
}

export function BillingVehicleCancelEditor({
    items,
    onChange,
}: {
    items: BillingVehicleCancelDraftItem[];
    onChange: (next: BillingVehicleCancelDraftItem[]) => void;
}) {
    const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
    const [loadingVehicles, setLoadingVehicles] = useState(true);

    useEffect(() => {
        let active = true;

        const loadVehicles = async () => {
            try {
                const res = await fetch('/api/vehicles');
                const data = await res.json();
                if (!active) return;
                setVehicles(Array.isArray(data) ? data : []);
            } catch {
                if (active) setVehicles([]);
            } finally {
                if (active) setLoadingVehicles(false);
            }
        };

        void loadVehicles();
        return () => { active = false; };
    }, []);

    const vehicleOptions = useMemo(() => {
        const knownVehicleNos = new Set(vehicles.map((vehicle) => vehicle.vehicle_no));
        const savedVehicleNos = items
            .map((item) => item.vehicle_no.trim().toUpperCase())
            .filter((vehicleNo) => vehicleNo && !knownVehicleNos.has(vehicleNo));

        const extraOptions = savedVehicleNos.map((vehicleNo) => ({
            id: `saved-${vehicleNo}`,
            vehicle_no: vehicleNo,
            vehicle_type: null,
        }));

        return [...vehicles, ...extraOptions].sort((left, right) => (
            left.vehicle_no.localeCompare(right.vehicle_no)
        ));
    }, [vehicles, items]);

    const total = items.reduce((sum, item) => {
        const amount = Number(item.charges || 0);
        return sum + (Number.isNaN(amount) ? 0 : amount);
    }, 0);

    const updateItem = (id: string, patch: Partial<BillingVehicleCancelDraftItem>) => {
        onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    };

    const removeItem = (id: string) => {
        onChange(items.filter((item) => item.id !== id));
    };

    const addItem = () => {
        onChange([...items, createEmptyVehicleCancelDraft()]);
    };

    return (
        <div className="rounded-lg border bg-muted/10">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Vehicle Cancellation Charges</div>
                    <div className="text-xs text-muted-foreground">
                        Add cancelled vehicle details. These appear as separate rows on the bill PDF after CNS entries.
                    </div>
                </div>
                <div className="text-xs font-semibold text-emerald-700">₹{fmt(total)}</div>
            </div>
            <div className="space-y-3 p-4">
                {items.length === 0 ? (
                    <div className="rounded-md border border-dashed bg-background/80 px-3 py-4 text-xs text-muted-foreground">
                        No vehicle cancellation lines added.
                    </div>
                ) : items.map((item, index) => (
                    <div key={item.id} className="rounded-md border bg-background/80 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] font-bold uppercase text-muted-foreground">Vehicle Line {index + 1}</div>
                            <Button type="button" variant="outline" size="icon" onClick={() => removeItem(item.id)} aria-label="Remove vehicle cancellation line">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Vehicle Number</Label>
                                <Select
                                    value={item.vehicle_no || undefined}
                                    onValueChange={(value) => updateItem(item.id, { vehicle_no: value })}
                                    disabled={loadingVehicles}
                                >
                                    <SelectTrigger className="h-9 font-mono">
                                        <SelectValue placeholder={loadingVehicles ? 'Loading vehicles...' : 'Select vehicle'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehicleOptions.map((vehicle) => (
                                            <SelectItem key={vehicle.id} value={vehicle.vehicle_no}>
                                                <span className="font-mono font-bold">{vehicle.vehicle_no}</span>
                                                {vehicle.vehicle_type ? (
                                                    <span className="ml-2 text-muted-foreground uppercase">{vehicle.vehicle_type}</span>
                                                ) : null}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {loadingVehicles ? (
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Loading vehicle list...
                                    </div>
                                ) : vehicleOptions.length === 0 ? (
                                    <div className="text-[11px] text-muted-foreground">
                                        No active vehicles found. Add vehicles in Admin → Vehicle Management.
                                    </div>
                                ) : null}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Cancellation Date</Label>
                                <Input
                                    type="date"
                                    value={item.cancellation_date}
                                    onChange={(e) => updateItem(item.id, { cancellation_date: e.target.value })}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Cancellation Charges (₹)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.charges}
                                    onChange={(e) => updateItem(item.id, { charges: e.target.value })}
                                    placeholder="0.00"
                                    className="h-9 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">From</Label>
                                <Input
                                    value={item.from_station}
                                    onChange={(e) => updateItem(item.id, { from_station: e.target.value })}
                                    placeholder="Loading / origin station"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">To</Label>
                                <Input
                                    value={item.to_station}
                                    onChange={(e) => updateItem(item.id, { to_station: e.target.value })}
                                    placeholder="Destination station"
                                    className="h-9"
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <Button type="button" variant="outline" onClick={addItem} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Vehicle Cancellation
                </Button>
            </div>
        </div>
    );
}
