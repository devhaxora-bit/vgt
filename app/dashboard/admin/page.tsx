'use client';

import React from 'react';
import Link from 'next/link';
import { Users, MapPin, Activity, Shield, Plus, ArrowRight, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDashboardPage() {
    // These would eventually come from an API
    const stats = [
        {
            title: 'Total Users',
            value: '12',
            change: '+2 this week',
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
        },
        {
            title: 'Active Branches',
            value: '8',
            change: 'All operational',
            icon: MapPin,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
        },
        {
            title: 'System Health',
            value: '99.9%',
            change: 'Normal load',
            icon: Activity,
            color: 'text-green-600',
            bg: 'bg-green-50',
        },
        {
            title: 'Active Sessions',
            value: '5',
            change: 'Currently online',
            icon: Shield,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
        },
    ];

    const quickActions = [
        {
            title: 'Manage Users',
            description: 'Add new employees, reset passwords, or update roles.',
            icon: Users,
            href: '/dashboard/admin/users',
            action: 'Add User',
        },
        {
            title: 'Manage Branches',
            description: 'Configure branch locations, codes, and contact details.',
            icon: MapPin,
            href: '/dashboard/admin/branches',
            action: 'Add Branch',
        },
        {
            title: 'Manage Parties',
            description: 'Add and manage consignors, consignees, and billing parties.',
            icon: Building,
            href: '/dashboard/admin/parties',
            action: 'Add Party',
        },
    ];

    return (
        <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <Card key={stat.title} className="border-none shadow-sm bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.title}
                            </CardTitle>
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color}`}>
                                <stat.icon className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stat.change}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#101828]">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {quickActions.map((action) => (
                        <div
                            key={action.title}
                            className="flex items-start p-6 bg-white border rounded-xl hover:shadow-md transition-all group"
                        >
                            <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary mt-1">
                                <action.icon className="h-5 w-5" />
                            </div>
                            <div className="ml-4 flex-1">
                                <h4 className="text-base font-semibold text-[#101828] group-hover:text-primary transition-colors">
                                    {action.title}
                                </h4>
                                <p className="text-sm text-muted-foreground mt-1 mb-4">
                                    {action.description}
                                </p>
                                <div className="flex gap-3">
                                    <Link href={action.href}>
                                        <Button variant="outline" size="sm" className="gap-2">
                                            View List
                                        </Button>
                                    </Link>
                                    <Link href={action.href}>
                                        <Button size="sm" className="gap-2">
                                            <Plus className="h-3.5 w-3.5" />
                                            {action.action}
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                            <div className="self-center">
                                <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-primary transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
