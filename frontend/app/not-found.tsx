'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, House, ArrowRight, ArrowBendDownLeft, MagnifyingGlass,
  Buildings, MapPin, ChatCircleText
} from '@phosphor-icons/react'

export default function NotFound() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/discover?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push('/discover')
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-600/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,5,5,0.1)_0%,rgba(5,5,5,0.7)_70%,#050505_100%)] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 py-5 flex items-center justify-between border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
            RP
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-blue-400 transition-colors">
            PropFyndr
          </span>
        </Link>

        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
        >
          <ArrowLeft size={13} weight="bold" />
          <span>Go Back</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-xl mx-auto w-full px-6 py-12 flex-1 flex flex-col items-center justify-center text-center">

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/12 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-6">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <span>Page Not Found · 404</span>
        </div>

        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-500 mb-6 shadow-inner">
          <Buildings size={36} weight="duotone" className="text-zinc-400" />
        </div>

        {/* Title & Description */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
          Listing Not Found
        </h1>
        <p className="text-sm text-zinc-400 max-w-md mb-8 leading-relaxed font-normal">
          The property listing or page you are looking for does not exist, may have been renamed, or is temporarily unlisted.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="w-full max-w-md mb-8">
          <div className="relative flex items-center bg-white/[0.04] border border-white/12 focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/15 rounded-2xl p-1.5 transition-all backdrop-blur-md">
            <MagnifyingGlass size={17} className="text-zinc-500 ml-3 shrink-0" weight="bold" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Sector 75, Mahagun, Godrej..."
              className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 px-3 py-2 outline-none font-medium"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Search</span>
              <ArrowBendDownLeft size={12} weight="bold" />
            </button>
          </div>
        </form>

        {/* Quick Nav Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-lg mb-8">
          <Link
            href="/discover"
            className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-blue-500/40 hover:bg-white/[0.07] transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2.5">
              <ChatCircleText size={18} weight="duotone" className="text-blue-400 group-hover:scale-110 transition-transform" />
              <ArrowRight size={13} weight="bold" className="text-zinc-600 group-hover:text-blue-400 transition-colors" />
            </div>
            <h3 className="text-xs font-bold text-white mb-0.5">Discover Properties</h3>
            <p className="text-[11px] text-zinc-500 font-medium">Chat with AI advisor</p>
          </Link>

          {/*
            Points at the sector index rather than one hardcoded sector. Day 5
            asks this page to send people "back to active sectors", and a single
            named sector is a guess about which one they wanted.
          */}
          <Link
            href="/sectors"
            className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.07] transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2.5">
              <MapPin size={18} weight="duotone" className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <ArrowRight size={13} weight="bold" className="text-zinc-600 group-hover:text-emerald-400 transition-colors" />
            </div>
            <h3 className="text-xs font-bold text-white mb-0.5">Browse micro-markets</h3>
            <p className="text-[11px] text-zinc-500 font-medium">Noida, Greater Noida &amp; Yamuna</p>
          </Link>

          <Link
            href="/"
            className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/25 hover:bg-white/[0.07] transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2.5">
              <House size={18} weight="duotone" className="text-zinc-300 group-hover:scale-110 transition-transform" />
              <ArrowRight size={13} weight="bold" className="text-zinc-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-xs font-bold text-white mb-0.5">Homepage</h3>
            <p className="text-[11px] text-zinc-500 font-medium">Return to landing</p>
          </Link>
        </div>

        {/* Secondary Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 font-bold text-xs transition-all shadow-lg shadow-white/8 cursor-pointer"
        >
          <House size={13} weight="bold" />
          <span>Return to Homepage</span>
        </Link>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-6 py-4 border-t border-white/5 text-center text-[11px] text-zinc-600">
        © {new Date().getFullYear()} PropFyndr · Verified Real Estate Intelligence
      </footer>
    </div>
  )
}
