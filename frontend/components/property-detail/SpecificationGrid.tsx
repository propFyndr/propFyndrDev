'use client'

import { useMemo, useState } from 'react'
import {
  ShieldCheck,
  SquaresFour,
  CookingPot,
  Drop,
  Door,
  Lightning,
  Wrench,
  Elevator,
  LockKey,
  Plant,
  Car,
  Package,
  CheckCircle,
  Tag,
  CaretDown,
  HardHat,
  Crown,
  Medal
} from '@phosphor-icons/react'

interface SpecItem {
  label: string
  value: string
  brand?: string | null
  tier?: string | null
  category: string
  verified_at?: Date | null
  created_at?: Date | null
  is_highlight?: boolean
}

interface SpecificationGridProps {
  specs: SpecItem[]
}

interface CategoryTheme {
  icon: React.ComponentType<any>
  label: string
  iconBg: string
}

const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  structure: {
    icon: ShieldCheck,
    label: 'Structure & Safety',
    iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
  },
  flooring: {
    icon: SquaresFour,
    label: 'Flooring & Surfaces',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  },
  kitchen: {
    icon: CookingPot,
    label: 'Kitchen & Utility',
    iconBg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20',
  },
  bathrooms: {
    icon: Drop,
    label: 'Bathrooms & CP Fittings',
    iconBg: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20',
  },
  doors_windows: {
    icon: Door,
    label: 'Doors & Windows',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  },
  electrical: {
    icon: Lightning,
    label: 'Electrical & Power',
    iconBg: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20',
  },
  plumbing: {
    icon: Wrench,
    label: 'Plumbing & Drainage',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  },
  lifts: {
    icon: Elevator,
    label: 'Elevators & Vertical Transit',
    iconBg: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20',
  },
  security: {
    icon: LockKey,
    label: 'Security & Access Control',
    iconBg: 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20',
  },
  sustainability: {
    icon: Plant,
    label: 'Green Building & Solar',
    iconBg: 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/20',
  },
  parking: {
    icon: Car,
    label: 'Parking & Basement',
    iconBg: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-500/20',
  },
}

function getCategoryTheme(cat: string): CategoryTheme {
  const normalized = String(cat || '').toLowerCase().trim().replace(/[\s-]+/g, '_')
  return (
    CATEGORY_THEMES[normalized] || {
      icon: Package,
      label: cat ? cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'General Specification',
      iconBg: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-500/20',
    }
  )
}

function getTierIcon(tier?: string | null) {
  if (tier === 'luxury') return Crown
  if (tier === 'premium') return Medal
  return Tag
}

function TierBadge({ tier }: { tier?: string | null }) {
  if (!tier) return null
  const normalized = tier.toLowerCase()

  if (normalized.includes('luxury') || normalized.includes('ultra')) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/15 via-yellow-500/15 to-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-300/60 dark:border-amber-700/50 shadow-xs">
        <Crown size={12} weight="duotone" className="text-amber-600 dark:text-amber-400" />
        {tier}
      </span>
    )
  }

  if (normalized.includes('premium')) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-200/80 dark:border-blue-800/60 shadow-xs">
        <Medal size={12} weight="duotone" className="text-blue-600 dark:text-blue-400" />
        {tier}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
      {tier}
    </span>
  )
}

function VerificationBadge({ verified }: { verified?: Date | null }) {
  if (!verified) {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-400 dark:text-slate-500">
        Brochure Spec
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
      <CheckCircle size={12} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
      Site Verified
    </span>
  )
}

export function SpecificationGrid({ specs }: SpecificationGridProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, SpecItem[]> = {}
    if (!Array.isArray(specs)) return groups
    specs.forEach(spec => {
      // A spec with no value renders as a labelled card with a blank line
      // where the value goes — the empty-card bug this component was built
      // to avoid. `value` is typed as a required string, but Postgres holds
      // it as nullable, so an empty or whitespace-only string reaches here at
      // runtime regardless of the type. Omission is the signal everywhere
      // else in this codebase's fact-presentation rules; a card with nothing
      // to show is worse than one fewer card.
      if (!spec.value || !spec.value.trim()) return
      const cat = spec.category || 'general'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(spec)
    })
    return groups
  }, [specs])

  const categories = Object.keys(grouped)
  
  // Collapsed by default — user can expand individually or click Expand All
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false)
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, boolean>>({})

  const isCategoryOpen = (cat: string) => {
    if (categoryOverrides[cat] !== undefined) {
      return categoryOverrides[cat]
    }
    return isAllExpanded
  }

  const toggleCategory = (cat: string) => {
    const current = isCategoryOpen(cat)
    setCategoryOverrides(prev => ({
      ...prev,
      [cat]: !current
    }))
  }

  const toggleAll = () => {
    const nextState = !isAllExpanded
    setIsAllExpanded(nextState)
    setCategoryOverrides({})
  }

  // Checks the count AFTER the empty-value filter above, not the raw prop —
  // a specs array that is non-empty but entirely empty-valued used to fall
  // through this guard and render a header claiming N verified specs with
  // zero category cards underneath it.
  if (!specs || !Array.isArray(specs) || specs.length === 0 || categories.length === 0) {
    return null
  }

  const renderCategoryCard = (category: string) => {
    const items = grouped[category]
    const theme = getCategoryTheme(category)
    const IconComponent = theme.icon
    const isOpen = isCategoryOpen(category)

    const brands = Array.from(new Set(items.map(i => i.brand).filter(Boolean))) as string[]

    return (
      <div
        key={category}
        className="rounded-2xl bg-white dark:bg-[#141414] border border-slate-200/80 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none transition-all duration-200 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => toggleCategory(category)}
          className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors select-none"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${theme.iconBg} flex items-center justify-center shrink-0`}>
              <IconComponent size={18} weight="duotone" />
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-[13px] sm:text-[14px] text-slate-900 dark:text-white tracking-tight truncate">
                {theme.label}
              </h4>
              {!isOpen && brands.length > 0 && (
                <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 hidden sm:block">
                  {brands.join(' • ')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-1.5 sm:ml-3">
            <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 whitespace-nowrap">
              {items.length}
            </span>
            <CaretDown
              size={14}
              weight="bold"
              className={`text-slate-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {isOpen && (
          <div className="p-3 sm:p-4 pt-1 border-t border-slate-100 dark:border-white/5 space-y-2.5 sm:space-y-3 bg-slate-50/30 dark:bg-white/[0.01]">
            {items.map((spec, idx) => {
              const TierIcon = getTierIcon(spec.tier)
              return (
                <div
                  key={idx}
                  className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#1a1a1c] border border-slate-200/60 dark:border-white/5 space-y-1.5 transition-all shadow-2xs hover:border-slate-300 dark:hover:border-white/15"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11.5px] sm:text-[12px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {spec.label}
                    </span>
                    {spec.tier && (
                      <span
                        className={`inline-flex items-center gap-1 text-[9.5px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                          spec.tier === 'luxury'
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/80'
                            : spec.tier === 'premium'
                            ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300/80'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {TierIcon && <TierIcon size={12} weight="duotone" />}
                        {spec.tier}
                      </span>
                    )}
                  </div>

                  <div className="text-[12.5px] sm:text-[13px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                    {spec.value}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5 text-[10px] sm:text-[11px]">
                    {spec.brand ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[160px] sm:max-w-[220px]">
                        <Tag size={12} weight="duotone" className="text-slate-400 flex-shrink-0" />
                        <span className="text-slate-400">Brand:</span> <span className="text-slate-900 dark:text-white font-bold truncate">{spec.brand}</span>
                      </span>
                    ) : (
                      <span />
                    )}
                    <div className="flex-shrink-0 scale-90 sm:scale-100 origin-right">
                      <VerificationBadge verified={spec.verified_at || spec.created_at} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#141414] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center shrink-0 shadow-sm">
            <HardHat size={20} weight="duotone" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Construction &amp; Material Specifications
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              Verified structural, finishes, and MEP material benchmarks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50 shadow-xs">
            <CheckCircle size={14} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
            <span>{specs.length} Verified Specs</span>
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="text-[11px] sm:text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white px-2.5 py-1 sm:px-3 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-2xs"
          >
            {isAllExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>

      {/* Single column under the md breakpoint — two cramped ~180px-wide
          category cards on a 375px phone was the "single column under 440px"
          gap. Every col-span-* below is already written in terms of md:, so
          this is the only line that needed to change: col-span-2 on a
          1-column grid just occupies the one column that exists, same as
          col-span-1 would, so nothing else shifts. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4 items-start">
        {categories.map((cat, i) => {
          const isOpen = isCategoryOpen(cat)
          const isLastOdd = categories.length % 2 !== 0 && i === categories.length - 1
          return (
            <div
              key={cat}
              className={`w-full transition-all duration-200 ${
                isOpen ? 'col-span-2 md:col-span-1' : isLastOdd ? 'col-span-2 md:col-span-2 max-w-md md:max-w-2xl mx-auto' : 'col-span-1'
              }`}
            >
              {renderCategoryCard(cat)}
            </div>
          )
        })}
      </div>
    </section>
  )
}
