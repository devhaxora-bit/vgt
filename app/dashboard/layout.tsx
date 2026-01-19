import React from 'react';
import DashboardNav from '@/components/layouts/DashboardNav';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Navigation Bar */}
            <DashboardNav />
            {/* Main Content */}
            <main className="flex-1 w-full bg-[#f8f9fa] border-t border-gray-200 shadow-inner">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t py-2 shadow-sm mt-auto z-10 relative">
                <div className="max-w-7xl mx-auto px-4 flex justify-center items-center text-xs text-gray-500 font-medium">
                    <div className="flex gap-4">
                        <span className="text-red-700 font-bold">VGT</span>
                        <span>© 2026 - Calyx Container Terminals Pvt. Ltd.</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
