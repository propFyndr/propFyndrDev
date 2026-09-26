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
  FileText,
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
import { track } from '@/lib/analytics'

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
  landedMultiplier: number
  landedCostAssumed: boolean
  landedCostQualifier: string | null
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
  city: string
  builderName: string | null
  status: string
  possessionLabel: string | null
  priceRangeLabel: string | null
  priceMinCr: number | null
  reraNumber: string | null
  heroImageUrl: string | null
  strengths: string[]
  redFlags: string[]
  financials: DossierFinancials | null
  siteVisitChecklist: string[]
}

interface Dossier {
  token: string
  createdAt: string
  expiresAt: string
  consultation: {
    preparedFor?: string
    date: string
    areasCovered?: string
    targetBhk?: string
    budgetLabel?: string
    notes?: string
    searchEvolutionSummary?: string
  }
  consultationTrail?: ConsultationStep[]
  tradeOffDilemma?: TradeOffDilemma | null
  projects: DossierProject[]
  reactions?: Record<string, { likes: number; concerns: string[] }>
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

const sectorLabel = (s: string) => (/^sector\b/i.test(s.trim()) ? s.trim() : `Sector ${s.trim()}`)
const locationLabel = (p: { sector: string; city?: string }) => (p.city ? `${sectorLabel(p.sector)}, ${p.city}` : sectorLabel(p.sector))
const priceLabel = (p: DossierProject) => p.priceRangeLabel || (p.priceMinCr ? `From ₹${p.priceMinCr} Cr` : 'Price not on record')
const STATUS_LABEL: Record<string, string> = {
  ready_to_move: 'Ready to move',
  under_construction: 'Under construction',
  new_launch: 'New launch',
}

export default function DossierPage({ params }: { params?: { token?: string } }) {
  const routerParams = useParams<{ token: string }>()
  const token = routerParams?.token || params?.token

  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedProjectChecklist, setCopiedProjectChecklist] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  // Reactions from whoever holds the link
  const [reactions, setReactions] = useState<Record<string, { likes: number; concerns: string[] }>>({})
  const [activeConcernInput, setActiveConcernInput] = useState<string | null>(null)
  const [concernText, setConcernText] = useState('')

  useEffect(() => {
    async function fetchDossier() {
      if (!token) return
      try {
        const res = await fetch(`${API_BASE}/dossier/${token}`)
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'This dossier link was not found or has expired.' : 'The dossier could not be loaded. Try again in a moment.')
        }
        const data = await res.json()
        setDossier(data.dossier)
        if (data.dossier?.reactions) {
          setReactions(data.dossier.reactions)
        }
      } catch (err: any) {
        setError(err.message || 'The dossier could not be loaded.')
      } finally {
        setLoading(false)
      }
    }
    fetchDossier()
  }, [token])

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      track('dossier_shared', { channel: 'copy', surface: 'dossier_page' })
      navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  const handleShareWhatsApp = () => {
    if (typeof window !== 'undefined' && dossier) {
      track('dossier_shared', { channel: 'whatsapp', surface: 'dossier_page' })
      const trailBullets = (dossier.consultationTrail || [])
        .slice(0, 3)
        .map(s => `• ${s.userQuestion} — ${s.groundRealityVerdict}`)
        .join('\n')

      const projectSummary = dossier.projects
        .map(p => `• *${p.name}* (${locationLabel(p)}): ${priceLabel(p)}${p.financials ? ` | est. landed ₹${p.financials.landedCostCr} Cr${p.financials.landedCostAssumed ? ' (assumed)' : ''}` : ''}`)
        .join('\n')

      const firstCaution = dossier.projects.flatMap(p => p.redFlags.map(f => `${p.name}: ${f}`))[0]

      const text = [
        '*Property research — PropFyndr dossier*',
        dossier.consultation.searchEvolutionSummary || null,
        trailBullets ? `*Some of the questions asked:*\n${trailBullets}` : null,
        `*Projects:*\n${projectSummary}`,
        firstCaution ? `*One caution on record:* ${firstCaution}` : null,
        `Full dossier, costs and site-visit questions:\n${window.location.href}`,
      ].filter(Boolean).join('\n\n')

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
        const text = note && note.trim().length > 0 ? note.trim() : 'Flagged a concern'
        return { ...prev, [projectId]: { ...curr, concerns: [...curr.concerns, text] } }
      }
    })

    if (reactionType === 'CONCERN') {
      setActiveConcernInput(null)
      setConcernText('')
    }

    // Optimistic, but never left standing if the server refused it — a
    // reaction a visitor sees here and nobody else ever will is worse than none.
    try {
      const res = await fetch(`${API_BASE}/dossier/${token}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, reactionType, note }),
      })
      const data = res.ok ? await res.json().catch(() => null) : null
      if (data?.reactions) setReactions(data.reactions)
      else setReactions(before)
    } catch (err) {
      console.warn('Failed to record reaction on server:', err)
      setReactions(before)
    }
  }

  const copyChecklistForProject = (project: DossierProject) => {
    if (typeof window !== 'undefined') {
      const questions = project.siteVisitChecklist.map((q, idx) => `${idx + 1}. ${q}`).join('\n')
      const text = `${project.name} (${locationLabel(project)}) — questions to ask on a site visit:\n\n${questions}\n\nFrom a PropFyndr dossier: ${window.location.href}`
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
          Loading dossier
        </h2>
        <p className="text-sm text-[#86868b] mt-1.5 max-w-sm leading-relaxed">
          Questions, answers and project records
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
          Dossier unavailable
        </h2>
        <p className="text-sm text-[#86868b] mt-2 max-w-md leading-relaxed">
          {error || 'This dossier link may have expired or is invalid.'}
        </p>
        <Link
          href="/discover"
          className="mt-6 px-5 py-2.5 bg-[#0066cc] hover:bg-[#0071e3] text-white rounded-full font-medium text-sm transition active:scale-[0.98] shadow-xs"
        >
          Start your own search
        </Link>
      </div>
    )
  }

  const { consultation, projects, consultationTrail, tradeOffDilemma } = dossier
  const pricedProjects = projects.filter(p => p.financials)
  const anyAssumedLanded = pricedProjects.some(p => p.financials?.landedCostAssumed)

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
              <FileText size={12} className="text-[#0066cc] dark:text-[#2997ff]" />
              <span>Shared dossier</span>
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
              <span>{copiedLink ? 'Link copied' : 'Copy link'}</span>
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
              href="/discover"
              className="px-3.5 py-1.5 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-medium flex items-center gap-1.5 transition active:scale-[0.98] shadow-xs ml-1"
            >
              <MessageSquare size={13} />
              <span className="hidden sm:inline">Ask PropFyndr</span>
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
                <FileText size={12} className="text-[#0066cc] dark:text-[#2997ff] print:text-black" />
                <span>Property research dossier</span>
                <span>&bull;</span>
                <span className="font-mono text-[#1d1d1f] dark:text-white print:text-black">
                  REF #{(token || dossier.token).slice(0, 8).toUpperCase()}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-semibold tracking-[-0.025em] text-[#1d1d1f] dark:text-white print:text-black">
                What was asked, and what we found
              </h1>
              <p className="text-sm sm:text-base text-[#86868b] dark:text-[#a1a1a6] mt-2 max-w-2xl leading-relaxed print:text-slate-700">
                Every question from one PropFyndr conversation, the answers given, and what our records hold on each project looked at, including what counts against it.
              </p>
            </div>

            <div className="bg-[#fafafc] dark:bg-[#242426] rounded-2xl p-4 border border-[#e5e5ea] dark:border-[#38383a] print:bg-transparent print:border-none shrink-0 min-w-[210px]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Prepared on</div>
              <div className="text-sm font-semibold text-[#1d1d1f] dark:text-white print:text-black mt-0.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-[#0066cc] dark:text-[#2997ff] print:text-black" />
                <span>{consultation.date}</span>
              </div>
              {consultation.preparedFor && (
                <div className="mt-2.5 pt-2.5 border-t border-[#e5e5ea] dark:border-[#38383a] print:border-slate-300">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Prepared for</div>
                  <div className="text-xs font-semibold text-[#0066cc] dark:text-[#2997ff] print:text-black truncate mt-0.5">
                    {consultation.preparedFor}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4 Executive Scope Metric Cards */}
          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-8">
            <div className="p-4 rounded-2xl bg-[#fafafc] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] print:border-slate-300 print:bg-slate-50 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] shrink-0 mt-0.5 print:bg-transparent print:text-black">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#86868b]">Areas covered</span>
                <div className="text-sm font-semibold text-[#1d1d1f] dark:text-white print:text-black mt-0.5">
                  {consultation.areasCovered || 'Not stated'}
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
                  {consultation.targetBhk || 'Not stated'}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#fafafc] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] print:border-slate-300 print:bg-slate-50 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#34c759]/10 text-[#28a745] dark:text-[#30d158] shrink-0 mt-0.5 print:bg-transparent print:text-black">
                <Wallet size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#86868b]">Stated budget</span>
                <div className="text-sm font-semibold text-[#1d1d1f] dark:text-white print:text-black truncate mt-0.5">
                  {consultation.budgetLabel || 'Not stated'}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#fafafc] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] print:border-slate-300 print:bg-slate-50 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#ff9500]/10 text-[#ff9500] dark:text-[#ff9f0a] shrink-0 mt-0.5 print:bg-transparent print:text-black">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#86868b]">Projects looked at</span>
                <div className="text-sm font-semibold text-[#1d1d1f] dark:text-white print:text-black truncate mt-0.5">
                  {projects.length} {projects.length === 1 ? 'project' : 'projects'}
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
                  Questions asked, and the answers given
                </h2>
              </div>
              <span className="text-xs text-[#86868b] font-normal">In the order they were asked</span>
            </div>

            {/* Executive Search Evolution Summary Callout */}
            {consultation.searchEvolutionSummary && (
              <div className="p-4 sm:p-5 rounded-[20px] bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center shrink-0 mt-0.5">
                  <Compass size={18} />
                </div>
                <div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#86868b]">How the search went</span>
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
                  badgeLabel = 'Moved sector'
                } else if (isLegal) {
                  badgeColor = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  badgeLabel = 'Legal and registry'
                } else if (isWater) {
                  badgeColor = 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  badgeLabel = 'Water'
                } else if (isBudget) {
                  badgeColor = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  badgeLabel = 'Budget and costs'
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
                          <span className="text-[#86868b] mr-1">Asked:</span>
                          &ldquo;{step.userQuestion}&rdquo;
                        </div>
                      </div>
                    </div>

                    <div className="sm:max-w-md bg-[#fafafc] dark:bg-[#242426] p-3 rounded-xl border border-[#e5e5ea] dark:border-[#38383a] shrink-0 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-[#0066cc] dark:text-[#2997ff] text-[10.5px] uppercase tracking-wider mb-1">
                        <CheckCircle2 size={13} className="shrink-0 text-[#28a745] dark:text-[#30d158]" />
                        <span>Answer given</span>
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
                  The main trade-off weighed
                </h3>
              </div>
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#86868b]">From the conversation</span>
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
              <span><strong>The choice:</strong> {tradeOffDilemma.verdictRecommendation}</span>
            </div>
          </section>
        )}

        {/* ── SECTION 1: Shortlisted Projects Showcase ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center text-[11px] font-bold">1</span>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight uppercase text-[#1d1d1f] dark:text-white">
                Projects looked at
              </h2>
            </div>
            <span className="text-xs text-[#86868b] font-normal">From PropFyndr's records for each project</span>
          </div>

          <div className={`grid ${gridColumnsClass} gap-5`}>
            {projects.map(p => {
              const isReady = p.status === 'ready_to_move'
              const statusText = STATUS_LABEL[p.status]
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
                        {statusText ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md shadow-2xs ${
                              isReady
                                ? 'bg-[#34c759]/90 text-white'
                                : 'bg-[#0066cc]/90 text-white'
                            }`}
                          >
                            {statusText}
                          </span>
                        ) : <div />}
                      </div>

                      {/* Bottom Title on Image */}
                      <div className="absolute bottom-3 left-3.5 right-3.5">
                        <h3 className="font-semibold text-lg sm:text-xl text-white tracking-tight drop-shadow-xs">
                          {p.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-200 mt-0.5">
                          <MapPin size={12} className="text-[#2997ff] shrink-0" />
                          <span>{locationLabel(p)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial & Possession Details */}
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="grid grid-cols-2 gap-2.5 pb-3 border-b border-[#e5e5ea] dark:border-[#2c2c2e] text-xs">
                        <div className="p-2.5 rounded-xl bg-[#fafafc] dark:bg-[#242426]">
                          <span className="text-[10px] font-semibold uppercase text-[#86868b]">Base price</span>
                          <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-sm mt-0.5">
                            {priceLabel(p)}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#fafafc] dark:bg-[#242426]">
                          <span className="text-[10px] font-semibold uppercase text-[#86868b]">Possession</span>
                          <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-sm mt-0.5">
                            {p.possessionLabel || 'Not on record'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="text-[#86868b] font-medium">RERA</span>
                        <span className="font-mono text-[#1d1d1f] dark:text-[#f5f5f7]">{p.reraNumber || 'Not on record'}</span>
                      </div>

                      <div className="flex items-start justify-between gap-3 text-xs pt-0.5">
                        <div>
                          <span className="text-[#86868b] font-medium">Estimated landed cost</span>
                          <span className="text-[10px] text-[#86868b] block">
                            {p.financials?.landedCostQualifier ?? 'Stamp duty, registration, GST and charges'}
                          </span>
                        </div>
                        <span className="text-base font-bold text-[#1d1d1f] dark:text-white whitespace-nowrap">
                          {p.financials ? `₹${p.financials.landedCostCr} Cr${p.financials.landedCostAssumed ? '*' : ''}` : 'No price on record'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reactions strip */}
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
                        title="Like this project"
                      >
                        <Heart size={13} className={pReactions.likes > 0 ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} />
                        <span>{pReactions.likes > 0 ? `${pReactions.likes} ${pReactions.likes === 1 ? 'like' : 'likes'}` : 'Like'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveConcernInput(activeConcernInput === p.id ? null : p.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition active:scale-95 cursor-pointer shadow-2xs ${
                          pReactions.concerns.length > 0
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                            : 'border-[#d2d2d7] dark:border-[#38383a] bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7]'
                        }`}
                        title="Flag a concern about this project"
                      >
                        <Flag size={13} className={pReactions.concerns.length > 0 ? 'fill-amber-500 text-amber-500' : 'text-slate-400'} />
                        <span>{pReactions.concerns.length > 0 ? `${pReactions.concerns.length} ${pReactions.concerns.length === 1 ? 'concern' : 'concerns'}` : 'Flag a concern'}</span>
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
                        placeholder="e.g. Worried about the possession date"
                        aria-label={`Concern about ${p.name}`}
                        maxLength={100}
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
                      <span className="text-[10px] font-semibold uppercase text-[#86868b]">Est. net monthly EMI</span>
                      <div className="font-bold text-sm text-[#28a745] dark:text-[#30d158]">
                        {p.financials ? `${inr(p.financials.netMonthlyEmi)}/mo` : 'No price on record'}
                      </div>
                    </div>

                    <a
                      href={`/property/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full bg-white dark:bg-[#1c1c1e] hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] text-[#0066cc] dark:text-[#2997ff] border border-[#d2d2d7] dark:border-[#38383a] text-xs font-medium flex items-center gap-1.5 transition active:scale-[0.98] shadow-2xs group-hover:border-[#0066cc]/40"
                    >
                      <span>Project page</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── SECTION 2: On record, for and against ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#34c759] text-white flex items-center justify-center text-[11px] font-bold">2</span>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight uppercase text-[#1d1d1f] dark:text-white">
                What's on record, for and against
              </h2>
            </div>
            <span className="text-xs text-[#86868b] font-normal">From each project's own records. Nothing on record means not researched.</span>
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
                      <span className="text-xs text-[#86868b]">{locationLabel(p)}</span>
                    </div>
                  </div>

                  <a
                    href={`/property/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-[#0066cc] dark:text-[#2997ff] hover:underline flex items-center gap-1"
                  >
                    <span>Project page</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                {/* 2-Column Pros vs Cons ("Not everything is a card" anti-nesting design) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* In its favour */}
                  <div className="rounded-2xl p-4 sm:p-5 bg-[#34c759]/5 dark:bg-[#30d158]/5 border border-[#34c759]/20 space-y-2.5">
                    <div className="flex items-center gap-2 text-[#28a745] dark:text-[#30d158] font-semibold text-xs uppercase tracking-wider">
                      <CheckCircle2 size={15} className="shrink-0" />
                      <span>In its favour</span>
                    </div>
                    <ul className="space-y-2 text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {p.strengths.length === 0 && (
                        <li className="text-[#86868b] leading-relaxed">Nothing in its favour on record yet.</li>
                      )}
                      {p.strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#34c759] dark:text-[#30d158] font-bold shrink-0 mt-0.5">&bull;</span>
                          <span className="leading-relaxed">{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Against it */}
                  <div className="rounded-2xl p-4 sm:p-5 bg-[#ff9500]/5 dark:bg-[#ff9f0a]/5 border border-[#ff9500]/20 space-y-2.5">
                    <div className="flex items-center gap-2 text-[#d97706] dark:text-[#ff9f0a] font-semibold text-xs uppercase tracking-wider">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>Cautions</span>
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
                Cost and EMI estimates
              </h2>
            </div>
            <span className="text-xs text-[#86868b] font-normal">Assumes an 80% loan at 8.5% a year over 20 years</span>
          </div>

          <div className="rounded-[20px] border border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left tabular-nums">
                <thead className="bg-[#fafafc] dark:bg-[#242426] border-b border-[#e5e5ea] dark:border-[#2c2c2e] text-[10.5px] font-semibold text-[#86868b] uppercase tracking-wider">
                  <tr>
                    <th className="p-4 pl-5">Project</th>
                    <th className="p-4">Base price</th>
                    <th className="p-4">
                      <span>Est. landed cost</span>
                      <span className="block text-[9px] text-[#86868b] font-normal normal-case">(base × all-in multiplier)</span>
                    </th>
                    <th className="p-4">Down payment (20%)</th>
                    <th className="p-4">EMI (gross)</th>
                    <th className="p-4 text-[#28a745] dark:text-[#30d158]">
                      <span>Sec 24(b) relief</span>
                      <span className="block text-[9px] text-[#28a745]/80 dark:text-[#30d158]/80 font-normal normal-case">Monthly tax saving</span>
                    </th>
                    <th className="p-4 font-bold text-[#28a745] dark:text-[#30d158] bg-[#34c759]/5 dark:bg-[#30d158]/5">
                      Net monthly outflow
                    </th>
                    <th className="p-4 pr-5">Take-home needed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5ea] dark:divide-[#2c2c2e] font-normal">
                  {pricedProjects.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-5 text-[#86868b]">None of these projects has a price on record, so there is nothing to estimate.</td>
                    </tr>
                  )}
                  {pricedProjects.map(p => p.financials && (
                    <tr key={`fin-${p.id}`} className="hover:bg-[#fafafc] dark:hover:bg-[#242426]/50 transition">
                      <td className="p-4 pl-5 font-semibold text-[#1d1d1f] dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{p.name}</span>
                        </div>
                        <span className="text-[10px] text-[#86868b] font-normal">{locationLabel(p)}</span>
                      </td>
                      <td className="p-4 text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
                        ₹{p.financials.basePriceCr} Cr
                      </td>
                      <td className="p-4 font-semibold text-[#1d1d1f] dark:text-white whitespace-nowrap">
                        ₹{p.financials.landedCostCr} Cr{p.financials.landedCostAssumed ? '*' : ''}
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
                <strong className="text-[#1d1d1f] dark:text-white font-medium">How these are worked out:</strong> Landed cost is the lowest base price we hold × the project&apos;s recorded all-in cost multiplier (stamp duty, registration, GST and builder charges).
                {anyAssumedLanded && <> <strong className="text-[#1d1d1f] dark:text-white font-medium">*</strong> No multiplier is on record for this project, so 1.30 is used — typical for Noida, not verified for this project.</>}
                {' '}The tax saving assumes the old tax regime, the 30% slab and the full ₹2 lakh Section 24(b) interest deduction. Take-home needed keeps the EMI at 40% of monthly income. These are estimates for comparing projects, not a quote: confirm the cost sheet with the builder.
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4: Site-visit questions ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#ff9500] text-white flex items-center justify-center text-[11px] font-bold">4</span>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight uppercase text-[#1d1d1f] dark:text-white">
                Questions to ask on a site visit
              </h2>
            </div>
            <span className="text-xs text-[#86868b] font-normal">Ask these before paying any token amount</span>
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
                        <span className="text-[10px] text-[#86868b]">{locationLabel(p)}</span>
                      </div>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#d97706] dark:text-[#ff9f0a] bg-[#ff9500]/10 px-2 py-0.5 rounded-full border border-[#ff9500]/20">
                        {p.siteVisitChecklist.length} questions
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
                        <span className="text-[#28a745] dark:text-[#30d158]">Questions copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy questions</span>
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── FOOTER: source and limits ── */}
        <footer className="pt-8 pb-12 border-t border-[#e5e5ea] dark:border-[#2c2c2e] text-center space-y-2 text-xs text-[#86868b]">
          <div className="flex items-center justify-center gap-2 font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
            <Award size={15} className="text-[#0066cc] dark:text-[#2997ff]" />
            <span>PropFyndr</span>
          </div>
          <p className="max-w-2xl mx-auto leading-relaxed text-[11px] text-[#86868b]">
            Built from one PropFyndr conversation and the project records we hold. Anyone with this link can view it. Where we hold no record, it says so; where a figure is assumed, it is marked. Check prices, dues and approvals with the builder and UP RERA before paying anything. Not an offer to sell.
          </p>
          <div className="text-[10px] font-mono text-[#86868b]">
            Prepared on {consultation.date} &bull; Link works until {new Date(dossier.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </footer>

      </main>
    </div>
  )
}
