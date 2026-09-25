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

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Buildings,
  SignOut,
  MagnifyingGlass,
  CaretRight,
  SidebarSimple,
  CircleNotch,
  ArrowRight,
  ArrowLeft,
  ArrowSquareOut,
  UserGear,
  CurrencyInr,
  CalendarBlank,
  SealCheck,
  Copy,
  Check,
  MapPin,
  PencilSimple,
} from '@phosphor-icons/react'
import { AnimatePresence, m } from 'framer-motion'
import { adminFetch } from '@/lib/adminFetch'
import { ScopeParam, useScopeId } from '@/lib/portalScope'
import { tenantFromHost } from '@/lib/subdomain'
import { API_BASE } from '@/lib/env'

export interface PortalNavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: PortalRole[]
  section?: string
}

export type PortalRole = 'SUPER_ADMIN' | 'ANALYST' | 'SALES' | 'BUILDER' | 'PARTNER'

/**
 * Where each role belongs when it lands on a console that is not its own.
 *
 * The three staff roles used to share `/admin`, which meant a salesperson and
 * an analyst both opened a platform dashboard built for neither — with the nav
 * items they could not use hidden, so it read as a screen with holes in it.
 * Each now lands on the board that answers its own first question of the day.
 * `/admin` stays as the super admin's platform view.
 */
export const HOME_FOR_ROLE: Record<PortalRole, string> = {
  SUPER_ADMIN: '/admin',
  ANALYST: '/admin/quality',
  SALES: '/admin/queue',
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

/**
 * Exactly the fields the three lines below read, and nothing else.
 *
 * Narrow on purpose rather than importing `ProjectDetail` from `types/project`:
 * this reads an admin search result, which is a different projection of the
 * same row, and a wider type here would be a claim about fields the endpoint
 * does not promise to send. Every one is optional because "absent" is a real
 * answer these helpers give — see the `Not recorded` returns.
 */
interface ProjectFactsShape {
  price_range_label?: string | null
  price_min_cr?: number | null
  possession_label?: string | null
  possession_date?: string | null
  unit_types?: Array<{
    bhk?: number | null
    price_min_cr?: number | null
    price_max_cr?: number | null
  }> | null
  name?: string
  sector?: string | null
  rera_number?: string | null
  builder?: { name?: string } | null
}

function projectPriceLine(p: ProjectFactsShape): string {
  if (p?.price_range_label) return p.price_range_label
  const units = p?.unit_types ?? []
  const mins = units.map((u) => u.price_min_cr).filter((v): v is number => v != null)
  const maxes = units.map((u) => u.price_max_cr).filter((v): v is number => v != null)
  if (mins.length && maxes.length) return `₹${Math.min(...mins)} – ${Math.max(...maxes)} Cr`
  if (p?.price_min_cr != null) return `From ₹${p.price_min_cr} Cr`
  return 'Not recorded'
}

function projectPossessionLine(p: ProjectFactsShape): string {
  if (p?.possession_label) return p.possession_label
  if (!p?.possession_date) return 'Not recorded'
  try {
    return new Date(p.possession_date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  } catch {
    return String(p.possession_date)
  }
}

function projectConfigLine(p: ProjectFactsShape): string {
  const units = p?.unit_types ?? []
  const bhks = [...new Set(units.map((u) => u.bhk).filter((b): b is number => b != null))].sort()
  if (!bhks.length) return 'Not recorded'
  return bhks.map((b) => `${b}BHK`).join(', ')
}

export default function PortalShell({ nav, rootHref, rootLabel, allowRoles, scopeParam, ownRole, children }: Props) {
  const router = useRouter()
  /**
   * The tenant whose subdomain this was opened on, if any.
   *
   * Branding only. `lib/subdomain.ts` says it from the routing side and this
   * says it again here: the host decides what the sidebar is LABELLED, never
   * what the session may read. A builder who types someone else's subdomain
   * still sees their own data — every portal endpoint re-derives scope from the
   * session — they just see the wrong name above it, which is a cosmetic
   * oddity rather than a leak.
   */
  const [tenantName, setTenantName] = useState<string | null>(null)
  /** The builder or partner this session belongs to, from the session itself. */
  const [orgName, setOrgName] = useState<string | null>(null)

  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [role, setRole] = useState<PortalRole | null>(null)
  /**
   * What this console is called for the person looking at it.
   *
   * It said "Admin Console" to everyone, so a salesperson and an analyst saw
   * the same words over two different sets of screens and had no signal about
   * which account they were in — which matters most for the people who hold
   * more than one.
   *
   * Falls back to the console's own name until the role resolves, so the label
   * never flickers through a wrong value on its way to the right one.
   */
  const ROLE_LABEL: Record<PortalRole, string> = {
    SUPER_ADMIN: 'Admin Console',
    ANALYST: 'Analyst Console',
    SALES: 'Sales Console',
    BUILDER: 'Builder Console',
    PARTNER: 'Partner Console',
  }
  const consoleLabel = role ? ROLE_LABEL[role] : `${rootLabel} Console`

  /**
   * The org name is preferred over the tenant slug's name when both exist.
   *
   * The tenant comes from the host, which anyone can type; the org comes from
   * the session, which they cannot. If the two ever disagree the session is the
   * true one, and showing it is what stops a builder acting on the assumption
   * that the address bar told them where they are.
   */
  const whoAmI = orgName ?? tenantName
  const scopeId = useScopeId(scopeParam ?? 'builder_id')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<any | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)
  const [copiedFacts, setCopiedFacts] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCmdOpen((open) => !open)
      } else if (e.key === 'Escape' && cmdOpen) {
        if (selectedProject) {
          setSelectedProject(null)
        } else {
          setCmdOpen(false)
        }
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [cmdOpen, selectedProject])

  useEffect(() => {
    if (!cmdOpen) {
      setCmdQuery('')
      setSelectedProject(null)
      setCopiedFacts(false)
    }
  }, [cmdOpen])

  /**
   * Resolve the host's tenant label, once, client-side.
   *
   * `lib/subdomain.ts` already decides what counts as a tenant host; this
   * reuses that rule rather than parsing the host a second way, so the two
   * cannot disagree about whether `www` or a Vercel preview is a tenant.
   * A miss leaves the label as the console name — the plain shell, never a
   * half-branded one.
   */
  useEffect(() => {
    const slug = tenantFromHost(typeof window === 'undefined' ? null : window.location.host)
    if (!slug) return
    let cancelled = false
    fetch(`${API_BASE}/portal/tenant/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((t: { name?: string }) => { if (!cancelled && t?.name) setTenantName(t.name) })
      .catch(() => { /* Unknown tenant: plain console label. */ })
    return () => { cancelled = true }
  }, [])

  /**
   * The sections this signed-in role may actually open.
   *
   * Computed before the role resolves as "nothing role-restricted", so the
   * sidebar never flashes a Team link and then removes it.
   */
  const visibleNav = nav.filter((n) => !n.roles || (role !== null && n.roles.includes(role)))

  const filteredNav = visibleNav.filter((n) => n.label.toLowerCase().includes(cmdQuery.trim().toLowerCase()))

  const [projectResults, setProjectResults] = useState<Array<{ id: string; name: string; sector: string; city: string; status: string; builder?: { name: string } }>>([])
  const [builderResults, setBuilderResults] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const q = cmdQuery.trim()
    if (q.length < 2) {
      setProjectResults([])
      setBuilderResults([])
      setIsSearching(false)
      return
    }

    let cancelled = false
    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const [projRes, bldRes] = await Promise.all([
          adminFetch(`/admin/projects?q=${encodeURIComponent(q)}&limit=5`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          adminFetch(`/builders`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ])
        if (cancelled) return
        if (projRes?.projects) {
          setProjectResults(projRes.projects.slice(0, 5))
        } else {
          setProjectResults([])
        }
        if (bldRes?.builders) {
          const qLower = q.toLowerCase()
          const matchedBuilders = bldRes.builders.filter((b: any) => b.name?.toLowerCase().includes(qLower)).slice(0, 4)
          setBuilderResults(matchedBuilders)
        } else {
          setBuilderResults([])
        }
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [cmdQuery])

  async function openProjectFacts(id: string) {
    setLoadingProject(true)
    const preview = projectResults.find((p) => p.id === id)
    if (preview) {
      setSelectedProject({ ...preview, unit_types: [] })
    }
    try {
      const res = await adminFetch(`/admin/projects/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedProject(data.project ?? data)
      }
    } catch (err) {
      console.error('Failed to load project details for factsheet', err)
    } finally {
      setLoadingProject(false)
    }
  }

  function copyProjectFacts(p: any) {
    if (!p) return
    const price = projectPriceLine(p)
    const poss = projectPossessionLine(p)
    const configs = projectConfigLine(p)
    const rera = p.rera_number || 'Pending'
    const lines = [
      `*${p.name}*`,
      p.builder?.name ? `Developer: ${p.builder.name}` : null,
      p.sector || p.city ? `Location: ${[p.sector, p.city].filter(Boolean).join(', ')}` : null,
      `Price: ${price}`,
      `Configurations: ${configs}`,
      `Possession: ${poss}`,
      `RERA: ${rera}`,
      p.total_units || p.total_towers ? `Scale: ${[p.total_units ? `${p.total_units} units` : null, p.total_towers ? `${p.total_towers} towers` : null].filter(Boolean).join(' · ')}` : null,
    ].filter(Boolean)

    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedFacts(true)
    setTimeout(() => setCopiedFacts(false), 2000)
  }

  const groupedNav = useMemo(() => {
    const groups: { name: string; items: PortalNavItem[] }[] = []
    for (const item of visibleNav) {
      const sectionName = item.section || 'General'
      let g = groups.find((x) => x.name === sectionName)
      if (!g) {
        g = { name: sectionName, items: [] }
        groups.push(g)
      }
      g.items.push(item)
    }
    return groups
  }, [visibleNav])

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
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    if (!token) {
      router.replace('/admin/login')
      return
    }

    const timer = setTimeout(() => {
      if (!cancelled) {
        router.replace('/admin/login')
      }
    }, 5000)

    adminFetch('/portal/me')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((me: { role: PortalRole; builder?: { name: string } | null; partner?: { name: string } | null }) => {
        if (cancelled) return
        clearTimeout(timer)
        if (!allowRoles.includes(me.role)) {
          router.replace(HOME_FOR_ROLE[me.role] ?? '/admin/login')
          return
        }
        setRole(me.role)
        setOrgName(me.builder?.name ?? me.partner?.name ?? null)
        setChecking(false)
      })
      .catch(() => {
        if (cancelled) return
        clearTimeout(timer)
        router.replace('/admin/login')
      })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
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
              initial={{ opacity: 0, scale: 0.96, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="fixed top-[10vh] left-1/2 -translate-x-1/2 w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_32px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08)] z-50 overflow-hidden"
            >
              {selectedProject ? (
                <div className="flex flex-col max-h-[80vh]">
                  {/* Factsheet Navigation Subheader */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-[#fbfbfd] dark:bg-zinc-900/60 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedProject(null)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      <ArrowLeft size={14} weight="bold" />
                      Back to search
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/40 px-2.5 py-0.5 rounded-full">
                        Instant Phone Factsheet
                      </span>
                      <button
                        type="button"
                        onClick={() => { setSelectedProject(null); setCmdOpen(false) }}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-bold font-mono border border-zinc-200 dark:border-zinc-700">ESC</kbd>
                      </button>
                    </div>
                  </div>

                  {/* Project Summary Banner */}
                  <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[17px] font-bold text-zinc-900 dark:text-white tracking-tight truncate">
                          {selectedProject.name}
                        </h3>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedProject.builder?.name || 'Developer'}</span>
                          <span>•</span>
                          <span>{selectedProject.sector}, {selectedProject.city}</span>
                        </p>
                      </div>
                      <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700 shrink-0">
                        {selectedProject.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Fact Grid */}
                  <div className="overflow-y-auto px-5 py-4 space-y-4">
                    {loadingProject && !selectedProject.unit_types ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2">
                        <CircleNotch size={20} className="animate-spin text-blue-500" />
                        <p className="text-[12px] text-zinc-400 font-medium">Pulling verified records…</p>
                      </div>
                    ) : (
                      <>
                        {/* 4 Core Quick Fact Cards */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-xl bg-[#f5f5f7] dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                              <CurrencyInr size={12} weight="bold" /> Price Range
                            </span>
                            <p className="text-[14px] font-bold text-zinc-900 dark:text-white mt-1">
                              {projectPriceLine(selectedProject)}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-[#f5f5f7] dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                              <Buildings size={12} weight="bold" /> Configurations
                            </span>
                            <p className="text-[14px] font-bold text-zinc-900 dark:text-white mt-1">
                              {projectConfigLine(selectedProject)}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-[#f5f5f7] dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                              <CalendarBlank size={12} weight="bold" /> Possession
                            </span>
                            <p className="text-[14px] font-bold text-zinc-900 dark:text-white mt-1">
                              {projectPossessionLine(selectedProject)}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-[#f5f5f7] dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                              <SealCheck size={12} weight="bold" /> RERA Number
                            </span>
                            <p className="text-[13px] font-bold text-zinc-900 dark:text-white mt-1 truncate" title={selectedProject.rera_number || 'Pending'}>
                              {selectedProject.rera_number || 'Not recorded'}
                            </p>
                          </div>
                        </div>

                        {/* Secondary Details: Address & Scale */}
                        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800 space-y-2 text-[12.5px]">
                          {selectedProject.address && (
                            <div className="flex items-start gap-2">
                              <MapPin size={15} className="text-zinc-400 shrink-0 mt-0.5" />
                              <span className="text-zinc-700 dark:text-zinc-300">{selectedProject.address}</span>
                            </div>
                          )}
                          {(selectedProject.total_units || selectedProject.total_towers) && (
                            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                              <Buildings size={15} className="text-zinc-400 shrink-0" />
                              <span>
                                {[
                                  selectedProject.total_units ? `${selectedProject.total_units} total units` : null,
                                  selectedProject.total_towers ? `${selectedProject.total_towers} towers` : null,
                                ].filter(Boolean).join(' • ')}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Unit Configurations Breakdown */}
                        {selectedProject.unit_types && selectedProject.unit_types.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                              Unit Types ({selectedProject.unit_types.length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {selectedProject.unit_types.map((u: any, i: number) => (
                                <div key={i} className="px-3 py-2 rounded-lg bg-[#fbfbfd] dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-[12px]">
                                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                    {u.bhk ? `${u.bhk} BHK` : 'Unit'}
                                    {u.super_area_sqft ? ` · ${u.super_area_sqft} sq ft` : ''}
                                  </span>
                                  <span className="font-bold text-zinc-900 dark:text-white">
                                    {u.price_min_cr != null ? `₹${u.price_min_cr}${u.price_max_cr && u.price_max_cr !== u.price_min_cr ? `–${u.price_max_cr}` : ''} Cr` : 'Call for price'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Factsheet Footer Action Bar */}
                  <div className="px-4 py-3 bg-[#fbfbfd] dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-2.5 flex-wrap shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyProjectFacts(selectedProject)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                          copiedFacts
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        {copiedFacts ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
                        {copiedFacts ? 'Copied Facts!' : 'Copy Summary'}
                      </button>

                      {selectedProject.slug && (
                        <a
                          href={`/project/${selectedProject.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 transition-colors"
                        >
                          Public Page <ArrowSquareOut size={13} />
                        </a>
                      )}
                    </div>

                    {(role === 'SUPER_ADMIN' || role === 'ANALYST') && (
                      <button
                        type="button"
                        onClick={() => {
                          router.push(`/admin/projects/${selectedProject.id}`)
                          setCmdOpen(false)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <PencilSimple size={13} weight="bold" />
                        Edit in Catalog
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center px-4 border-b border-zinc-200/70 dark:border-zinc-800">
                    <MagnifyingGlass size={18} weight="bold" className="text-zinc-400 mr-3 shrink-0" />
                    <input
                      autoFocus
                      placeholder="Search projects (facts & details), builders, or jump to page..."
                      value={cmdQuery}
                      onChange={(e) => setCmdQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (projectResults.length > 0) {
                            openProjectFacts(projectResults[0].id)
                          } else if (filteredNav[0]) {
                            router.push(filteredNav[0].href)
                            setCmdOpen(false)
                          }
                        }
                      }}
                      className="flex-1 py-4 bg-transparent outline-none text-[14px] font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                    />
                    {isSearching && (
                      <CircleNotch size={16} className="animate-spin text-blue-500 mr-2 shrink-0" />
                    )}
                    <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-bold text-zinc-500 font-mono border border-zinc-200 dark:border-zinc-700">ESC</kbd>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {/* Empty State */}
                    {cmdQuery.trim().length > 0 && !isSearching && filteredNav.length === 0 && projectResults.length === 0 && builderResults.length === 0 && (
                      <div className="py-8 text-center">
                        <p className="text-[13px] text-zinc-400 font-medium">No results found for &ldquo;{cmdQuery}&rdquo;</p>
                      </div>
                    )}

                    {/* Projects */}
                    {projectResults.length > 0 && (
                      <div className="pt-2 first:pt-0">
                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center justify-between">
                          <span>Projects (Click for Factsheet)</span>
                          <span className="font-mono text-[9px]">{projectResults.length} matches</span>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {projectResults.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => openProjectFacts(p.id)}
                              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-100/90 dark:hover:bg-zinc-800/80 transition-colors group cursor-pointer text-left"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                  <Buildings size={16} weight="duotone" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                    {p.name}
                                  </p>
                                  <p className="text-[11px] text-zinc-400 truncate">
                                    {p.builder?.name || 'Developer'} • {p.sector}, {p.city}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                  {p.status?.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                  Facts <ArrowRight size={11} weight="bold" />
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Builders */}
                    {builderResults.length > 0 && (
                      <div className="pt-2 first:pt-0">
                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center justify-between">
                          <span>Builders</span>
                          <span className="font-mono text-[9px]">{builderResults.length} matches</span>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {builderResults.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => {
                                router.push(`/admin/builders?search=${encodeURIComponent(b.name)}`)
                                setCmdOpen(false)
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-zinc-100/90 dark:hover:bg-zinc-800/80 transition-colors group cursor-pointer text-left"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <UserGear size={16} weight="duotone" className="text-purple-500 shrink-0" />
                                <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                                  {b.name}
                                </span>
                              </div>
                              <span className="text-[11px] text-zinc-400 font-medium shrink-0 flex items-center gap-1">
                                View builder <ArrowRight size={11} />
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Navigation Links */}
                    {filteredNav.length > 0 && (
                      <div className="pt-2 first:pt-0">
                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Pages
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {filteredNav.map((n) => (
                            <button
                              key={n.href}
                              onClick={() => { router.push(n.href); setCmdOpen(false) }}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-zinc-100/90 dark:hover:bg-zinc-800/80 transition-colors group cursor-pointer text-left"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <n.icon size={16} weight="duotone" className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors shrink-0" />
                                <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white truncate">{n.label}</span>
                              </div>
                              <span className="text-[11px] text-zinc-400 font-medium shrink-0 flex items-center gap-1">
                                Go <ArrowRight size={11} />
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
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

        {/* Console label — the one thing that tells the three consoles apart.
            On a tenant subdomain it says the tenant's name instead, so a builder
            at lotus.propfyndr.in is not reading the word "Builder Console" over
            their own data. */}
        {!isCollapsed && (
          <div className="px-4 pt-3 pb-2 shrink-0">
            {/* Who, then where. Both, because a builder needs to know which
                organisation they are acting as AND which console they are in —
                showing only one leaves the other to be assumed. */}
            {whoAmI && (
              <p className="text-[13px] font-bold text-zinc-900 dark:text-white truncate leading-tight">
                {whoAmI}
              </p>
            )}
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {consoleLabel}
            </span>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
          {groupedNav.map((group, gIdx) => (
            <div key={group.name} className="space-y-1">
              {!isCollapsed && group.name !== 'General' && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 select-none">
                  {group.name}
                </div>
              )}
              {isCollapsed && gIdx > 0 && (
                <div className="my-2 border-t border-zinc-200/60 dark:border-zinc-800/80 mx-2" />
              )}
              {group.items.map((n) => {
                const isActive = pathname === n.href || (n.href !== rootHref && pathname.startsWith(n.href))
                return (
                  <div key={n.href} className="relative group/navitem flex justify-center">
                    <Link
                      href={n.href}
                      onClick={() => setMobileOpen(false)}
                      className={`
                        flex items-center transition-all duration-150 overflow-hidden whitespace-nowrap
                        ${isCollapsed ? 'w-10 h-10 rounded-lg justify-center' : 'w-full gap-3 px-3 py-2 rounded-lg'}
                        ${isActive
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
                        }
                      `}
                    >
                      <n.icon
                        size={17}
                        weight={isActive ? 'fill' : 'duotone'}
                        className={isActive ? 'text-white dark:text-zinc-900 shrink-0' : 'text-zinc-400 dark:text-zinc-500 group-hover/navitem:text-zinc-700 dark:group-hover/navitem:text-zinc-300 shrink-0'}
                      />
                      {!isCollapsed && (
                        <span className="text-[13px] tracking-tight">{n.label}</span>
                      )}
                    </Link>
                    {isCollapsed && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 py-1.5 px-2.5 bg-zinc-900 text-white text-[11px] font-medium rounded-md opacity-0 group-hover/navitem:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-xl border border-zinc-800">
                        {n.label}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
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
