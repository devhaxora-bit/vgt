'use client';

import React, { useRef, useState } from 'react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface BillRecordPreview {
    id: string;
    bill_ref_no?: string | null;
    billing_date?: string;
    billing_period_from?: string | null;
    billing_period_to?: string | null;
    amount?: number | string | null;
    narration?: string | null;
    covered_cn_nos?: string[] | null;
    cn_total_amount?: number | string | null;
    status?: string;
    party_id?: string;
}

export interface BillPartyPreview {
    id: string;
    name: string;
    code: string;
    type?: string;
    phone?: string;
    gstin?: string;
    address?: string;
    branch_code?: string;
}

interface ConsignmentBillCellProps {
    record?: BillRecordPreview | null;
    party?: BillPartyPreview | null;
    onOpenBill: (record: BillRecordPreview, party: BillPartyPreview | null) => void;
}

const fmtDate = (value?: string | null) => {
    if (!value) return '—';
    try {
        return format(new Date(value), 'dd/MM/yyyy');
    } catch {
        return value;
    }
};

const fmtMoney = (value?: number | string | null) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num) || num <= 0) return '—';
    return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

function BillPreviewBody({
    record,
    party,
}: {
    record: BillRecordPreview;
    party?: BillPartyPreview | null;
}) {
    const billRef = record.bill_ref_no || record.id.slice(0, 8).toUpperCase();
    const cnCount = Array.isArray(record.covered_cn_nos) ? record.covered_cn_nos.length : 0;
    const period =
        record.billing_period_from || record.billing_period_to
            ? `${fmtDate(record.billing_period_from)} – ${fmtDate(record.billing_period_to)}`
            : '—';

    return (
        <div className="space-y-2 text-xs">
            <div className="font-mono font-bold text-primary text-sm">{billRef}</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Bill Date</span>
                <span>{fmtDate(record.billing_date)}</span>
                <span className="text-muted-foreground">Party</span>
                <span className="truncate" title={party?.name || ''}>
                    {party ? `${party.name} (${party.code})` : '—'}
                </span>
                <span className="text-muted-foreground">Period</span>
                <span>{period}</span>
                <span className="text-muted-foreground">CNs</span>
                <span>{cnCount}</span>
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">{fmtMoney(record.amount)}</span>
            </div>
            {record.narration ? (
                <p className="text-[10px] text-muted-foreground border-t pt-2 line-clamp-2" title={record.narration}>
                    {record.narration}
                </p>
            ) : null}
            <p className="text-[10px] text-primary font-medium pt-1">Click to open bill</p>
        </div>
    );
}

export function ConsignmentBillCell({ record, party, onOpenBill }: ConsignmentBillCellProps) {
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    if (!record) {
        return <span className="text-xs text-muted-foreground">—</span>;
    }

    const billRef = record.bill_ref_no || record.id.slice(0, 8).toUpperCase();

    const handleEnter = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setOpen(true);
    };

    const handleLeave = () => {
        closeTimer.current = setTimeout(() => setOpen(false), 120);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenBill(record, party || null);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="font-mono text-[11px] font-semibold text-amber-800 hover:underline underline-offset-2"
                    onMouseEnter={handleEnter}
                    onMouseLeave={handleLeave}
                    onClick={handleClick}
                >
                    {billRef}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-72 p-3"
                align="start"
                side="top"
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
            >
                <BillPreviewBody record={record} party={party} />
            </PopoverContent>
        </Popover>
    );
}
