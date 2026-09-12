'use client'

import { Gauge, Buildings, PhoneCall, Handshake, UserCircle } from '@phosphor-icons/react'
import PortalShell, { PortalNavItem } from '@/components/portal/PortalShell'

const NAV: PortalNavItem[] = [
  { href: '/builder/portal',          label: 'Dashboard', icon: Gauge },
  { href: '/builder/portal/projects', label: 'Projects',  icon: Buildings },
  { href: '/builder/portal/leads',    label: 'Leads',     icon: PhoneCall },
  { href: '/builder/portal/partners', label: 'Partners',  icon: Handshake },
  { href: '/builder/portal/account',  label: 'Account',   icon: UserCircle },
]

export default function BuilderPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      nav={NAV}
      rootHref="/builder/portal"
      rootLabel="Builder"
      allowRoles={['BUILDER', 'SUPER_ADMIN']}
      scopeParam="builder_id"
      ownRole="BUILDER"
    >
      {children}
    </PortalShell>
  )
}
