'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUp,
  ChatCircleText,
  Scales,
  Calculator,
  ShieldCheck,
  MapPinArea,
  UserCircleCheck,
} from '@phosphor-icons/react';
import InvertedPerspectiveCarousel from '@/components/landing/InvertedPerspectiveCarousel';
import { SiteBackdrop, SiteHeader } from '@/components/landing/SiteChrome';

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

// Promises, not counts: no number goes here until it is large and live.
const PROOF = [
  { icon: MapPinArea, title: 'Noida & Greater Noida West', sub: 'Focused on what we know well' },
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
    <div className="relative [--z:1] min-[1800px]:[--z:1.15] min-[2400px]:[--z:1.35] [zoom:var(--z)] min-h-[calc(100dvh/var(--z))] w-full flex flex-col overflow-x-clip bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans selection:bg-[#1D63ED] selection:text-white">
      <SiteBackdrop />
      <SiteHeader />

      {/* ── Hero: headline + live composer (left), buyer questions carousel (right) ── */}
      <main
        id="main-content"
        className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 flex-1 flex items-center py-8 lg:py-4"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center w-full">
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            <span
              style={enter(0)}
              className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-zinc-500 dark:text-zinc-400 uppercase"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#1D63ED] opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#1D63ED]" />
              </span>
              Your AI property advisor
            </span>

            <h1
              style={enter(80)}
              className={`mt-3 [@media(min-width:1024px)_and_(max-height:780px)]:mt-2 text-[36px] min-[380px]:text-[40px] sm:text-[52px] lg:text-[60px] [@media(min-width:1024px)_and_(max-height:780px)]:text-[50px] font-extrabold tracking-[-0.035em] leading-[1.04]`}
            >
              Find the right
              <br />
              property in <span className="text-[#1D63ED] dark:text-[#6B9BFF]">Noida.</span>
            </h1>

            <p
              style={enter(160)}
              className={`mt-4 [@media(min-width:1024px)_and_(max-height:780px)]:mt-3 text-[15px] sm:text-[16px] text-zinc-600 dark:text-zinc-300 max-w-[440px] leading-relaxed`}
            >
              Say what you want in plain words. Get a short list, the reason for each pick, and the honest trade-off.
            </p>

            {/* Composer: the hero is the product */}
            <form
              onSubmit={submit}
              style={enter(240)}
              className={`mt-6 [@media(min-width:1024px)_and_(max-height:780px)]:mt-4 w-full max-w-[500px]`}
              role="search"
            >
              <label htmlFor="hero-ask" className="sr-only">
                Describe the home you are looking for
              </label>
              <div className="relative flex items-center gap-2 pl-5 pr-1.5 py-1.5 bg-white/90 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/90 dark:border-white/10 rounded-full shadow-[0_10px_40px_-12px_rgba(15,23,42,0.22)] focus-within:border-[#1D63ED]/50 focus-within:shadow-[0_10px_40px_-10px_rgba(29,99,237,0.35)] focus-within:ring-4 focus-within:ring-[#1D63ED]/10 transition-all duration-300">
                <input
                  id="hero-ask"
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={PLACEHOLDERS[placeholderIndex]}
                  autoComplete="off"
                  enterKeyHint="send"
                  className="flex-1 min-w-0 bg-transparent text-[16px] sm:text-[15px] text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none h-11"
                />
                <button
                  type="submit"
                  aria-label="Ask RealtyAsk"
                  className="shrink-0 w-11 h-11 rounded-full bg-[#0B0F17] dark:bg-white hover:bg-[#1D63ED] dark:hover:bg-[#1D63ED] text-white dark:text-zinc-900 dark:hover:text-white flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.2)] transition-all duration-200 active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1D63ED] dark:focus-visible:ring-offset-zinc-950"
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
                    className="min-h-[36px] px-3.5 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-200 bg-white/60 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 border border-zinc-200/80 hover:border-zinc-300 dark:border-white/10 rounded-full backdrop-blur-md transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
                  >
                    {q.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleLaunchDiscovery()}
                  className="group/link min-h-[36px] inline-flex items-center gap-1 px-1 text-[12.5px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
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
        className={`relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pb-5 [@media(min-width:1024px)_and_(max-height:780px)]:pb-3 shrink-0`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {FEATURES.map((f, i) => (
            <button
              key={f.title}
              type="button"
              style={enter(420 + i * 70)}
              onClick={() => handleLaunchDiscovery(f.prompt)}
              className={`group relative flex items-center gap-4 p-4 sm:p-5 [@media(min-width:1024px)_and_(max-height:780px)]:py-3.5 text-left bg-white/75 hover:bg-white/95 dark:bg-zinc-900/70 dark:hover:bg-zinc-900/90 backdrop-blur-md rounded-[22px] border border-white/80 dark:border-white/10 shadow-[0_8px_25px_rgba(15,23,42,0.04)] hover:shadow-[0_14px_40px_-8px_rgba(15,23,42,0.12)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50`}
            >
              <span className="w-11 h-11 rounded-full bg-[#EBF3FF] dark:bg-[#1D63ED]/15 text-[#1D63ED] dark:text-[#6B9BFF] shrink-0 flex items-center justify-center group-hover:bg-[#1D63ED] group-hover:text-white transition-colors duration-300">
                <f.icon size={20} weight="bold" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight leading-snug">{f.title}</span>
                <span className="block text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{f.body}</span>
              </span>
              <ArrowRight
                size={14}
                weight="bold"
                aria-hidden
                className="shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-[#1D63ED] group-hover:translate-x-0.5 transition-all"
              />
            </button>
          ))}
        </div>

        <ul
          style={enter(640)}
          className={`mt-4 [@media(min-width:1024px)_and_(max-height:780px)]:mt-3 pt-3.5 border-t border-zinc-200/70 dark:border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 sm:divide-x sm:divide-zinc-200/70 dark:sm:divide-white/10`}
        >
          {PROOF.map((p) => (
            <li key={p.title} className="flex items-center sm:justify-center gap-3">
              <p.icon size={24} weight="duotone" className="text-zinc-800 dark:text-zinc-200 shrink-0" aria-hidden />
              <span>
                <span className="block text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-50">{p.title}</span>
                <span className="block text-[11.5px] text-zinc-500 dark:text-zinc-400">{p.sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
