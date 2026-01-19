'use client';

import React from 'react';
import { Truck, Package, MapPin, Clock } from 'lucide-react';

interface AuthLayoutProps {
    children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="flex min-h-screen flex-col lg:flex-row bg-white">
            {/* Left side: Modern Clean Hero with Coral Gradient */}
            <div className="relative hidden w-full lg:flex lg:w-1/2 gradient-primary animate-gradient overflow-hidden">
                {/* Subtle floating shapes */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float" />
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
                    <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-white/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '4s' }} />
                </div>

                {/* Content */}
                <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-12 text-white">
                    <div className="max-w-lg space-y-8 animate-fadeIn">
                        {/* Logo/Brand */}
                        <div className="space-y-4">
                            <h1 className="text-6xl font-bold tracking-tight">
                                VGT
                            </h1>
                            <p className="text-xl text-white/95 font-medium">
                                Transport Management System
                            </p>
                            <div className="h-1 w-24 bg-white/40 rounded-full" />
                        </div>

                        {/* Features */}
                        <div className="space-y-6 pt-8">
                            <div className="flex items-start space-x-4 animate-slideUp" style={{ animationDelay: '0.2s' }}>
                                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm border border-white/30">
                                    <Truck className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">Fleet Management</h3>
                                    <p className="text-white/95 text-sm">Track and manage your entire fleet in real-time</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4 animate-slideUp" style={{ animationDelay: '0.4s' }}>
                                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm border border-white/30">
                                    <Package className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">Shipment Tracking</h3>
                                    <p className="text-white/95 text-sm">Monitor deliveries from pickup to destination</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4 animate-slideUp" style={{ animationDelay: '0.6s' }}>
                                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm border border-white/30">
                                    <MapPin className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">Route Optimization</h3>
                                    <p className="text-white/95 text-sm">Smart routing for efficient deliveries</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4 animate-slideUp" style={{ animationDelay: '0.8s' }}>
                                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm border border-white/30">
                                    <Clock className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">24/7 Operations</h3>
                                    <p className="text-white/95 text-sm">Round-the-clock monitoring and support</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom decoration */}
                <div className="absolute bottom-12 left-0 right-0 z-20 flex justify-center">
                    <div className="flex space-x-2">
                        <div className="h-2 w-2 rounded-full bg-white/40" />
                        <div className="h-2 w-8 rounded-full bg-white/60" />
                        <div className="h-2 w-2 rounded-full bg-white/40" />
                    </div>
                </div>
            </div>

            {/* Right side: Clean Light Form */}
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16 bg-[#F2F4F7]">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden mb-8 text-center animate-fadeIn">
                        <h1 className="text-4xl font-bold text-[#FF6154]">
                            VGT
                        </h1>
                        <p className="text-sm text-[#475467] mt-2">Transport Management System</p>
                    </div>

                    {/* Form Card - Clean White */}
                    <div className="glass-dark rounded-2xl p-8 animate-slideUp">
                        {children}
                    </div>

                    {/* Footer */}
                    <p className="mt-8 text-center text-sm text-[#475467] animate-fadeIn" style={{ animationDelay: '0.4s' }}>
                        © 2024 VGT Transport. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
}
