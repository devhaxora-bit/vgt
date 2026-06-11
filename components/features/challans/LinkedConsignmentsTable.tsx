'use client';

import { format } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { LinkedCnSortField } from '@/lib/sortLinkedConsignments';

export interface LinkedConsignmentRow {
    id: string;
    cn_no: string;
    bkg_date?: string;
    consignor_name?: string;
    packages?: Array<{ method?: string; qty?: number; sr_no?: number }>;
    no_of_pkg?: number;
    total_qty?: number;
    goods_class?: string;
    goods_desc?: string;
    actual_weight?: number | string;
    charged_weight?: number | string;
    load_unit?: string;
    dest_branch?: string;
    delivery_point?: string;
}

interface LinkedConsignmentsTableProps {
    items: LinkedConsignmentRow[];
    sortField: LinkedCnSortField;
    sortDir: 'asc' | 'desc';
    onSort: (field: LinkedCnSortField) => void;
    onRemove?: (id: string) => void;
    emptyMessage?: string;
}

function SortableHead({
    label,
    field,
    sortField,
    sortDir,
    onSort,
    className,
}: {
    label: string;
    field: LinkedCnSortField;
    sortField: LinkedCnSortField;
    sortDir: 'asc' | 'desc';
    onSort: (field: LinkedCnSortField) => void;
    className?: string;
}) {
    const active = sortField === field;
    return (
        <TableHead className={className}>
            <button
                type="button"
                className="inline-flex items-center gap-1 font-bold uppercase text-[10px] tracking-wide hover:text-foreground whitespace-nowrap"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSort(field);
                }}
            >
                {label}
                {!active ? (
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                ) : sortDir === 'asc' ? (
                    <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                    <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
            </button>
        </TableHead>
    );
}

export function LinkedConsignmentsTable({
    items,
    sortField,
    sortDir,
    onSort,
    onRemove,
    emptyMessage = 'No CNS numbers linked.',
}: LinkedConsignmentsTableProps) {
    return (
        <div className="overflow-x-auto rounded-md border">
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow>
                        <TableHead className="w-12 text-[10px] font-bold uppercase">Sr</TableHead>
                        <SortableHead label="CNS No" field="cn_no" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                        <SortableHead label="CN Date" field="bkg_date" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                        <SortableHead label="Consignor" field="consignor_name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                        <SortableHead label="Packages" field="packages" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                        <TableHead className="text-[10px] font-bold uppercase">Pkg Type</TableHead>
                        <SortableHead label="Material" field="goods_desc" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                        <SortableHead label="Weight" field="weight" sortField={sortField} sortDir={sortDir} onSort={onSort} className="text-right" />
                        <SortableHead label="Destination" field="destination" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                        {onRemove ? <TableHead className="w-12" /> : null}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={onRemove ? 10 : 9} className="h-24 text-center text-sm text-muted-foreground">
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map((cn, index) => {
                            const packageSummary = (cn.packages || [])
                                .map((pkg) => `${pkg.qty || 0} ${pkg.method || 'Pkg'}`)
                                .join(', ');
                            const packageTypes = Array.from(
                                new Set((cn.packages || []).map((pkg) => pkg.method).filter(Boolean))
                            ).join(', ');
                            const weight = cn.charged_weight || cn.actual_weight || 0;
                            const cnDate = cn.bkg_date
                                ? format(new Date(cn.bkg_date), 'dd/MM/yyyy')
                                : '---';

                            return (
                                <TableRow key={cn.id || cn.cn_no}>
                                    <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                                    <TableCell className="font-mono text-xs font-bold text-primary">{cn.cn_no}</TableCell>
                                    <TableCell className="font-mono text-xs">{cnDate}</TableCell>
                                    <TableCell className="text-xs max-w-[140px] truncate" title={cn.consignor_name || ''}>
                                        {cn.consignor_name || '---'}
                                    </TableCell>
                                    <TableCell className="text-xs">{packageSummary || `${cn.no_of_pkg || 0} packages`}</TableCell>
                                    <TableCell className="text-xs">{packageTypes || cn.goods_class || '---'}</TableCell>
                                    <TableCell className="text-xs max-w-[180px] truncate" title={cn.goods_desc || cn.goods_class || ''}>
                                        {cn.goods_desc || cn.goods_class || '---'}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-right">
                                        {weight} {cn.load_unit || 'KG'}
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[140px] truncate" title={cn.delivery_point || cn.dest_branch || ''}>
                                        {cn.delivery_point || cn.dest_branch || '---'}
                                    </TableCell>
                                    {onRemove ? (
                                        <TableCell>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive"
                                                onClick={() => onRemove(cn.id)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    ) : null}
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
