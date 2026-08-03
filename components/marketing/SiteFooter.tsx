import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function SiteFooter() {
  return (
    <footer className="marketing-footer text-white">
      <div className="marketing-shell py-16 lg:py-20">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="marketing-eyebrow text-[#d58a5e]">Have a load to move?</p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-[-.04em] sm:text-5xl">Let&apos;s find the right vehicle.</h2>
          </div>
          <Button asChild size="lg" className="h-12 w-fit rounded-full bg-[#f1eee8] px-6 text-[#1a1c20] hover:bg-white">
            <a href="tel:+919392223404"><Phone /> Call 93922 23404</a>
          </Button>
        </div>

        <Separator className="my-12 bg-white/12" />

        <div className="grid gap-12 md:grid-cols-[1.15fr_.65fr_1fr]">
          <div>
            <Image src="/images/vgt-logo-white-transparent.png" alt="VGT" width={132} height={62} className="h-12 w-auto object-contain" />
            <h3 className="mt-5 text-xl font-semibold">Visakha Golden Transport</h3>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/58">Road transport and vehicle booking for goods, containers, closed-body loads, ODC and project cargo across India.</p>
          </div>
          <nav aria-label="Footer navigation">
            <p className="marketing-eyebrow text-white/40">Explore</p>
            <div className="mt-5 grid gap-3 text-sm text-white/68">
              {[['/','Home'],['/about','About'],['/services','Services'],['/contact','Contact'],['/login','Staff Login']].map(([href,label]) => (
                <Link key={href} href={href} className="footer-link">{label}<ArrowUpRight size={13} /></Link>
              ))}
            </div>
          </nav>
          <div>
            <p className="marketing-eyebrow text-white/40">Vizianagaram office</p>
            <div className="mt-5 grid gap-4 text-sm leading-6 text-white/68">
              <a href="mailto:vsp@visakhagolden.com" className="footer-contact"><Mail size={16} /> vsp@visakhagolden.com</a>
              <a href="https://maps.google.com/?q=D.+No.+8-19-58%2FA,+Gopal+Nagar,+Vizianagaram,+Andhra+Pradesh+535003" target="_blank" rel="noreferrer" className="footer-contact items-start"><MapPin className="mt-1" size={16} /> <span>D. No. 8-19-58/A, Gopal Nagar,<br />Near Bank Colony, Vizianagaram,<br />Andhra Pradesh 535003</span></a>
            </div>
          </div>
        </div>

        <Separator className="my-8 bg-white/12" />
        <div className="flex flex-col gap-2 text-xs text-white/38 sm:flex-row sm:justify-between"><p>© {new Date().getFullYear()} Visakha Golden Transport.</p><p>Road transport across India.</p></div>
      </div>
    </footer>
  );
}
