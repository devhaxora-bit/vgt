'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { money } from './queryFormat';

export const PLACEHOLDER = '—';

export function withPlaceholderRow<T>(rows: T[], placeholder: T): T[] {
    return rows.length > 0 ? rows : [placeholder];
}

export function queryCell(value?: string | number | null): string {
    if (value === null || value === undefined) return PLACEHOLDER;
    const text = String(value).trim();
    return text || PLACEHOLDER;
}

export function TrackPanel({
    title,
    right,
    children,
    className,
    bodyClassName,
}: {
    title: React.ReactNode;
    right?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={cn('overflow-hidden rounded-md border bg-card', className)}>
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground">{title}</h3>
                {right}
            </div>
            <div className={cn('p-0', bodyClassName)}>{children}</div>
        </section>
    );
}

export function PartyLine({ label, value }: { label: string; value?: string }) {
    return (
        <div className="min-w-0 text-xs">
            <span className="font-bold text-primary">{label}</span>
            <span className="mx-1 text-muted-foreground">:</span>
            <span className={cn('font-semibold', value ? 'text-foreground' : 'text-muted-foreground/70')}>
                {value || PLACEHOLDER}
            </span>
        </div>
    );
}

export function FreightLine({ label, amount, emphasize }: { label: string; amount: number; emphasize?: boolean }) {
    return (
        <div className={cn('flex items-center justify-between gap-3 text-xs', emphasize && 'border-t pt-1.5 font-bold')}>
            <span className={emphasize ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
            <span className={cn('font-mono tabular-nums', emphasize ? 'text-primary' : 'text-foreground')}>
                {money(amount, true)}
            </span>
        </div>
    );
}

export function PlaceholderCell({ children }: { children: React.ReactNode }) {
    const isPlaceholder = children === PLACEHOLDER || children === '' || children == null;
    return <span className={cn(isPlaceholder && 'text-muted-foreground/70')}>{isPlaceholder ? PLACEHOLDER : children}</span>;
}

export function SummaryTable({
    headers,
    cells,
    minWidth = 700,
}: {
    headers: string[];
    cells: React.ReactNode[];
    minWidth?: number;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="vgt-register-table w-full border-collapse text-xs" style={{ minWidth }}>
                <thead>
                    <tr>
                        {headers.map((h) => (
                            <th
                                key={h}
                                className="px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        {cells.map((cellContent, i) => (
                            <td key={headers[i]} className="px-2 py-0.5 align-middle whitespace-nowrap">
                                {cellContent}
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
