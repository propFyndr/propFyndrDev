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
  // MAIN NAVIGATION
  {
    href: '/admin',
    label: 'Overview',
    icon: Gauge,
    roles: [...OWNERS],
    section: 'Main Navigation',
  },
  {
    href: '/admin/projects',
    label: 'Projects',
    icon: Buildings,
    roles: [...STAFF],
    section: 'Main Navigation',
    children: [
      { href: '/admin/projects', label: 'All Projects', roles: [...EDITORS] },
      { href: '/admin/projects/new', label: 'New Project', roles: [...EDITORS] },
      { href: '/admin/quality', label: 'Data Quality', roles: [...EDITORS] },
      { href: '/admin/lookup', label: 'Fact Lookup' },
    ],
  },
  {
    href: '/admin/builders',
    label: 'Builders & Partners',
    icon: UsersThree,
    roles: [...EDITORS],
    section: 'Main Navigation',
    children: [
      { href: '/admin/builders', label: 'All Builders', roles: [...EDITORS] },
      { href: '/admin/builder-applications', label: 'Registrations', roles: [...EDITORS] },
      { href: '/admin/partners', label: 'Channel Partners', roles: [...EDITORS] },
    ],
  },
  {
    href: '/admin/leads',
    label: 'Leads & Inquiries',
    icon: PhoneCall,
    roles: [...LEAD_WORKERS],
    section: 'Main Navigation',
    children: [
      { href: '/admin/queue', label: 'My Queue', roles: [...LEAD_WORKERS] },
      { href: '/admin/leads', label: 'All Leads', roles: [...LEAD_WORKERS] },
      { href: '/admin/conversations', label: 'AI Conversations', roles: [...OWNERS] },
    ],
  },

  // MARKETING & CONTENT
  {
    href: '/admin/blog',
    label: 'Content & Editorial',
    icon: BookOpen,
    roles: [...EDITORS],
    section: 'Marketing & Content',
    children: [
      { href: '/admin/blog', label: 'Blog Articles', roles: [...EDITORS] },
      { href: '/admin/news', label: 'Real Estate News', roles: [...EDITORS] },
      { href: '/admin/promotions', label: 'Promotions', roles: [...EDITORS] },
    ],
  },

  // ANALYTICS & SYSTEM
  {
    href: '/admin/analytics',
    label: 'Analytics',
    icon: ChartLineUp,
    roles: [...EDITORS],
    section: 'Analytics & System',
  },
  {
    href: '/admin/team',
    label: 'Team',
    icon: UsersFour,
    roles: [...OWNERS],
    section: 'Analytics & System',
  },
  {
    href: '/admin/outbox',
    label: 'Outbox',
    icon: EnvelopeSimple,
    roles: [...OWNERS],
    section: 'Analytics & System',
  },
  {
    href: '/admin/account',
    label: 'Account',
    icon: UserCircle,
    section: 'Analytics & System',
  },
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
