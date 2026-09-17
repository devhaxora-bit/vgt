import React from 'react';
import Image from 'next/image';
import DashboardNav from '@/components/layouts/DashboardNav';
import { SessionKeepAlive } from '@/components/features/auth/SessionKeepAlive';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <SessionKeepAlive />
            {/* Navigation Bar */}
            <DashboardNav />
            {/* Main Content */}
            <main className="flex-1 w-full bg-[#f8f9fa] border-t border-gray-200 shadow-inner">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t py-2 shadow-sm mt-auto z-10 relative">
                <div className="mx-auto flex max-w-7xl items-center justify-center px-4 text-xs font-medium text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/vgt_logo.png"
                            alt="Visakha Golden Transport"
                            width={56}
                            height={28}
                            className="h-6 w-auto object-contain"
                        />
                        <span>© {new Date().getFullYear()} Visakha Golden Transport</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
