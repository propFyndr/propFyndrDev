import { ImageResponse } from 'next/og'
import { BRAND_MARK_SRC } from '@/lib/brandMark'

export const runtime = 'nodejs'
export const alt = 'RealtyAsk — AI Property Advisor'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Deliberately static — no fetch, no params use. A link-preview fetch from
// WhatsApp/iMessage/etc. must never cause a database round trip; the one
// place code or device matters is the real arrive() call in the browser.
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0F3460 0%, #1B5E9E 100%)',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontFamily: 'system-ui, -apple-system',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 64, fontWeight: 'bold' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders <img>, not next/image */}
          <img src={BRAND_MARK_SRC} width={84} height={82} alt="" />
          RealtyAsk
        </div>
        <div style={{ fontSize: 28, opacity: 0.85, marginTop: 16 }}>
          AI Property Advisor — someone thinks you&apos;d find this useful
        </div>
      </div>
    ),
    { ...size }
  )
}
