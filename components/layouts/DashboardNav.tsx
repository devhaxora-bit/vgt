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
    MapPin,
    ChevronDown,
    X
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                    // Fallback to auth data if profile is missing
                    setUser({
                        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Unknown User',
                        employee_code: 'UNC-000',
                        role: 'admin' // Default to admin so they can fix their profile
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
                        { title: 'Challan Entry', href: '/dashboard/challans' },
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
                        { title: 'User Management', href: '/dashboard/admin/users' },
                        { title: 'Branch Management', href: '/dashboard/admin/branches' },
                        { title: 'Party Management', href: '/dashboard/admin/parties' },
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

    const filteredNavItems = navItems.filter(item => {
        if (item.title === 'Admin') {
            return user?.role?.toLowerCase() === 'admin';
        }
        return true;
    });

    if (!mounted) return null;

    return (
        <div className="flex flex-col w-full z-50 sticky top-0 backdrop-blur-md bg-background/80 border-b">
            {/* Main Navigation Bar */}
            <div className="flex items-center justify-between px-4 md:px-6 h-14 md:h-16 w-full max-w-[1920px] mx-auto">
                {/* Logo Area */}
                <Link href="/dashboard" className="flex items-center gap-2 md:gap-3">
                    <div className="h-8 w-8 md:h-9 md:w-9 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                        <Truck className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
                    </div>
                    <span className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                        VGT
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <NavigationMenu className="hidden md:flex">
                    <NavigationMenuList className="gap-1">
                        {filteredNavItems.map((item) => (
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
                                                                <Link
                                                                    href={subItem.href}
                                                                    className="block select-none space-y-1 rounded-md p-2 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-sm text-muted-foreground hover:translate-x-1 duration-200"
                                                                >
                                                                    {subItem.title}
                                                                </Link>
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
                <div className="flex items-center gap-2 md:gap-4">
                    {/* Mobile Menu */}
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
                            <SheetHeader className="p-4 border-b">
                                <SheetTitle className="flex items-center gap-2">
                                    <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                                        <Truck className="h-4 w-4 text-primary-foreground" />
                                    </div>
                                    VGT Menu
                                </SheetTitle>
                            </SheetHeader>
                            <div className="flex flex-col h-[calc(100vh-80px)] overflow-y-auto">
                                <div className="flex-1 py-2">
                                    {filteredNavItems.map((item) => (
                                        <Collapsible key={item.title} className="border-b">
                                            <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <item.icon className="h-4 w-4 text-muted-foreground" />
                                                    {item.title}
                                                </div>
                                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <div className="bg-muted/50 py-2">
                                                    {item.content.map((section) => (
                                                        <div key={section.title} className="px-4 py-2">
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                                                {section.title}
                                                            </p>
                                                            {section.items.map((subItem) => (
                                                                <Link
                                                                    key={subItem.title}
                                                                    href={subItem.href}
                                                                    onClick={() => setMobileMenuOpen(false)}
                                                                    className="block py-2 px-3 text-sm text-foreground hover:bg-background rounded-md transition-colors"
                                                                >
                                                                    {subItem.title}
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ))}
                                </div>

                                {/* User Info in Mobile */}
                                <div className="border-t p-4 bg-muted/30">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarFallback className="bg-primary text-primary-foreground">
                                                {user?.full_name?.charAt(0) || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium">{user?.full_name}</p>
                                            <p className="text-xs text-muted-foreground">{user?.employee_code} • {user?.role}</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="h-4 w-4 mr-2" />
                                        Logout
                                    </Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>

                    <Button variant="ghost" size="icon" onClick={handleLogout} className="hidden md:flex text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Info Bar - Secondary Navigation */}
            <div className="bg-muted/50 border-t border-b px-4 md:px-6 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <div className="max-w-[1920px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className="flex items-center gap-2 text-primary">
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Welcome to VGT</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" />
                            <span>{user?.role}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-6">
                        <div className="hidden sm:flex items-center gap-2">
                            <Avatar className="h-5 w-5 border border-border">
                                <AvatarImage src="" />
                                <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                                    {user?.full_name?.charAt(0) || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <span className="hidden lg:inline">{user?.employee_code} - {user?.full_name}</span>
                            <span className="lg:hidden">{user?.employee_code}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>MRG</span>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 bg-background px-2 py-0.5 rounded-full border shadow-sm text-foreground">
                            <Clock className="h-3 w-3 text-primary" />
                            <span className="text-[10px] md:text-xs">{currentTime}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
