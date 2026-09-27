'use client'

import React, { useEffect, useRef, useState, useId } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ArrowUp, ArrowDown, Icon } from '@phosphor-icons/react'

export interface MetricDelta {
  value: string | number
  direction?: 'up' | 'down' | 'neutral'
  context?: string
}

interface MetricCardProps {
  title: string
  value: number | string
  subBadge?: string
  subBadgeVariant?: 'emerald' | 'violet' | 'amber' | 'blue' | 'zinc'
  delta?: MetricDelta
  contextText?: string
  icon: Icon
  iconColorClass?: string
  iconBgClass?: string
  href?: string
  tooltip?: React.ReactNode
  isHero?: boolean
  warning?: boolean
  sparkline?: 'emerald' | 'rose' | 'blue' | 'amber' | 'violet'
  sparklineData?: number[]
}

function MiniSparkline({
  data = [10, 18, 14, 22, 19, 28, 24, 32],
  variant = 'emerald',
}: {
  data?: number[]
  variant?: 'emerald' | 'rose' | 'blue' | 'amber' | 'violet'
}) {
  const gradientId = useId()
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 64
  const height = 24
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * (width - 6) + 3
    const y = height - ((val - min) / range) * (height - 8) - 4
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) }
  })
  const pathD = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`
  const lastPoint = points[points.length - 1]
  const areaD = `${pathD} L ${lastPoint.x},${height} L ${points[0].x},${height} Z`

  const colors = {
    emerald: { stroke: '#10b981', fillTop: 'rgba(16, 185, 129, 0.22)', fillBottom: 'rgba(16, 185, 129, 0.01)' },
    rose: { stroke: '#f43f5e', fillTop: 'rgba(244, 63, 94, 0.22)', fillBottom: 'rgba(244, 63, 94, 0.01)' },
    blue: { stroke: '#0066cc', fillTop: 'rgba(0, 102, 204, 0.22)', fillBottom: 'rgba(0, 102, 204, 0.01)' },
    amber: { stroke: '#f59e0b', fillTop: 'rgba(245, 158, 11, 0.22)', fillBottom: 'rgba(245, 158, 11, 0.01)' },
    violet: { stroke: '#8b5cf6', fillTop: 'rgba(139, 92, 246, 0.22)', fillBottom: 'rgba(139, 92, 246, 0.01)' },
  }[variant]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible opacity-90 group-hover:opacity-100 transition-opacity"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.fillTop} />
          <stop offset="100%" stopColor={colors.fillBottom} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={colors.stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Terminal Status Dot Indicator (Master Skill Section 36.1) */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="2.5"
        fill={colors.stroke}
        className="transition-transform group-hover:scale-125"
      />
    </svg>
  )
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
            <div className="h-3.5 bg-zinc-200/80 dark:bg-zinc-800 rounded-md w-24" />
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <div className="h-7 sm:h-8 bg-zinc-200/80 dark:bg-zinc-800 rounded-lg w-20" />
            <div className="h-5 bg-zinc-100 dark:bg-zinc-800 rounded-md w-16" />
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
  delta,
  contextText,
  icon: Icon,
  iconColorClass = 'text-blue-600 dark:text-blue-400',
  iconBgClass = 'bg-blue-50 dark:bg-blue-950/60',
  href,
  tooltip,
  isHero = false,
  warning = false,
  sparkline,
  sparklineData,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState<number | string>(value)
  const prevNumericValueRef = useRef<number | null>(null)
  const isMountedRef = useRef(false)

  // Master Skill Section 36.7: Smooth ticker interpolation from prev -> next
  useEffect(() => {
    // If string value (like "₹42.50" or "98.2%"), parse or display directly
    if (typeof value !== 'number') {
      setDisplayValue(value)
      return
    }

    const target = value
    const start = isMountedRef.current && prevNumericValueRef.current !== null
      ? prevNumericValueRef.current
      : 0

    prevNumericValueRef.current = target
    isMountedRef.current = true

    if (start === target) {
      setDisplayValue(target)
      return
    }

    // Skill 36.7: 500ms duration for updates, 700ms for initial count
    const duration = start === 0 ? 700 : 450
    const startTime = performance.now()

    let animationFrameId: number

    function step(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (target - start) * easeOut)
      setDisplayValue(current)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(target)
      }
    }

    animationFrameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrameId)
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

  const formattedDisplay = typeof displayValue === 'number'
    ? displayValue.toLocaleString()
    : displayValue

  const cardContent = (
    <div
      className={`group relative rounded-2xl p-3.5 sm:p-4 md:p-5 border transition-all duration-200 flex flex-col justify-between min-h-[120px] sm:min-h-[128px] min-w-0 ${
        warning
          ? 'bg-white dark:bg-zinc-900 border-amber-300/80 dark:border-amber-700/80 hover:border-amber-400/80 hover:shadow-xs hover:-translate-y-0.5 shadow-2xs'
          : isHero
          ? 'bg-white dark:bg-zinc-900 border-zinc-200/90 dark:border-zinc-800 hover:border-[#0066cc]/50 dark:hover:border-blue-500/50 hover:shadow-xs hover:-translate-y-0.5 shadow-2xs'
          : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs hover:-translate-y-0.5 shadow-2xs'
      } ${href ? 'cursor-pointer active:scale-[0.985]' : ''}`}
    >
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <span
          className={`text-[10.5px] sm:text-[11px] md:text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1 min-w-0 truncate ${
            warning
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <span className="truncate">{title}</span>
          {tooltip}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {href && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 group-hover:text-[#0066cc] dark:group-hover:text-blue-400">
              <ArrowUpRight size={14} weight="bold" />
            </span>
          )}
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${iconBgClass} ${iconColorClass} flex items-center justify-center group-hover:scale-105 transition-transform shrink-0`}
          >
            <Icon size={18} weight="duotone" />
          </div>
        </div>
      </div>

      <div className="mt-2.5 sm:mt-3 flex items-end justify-between gap-1.5 flex-wrap min-w-0">
        <div className="min-w-0">
          <h3
            className={`text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight tabular-nums truncate ${
              warning
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-zinc-900 dark:text-zinc-50'
            }`}
          >
            {formattedDisplay}
          </h3>
          {contextText && (
            <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 font-medium truncate mt-0.5">
              {contextText}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 max-w-full">
          {sparkline && (
            <MiniSparkline
              variant={sparkline}
              data={sparklineData}
            />
          )}

          {/* Master Skill Section 5.4: Explicit directional delta */}
          {delta && (
            <span
              className={`text-[9.5px] sm:text-[10px] md:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md border flex items-center gap-1 truncate max-w-full ${
                delta.direction === 'up'
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/70 dark:border-emerald-800/60'
                  : delta.direction === 'down'
                  ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200/70 dark:border-rose-800/60'
                  : 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {delta.direction === 'up' && <ArrowUp size={11} weight="bold" className="shrink-0" />}
              {delta.direction === 'down' && <ArrowDown size={11} weight="bold" className="shrink-0" />}
              <span>{delta.value}</span>
            </span>
          )}

          {!delta && subBadge && (
            <span
              className={`text-[9.5px] sm:text-[10px] md:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md border truncate max-w-full ${badgeStyles}`}
            >
              {subBadge}
            </span>
          )}
        </div>
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
