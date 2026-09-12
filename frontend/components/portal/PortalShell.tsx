'use client'

/**
 * The one panel chrome, used by all three consoles: PropFyndr admin, the
 * builder portal and the channel-partner portal. Extracted from the admin
 * layout so the builder and partner consoles look like the admin panel by
 * construction rather than by someone remembering to copy a class list.
 *
 * Each console passes its own nav and its own allowed roles. The session check
 * lives here and runs once: /portal/me is the only endpoint every role may
 * call, and it returns the role, so a signed-in user who opens the wrong
 * console is redirected to their own rather than shown a shell whose every
 * request will 403.
 */

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Buildings,
  SignOut,
  MagnifyingGlass,
  CaretRight,
  SidebarSimple,
} from '@phosphor-icons/react'
import { AnimatePresence, m } from 'framer-motion'
import { API_BASE } from '@/lib/env'
import { adminFetch } from '@/lib/adminFetch'
import { ScopeParam, useScopeId } from '@/lib/portalScope'

export interface PortalNavItem {
  href: string
  label: string
  icon: React.ElementType
}

export type PortalRole = 'SUPER_ADMIN' | 'ANALYST' | 'SALES' | 'BUILDER' | 'PARTNER'

/** Where each role belongs when it lands on a console that is not its own. */
export const HOME_FOR_ROLE: Record<PortalRole, string> = {
  SUPER_ADMIN: '/admin',
  ANALYST: '/admin',
  SALES: '/admin',
  BUILDER: '/builder/portal',
  PARTNER: '/partner/portal',
}

interface Props {
  nav: PortalNavItem[]
  /** Dashboard route of this console — the first breadcrumb and the nav root. */
  rootHref: string
  /** Human name of this console, e.g. "Admin", "Builder", "Partner". */
  rootLabel: string
  /** Roles allowed to see this console. Anything else is sent to its own home. */
  allowRoles: PortalRole[]
  /**
   * Set on a console that belongs to someone else (builder, partner). A
   * PropFyndr role opening it must name whose console it is in the URL; without
   * that the portal endpoints have no scope and 400 on every call, which used
   * to surface as a bare "could not load". Owners of the console are unaffected
   * — their id comes from the session.
   */
  scopeParam?: ScopeParam
  /** The role that owns this console and therefore needs no scope in the URL. */
  ownRole?: PortalRole
  children: React.ReactNode
}

/** "builder-applications" -> "Builder Applications" */
function titleCase(segment: string): string {
  return segment.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

export default function PortalShell({ nav, rootHref, rootLabel, allowRoles, scopeParam, ownRole, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [role, setRole] = useState<PortalRole | null>(null)
  const scopeId = useScopeId(scopeParam ?? 'builder_id')
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

  const filteredNav = nav.filter((n) => n.label.toLowerCase().includes(cmdQuery.trim().toLowerCase()))

  // Breadcrumbs, derived from whatever sits below rootHref.
  const rest = pathname.startsWith(rootHref) ? pathname.slice(rootHref.length).split('/').filter(Boolean) : []
  const crumbs: { label: string; href?: string }[] = [{ label: rootLabel, href: rootHref }]
  if (rest.length > 0) {
    const section = rest[0]
    const label = section === 'builder-applications' ? 'Registrations' : titleCase(section)
    crumbs.push(rest.length > 1 ? { label, href: `${rootHref}/${section}` } : { label })
  }
  if (rest.length > 1) crumbs.push({ label: rest[1] === 'new' ? 'New' : 'Edit' })

  useEffect(() => {
    const active = crumbs.length > 1 ? crumbs.slice(1).map((c) => c.label).join(' | ') : 'Dashboard'
    document.title = `${active} | ${rootLabel} PropFyndr`
    // crumbs is derived from pathname; tracking pathname is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, rootLabel])

  useEffect(() => {
    let cancelled = false
    adminFetch('/portal/me')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((me: { role: PortalRole }) => {
        if (cancelled) return
        if (!allowRoles.includes(me.role)) {
          router.replace(HOME_FOR_ROLE[me.role] ?? '/admin/login')
          return
        }
        setRole(me.role)
        setChecking(false)
      })
      .catch(() => {
        if (cancelled) return
        // adminFetch already clears the token and redirects on a 401; this
        // covers a network failure or an unexpected status.
        router.replace('/admin/login')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogout() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    try {
      await fetch(`${API_BASE}/admin/auth`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch {
      // Signing out locally matters more than the server acknowledging it.
    }
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_role')
    router.push('/admin/login')
  }

  // A console that belongs to someone else, opened by a PropFyndr role that has
  // not said whose. Render the chrome and explain, rather than letting every
  // child page fire a request the server will reject for lack of scope.
  const scopeNeeded = Boolean(scopeParam) && role !== null && role !== ownRole && !scopeId

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-800 dark:border-zinc-200 border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

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
              className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)] z-50 overflow-hidden"
            >
              <div className="flex items-center px-4 border-b border-zinc-200/50 dark:border-zinc-800">
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
                  className="flex-1 py-4 bg-transparent outline-none text-[15px] font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                />
                <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-medium text-zinc-500 font-sans border border-zinc-200 dark:border-zinc-700">ESC</kbd>
              </div>
              <div className="p-2 space-y-1">
                {filteredNav.length === 0 && (
                  <p className="px-3 py-4 text-center text-[13px] text-zinc-400 font-medium">No matches</p>
                )}
                {filteredNav.map((n) => (
                  <button
                    key={n.href}
                    onClick={() => { router.push(n.href); setCmdOpen(false) }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <n.icon size={18} weight="duotone" className="text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors" />
                      <span className="text-[14px] font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">{n.label}</span>
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
                    if (window.innerWidth < 768) setMobileOpen(false)
                    else setIsCollapsed(true)
                  }}
                  className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
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
                <Image src="/images/icons/logo-square-black.png" alt="PropFyndr" width={40} height={40} className="object-contain block dark:hidden" unoptimized />
                <Image src="/images/icons/logo-square-white.png" alt="PropFyndr" width={40} height={40} className="object-contain hidden dark:block" unoptimized />
              </div>
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="absolute inset-0 m-auto w-10 h-10 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all duration-200 cursor-pointer"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <SidebarSimple size={18} weight="bold" />
              </button>
            </div>
          )}
        </div>

        {/* Console label — the one thing that tells the three consoles apart. */}
        {!isCollapsed && (
          <div className="px-4 pt-3 pb-1 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {rootLabel} Console
            </span>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {nav.map((n) => {
            const isActive = pathname === n.href || (n.href !== rootHref && pathname.startsWith(n.href))
            return (
              <div key={n.href} className="relative group/navitem flex justify-center">
                <Link
                  href={n.href}
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
                  <n.icon size={18} weight={isActive ? 'fill' : 'duotone'} className={isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500 group-hover/navitem:text-zinc-600 dark:group-hover/navitem:text-zinc-300'} />
                  {!isCollapsed && <span className="text-[13px] font-semibold tracking-wide">{n.label}</span>}
                </Link>
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 py-1.5 px-2.5 bg-zinc-800 text-white text-[11px] font-medium rounded-md opacity-0 group-hover/navitem:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-xl">
                    {n.label}
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

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 w-full bg-slate-50/50 dark:bg-zinc-950/50 relative pb-20 md:pb-8">
          {scopeNeeded ? (
            <div className="max-w-xl mx-auto px-6 py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-center mx-auto mb-5 text-zinc-400">
                <Buildings size={22} weight="duotone" />
              </div>
              <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100">
                Pick whose console to open
              </h2>
              <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                You are signed in as {role}, so this console has no owner attached. Open it from a row
                in Partners — those links carry the right id — or add
                {' '}<code className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">?{scopeParam}=…</code>{' '}
                to the address.
              </p>
              <Link
                href="/admin/partners"
                className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[13px] font-bold transition-all active:scale-[0.98]"
              >
                Go to Partners
              </Link>
            </div>
          ) : children}
        </main>

        {/* Mobile tab bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 px-1 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] flex items-center justify-around shadow-lg">
          {nav.slice(0, 5).map((n) => {
            const isActive = pathname === n.href || (n.href !== rootHref && pathname.startsWith(n.href))
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all duration-200 min-w-[48px] ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
                    : 'text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <n.icon size={18} weight={isActive ? 'fill' : 'duotone'} className={isActive ? 'text-blue-600 dark:text-blue-400' : ''} />
                <span className="text-[9.5px] tracking-tight mt-0.5 font-semibold">{n.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
