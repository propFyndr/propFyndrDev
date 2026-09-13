'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function JoinRedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      router.replace(`/admin/accept-invite?token=${encodeURIComponent(token)}`)
    } else {
      router.replace('/admin/accept-invite')
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 dark:bg-surface p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-500">Redirecting to account activation…</p>
      </div>
    </div>
  )
}

export default function JoinRedirectPage() {
  return (
    <Suspense fallback={null}>
      <JoinRedirectContent />
    </Suspense>
  )
}
