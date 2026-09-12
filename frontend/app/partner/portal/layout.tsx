'use client'

import { Gauge, PhoneCall, UserCircle } from '@phosphor-icons/react'
import PortalShell, { PortalNavItem } from '@/components/portal/PortalShell'

const NAV: PortalNavItem[] = [
  { href: '/partner/portal',       label: 'Dashboard', icon: Gauge },
  { href: '/partner/portal/leads', label: 'Leads',     icon: PhoneCall },
  { href: '/partner/portal/account', label: 'Account', icon: UserCircle },
]

export default function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      nav={NAV}
      rootHref="/partner/portal"
      rootLabel="Partner"
      allowRoles={['PARTNER', 'SUPER_ADMIN']}
      scopeParam="partner_id"
      ownRole="PARTNER"
    >
      {children}
    </PortalShell>
  )
}
