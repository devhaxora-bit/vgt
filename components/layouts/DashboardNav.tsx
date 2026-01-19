'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
    LogOut,
    LayoutDashboard,
    Users,
    Settings,
    Truck,
    FileText,
    CreditCard,
    BarChart3,
    HelpCircle,
    Menu,
    Clock,
    MapPin
} from 'lucide-react';

import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface User {
    full_name: string;
    employee_code: string;
    role: string;
}

export default function DashboardNav() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [currentTime, setCurrentTime] = useState<string>('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);

        // Fetch user
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('full_name, employee_code, role')
                    .eq('id', authUser.id)
                    .single();

                if (profile) {
                    setUser(profile);
                } else {
                    setUser({
                        full_name: 'Amit Pandey',
                        employee_code: 'A8644',
                        role: 'Admin'
                    });
                }
            }
        };

        fetchUser();

        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace('/login');
        router.refresh();
    };

    const navItems = [
        {
            title: 'Operation',
            icon: Truck,
            content: [
                {
                    title: 'Booking',
                    items: [
                        { title: 'CNS Entry', href: '/dashboard/consignments' },
                        { title: 'Local Booking', href: '#' },
                        { title: 'Import Booking', href: '#' },
                        { title: 'Export Booking', href: '#' },
                    ]
                },
                {
                    title: 'Dispatch',
                    items: [
                        { title: 'Manifest Generation', href: '#' },
                        { title: 'Vehicle Placement', href: '#' },
                        { title: 'Trip Sheet', href: '#' },
                    ]
                },
                {
                    title: 'Tracking',
                    items: [
                        { title: 'Live Tracking', href: '#' },
                        { title: 'Delivery Status', href: '#' },
                        { title: 'POD Upload', href: '#' },
                    ]
                }
            ]
        },
        {
            title: 'Finance & Accounts',
            icon: CreditCard,
            content: [
                {
                    title: 'Accounts',
                    items: [
                        { title: 'Invoicing', href: '#' },
                        { title: 'Payment Entry', href: '#' },
                        { title: 'Ledger View', href: '#' },
                    ]
                },
                {
                    title: 'Expenses',
                    items: [
                        { title: 'Petty Cash', href: '#' },
                        { title: 'Voucher Entry', href: '#' },
                        { title: 'Driver Settlements', href: '#' },
                    ]
                }
            ]
        },
        {
            title: 'Reports',
            icon: BarChart3,
            content: [
                {
                    title: 'Analytics',
                    items: [
                        { title: 'Daily Sales', href: '#' },
                        { title: 'Vehicle Utilization', href: '#' },
                        { title: 'Revenue Report', href: '#' },
                    ]
                }
            ]
        },
        {
            title: 'Admin',
            icon: Settings,
            content: [
                {
                    title: 'System',
                    items: [
                        { title: 'User Management', href: '#' },
                        { title: 'Role Configuration', href: '#' },
                        { title: 'Audit Logs', href: '#' },
                    ]
                }
            ]
        },
        {
            title: 'More',
            icon: HelpCircle,
            content: [
                {
                    title: 'Support',
                    items: [
                        { title: 'Documentation', href: '#' },
                        { title: 'Help Center', href: '#' },
                    ]
                }
            ]
        },
    ];

    if (!mounted) return null;

    return (
        <div className="flex flex-col w-full z-50 sticky top-0 backdrop-blur-md bg-background/80 border-b">
            {/* Main Navigation Bar */}
            <div className="flex items-center justify-between px-6 h-16 w-full max-w-[1920px] mx-auto">
                {/* Logo Area */}
                <Link href="/dashboard" className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                        <Truck className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 hidden md:block">
                        VGT
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <NavigationMenu className="hidden md:flex">
                    <NavigationMenuList className="gap-1">
                        {navItems.map((item) => (
                            <NavigationMenuItem key={item.title}>
                                <NavigationMenuTrigger className="bg-transparent hover:bg-muted data-[state=open]:bg-muted text-muted-foreground hover:text-foreground">
                                    {item.title}
                                </NavigationMenuTrigger>
                                <NavigationMenuContent>
                                    <div className="grid w-[600px] gap-3 p-4 md:w-[600px] md:grid-cols-2 lg:w-[700px] lg:grid-cols-3 bg-popover/50 backdrop-blur-xl">
                                        {item.content.map((section) => (
                                            <div key={section.title} className="space-y-3">
                                                <h4 className="font-semibold text-sm leading-none text-foreground flex items-center gap-2">
                                                    <div className="h-1 w-1 rounded-full bg-primary" />
                                                    {section.title}
                                                </h4>
                                                <ul className="grid gap-1">
                                                    {section.items.map((subItem) => (
                                                        <li key={subItem.title}>
                                                            <NavigationMenuLink asChild>
                                                                <a
                                                                    href={subItem.href}
                                                                    className="block select-none space-y-1 rounded-md p-2 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-sm text-muted-foreground hover:translate-x-1 duration-200"
                                                                >
                                                                    {subItem.title}
                                                                </a>
                                                            </NavigationMenuLink>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </NavigationMenuContent>
                            </NavigationMenuItem>
                        ))}
                    </NavigationMenuList>
                </NavigationMenu>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Trigger could go here */}
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Info Bar - Secondary Navigation */}
            <div className="bg-muted/50 border-t border-b px-6 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <div className="max-w-[1920px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-primary">
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            <span>Welcome to VGT</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" />
                            <span>{user?.role}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5 border border-border">
                                <AvatarImage src="" />
                                <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                                    {user?.full_name?.charAt(0) || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <span>{user?.employee_code} - {user?.full_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>MRG</span>
                        </div>
                        <div className="flex items-center gap-2 bg-background px-2 py-0.5 rounded-full border shadow-sm text-foreground">
                            <Clock className="h-3 w-3 text-primary" />
                            <span>{currentTime}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
