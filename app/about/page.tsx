import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { PageHero } from '@/components/marketing/PageHero';

export const metadata: Metadata = { title: 'About | Visakha Golden Transport', description: 'Learn about Visakha Golden Transport and our road transport services across India.' };

export default function AboutPage() {
  return <MarketingShell>
    <PageHero eyebrow="About VGT" title="Transport planned around the load." description="We help businesses book suitable vehicles for regular goods, containers, protected loads and specialised project cargo across India." image="/images/vgt-fleet-yard-v2.png" />
    <section className="marketing-section bg-white"><div className="marketing-shell grid gap-14 lg:grid-cols-2 lg:items-center">
      <div><p className="marketing-eyebrow text-[#2759c7]">Our company</p><h2 className="marketing-heading mt-4">One partner for a wide range of road transport needs.</h2><p className="mt-6 leading-8 text-[#52627a]">Visakha Golden Transport offers goods booking services across India, with vehicle options for different load sizes and cargo requirements. From smaller vehicles to larger trailers, the aim is to make transportation straightforward and dependable.</p><p className="mt-4 leading-8 text-[#52627a]">For container movement, we provide open and closed trailer options. For oversized and heavy loads, our ODC transport service supports specialised requirements with careful handling.</p></div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem]"><Image src="/images/vgt-open-trailer-v2.png" alt="Open trailer carrying secured industrial cargo" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /></div>
    </div></section>
    <section className="marketing-section bg-[#f4f7fb]"><div className="marketing-shell"><div className="max-w-3xl"><p className="marketing-eyebrow text-[#2759c7]">How we work</p><h2 className="marketing-heading mt-4">Clear requirements. Suitable transport. Careful movement.</h2></div><div className="mt-14 grid gap-px overflow-hidden rounded-[2rem] bg-[#d6e0ed] md:grid-cols-3">{[['01','Understand the load','We begin with the cargo type, size and transport requirement.'],['02','Match the vehicle','A suitable small vehicle, truck, trailer or specialised option is selected.'],['03','Plan the movement','The shipment is handled with attention to safe and efficient delivery.']].map(([n,t,d])=><div key={n} className="bg-white p-8 lg:p-10"><span className="text-sm font-bold text-[#285dcc]">{n}</span><h3 className="mt-12 text-2xl font-bold text-[#09244b]">{t}</h3><p className="mt-3 leading-7 text-[#5a687c]">{d}</p></div>)}</div></div></section>
    <section className="marketing-section bg-[#061a37] text-white"><div className="marketing-shell grid gap-12 lg:grid-cols-2"><div><p className="marketing-eyebrow text-[#8eb4ff]">Our focus</p><h2 className="marketing-heading marketing-heading-light mt-4">Safe, smooth and efficient journeys.</h2></div><div className="grid gap-5">{['Vehicle options for different load requirements','Open and closed trailer transportation','Container, closed-body and ODC capabilities','Road transportation services across India'].map(x=><div key={x} className="flex items-center gap-4 border-b border-white/12 pb-5 text-white/80"><CheckCircle2 className="text-[#7ea8ff]" size={21}/>{x}</div>)}<Link href="/contact" className="marketing-button marketing-button-light mt-4 w-fit">Talk to VGT <ArrowRight size={17}/></Link></div></div></section>
  </MarketingShell>;
}
