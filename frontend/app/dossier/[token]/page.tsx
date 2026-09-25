'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Printer,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ShieldCheck,
  MapPin,
  Calendar,
  Copy,
  Check,
  MessageSquare,
  Home,
  ExternalLink,
  Info,
  CheckSquare,
  Square,
  Lock,
  Award,
  Wallet,
  Compass,
  ArrowRight,
  GitCompare,
  Heart,
  Flag,
  HelpCircle,
  Droplets,
  Scale,
} from 'lucide-react'
import { API_BASE } from '@/lib/env'

interface ConsultationStep {
  step: number
  sectorOrTopic: string
  userQuestion: string
  groundRealityVerdict: string
  badge?: 'SECTOR_PIVOT' | 'LEGAL_CHECK' | 'BUDGET_TEST' | 'WATER_AUDIT' | 'VERTICAL_TRANSIT' | 'PROJECT_DEEP_DIVE'
}

interface TradeOffDilemma {
  optionA: { name: string; advantage: string; drawback: string }
  optionB: { name: string; advantage: string; drawback: string }
  verdictRecommendation: string
}

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
  financials: DossierFinancials | null
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
    searchEvolutionSummary?: string
  }
  consultationTrail?: ConsultationStep[]
  tradeOffDilemma?: TradeOffDilemma | null
  projects: DossierProject[]
  familyReactions?: Record<string, { likes: number; concerns: string[] }>
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

const cleanSectorName = (s?: string) => {
  if (!s) return 'Noida / Greater Noida'
  return s.replace(/^Sector\s+Sector\b/i, 'Sector').trim()
}

export default function DossierPage({ params }: { params?: { token?: string } }) {
  const routerParams = useParams<{ token: string }>()
  const token = routerParams?.token || params?.token

  const [dossier, setDossier] = useState<FamilyDossier | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedProjectChecklist, setCopiedProjectChecklist] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  // Family Reaction States
  const [reactions, setReactions] = useState<Record<string, { likes: number; concerns: string[] }>>({})
  const [activeConcernInput, setActiveConcernInput] = useState<string | null>(null)
  const [concernText, setConcernText] = useState('')

  useEffect(() => {
    async function fetchDossier() {
      if (!token) return
      try {
        const res = await fetch(`${API_BASE}/dossier/${token}`)
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Dossier link not found or expired' : 'Failed to load consultation dossier')
        }
        const data = await res.json()
        setDossier(data.dossier)
        if (data.dossier?.familyReactions) {
          setReactions(data.dossier.familyReactions)
        }
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
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  const handleShareWhatsApp = () => {
    if (typeof window !== 'undefined' && dossier) {
      const pNames = dossier.projects.map(p => p.name).join(' & ')
      const trailBullets = (dossier.consultationTrail || [])
        .slice(0, 3)
        .map(s => `• *${s.sectorOrTopic}:* ${s.userQuestion} ➔ ${s.groundRealityVerdict}`)
        .join('\n')

      const projectSummary = dossier.projects
        .map(p => `• *${p.name}*${p.sector ? ` (${/^sector/i.test(p.sector) ? p.sector : `Sector ${p.sector}`})` : ''}: ${p.priceRangeLabel || (p.priceMinCr ? `₹${p.priceMinCr} Cr+` : 'Price on request')} ${p.financials ? ` | Landed ₹${p.financials.landedCostCr} Cr | Net EMI ${inr(p.financials.netMonthlyEmi)}/mo` : ''}`)
        .join('\n')

      const text = `🏡 *PropFyndr Family Deal Dossier — Executive Briefing*

${dossier.consultation.searchEvolutionSummary ? `📋 *Consultation Strategy:* ${dossier.consultation.searchEvolutionSummary}\n` : ''}
${trailBullets ? `🔍 *Consultation Trail:*\n${trailBullets}\n` : ''}
🏆 *Shortlisted Contenders:*\n${projectSummary}

⚠️ *Key Caution:* ${dossier.projects.flatMap(p => p.redFlags.map(f => `${p.name}: ${f}`))[0] ?? 'Verify Authority dues and RERA status before paying any token amount.'}

📄 *View Full Confidential Family Memo, Financials & Site Checklists:*
👉 ${window.location.href}`

      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleReact = async (projectId: string, reactionType: 'LIKE' | 'CONCERN', note?: string) => {
    const before = reactions
    setReactions(prev => {
      const curr = prev[projectId] || { likes: 0, concerns: [] }
      if (reactionType === 'LIKE') {
        return { ...prev, [projectId]: { ...curr, likes: curr.likes + 1 } }
      } else {
        const text = note && note.trim().length > 0 ? note.trim() : 'Family flagged for review'
        return { ...prev, [projectId]: { ...curr, concerns: [...curr.concerns, text] } }
      }
    })

    if (reactionType === 'CONCERN') {
      setActiveConcernInput(null)
      setConcernText('')
    }

    // Optimistic, but never left standing if the server refused it — a
    // reaction the family sees here and nobody else ever will is worse than none.
    try {
      const res = await fetch(`${API_BASE}/dossier/${token}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, reactionType, note }),
      })
      const data = res.ok ? await res.json().catch(() => null) : null
      if (data?.familyReactions) setReactions(data.familyReactions)
      else setReactions(before)
    } catch (err) {
      console.warn('Failed to record reaction on server:', err)
      setReactions(before)
    }
  }

  const copyChecklistForProject = (project: DossierProject) => {
    if (typeof window !== 'undefined') {
      const questions = project.siteVisitChecklist.map((q, idx) => `${idx + 1}. ${q}`).join('\n')
      const text = `📋 ${project.name} (Sector ${project.sector}) — Site Visit Checklist:\n\n${questions}\n\nVia PropFyndr Deal Dossier: ${window.location.href}`
      navigator.clipboard.writeText(text)
      setCopiedProjectChecklist(project.id)
      setTimeout(() => setCopiedProjectChecklist(null), 2500)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-[22px] bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <ShieldCheck size={30} className="text-[#0066cc] dark:text-[#2997ff]" />
          </div>
          <div className="absolute inset-0 rounded-[22px] border-2 border-[#0066cc] border-t-transparent animate-spin" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
          Aggregating Family Deal Dossier...
        </h2>
        <p className="text-sm text-[#86868b] mt-1.5 max-w-sm leading-relaxed">
          Loading consultation trail, forensic audit findings, and institutional cash-flow projections
        </p>
      </div>
    )
  }

  if (error || !dossier) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-[22px] bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-5 shadow-xs">
          <AlertTriangle size={30} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
          Dossier Unavailable
        </h2>
        <p className="text-sm text-[#86868b] mt-2 max-w-md leading-relaxed">
          {error || 'This consultation dossier link may have expired or is invalid.'}
        </p>
        <Link
          href="/chat"
          className="mt-6 px-5 py-2.5 bg-[#0066cc] hover:bg-[#0071e3] text-white rounded-full font-medium text-sm transition active:scale-[0.98] shadow-xs"
        >
          Start New Property Consultation
        </Link>
      </div>
    )
  }

  const { consultation, projects, consultationTrail, tradeOffDilemma } = dossier
  const targetAreaDisplay = cleanSectorName(consultation.targetSector)

  // Layout columns adapt seamlessly whether there are 1, 2, 3, or 4 projects
  const gridColumnsClass =
    projects.length === 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : projects.length === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] selection:bg-[#0066cc] selection:text-white print:bg-white print:text-black font-sans transition-colors">
      {/* ── Top Floating Action Bar (Sticky Apple Frosted Glass Header) ── */}
      <header className="sticky top-0 z-50 bg-white/85 dark:bg-[#161617]/85 backdrop-blur-xl border-b border-[#e5e5ea] dark:border-[#2c2c2e] px-4 sm:px-8 py-3 print:hidden transition-colors">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Eyebrow */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-[#0066cc] text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                <Building2 size={16} />
              </div>
              <span className="font-semibold text-base tracking-tight text-[#1d1d1f] dark:text-white">
                PropFyndr
              </span>
            </Link>
            <div className="h-4 w-[1px] bg-[#e5e5ea] dark:bg-[#2c2c2e] hidden sm:block" />
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] border border-[#e5e5ea] dark:border-[#38383a] text-[11px] font-medium">
              <ShieldCheck size={12} className="text-[#0066cc] dark:text-[#2997ff]" />
              <span>Verified Family Deal Dossier</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="px-3.5 py-1.5 rounded-full border border-[#d2d2d7] dark:border-[#38383a] bg-white dark:bg-[#1c1c1e] hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5 transition active:scale-[0.98] cursor-pointer shadow-2xs"
              title="Print letterhead or save to PDF"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <button
              onClick={handleCopyLink}
              type="button"
              className={`px-3.5 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition active:scale-[0.98] cursor-pointer shadow-2xs ${
                copiedLink
                  ? 'bg-[#34c759]/10 border-[#34c759]/30 text-[#28a745] dark:text-[#30d158]'
                  : 'border-[#d2d2d7] dark:border-[#38383a] bg-white dark:bg-[#1c1c1e] hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7]'
              }`}
            >
              {copiedLink ? <Check size={13} className="text-[#28a745] dark:text-[#30d158]" /> : <Copy size={13} />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              type="button"
              className="px-3.5 py-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-medium flex items-center gap-1.5 transition active:scale-[0.98] shadow-xs cursor-pointer"
            >
              <Share2 size={13} />
              <span>WhatsApp</span>
            </button>

            <Link
              href="/chat"
              className="px-3.5 py-1.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium flex items-center gap-1.5 transition active:scale-[0.98] shadow-xs ml-1"
            >
              <MessageSquare size={13} />
              <span className="hidden sm:inline">Return to Chat</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8 print:p-0 print:space-y-6">

        {/* ── HERO: Executive Dossier Briefing Letterhead (Apple Aesthetic) ── */}
        <section className="relative overflow-hidden rounded-[24px] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] border border-[#e5e5ea] dark:border-[#2c2c2e] shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-none p-6 sm:p-10 print:border-none print:shadow-none print:p-0">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-8 border-b border-[#e5e5ea] dark:border-[#2c2c2e] print:border-black/20">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-[#e5e5ea] dark:border-[#38383a] text-[#86868b] text-[11px] font-medium uppercase tracking-wider mb-3 print:border-black/30 print:text-black">
                <Lock size={12} className="text-[#0066cc] dark:text-[#2997ff] print:text-black" />
                <span>Confidential Due-Diligence Briefing</span>
                <span>&bull;</span>
                <span className="font-mono text-[#1d1d1f] dark:text-white print:text-black">
                  REF #{(token || dossier.token).slice(0, 8).toUpperCase()}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-semibold tracking-[-0.025em] text-[#1d1d1f] dark:text-white print:text-black">
                Family Property Consultation Dossier
              </h1>
              <p className="text-sm sm:text-base text-[#86868b] dark:text-[#a1a1a6] mt-2 max-w-2xl leading-relaxed print:text-slate-700">
                Independent forensic audit, side-by-side true landed cost breakdown, and unvarnished builder cautions compiled for family alignment.
              </p>
            </div>

            <div className="bg-[#fafafc] dark:bg-[#242426] rounded-2xl p-4 border border-[#e5e5ea] dark:border-[#38383a] print:bg-transparent print:border-none shrink-0 min-w-[210px]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Date Prepared</div>
              <div className="text-sm font-semibold text-[#1d1d1f] dark:text-white print:text-black mt-0.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-[#0066cc] dark:text-[#2997ff] print:text-black" />
                <span>{consultation.date}</span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-[#e5e5ea] dark:border-[#38383a] print:border-slate-300">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Prepared For</div>
                <div className="text-xs font-semibold text-[#0066cc] dark:text-[#2997ff] print:text-black truncate mt-0.5">
                  {consultation.buyerName || 'Your Family'}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Executive Scope Metric Cards */}
          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-8">
            <div className="p-4 rounded-2xl bg-[#fafafc] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] print:border-slate-300 print:bg-slate-50 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] shrink-0 mt-0.5 print:bg-transparent print:text-black">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#86868b]">Target Area</span>
                <div className="text-sm font-semibold text-[#1d1d1f] dark:text-white print:text-black truncate mt-0.5">
                  {targetAreaDisplay}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#fafafc] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] print:border-slate-300 print:bg-slate-50 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5 print:bg-transparent print:text-black">
                <Home size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#86868b]">Configuration</span>
                <div className="text-sm font-semibold text-[#1d1d1f] dark:text-white print:text-black truncate mt-0.5">
                  {consultation.targetBhk || 'Not specified'}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#fafafc] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] print:border-slate-300 print:bg-slate-50 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#34c759]/10 text-[#28a745] dark:text-[#30d158] shrink-0 mt-0.5 print:bg-transparent print:text-black">
                <Wallet size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#86868b]">Budget Bracket</span>
                <div className="text-sm font-semibold text-[#1d1d1f] dark:text-white print:text-black truncate mt-0.5">
                  {consultation.budgetLabel || '₹1.5 - 3.0 Cr'}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#fafafc] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] print:border-slate-300 print:bg-slate-50 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#ff9500]/10 text-[#ff9500] dark:text-[#ff9f0a] shrink-0 mt-0.5 print:bg-transparent print:text-black">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#86868b]">Shortlisted Homes</span>
                <div className="text-sm font-semibold text-[#1d1d1f] dark:text-white print:text-black truncate mt-0.5">
                  {projects.length} Verified Projects
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CONSULTATION TRAIL: Stepped Narrative Memory ── */}
        {consultationTrail && consultationTrail.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center text-[11px] font-bold">★</span>
                <h2 className="text-base sm:text-lg font-semibold tracking-tight uppercase text-[#1d1d1f] dark:text-white">
                  Consultation Trail: Questions Raised & Verified Findings
                </h2>
              </div>
              <span className="text-xs text-[#86868b] font-normal">Chronological record of your specific conversation queries</span>
            </div>

            {/* Executive Search Evolution Summary Callout */}
            {consultation.searchEvolutionSummary && (
              <div className="p-4 sm:p-5 rounded-[20px] bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center shrink-0 mt-0.5">
                  <Compass size={18} />
                </div>
                <div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#86868b]">Search Strategy & Evolution</span>
                  <p className="text-xs sm:text-sm text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5 leading-relaxed font-normal">
                    {consultation.searchEvolutionSummary}
                  </p>
                </div>
              </div>
            )}

            {/* Stepped Timeline Cards */}
            <div className="space-y-3">
              {consultationTrail.map(step => {
                const isPivot = step.badge === 'SECTOR_PIVOT'
                const isLegal = step.badge === 'LEGAL_CHECK'
                const isWater = step.badge === 'WATER_AUDIT'
                const isBudget = step.badge === 'BUDGET_TEST'

                let badgeColor = 'bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#86868b] border-[#e5e5ea] dark:border-[#38383a]'
                let badgeLabel = step.sectorOrTopic

                if (isPivot) {
                  badgeColor = 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                  badgeLabel = 'Strategic Sector Pivot'
                } else if (isLegal) {
                  badgeColor = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  badgeLabel = 'Legal & Registry Check'
                } else if (isWater) {
                  badgeColor = 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  badgeLabel = 'Water TDS & Supply Audit'
                } else if (isBudget) {
                  badgeColor = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  badgeLabel = 'Budget & Outflow Assessment'
                }

                return (
                  <div
                    key={step.step}
                    className={`rounded-[18px] border transition-all p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                      isPivot
                        ? 'bg-purple-50/20 dark:bg-purple-950/10 border-purple-200/80 dark:border-purple-900/40'
                        : 'bg-white dark:bg-[#1c1c1e] border-[#e5e5ea] dark:border-[#2c2c2e] shadow-[0_2px_10px_rgba(0,0,0,0.02)]'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 flex-1">
                      <div className="w-7 h-7 rounded-full bg-[#0066cc] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {step.step}
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-xs text-[#1d1d1f] dark:text-white uppercase tracking-wider">
                            {step.sectorOrTopic}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-[#1d1d1f] dark:text-[#f5f5f7] font-medium leading-relaxed">
                          <span className="text-[#86868b] mr-1">You Asked:</span>
                          &ldquo;{step.userQuestion}&rdquo;
                        </div>
                      </div>
                    </div>

                    <div className="sm:max-w-md bg-[#fafafc] dark:bg-[#242426] p-3 rounded-xl border border-[#e5e5ea] dark:border-[#38383a] shrink-0 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-[#0066cc] dark:text-[#2997ff] text-[10.5px] uppercase tracking-wider mb-1">
                        <CheckCircle2 size={13} className="shrink-0 text-[#28a745] dark:text-[#30d158]" />
                        <span>Ground Reality Finding</span>
                      </div>
                      <p className="text-xs text-[#515154] dark:text-[#a1a1a6] leading-relaxed">
                        {step.groundRealityVerdict}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── THE FORK IN THE ROAD: Central Trade-Off Dilemma ── */}
        {tradeOffDilemma && (
          <section className="rounded-[20px] border border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e5e5ea] dark:border-[#2c2c2e]">
              <div className="flex items-center gap-2">
                <GitCompare size={16} className="text-[#0066cc] dark:text-[#2997ff]" />
                <h3 className="font-semibold text-sm sm:text-base text-[#1d1d1f] dark:text-white">
                  The Central Trade-Off: Weighing Key Priorities
                </h3>
              </div>
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#86868b]">Core Decision Point</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A */}
              <div className="p-4 rounded-2xl bg-[#fafafc] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-[#1d1d1f] dark:text-white uppercase tracking-wider">
                    {tradeOffDilemma.optionA.name}
                  </h4>
                  <span className="text-[10px] font-medium text-[#86868b] uppercase">Option 1</span>
                </div>
                <div className="text-xs space-y-1.5">
                  <div className="text-[#28a745] dark:text-[#30d158] flex items-start gap-1.5">
                    <span className="font-bold shrink-0 mt-0.5">&bull;</span>
                    <span><strong>Advantage:</strong> {tradeOffDilemma.optionA.advantage}</span>
                  </div>
                  <div className="text-[#d97706] dark:text-[#ff9f0a] flex items-start gap-1.5">
                    <span className="font-bold shrink-0 mt-0.5">&bull;</span>
                    <span><strong>Compromise:</strong> {tradeOffDilemma.optionA.drawback}</span>
                  </div>
                </div>
              </div>

              {/* Option B */}
              <div className="p-4 rounded-2xl bg-[#fafafc] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-[#1d1d1f] dark:text-white uppercase tracking-wider">
                    {tradeOffDilemma.optionB.name}
                  </h4>
                  <span className="text-[10px] font-medium text-[#86868b] uppercase">Option 2</span>
                </div>
                <div className="text-xs space-y-1.5">
                  <div className="text-[#28a745] dark:text-[#30d158] flex items-start gap-1.5">
                    <span className="font-bold shrink-0 mt-0.5">&bull;</span>
                    <span><strong>Advantage:</strong> {tradeOffDilemma.optionB.advantage}</span>
                  </div>
                  <div className="text-[#d97706] dark:text-[#ff9f0a] flex items-start gap-1.5">
                    <span className="font-bold shrink-0 mt-0.5">&bull;</span>
                    <span><strong>Compromise:</strong> {tradeOffDilemma.optionB.drawback}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0066cc]/5 dark:bg-[#0066cc]/10 border border-[#0066cc]/20 text-xs text-[#0066cc] dark:text-[#2997ff] flex items-center gap-2">
              <Scale size={16} className="shrink-0" />
              <span><strong>Family Alignment Verdict:</strong> {tradeOffDilemma.verdictRecommendation}</span>
            </div>
          </section>
        )}

        {/* ── SECTION 1: Shortlisted Projects Showcase ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center text-[11px] font-bold">1</span>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight uppercase text-[#1d1d1f] dark:text-white">
                Shortlisted Projects Overview
              </h2>
            </div>
            <span className="text-xs text-[#86868b] font-normal">Cross-verified against Authority & UP RERA filings</span>
          </div>

          <div className={`grid ${gridColumnsClass} gap-5`}>
            {projects.map(p => {
              const isReady = p.status === 'ready_to_move'
              const pReactions = reactions[p.id] || { likes: 0, concerns: [] }

              return (
                <div
                  key={p.id}
                  className="rounded-[20px] border border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                >
                  <div>
                    {/* Card Cover Header with Architectural Background or Image */}
                    <div className="relative aspect-[16/10] w-full bg-[#f5f5f7] dark:bg-[#2c2c2e] overflow-hidden">
                      {p.heroImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.heroImageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 text-slate-400">
                          <Building2 size={32} />
                        </div>
                      )}

                      {/* Scrim Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      {/* Inner Ring Hairline */}
                      <div className="absolute inset-0 ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-t-[20px] pointer-events-none" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                        {p.builderName ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-white/90 dark:bg-black/75 backdrop-blur-md text-[#1d1d1f] dark:text-white text-[10.5px] font-medium border border-black/5 dark:border-white/10 shadow-2xs">
                            {p.builderName}
                          </span>
                        ) : <div />}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md shadow-2xs ${
                            isReady
                              ? 'bg-[#34c759]/90 text-white'
                              : 'bg-[#0066cc]/90 text-white'
                          }`}
                        >
                          {isReady ? 'Ready to Move' : 'Under Construction'}
                        </span>
                      </div>

                      {/* Bottom Title on Image */}
                      <div className="absolute bottom-3 left-3.5 right-3.5">
                        <h3 className="font-semibold text-lg sm:text-xl text-white tracking-tight drop-shadow-xs">
                          {p.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-200 mt-0.5">
                          <MapPin size={12} className="text-[#2997ff] shrink-0" />
                          <span>Sector {p.sector}, Greater Noida West</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial & Possession Details */}
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="grid grid-cols-2 gap-2.5 pb-3 border-b border-[#e5e5ea] dark:border-[#2c2c2e] text-xs">
                        <div className="p-2.5 rounded-xl bg-[#fafafc] dark:bg-[#242426]">
                          <span className="text-[10px] font-semibold uppercase text-[#86868b]">Base Price Band</span>
                          <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-sm mt-0.5">
                            {p.priceRangeLabel || `₹${p.priceMinCr} Cr+`}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#fafafc] dark:bg-[#242426]">
                          <span className="text-[10px] font-semibold uppercase text-[#86868b]">Possession</span>
                          <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-sm mt-0.5">
                            {p.possessionLabel || 'As per RERA'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <div>
                          <span className="text-[#86868b] font-medium">Est. True Landed Cost:</span>
                          <span className="text-[10px] text-[#86868b] block">(All taxes, dues, registry)</span>
                        </div>
                        <span className="text-base font-bold text-[#1d1d1f] dark:text-white">
                          {p.financials ? `₹${p.financials.landedCostCr} Cr` : 'Price not on record'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Family Feedback Reactions Strip */}
                  <div className="px-4 sm:px-5 py-2.5 bg-[#fafafc] dark:bg-[#242426]/40 border-t border-[#e5e5ea] dark:border-[#2c2c2e] flex flex-wrap items-center justify-between gap-2 text-xs print:hidden">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReact(p.id, 'LIKE')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition active:scale-95 cursor-pointer shadow-2xs ${
                          pReactions.likes > 0
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                            : 'border-[#d2d2d7] dark:border-[#38383a] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7]'
                        }`}
                        title="Align family approval"
                      >
                        <Heart size={13} className={pReactions.likes > 0 ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} />
                        <span>{pReactions.likes > 0 ? `${pReactions.likes} Aligned` : 'Family Like'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveConcernInput(activeConcernInput === p.id ? null : p.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition active:scale-95 cursor-pointer shadow-2xs ${
                          pReactions.concerns.length > 0
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                            : 'border-[#d2d2d7] dark:border-[#38383a] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7]'
                        }`}
                        title="Flag caution or question for family"
                      >
                        <Flag size={13} className={pReactions.concerns.length > 0 ? 'fill-amber-500 text-amber-500' : 'text-slate-400'} />
                        <span>{pReactions.concerns.length > 0 ? `${pReactions.concerns.length} Flagged` : 'Flag Caution'}</span>
                      </button>
                    </div>

                    {pReactions.concerns.length > 0 && (
                      <span className="text-[10.5px] text-[#86868b] truncate max-w-[180px]">
                        ⚠️ {pReactions.concerns[pReactions.concerns.length - 1]}
                      </span>
                    )}
                  </div>

                  {/* Inline Concern Input Drawer */}
                  {activeConcernInput === p.id && (
                    <div className="p-3 bg-[#f5f5f7] dark:bg-[#2c2c2e] border-t border-[#e5e5ea] dark:border-[#38383a] flex items-center gap-2 print:hidden">
                      <input
                        type="text"
                        placeholder="e.g. Spouse concerned about TDS or possession"
                        value={concernText}
                        onChange={e => setConcernText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleReact(p.id, 'CONCERN', concernText)
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-[#d2d2d7] dark:border-[#38383a] bg-white dark:bg-[#1c1c1e] text-xs text-[#1d1d1f] dark:text-white outline-none focus:border-[#0066cc]"
                      />
                      <button
                        type="button"
                        onClick={() => handleReact(p.id, 'CONCERN', concernText)}
                        className="px-3 py-1.5 rounded-lg bg-[#0066cc] text-white text-xs font-semibold hover:bg-[#0071e3] transition active:scale-95 cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  )}

                  {/* Card Footer Action */}
                  <div className="p-3.5 px-4 sm:px-5 bg-[#fafafc] dark:bg-[#242426]/60 border-t border-[#e5e5ea] dark:border-[#2c2c2e] flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-[10px] font-semibold uppercase text-[#86868b]">Net Monthly EMI</span>
                      <div className="font-bold text-sm text-[#28a745] dark:text-[#30d158]">
                        {p.financials ? `${inr(p.financials.netMonthlyEmi)}/mo` : 'Price not on record'}
                      </div>
                    </div>

                    <a
                      href={`/property/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full bg-white dark:bg-[#1c1c1e] hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] text-[#0066cc] dark:text-[#2997ff] border border-[#d2d2d7] dark:border-[#38383a] text-xs font-medium flex items-center gap-1.5 transition active:scale-[0.98] shadow-2xs group-hover:border-[#0066cc]/40"
                    >
                      <span>Explore</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── SECTION 2: The Unvarnished Truth (Pros vs Forensic Red Flags) ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#34c759] text-white flex items-center justify-center text-[11px] font-bold">2</span>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight uppercase text-[#1d1d1f] dark:text-white">
                The Unvarnished Truth: Pros vs Forensic Red Flags
              </h2>
            </div>
            <span className="text-xs text-[#86868b] font-normal">Zero sales-brochure claims &bull; 100% ground reality audit</span>
          </div>

          <div className="space-y-4">
            {projects.map(p => (
              <div
                key={`truth-${p.id}`}
                className="rounded-[20px] border border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none space-y-4"
              >
                {/* Project Header Banner */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e5e5ea] dark:border-[#2c2c2e]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center font-bold text-xs">
                      <Building2 size={15} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-[#1d1d1f] dark:text-white flex items-center gap-2">
                        <span>{p.name}</span>
                        {p.builderName && (
                          <span className="text-xs font-normal text-[#86868b]">by {p.builderName}</span>
                        )}
                      </h3>
                      <span className="text-xs text-[#86868b]">Sector {p.sector}, Greater Noida West</span>
                    </div>
                  </div>

                  <a
                    href={`/property/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-[#0066cc] dark:text-[#2997ff] hover:underline flex items-center gap-1"
                  >
                    <span>View Project Records</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                {/* 2-Column Pros vs Cons ("Not everything is a card" anti-nesting design) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Verified Advantages (The Good) */}
                  <div className="rounded-2xl p-4 sm:p-5 bg-[#34c759]/5 dark:bg-[#30d158]/5 border border-[#34c759]/20 space-y-2.5">
                    <div className="flex items-center gap-2 text-[#28a745] dark:text-[#30d158] font-semibold text-xs uppercase tracking-wider">
                      <CheckCircle2 size={15} className="shrink-0" />
                      <span>The Good (Verified Advantages)</span>
                    </div>
                    <ul className="space-y-2 text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {p.strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#34c759] dark:text-[#30d158] font-bold shrink-0 mt-0.5">&bull;</span>
                          <span className="leading-relaxed">{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Forensic Red Flags & Cautions (The Bad) */}
                  <div className="rounded-2xl p-4 sm:p-5 bg-[#ff9500]/5 dark:bg-[#ff9f0a]/5 border border-[#ff9500]/20 space-y-2.5">
                    <div className="flex items-center gap-2 text-[#d97706] dark:text-[#ff9f0a] font-semibold text-xs uppercase tracking-wider">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>Red Flags & Cautions (Forensic Audit)</span>
                    </div>
                    <ul className="space-y-2 text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {p.redFlags.map((flag, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#ff9500] dark:text-[#ff9f0a] font-bold shrink-0 mt-0.5">&bull;</span>
                          <span className="leading-relaxed">{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 3: Financial Outflow & Tax Shield Analysis ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold">3</span>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight uppercase text-[#1d1d1f] dark:text-white">
                Financial Outflow & Tax Shield Analysis
              </h2>
            </div>
            <span className="text-xs text-[#86868b] font-normal">Standard Lending Benchmark: 80% Loan @ 8.5% p.a. over 20 Years</span>
          </div>

          <div className="rounded-[20px] border border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left tabular-nums">
                <thead className="bg-[#fafafc] dark:bg-[#242426] border-b border-[#e5e5ea] dark:border-[#2c2c2e] text-[10.5px] font-semibold text-[#86868b] uppercase tracking-wider">
                  <tr>
                    <th className="p-4 pl-5">Project Name</th>
                    <th className="p-4">Base Price</th>
                    <th className="p-4">
                      <span>True Landed Cost</span>
                      <span className="block text-[9px] text-[#86868b] font-normal normal-case">(+28–30% Taxes/Dues)</span>
                    </th>
                    <th className="p-4">Downpayment (20%)</th>
                    <th className="p-4">Bank EMI (Gross)</th>
                    <th className="p-4 text-[#28a745] dark:text-[#30d158]">
                      <span>Sec 24(b) Relief</span>
                      <span className="block text-[9px] text-[#28a745]/80 dark:text-[#30d158]/80 font-normal normal-case">Monthly Tax Shield</span>
                    </th>
                    <th className="p-4 font-bold text-[#28a745] dark:text-[#30d158] bg-[#34c759]/5 dark:bg-[#30d158]/5">
                      Net Monthly Outflow
                    </th>
                    <th className="p-4 pr-5">Safe Take-Home Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5ea] dark:divide-[#2c2c2e] font-normal">
                  {projects.filter(p => p.financials).map(p => p.financials && (
                    <tr key={`fin-${p.id}`} className="hover:bg-[#fafafc] dark:hover:bg-[#242426]/50 transition">
                      <td className="p-4 pl-5 font-semibold text-[#1d1d1f] dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{p.name}</span>
                        </div>
                        <span className="text-[10px] text-[#86868b] font-normal">Sector {p.sector}</span>
                      </td>
                      <td className="p-4 text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
                        ₹{p.financials.basePriceCr} Cr
                      </td>
                      <td className="p-4 font-semibold text-[#1d1d1f] dark:text-white whitespace-nowrap">
                        ₹{p.financials.landedCostCr} Cr
                      </td>
                      <td className="p-4 text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
                        ₹{p.financials.downpaymentCr} Cr
                      </td>
                      <td className="p-4 text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
                        {inr(p.financials.standardEmi)}/mo
                      </td>
                      <td className="p-4 text-[#28a745] dark:text-[#30d158] font-semibold whitespace-nowrap">
                        - {inr(p.financials.taxShieldMonthly)}/mo
                      </td>
                      <td className="p-4 font-bold text-sm text-[#28a745] dark:text-[#30d158] bg-[#34c759]/5 dark:bg-[#30d158]/5 whitespace-nowrap">
                        {inr(p.financials.netMonthlyEmi)}/mo
                      </td>
                      <td className="p-4 pr-5 font-medium text-[#1d1d1f] dark:text-white whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-[#e5e5ea] dark:border-[#38383a] text-xs font-mono">
                          {inr(p.financials.safeMonthlyIncome)}/mo
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Guidance Footnote Callout */}
            <div className="p-4 bg-[#fafafc] dark:bg-[#242426] border-t border-[#e5e5ea] dark:border-[#2c2c2e] text-xs text-[#86868b] flex items-start gap-2.5">
              <Info size={16} className="text-[#0066cc] dark:text-[#2997ff] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-[#1d1d1f] dark:text-white font-medium">Methodology:</strong> True Landed Cost includes UP Stamp Duty (7%), GST (5%), IFMS, Electricity/Meter charges, and Registry documentation expenses. Net Monthly Outflow models Section 24(b) home loan interest deduction under the old tax regime (up to ₹2 Lakh annual relief). Safe Take-Home Salary adheres to the 40% debt-to-income prudence ceiling.
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4: Family Site-Visit & Negotiation Checklist ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#ff9500] text-white flex items-center justify-center text-[11px] font-bold">4</span>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight uppercase text-[#1d1d1f] dark:text-white">
                Family Site-Visit & Sales Desk Checklist
              </h2>
            </div>
            <span className="text-xs text-[#86868b] font-normal">Critical questions to ask before issuing any token cheque</span>
          </div>

          <div className={`grid ${gridColumnsClass} gap-5`}>
            {projects.map(p => {
              const isCopied = copiedProjectChecklist === p.id
              return (
                <div
                  key={`checklist-${p.id}`}
                  className="rounded-[20px] border border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[#e5e5ea] dark:border-[#2c2c2e]">
                      <div>
                        <h3 className="font-semibold text-sm text-[#1d1d1f] dark:text-white">{p.name}</h3>
                        <span className="text-[10px] text-[#86868b]">Sector {p.sector} Verification</span>
                      </div>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#d97706] dark:text-[#ff9f0a] bg-[#ff9500]/10 px-2 py-0.5 rounded-full border border-[#ff9500]/20">
                        {p.siteVisitChecklist.length} Questions
                      </span>
                    </div>

                    <div className="space-y-2.5 pt-4">
                      {p.siteVisitChecklist.map((item, idx) => {
                        const checkKey = `${p.id}-${idx}`
                        const isChecked = !!checkedItems[checkKey]
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleCheck(checkKey)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 text-xs select-none ${
                              isChecked
                                ? 'bg-[#34c759]/10 border-[#34c759]/30 text-[#1d1d1f]/60 dark:text-[#f5f5f7]/60 line-through'
                                : 'bg-[#fafafc] dark:bg-[#242426] border-[#e5e5ea] dark:border-[#38383a] text-[#1d1d1f] dark:text-[#f5f5f7] hover:border-[#0066cc]/40'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {isChecked ? (
                                <CheckSquare size={15} className="text-[#28a745] dark:text-[#30d158]" />
                              ) : (
                                <Square size={15} className="text-[#86868b]" />
                              )}
                            </div>
                            <span className="leading-relaxed">{item}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyChecklistForProject(p)}
                    className="mt-5 w-full py-2 px-3 rounded-full border border-[#d2d2d7] dark:border-[#38383a] bg-white dark:bg-[#1c1c1e] hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer shadow-2xs"
                  >
                    {isCopied ? (
                      <>
                        <Check size={13} className="text-[#28a745] dark:text-[#30d158]" />
                        <span className="text-[#28a745] dark:text-[#30d158]">Questions Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Questions for WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── FOOTER: Verification Seal & Legal Disclaimers (Apple Advisory Style) ── */}
        <footer className="pt-8 pb-12 border-t border-[#e5e5ea] dark:border-[#2c2c2e] text-center space-y-2 text-xs text-[#86868b]">
          <div className="flex items-center justify-center gap-2 font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
            <Award size={15} className="text-[#0066cc] dark:text-[#2997ff]" />
            <span>PropFyndr Private Advisory Intelligence Engine</span>
          </div>
          <p className="max-w-2xl mx-auto leading-relaxed text-[11px] text-[#86868b]">
            This executive briefing memo is produced for confidential due diligence by the buyer and their family. Data is aggregated from UP RERA quarterly filings, Noida / Greater Noida Authority dues registries, and developer schedule cost sheets. Not intended as an offer to sell or architectural warranty.
          </p>
          <div className="text-[10px] font-mono text-[#86868b]">
            Document Token: {token} &bull; Generated on {consultation.date}
          </div>
        </footer>

      </main>
    </div>
  )
}
