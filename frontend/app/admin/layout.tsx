'use client'

import { usePathname } from 'next/navigation'
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
  Handshake,
  Megaphone,
  EnvelopeSimple,
  UserCircle,
  SealCheck,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import PortalShell, { PortalNavItem } from '@/components/portal/PortalShell'

const STAFF = ['SUPER_ADMIN', 'ANALYST', 'SALES'] as const
const EDITORS = ['SUPER_ADMIN', 'ANALYST'] as const
const OWNERS = ['SUPER_ADMIN'] as const
/**
 * Who works a lead. An analyst maintains the catalogue and was closed out of
 * buyer names and phone numbers on 2026-09-17 — lead volume as a number is on
 * Analytics, which they keep.
 */
const LEAD_WORKERS = ['SUPER_ADMIN', 'SALES'] as const

/**
 * `roles` mirrors the server matrix in backend/src/lib/adminPolicy.ts — it does
 * not enforce it. The server answers 403 regardless of what renders here; this
 * only keeps a salesperson from being shown links that lead nowhere they can go.
 * Sections everyone shares are left unmarked.
 */
const NAV: PortalNavItem[] = [
  // Core & Daily Workflow
  { href: '/admin',                       label: 'Dashboard',     icon: Gauge,             roles: [...OWNERS],      section: 'Core' },
  { href: '/admin/queue',                 label: 'My queue',      icon: PhoneCall,         roles: ['SALES'],        section: 'Core' },
  { href: '/admin/quality',               label: 'Data quality',  icon: SealCheck,         roles: [...EDITORS],     section: 'Core' },
  { href: '/admin/lookup',                label: 'Lookup',        icon: MagnifyingGlass,                            section: 'Core' },

  // Catalogue & Inventory
  { href: '/admin/projects',              label: 'Projects',      icon: Buildings,         roles: [...EDITORS],     section: 'Catalogue' },
  { href: '/admin/builders',              label: 'Builders',      icon: UsersThree,        roles: [...EDITORS],     section: 'Catalogue' },
  { href: '/admin/partners',              label: 'Partners',      icon: Handshake,         roles: [...EDITORS],     section: 'Catalogue' },
  { href: '/admin/builder-applications',  label: 'Registrations', icon: IdentificationBadge, roles: [...EDITORS],   section: 'Catalogue' },

  // Growth & Interactions
  { href: '/admin/leads',                 label: 'Leads',         icon: PhoneCall,         roles: [...LEAD_WORKERS], section: 'Growth' },
  { href: '/admin/news',                  label: 'News',          icon: NewspaperClipping, roles: [...EDITORS],     section: 'Growth' },
  { href: '/admin/blog',                  label: 'Blog',          icon: BookOpen,          roles: [...EDITORS],     section: 'Growth' },
  { href: '/admin/promotions',            label: 'Promotions',    icon: Megaphone,         roles: [...EDITORS],     section: 'Growth' },
  { href: '/admin/conversations',         label: 'Conversations', icon: ChatCircleText,    roles: [...OWNERS],      section: 'Growth' },

  // System & Settings
  { href: '/admin/analytics',             label: 'Analytics',     icon: ChartLineUp,       roles: [...EDITORS],     section: 'System' },
  { href: '/admin/team',                  label: 'Team',          icon: UsersFour,         roles: [...OWNERS],      section: 'System' },
  { href: '/admin/outbox',                label: 'Outbox',        icon: EnvelopeSimple,    roles: [...OWNERS],      section: 'System' },
  { href: '/admin/account',               label: 'Account',       icon: UserCircle,                                 section: 'System' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // The way *into* a session. Every one of these must render without one —
  // a password reset behind a session check is unreachable by exactly the
  // person who needs it.
  const PUBLIC = ['/admin/login', '/admin/accept-invite', '/admin/join', '/admin/forgot-password', '/admin/reset-password']
  if (PUBLIC.includes(pathname)) return <>{children}</>

  return (
    <PortalShell
      nav={NAV}
      rootHref="/admin"
      rootLabel="Admin"
      allowRoles={[...STAFF]}
    >
      {children}
    </PortalShell>
  )
}
