import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function QueryPageShell({
    icon,
    title,
    description,
    accentClass = 'bg-primary/10 text-primary',
    fullWidth = false,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    accentClass?: string;
    /** Dense tracking layouts use the full dashboard width. */
    fullWidth?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                'mx-auto w-full',
                fullWidth
                    ? 'max-w-[1920px] px-3 py-4 md:px-5 md:py-5'
                    : 'max-w-6xl px-4 py-6 md:px-6 md:py-8',
            )}
        >
            <Link
                href="/dashboard/query"
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" /> All queries
            </Link>

            <div className="mb-4 flex items-start gap-3">
                <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', accentClass)}>
                    {icon}
                </div>
                <div>
                    <h1 className="text-xl font-black tracking-tight text-foreground md:text-2xl">{title}</h1>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </div>

            {children}
        </div>
    );
}
