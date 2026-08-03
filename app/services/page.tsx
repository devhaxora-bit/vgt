import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Box, Route, ShieldCheck, Truck } from 'lucide-react';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { PageHero } from '@/components/marketing/PageHero';

export const metadata: Metadata = { title: 'Services | Visakha Golden Transport', description: 'Road transport, trailer, container, closed-body, ODC and project cargo services across India.' };
const items = [
  { icon: Route, number: '01', title: 'Road Transportation', text: 'Comprehensive road transportation for safe and timely delivery of goods across India. Vehicle selection is tailored to the size and handling needs of the load.' },
  { icon: Box, number: '02', title: 'Trailer & Container Service', text: 'Secure movement using open or closed trailer options for containers and other cargo requirements.' },
  { icon: ShieldCheck, number: '03', title: 'Closed-Body Transportation', text: 'A protected transport option for sensitive or valuable goods that need shielding from weather and outside exposure.' },
  { icon: Truck, number: '04', title: 'ODC & Project Cargo', text: 'Specialised transportation for over-dimensional, oversized and heavy project loads that need careful planning and handling.' },
];
export default function ServicesPage(){return <MarketingShell>
  <PageHero eyebrow="Our services" title="Road transport for every kind of load." description="From regular goods movement to containers and over-dimensional project cargo, we match the requirement with a suitable transport option." image="/images/vgt-open-trailer-v2.png" />
  <section className="marketing-section bg-[#f4f7fb]"><div className="marketing-shell"><div className="max-w-3xl"><p className="marketing-eyebrow text-[#2759c7]">Core capabilities</p><h2 className="marketing-heading mt-4">Four services. One dependable transport partner.</h2></div><div className="mt-14 border-t border-[#cfdbe9]">{items.map(({icon:Icon,number,title,text})=><article key={title} className="group grid gap-6 border-b border-[#cfdbe9] py-9 md:grid-cols-[70px_1fr_1.35fr] md:items-center"><span className="text-sm font-bold text-[#285dcc]">{number}</span><div className="flex items-center gap-4"><span className="rounded-full bg-white p-3 text-[#285dcc]"><Icon size={24}/></span><h3 className="text-2xl font-bold tracking-tight text-[#09244b]">{title}</h3></div><p className="leading-7 text-[#58687d]">{text}</p></article>)}</div></div></section>
  <section className="marketing-section bg-white"><div className="marketing-shell grid gap-14 lg:grid-cols-[1.1fr_.9fr] lg:items-center"><div className="relative aspect-[16/10] overflow-hidden rounded-[2rem]"><Image src="/images/vgt-odc-v2.png" alt="Oversized project cargo transport" fill sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover"/></div><div><p className="marketing-eyebrow text-[#2759c7]">Special requirements</p><h2 className="marketing-heading mt-4">Have a challenging load?</h2><p className="mt-6 leading-8 text-[#52627a]">Share the cargo type, dimensions, origin and destination with our team. We can discuss the vehicle requirement and suitable transport approach.</p><Link href="/contact" className="marketing-button marketing-button-dark mt-8">Contact our team <ArrowRight size={17}/></Link></div></div></section>
 </MarketingShell>}
