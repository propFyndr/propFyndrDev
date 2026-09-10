'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Gauge,
  Buildings,
  UsersThree,
  IdentificationBadge,
  PhoneCall,
  NewspaperClipping,
  BookOpen,
  ChartLineUp,
  ChatCircleText,
  UsersFour,
  SignOut,
  MagnifyingGlass,
  CaretRight,
  SidebarSimple
} from '@phosphor-icons/react'
import { AnimatePresence, m } from 'framer-motion'
import { API_BASE } from '@/lib/env'

const NAV = [
  { href: '/admin',                       label: 'Dashboard',            icon: Gauge },
  { href: '/admin/projects',              label: 'Projects',             icon: Buildings },
  { href: '/admin/builders',              label: 'Builders',             icon: UsersThree },
  { href: '/admin/builder-applications',  label: 'Registrations',        icon: IdentificationBadge },
  { href: '/admin/leads',                 label: 'Leads',                icon: PhoneCall },
  { href: '/admin/news',                  label: 'News',                 icon: NewspaperClipping },
  { href: '/admin/blog',                  label: 'Blog',                 icon: BookOpen },
  { href: '/admin/conversations',         label: 'Conversations',        icon: ChatCircleText },
  { href: '/admin/analytics',             label: 'Analytics',            icon: ChartLineUp },
  { href: '/admin/team',                  label: 'Team',                 icon: UsersFour },
]

function breadcrumb(pathname: string): { label: string; href?: string }[] {
  const parts = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; href?: string }[] = [{ label: 'Admin', href: '/admin' }]

  if (parts.length > 1) {
    const section = parts[1]
    let label = section.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    if (section === 'builder-applications') label = 'Registrations'
    crumbs.push(parts.length > 2 ? { label, href: `/${parts[0]}/${section}` } : { label })
  }

  if (parts.length > 2) {
    const last = parts[2]
    crumbs.push({ label: last === 'new' ? 'New' : 'Edit' })
  }

  return crumbs
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [checking, setChecking]   = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCmdOpen((open) => !open)
      } else if (e.key === 'Escape' && cmdOpen) {
        setCmdOpen(false)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [cmdOpen])

  useEffect(() => {
    if (!cmdOpen) setCmdQuery('')
  }, [cmdOpen])

  const filteredNav = NAV.filter((nav) => nav.label.toLowerCase().includes(cmdQuery.trim().toLowerCase()))

  useEffect(() => {
    const crumbs = breadcrumb(pathname)
    const activeSection = crumbs.length > 1 ? crumbs.slice(1).map(c => c.label).join(' | ') : 'Dashboard'
    document.title = `${activeSection} | Admin PropFyndr`
  }, [pathname])

  useEffect(() => {
    if (pathname === '/admin/login') { setChecking(false); return }
    // NOTE: client-side only check — token presence is not proof of a valid session.
    // Per CLAUDE.md security rules, this needs server-side session verification (middleware/API guard), out of scope for this pass.
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    if (!token) { router.replace('/admin/login'); return }
    const headers = { 'Authorization': `Bearer ${token}` }
    fetch(`${API_BASE}/admin/projects?q=_check`, { headers })
      .then((r) => {
        if (r.status === 401) { localStorage.removeItem('admin_token'); router.replace('/admin/login') }
        else setChecking(false)
      })
      .catch(() => router.replace('/admin/login'))
  }, [pathname, router])

  if (pathname === '/admin/login') return <>{children}</>

  if (checking) {
    return (
      <div className="min-h-screen bg-[#EEEEEE] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  async function handleLogout() {
    const token = localStorage.getItem('admin_token')
    await fetch(`${API_BASE}/admin/auth`, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
    localStorage.removeItem('admin_token')
    router.push('/admin/login')
  }

  const crumbs = breadcrumb(pathname)

  return (
    <div className="h-[100dvh] min-h-[100dvh] bg-surface-3 dark:bg-zinc-950 font-sans text-text-primary selection:bg-slate-200 selection:text-text-primary flex overflow-hidden">
      
      {/* Command Palette */}
      <AnimatePresence>
        {cmdOpen && (
          <>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-50"
              onClick={() => setCmdOpen(false)}
            />
            <m.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-xl bg-white rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)] z-50 overflow-hidden"
            >
              <div className="flex items-center px-4 border-b border-zinc-200/50">
                <MagnifyingGlass size={18} weight="bold" className="text-zinc-400 mr-3" />
                <input
                  autoFocus
                  placeholder="Type a command or search..."
                  value={cmdQuery}
                  onChange={(e) => setCmdQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredNav[0]) {
                      router.push(filteredNav[0].href)
                      setCmdOpen(false)
                    }
                  }}
                  className="flex-1 py-4 bg-transparent outline-none text-[15px] font-medium text-zinc-900 placeholder:text-zinc-400"
                />
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-zinc-100 rounded text-[10px] font-medium text-zinc-500 font-sans border border-zinc-200">ESC</kbd>
                </div>
              </div>
              <div className="p-2 space-y-1">
                {filteredNav.length === 0 && (
                  <p className="px-3 py-4 text-center text-[13px] text-zinc-400 font-medium">No matches</p>
                )}
                {filteredNav.map((nav) => (
                  <button
                    key={nav.href}
                    onClick={() => { router.push(nav.href); setCmdOpen(false) }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-100/80 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <nav.icon size={18} weight="duotone" className="text-zinc-500 group-hover:text-zinc-900 transition-colors" />
                      <span className="text-[14px] font-medium text-zinc-700 group-hover:text-zinc-900">{nav.label}</span>
                    </div>
                    <span className="text-[12px] text-zinc-400 font-medium">Go to</span>
                  </button>
                ))}
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${isCollapsed ? 'hidden md:flex w-[68px]' : 'w-64 md:w-[260px]'}
        flex flex-col h-full bg-surface dark:bg-zinc-900 border-r border-border dark:border-zinc-800 shadow-xs
        fixed md:relative z-50 md:z-auto shrink-0
        transition-all duration-base ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Brand Header */}
        <div className="group h-14 pt-[env(safe-area-inset-top,0px)] flex items-center justify-center border-b border-zinc-100/80 dark:border-zinc-800 w-full px-3 shrink-0 relative box-content">
          {!isCollapsed ? (
            <>
              <div className="flex flex-1 items-center justify-center transition-opacity duration-300">
                <Image src="/images/icons/logo-wordmark-black.png" alt="PropFyndr" width={75} height={34} className="object-contain block dark:hidden" unoptimized />
                <Image src="/images/icons/logo-wordmark-white.png" alt="PropFyndr" width={75} height={34} className="object-contain hidden dark:block" unoptimized />
              </div>
              <div className="absolute right-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (window.innerWidth < 768) setMobileOpen(false);
                    else setIsCollapsed(true);
                  }}
                  className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <SidebarSimple size={18} weight="bold" />
                </button>
              </div>
            </>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
                <Image src="/images/icons/logo-square-black.png" alt="PropFyndr Logo" width={40} height={40} className="object-contain block dark:hidden" unoptimized />
                <Image src="/images/icons/logo-square-white.png" alt="PropFyndr Logo" width={40} height={40} className="object-contain hidden dark:block" unoptimized />
              </div>
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="absolute inset-0 m-auto w-10 h-10 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-all duration-200 cursor-pointer"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <SidebarSimple size={18} weight="bold" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((nav) => {
            const isActive = pathname === nav.href || (nav.href !== '/admin' && pathname.startsWith(nav.href))
            return (
              <div key={nav.href} className="relative group/navitem flex justify-center">
                <Link
                  href={nav.href}
                  onClick={() => setMobileOpen(false)}
                  className={`
                    flex items-center transition-all duration-base overflow-hidden whitespace-nowrap
                    ${isCollapsed ? 'w-10 h-10 rounded-md justify-center' : 'w-full gap-3 px-3 py-2.5 rounded-md'}
                    ${isActive
                      ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }
                  `}
                >
                  <nav.icon size={18} weight={isActive ? "fill" : "duotone"} className={isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500 group-hover/navitem:text-zinc-600 dark:group-hover/navitem:text-zinc-300'} />
                  {!isCollapsed && (
                    <span className="text-[13px] font-semibold tracking-wide">
                      {nav.label}
                    </span>
                  )}
                </Link>
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 py-1.5 px-2.5 bg-zinc-800 text-white text-[11px] font-medium rounded-md opacity-0 group-hover/navitem:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-xl">
                    {nav.label}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-border dark:border-zinc-800 space-y-1 shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <div className="relative group/navitem flex justify-center">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center transition-all duration-200 overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-10 h-10 rounded-md justify-center' : 'w-full gap-3 px-3 py-2.5 rounded-md'} text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/80 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100`}
            >
              <Buildings size={18} weight="duotone" className="text-zinc-400 dark:text-zinc-500 group-hover/navitem:text-zinc-600 dark:group-hover/navitem:text-zinc-300" />
              {!isCollapsed && <span className="text-[13px] font-semibold tracking-wide">View site</span>}
            </Link>
            {isCollapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 py-1.5 px-2.5 bg-zinc-800 text-white text-[11px] font-medium rounded-md opacity-0 group-hover/navitem:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-xl">
                View site
              </div>
            )}
          </div>

          <div className="relative group/navitem flex justify-center">
            <button
              type="button"
              onClick={handleLogout}
              className={`flex items-center transition-all duration-base overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-10 h-10 rounded-md justify-center' : 'w-full gap-3 px-3 py-2.5 rounded-md'} text-zinc-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 cursor-pointer`}
            >
              <SignOut size={18} weight="bold" className="text-zinc-400 dark:text-zinc-500 group-hover/navitem:text-red-500" />
              {!isCollapsed && <span className="text-[13px] font-semibold tracking-wide">Sign Out</span>}
            </button>
            {isCollapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 py-1.5 px-2.5 bg-zinc-800 text-white text-[11px] font-medium rounded-md opacity-0 group-hover/navitem:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-xl">
                Sign Out
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden bg-slate-50/70 dark:bg-zinc-950/70">

        {/* Top bar - Notch Aware */}
        <header className="pt-[env(safe-area-inset-top,0px)] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 shrink-0 px-3 sm:px-6 flex items-center justify-between z-40 transition-colors">
          <div className="h-14 flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex flex-col justify-center items-start gap-[4.5px] p-2 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Open Navigation"
            >
              <span className="w-[16px] h-[2px] bg-current rounded-full" />
              <span className="w-[16px] h-[2px] bg-current rounded-full" />
            </button>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold min-w-0">
              <Buildings size={16} weight="duotone" className="text-zinc-400 dark:text-zinc-500 shrink-0 hidden sm:inline" />
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  {i > 0 && <CaretRight size={12} weight="bold" className="text-zinc-300 dark:text-zinc-600 flex-shrink-0" />}
                  {c.href && i < crumbs.length - 1 ? (
                    <Link
                      href={c.href}
                      className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white px-1.5 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all truncate"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold px-2 py-0.5 sm:py-1 bg-zinc-100/90 dark:bg-zinc-800/90 rounded-md border border-zinc-200/60 dark:border-zinc-700/60 truncate shadow-2xs">
                      {c.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          {/* Command shortcut hint */}
          <button 
            type="button"
            onClick={() => setCmdOpen(true)}
            className="hidden md:flex items-center gap-2.5 px-3 py-1.5 bg-zinc-100/80 hover:bg-zinc-200/70 dark:bg-zinc-800/70 dark:hover:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/70 rounded-full text-xs font-medium text-zinc-500 dark:text-zinc-400 transition-all shadow-2xs hover:shadow-xs group cursor-pointer"
          >
            <MagnifyingGlass size={14} weight="bold" className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
            <span className="font-semibold text-[11.5px]">Search</span>
            <kbd className="font-sans text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 shadow-2xs">⌘K</kbd>
          </button>
        </header>

        {/* Page Main View */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 w-full bg-slate-50/50 dark:bg-zinc-950/50 relative pb-20 md:pb-8">{children}</main>

        {/* Mobile Bottom Navigation Tab Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 px-1 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] flex items-center justify-around shadow-lg">
          {NAV.slice(0, 5).map((nav) => {
            const isActive = pathname === nav.href || (nav.href !== '/admin' && pathname.startsWith(nav.href))
            return (
              <Link
                key={nav.href}
                href={nav.href}
                className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all duration-200 min-w-[48px] ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
                    : 'text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <nav.icon size={18} weight={isActive ? "fill" : "duotone"} className={isActive ? 'text-blue-600 dark:text-blue-400' : ''} />
                <span className="text-[9.5px] tracking-tight mt-0.5 font-semibold">{nav.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
