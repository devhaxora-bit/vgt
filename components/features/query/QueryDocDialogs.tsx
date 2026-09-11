'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { ConsignmentDetailsDialog } from '@/components/features/consignments/ConsignmentDetailsDialog';
import { ChallanDetailsDialog } from '@/components/features/challans/ChallanDetailsDialog';
import { BillingRecordViewDialog } from '@/components/features/ledger/BillingRecordDialogs';
import { cn } from '@/lib/utils';

/** Clickable document reference (CN / challan / bill) used across query sheets. */
export function QueryRefLink({
    children,
    onClick,
    loading = false,
    disabled = false,
    title,
    className,
}: {
    children: React.ReactNode;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
    title?: string;
    className?: string;
}) {
    return (
        <button
            type="button"
            title={title || 'View details'}
            disabled={disabled || loading}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            }}
            className={cn(
                'inline-flex max-w-full items-center gap-1 truncate font-mono font-semibold text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60',
                className,
            )}
        >
            {loading ? <Loader2 className="h-3 w-3 animate-spin shrink-0" /> : null}
            <span className="truncate">{children}</span>
        </button>
    );
}

type BillDialogPayload = {
    party: Record<string, unknown> | null;
    record: Record<string, unknown> | null;
    consignments: unknown[];
};

export function useQueryDocDialogs() {
    const [cnOpen, setCnOpen] = React.useState(false);
    const [cnRecord, setCnRecord] = React.useState<Record<string, unknown> | null>(null);

    const [challanOpen, setChallanOpen] = React.useState(false);
    const [challanRecord, setChallanRecord] = React.useState<Record<string, unknown> | null>(null);

    const [billOpen, setBillOpen] = React.useState(false);
    const [billDetail, setBillDetail] = React.useState<BillDialogPayload | null>(null);

    const [loadingKey, setLoadingKey] = React.useState<string | null>(null);

    const openCn = React.useCallback(async (input: { id?: string | null; cn_no?: string | null } | string | null | undefined) => {
        const id = typeof input === 'string' ? input : input?.id;
        const cnNo = typeof input === 'string' ? undefined : input?.cn_no;
        if (!id && !cnNo) return;

        const key = `cn:${id || cnNo}`;
        setLoadingKey(key);
        try {
            let resolvedId = id || undefined;
            if (!resolvedId && cnNo) {
                const res = await fetch(`/api/consignments/by-cn?cn=${encodeURIComponent(cnNo)}`);
                if (!res.ok) throw new Error('CN not found');
                const data = await res.json();
                const row = Array.isArray(data) ? data[0] : data;
                resolvedId = row?.id;
                if (!resolvedId) throw new Error('CN not found');
                setCnRecord(row as Record<string, unknown>);
                setCnOpen(true);
                return;
            }

            setCnRecord({ id: resolvedId });
            setCnOpen(true);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not open CN');
        } finally {
            setLoadingKey(null);
        }
    }, []);

    const openChallan = React.useCallback(async (
        input: { id?: string | null; challan_no?: string | null } | string | Record<string, unknown> | null | undefined,
    ) => {
        if (!input) return;

        const id = typeof input === 'string'
            ? input
            : (input.id != null ? String(input.id) : undefined);
        const challanNo = typeof input === 'string'
            ? undefined
            : (input.challan_no != null ? String(input.challan_no) : undefined);
        if (!id && !challanNo) return;

        const key = `challan:${id || challanNo}`;
        setLoadingKey(key);
        try {
            if (id) {
                const res = await fetch(`/api/challans/${encodeURIComponent(id)}`);
                if (!res.ok) throw new Error('Challan not found');
                const data = await res.json();
                setChallanRecord(data as Record<string, unknown>);
                setChallanOpen(true);
                return;
            }

            const res = await fetch(`/api/challans?search=${encodeURIComponent(challanNo!)}`);
            if (!res.ok) throw new Error('Challan not found');
            const data = await res.json();
            const rows = Array.isArray(data) ? data : (data?.data || []);
            const match = rows.find((row: { challan_no?: string }) =>
                String(row.challan_no || '').toUpperCase() === challanNo!.toUpperCase()
            ) || rows[0];
            if (!match?.id) throw new Error('Challan not found');

            const full = await fetch(`/api/challans/${encodeURIComponent(String(match.id))}`);
            if (!full.ok) throw new Error('Challan not found');
            setChallanRecord(await full.json());
            setChallanOpen(true);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not open challan');
        } finally {
            setLoadingKey(null);
        }
    }, []);

    const openBill = React.useCallback(async (billId: string | null | undefined) => {
        if (!billId) return;
        const key = `bill:${billId}`;
        setLoadingKey(key);
        try {
            const res = await fetch(`/api/query/bills?id=${encodeURIComponent(billId)}`);
            if (!res.ok) throw new Error('Bill not found');
            const data = await res.json() as BillDialogPayload & {
                record?: Record<string, unknown>;
                party?: Record<string, unknown>;
                consignments?: unknown[];
            };
            setBillDetail({
                party: data.party ?? null,
                record: data.record ?? null,
                consignments: data.consignments ?? [],
            });
            setBillOpen(true);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not open bill');
        } finally {
            setLoadingKey(null);
        }
    }, []);

    const isLoading = React.useCallback((key: string) => loadingKey === key, [loadingKey]);

    const dialogs = (
        <>
            <ConsignmentDetailsDialog
                isOpen={cnOpen}
                onClose={() => { setCnOpen(false); setCnRecord(null); }}
                consignment={cnRecord}
                isAdmin={false}
            />
            <ChallanDetailsDialog
                isOpen={challanOpen}
                onClose={() => { setChallanOpen(false); setChallanRecord(null); }}
                challan={challanRecord}
            />
            {billDetail ? (
                <BillingRecordViewDialog
                    open={billOpen}
                    onClose={() => { setBillOpen(false); setBillDetail(null); }}
                    party={billDetail.party as never}
                    record={billDetail.record as never}
                    consignments={billDetail.consignments as never}
                    isAdmin={false}
                    onEdit={() => setBillOpen(false)}
                />
            ) : null}
        </>
    );

    return {
        openCn,
        openChallan,
        openBill,
        isLoading,
        loadingKey,
        dialogs,
    };
}
