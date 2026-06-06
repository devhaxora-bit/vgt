'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Crown,
    Info,
    RefreshCw,
    XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

const LOW_CN_THRESHOLD = 5;

type CnRangeHistoryItem = {
    id: string;
    range_start: number;
    range_end: number;
    next_cn_no: number;
    status: 'active' | 'exhausted' | 'inactive';
    note?: string | null;
    created_at: string;
    assigned_by_name?: string | null;
    assigned_by_code?: string | null;
};

type BranchInfo = {
    id: string;
    code: string;
    name: string;
    is_head_branch: boolean;
    next_cn_no?: number;
};

type HeadBranchInfo = {
    code: string;
    name: string;
} | null;

type ActiveRange = {
    range_start: number;
    range_end: number;
    next_cn_no: number;
    status: string;
} | null;

type CnRangeConflict = {
    branch_code: string;
    branch_name: string;
    range_start: number;
    range_end: number;
};

type CnRangeValidation = {
    status: 'idle' | 'validating' | 'valid' | 'conflict' | 'error';
    conflicts: CnRangeConflict[];
    existing_cns: number[];
    suggested_start: number | null;
    remaining_after_start: number;
    error?: string;
};

const defaultValidation: CnRangeValidation = {
    status: 'idle',
    conflicts: [],
    existing_cns: [],
    suggested_start: null,
    remaining_after_start: 0,
};

const defaultRangeForm = {
    range_start: '',
    range_end: '',
    note: '',
};

const formatRange = (start?: number | null, end?: number | null) => {
    if (start == null || end == null) return '—';
    return `${start} – ${end}`;
};

const formatDateTime = (value: string) => {
    const date = new Date(value);
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getStatusBadge = (status: string) => {
    if (status === 'active') {
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>;
    }
    if (status === 'exhausted') {
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Exhausted</Badge>;
    }
    return <Badge variant="outline">Inactive</Badge>;
};

interface CnAssigningPanelProps {
    branchCode: string;
}

export function CnAssigningPanel({ branchCode }: CnAssigningPanelProps) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [branch, setBranch] = useState<BranchInfo | null>(null);
    const [headBranch, setHeadBranch] = useState<HeadBranchInfo>(null);
    const [activeRange, setActiveRange] = useState<ActiveRange>(null);
    const [history, setHistory] = useState<CnRangeHistoryItem[]>([]);
    const [remainingCount, setRemainingCount] = useState<number | null>(null);
    const [isLowCn, setIsLowCn] = useState(false);
    const [rangeForm, setRangeForm] = useState(defaultRangeForm);
    const [validation, setValidation] = useState<CnRangeValidation>(defaultValidation);
    const validationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/documentation/branches/${branchCode}/cn-ranges`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to load CN assigning data');
            }

            setBranch(data.branch);
            setHeadBranch(data.head_branch);
            setActiveRange(data.active_range);
            setHistory(data.history || []);
            setRemainingCount(data.remaining_count ?? null);
            setIsLowCn(Boolean(data.is_low_cn));
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to load CN data');
        } finally {
            setLoading(false);
        }
    }, [branchCode]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const triggerValidation = useCallback(
        (branchId: string, rangeStart: string, rangeEnd: string) => {
            if (validationDebounceRef.current) clearTimeout(validationDebounceRef.current);

            const start = parseInt(rangeStart, 10);
            const end = parseInt(rangeEnd, 10);

            if (!branchId || Number.isNaN(start) || Number.isNaN(end) || start > end) {
                setValidation(defaultValidation);
                return;
            }

            setValidation((prev) => ({ ...prev, status: 'validating' }));

            validationDebounceRef.current = setTimeout(async () => {
                try {
                    const res = await fetch('/api/references/branches/cn-ranges/validate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ branch_id: branchId, range_start: start, range_end: end }),
                    });
                    const data = await res.json();

                    if (!res.ok) {
                        setValidation({
                            ...defaultValidation,
                            status: 'error',
                            error: data.error || 'Validation failed',
                        });
                        return;
                    }

                    setValidation({
                        status: data.has_conflicts ? 'conflict' : 'valid',
                        conflicts: data.conflicts || [],
                        existing_cns: data.existing_cns || [],
                        suggested_start: data.suggested_start ?? null,
                        remaining_after_start: data.remaining_after_start ?? 0,
                    });
                } catch {
                    setValidation({
                        ...defaultValidation,
                        status: 'error',
                        error: 'Network error during validation',
                    });
                }
            }, 600);
        },
        []
    );

    const handleRangeFormChange = (field: keyof typeof defaultRangeForm, value: string) => {
        const updated = { ...rangeForm, [field]: value };
        setRangeForm(updated);
        setValidation(defaultValidation);

        if (branch?.id && updated.range_start && updated.range_end) {
            triggerValidation(branch.id, updated.range_start, updated.range_end);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!branch) return;

        if (validation.status === 'conflict') {
            toast.error(
                `Range overlaps with ${validation.conflicts.map((c) => c.branch_code).join(', ')}. Choose a different range.`
            );
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/references/branches/cn-ranges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    branch_id: branch.id,
                    range_start: rangeForm.range_start,
                    range_end: rangeForm.range_end,
                    note: rangeForm.note,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to issue CN range');
            }

            toast.success(
                `CN range ${rangeForm.range_start}–${rangeForm.range_end} issued. Starting CN: ${data.next_cn_no}.`
            );

            setRangeForm(defaultRangeForm);
            setValidation(defaultValidation);
            await fetchData();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to issue CN range');
        } finally {
            setSubmitting(false);
        }
    };

    const renderValidationPanel = () => {
        const v = validation;
        if (v.status === 'idle') return null;

        if (v.status === 'validating') {
            return (
                <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
                    Checking range availability…
                </div>
            );
        }

        if (v.status === 'error') {
            return (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
                    <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{v.error || 'Validation failed. Please try again.'}</span>
                </div>
            );
        }

        if (v.status === 'conflict') {
            return (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-red-700">
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                        Range conflict — cannot assign
                    </div>
                    {v.conflicts.map((c, i) => (
                        <div key={i} className="text-red-600 ml-5">
                            Numbers {c.range_start}–{c.range_end} are already issued to branch{' '}
                            <span className="font-mono font-semibold">{c.branch_code}</span> ({c.branch_name})
                        </div>
                    ))}
                    <div className="text-red-600 ml-5">Please choose a different range.</div>
                </div>
            );
        }

        return (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Range available — no conflicts with other branches
                </div>

                {v.existing_cns.length > 0 && (
                    <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-700">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {v.existing_cns.length} CN{v.existing_cns.length !== 1 ? 's' : ''} in this range already exist in consignments
                        </div>
                        <div className="text-amber-700 font-mono">
                            {v.existing_cns.slice(0, 20).join(', ')}
                            {v.existing_cns.length > 20 && ` … and ${v.existing_cns.length - 20} more`}
                        </div>
                        <div className="text-amber-600">
                            These numbers will be skipped automatically. The system will not re-issue them.
                        </div>
                    </div>
                )}

                {v.suggested_start !== null ? (
                    <div className="flex items-center gap-2 text-emerald-800">
                        <Info className="h-3 w-3 shrink-0" />
                        <span>
                            Starting CN for this branch will be{' '}
                            <span className="font-mono font-bold">{v.suggested_start}</span>
                            {v.remaining_after_start > 0 && (
                                <>
                                    {' '}·{' '}
                                    <span className={v.remaining_after_start <= LOW_CN_THRESHOLD ? 'text-amber-700 font-semibold' : ''}>
                                        {v.remaining_after_start} CN{v.remaining_after_start !== 1 ? 's' : ''} available
                                    </span>
                                    {v.remaining_after_start <= LOW_CN_THRESHOLD && ' (very low — consider a larger range)'}
                                </>
                            )}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        All numbers in this range are already used. Choose a different range.
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                Loading CN assigning…
            </div>
        );
    }

    if (!branch) {
        return (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Branch not found.
            </div>
        );
    }

    const currentNextCn = activeRange ? activeRange.next_cn_no : branch.next_cn_no || '—';

    return (
        <div className="space-y-6">
            {headBranch && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-start gap-2 text-sm text-indigo-800">
                    <Crown className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600" />
                    <span>
                        CN ranges are issued by{' '}
                        <span className="font-semibold">{headBranch.code} — {headBranch.name}</span>{' '}
                        (Head Branch). Each range belongs exclusively to the assigned branch.
                    </span>
                </div>
            )}

            {isLowCn && typeof remainingCount === 'number' && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                        <div className="font-semibold">
                            Only {remainingCount} CN{remainingCount !== 1 ? 's' : ''} left in active range!
                        </div>
                        <div className="text-xs mt-0.5">
                            Issue a new CN range before numbers run out.
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4 bg-white">
                    <div className="text-[11px] font-bold uppercase text-muted-foreground">Current CN Status</div>
                    <div className="mt-2 flex items-center gap-2">
                        {activeRange ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Managed Range</Badge>
                        ) : (
                            <Badge variant="outline">No Active Range</Badge>
                        )}
                        {branch.is_head_branch && (
                            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Head Branch</Badge>
                        )}
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                        {activeRange
                            ? `Online entry uses range ${formatRange(activeRange.range_start, activeRange.range_end)}.`
                            : 'No active CN range — issue one below to enable managed CN entry.'}
                    </div>
                </div>

                <div className="rounded-lg border p-4 bg-white">
                    <div className="text-[11px] font-bold uppercase text-muted-foreground">Current Next CN</div>
                    <div className="mt-2 flex items-baseline gap-3">
                        <span className="font-mono text-2xl font-semibold text-[#101828]">{currentNextCn}</span>
                        {isLowCn && typeof remainingCount === 'number' && (
                            <span className="text-xs font-semibold text-amber-600">⚠ {remainingCount} left</span>
                        )}
                        {!isLowCn && typeof remainingCount === 'number' && (
                            <span className="text-xs text-muted-foreground">{remainingCount} remaining</span>
                        )}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                        {activeRange
                            ? `Live range: ${formatRange(activeRange.range_start, activeRange.range_end)}`
                            : 'No managed range active'}
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-lg border p-4 space-y-4 bg-white">
                <div>
                    <div className="font-semibold text-[#101828]">Issue New CN Range</div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Assign the next official CN block for {branch.code}. The system auto-advances inside this range only.
                    </p>
                </div>

                {activeRange && (
                    <div className="rounded bg-slate-50 border px-3 py-2 text-xs text-muted-foreground">
                        Current active range:{' '}
                        <span className="font-mono font-semibold text-foreground">
                            {formatRange(activeRange.range_start, activeRange.range_end)}
                        </span>
                        {' '}· next CN:{' '}
                        <span className="font-mono font-semibold text-foreground">{currentNextCn}</span>
                        {typeof remainingCount === 'number' && (
                            <>
                                {' '}·{' '}
                                <span className={isLowCn ? 'text-amber-600 font-semibold' : ''}>
                                    {remainingCount} left
                                </span>
                            </>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="range-start">Range Start</Label>
                        <Input
                            id="range-start"
                            type="number"
                            required
                            value={rangeForm.range_start}
                            onChange={(e) => handleRangeFormChange('range_start', e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="range-end">Range End</Label>
                        <Input
                            id="range-end"
                            type="number"
                            required
                            value={rangeForm.range_end}
                            onChange={(e) => handleRangeFormChange('range_end', e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="range-note">
                        Note <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                        id="range-note"
                        placeholder="e.g. June 2026 branch allocation"
                        value={rangeForm.note}
                        onChange={(e) => handleRangeFormChange('note', e.target.value)}
                    />
                </div>

                {renderValidationPanel()}

                <div className="flex items-center gap-2">
                    <Button
                        type="submit"
                        disabled={
                            submitting ||
                            validation.status === 'conflict' ||
                            (validation.suggested_start === null && validation.status === 'valid')
                        }
                    >
                        {submitting ? 'Issuing Range…' : 'Issue CN Range'}
                    </Button>
                    <Button type="button" variant="outline" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </form>

            <div className="rounded-lg border bg-white overflow-hidden">
                <div className="px-4 py-3 border-b">
                    <div className="font-semibold text-[#101828]">CN Range History</div>
                    <p className="text-sm text-muted-foreground">
                        All CN ranges issued to {branch.code}, newest first.
                    </p>
                </div>

                {history.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead>Date & Time</TableHead>
                                <TableHead>CN Range</TableHead>
                                <TableHead>Starting CN</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Issued By</TableHead>
                                <TableHead>Note</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="text-sm whitespace-nowrap">
                                        {formatDateTime(item.created_at)}
                                    </TableCell>
                                    <TableCell className="font-mono font-semibold">
                                        {formatRange(item.range_start, item.range_end)}
                                    </TableCell>
                                    <TableCell className="font-mono">{item.next_cn_no}</TableCell>
                                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                                    <TableCell>
                                        {item.assigned_by_name ? (
                                            <div>
                                                <div className="text-sm font-medium">{item.assigned_by_name}</div>
                                                {item.assigned_by_code && (
                                                    <div className="text-xs text-muted-foreground">{item.assigned_by_code}</div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                        {item.note || '—'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                        No CN ranges have been issued to this branch yet.
                    </div>
                )}
            </div>
        </div>
    );
}
