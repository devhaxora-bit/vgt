'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Box, ShieldCheck, Truck } from 'lucide-react';

interface AuthLayoutProps {
    children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="flex min-h-screen flex-col bg-white lg:flex-row">
            <div className="relative hidden w-full overflow-hidden bg-[#061a37] lg:flex lg:w-[52%]">
                <Image src="/images/vgt-hero-v2.png" alt="VGT road transport" fill priority sizes="52vw" className="object-cover object-[60%_center]" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,20,45,.93),rgba(4,20,45,.58))]" />
                <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 xl:p-16 text-white">
                    <Link href="/" className="flex w-fit items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white"><ArrowLeft size={17}/> Back to website</Link>
                    <div className="max-w-xl animate-fadeIn">
                        <div className="inline-flex rounded-xl bg-white p-3"><Image src="/images/vgt_logo.jpeg" alt="VGT" width={120} height={56} className="h-11 w-auto object-contain" /></div>
                        <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#98baff]">Transport Management System</p>
                        <h1 className="mt-5 text-5xl font-black leading-[.95] tracking-[-.045em] xl:text-6xl">One workspace.<br/>Every movement.</h1>
                        <div className="mt-10 grid gap-4 sm:grid-cols-3">
                            {[[Truck,'Road transport'],[Box,'Containers'],[ShieldCheck,'ODC cargo']].map(([Icon,label])=>{const I=Icon as typeof Truck; return <div key={label as string} className="border-t border-white/25 pt-4"><I size={21} className="text-[#8eb4ff]"/><p className="mt-3 text-sm font-semibold">{label as string}</p></div>})}
                        </div>
                    </div>
                    <p className="text-xs text-white/45">Visakha Golden Transport · Vizianagaram</p>
                </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center bg-[#f3f6fa] px-6 py-12 lg:px-16">
                <div className="w-full max-w-md">
                    <div className="lg:hidden mb-8 text-center animate-fadeIn">
                        <Link href="/" className="inline-flex rounded-xl bg-white p-3"><Image src="/images/vgt_logo.jpeg" alt="VGT" width={110} height={50} className="h-10 w-auto object-contain" /></Link>
                        <p className="text-sm text-[#475467] mt-2">Transport Management System</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-[#dfe6ef] bg-white p-8 shadow-[0_20px_60px_rgba(9,36,75,.08)] animate-slideUp">
                        {children}
                    </div>
                    <p className="mt-8 text-center text-sm text-[#475467] animate-fadeIn" style={{ animationDelay: '0.4s' }}>
                        © {new Date().getFullYear()} Visakha Golden Transport
                    </p>
                </div>
            </div>
        </div>
    );
}
