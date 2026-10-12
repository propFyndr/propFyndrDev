'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ShieldCheck, Scales, Compass } from '@phosphor-icons/react'
import { getSupabaseClient } from '@/lib/supabase'

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const checkAuth = async () => {
      try {
        const cachedId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null
        if (cachedId) {
          router.replace('/discover')
          return
        }

        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 1000)
        )
        const sessionPromise = getSupabaseClient().then((supabase) => supabase.auth.getSession())
        const res = await Promise.race([sessionPromise, timeoutPromise])

        if (cancelled) return
        if (res?.data?.session?.user) {
          try {
            localStorage.setItem('user_id', res.data.session.user.id)
          } catch {}
          router.replace('/discover')
        }
      } catch (err) {
        console.warn('Auth session check failed on LandingPage', err)
      }
    }

    checkAuth()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between overflow-hidden bg-[#050505] text-white font-sans selection:bg-white selection:text-black py-4 sm:py-6 px-4 sm:px-8">
      
      {/* Premium Architectural Skyline Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        <Image
          src="/images/backgrounds/newBg.jpeg"
          alt="Noida skyline architecture"
          fill
          sizes="100vw"
          className="object-cover opacity-60 mix-blend-screen scale-105"
          priority
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,5,5,0.1)_0%,rgba(5,5,5,0.75)_65%,#050505_95%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/95" />
      </div>

      {/* Floating Top Navigation Header */}
      <header className="relative z-20 w-full max-w-6xl mx-auto flex items-center justify-between shrink-0 py-2 sm:py-3">
        <Link href="/" className="group shrink-0">
          <Image
            src="/images/icons/logo-wordmark-white.png"
            alt="RealtyAsk"
            width={648}
            height={216}
            className="object-contain w-28 sm:w-44 h-auto opacity-95 group-hover:opacity-100 transition-opacity drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
            priority
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/auth"
            className="text-[11.5px] sm:text-sm font-semibold text-zinc-300 hover:text-white transition-colors tracking-tight px-2 py-1.5 whitespace-nowrap"
          >
            Sign In
          </Link>
          <Link
            href="/discover"
            className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-white text-zinc-950 hover:bg-zinc-100 text-[11px] sm:text-xs font-bold rounded-xl transition-all duration-200 shadow-[0_2px_12px_rgba(255,255,255,0.2)] active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Start Discovery</span>
            <ArrowRight size={13} weight="bold" className="text-zinc-950 shrink-0" />
          </Link>
        </div>
      </header>

      {/* Main Hero Content — Front and Center Layout */}
      <main className="relative z-20 w-full max-w-4xl mx-auto flex-1 flex flex-col justify-center items-center text-center py-4 sm:py-8 px-2 sm:px-4">
        
        {/* Main Headline */}
        <h1 className="text-[34px] xs:text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-bold tracking-tight text-white max-w-4xl leading-[1.12] drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] font-[family-name:var(--font-afacad)]">
          <span>Find the right property </span>
          <span className="italic font-extrabold bg-gradient-to-r from-blue-200 via-white to-blue-400 bg-clip-text text-transparent">
            in Noida.
          </span>
        </h1>

        {/* Subheading */}
        <p className="mt-3 sm:mt-5 text-[13px] sm:text-base md:text-lg text-zinc-300/90 max-w-xs sm:max-w-2xl font-normal leading-relaxed tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] px-2 sm:px-4">
          Chat and compare verified projects, prices, and builders, and make smarter property decisions
        </p>

        {/* Hero CTA Button — Direct Native Link */}
        <div className="mt-7 sm:mt-9 flex flex-col items-center justify-center w-full max-w-xs sm:max-w-none">
          <Link
            href="/discover"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 sm:px-14 py-4 sm:py-4.5 bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-950 text-[15px] sm:text-base font-extrabold rounded-2xl transition-all duration-150 shadow-[0_4px_30px_rgba(255,255,255,0.25)] hover:shadow-[0_4px_45px_rgba(255,255,255,0.4)] active:scale-95 cursor-pointer whitespace-nowrap select-none"
          >
            <span>Start Discovery</span>
            <ArrowRight size={18} weight="bold" className="text-zinc-950 shrink-0" />
          </Link>
        </div>

        {/* Clean 1-Line Trust Highlights */}
        <div className="mt-6 sm:mt-8 flex items-center justify-center gap-2.5 sm:gap-5 text-[10.5px] sm:text-xs font-semibold tracking-wider uppercase text-zinc-400 select-none">
          <span className="flex items-center gap-1 sm:gap-1.5 text-zinc-300 whitespace-nowrap">
            <ShieldCheck size={13} weight="duotone" className="text-emerald-400 shrink-0" />
            <span>100% RERA</span>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-1 sm:gap-1.5 text-zinc-300 whitespace-nowrap">
            <Scales size={13} weight="duotone" className="text-blue-400 shrink-0" />
            <span>Zero Broker Calls</span>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-1 sm:gap-1.5 text-zinc-300 whitespace-nowrap">
            <Compass size={13} weight="duotone" className="text-purple-400 shrink-0" />
            <span>Noida Guide</span>
          </span>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-20 w-full max-w-5xl mx-auto py-1 sm:py-2 shrink-0 text-center select-none">
        <p className="text-[10.5px] sm:text-[11px] text-zinc-500 font-medium">
          © {new Date().getFullYear()} RealtyAsk. AI Property Advisor for Noida & Greater Noida.
        </p>
      </footer>
    </div>
  )
}
