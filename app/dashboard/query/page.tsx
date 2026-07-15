import * as React from 'react';
import Link from 'next/link';
import { FileText, ClipboardList, ReceiptText, Truck, Building2, ArrowRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueryTile {
    href: string;
    title: string;
    description: string;
    example: string;
    icon: React.ReactNode;
    accent: string;
}

const tiles: QueryTile[] = [
    {
        href: '/dashboard/query/cns',
        title: 'CNS Query',
        description: 'Look up a consignment note and view its full booking, freight and party details.',
        example: 'e.g. MRG-0001',
        icon: <FileText className="h-6 w-6" />,
        accent: 'bg-blue-500/10 text-blue-600',
    },
    {
        href: '/dashboard/query/challan',
        title: 'Challan Query',
        description: 'Find a lorry challan with its vehicle, driver, broker and linked consignments.',
        example: 'e.g. CH-2045',
        icon: <ClipboardList className="h-6 w-6" />,
        accent: 'bg-violet-500/10 text-violet-600',
    },
    {
        href: '/dashboard/query/bill',
        title: 'Bill Query',
        description: 'Search a freight bill by reference or party and review every billed line item.',
        example: 'e.g. VGT/25-26/120',
        icon: <ReceiptText className="h-6 w-6" />,
        accent: 'bg-emerald-500/10 text-emerald-600',
    },
    {
        href: '/dashboard/query/party',
        title: 'Party Query',
        description: 'Search by party name to see bills, payments, outstanding dues, consignments and related challans.',
        example: 'e.g. Saburi / Tirupati',
        icon: <Building2 className="h-6 w-6" />,
        accent: 'bg-sky-500/10 text-sky-600',
    },
    {
        href: '/dashboard/query/truck',
        title: 'Truck Query',
        description: 'Enter a vehicle number to see its master record plus all consignments and challans.',
        example: 'e.g. AP31TG1234',
        icon: <Truck className="h-6 w-6" />,
        accent: 'bg-amber-500/10 text-amber-600',
    },
];

export default function QueryHubPage() {
    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
            <div className="mb-10 flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Search className="h-7 w-7" />
                </div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Query Center</h1>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    Instantly look up any record by its number. Pick what you want to find — start typing and we’ll
                    suggest matches, then show every detail in a clean document view.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {tiles.map((tile) => (
                    <Link
                        key={tile.href}
                        href={tile.href}
                        className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                    >
                        <div className="flex items-start justify-between">
                            <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', tile.accent)}>
                                {tile.icon}
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                        </div>
                        <h2 className="mt-4 text-lg font-bold text-foreground">{tile.title}</h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{tile.description}</p>
                        <p className="mt-3 inline-flex rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                            {tile.example}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
