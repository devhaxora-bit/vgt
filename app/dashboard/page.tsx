import React from 'react';
import { Truck, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
    const stats = [
        { title: "Total Bookings", value: "1,284", icon: Truck, trend: "+12.5%", desc: "vs last month" },
        { title: "Active Drivers", value: "342", icon: Users, trend: "+4.2%", desc: "currently online" },
        { title: "Revenue", value: "₹24.5L", icon: DollarSign, trend: "+8.1%", desc: "this month" },
    ];

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-[1920px] mx-auto animate-fadeIn">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Cockpit</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        Overview of your transport operations
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">Download Report</Button>
                    <Button>New Booking</Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <Card key={i} className="hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.title}
                            </CardTitle>
                            <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <stat.icon className="h-4 w-4 text-primary" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <span className="text-emerald-600 font-medium flex items-center">
                                    <TrendingUp className="h-3 w-3 mr-1" /> {stat.trend}
                                </span>
                                {stat.desc}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Motivational Quote - Styled as a Featured Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20 overflow-hidden relative">
                <div className="absolute top-0 right-0 h-64 w-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <CardContent className="p-8 relative z-10">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="space-y-4 flex-1">
                            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                Daily Inspiration
                            </div>
                            <h3 className="text-2xl font-semibold leading-relaxed text-foreground">
                                "How you begin your day can make your day, or break your day. Your attitude and your actions have a strong effect on your whole day."
                            </h3>
                            <div className="space-y-2 text-muted-foreground">
                                <p className="italic">
                                    आप अपना दिन कैसे शुरू करते हैं, यह आपका दिन बना सकता है...
                                </p>
                            </div>
                        </div>
                        <div className="hidden md:flex h-32 w-32 bg-background rounded-full items-center justify-center border-4 border-dashed border-primary/20 shadow-inner rotate-12">
                            <Activity className="h-12 w-12 text-primary/40" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-[400px]">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest vehicle movements and updates</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed border-muted rounded-lg m-4">
                            Chart Placeholder
                        </div>
                    </CardContent>
                </Card>
                <Card className="h-[400px]">
                    <CardHeader>
                        <CardTitle>Financial Overview</CardTitle>
                        <CardDescription>Revenue vs Expenses analysis</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed border-muted rounded-lg m-4">
                            Chart Placeholder
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
