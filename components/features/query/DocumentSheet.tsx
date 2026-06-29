'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Document-styled primitives that visually echo the printed PDFs (blue ruled
 * borders, sky-blue table headers, dense label/value blocks) WITHOUT the
 * "Visakha Golden Transport" company header band — meant for on-screen lookup.
 */

export function DocumentSheet({
    eyebrow,
    title,
    meta,
    status,
    statusTone = 'default',
    actions,
    children,
    className,
}: {
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    meta?: React.ReactNode;
    status?: React.ReactNode;
    statusTone?: 'default' | 'success' | 'danger' | 'warning';
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    const toneClass: Record<string, string> = {
        default: 'bg-[var(--doc-head-bg)] text-[var(--doc-head-fg)] border-[var(--doc-line-soft)]',
        success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        danger: 'bg-red-50 text-red-700 border-red-200',
        warning: 'bg-amber-50 text-amber-700 border-amber-200',
    };

    return (
        <div
            className={cn(
                'animate-slideUp overflow-hidden rounded-xl border-2 border-[var(--doc-line)] bg-card shadow-sm',
                className,
            )}
        >
            <div className="flex flex-col gap-3 border-b border-[var(--doc-line-soft)] bg-[var(--doc-head-bg)]/40 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    {eyebrow ? (
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--doc-head-fg)]">
                            {eyebrow}
                        </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-black tracking-tight text-foreground sm:text-2xl">
                            {title}
                        </h2>
                        {status ? (
                            <span
                                className={cn(
                                    'rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                    toneClass[statusTone],
                                )}
                            >
                                {status}
                            </span>
                        ) : null}
                    </div>
                    {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
                </div>
                {actions ? <div className="flex flex-shrink-0 flex-wrap gap-2">{actions}</div> : null}
            </div>
            <div className="space-y-5 p-5">{children}</div>
        </div>
    );
}

export function SheetSection({
    title,
    icon,
    right,
    children,
    className,
}: {
    title: React.ReactNode;
    icon?: React.ReactNode;
    right?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('overflow-hidden rounded-lg border border-[var(--doc-line-soft)]', className)}>
            <div className="flex items-center justify-between gap-2 border-b border-[var(--doc-line-soft)] bg-[var(--doc-head-bg)] px-3.5 py-2">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--doc-head-fg)]">
                    {icon}
                    {title}
                </h3>
                {right ? <div className="text-[11px] font-semibold text-[var(--doc-head-fg)]">{right}</div> : null}
            </div>
            <div className="p-3.5">{children}</div>
        </section>
    );
}

export function SheetInfoGrid({
    columns = 4,
    children,
    className,
}: {
    columns?: 2 | 3 | 4;
    children: React.ReactNode;
    className?: string;
}) {
    const colClass: Record<number, string> = {
        2: 'sm:grid-cols-2',
        3: 'sm:grid-cols-2 lg:grid-cols-3',
        4: 'sm:grid-cols-2 lg:grid-cols-4',
    };
    return <div className={cn('grid grid-cols-1 gap-x-5 gap-y-3.5', colClass[columns], className)}>{children}</div>;
}

export function SheetField({
    label,
    value,
    mono,
    accent,
    className,
}: {
    label: React.ReactNode;
    value: React.ReactNode;
    mono?: boolean;
    accent?: boolean;
    className?: string;
}) {
    const isEmpty = value === null || value === undefined || value === '';
    return (
        <div className={cn('min-w-0 space-y-0.5', className)}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
            <div
                className={cn(
                    'break-words text-sm font-semibold leading-snug',
                    mono && 'font-mono',
                    accent ? 'text-[var(--doc-head-fg)]' : 'text-foreground',
                    isEmpty && 'text-muted-foreground/60',
                )}
            >
                {isEmpty ? '—' : value}
            </div>
        </div>
    );
}

export interface SheetColumn<T> {
    key: string;
    header: React.ReactNode;
    align?: 'left' | 'right' | 'center';
    cell: (row: T, index: number) => React.ReactNode;
    className?: string;
    headClassName?: string;
    width?: string;
}

export function SheetDataTable<T>({
    columns,
    rows,
    getRowKey,
    emptyText = 'No records found.',
    footer,
}: {
    columns: SheetColumn<T>[];
    rows: T[];
    getRowKey: (row: T, index: number) => string;
    emptyText?: string;
    footer?: React.ReactNode;
}) {
    const alignClass: Record<string, string> = {
        left: 'text-left',
        right: 'text-right',
        center: 'text-center',
    };

    return (
        <div className="overflow-x-auto rounded-md border border-[var(--doc-line-soft)]">
            <table className="w-full border-collapse text-xs">
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                style={col.width ? { width: col.width } : undefined}
                                className={cn(
                                    'border border-[var(--doc-line-soft)] bg-[var(--doc-table-head-bg)] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--doc-head-fg)]',
                                    alignClass[col.align ?? 'left'],
                                    col.headClassName,
                                )}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="border border-[var(--doc-line-soft)] px-3 py-6 text-center text-xs text-muted-foreground"
                            >
                                {emptyText}
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, index) => (
                            <tr key={getRowKey(row, index)} className="even:bg-muted/20 hover:bg-[var(--doc-head-bg)]/40">
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={cn(
                                            'border border-[var(--doc-line-soft)] px-2.5 py-1.5 align-middle text-foreground',
                                            alignClass[col.align ?? 'left'],
                                            col.className,
                                        )}
                                    >
                                        {col.cell(row, index)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
                {footer ? <tfoot>{footer}</tfoot> : null}
            </table>
        </div>
    );
}
