'use client';

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, User as UserIcon, ArrowLeft, Shield } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase'
import { track, identifyUser } from '@/lib/analytics';
import Toast from '@/components/Toast';
import { API_BASE } from '@/lib/env';
import { getGuestToken, clearGuestToken } from '@/lib/guestToken';

type Mode = 'login' | 'register';

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
    <div className="relative min-h-[100dvh] w-full flex flex-col justify-between items-center bg-[#050505] text-white font-sans overflow-x-hidden p-4 sm:p-6 selection:bg-white selection:text-black">
      {/* Background Architectural Skyline */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <Image src="/images/backgrounds/newBg.jpeg" alt="background" fill className="object-cover opacity-35 mix-blend-screen" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90" />
      </div>

      {/* Top Bar with Back Button */}
      <div className="relative z-20 w-full max-w-md flex items-center justify-between py-2">
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs font-semibold group px-2 py-1.5 rounded-lg active:scale-95">
          <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
            <ArrowLeft size={13} />
          </div>
          <span>Home</span>
        </Link>
      </div>

      {/* Center Auth Card */}
      <div className="relative z-10 w-full max-w-[400px] my-auto py-4">
        {/* Wordmark Logo */}
        <div className="flex flex-col items-center mb-6 gap-3">
          <Image src="/images/icons/logo-wordmark-white.png" alt="PropFyndr" width={106} height={48} className="object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]" priority />
          <div className="text-center">
            <h1 className="text-white font-bold text-lg sm:text-xl tracking-tight">Welcome to PropFyndr</h1>
            <p className="text-zinc-400 text-xs mt-0.5 font-medium">Unbiased property guidance for Noida</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#111111]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-7 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]">
          {/* Mode Switch Tabs */}
          <div className="flex bg-black/60 border border-white/10 rounded-xl p-1 mb-6 gap-1">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                  mode === m
                    ? 'bg-white text-zinc-950 shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div className="relative group">
                <UserIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-3.5 py-3 text-white placeholder:text-zinc-500 text-[16px] sm:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            )}

            <div className="relative group">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                autoComplete="email"
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-3.5 py-3 text-white placeholder:text-zinc-500 text-[16px] sm:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="relative group">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Password (6+ characters)' : 'Password'}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-white placeholder:text-zinc-500 text-[16px] sm:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-2 rounded-lg"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <p className="text-red-400 text-xs leading-relaxed font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-zinc-100 active:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-bold py-3.5 rounded-xl transition-all text-xs sm:text-sm mt-1 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              {loading && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <p className="text-center text-zinc-400 text-xs">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer ml-1"
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>

        {/* Continue as guest */}
        <div className="flex justify-center mt-5">
          <Link
            href="/discover"
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer"
          >
            <span>Continue as guest</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>
      </div>

      {/* Trust Footer */}
      <div className="relative z-10 flex items-center justify-center gap-2 py-3 text-zinc-400 text-[11px] font-medium text-center">
        <Shield size={13} className="text-emerald-400 shrink-0" />
        <span>100% Free for buyers. Zero broker spam.</span>
      </div>

      {toast && <Toast message={toast} duration={3000} onClose={() => setToast(null)} />}
    </div>
  );
}
