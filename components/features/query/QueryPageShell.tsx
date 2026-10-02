import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
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
    description?: string;
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
                    ? 'max-w-[1920px] px-3 py-2 md:px-4 md:py-3'
                    : 'max-w-6xl px-4 py-3 md:px-6 md:py-4',
            )}
        >
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                    href="/dashboard/query"
                    className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    Query
                </Link>
                <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                <div className={cn('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5', accentClass)}>
                    {icon}
                </div>
                <h1 className="text-sm font-bold tracking-tight text-foreground">{title}</h1>
                {description ? (
                    <span className="hidden text-[11px] text-muted-foreground sm:inline">· {description}</span>
                ) : null}
            </div>

            {children}
        </div>
    );
}
