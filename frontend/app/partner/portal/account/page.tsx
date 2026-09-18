'use client'

import AccountPanel from '@/components/portal/AccountPanel'
import AccessList from '@/components/portal/AccessList'

export default function AccountPage() {
  return (
    <div className="space-y-8">
      <AccountPanel />
      {/* Who else at this organisation can sign in. Sits on Account because
          that is where someone already goes to think about logins, and it
          needs no new navigation to be found. */}
      <AccessList />
    </div>
  )
}
