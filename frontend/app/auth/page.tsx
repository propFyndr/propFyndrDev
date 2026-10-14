'use client';

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Eye,
  EyeSlash,
  Envelope,
  Lock,
  User as UserIcon,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  ChatCircleText,
  BookmarkSimple,
  Phone,
} from '@phosphor-icons/react';
import { getSupabaseClient } from '@/lib/supabase'
import { track, identifyUser } from '@/lib/analytics';
import Toast from '@/components/Toast';
import { API_BASE } from '@/lib/env';
import { getGuestToken, clearGuestToken } from '@/lib/guestToken';

type Mode = 'login' | 'register';

// What an account adds over guest mode. Each line is a real code path:
// guest-session migration below, /saved + dossiers, builder phone access.
const BENEFITS = [
  { icon: ChatCircleText, title: 'Your guest chats come with you', body: 'Everything you asked before signing in moves to your account.' },
  { icon: BookmarkSimple, title: 'Shortlists and dossiers, kept', body: 'Saved projects and shareable dossiers in one place.' },
  { icon: Phone, title: 'Builder contact access', body: 'Reach the builder directly when you are ready.' },
];

const enter = (delayMs: number): React.CSSProperties => ({
  animation: 'fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
  animationDelay: `${delayMs}ms`,
});

const inputClass =
  'w-full h-12 bg-white/80 border border-zinc-200 rounded-xl pl-11 pr-4 text-zinc-900 placeholder:text-zinc-400 text-[16px] sm:text-[14px] outline-none focus:bg-white focus:border-[#1D63ED]/60 focus:ring-4 focus:ring-[#1D63ED]/10 transition-all';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getSupabaseClient().then((supabase) => supabase.auth.getSession()).then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        localStorage.setItem('user_id', data.session.user.id);
        router.replace('/discover');
      }
    }).catch((err) => {
      console.error('[auth-session-check] Failed:', err);
    });
    return () => { cancelled = true; };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || loading) return;
    setLoading(true);
    setError('');

    try {
      const supabase = await getSupabaseClient();

      if (mode === 'login') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (authError) {
          if (authError.message.includes('Email not confirmed')) {
            setError('Please confirm your email first. Check your inbox for a confirmation link.');
          } else if (authError.message.includes('Invalid login')) {
            setError('Wrong email or password. Double-check and try again.');
          } else {
            throw authError;
          }
          return;
        }
        if (data.user) {
          localStorage.setItem('user_id', data.user.id);
          // No email trait: the user id is enough to join events, and PostHog
          // need not hold the address.
          identifyUser(data.user.id)

          const guestToken = getGuestToken();
          if (guestToken) {
            try {
              const migrateRes = await fetch(`${API_BASE}/chat/sessions/migrate`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${data.session.access_token}`
                },
                body: JSON.stringify({ guestToken })
              });

              if (!migrateRes.ok) throw new Error(`Migration failed: ${migrateRes.status}`);
              clearGuestToken();
            } catch (err) {
              console.error('[session-migrate] Failed:', err);
              setToast('Your previous research couldn\'t be transferred. Your new searches will be saved.');
            }
          }

          router.push('/discover');
        }
      } else {
        track('signup_started', { mode })
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { name: name.trim() || email.split('@')[0] } },
        });
        if (authError) throw authError;
        if (data.user?.identities?.length === 0) {
          setError('An account with this email already exists. Sign in instead.');
        } else {
          track('signup_completed')
          setToast('Account created. Check your inbox to confirm your email, then sign in.');
          setMode('login');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setShowPassword(false);
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col overflow-x-clip bg-white text-zinc-900 font-sans selection:bg-[#1D63ED] selection:text-white">
      {/* Same photo and washes as the landing page, weighted so the form stays legible */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
        <Image
          src="/images/backgrounds/LandingPageBG.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[70%_center] lg:object-center"
          priority
        />
        <div className="absolute inset-0 bg-white/40 lg:bg-transparent" />
        <div className="absolute inset-y-0 left-0 w-full lg:w-[62%] bg-gradient-to-r from-white/90 via-white/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-white via-white/70 to-transparent" />
      </div>

      {/* Header */}
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
        <Link
          href="/"
          className="group min-h-[40px] inline-flex items-center gap-1.5 px-4 text-[13.5px] font-medium text-zinc-700 hover:text-zinc-950 bg-white/70 hover:bg-white border border-zinc-300/80 rounded-full shadow-sm backdrop-blur-md transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
        >
          <ArrowLeft size={14} weight="bold" className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to home</span>
        </Link>
      </header>

      <main
        id="main-content"
        className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 flex-1 flex items-center py-8 lg:py-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center w-full">
          {/* Left: why sign in (laptop only) */}
          <div className="hidden lg:flex lg:col-span-6 flex-col items-start">
            <span
              style={enter(0)}
              className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-zinc-500 uppercase"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#1D63ED]" />
              Your RealtyAsk account
            </span>
            <h1
              style={enter(80)}
              className="mt-3 text-[52px] [@media(max-height:780px)]:text-[44px] font-extrabold tracking-[-0.035em] leading-[1.04]"
            >
              Pick up where
              <br />
              you <span className="text-[#1D63ED]">left off.</span>
            </h1>
            <p style={enter(160)} className="mt-4 text-[16px] text-zinc-600 max-w-[420px] leading-relaxed">
              Signing in is optional. Chat as a guest anytime; an account keeps your research in one place.
            </p>

            <ul className="mt-8 [@media(max-height:780px)]:mt-5 space-y-4 max-w-[440px]">
              {BENEFITS.map((b, i) => (
                <li key={b.title} style={enter(240 + i * 70)} className="flex items-start gap-3.5">
                  <span className="w-10 h-10 rounded-full bg-[#EBF3FF] text-[#1D63ED] shrink-0 flex items-center justify-center">
                    <b.icon size={18} weight="bold" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold tracking-tight text-zinc-900">{b.title}</span>
                    <span className="block text-[13px] text-zinc-500 mt-0.5 leading-snug">{b.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: auth card */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end w-full">
            <div style={enter(120)} className="w-full max-w-[420px]">
              {/* Mobile-only heading */}
              <div className="lg:hidden mb-5">
                <h1 className="text-[32px] font-extrabold tracking-[-0.03em] leading-[1.08]">
                  Pick up where
                  <br />
                  you <span className="text-[#1D63ED]">left off.</span>
                </h1>
                <p className="mt-2 text-[14px] text-zinc-600">Your chats, shortlists and dossiers, in one place.</p>
              </div>

              <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[28px] p-5 sm:p-7 shadow-[0_24px_60px_-16px_rgba(15,23,42,0.25)]">
                {/* Mode switch */}
                <div role="tablist" aria-label="Account" className="flex bg-zinc-100/90 rounded-full p-1 mb-6 gap-1">
                  {(['login', 'register'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => switchMode(m)}
                      className={`flex-1 h-10 rounded-full text-[13.5px] font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50 ${
                        mode === m
                          ? 'bg-white text-zinc-950 shadow-[0_2px_8px_rgba(15,23,42,0.1)]'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      {m === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {mode === 'register' && (
                    <div className="relative group">
                      <label htmlFor="auth-name" className="sr-only">Full name</label>
                      <UserIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#1D63ED] transition-colors pointer-events-none" />
                      <input
                        id="auth-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full name"
                        autoComplete="name"
                        className={inputClass}
                      />
                    </div>
                  )}

                  <div className="relative group">
                    <label htmlFor="auth-email" className="sr-only">Email address</label>
                    <Envelope size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#1D63ED] transition-colors pointer-events-none" />
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      required
                      autoComplete="email"
                      className={inputClass}
                    />
                  </div>

                  <div className="relative group">
                    <label htmlFor="auth-password" className="sr-only">Password</label>
                    <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#1D63ED] transition-colors pointer-events-none" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Password (6+ characters)' : 'Password'}
                      required
                      minLength={6}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className={`${inputClass} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-zinc-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  {error && (
                    <div role="alert" className="bg-red-50 border border-red-200/80 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <p className="text-red-700 text-[13px] leading-relaxed">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group w-full h-12 mt-1 bg-[#0B0F17] hover:bg-[#1D63ED] disabled:opacity-50 disabled:hover:bg-[#0B0F17] text-white text-[14px] font-semibold rounded-full shadow-[0_6px_20px_-6px_rgba(0,0,0,0.35)] transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1D63ED]"
                  >
                    {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                    {!loading && <ArrowRight size={15} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />}
                  </button>
                </form>

                <p className="mt-5 text-center text-zinc-500 text-[13px]">
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                  <button
                    type="button"
                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                    className="ml-1.5 text-[#1D63ED] hover:text-[#1550c4] font-semibold transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
                  >
                    {mode === 'login' ? 'Create one' : 'Sign in'}
                  </button>
                </p>
              </div>

              {/* Guest path */}
              <div className="mt-4 flex flex-col items-center gap-3">
                <Link
                  href="/discover"
                  className="group inline-flex items-center gap-1.5 min-h-[40px] px-5 rounded-full bg-white/70 hover:bg-white border border-zinc-200/80 text-zinc-700 hover:text-zinc-950 text-[13px] font-medium backdrop-blur-md transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
                >
                  <span>Continue as guest</span>
                  <ArrowRight size={13} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <p className="flex items-center gap-1.5 text-zinc-500 text-[12px]">
                  <ShieldCheck size={14} weight="duotone" className="text-zinc-700 shrink-0" aria-hidden />
                  Free for buyers. No broker spam.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast} duration={3000} onClose={() => setToast(null)} />}
    </div>
  );
}
