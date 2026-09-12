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
} from '@phosphor-icons/react'
import PortalShell, { PortalNavItem } from '@/components/portal/PortalShell'

const NAV: PortalNavItem[] = [
  { href: '/admin',                       label: 'Dashboard',     icon: Gauge },
  { href: '/admin/projects',              label: 'Projects',      icon: Buildings },
  { href: '/admin/builders',              label: 'Builders',      icon: UsersThree },
  { href: '/admin/partners',              label: 'Partners',      icon: Handshake },
  { href: '/admin/builder-applications',  label: 'Registrations', icon: IdentificationBadge },
  { href: '/admin/leads',                 label: 'Leads',         icon: PhoneCall },
  { href: '/admin/news',                  label: 'News',          icon: NewspaperClipping },
  { href: '/admin/blog',                  label: 'Blog',          icon: BookOpen },
  { href: '/admin/promotions',            label: 'Promotions',    icon: Megaphone },
  { href: '/admin/conversations',         label: 'Conversations', icon: ChatCircleText },
  { href: '/admin/analytics',             label: 'Analytics',     icon: ChartLineUp },
  { href: '/admin/team',                  label: 'Team',          icon: UsersFour },
  { href: '/admin/outbox',                label: 'Outbox',        icon: EnvelopeSimple },
  { href: '/admin/account',               label: 'Account',       icon: UserCircle },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // The way *into* a session. Every one of these must render without one —
  // a password reset behind a session check is unreachable by exactly the
  // person who needs it.
  const PUBLIC = ['/admin/login', '/admin/accept-invite', '/admin/forgot-password', '/admin/reset-password']
  if (PUBLIC.includes(pathname)) return <>{children}</>

  return (
    <PortalShell
      nav={NAV}
      rootHref="/admin"
      rootLabel="Admin"
      allowRoles={['SUPER_ADMIN', 'ANALYST', 'SALES']}
    >
      {children}
    </PortalShell>
  )
}
