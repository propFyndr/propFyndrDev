// frontend/components/skeletons/index.tsx
// Unified skeleton loading component library.
// Use these instead of spinners or empty divs anywhere data is being fetched.

'use client'

/** A horizontal shimmer bar — use for text lines */
export function TextSkeleton({ className = '' }: { className?: string }) {
  return <div className={`h-4 img-skeleton rounded ${className}`} />
}

/** A property card skeleton — matches the exact dimensions of a PropertyCard */
export function PropertyCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden border border-black/5 dark:border-white/10 bg-surface dark:bg-surface-2 shadow-sm">
      {/* Image area */}
      <div className="h-52 img-skeleton" />
      {/* Content area */}
      <div className="p-4 space-y-3">
        <TextSkeleton className="w-3/4" />
        <TextSkeleton className="w-1/2 h-3" />
        <div className="flex gap-2">
          <TextSkeleton className="w-14 h-6 rounded-full" />
          <TextSkeleton className="w-14 h-6 rounded-full" />
        </div>
        <TextSkeleton className="w-full h-1.5 rounded-full" />
      </div>
    </div>
  )
}

/** A grid of property card skeletons */
export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Admin Catalog exact column-matched table row skeleton */
export function AdminTableRowSkeleton() {
  return (
    <div className="flex items-center px-4 md:px-6 py-3.5 gap-4 border-b border-zinc-100 dark:border-zinc-800/60 animate-in fade-in duration-150">
      {/* Select checkbox */}
      <div className="w-4 h-4 rounded img-skeleton shrink-0 hidden md:block" />

      {/* Thumbnail */}
      <div className="w-8 h-8 rounded-lg img-skeleton shrink-0" />

      {/* Title & Builder */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="w-44 md:w-56 h-3.5 img-skeleton rounded" />
        <div className="w-28 md:w-36 h-2.5 img-skeleton rounded opacity-70" />
      </div>

      {/* Status Pill */}
      <div className="w-24 h-6 rounded-full img-skeleton shrink-0 hidden sm:block" />

      {/* Price */}
      <div className="w-[120px] pr-6 flex justify-end shrink-0 hidden md:flex">
        <div className="w-20 h-4 img-skeleton rounded" />
      </div>

      {/* Health Score Pill */}
      <div className="w-[90px] pr-6 flex justify-end shrink-0">
        <div className="w-14 h-6 rounded-lg img-skeleton" />
      </div>

      {/* Actions */}
      <div className="w-[60px] flex justify-end shrink-0">
        <div className="w-6 h-6 rounded-md img-skeleton" />
      </div>
    </div>
  )
}

/** Block of admin catalog table row skeletons */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-surface dark:bg-surface-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/60">
      {Array.from({ length: rows }).map((_, i) => (
        <AdminTableRowSkeleton key={i} />
      ))}
    </div>
  )
}

/** Admin 2-column Project Editor Skeleton matching tabs and layout */
export function AdminProjectEditorSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-200">
      {/* Left Column: Form Fields */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-surface dark:bg-surface-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="w-40 h-5 img-skeleton rounded" />
            <div className="w-20 h-4 img-skeleton rounded" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="w-24 h-3 img-skeleton rounded" />
              <div className="w-full h-10 img-skeleton rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="w-24 h-3 img-skeleton rounded" />
              <div className="w-full h-10 img-skeleton rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-32 h-3 img-skeleton rounded" />
            <div className="w-full h-24 img-skeleton rounded-xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="w-20 h-3 img-skeleton rounded" />
              <div className="w-full h-10 img-skeleton rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="w-20 h-3 img-skeleton rounded" />
              <div className="w-full h-10 img-skeleton rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="w-20 h-3 img-skeleton rounded" />
              <div className="w-full h-10 img-skeleton rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Tab Audit & Buyer Preview Card */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-surface dark:bg-surface-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-32 h-4 img-skeleton rounded" />
            <div className="w-12 h-6 rounded-full img-skeleton" />
          </div>
          <div className="w-full h-2 img-skeleton rounded-full" />
          <div className="space-y-2.5 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="w-36 h-3 img-skeleton rounded" />
                <div className="w-4 h-4 rounded-full img-skeleton" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface dark:bg-surface-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 space-y-3">
          <div className="w-28 h-4 img-skeleton rounded" />
          <div className="w-full h-36 img-skeleton rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/** Public Property Detail — Overview Tab Bento Grid Skeleton */
export function OverviewBentoSkeleton() {
  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* USP 4-Chip Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface dark:bg-surface-2 ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-2xl sm:rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center text-center min-h-[82px] sm:min-h-[108px] space-y-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl img-skeleton" />
            <div className="w-16 h-3.5 img-skeleton rounded" />
            <div className="w-12 h-2.5 img-skeleton rounded opacity-70" />
          </div>
        ))}
      </div>

      {/* Highlights & DNA Bento Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-7 bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-4 min-h-[260px]">
          <div className="w-48 h-5 img-skeleton rounded" />
          <div className="w-full h-3 img-skeleton rounded" />
          <div className="w-4/5 h-3 img-skeleton rounded" />
          <div className="w-3/5 h-3 img-skeleton rounded" />
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="h-16 img-skeleton rounded-xl" />
            <div className="h-16 img-skeleton rounded-xl" />
          </div>
        </div>

        <div className="lg:col-span-5 bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-4 min-h-[260px]">
          <div className="w-36 h-5 img-skeleton rounded" />
          <div className="w-full h-40 img-skeleton rounded-xl" />
        </div>
      </div>

      {/* Recent Construction & Amenities Strip */}
      <div className="bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-4">
        <div className="w-40 h-5 img-skeleton rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 img-skeleton rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Public Property Detail — Residences / Floor Plans Tab Skeleton */
export function ResidencesSkeletonFull() {
  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Header & Filter Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="w-56 h-6 img-skeleton rounded" />
          <div className="w-72 h-3.5 img-skeleton rounded opacity-70" />
        </div>
        <div className="w-48 h-10 img-skeleton rounded-2xl" />
      </div>

      {/* BHK Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-28 h-9 rounded-full img-skeleton shrink-0" />
        ))}
      </div>

      {/* 12-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Floor Plan Blueprint (5 cols) */}
        <div className="lg:col-span-5 bg-surface dark:bg-surface-2 rounded-lg p-5 border border-black/5 dark:border-white/10 space-y-4 min-h-[420px]">
          <div className="w-full h-72 img-skeleton rounded-xl" />
          <div className="flex justify-between items-center pt-2">
            <div className="w-24 h-4 img-skeleton rounded" />
            <div className="w-20 h-6 rounded-full img-skeleton" />
          </div>
        </div>

        {/* Right Column: Unit Specs & Metrics (7 cols) */}
        <div className="lg:col-span-7 bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="w-48 h-5 img-skeleton rounded" />
              <div className="w-32 h-4 img-skeleton rounded" />
            </div>
            <div className="w-28 h-8 rounded-xl img-skeleton" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-1.5">
                <div className="w-16 h-2.5 img-skeleton rounded" />
                <div className="w-20 h-4 img-skeleton rounded" />
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-2">
            <div className="w-36 h-4 img-skeleton rounded" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 img-skeleton rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Pricing & Cost Sheet Tab Skeleton */
export function PricingTabSkeleton() {
  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Price Summary Banner */}
      <div className="bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="w-40 h-5 img-skeleton rounded" />
            <div className="w-56 h-3 img-skeleton rounded" />
          </div>
          <div className="w-32 h-8 rounded-xl img-skeleton" />
        </div>
      </div>

      {/* Payment Plan Timeline Milestones */}
      <div className="bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-4">
        <div className="w-44 h-5 img-skeleton rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-2">
              <div className="w-20 h-3 img-skeleton rounded" />
              <div className="w-28 h-4 img-skeleton rounded" />
              <div className="w-16 h-3 img-skeleton rounded opacity-70" />
            </div>
          ))}
        </div>
      </div>

      {/* Cost Sheet Rows */}
      <div className="bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-3">
        <div className="w-36 h-4 img-skeleton rounded mb-2" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800/60">
            <div className="w-48 h-3.5 img-skeleton rounded" />
            <div className="w-20 h-3.5 img-skeleton rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Location & Commute Matrix Tab Skeleton */
export function LocationTabSkeleton() {
  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Map Placeholder */}
      <div className="w-full h-72 img-skeleton rounded-lg" />

      {/* Commute Matrix POI Rows */}
      <div className="bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-4">
        <div className="w-44 h-5 img-skeleton rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
              <div className="w-8 h-8 rounded-lg img-skeleton shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="w-28 h-3 img-skeleton rounded" />
                <div className="w-16 h-2.5 img-skeleton rounded opacity-70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Builder Scorecard Tab Skeleton */
export function BuilderTabSkeleton() {
  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Builder Header */}
      <div className="bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl img-skeleton shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="w-48 h-5 img-skeleton rounded" />
          <div className="w-32 h-3.5 img-skeleton rounded opacity-70" />
        </div>
      </div>

      {/* 4 Metric Scorecard Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface dark:bg-surface-2 rounded-2xl p-4 border border-black/5 dark:border-white/10 space-y-2 text-center">
            <div className="w-20 h-3 img-skeleton rounded mx-auto" />
            <div className="w-16 h-6 img-skeleton rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Intelligence & Decision Tab Skeleton */
export function IntelligenceTabSkeleton() {
  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Thesis Banner */}
      <div className="bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-3">
        <div className="w-40 h-5 img-skeleton rounded" />
        <div className="w-full h-3 img-skeleton rounded" />
        <div className="w-4/5 h-3 img-skeleton rounded" />
      </div>

      {/* Why Buy vs Why Avoid 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-3">
          <div className="w-28 h-4 img-skeleton rounded" />
          <div className="space-y-2">
            <div className="w-full h-3 img-skeleton rounded" />
            <div className="w-5/6 h-3 img-skeleton rounded" />
            <div className="w-4/6 h-3 img-skeleton rounded" />
          </div>
        </div>

        <div className="bg-surface dark:bg-surface-2 rounded-lg p-6 border border-black/5 dark:border-white/10 space-y-3">
          <div className="w-28 h-4 img-skeleton rounded" />
          <div className="space-y-2">
            <div className="w-full h-3 img-skeleton rounded" />
            <div className="w-5/6 h-3 img-skeleton rounded" />
            <div className="w-4/6 h-3 img-skeleton rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Chat Sidebar Date-Grouped History Skeleton.
 *  Rows mirror the real SessionItem: h-9 px-2.5 rounded-xs, no icon, a title
 *  bar and a short timestamp slot on the right. */
export function ChatSidebarGroupedSkeleton() {
  const row = (w: string, i: number) => (
    <div key={i} className="flex items-center gap-2 h-9 px-2.5 rounded-xs">
      <div className={`h-3 rounded img-skeleton ${w}`} />
      <div className="ml-auto w-8 h-2.5 rounded img-skeleton opacity-60 shrink-0" />
    </div>
  )
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="space-y-0.5">
        <div className="w-14 h-2.5 img-skeleton rounded mx-2.5 mb-2 opacity-60" />
        {['w-3/4', 'w-2/3', 'w-4/5'].map(row)}
      </div>
      <div className="space-y-0.5 pt-1">
        <div className="w-16 h-2.5 img-skeleton rounded mx-2.5 mb-2 opacity-60" />
        {['w-2/3', 'w-3/5'].map(row)}
      </div>
    </div>
  )
}

/** Stat card skeleton — use in admin dashboard while metrics load */
export function StatCardSkeleton() {
  return (
    <div className="bg-surface dark:bg-surface-2 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 img-skeleton rounded-xl" />
        <div className="w-12 h-5 img-skeleton rounded-full" />
      </div>
      <TextSkeleton className="w-24 h-3 mb-2" />
      <TextSkeleton className="w-20 h-8" />
    </div>
  )
}

/** Full-page skeleton for the discover/chat page */
export function DiscoverySkeleton() {
  return (
    <div className="flex h-screen">
      {/* Sidebar skeleton */}
      <div className="w-64 border-r border-zinc-100 dark:border-zinc-800 p-4 space-y-3 hidden md:block">
        <div className="h-8 img-skeleton rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 img-skeleton rounded-xl" />
        ))}
      </div>
      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col p-6 gap-4">
        <div className="flex-1 space-y-4">
          <div className="max-w-sm h-16 img-skeleton rounded-2xl" />
          <div className="max-w-md h-24 img-skeleton rounded-2xl ml-auto" />
          <div className="max-w-lg h-40 img-skeleton rounded-2xl" />
        </div>
        <div className="h-14 img-skeleton rounded-2xl" />
      </div>
    </div>
  )
}

/** Message stream skeleton for a restoring chat. Same measure (768px) and the
 *  same top padding as the real feed, so it is not clipped under the header. */
export function ChatPhase2Skeleton() {
  return (
    <div className="flex-1 w-full px-3 sm:px-4 md:px-6 lg:px-8 pt-16 pb-6 animate-in fade-in duration-200">
      <div className="max-w-[768px] mx-auto space-y-6 sm:space-y-8">
        {/* User question (right-aligned) */}
        <div className="flex justify-end">
          <div className="w-56 sm:w-72 h-11 img-skeleton rounded-2xl" />
        </div>

        {/* Answer text */}
        <div className="space-y-2.5">
          <div className="w-full h-3 img-skeleton rounded" />
          <div className="w-11/12 h-3 img-skeleton rounded" />
          <div className="w-3/5 h-3 img-skeleton rounded" />
        </div>

        {/* Result card */}
        <div className="rounded-2xl p-5 border border-border bg-surface dark:bg-surface-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-40 h-3.5 img-skeleton rounded" />
            <div className="w-20 h-5 img-skeleton rounded-full" />
          </div>
          <div className="w-3/4 h-3 img-skeleton rounded" />
          <div className="w-1/2 h-3 img-skeleton rounded opacity-70" />
        </div>

        {/* Follow-up chips */}
        <div className="flex flex-wrap gap-2">
          <div className="w-36 h-9 img-skeleton rounded-full" />
          <div className="w-44 h-9 img-skeleton rounded-full" />
          <div className="w-32 h-9 img-skeleton rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** Discovery home skeleton — same geometry as the real empty state: wordmark,
 *  tagline and hint line, the 768px composer (rounded-2xl), and four chips. */
export function DiscoveryHomeSkeleton() {
  return (
    <div className="discover-canvas flex-1 h-full w-full flex flex-col items-center justify-center px-4 sm:px-6 py-8 animate-in fade-in duration-150">
      {/* Hero */}
      <div className="relative w-full max-w-[768px] flex flex-col items-center mb-8">
        <div className="w-64 md:w-[340px] max-w-full h-[4.2rem] md:h-[5.5rem] img-skeleton rounded-sm" />
        <div className="mt-2 w-40 md:w-48 h-8 img-skeleton rounded-xs opacity-70" />
        <div className="mt-4 w-72 sm:w-[440px] max-w-full h-4 img-skeleton rounded opacity-60" />
      </div>

      {/* Composer */}
      <div className="relative w-full max-w-[768px] h-[108px] mb-6 rounded-2xl img-skeleton" />

      {/* Four prompt chips */}
      <div className="relative w-full max-w-[768px] grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
        {['sm:w-44', 'sm:w-40', 'sm:w-44', 'sm:w-40'].map((w, i) => (
          <div key={i} className={`h-10 w-full ${w} rounded-full img-skeleton`} />
        ))}
      </div>
    </div>
  )
}
