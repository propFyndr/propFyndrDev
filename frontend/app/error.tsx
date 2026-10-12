'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, House, ArrowClockwise, CaretDown, CaretUp, ShieldCheck } from '@phosphor-icons/react'
import Image from 'next/image'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    if (error?.message?.includes('ChunkLoadError') || error?.message?.includes('Loading chunk')) {
      const reloadAttempts = sessionStorage.getItem('chunk_reload_attempts') ?? '0'
      if (parseInt(reloadAttempts) < 1) {
        sessionStorage.setItem('chunk_reload_attempts', String(parseInt(reloadAttempts) + 1))
        window.location.reload()
      }
      return
    }
    console.error('[AppRuntimeError]', error)
  }, [error])

  const handleReset = async () => {
    setIsRetrying(true)
    try {
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map(name => caches.delete(name)))
      }
    } catch {
      // Ignore cache clearing errors
    }
    reset()
    setTimeout(() => setIsRetrying(false), 800)
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white relative overflow-hidden font-sans">
      {/* Ambient background */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 py-5 flex items-center justify-between border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <Image
            src="/images/icons/logo-wordmark-white.png"
            alt="RealtyAsk"
            width={648}
            height={216}
            className="object-contain h-auto opacity-90 group-hover:opacity-100 transition-opacity w-28 sm:w-36"
          />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
        >
          <ArrowLeft size={13} weight="bold" />
          <span>Home</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-md mx-auto w-full px-6 py-12 flex-1 flex flex-col items-center justify-center text-center">

        {/* Error icon badge */}
        <div className="w-18 h-18 mb-5 rounded-3xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center p-5 shadow-inner">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-amber-400">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/12 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-4">
          <ShieldCheck size={12} weight="duotone" className="text-blue-400" />
          <span>Session Recovery Active</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
          Unable to Load Section
        </h1>

        <p className="text-sm text-zinc-400 max-w-sm mb-8 leading-relaxed font-normal">
          An unexpected interruption occurred while rendering this view. You can reload the component or return to the main discovery floor.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <button
            type="button"
            onClick={handleReset}
            disabled={isRetrying}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <ArrowClockwise size={14} weight="bold" className={isRetrying ? 'animate-spin' : ''} />
            <span>{isRetrying ? 'Reloading...' : 'Try Again'}</span>
          </button>

          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 active:scale-95 border border-white/12 text-zinc-200 font-bold text-xs transition-all flex items-center gap-2"
          >
            <House size={14} weight="duotone" />
            <span>Return Home</span>
          </Link>
        </div>

        {/* Collapsible Error Trace */}
        {error?.message && (
          <div className="w-full max-w-sm mt-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <span>{showDetails ? 'Hide technical trace' : 'View technical trace'}</span>
              {showDetails ? <CaretUp size={11} weight="bold" /> : <CaretDown size={11} weight="bold" />}
            </button>

            {showDetails && (
              <div className="mt-3 p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-left font-mono text-[11px] text-zinc-400 overflow-x-auto max-h-36 leading-relaxed">
                <span className="text-zinc-500 font-bold block mb-1">Diagnostic Log:</span>
                {error.message}
                {error.digest && <span className="block text-zinc-600 mt-1">Digest: {error.digest}</span>}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-6 py-4 border-t border-white/5 text-center text-[11px] text-zinc-600">
        © {new Date().getFullYear()} RealtyAsk · Verified Real Estate Intelligence
      </footer>
    </div>
  )
}
