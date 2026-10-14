import { ImageResponse } from 'next/og'

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001/api/v1'

export const runtime = 'nodejs'
export const alt = 'Shared Property Shortlist'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: { id: string } }) {
  const { id } = params

  let projectCount = 0
  let titles: string[] = []

  try {
    const res = await fetch(`${API_BASE}/share/${id}`)
    if (res.ok) {
      const { projectSlugs } = await res.json()
      projectCount = projectSlugs.length

      // Fetch first 3 project names
      titles = (
        await Promise.all(
          projectSlugs.slice(0, 3).map(async (slug: string) => {
            try {
              const pRes = await fetch(`${API_BASE}/projects/${slug}`)
              if (pRes.ok) {
                const { project } = await pRes.json()
                return project?.name || 'Property'
              }
            } catch {}
            return null
          })
        )
      ).filter(Boolean) as string[]
    }
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0F3460 0%, #1B5E9E 100%)',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 60,
          color: 'white',
          fontFamily: 'system-ui, -apple-system',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              fontSize: 48,
              fontWeight: 'bold',
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '12px 20px',
              borderRadius: 12,
            }}
          >
            🏠
          </div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 'bold' }}>My RealtyAsk Shortlist</div>
            <div style={{ fontSize: 18, opacity: 0.8 }}>{projectCount} properties researched with AI</div>
          </div>
        </div>

        {/* Property list preview */}
        {titles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {titles.map((title, i) => (
              <div
                key={i}
                style={{
                  fontSize: 18,
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 8,
                }}
              >
                {i + 1}. {title}
              </div>
            ))}
            {projectCount > 3 && (
              <div style={{ fontSize: 16, opacity: 0.7, fontStyle: 'italic' }}>
                +{projectCount - 3} more properties...
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 16,
            opacity: 0.8,
          }}
        >
          <div>Explore properties with AI-powered insights</div>
          <div style={{ fontWeight: 'bold' }}>realtyask.io</div>
        </div>
      </div>
    ),
    { ...size }
  )
}
