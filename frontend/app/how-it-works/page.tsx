import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ChatCircleText,
  Scales,
  Calculator,
  UsersThree,
  HandPalm,
  Tag,
  ShieldCheck,
  Compass,
  ArrowRight,
} from '@phosphor-icons/react/dist/ssr';
import { SiteBackdrop, SiteHeader } from '@/components/landing/SiteChrome';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Describe the home you want in one sentence. RealtyAsk answers with a short list, the reason for each pick, the honest trade-off and the true cost, for Noida and Greater Noida West.',
};

// Each step describes a live feature (see CLAUDE.md § V1 MVP). Keep it that way:
// nothing here may promise what the product does not do today.
const STEPS = [
  {
    icon: ChatCircleText,
    title: 'Say what you want',
    body: 'Budget, sector, BHK, possession, metro. One sentence in your own words, no filter forms.',
    example: '“3BHK near a metro under 1.5 Cr, ready in a year”',
  },
  {
    icon: Scales,
    title: 'Get a short list, with the catch',
    body: 'Each pick comes with why it fits you and its main trade-off. If nothing fits, we say so and ask what you would relax.',
    example: 'Reason: 10 minutes from the metro. Trade-off: possession in 2027.',
  },
  {
    icon: Calculator,
    title: 'Check the real numbers',
    body: 'Stamp duty, registration and GST worked out under UP rules. EMI with the interest rate shown as an assumption you can change.',
    example: 'All-in cost, not just the base price',
  },
  {
    icon: UsersThree,
    title: 'Decide with your family',
    body: 'Save and compare projects side by side, share a dossier, and ask for a callback or site visit when you are ready.',
    example: 'No account needed for any of it',
  },
];

const PROMISES = [
  { icon: HandPalm, title: 'Neutral ranking', body: 'A builder paying us never moves a project up your list.' },
  { icon: Tag, title: 'Facts with their source', body: 'From the project’s own records, set by law, or a market estimate labelled as one.' },
  { icon: ShieldCheck, title: 'RERA where we hold it', body: 'Registration details from the records we hold, shown with the project.' },
  { icon: Compass, title: 'Honest limits', body: 'We do not inspect sites, negotiate prices or give legal advice. We cover Noida and Greater Noida West.' },
];

const enter = (delayMs: number): React.CSSProperties => ({
  animation: 'fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
  animationDelay: `${delayMs}ms`,
});

const card =
  'bg-white/80 dark:bg-zinc-900/75 backdrop-blur-md border border-white/90 dark:border-white/10 rounded-[24px] shadow-[0_8px_25px_rgba(15,23,42,0.05)]';

export default function HowItWorksPage() {
  return (
    <div className="relative [--z:1] min-[1800px]:[--z:1.15] min-[2400px]:[--z:1.35] [zoom:var(--z)] min-h-[calc(100dvh/var(--z))] w-full flex flex-col overflow-x-clip bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans selection:bg-[#1D63ED] selection:text-white">
      {/* Photo only behind the top of the page; content below sits on the page colour */}
      <div className="absolute inset-x-0 top-0 h-[720px]">
        <SiteBackdrop />
      </div>
      <SiteHeader />

      <main id="main-content" className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pb-16 sm:pb-24">
        {/* Hero */}
        <section className="pt-12 sm:pt-20 lg:pt-24 max-w-[720px]">
          <span style={enter(0)} className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-zinc-500 dark:text-zinc-400 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1D63ED]" />
            How it works
          </span>
          <h1 style={enter(80)} className="mt-3 text-[38px] sm:text-[52px] lg:text-[60px] font-extrabold tracking-[-0.035em] leading-[1.04]">
            From one sentence to a <span className="text-[#1D63ED] dark:text-[#6B9BFF]">confident shortlist.</span>
          </h1>
          <p style={enter(160)} className="mt-4 text-[15px] sm:text-[17px] text-zinc-600 dark:text-zinc-300 max-w-[560px] leading-relaxed">
            RealtyAsk is an advisor, not a listings site. You describe the home you want; it answers with a few projects, why each fits, and what you give up.
          </p>
        </section>

        {/* Steps */}
        <section aria-labelledby="steps-heading" className="mt-12 sm:mt-16">
          <h2 id="steps-heading" className="sr-only">Four steps</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {STEPS.map((s, i) => (
              <li key={s.title} style={enter(240 + i * 70)} className={`${card} p-5 sm:p-6 flex flex-col`}>
                <div className="flex items-center justify-between">
                  <span className="w-11 h-11 rounded-full bg-[#EBF3FF] dark:bg-[#1D63ED]/15 text-[#1D63ED] dark:text-[#6B9BFF] flex items-center justify-center">
                    <s.icon size={20} weight="bold" />
                  </span>
                  <span className="text-[12px] font-semibold tabular-nums text-zinc-400 dark:text-zinc-500">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed">{s.body}</p>
                <p className="mt-auto pt-5 text-[12.5px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/70 dark:border-white/10">
                  {s.example}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Promises */}
        <section aria-labelledby="promises-heading" className="mt-16 sm:mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-4">
            <h2 id="promises-heading" className="text-[28px] sm:text-[34px] font-extrabold tracking-[-0.03em] leading-[1.1]">
              What we promise, and what we don’t.
            </h2>
            <p className="mt-3 text-[15px] text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-[380px]">
              Trust matters more than a sale. These are the rules the advisor works under.
            </p>
          </div>
          <ul className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-7">
            {PROMISES.map((p) => (
              <li key={p.title} className="flex items-start gap-3.5">
                <p.icon size={22} weight="duotone" className="mt-0.5 shrink-0 text-zinc-800 dark:text-zinc-200" aria-hidden />
                <span>
                  <span className="block text-[15px] font-semibold tracking-tight">{p.title}</span>
                  <span className="block mt-1 text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className={`${card} mt-16 sm:mt-24 p-6 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6`}>
          <div>
            <h2 className="text-[24px] sm:text-[30px] font-extrabold tracking-[-0.03em] leading-tight">Ask your first question.</h2>
            <p className="mt-1.5 text-[14px] sm:text-[15px] text-zinc-600 dark:text-zinc-400">Free, and no signup to start.</p>
          </div>
          <Link
            href="/discover"
            className="group inline-flex items-center justify-center gap-2 h-12 px-7 shrink-0 bg-[#0B0F17] dark:bg-white hover:bg-[#1D63ED] dark:hover:bg-[#1D63ED] text-white dark:text-zinc-900 dark:hover:text-white text-[14px] font-semibold rounded-full shadow-[0_6px_20px_-6px_rgba(0,0,0,0.35)] transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1D63ED]"
          >
            Start chatting
            <ArrowRight size={15} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </section>
      </main>
    </div>
  );
}
