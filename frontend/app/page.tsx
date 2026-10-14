'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUp,
  ChatCircleText,
  Scales,
  Calculator,
  ShieldCheck,
  Buildings,
  UserCircleCheck,
} from '@phosphor-icons/react';
import InvertedPerspectiveCarousel from '@/components/landing/InvertedPerspectiveCarousel';

// Rotating composer placeholders: four facts in one line is the point.
const PLACEHOLDERS = [
  '3BHK near a metro under 1.5 Cr, ready in a year…',
  '2BHK in Greater Noida West for a first home…',
  'Low-density project in Sector 150 with good schools…',
  'What would a 1.2 Cr flat really cost me, all-in?',
];

const QUICK_PROMPTS = [
  { label: '3BHK under 2 Cr', prompt: 'Show me 3BHK under 2 Cr in Noida, ready within a year' },
  { label: 'Near a metro', prompt: '2BHK within 1 km of a metro station in Noida' },
  { label: 'Ready to move', prompt: 'Ready to move projects in Noida under 1.5 Cr' },
];

// Every card maps to a live feature. Each opens the chat with a real question.
const FEATURES = [
  {
    icon: ChatCircleText,
    title: 'Ask like you talk',
    body: 'Budget, sector, BHK and possession in one sentence. No filter forms.',
    prompt: '3BHK in Sector 150 under 2 Cr with possession within a year',
  },
  {
    icon: Scales,
    title: 'Every pick, with its catch',
    body: 'Each recommendation comes with the reason and the honest trade-off.',
    prompt: 'Compare the top 3 projects in Sector 150 and tell me the trade-offs',
  },
  {
    icon: Calculator,
    title: 'True cost, upfront',
    body: 'Stamp duty, registration, GST and EMI worked out before you visit.',
    prompt: 'What is the all-in cost of a 1.5 Cr flat in Noida including stamp duty and GST?',
  },
];

// Only claims we can stand behind. Project count: 394 rows as of 2026-09-15
// (MEMORY.md); keep this below the live count, never above it.
const PROOF = [
  { icon: Buildings, title: '350+ projects', sub: 'Noida & Greater Noida West' },
  { icon: ShieldCheck, title: 'RERA details', sub: 'Shown with each project' },
  { icon: UserCircleCheck, title: 'Free, no signup', sub: 'Start chatting as a guest' },
];

const enter = (delayMs: number): React.CSSProperties => ({
  animation: 'fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
  animationDelay: `${delayMs}ms`,
});

export default function LandingPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLaunchDiscovery = useCallback((prompt?: string) => {
    try {
      if (prompt) sessionStorage.setItem('rp_prefill_chat', prompt);
    } catch (err) {
      console.warn('sessionStorage access failed', err);
    }
    router.push(prompt ? `/discover?q=${encodeURIComponent(prompt)}` : '/discover');
  }, [router]);

  // Placeholder cycles only while the box is empty and motion is allowed.
  useEffect(() => {
    if (reduceMotion || query) return;
    const t = setInterval(() => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(t);
  }, [reduceMotion, query]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = query.trim();
    if (!text) {
      inputRef.current?.focus();
      return;
    }
    handleLaunchDiscovery(text);
  };

  return (
    <div className="relative min-h-[100dvh] lg:h-[100dvh] lg:max-h-[100dvh] w-full flex flex-col overflow-x-clip lg:overflow-hidden bg-white text-zinc-900 font-sans selection:bg-[#1D63ED] selection:text-white">
      {/* ── Background photo with soft washes so text and cards stay legible ── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        <Image
          src="/images/backgrounds/LandingPageBG.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[70%_center] lg:object-center"
          priority
        />
        <div className="absolute inset-y-0 left-0 w-full lg:w-[62%] bg-gradient-to-r from-white/85 via-white/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-white via-white/80 to-transparent" />
      </div>

      {/* ── Top navigation ── */}
      <header className="relative z-30 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-4 sm:pt-5 flex items-center justify-between shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 group shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
        >
          <Image
            src="/images/icons/apple-icon.png"
            alt=""
            width={44}
            height={44}
            className="w-10 h-10 sm:w-11 sm:h-11 -mx-1 object-contain group-hover:scale-105 transition-transform duration-300"
            priority
          />
          <span className="text-[22px] sm:text-[24px] font-bold tracking-[-0.03em] text-zinc-900">
            Realty<span className="text-[#1D63ED]">Ask</span>
          </span>
        </Link>

        <nav className="flex items-center gap-5 sm:gap-8" aria-label="Main">
          <button
            onClick={() => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="hidden md:inline-block text-[14px] font-medium text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
          >
            How it works
          </button>
          <Link href="/builder-register" className="hidden md:inline-block text-[14px] font-medium text-zinc-700 hover:text-zinc-950 transition-colors">
            For Builders
          </Link>
          <Link href="/blog" className="hidden sm:inline-block text-[14px] font-medium text-zinc-700 hover:text-zinc-950 transition-colors">
            Blog
          </Link>
          <Link
            href="/auth"
            className="min-h-[40px] inline-flex items-center px-5 text-[13.5px] font-medium text-zinc-800 hover:text-zinc-950 bg-white/70 hover:bg-white border border-zinc-300/80 rounded-full shadow-sm hover:shadow transition-all backdrop-blur-md active:scale-95"
          >
            Sign In
          </Link>
        </nav>
      </header>

      {/* ── Hero: headline + live composer (left), buyer questions carousel (right) ── */}
      <main
        id="main-content"
        className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 flex-1 min-h-0 flex items-center py-8 lg:py-2"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center w-full">
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            <span
              style={enter(0)}
              className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-zinc-500 uppercase"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#1D63ED] opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#1D63ED]" />
              </span>
              Your AI property advisor
            </span>

            <h1
              style={enter(80)}
              className="mt-3 [@media(max-height:780px)]:lg:mt-2 text-[40px] sm:text-[52px] lg:text-[60px] [@media(max-height:780px)]:lg:text-[50px] font-extrabold text-zinc-900 tracking-[-0.035em] leading-[1.04]"
            >
              Find the right
              <br />
              property in <span className="text-[#1D63ED]">Noida.</span>
            </h1>

            <p
              style={enter(160)}
              className="mt-4 [@media(max-height:780px)]:lg:mt-3 text-[15px] sm:text-[16px] text-zinc-600 max-w-[440px] leading-relaxed"
            >
              Say what you want in plain words. Get a short list, the reason for each pick, and the honest trade-off.
            </p>

            {/* Composer: the hero is the product */}
            <form
              onSubmit={submit}
              style={enter(240)}
              className="mt-6 [@media(max-height:780px)]:lg:mt-4 w-full max-w-[500px]"
              role="search"
            >
              <label htmlFor="hero-ask" className="sr-only">
                Describe the home you are looking for
              </label>
              <div className="group relative flex items-center gap-2 pl-5 pr-1.5 py-1.5 bg-white/90 backdrop-blur-xl border border-zinc-200/90 rounded-full shadow-[0_10px_40px_-12px_rgba(15,23,42,0.22)] focus-within:border-[#1D63ED]/50 focus-within:shadow-[0_10px_40px_-10px_rgba(29,99,237,0.35)] focus-within:ring-4 focus-within:ring-[#1D63ED]/10 transition-all duration-300">
                <input
                  id="hero-ask"
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={PLACEHOLDERS[placeholderIndex]}
                  autoComplete="off"
                  enterKeyHint="send"
                  className="flex-1 min-w-0 bg-transparent text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none h-11"
                />
                <button
                  type="submit"
                  aria-label="Ask RealtyAsk"
                  className="shrink-0 w-11 h-11 rounded-full bg-[#0B0F17] hover:bg-[#1D63ED] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.2)] transition-all duration-200 active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1D63ED]"
                >
                  <ArrowUp size={18} weight="bold" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => handleLaunchDiscovery(q.prompt)}
                    className="min-h-[34px] px-3.5 text-[12.5px] font-medium text-zinc-700 bg-white/60 hover:bg-white border border-zinc-200/80 hover:border-zinc-300 rounded-full backdrop-blur-md transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
                  >
                    {q.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleLaunchDiscovery()}
                  className="group/link min-h-[34px] inline-flex items-center gap-1 px-1 text-[12.5px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
                >
                  or just browse
                  <ArrowRight size={12} weight="bold" className="group-hover/link:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </form>
          </div>

          <div style={enter(320)} className="lg:col-span-6 flex flex-col items-center justify-center w-full">
            <InvertedPerspectiveCarousel onSelectPrompt={handleLaunchDiscovery} />
          </div>
        </div>
      </main>

      {/* ── Feature cards + proof row ── */}
      <section
        id="features-section"
        aria-label="How RealtyAsk helps"
        className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pb-5 [@media(max-height:780px)]:lg:pb-3 shrink-0"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {FEATURES.map((f, i) => (
            <button
              key={f.title}
              type="button"
              style={enter(420 + i * 70)}
              onClick={() => handleLaunchDiscovery(f.prompt)}
              className="group relative flex items-center gap-4 p-4 sm:p-5 [@media(max-height:780px)]:lg:py-3.5 text-left bg-white/75 hover:bg-white/95 backdrop-blur-md rounded-[22px] border border-white/80 shadow-[0_8px_25px_rgba(15,23,42,0.04)] hover:shadow-[0_14px_40px_-8px_rgba(15,23,42,0.12)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
            >
              <span className="w-11 h-11 rounded-full bg-[#EBF3FF] text-[#1D63ED] shrink-0 flex items-center justify-center group-hover:bg-[#1D63ED] group-hover:text-white transition-colors duration-300">
                <f.icon size={20} weight="bold" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-zinc-900 tracking-tight leading-snug">{f.title}</span>
                <span className="block text-[12.5px] text-zinc-500 mt-0.5 leading-snug">{f.body}</span>
              </span>
              <ArrowRight
                size={14}
                weight="bold"
                aria-hidden
                className="shrink-0 text-zinc-300 group-hover:text-[#1D63ED] group-hover:translate-x-0.5 transition-all"
              />
            </button>
          ))}
        </div>

        <ul
          style={enter(640)}
          className="mt-4 [@media(max-height:780px)]:lg:mt-3 pt-3.5 border-t border-zinc-200/70 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 sm:divide-x sm:divide-zinc-200/70"
        >
          {PROOF.map((p) => (
            <li key={p.title} className="flex items-center sm:justify-center gap-3">
              <p.icon size={24} weight="duotone" className="text-zinc-800 shrink-0" aria-hidden />
              <span>
                <span className="block text-[13.5px] font-semibold text-zinc-900 tabular-nums">{p.title}</span>
                <span className="block text-[11.5px] text-zinc-500">{p.sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
