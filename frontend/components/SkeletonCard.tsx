'use client'

// Mirrors ProjectCard's geometry (mobile: 110px thumbnail row; desktop: 220px
// hero + body) so the real card replaces it without a layout shift.
export default function SkeletonCard({ layout = 'grid' }: { layout?: 'grid' | 'list' }) {
  if (layout === 'list') {
    return (
      <div className="w-full rounded-2xl overflow-hidden border border-border bg-surface dark:bg-zinc-900 p-3 flex gap-3 min-h-[135px]">
        <div className="flex-1 space-y-2 py-1">
          <div className="h-5 img-skeleton rounded-full w-24" />
          <div className="h-4 img-skeleton rounded-xs w-2/3" />
          <div className="h-3 img-skeleton rounded-xs w-1/2" />
          <div className="h-4 img-skeleton rounded-xs w-1/3" />
        </div>
        <div className="w-[110px] sm:w-[125px] img-skeleton rounded-sm shrink-0" />
      </div>
    )
  }

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-border bg-surface dark:bg-zinc-900 flex flex-col">
      <div className="h-[220px] img-skeleton w-full shrink-0" />
      <div className="px-5 pt-4 pb-5 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 img-skeleton rounded-xs w-3/4" />
          <div className="h-4 img-skeleton rounded-xs w-1/2" />
          <div className="h-5 img-skeleton rounded-xs w-1/3 mt-3" />
          <div className="h-[76px] img-skeleton rounded-xs w-full mt-3" />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <div className="h-11 img-skeleton rounded-xs flex-1" />
          <div className="h-10 w-10 img-skeleton rounded-full" />
          <div className="h-10 w-10 img-skeleton rounded-full" />
        </div>
      </div>
    </div>
  )
}
