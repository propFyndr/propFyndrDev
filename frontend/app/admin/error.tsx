'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { WarningCircle, ArrowsClockwise, SidebarSimple } from '@phosphor-icons/react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminWorkspaceError]', error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 shadow-sm">
        <WarningCircle size={28} />
      </div>

      <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 border border-rose-200/80 dark:border-rose-800/80 px-3 py-1 rounded-full mb-3">
        Admin Section Exception
      </span>

      <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">
        Failed to Render Admin Section
      </h2>

      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mb-6 leading-relaxed font-medium">
        An error occurred while rendering this admin component. You can attempt to reload this section or return to the project directory.
      </p>

      {process.env.NODE_ENV === 'development' && error?.message && (
        <div className="w-full max-w-md mb-6 text-left bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono text-rose-300 overflow-x-auto max-h-28">
          {error.message}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowsClockwise size={14} />
          <span>Reload Component</span>
        </button>

        <Link
          href="/admin/projects"
          className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-all flex items-center gap-1.5"
        >
          <SidebarSimple size={14} />
          <span>Projects Directory</span>
        </Link>
      </div>
    </div>
  )
}
