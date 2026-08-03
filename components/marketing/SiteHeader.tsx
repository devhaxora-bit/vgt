'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, Phone, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 40);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  return (
    <header className={`marketing-header ${scrolled || open ? 'is-scrolled' : ''}`}>
      <div className="marketing-shell">
        <div className="marketing-header-panel">
          <Link href="/" className="marketing-brand flex min-w-0 items-center gap-3" aria-label="Visakha Golden Transport home">
            <span className="marketing-logo-tile relative h-10 w-[76px] shrink-0 overflow-hidden">
              <Image
                src={scrolled || open ? '/images/vgt-logo-navy-transparent.png' : '/images/vgt-logo-white-transparent.png'}
                alt="VGT"
                fill
                sizes="76px"
                className="object-contain"
                priority
              />
            </span>
            <span className="marketing-brand-name">
              Visakha Golden<br />Transport
            </span>
          </Link>

          <nav className="marketing-desktop-nav hidden items-center lg:flex" aria-label="Main navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={`marketing-nav-link ${pathname === link.href ? 'is-active' : ''}`}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/login" className="marketing-login-link">Staff Login</Link>
            <a href="tel:+919392223404" className="marketing-header-cta">
              <Phone size={15} /> 93922 23404
            </a>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <a href="tel:+919392223404" className="marketing-header-action" aria-label="Call Visakha Golden Transport"><Phone size={16} /></a>
            <button className="marketing-icon-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle menu">
              {open ? <X size={18} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="marketing-mobile-menu lg:hidden">
            <nav className="flex flex-col" aria-label="Mobile navigation">
              {links.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={`marketing-mobile-link ${pathname === link.href ? 'is-active' : ''}`}>
                  <span>{link.label}</span><span>↗</span>
                </Link>
              ))}
              <Link href="/login" onClick={() => setOpen(false)} className="marketing-mobile-login">Staff Login</Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
