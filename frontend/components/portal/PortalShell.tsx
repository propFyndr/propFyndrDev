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
  CaretDown,
  CaretUpDown,
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

export interface PortalNavSubItem {
  href: string
  label: string
  roles?: PortalRole[]
  badge?: string | number
}

export interface PortalNavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: PortalRole[]
  section?: string
  badge?: string | number
  children?: PortalNavSubItem[]
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
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [role, setRole] = useState<PortalRole | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

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

  // Compute initials and display names for user profile widget
  const userInitials = useMemo(() => {
    if (whoAmI) {
      const parts = whoAmI.trim().split(/\s+/)
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
      return whoAmI.slice(0, 2).toUpperCase()
    }
    if (userEmail) {
      const local = userEmail.split('@')[0]
      return local.slice(0, 2).toUpperCase()
    }
    return 'PF'
  }, [whoAmI, userEmail])

  const displayName = whoAmI || (userEmail ? userEmail.split('@')[0] : (role ? ROLE_LABEL[role].replace(' Console', '') : 'Admin User'))
  const roleBadgeLabel = role ? ROLE_LABEL[role].replace(' Console', '') : rootLabel

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCmdOpen((open) => !open)
      } else if (e.key === 'Escape') {
        if (userMenuOpen) {
          setUserMenuOpen(false)
        } else if (cmdOpen) {
          if (selectedProject) {
            setSelectedProject(null)
          } else {
            setCmdOpen(false)
          }
        }
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [cmdOpen, selectedProject, userMenuOpen])

  useEffect(() => {
    if (!cmdOpen) {
      setCmdQuery('')
      setSelectedProject(null)
      setCopiedFacts(false)
    }
  }, [cmdOpen])

  /**
   * Resolve the host's tenant label, once, client-side.
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
   * The sections and sub-items this signed-in role may actually open.
   * Filters both parent items and nested children dynamically based on role.
   */
  const visibleNav = useMemo(() => {
    return nav
      .map((item) => {
        if (item.children && item.children.length > 0) {
          const visibleChildren = item.children.filter(
            (c) => !c.roles || (role !== null && c.roles.includes(role))
          )
          if (visibleChildren.length === 0) {
            if (item.roles && (role === null || !item.roles.includes(role))) {
              return null
            }
            return { ...item, children: undefined }
          }
          const parentAllowed = !item.roles || (role !== null && item.roles.includes(role))
          return {
            ...item,
            href: parentAllowed ? item.href : visibleChildren[0].href,
            children: visibleChildren,
          }
        }
        if (item.roles && (role === null || !item.roles.includes(role))) {
          return null
        }
        return item
      })
      .filter((n): n is PortalNavItem => n !== null)
  }, [nav, role])

  // Automatically expand parent if current route matches parent or any child
  useEffect(() => {
    for (const item of visibleNav) {
      if (item.children && item.children.length > 0) {
        const isChildActive = item.children.some(
          (c) => pathname === c.href || (c.href !== rootHref && pathname.startsWith(c.href))
        )
        const isParentActive = pathname === item.href || (item.href !== rootHref && pathname.startsWith(item.href))
        if (isChildActive || isParentActive) {
          setExpandedItems((prev) => (prev[item.label] ? prev : { ...prev, [item.label]: true }))
        }
      }
    }
  }, [pathname, visibleNav, rootHref])

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const filteredNav = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase()
    if (!q) return []
    const flat: Array<{ href: string; label: string; icon: React.ElementType }> = []
    for (const item of visibleNav) {
      if (item.label.toLowerCase().includes(q)) {
        flat.push({ href: item.href, label: item.label, icon: item.icon })
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.label.toLowerCase().includes(q)) {
            flat.push({
              href: child.href,
              label: `${child.label} (${item.label})`,
              icon: item.icon,
            })
          }
        }
      }
    }
    return flat
  }, [visibleNav, cmdQuery])

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
  if (rest.length > 1) {
    const sub = rest[1]
    const subLabel =
      sub === 'new'
        ? 'New'
        : sub === 'search'
        ? 'Search'
        : sub === 'properties'
        ? 'Property Engagement'
        : sub === 'users'
        ? 'User Behavior'
        : /^[0-9a-f-]{36}$/i.test(sub) || /^\d+$/.test(sub)
        ? 'Edit'
        : titleCase(sub)
    crumbs.push({ label: subLabel })
  }

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
      .then((me: { role: PortalRole; builder?: { name: string } | null; partner?: { name: string } | null; email?: string | null }) => {
        if (cancelled) return
        clearTimeout(timer)
        if (!allowRoles.includes(me.role)) {
          router.replace(HOME_FOR_ROLE[me.role] ?? '/admin/login')
          return
        }
        setRole(me.role)
        setUserEmail(me.email ?? null)
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
        transition-[width,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[width,transform] overflow-hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Brand Header */}
        <div className="h-14 pt-[env(safe-area-inset-top,0px)] flex items-center justify-between border-b border-zinc-100/80 dark:border-zinc-800 w-full px-3.5 shrink-0 box-content">
          {!isCollapsed ? (
            <>
              <Link href={rootHref} className="flex items-center gap-2.5 min-w-0 group/logo">
                <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                  <Image
                    src="/images/icons/logo-square-black.png"
                    alt="PropFyndr"
                    width={32}
                    height={32}
                    className="object-contain block dark:hidden"
                    unoptimized
                  />
                  <Image
                    src="/images/icons/logo-square-white.png"
                    alt="PropFyndr"
                    width={32}
                    height={32}
                    className="object-contain hidden dark:block"
                    unoptimized
                  />
                </div>
                <span className="text-[15.5px] font-bold text-zinc-950 dark:text-white tracking-tight truncate leading-none group-hover/logo:text-blue-600 dark:group-hover/logo:text-blue-400 transition-colors">
                  PropFyndr
                </span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 768) setMobileOpen(false)
                  else setIsCollapsed(true)
                }}
                className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.25" />
                  <path d="M5.5 2.5V13.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                </svg>
              </button>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer group"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center group-hover:hidden shadow-2xs">
                  <Image
                    src="/images/icons/logo-square-black.png"
                    alt="PropFyndr"
                    width={32}
                    height={32}
                    className="object-contain block dark:hidden"
                    unoptimized
                  />
                  <Image
                    src="/images/icons/logo-square-white.png"
                    alt="PropFyndr"
                    width={32}
                    height={32}
                    className="object-contain hidden dark:block"
                    unoptimized
                  />
                </div>
                <div className="hidden group-hover:flex items-center justify-center text-zinc-600 dark:text-zinc-200">
                  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.25" />
                    <path d="M5.5 2.5V13.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                  </svg>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Console label — the one thing that tells the three consoles apart. */}
        {!isCollapsed && (
          <div className="px-4 pt-2.5 pb-1 shrink-0">
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

        {/* Quick Search Widget */}
        {!isCollapsed ? (
          <div className="px-3 pt-1 pb-2 shrink-0">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 bg-zinc-100/70 hover:bg-zinc-100 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-all cursor-pointer group shadow-2xs text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MagnifyingGlass size={15} weight="bold" className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 shrink-0" />
                <span className="text-[12.5px] font-medium text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 truncate">Search anything</span>
              </div>
              <kbd className="font-sans text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 shadow-2xs shrink-0">⌘K</kbd>
            </button>
          </div>
        ) : (
          <div className="px-2 pt-2 pb-1 flex justify-center shrink-0">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-100/70 hover:bg-zinc-200/70 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all cursor-pointer"
              title="Search (⌘K)"
            >
              <MagnifyingGlass size={16} weight="bold" />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-1 space-y-3 overflow-y-auto">
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
                const hasChildren = Boolean(n.children && n.children.length > 0)
                const isCurrentActive = pathname === n.href || (n.href !== rootHref && pathname.startsWith(n.href))
                const isChildActive = Boolean(n.children?.some((c) => pathname === c.href || (c.href !== rootHref && pathname.startsWith(c.href))))
                const isActive = isCurrentActive || isChildActive
                const isExpanded = expandedItems[n.label] ?? isActive

                if (isCollapsed) {
                  return (
                    <div key={n.href || n.label} className="relative group/navitem flex justify-center">
                      <Link
                        href={n.href}
                        className={`
                          w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150
                          ${isActive
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                          }
                        `}
                      >
                        <n.icon size={18} weight={isActive ? 'fill' : 'duotone'} />
                      </Link>
                      {/* Collapsed flyout */}
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 py-2 px-3 bg-zinc-900 text-white text-[12px] font-medium rounded-xl opacity-0 group-hover/navitem:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] shadow-xl border border-zinc-800 min-w-[140px]">
                        <div className="font-semibold text-white mb-0.5">{n.label}</div>
                        {n.children && (
                          <div className="space-y-1 pt-1.5 mt-1 border-t border-zinc-800 text-[11px] text-zinc-400">
                            {n.children.map((sub) => (
                              <div key={sub.href} className="hover:text-white truncate">
                                • {sub.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                if (hasChildren && n.children) {
                  return (
                    <div key={n.label} className="space-y-0.5">
                      <div className="flex items-center group/navitem relative">
                        <Link
                          href={n.href}
                          onClick={() => {
                            setExpandedItems((prev) => ({ ...prev, [n.label]: true }))
                          }}
                          className={`
                            flex items-center flex-1 gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 overflow-hidden whitespace-nowrap text-left
                            ${(isCurrentActive && !isChildActive)
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                              : isChildActive
                              ? 'text-zinc-900 dark:text-zinc-100 font-semibold bg-zinc-100/70 dark:bg-zinc-800/50'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
                            }
                          `}
                        >
                          <n.icon
                            size={17}
                            weight={(isCurrentActive || isChildActive) ? 'fill' : 'duotone'}
                            className={(isCurrentActive && !isChildActive) ? 'text-white dark:text-zinc-900 shrink-0' : (isChildActive ? 'text-blue-600 dark:text-blue-400 shrink-0' : 'text-zinc-400 dark:text-zinc-500 group-hover/navitem:text-zinc-700 dark:group-hover/navitem:text-zinc-300 shrink-0')}
                          />
                          <span className="text-[13px] tracking-tight truncate flex-1">{n.label}</span>
                        </Link>

                        {/* Dedicated expand/collapse chevron */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            toggleExpand(n.label)
                          }}
                          className="p-1.5 mr-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer"
                          aria-label={`Toggle ${n.label} sub-navigation`}
                        >
                          <CaretDown
                            size={13}
                            weight="bold"
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                          />
                        </button>
                      </div>

                      {/* Kravio Curved Tree Connector */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <m.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="relative pl-6 pr-1 py-1 space-y-0.5">
                              {/* Continuous vertical trunk line */}
                              <div className="absolute left-[21px] top-1.5 bottom-3.5 w-[1.5px] bg-zinc-200 dark:bg-zinc-800 rounded-full" />

                              {n.children.map((sub) => {
                                const isSubActive = pathname === sub.href
                                return (
                                  <Link
                                    key={sub.href}
                                    href={sub.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`
                                      group/sub flex items-center justify-between py-1.5 px-2.5 rounded-lg text-[12.5px] transition-all relative
                                      ${isSubActive
                                        ? 'font-semibold text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800/90 shadow-2xs'
                                        : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 font-medium'
                                      }
                                    `}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {/* Horizontal branch line */}
                                      <span
                                        className={`absolute -left-[5px] w-2.5 h-[1.5px] rounded-full transition-colors ${
                                          isSubActive
                                            ? 'bg-zinc-900 dark:bg-zinc-100'
                                            : 'bg-zinc-200 dark:bg-zinc-800 group-hover/sub:bg-zinc-400'
                                        }`}
                                      />
                                      {/* Dot indicator */}
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full transition-all shrink-0 ${
                                          isSubActive
                                            ? 'bg-blue-600 dark:bg-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/60 scale-110'
                                            : 'bg-zinc-300 dark:bg-zinc-600 group-hover/sub:bg-zinc-400'
                                        }`}
                                      />
                                      <span className="truncate">{sub.label}</span>
                                    </div>
                                    {sub.badge && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                        {sub.badge}
                                      </span>
                                    )}
                                  </Link>
                                )
                              })}
                            </div>
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                }

                // Regular Single Nav Item
                return (
                  <div key={n.href} className="relative group/navitem flex">
                    <Link
                      href={n.href}
                      onClick={() => setMobileOpen(false)}
                      className={`
                        flex items-center w-full gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 overflow-hidden whitespace-nowrap
                        ${isCurrentActive
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
                        }
                      `}
                    >
                      <n.icon
                        size={17}
                        weight={isCurrentActive ? 'fill' : 'duotone'}
                        className={isCurrentActive ? 'text-white dark:text-zinc-900 shrink-0' : 'text-zinc-400 dark:text-zinc-500 group-hover/navitem:text-zinc-700 dark:group-hover/navitem:text-zinc-300 shrink-0'}
                      />
                      <span className="text-[13px] tracking-tight truncate flex-1">{n.label}</span>
                      {n.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {n.badge}
                        </span>
                      )}
                    </Link>
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer Actions — Kravio User Profile Card */}
        <div className="p-3 border-t border-border dark:border-zinc-800 shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] relative">
          {/* User Menu Popover */}
          <AnimatePresence>
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setUserMenuOpen(false)}
                />
                <m.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-3 right-3 mb-2 p-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200/80 dark:border-zinc-800 z-40 space-y-1"
                >
                  <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                    <p className="text-[12px] font-bold text-zinc-900 dark:text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {userEmail || 'admin@propfyndr.in'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40">
                        {roleBadgeLabel}
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/admin/account"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    <UserGear size={15} weight="duotone" className="text-zinc-400" />
                    <span>Account Settings</span>
                  </Link>

                  <Link
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    <Buildings size={15} weight="duotone" className="text-zinc-400" />
                    <span>View Live Site</span>
                    <ArrowSquareOut size={12} className="ml-auto text-zinc-400" />
                  </Link>

                  <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false)
                        handleLogout()
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer text-left"
                    >
                      <SignOut size={15} weight="bold" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </m.div>
              </>
            )}
          </AnimatePresence>

          {!isCollapsed ? (
            <button
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer group text-left border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-700/50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-600 dark:from-zinc-700 dark:to-zinc-500 text-white flex items-center justify-center text-[11px] font-bold shadow-2xs">
                    {userInitials}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {userEmail || `${roleBadgeLabel} Session`}
                  </p>
                </div>
              </div>

              <CaretUpDown size={14} weight="bold" className="text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 shrink-0 ml-1" />
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="relative w-10 h-10 rounded-full bg-zinc-800 text-white flex items-center justify-center text-[12px] font-bold hover:scale-105 transition-all cursor-pointer shadow-2xs"
                title={`${displayName} (${roleBadgeLabel})`}
              >
                {userInitials}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <SignOut size={16} weight="bold" />
              </button>
            </div>
          )}
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
