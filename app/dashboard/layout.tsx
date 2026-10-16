import React from 'react';
import DashboardNav from '@/components/layouts/DashboardNav';
import { SessionGuard } from '@/components/features/auth/SessionGuard';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-dvh min-h-0 flex-col bg-gray-50 overflow-hidden">
            <SessionGuard />
            {/* Navigation Bar */}
            <DashboardNav />
            {/* Main Content */}
            <main className="flex min-h-0 flex-1 w-full flex-col overflow-auto bg-[#f8f9fa] border-t border-gray-200 shadow-inner">
                {children}
            </main>

            {/* Footer */}
            <footer className="shrink-0 bg-white border-t py-1.5 shadow-sm z-10 relative">
                <div className="mx-auto flex max-w-7xl items-center justify-center px-4 text-xs font-medium text-muted-foreground">
                    <span>© {new Date().getFullYear()} Visakha Golden Transport</span>
                </div>
            </footer>
        </div>
    );
}
