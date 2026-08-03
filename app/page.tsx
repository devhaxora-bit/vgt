import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Phone } from 'lucide-react';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = { title: 'Visakha Golden Transport | Road Transport Across India', description: 'Vehicle booking, container, closed-body, ODC and project cargo transportation across India.' };

const services = [
  { image: '/images/vgt-open-trailer-v2.png', title: 'Road Transportation', text: 'Planned India-wide movement for regular goods and industrial cargo.' },
  { image: '/images/vgt-container-v2.png', title: 'Trailer & Container', text: 'Open and closed trailer options for secure container movement.' },
  { image: '/images/vgt-closed-body-v2.png', title: 'Closed-Body Transport', text: 'Weather-protected movement for sensitive and valuable goods.' },
  { image: '/images/vgt-odc-v2.png', title: 'ODC & Project Cargo', text: 'Specialised planning for oversized and heavy project loads.' },
];

export default function Home() {
  return (
    <MarketingShell>
      <section className="marketing-hero">
        <Image src="/images/vgt-hero-v2.png" alt="Container truck travelling on an Indian highway" fill priority sizes="100vw" className="marketing-hero-image object-cover object-center" />
        <div className="marketing-hero-shade absolute inset-0" />
        <div className="marketing-hero-inner marketing-shell relative flex min-h-[100svh] items-start justify-center pt-[clamp(150px,17vh,200px)] pb-24 text-center text-white">
          <div className="marketing-hero-copy max-w-5xl">
            <p className="marketing-hero-label">India-wide road transport</p>
            <h1 className="marketing-hero-title">The right vehicle.<br /><span>For every load.</span></h1>
            <p className="marketing-hero-summary mx-auto">Goods, containers, closed-body transport and ODC cargo—planned from Vizianagaram and moved across India.</p>
            <div className="marketing-hero-actions">
              <a href="tel:+919392223404" className="marketing-button marketing-button-light marketing-hero-call"><Phone size={16} /> Call 93922 23404</a>
              <Link href="/services" className="marketing-hero-link">View our services <ArrowRight size={17} /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-scroll-reveal bg-[#f3f0ea]">
        <div className="marketing-shell grid gap-12 lg:grid-cols-[.72fr_1.45fr] lg:items-start lg:gap-16">
          <div className="lg:sticky lg:top-32">
            <p className="marketing-eyebrow text-[#a95832]">Our services</p>
            <h2 className="marketing-heading mt-4">Transport built around the cargo.</h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#68635d]">From a small commercial vehicle to a heavy trailer, we choose the transport around the load’s size, protection and handling needs.</p>
            <Link href="/services" className="marketing-button marketing-button-dark mt-8">Explore services <ArrowRight size={17} /></Link>
          </div>
          <div className="marketing-services-gallery grid gap-4 md:grid-cols-2">
            {services.map(({ image, title, text }, index) => <article key={title} className="marketing-service-card group"><Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 35vw" className="object-cover" /><div className="marketing-service-card-copy"><span className="text-xs font-bold text-white/65">0{index + 1}</span><h3 className="mt-3 text-2xl font-bold">{title}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-white/75">{text}</p><span className="mt-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/35 transition-transform group-hover:translate-x-1"><ArrowRight size={15}/></span></div></article>)}
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-scroll-reveal bg-white">
        <div className="marketing-shell grid gap-14 lg:grid-cols-2 lg:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem]"><Image src="/images/vgt-fleet-yard-v2.png" alt="Transport vehicles being prepared at an Indian logistics yard" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover transition-transform duration-700 hover:scale-[1.03]" /></div>
          <div className="max-w-xl"><p className="marketing-eyebrow text-[#a95832]">About VGT</p><h2 className="marketing-heading mt-4">A transport partner built around your cargo.</h2><p className="mt-6 text-base leading-8 text-[#5f5b55]">Visakha Golden Transport provides goods booking and road transportation across India. Our vehicle options support regular goods movement, open and closed trailers, containers and specialised ODC loads.</p><p className="mt-4 text-base leading-8 text-[#5f5b55]">Every requirement is different, so the focus stays simple: match the load with the right transport option and move it safely and efficiently.</p><Link href="/about" className="marketing-button marketing-button-dark mt-8">Know our approach <ArrowRight size={17} /></Link></div>
        </div>
      </section>

      <section className="marketing-section marketing-scroll-reveal bg-[#1a1c20] text-white">
        <div className="marketing-shell grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div><p className="marketing-eyebrow text-[#d58a5e]">Specialised movement</p><h2 className="marketing-heading marketing-heading-light mt-4">When the load is complex, planning matters.</h2><p className="mt-6 max-w-xl leading-7 text-white/65">Our ODC and project cargo service is intended for oversized and heavy loads that need careful vehicle selection and experienced handling.</p><Link href="/contact" className="marketing-button marketing-button-light mt-8">Discuss your requirement <ArrowRight size={17} /></Link></div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem]"><Image src="/images/vgt-odc-v2.png" alt="ODC project cargo transportation" fill sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" /></div>
        </div>
      </section>

      <section className="marketing-ready marketing-scroll-reveal">
        <div className="marketing-ready-inner marketing-shell">
          <div className="marketing-ready-copy">
            <p className="marketing-eyebrow text-[#a95832]">Ready to move?</p>
            <h2 className="marketing-ready-title">Let’s find the right vehicle.</h2>
            <p className="marketing-ready-summary">Share the cargo, pickup and destination. Our team will help discuss a suitable transport option.</p>
            <div className="marketing-ready-actions">
              <a href="tel:+919392223404" className="marketing-button marketing-button-dark"><Phone size={16} /> Call 93922 23404</a>
              <Link href="/contact" className="marketing-text-link">Contact VGT <ArrowRight size={16}/></Link>
            </div>
          </div>
          <div className="marketing-ready-media" aria-hidden="true">
            <div className="marketing-ready-image marketing-ready-image-main"><Image src="/images/vgt-open-trailer-v2.png" alt="" fill sizes="(max-width: 1024px) 70vw, 34vw" className="object-cover" /></div>
            <div className="marketing-ready-image marketing-ready-image-top"><Image src="/images/vgt-closed-body-v2.png" alt="" fill sizes="180px" className="object-cover" /></div>
            <div className="marketing-ready-image marketing-ready-image-bottom"><Image src="/images/vgt-container-v2.png" alt="" fill sizes="200px" className="object-cover" /></div>
            <span className="marketing-ready-shape marketing-ready-shape-top" />
            <span className="marketing-ready-shape marketing-ready-shape-bottom" />
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
