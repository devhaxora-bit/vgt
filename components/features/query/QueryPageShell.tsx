import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function QueryPageShell({
    icon,
    title,
    description,
    accentClass = 'bg-primary/10 text-primary',
    children,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    accentClass?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
            <Link
                href="/dashboard/query"
                className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" /> All queries
            </Link>

            <div className="mb-7 flex items-start gap-4">
                <div className={cn('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl', accentClass)}>
                    {icon}
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </div>

            {children}
        </div>
    );
}
