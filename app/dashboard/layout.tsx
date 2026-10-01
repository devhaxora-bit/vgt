import React from 'react';
import DashboardNav from '@/components/layouts/DashboardNav';
import { SessionGuard } from '@/components/features/auth/SessionGuard';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <SessionGuard />
            {/* Navigation Bar */}
            <DashboardNav />
            {/* Main Content */}
            <main className="flex-1 w-full bg-[#f8f9fa] border-t border-gray-200 shadow-inner">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t py-2 shadow-sm mt-auto z-10 relative">
                <div className="mx-auto flex max-w-7xl items-center justify-center px-4 text-xs font-medium text-muted-foreground">
                    <span>© {new Date().getFullYear()} Visakha Golden Transport</span>
                </div>
            </footer>
        </div>
    );
}
