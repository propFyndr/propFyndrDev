import { ImageResponse } from 'next/og'
import { API_BASE } from '@/lib/env'

export const runtime = 'nodejs'
export const alt = 'Property on PropFyndr'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let p: any = null
  try {
    const res = await fetch(`${API_BASE}/projects/${slug}`, { next: { revalidate: 300 } })
    if (res.ok) p = (await res.json()).project ?? null
  } catch {
    p = null
  }

  const name = p?.name ?? 'PropFyndr'
  const price = p?.price_range_label ?? ''
  const sector = p?.sector ?? 'Noida'
  const builder = p?.builder?.name ?? ''
  const hero = p?.hero_image_url || (p?.images?.[0]?.url ?? null)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          backgroundColor: '#0b0b0f',
          backgroundImage: hero ? `url(${hero})` : 'linear-gradient(135deg,#1d4ed8,#4338ca)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Dark gradient scrim for legibility */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            padding: '56px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 70%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(16,185,129,0.9)',
                color: 'white',
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              ✓ RERA
            </div>
            {builder ? (
              <div style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 26 }}>{builder}</div>
            ) : null}
          </div>
          <div style={{ display: 'flex', color: 'white', fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>{name}</div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 34, marginTop: 8 }}>{sector}</div>
          {price ? (
            <div style={{ display: 'flex', color: 'white', fontSize: 44, fontWeight: 600, marginTop: 16 }}>{price}</div>
          ) : null}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 28, color: 'rgba(255,255,255,0.7)', fontSize: 26 }}
          >
            Reviewed with PropFyndr AI
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
