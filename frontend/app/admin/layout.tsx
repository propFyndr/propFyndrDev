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
  // Each staff role's own landing board sits first, visible only to the roles
  // it was built for. `Dashboard` stays the super admin's platform view.
  { href: '/admin',                       label: 'Dashboard',     icon: Gauge,             roles: [...OWNERS] },
  // Sales only. A super admin asking "who should be called next" opens Leads,
  // which is the same rows without pretending the platform owner has a personal
  // call list.
  { href: '/admin/queue',                 label: 'My queue',      icon: PhoneCall,         roles: ['SALES'] },
  { href: '/admin/quality',               label: 'Data quality',  icon: SealCheck,         roles: [...EDITORS] },
  /**
   * Catalogue. Editors only.
   *
   * These pages are built around adding and editing, and the server refuses
   * every one of those writes from a SALES account — so a salesperson opening
   * them met a row of buttons that answered "Editing project records is done by
   * an analyst or super admin". Offering an action and then refusing it is
   * worse than not offering it: the first reads as a broken product, the second
   * reads as a boundary.
   *
   * A salesperson still gets the catalogue facts they need to answer a buyer —
   * through the Lead Brief and the buyer-facing project pages, which is where
   * those facts are already presented for reading rather than editing.
   */
  { href: '/admin/projects',              label: 'Projects',      icon: Buildings,         roles: [...EDITORS] },
  { href: '/admin/builders',              label: 'Builders',      icon: UsersThree,        roles: [...EDITORS] },
  // Partner firms are onboarded and routed to by BUILDERS, not by our sales
  // team. A salesperson never assigns a partner, so this was a tab with nothing
  // in it for them.
  { href: '/admin/partners',              label: 'Partners',      icon: Handshake,         roles: [...EDITORS] },
  { href: '/admin/builder-applications',  label: 'Registrations', icon: IdentificationBadge, roles: [...EDITORS] },
  { href: '/admin/leads',                 label: 'Leads',         icon: PhoneCall,         roles: [...LEAD_WORKERS] },
  { href: '/admin/news',                  label: 'News',          icon: NewspaperClipping, roles: [...EDITORS] },
  { href: '/admin/blog',                  label: 'Blog',          icon: BookOpen,          roles: [...EDITORS] },
  { href: '/admin/promotions',            label: 'Promotions',    icon: Megaphone,         roles: [...EDITORS] },
  { href: '/admin/conversations',         label: 'Conversations', icon: ChatCircleText,    roles: [...OWNERS] },
  { href: '/admin/analytics',             label: 'Analytics',     icon: ChartLineUp,       roles: [...EDITORS] },
  { href: '/admin/team',                  label: 'Team',          icon: UsersFour,         roles: [...OWNERS] },
  { href: '/admin/outbox',                label: 'Outbox',        icon: EnvelopeSimple,    roles: [...OWNERS] },
  { href: '/admin/account',               label: 'Account',       icon: UserCircle },
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
