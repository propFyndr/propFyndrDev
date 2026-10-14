'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { List, X, ArrowLeft } from '@phosphor-icons/react';

// Shared by the landing page, /auth and /how-it-works so the marketing
// surfaces stay one design: same photo, same washes, same header.

export function SiteBackdrop() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
      <Image
        src="/images/backgrounds/landing-bg.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-[70%_center] lg:object-center"
        priority
      />
      {/* Dark mode dims the daylight photo rather than swapping it */}
      <div className="absolute inset-0 bg-transparent dark:bg-zinc-950/70" />
      <div className="absolute inset-y-0 left-0 w-full lg:w-[62%] bg-gradient-to-r from-white/85 via-white/55 to-transparent dark:from-zinc-950/90 dark:via-zinc-950/60" />
      <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-white via-white/80 to-transparent dark:from-zinc-950 dark:via-zinc-950/80" />
    </div>
  );
}

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/builder-register', label: 'For Builders' },
  { href: '/blog', label: 'Blog' },
];

const navLink =
  'text-[14px] font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50';

const pill =
  'min-h-[40px] inline-flex items-center gap-1.5 px-5 text-[13.5px] font-medium text-zinc-800 hover:text-zinc-950 bg-white/70 hover:bg-white border border-zinc-300/80 dark:text-zinc-100 dark:hover:text-white dark:bg-white/10 dark:hover:bg-white/15 dark:border-white/15 rounded-full shadow-sm backdrop-blur-md transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50';

/** `variant="back"` swaps the nav for a single "Back to home" pill (auth). */
export function SiteHeader({ variant = 'nav' }: { variant?: 'nav' | 'back' }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile sheet on route change and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="relative z-40 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-4 sm:pt-5 flex items-center justify-between shrink-0">
      <Link
        href="/"
        className="relative z-50 flex items-center gap-2 group shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
      >
        <Image
          src="/images/icons/apple-icon.png"
          alt=""
          width={44}
          height={44}
          className="w-10 h-10 sm:w-11 sm:h-11 -mx-1 object-contain group-hover:scale-105 transition-transform duration-300"
          priority
        />
        <span className="text-[22px] sm:text-[24px] font-bold tracking-[-0.03em] text-zinc-900 dark:text-white">
          Realty<span className="text-[#1D63ED] dark:text-[#6B9BFF]">Ask</span>
        </span>
      </Link>

      {variant === 'back' ? (
        <Link href="/" className={`group ${pill} px-4`}>
          <ArrowLeft size={14} weight="bold" className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to home</span>
        </Link>
      ) : (
        <>
          <nav className="hidden md:flex items-center gap-8" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={pathname === n.href ? 'page' : undefined}
                className={`${navLink} ${pathname === n.href ? 'text-zinc-950 dark:text-white' : ''}`}
              >
                {n.label}
              </Link>
            ))}
            <Link href="/auth" className={pill}>Sign In</Link>
          </nav>

          {/* Mobile: Sign In stays visible, the rest lives in the menu */}
          <div className="relative z-50 flex md:hidden items-center gap-2">
            <Link href="/auth" className={pill}>Sign In</Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/70 dark:bg-white/10 border border-zinc-300/80 dark:border-white/15 text-zinc-800 dark:text-zinc-100 backdrop-blur-md active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
            >
              {open ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
            </button>
          </div>

          {open && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-40 md:hidden bg-zinc-950/20 dark:bg-black/50 backdrop-blur-[2px] cursor-default"
              />
              <nav
                id="mobile-menu"
                aria-label="Main"
                style={{ animation: 'fade-in-up 0.25s cubic-bezier(0.22, 1, 0.36, 1) both' }}
                className="md:hidden absolute z-50 top-[calc(100%+8px)] inset-x-4 sm:inset-x-8 p-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 rounded-2xl shadow-[0_24px_60px_-16px_rgba(15,23,42,0.35)]"
              >
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="flex items-center min-h-[48px] px-4 rounded-xl text-[15px] font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-white/5"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </>
      )}
    </header>
  );
}
