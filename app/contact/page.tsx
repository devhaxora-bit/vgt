import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { PageHero } from '@/components/marketing/PageHero';

export const metadata: Metadata = { title: 'Contact | Visakha Golden Transport', description: 'Contact Visakha Golden Transport in Vizianagaram for road transport and cargo vehicle booking.' };
export default function ContactPage(){return <MarketingShell>
  <PageHero eyebrow="Contact VGT" title="Let’s plan your next movement." description="Tell us about the cargo and route. Call or email our Vizianagaram office to discuss the right transport option." image="/images/vgt-closed-body-v2.png" />
  <section className="marketing-section bg-white"><div className="marketing-shell grid gap-14 lg:grid-cols-[.8fr_1.2fr]">
    <div><p className="marketing-eyebrow text-[#2759c7]">Direct contact</p><h2 className="marketing-heading mt-4">Speak with our transport team.</h2><p className="mt-6 leading-8 text-[#52627a]">For a faster discussion, keep your pickup location, destination, cargo type and approximate load size ready.</p></div>
    <div className="border-t border-[#d5dfeb]">
      <a href="tel:+919392223404" className="contact-row"><span><Phone/></span><div><small>Phone</small><strong>93922 23404</strong></div></a>
      <a href="mailto:vsp@visakhagolden.com" className="contact-row"><span><Mail/></span><div><small>Email</small><strong>vsp@visakhagolden.com</strong></div></a>
      <a href="https://maps.google.com/?q=D.+No.+8-19-58%2FA,+Gopal+Nagar,+Vizianagaram,+Andhra+Pradesh+535003" target="_blank" rel="noreferrer" className="contact-row"><span><MapPin/></span><div><small>Office</small><strong>D. No. 8-19-58/A, Gopal Nagar,<br/>Near Bank Colony, Vizianagaram,<br/>Andhra Pradesh 535003</strong></div></a>
    </div>
  </div></section>
  <section className="bg-[#285dcc] py-14 text-white"><div className="marketing-shell"><p className="text-center text-lg font-semibold">Road transportation · Trailers · Containers · Closed-body vehicles · ODC & project cargo</p></div></section>
 </MarketingShell>}
