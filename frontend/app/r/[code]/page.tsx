// A labelled referral link. No database call here — the OpenGraph image next
// to this file is static for the same reason (preview bots must never
// trigger a DB write or even a DB read; lib/referralCode.ts's
// isPreviewBotUserAgent is what actually keeps bots from creating a visit,
// server-side, in POST /api/v1/referral/arrive).
import { redirect } from 'next/navigation'

export default function ReferralLandingPage({ params }: { params: { code: string } }) {
  redirect(`/discover?r=${encodeURIComponent(params.code)}`)
}
