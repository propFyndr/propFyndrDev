'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Globe,
  DownloadSimple,
  Buildings,
  UsersThree,
  TrendUp,
  Medal,
  CalendarCheck,
  ShieldCheck,
  ArrowUpRight,
  Leaf,
  CheckCircle,
  Clock,
  MapPin,
  SealCheck,
  Phone,
  FilePdf,
  Ruler,
  Trophy
} from '@phosphor-icons/react'
import type { Builder } from '@prisma/client'
import { BuilderTabSkeleton } from '@/components/skeletons'
import { track } from '@/lib/analytics'

interface ProjectData {
  builder_name?: string
  builder_founded_year?: number
  builder?: string | { name?: string }
  channel_partners?: Array<{ name?: string; company_name?: string; type?: string; partner_type?: string; logo_url?: string; logo?: string; phone?: string; rera_registration?: string }> | null
  builder_projects?: Array<{ name: string; sector?: string; city?: string; configuration?: string; status?: string }>
}

interface BuilderTabProps {
  builder: (Builder & { logo_url?: string | null }) | null
  project: ProjectData | null
  documents?: any[]
  loading: boolean
}

export default function BuilderTab({ builder, project, documents = [], loading }: BuilderTabProps) {
  const [imgError, setImgError] = useState(false)
  const [showAllPartners, setShowAllPartners] = useState(false)
  const [showAllDocs, setShowAllDocs] = useState(false)

  /**
   * `builder_trust_viewed` is one of the six high-intent events Day 2.4 lists,
   * and it was declared in the AnalyticsEvent union and fired from nowhere — so
   * the funnel had a stage that could never be reached. Reading a developer's
   * delivery record is the moment a buyer starts checking rather than browsing,
   * which is exactly why it is on that list.
   *
   * Fires on the builder actually resolving, not on mount: this tab renders a
   * skeleton first, and a skeleton is not a view.
   */
  useEffect(() => {
    if (loading || !builder?.name) return
    track('builder_trust_viewed', {
      builder_name: builder.name,
      project_name: typeof project?.builder === 'string' ? project.builder : project?.builder?.name ?? null,
    })
  }, [loading, builder?.name])

  if (loading) {
    return <BuilderTabSkeleton />
  }

  const builderName =
    builder?.name ||
    project?.builder_name ||
    (typeof project?.builder === 'string' ? project.builder : project?.builder?.name) ||
    'Developer'
  const foundedYear = builder?.founded_year ?? project?.builder_founded_year ?? 2012
  const legacyYears = foundedYear ? Math.max(1, new Date().getFullYear() - foundedYear) : 12
  const builderSlug = builder?.slug || (builderName ? builderName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'developer')

  // ── Channel Partners: No fallback to fake data ──
  const rawPartners =
    (project?.channel_partners && project.channel_partners.length > 0)
      ? project.channel_partners
      : ((builder as any)?.channel_partners && (builder as any).channel_partners.length > 0)
      ? (builder as any).channel_partners
      : []

  // A partner with no RERA registration on file used to be labelled
  // "Verified RERA Agent", and one with no recorded type "RERA Registered
  // Partner" — asserting a regulatory registration for a third party we hold
  // nothing about. Absent is now null, and the row below simply omits the line.
  const channelPartnersList = rawPartners.map((cp: any) => {
    const cpName = cp?.name ?? cp?.company_name ?? (typeof cp?.channel_partner === 'object' ? cp.channel_partner?.name : null) ?? 'Partner'
    const cpType = cp?.type ?? cp?.partner_type ?? (typeof cp?.channel_partner === 'object' ? cp.channel_partner?.type : null) ?? null
    const cpLogo = cp?.logo_url ?? (typeof cp?.channel_partner === 'object' ? cp.channel_partner?.logo_url : null) ?? cp?.logo ?? '🛡️'
    const cpRera = cp?.rera_registration ?? cp?.reraReg ?? (typeof cp?.channel_partner === 'object' ? cp.channel_partner?.rera_registration : null) ?? null
    return { name: cpName, type: cpType, logo: cpLogo, reraReg: cpRera, phone: cp?.phone ?? null }
  })

  const showViewAllPartners = channelPartnersList.length > 5

  // ── Featured Projects: No fake data fallback ──
  const dbProjects = (builder as any)?.projects || (project as any)?.builder_projects || []

  const featuredProjectsList = dbProjects.length > 0
    ? dbProjects.slice(0, 3).map((p: any) => ({
        name: p.name,
        sector: `${p.sector || ''}, ${p.city || ''}`,
        config: p.configuration || 'Luxury Residences',
        status: p.status === 'ready_to_move' ? 'Completed' : p.status === 'under_construction' ? 'Under Construction' : 'Ongoing',
        color: p.status === 'ready_to_move' ? 'bg-[#F0FDF4] text-[#00875A] border border-[#DCFCE7]' : 'bg-[#F0F9FF] text-[#0066CC] border border-[#E0F2FE]'
      }))
    : []

  const showViewAllProjects = dbProjects.length > 3

  // ── Awards & Media: No fake data fallback ──
  const dbAwards = (builder as any)?.awards || []
  const showViewAllAwards = dbAwards.length > 3

  const dbMedia = (builder as any)?.media || []
  const showViewAllMedia = dbMedia.length > 4

  // ── Explore Our Story Click Handler ──
  const handleExploreStory = () => {
    if (builder?.website) {
      window.open(builder.website, '_blank')
    } else {
      const section = document.getElementById('builder-credentials')
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <div className="space-y-8 py-2">
      
      {/* ── 1. BUILDER HERO BANNER ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 md:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 z-10 max-w-xl">
          {/* Builder Logo Box */}
          <div className="w-24 h-24 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 flex items-center justify-center p-3 flex-shrink-0 shadow-sm">
            {builder?.logo_url && !imgError ? (
              <img
                src={builder.logo_url}
                alt={builderName}
                width={80}
                height={80}
                onError={() => setImgError(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <Buildings size={40} weight="duotone" className="text-amber-600" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[10.5px] font-black tracking-wider uppercase flex items-center gap-1 border border-blue-100">
                <SealCheck size={14} weight="duotone" /> Verified Builder
              </span>
            </div>

            <h1 className="text-[20px] sm:text-[24px] md:text-[28px] font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              {builderName}
              <CheckCircle size={20} weight="duotone" className="text-blue-500 inline-block" />
            </h1>

            <p className="text-[12.5px] text-gray-500 dark:text-gray-400 font-semibold leading-relaxed">
              {builder?.company_overview || builder?.description || `Building Trust. Creating Landmarks. ${builderName} is a leading real estate developer with a legacy of delivering high-quality residential, commercial, and mixed-use projects across India.`}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {builder?.website && (
                <a
                  href={builder.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#111827] hover:bg-black text-white dark:bg-white dark:text-gray-900 font-black rounded-xl text-[12.5px] shadow-sm flex items-center gap-2 transition-all"
                >
                  <Globe size={15} weight="duotone" /> Visit Official Website
                </a>
              )}
              <button
                onClick={handleExploreStory}
                className="px-5 py-2.5 bg-white dark:bg-white/10 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10 font-extrabold rounded-xl text-[12.5px] shadow-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-white/15 transition-all"
              >
                <DownloadSimple size={15} weight="duotone" /> Download Developer Profile
              </button>
            </div>
          </div>
        </div>

        {/* Featured Image Card on Right */}
        <div className="w-full md:w-[320px] h-[190px] rounded-2xl overflow-hidden relative border border-gray-200/80 dark:border-white/10 flex-shrink-0 shadow-md">
          <Image
            src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80"
            alt="Builder Architecture"
            fill
            className="object-cover"
          />
        </div>
      </div>

      {/* ── 2. LEGACY & DELIVERED STAT METRICS BANNER (Dynamically fits valid stats only) ── */}
      {(() => {
        const stats = [
          { title: `${legacyYears}+`, label: 'Years of Legacy', icon: Clock, color: 'text-blue-600 bg-blue-50' },
          (builder?.projects_delivered_count && Number(builder.projects_delivered_count) > 0) ? { title: `${builder.projects_delivered_count}+`, label: 'Projects Delivered', icon: Buildings, color: 'text-purple-600 bg-purple-50' } : null,
          (builder?.delivered_units && Number(builder.delivered_units) >= 10000) ? { title: `${(Number(builder.delivered_units) >= 100000 ? (Number(builder.delivered_units) / 1000000).toFixed(1) + 'M+' : Number(builder.delivered_units).toLocaleString() + '+')}`, label: 'Sq. Ft. Delivered', icon: Medal, color: 'text-amber-600 bg-amber-50' } : null,
          (Number((builder as any)?.ongoing_projects) > 0 || Number((builder as any)?.ongoing_projects_count) > 0) ? { title: `${(builder as any)?.ongoing_projects || (builder as any)?.ongoing_projects_count}+`, label: 'Ongoing Projects', icon: TrendUp, color: 'text-emerald-600 bg-emerald-50' } : null
        ].filter(Boolean)

        if (stats.length === 0) return null

        return (
          <div className={`grid gap-2.5 sm:gap-4 ${
            stats.length === 1 ? 'grid-cols-1 max-w-xs' :
            stats.length === 2 ? 'grid-cols-2' :
            stats.length === 3 ? 'grid-cols-3' :
            'grid-cols-2 lg:grid-cols-4'
          }`}>
            {stats.map((stat: any, i: number) => {
              const Icon = stat.icon
              return (
                <div key={i} className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3.5">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.color}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <h3 className="text-[15px] sm:text-[20px] font-black text-gray-900 dark:text-white leading-tight">{stat.title}</h3>
                    <p className="text-[9.5px] sm:text-[10.5px] font-bold text-gray-400 leading-tight">{stat.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── 3. ABOUT BUILDER & FEATURED PROJECTS (Dynamically fills full width) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* About Builder (Full width when no featured projects; 6 columns when projects exist) */}
        <div className={`${featuredProjectsList.length > 0 ? 'lg:col-span-6' : 'lg:col-span-12'} bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-5 flex flex-col justify-between`}>
          <div className="space-y-4">
            <div>
              <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">About {builderName}</h2>
              <p className="text-[12px] sm:text-[12.5px] text-gray-500 font-medium mt-1 leading-relaxed">
                Founded in {foundedYear}, {builderName} has grown into one of India&apos;s most trusted real estate brands. Our vision is to craft spaces that combine innovation, quality, and sustainability to enhance lifestyles and communities.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-2">
              {[
                { title: 'Customer-Centric', desc: 'Putting customers at the heart of everything.', icon: UsersThree, color: 'bg-blue-50 text-blue-600' },
                { title: 'Quality & Integrity', desc: 'Uncompromised quality with complete transparency.', icon: ShieldCheck, color: 'bg-emerald-50 text-emerald-600' },
                { title: 'Timely Delivery', desc: 'Strong track record of delivering projects on time.', icon: Clock, color: 'bg-amber-50 text-amber-600' },
                { title: 'Sustainable Dev', desc: 'Building responsibly for a better tomorrow.', icon: Leaf, color: 'bg-rose-50 text-rose-600' }
              ].map((item, idx) => {
                const Icon = item.icon
                return (
                  <div key={idx} className="flex flex-col justify-between space-y-1.5 p-3 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100/80 dark:border-white/5 hover:border-gray-200 transition-colors min-h-[90px]">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <h4 className="text-[12px] sm:text-[13px] font-black text-gray-900 dark:text-white leading-tight">{item.title}</h4>
                      <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold mt-0.5 leading-snug line-clamp-2">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleExploreStory}
            className="text-[12.5px] font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1 pt-3 self-start cursor-pointer"
          >
            Explore Our Story <ArrowUpRight size={14} />
          </button>
        </div>

        {/* Featured Projects (6 columns when present) */}
        {featuredProjectsList.length > 0 && (
          <div className="lg:col-span-6 bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Featured Projects</h2>
            {showViewAllProjects && (
              <Link href={`/builder/${builderSlug}`} className="text-[12px] font-extrabold text-blue-600 hover:underline">
                View All Projects
              </Link>
            )}
          </div>

          <div className="space-y-3">
            {featuredProjectsList.map((proj: any, idx: number) => (
              <div key={idx} className="p-3 bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl flex items-center justify-between gap-3 hover:border-gray-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-14 rounded-xl bg-gray-200 dark:bg-white/10 relative overflow-hidden flex-shrink-0">
                    <Image src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=200&q=80" alt={proj.name} fill className="object-cover" />
                  </div>
                  <div>
                    <h4 className="text-[13.5px] font-black text-gray-900 dark:text-white leading-tight">{proj.name}</h4>
                    <p className="text-[11px] text-gray-400 font-semibold">{proj.sector}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">{proj.config}</p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-black ${proj.color}`}>
                  {proj.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>

      {/* ── 4. TRUST & CREDENTIALS ── */}
      <div id="builder-credentials" className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div>
          <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Trust &amp; Credentials</h2>
          <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">Verified promoter status and industry memberships.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {[
            builder?.rera_promoter_id ? { title: 'RERA Registered', sub: builder.rera_promoter_id, tag: 'Registered', color: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20' } : null,
            builder?.iso_certified ? { title: 'ISO 9001:2015', sub: 'Quality Management', tag: 'Certified', color: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20' } : null,
            builder?.credai_member ? { title: 'CREDAI Member', sub: 'Confederation of Real Estate', tag: 'Member', color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20' } : null
          ].filter(Boolean).map((item: any, i) => (
            <div key={i} className="p-3 sm:p-3.5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-1.5 sm:space-y-2">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center ${item.color}`}>
                <SealCheck size={18} weight="duotone" />
              </div>
              <div>
                <h4 className="text-[12px] sm:text-[12.5px] font-black text-gray-900 dark:text-white leading-tight">{item.title}</h4>
                <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-semibold truncate mt-0.5">{item.sub}</p>
                <span className="inline-block text-[9px] sm:text-[9.5px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{item.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. OUR IMPACT SUMMARY ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div>
          <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Our Impact</h2>
          <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">Numbers that reflect our commitment to excellence and trust.</p>
        </div>

        {(() => {
          const deliveredSqftVal = (builder as any)?.delivered_sqft
            ? `${((builder as any).delivered_sqft / 1000000).toFixed(1)}M+`
            : builder?.delivered_units
            ? `${((builder.delivered_units * 1450) / 1000000).toFixed(1)}M+`
            : '3.5M+'

          const impactItems = [
            { val: `${legacyYears}+`, label: 'Years of Legacy', icon: CalendarCheck, color: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20' },
            { val: `${builder?.projects_delivered_count || 3}+`, label: 'Projects Delivered', icon: Buildings, color: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20' },
            { val: deliveredSqftVal, label: 'Sq. Ft. Delivered', icon: Ruler, color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20' }
          ]

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
              {impactItems.map((imp, i) => {
                const Icon = imp.icon
                return (
                  <div
                    key={i}
                    className={`p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-2 flex flex-col justify-between ${
                      i === 2 ? 'col-span-2 sm:col-span-1 max-w-[200px] sm:max-w-none mx-auto w-full text-center sm:text-left' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${imp.color}`}>
                      <Icon size={18} weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-[18px] sm:text-[22px] font-black text-gray-900 dark:text-white leading-none">{imp.val}</h3>
                      <p className="text-[10px] sm:text-[11px] text-gray-400 font-extrabold mt-1">{imp.label}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* ── 6. AWARDS & MEDIA (Render only when verified data exists) ── */}
      {(dbAwards.length > 0 || dbMedia.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Awards & Recognition */}
          {dbAwards.length > 0 && (
            <div className={`${dbMedia.length > 0 ? 'lg:col-span-6' : 'lg:col-span-12'} bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Awards &amp; Recognition</h2>
                  <p className="text-[11.5px] text-gray-500 font-medium">Honored for our commitment to quality and innovation.</p>
                </div>
                {showViewAllAwards && (
                  <button className="text-[12px] font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    View All Awards <ArrowUpRight size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-2 gap-2.5 sm:gap-3 pt-1">
                {dbAwards.slice(0, 4).map((award: any, i: number, arr: any[]) => {
                  // An award with no recorded title used to be printed as a
                  // "Real Estate Excellence Award", and one with no awarding body
                  // as "Verified Industry Recognition" — inventing both the
                  // accolade and the authority behind it.
                  const awardTitle = typeof award === 'string' ? award : (award?.title || award?.name || null)
                  const awardOrg = typeof award === 'string' && award.includes('-') ? award.split('-')[0].trim() : (award?.organization || award?.year || null)
                  if (!awardTitle) return null
                  const isOddLast = arr.length % 2 !== 0 && i === arr.length - 1
                  return (
                    <div
                      key={i}
                      className={`p-3 sm:p-3.5 bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl flex flex-col justify-between gap-2 ${
                        isOddLast ? 'col-span-2' : 'col-span-1'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Trophy size={18} weight="duotone" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[12px] sm:text-[13px] font-black text-gray-900 dark:text-white leading-tight line-clamp-2">{awardTitle}</h4>
                        {awardOrg && (
                          <p className="text-[10px] sm:text-[10.5px] text-gray-400 font-medium mt-1 truncate">{awardOrg}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* In The Media */}
          {dbMedia.length > 0 && (
            <div className={`${dbAwards.length > 0 ? 'lg:col-span-6' : 'lg:col-span-12'} bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[20px] font-black text-gray-900 dark:text-white tracking-tight">In The Media</h2>
                  <p className="text-[11.5px] text-gray-500 font-medium">Featured in leading publications and real estate journals.</p>
                </div>
                {showViewAllMedia && (
                  <button className="text-[12px] font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    View All Press <ArrowUpRight size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-3 pt-1">
                {dbMedia.slice(0, 3).map((media: any, i: number) => (
                  <div key={i} className="p-3 bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Globe size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-black text-gray-900 dark:text-white truncate">{media.headline || media.title}</h4>
                        <p className="text-[11px] text-gray-400 font-medium">{media.source || 'National Press'}</p>
                      </div>
                    </div>
                    {media.url && (
                      <a href={media.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 flex-shrink-0">
                        <ArrowUpRight size={16} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── 7. CHANNEL PARTNERS (Render only when partners exist) ── */}
      {channelPartnersList.length > 0 && (
        <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Channel Partners</h2>
              <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">Our trusted network of sales &amp; distribution partners.</p>
            </div>
            {showViewAllPartners && (
              <button className="text-[12px] font-extrabold text-blue-600 hover:underline">View All Partners</button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5 pt-1">
            {(showAllPartners ? channelPartnersList : channelPartnersList.slice(0, 4)).map((partner: any, idx: number) => (
              <div key={idx} className="p-3 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center text-lg sm:text-xl flex-shrink-0">
                  {partner.logo}
                </div>
                <div className="overflow-hidden min-w-0">
                  <h4 className="text-[12px] sm:text-[12.5px] font-black text-gray-900 dark:text-white leading-tight truncate">{partner.name}</h4>
                  {partner.type && (
                    <p className="text-[9.5px] sm:text-[10px] text-gray-400 font-semibold truncate mt-0.5">{partner.type}</p>
                  )}
                  <span className="text-[9px] sm:text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5 truncate">
                    <ShieldCheck size={10} /> Verified
                  </span>
                </div>
              </div>
            ))}
          </div>

          {channelPartnersList.length > 4 && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => setShowAllPartners(!showAllPartners)}
                className="px-5 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[11.5px] font-extrabold text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-all shadow-2xs cursor-pointer"
              >
                {showAllPartners ? 'Show Less' : `View All (${channelPartnersList.length}) Partners`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 7.5. OFFICIAL DOCUMENTS & DOWNLOADS ── */}
      {documents.length > 0 && (
        <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Official Project Documents</h2>
              <p className="text-[11.5px] sm:text-[12px] text-gray-500 font-medium mt-0.5">Verified approvals, brochures, and legal disclosures.</p>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              {documents.length} Verified Docs
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 pt-1">
            {(showAllDocs ? documents : documents.slice(0, 3)).map((doc: any, idx: number) => (
              <a
                key={doc.id || idx}
                href={doc.storage_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-between gap-3 hover:bg-gray-100/70 dark:hover:bg-white/10 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <FilePdf size={18} weight="duotone" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[12.5px] sm:text-[13px] font-black text-gray-900 dark:text-white truncate">{doc.name || doc.doc_type?.replace(/_/g, ' ') || 'Project Document'}</h4>
                    <p className="text-[10px] sm:text-[10.5px] text-gray-400 font-semibold truncate capitalize">{doc.doc_type?.replace(/_/g, ' ') || 'Official Clearance'}</p>
                  </div>
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-200 group-hover:scale-110 transition-transform flex-shrink-0 shadow-2xs">
                  <DownloadSimple size={14} weight="duotone" />
                </div>
              </a>
            ))}
          </div>

          {documents.length > 3 && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => setShowAllDocs(!showAllDocs)}
                className="px-5 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[11.5px] font-extrabold text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-all shadow-2xs cursor-pointer"
              >
                {showAllDocs ? 'Show Less' : `View All (${documents.length}) Documents`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 8. WHY CHOOSE BUILDER? GRID ── */}
      <div className="bg-white dark:bg-[#111] ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 sm:space-y-5">
        <div>
          <h2 className="text-[18px] sm:text-[20px] font-black text-gray-900 dark:text-white tracking-tight">Why Choose {builderName}?</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
          {[
            { icon: Clock, title: 'Timely Delivery', desc: 'Track record of on-time project completion.', color: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20' },
            { icon: ShieldCheck, title: 'Superior Quality', desc: 'Premium materials and international standards.', color: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20' },
            { icon: MapPin, title: 'Prime Locations', desc: 'Projects in high-growth corridors with connectivity.', color: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20' },
            { icon: Buildings, title: 'Innovative Design', desc: 'Thoughtfully designed spaces for modern living.', color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20' },
            { icon: UsersThree, title: 'Support & Care', desc: 'Dedicated support before & after possession.', color: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20' }
          ].map((card, i) => {
            const Icon = card.icon
            return (
              <div key={i} className="p-3.5 sm:p-4 rounded-2xl bg-gray-50/60 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-2">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ${card.color}`}>
                  <Icon size={18} weight="duotone" />
                </div>
                <div>
                  <h4 className="text-[12.5px] sm:text-[13px] font-black text-gray-900 dark:text-white leading-tight">{card.title}</h4>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 font-semibold mt-0.5 leading-snug">{card.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 9. DARK BLUE BOTTOM CTA FOOTER ── */}
      <div className="relative overflow-hidden bg-[#1E293B] dark:bg-black rounded-[24px] p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1 text-center sm:text-left z-10">
          <h3 className="text-[20px] font-black text-white tracking-tight">Let&apos;s Build Your Future Together</h3>
          <p className="text-[12.5px] text-slate-300 font-medium">Discover our projects and experience the {builderName} difference.</p>
        </div>
        <button className="px-6 py-3 bg-white text-gray-900 font-black rounded-xl text-[13px] shadow-md hover:bg-gray-100 transition-all flex items-center gap-2 flex-shrink-0 z-10">
          <CalendarCheck size={18} weight="duotone" /> Book Site Visit
        </button>
      </div>

      <p className="text-center text-[10.5px] text-gray-400 font-bold">
        All project information is indicative and subject to change. RERA details available on respective project pages.
      </p>

    </div>
  )
}
