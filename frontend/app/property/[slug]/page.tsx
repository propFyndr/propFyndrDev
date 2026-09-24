'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Share2 } from 'lucide-react'
import { ChatCircleDots } from '@phosphor-icons/react'
import type { ProjectDetail, ProjectCard as ProjectCardType } from '@/types/project'
import ProjectDetailPanel from '@/components/ProjectDetailPanel'
import PropertyDetailThemed from '@/components/PropertyDetailThemed'
import StickyMobileCta from '@/components/property-detail/StickyMobileCta'
import CallbackModal from '@/components/CallbackModal'
import { API_BASE } from '@/lib/env'
import { applyTheme, DEFAULT_THEME, type BuilderTheme } from '@/lib/builderTheme'


export default function PropertyDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [theme, setTheme] = useState<BuilderTheme>(DEFAULT_THEME)
  const [showCallbackModal, setShowCallbackModal] = useState(false)

  // Stable stub — lets the panel open and show skeletons immediately while the real detail loads
  const stub: ProjectCardType = useMemo(() => ({
    id: '',
    slug: slug ?? '',
    name: '',
    builder: { name: '', slug: '' },
    sector: '',
    city: '',
    status: 'under_construction',
    possession_date: null,
    marketing_claims: [],
    price_range_label: '',
    unit_types: [],
    top_amenities: [],
    top_connectivity: [],
    images: [],
  }), [slug])

  useEffect(() => {
    setUserId(localStorage.getItem('user_id'))
  }, [])


  useEffect(() => {
    if (!slug) return

    const loadProject = async () => {
      try {
        const res = await fetch(`${API_BASE}/projects/${slug}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const d = await res.json()
        setDetail(d.project ?? null)

        // Apply builder theme if available
        const project = d.project
        let selectedTheme = DEFAULT_THEME

        if (project?.builder_theme) {
          selectedTheme = project.builder_theme
        }

        setTheme(selectedTheme)
        applyTheme(selectedTheme)
      } catch (err) {
        setNotFound(true)
      }
    }

    loadProject()
  }, [slug])

  const [copied, setCopied] = useState(false)

  if (!slug) return null

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (navigator.share) {
      try {
        await navigator.share({
          title: detail?.name ? `${detail.name} — PropFyndr` : 'PropFyndr Property Detail',
          text: detail?.tagline || 'Explore verified project insights, price analysis, and RERA details on PropFyndr.',
          url,
        })
        return
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.warn('Clipboard write failed:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F3F5F9] via-[#F8FAFC] to-[#F1F4F9] dark:from-[#080C14] dark:via-[#0C111C] dark:to-[#080C14] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Premium Glass Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
        <div className="max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all active:scale-95 cursor-pointer border border-slate-200/60 dark:border-slate-700/60 shadow-2xs"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px] md:max-w-[320px]">
                {detail?.name || 'Property Detail'}
              </span>
              {detail?.rera_number && (
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 px-2 py-0.5 rounded-full">
                  RERA Verified
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Share2 size={13} className="text-blue-600 dark:text-blue-400" />
              <span>{copied ? 'Link Copied!' : 'Share'}</span>
            </button>

            <button
              onClick={() => router.push('/discover')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <ChatCircleDots size={14} weight="duotone" />
              <span className="hidden sm:inline">Ask AI Advisor</span>
              <span className="sm:hidden">AI</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Luxury Container with Optimal Proportions */}
      <main className="max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 md:pb-8">
        {notFound ? (
          <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm my-6 p-8">
            <p className="text-4xl mb-3">🏚️</p>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Property Not Found</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-md mx-auto">
              We couldn&apos;t locate the property details for &quot;{slug}&quot;. It might have been moved or renamed.
            </p>
            <button
              onClick={() => router.push('/discover')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              Explore All Properties
            </button>
          </div>
        ) : (
          <PropertyDetailThemed theme={theme}>
            <div className="property-detail-panel w-full shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900">
              <ProjectDetailPanel
                project={detail ?? stub}
                initialDetail={detail ?? undefined}
                onClose={() => router.back()}
                userId={userId}
                inline
              />
            </div>
          </PropertyDetailThemed>
        )}
      </main>

      {/* Mobile-Only Persistent Bottom CTA Bar */}
      {detail && (
        <StickyMobileCta
          projectName={detail.name}
          priceRange={detail.price_range_label}
          onAskAi={() => router.push(`/discover?project=${encodeURIComponent(slug)}`)}
          onBookVisit={() => setShowCallbackModal(true)}
        />
      )}

      {/* Direct Callback / Site Visit Booking Modal */}
      {showCallbackModal && detail && (
        <CallbackModal
          project={detail as any}
          isDone={false}
          onClose={() => setShowCallbackModal(false)}
        />
      )}
    </div>
  )
}
