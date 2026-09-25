'use client'

import React, { useEffect, useState, use } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Printer,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ShieldCheck,
  TrendingUp,
  MapPin,
  Calendar,
  IndianRupee,
  Copy,
  Check,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { API_BASE } from '@/lib/env'

interface DossierFinancials {
  basePriceCr: number
  landedCostCr: number
  downpaymentCr: number
  loanCr: number
  standardEmi: number
  taxShieldMonthly: number
  netMonthlyEmi: number
  safeMonthlyIncome: number
}

interface DossierProject {
  id: string
  name: string
  slug: string
  sector: string
  builderName: string | null
  status: string
  possessionLabel: string | null
  priceRangeLabel: string | null
  priceMinCr: number | null
  heroImageUrl: string | null
  strengths: string[]
  redFlags: string[]
  financials: DossierFinancials
  siteVisitChecklist: string[]
}

interface FamilyDossier {
  token: string
  createdAt: string
  expiresAt: string
  consultation: {
    buyerName: string
    date: string
    targetSector?: string
    targetBhk?: string | number
    budgetLabel?: string
    notes?: string
  }
  projects: DossierProject[]
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export default function DossierPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const token = resolvedParams.token

  const [dossier, setDossier] = useState<FamilyDossier | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchDossier() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/dossier/${token}`)
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Dossier link not found or expired' : 'Failed to load dossier')
        }
        const data = await res.json()
        setDossier(data.dossier)
      } catch (err: any) {
        setError(err.message || 'Failed to load consultation summary')
      } finally {
        setLoading(false)
      }
    }
    fetchDossier()
  }, [token])

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShareWhatsApp = () => {
    if (typeof window !== 'undefined' && dossier) {
      const pNames = dossier.projects.map(p => p.name).join(', ')
      const text = `Hi, here is our family due diligence summary and financial dossier for ${pNames} on PropFyndr: ${window.location.href}`
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-200">Retrieving Family Deal Dossier...</h2>
        <p className="text-sm text-slate-500 mt-1">Aggregating forensic due-diligence data</p>
      </div>
    )
  }

  if (error || !dossier) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center mb-4">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Dossier Unavailable</h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-md">
          {error || 'This consultation dossier link may have expired or is invalid.'}
        </p>
        <Link
          href="/chat"
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition"
        >
          Start New Property Consultation
        </Link>
      </div>
    )
  }

  const { consultation, projects } = dossier

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 print:bg-white print:text-black">
      {/* Top Floating Action Bar (Hidden in Print) */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 py-3 print:hidden">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="font-extrabold text-base tracking-tight text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Building2 size={20} />
              <span>PropFyndr</span>
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-medium">
              Family Consultation Memo
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer size={14} />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Share2 size={14} />
              <span>Share on WhatsApp</span>
            </button>
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
            <Link
              href="/chat"
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition ml-1"
            >
              <MessageSquare size={14} />
              <span>Continue in Chat</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dossier Container */}
      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
        {/* Memo Header Card */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-black tracking-widest uppercase text-blue-600 dark:text-blue-400 mb-1">
                <Sparkles size={14} /> Confidential Due-Diligence Briefing
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Family Property Consultation Dossier
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                Forensic side-by-side evaluation, cash-flow projections, and unvarnished builder trade-offs.
              </p>
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Date Prepared</span>
              <div className="text-sm font-extrabold text-slate-800 dark:text-zinc-200">{consultation.date}</div>
              <span className="text-[10px] text-slate-400">Prepared for: {consultation.buyerName}</span>
            </div>
          </div>

          {/* Search Criteria Tags */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">Target Area</div>
              <div className="font-extrabold text-sm text-slate-800 dark:text-zinc-100 mt-0.5">
                {consultation.targetSector || 'Noida / Greater Noida'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">Configuration</div>
              <div className="font-extrabold text-sm text-slate-800 dark:text-zinc-100 mt-0.5">
                {consultation.targetBhk || '3 BHK Layout'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">Budget Bracket</div>
              <div className="font-extrabold text-sm text-slate-800 dark:text-zinc-100 mt-0.5">
                {consultation.budgetLabel || '₹1.5 - 3.0 Cr'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">Shortlisted Homes</div>
              <div className="font-extrabold text-sm text-slate-800 dark:text-zinc-100 mt-0.5">
                {projects.length} Verified Project{projects.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </section>

        {/* Shortlisted Projects Cards */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
              1. Shortlisted Projects Overview
            </h2>
            <span className="text-xs text-slate-500">Cross-verified against Authority & RERA records</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map(p => (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {/* Omitted when we hold no builder row — an empty eyebrow
                          is better than a label asserting a check we never ran. */}
                      {p.builderName && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {p.builderName}
                        </span>
                      )}
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-0.5">{p.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <MapPin size={12} />
                        <span>Sector {p.sector}, Noida</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {p.status === 'ready_to_move' ? 'Ready to Move' : 'Under Construction'}
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800/80 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Price Band:</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">{p.priceRangeLabel || `₹${p.priceMinCr} Cr+`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Possession:</span>
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">{p.possessionLabel || 'As per RERA'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/70 dark:bg-zinc-800/40 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Est. True Landed Cost:</span>
                  <span className="font-black text-slate-900 dark:text-white">₹{p.financials.landedCostCr} Cr</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* The Unvarnished Truth: "The Good" vs "The Bad" */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
              2. The Unvarnished Truth: Pros vs Forensic Red Flags
            </h2>
            <span className="text-xs text-slate-500">Zero brochure marketing — 100% ground reality</span>
          </div>

          <div className="space-y-6">
            {projects.map(p => (
              <div
                key={`truth-${p.id}`}
                className="rounded-3xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <h3 className="font-black text-base text-slate-900 dark:text-white">{p.name}</h3>
                  <span className="text-xs text-slate-500 font-medium">Sector {p.sector}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* The Good */}
                  <div className="rounded-2xl p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-2.5">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
                      <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <span>The Good (Verified Advantages)</span>
                    </div>
                    <ul className="space-y-2 text-xs text-emerald-900/90 dark:text-emerald-200/90">
                      {p.strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold">•</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* The Bad / Red Flags */}
                  <div className="rounded-2xl p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
                      <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                      <span>Red Flags & Cautions (Forensic Audit)</span>
                    </div>
                    <ul className="space-y-2 text-xs text-amber-900/90 dark:text-amber-200/90">
                      {p.redFlags.map((flag, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Financial Reality & Monthly Outflow Comparison */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
              3. Financial Outflow & Tax Shield Analysis
            </h2>
            <span className="text-xs text-slate-500">Benchmark: 80% Loan @ 8.5% over 20 Years</span>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-zinc-800/70 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Project</th>
                  <th className="p-4">Base Price</th>
                  <th className="p-4">True Landed Cost</th>
                  <th className="p-4">Downpayment (20%)</th>
                  <th className="p-4">Standard Bank EMI</th>
                  <th className="p-4">Tax Relief (Sec 24b)</th>
                  <th className="p-4 font-black text-emerald-600">Net Monthly Outflow</th>
                  <th className="p-4">Min. Safe Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {projects.map(p => (
                  <tr key={`fin-${p.id}`} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                    <td className="p-4 font-bold text-slate-900 dark:text-white">{p.name}</td>
                    <td className="p-4 text-slate-600 dark:text-zinc-300">₹{p.financials.basePriceCr} Cr</td>
                    <td className="p-4 font-bold text-slate-800 dark:text-zinc-100">₹{p.financials.landedCostCr} Cr</td>
                    <td className="p-4 text-slate-600 dark:text-zinc-300">₹{p.financials.downpaymentCr} Cr</td>
                    <td className="p-4 text-slate-700 dark:text-zinc-300">{inr(p.financials.standardEmi)}/mo</td>
                    <td className="p-4 text-emerald-600 dark:text-emerald-400 font-semibold">- {inr(p.financials.taxShieldMonthly)}/mo</td>
                    <td className="p-4 font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20">
                      {inr(p.financials.netMonthlyEmi)}/mo
                    </td>
                    <td className="p-4 font-semibold text-slate-800 dark:text-zinc-200">
                      {inr(p.financials.safeMonthlyIncome)}/mo
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Site-Visit & Negotiation Checklist */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
              4. Family Site-Visit & Sales Desk Checklist
            </h2>
            <span className="text-xs text-slate-500">Print and take these specific questions with you</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map(p => (
              <div
                key={`checklist-${p.id}`}
                className="rounded-3xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{p.name} Checklist</h3>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">On-Site Questions</span>
                </div>
                <div className="space-y-2.5">
                  {p.siteVisitChecklist.map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-slate-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer / Disclaimer */}
        <footer className="pt-8 border-t border-slate-200 dark:border-zinc-800 text-center space-y-2 text-xs text-slate-500 dark:text-zinc-400">
          <p>
            Generated by <strong>PropFyndr Private Advisory Engine</strong>. Data derived from UP RERA registrations, Noida/Greater Noida Authority challans, and developer cost sheets.
          </p>
          <p className="text-[11px] text-slate-400">
            For personal family consultation use only. Not legal advice.
          </p>
        </footer>
      </main>
    </div>
  )
}
