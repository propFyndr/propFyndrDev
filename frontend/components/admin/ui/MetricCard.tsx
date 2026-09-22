'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Icon } from '@phosphor-icons/react'

interface MetricCardProps {
  title: string
  value: number | string
  subBadge?: string
  subBadgeVariant?: 'emerald' | 'violet' | 'amber' | 'blue' | 'zinc'
  icon: Icon
  iconColorClass?: string
  iconBgClass?: string
  href?: string
  tooltip?: React.ReactNode
  isHero?: boolean
  warning?: boolean
}

export function MetricCardSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs flex flex-col justify-between min-h-[128px] animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-md w-24" />
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-16" />
            <div className="h-5 bg-zinc-100 dark:bg-zinc-800 rounded-md w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MetricCard({
  title,
  value,
  subBadge,
  subBadgeVariant = 'emerald',
  icon: Icon,
  iconColorClass = 'text-blue-600 dark:text-blue-400',
  iconBgClass = 'bg-blue-50 dark:bg-blue-950/60',
  href,
  tooltip,
  isHero = false,
  warning = false,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState<number | string>(
    typeof value === 'number' ? 0 : value
  )

  // Smooth number ticker from 0 to value on mount
  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value)
      return
    }

    let start = 0
    const end = value
    if (end === 0) {
      setDisplayValue(0)
      return
    }

    const duration = 750 // ms
    const startTime = performance.now()

    function step(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * easeOut)
      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        setDisplayValue(end)
      }
    }

    requestAnimationFrame(step)
  }, [value])

  const badgeStyles = {
    emerald:
      'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/70 dark:border-emerald-800/60',
    violet:
      'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 border-violet-200/70 dark:border-violet-800/60',
    amber:
      'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200/70 dark:border-amber-800/60',
    blue:
      'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border-blue-200/70 dark:border-blue-800/60',
    zinc:
      'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',
  }[subBadgeVariant]

  const cardContent = (
    <div
      className={`group relative rounded-2xl p-4 md:p-5 border transition-all duration-200 flex flex-col justify-between min-h-[128px] ${
        warning
          ? 'bg-white dark:bg-zinc-900 border-amber-300 dark:border-amber-700/80 hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 shadow-2xs'
          : isHero
          ? 'bg-white dark:bg-zinc-900 border-zinc-200/90 dark:border-zinc-800/90 hover:border-blue-400/70 dark:hover:border-blue-500/70 hover:shadow-md hover:-translate-y-0.5 shadow-2xs'
          : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md hover:-translate-y-0.5 shadow-2xs'
      } ${href ? 'cursor-pointer active:scale-[0.985]' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[11px] md:text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
            warning
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {title}
          {tooltip}
        </span>

        <div className="flex items-center gap-1.5">
          {href && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              <ArrowUpRight size={14} weight="bold" />
            </span>
          )}
          <div
            className={`w-9 h-9 rounded-xl ${iconBgClass} ${iconColorClass} flex items-center justify-center group-hover:scale-105 transition-transform shrink-0`}
          >
            <Icon size={20} weight="duotone" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
        <h3
          className={`text-2xl md:text-3xl font-extrabold tracking-tight tabular-nums ${
            warning
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-zinc-900 dark:text-zinc-50'
          }`}
        >
          {displayValue}
        </h3>

        {subBadge && (
          <span
            className={`text-[10px] md:text-[11px] font-semibold px-2 py-0.5 rounded-md border truncate ${badgeStyles}`}
          >
            {subBadge}
          </span>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block focus:outline-hidden">
        {cardContent}
      </Link>
    )
  }

  return cardContent
}
