'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Truck,
    Users,
    DollarSign,
    Activity,
    MapPin,
    Package,
    Loader2,
    ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatBranchLabel } from '@/lib/formatBranchLabel';

type DashboardStatsResponse = {
    user: {
        full_name: string | null;
        employee_code: string | null;
        role: string;
        branch_access: string;
        branch_access_label: string;
    };
    branch: {
        code: string | null;
        scope: string;
        label: string;
        detail: string | null;
        is_filtered: boolean;
    };
    stats: {
        consignments_this_month: number;
        active_parties: number;
        active_challans: number;
        outstanding_amount: number;
        unbilled_amount: number;
        total_cns: number;
        total_billed: number;
        total_paid: number;
    };
    recent_consignments: Array<{
        cn_no: string;
        booking_branch: string | null;
        bkg_date: string | null;
        total_freight: number;
        consignor_name: string | null;
        destination: string | null;
    }>;
};

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const formatDate = (value: string | null) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function DashboardPage() {
    const [data, setData] = useState<DashboardStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/dashboard/stats');
                const json = await res.json();
                if (!res.ok) {
                    throw new Error(json.error || 'Failed to load dashboard');
                }
                if (!cancelled) setData(json);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load dashboard');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    const stats = data
        ? [
            {
                title: 'CNs This Month',
                value: fmt(data.stats.consignments_this_month),
                icon: Truck,
                desc: data.branch.is_filtered
                    ? `at ${data.branch.label}`
                    : 'across all branches',
            },
            {
                title: 'Active Parties',
                value: fmt(data.stats.active_parties),
                icon: Users,
                desc: 'billing parties',
            },
            {
                title: 'Outstanding',
                value: `₹${fmtMoney(data.stats.outstanding_amount)}`,
                icon: DollarSign,
                desc: `unbilled ₹${fmtMoney(data.stats.unbilled_amount)}`,
            },
            {
                title: 'Active Challans',
                value: fmt(data.stats.active_challans),
                icon: Package,
                desc: 'loading challans',
            },
        ]
        : [];

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-[1920px] mx-auto animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            {data?.user.full_name ? `Welcome, ${data.user.full_name}` : 'Cockpit'}
                        </h1>
                        {data?.user.branch_access_label && (
                            <Badge variant="secondary">{data.user.branch_access_label}</Badge>
                        )}
                    </div>
                    <p className="text-muted-foreground flex items-center gap-2 flex-wrap">
                        <MapPin className="h-4 w-4 shrink-0" />
                        {loading ? (
                            <span>Loading branch context…</span>
                        ) : error ? (
                            <span className="text-destructive">{error}</span>
                        ) : (
                            <>
                                <span className="font-medium text-foreground">{data?.branch.label}</span>
                                {data?.branch.detail && (
                                    <span>· {data.branch.detail}</span>
                                )}
                            </>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/consignments">View CNs</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/dashboard/consignments/new">New CN</Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {loading ? (
                    <div className="col-span-full flex items-center justify-center py-16 text-muted-foreground gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading live stats…
                    </div>
                ) : error ? (
                    <div className="col-span-full rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
                        {error}
                    </div>
                ) : (
                    stats.map((stat) => (
                        <Card
                            key={stat.title}
                            className="hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm"
                        >
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {stat.title}
                                </CardTitle>
                                <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                                    <stat.icon className="h-4 w-4 text-primary" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stat.value}</div>
                                <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20 overflow-hidden relative">
                <div className="absolute top-0 right-0 h-64 w-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <CardContent className="p-8 relative z-10">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="space-y-4 flex-1">
                            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                Daily Inspiration
                            </div>
                            <h3 className="text-2xl font-semibold leading-relaxed text-foreground">
                                &ldquo;How you begin your day can make your day, or break your day. Your attitude and your actions have a strong effect on your whole day.&rdquo;
                            </h3>
                        </div>
                        <div className="hidden md:flex h-32 w-32 bg-background rounded-full items-center justify-center border-4 border-dashed border-primary/20 shadow-inner rotate-12">
                            <Activity className="h-12 w-12 text-primary/40" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Recent CNs</CardTitle>
                            <CardDescription>Latest consignments for your branch scope</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/consignments">
                                View all <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading…
                            </div>
                        ) : !data?.recent_consignments.length ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                                No consignments yet
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data.recent_consignments.map((cn) => (
                                    <div
                                        key={cn.cn_no}
                                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="font-mono font-semibold text-sm">{cn.cn_no}</div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {cn.consignor_name || '—'}
                                                {cn.destination ? ` → ${cn.destination}` : ''}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-medium">₹{fmtMoney(cn.total_freight)}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatDate(cn.bkg_date)}
                                                {cn.booking_branch
                                                    ? ` · ${formatBranchLabel(cn.booking_branch)}`
                                                    : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Ledger Snapshot</CardTitle>
                        <CardDescription>
                            {data?.branch.is_filtered
                                ? `Totals for ${data.branch.label}`
                                : 'Totals across all branches'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading…
                            </div>
                        ) : data ? (
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Total CNs', value: fmt(data.stats.total_cns) },
                                    { label: 'Total Billed', value: `₹${fmtMoney(data.stats.total_billed)}` },
                                    { label: 'Total Paid', value: `₹${fmtMoney(data.stats.total_paid)}` },
                                    { label: 'Outstanding', value: `₹${fmtMoney(data.stats.outstanding_amount)}` },
                                ].map((item) => (
                                    <div key={item.label} className="rounded-lg border p-4">
                                        <div className="text-xs text-muted-foreground">{item.label}</div>
                                        <div className="text-lg font-bold mt-1">{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <div className="mt-4">
                            <Button variant="outline" className="w-full" asChild>
                                <Link href="/dashboard/ledger">Open Party Ledger</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
