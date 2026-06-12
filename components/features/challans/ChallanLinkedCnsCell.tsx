'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { compareCnNo } from '@/lib/sortLinkedConsignments';

export interface LinkedCnPreview {
    id: string;
    cn_no: string;
    bkg_date?: string;
    consignor_name?: string;
    consignee_name?: string;
    dest_branch?: string;
    delivery_point?: string;
    booking_branch?: string;
    no_of_pkg?: number;
    charged_weight?: number | string;
    actual_weight?: number | string;
    load_unit?: string;
    total_freight?: number;
    goods_desc?: string;
    bkg_basis?: string;
}

interface ChallanLinkedCnsCellProps {
    linkedCnNos?: string[] | null;
    onOpenCn: (consignment: LinkedCnPreview) => void;
}

const fmtDate = (value?: string) => {
    if (!value) return '—';
    try {
        return format(new Date(value), 'dd/MM/yyyy');
    } catch {
        return value;
    }
};

const fmtMoney = (value?: number) =>
    Number(value || 0) > 0
        ? `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
        : '—';

function CnPreviewBody({ data, loading }: { data?: LinkedCnPreview; loading: boolean }) {
    if (loading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading CN details...
            </div>
        );
    }

    if (!data) {
        return <p className="text-xs text-muted-foreground">Could not load CN details.</p>;
    }

    const weight = data.charged_weight || data.actual_weight;
    const destination = data.delivery_point || data.dest_branch || '—';

    return (
        <div className="space-y-2 text-xs">
            <div className="font-mono font-bold text-primary text-sm">{data.cn_no}</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Date</span>
                <span>{fmtDate(data.bkg_date)}</span>
                <span className="text-muted-foreground">Consignor</span>
                <span className="truncate" title={data.consignor_name || ''}>{data.consignor_name || '—'}</span>
                <span className="text-muted-foreground">Destination</span>
                <span className="truncate" title={destination}>{destination}</span>
                <span className="text-muted-foreground">Packages</span>
                <span>{data.no_of_pkg ?? '—'}</span>
                <span className="text-muted-foreground">Weight</span>
                <span>{weight ? `${weight} ${data.load_unit || 'KG'}` : '—'}</span>
                <span className="text-muted-foreground">Freight</span>
                <span className="font-semibold">{fmtMoney(data.total_freight)}</span>
            </div>
            {data.goods_desc ? (
                <p className="text-[10px] text-muted-foreground border-t pt-2 line-clamp-2" title={data.goods_desc}>
                    {data.goods_desc}
                </p>
            ) : null}
            <p className="text-[10px] text-primary font-medium pt-1">Click to open CN</p>
        </div>
    );
}

function LinkedCnLink({
    cnNo,
    cache,
    onOpenCn,
    onPrefetch,
}: {
    cnNo: string;
    cache: Record<string, LinkedCnPreview | undefined>;
    onOpenCn: (consignment: LinkedCnPreview) => void;
    onPrefetch: (cnNo: string) => Promise<LinkedCnPreview | null>;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cached = cache[cnNo];

    const loadDetails = useCallback(async () => {
        if (cached) return cached;
        setLoading(true);
        try {
            return await onPrefetch(cnNo);
        } finally {
            setLoading(false);
        }
    }, [cached, cnNo, onPrefetch]);

    const handleEnter = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setOpen(true);
        void loadDetails();
    };

    const handleLeave = () => {
        closeTimer.current = setTimeout(() => setOpen(false), 120);
    };

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const data = cached || await loadDetails();
        if (data) onOpenCn(data);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="font-mono text-[11px] font-semibold text-primary hover:underline underline-offset-2"
                    onMouseEnter={handleEnter}
                    onMouseLeave={handleLeave}
                    onClick={handleClick}
                >
                    {cnNo}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-72 p-3"
                align="start"
                side="top"
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
            >
                <CnPreviewBody data={cached} loading={loading && !cached} />
            </PopoverContent>
        </Popover>
    );
}

export function ChallanLinkedCnsCell({ linkedCnNos, onOpenCn }: ChallanLinkedCnsCellProps) {
    const [cache, setCache] = useState<Record<string, LinkedCnPreview>>({});
    const cacheRef = useRef<Record<string, LinkedCnPreview>>({});

    const sortedCnNos = useMemo(() => {
        const list = (linkedCnNos || []).filter(Boolean);
        return [...list].sort(compareCnNo);
    }, [linkedCnNos]);

    const prefetchCn = useCallback(async (cnNo: string): Promise<LinkedCnPreview | null> => {
        const cached = cacheRef.current[cnNo];
        if (cached) return cached;

        try {
            const res = await fetch(`/api/consignments/by-cn?cn=${encodeURIComponent(cnNo)}`);
            if (!res.ok) return null;
            const data = await res.json() as LinkedCnPreview;
            if (!data?.cn_no) return null;
            cacheRef.current[cnNo] = data;
            setCache((prev) => ({ ...prev, [cnNo]: data }));
            return data;
        } catch {
            return null;
        }
    }, []);

    if (sortedCnNos.length === 0) {
        return <span className="text-xs text-muted-foreground">—</span>;
    }

    return (
        <div className="flex flex-wrap gap-x-1 gap-y-0.5 max-w-[200px]">
            {sortedCnNos.map((cnNo, index) => (
                <React.Fragment key={cnNo}>
                    <LinkedCnLink
                        cnNo={cnNo}
                        cache={cache}
                        onOpenCn={onOpenCn}
                        onPrefetch={prefetchCn}
                    />
                    {index < sortedCnNos.length - 1 ? (
                        <span className="text-muted-foreground text-[10px]">,</span>
                    ) : null}
                </React.Fragment>
            ))}
        </div>
    );
}
