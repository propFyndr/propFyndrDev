'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, Building2, Users } from 'lucide-react'

export default function AnalyticsNav() {
  const pathname = usePathname()

  const navs = [
    { name: 'Dashboard', path: '/admin/analytics', icon: LayoutDashboard },
    { name: 'Search Analytics', path: '/admin/analytics/search', icon: Search },
    { name: 'Property Engagement', path: '/admin/analytics/properties', icon: Building2 },
    { name: 'User Behavior', path: '/admin/analytics/users', icon: Users },
  ]

  return (
    <nav className="grid grid-cols-2 sm:inline-flex sm:items-center gap-1.5 p-1 bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/60 rounded-2xl shadow-2xs w-full sm:w-auto">
      {navs.map((n) => {
        const isActive = pathname === n.path
        const Icon = n.icon
        return (
          <Link
            key={n.name}
            href={n.path}
            className={`px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center sm:justify-start gap-2 min-w-0 ${
              isActive
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white/40 dark:hover:bg-zinc-850'
            }`}
          >
            <Icon size={14} className={`shrink-0 ${isActive ? 'text-[#0066cc] dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
            <span className="truncate">{n.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
