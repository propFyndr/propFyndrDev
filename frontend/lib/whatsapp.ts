export interface WhatsAppProject {
  name: string
  builder: { name: string }
  sector: string
  price_range_label: string
  status: string
  rera_number?: string | null
  unit_types: Array<{ bhk: number }>
}

/**
 * Build a pre-filled WhatsApp URL for a project enquiry.
 * variant 'card'  — used in ProjectCard (short intro)
 * variant 'panel' — used in ProjectDetailPanel (detail view intro)
 */
export function buildWhatsAppUrl(
  project: WhatsAppProject | Record<string, unknown>,

  variant: 'card' | 'panel' = 'card',
): string | null {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER
  if (!number) return null

  const projectTyped = project as WhatsAppProject
  const bhkList = [...new Set(projectTyped.unit_types.map((u) => `${u.bhk}BHK`))].join(' / ')
  const statusLabel =
    projectTyped.status === 'ready_to_move' ? 'Ready to Move'
    : projectTyped.status === 'new_launch' ? 'New Launch'

    : 'Under Construction'

  const lines =
    variant === 'panel'
      ? [
          `Hi! I came across *${projectTyped.name}* on PropFyndr and I'm interested.`,
          ``,
          `📍 ${projectTyped.sector}, Noida — ${projectTyped.builder.name}`,
          `🏠 ${bhkList} · ${projectTyped.price_range_label}`,
          `📋 ${statusLabel}`,
          ...(projectTyped.rera_number ? [`✅ RERA: ${projectTyped.rera_number}`] : []),

          ``,
          `Could you share more details and help me book a site visit?`,
        ]
      : [
          `Hi! I'm interested in *${projectTyped.name}* by ${projectTyped.builder.name} in ${projectTyped.sector}, Noida.`,
          ``,
          `Configuration: ${bhkList}`,
          `Price: ${projectTyped.price_range_label}`,
          `Status: ${statusLabel}`,
          ...(projectTyped.rera_number ? [`RERA: ${projectTyped.rera_number}`] : []),

          ``,
          `Could you help me with more details and a site visit?`,
        ]

  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`
}

/**
 * The buyer taking the conversation to WhatsApp.
 *
 * `whatsapp_handoff_clicked` is one of the six high-intent events Day 2.4
 * lists, and it was declared in the AnalyticsEvent union and fired from
 * nowhere — so the last step of the funnel, the one where a buyer stops
 * browsing and starts talking to a human, recorded nothing.
 *
 * It lives here rather than in each anchor because there are four of them
 * across three components and they would drift. `buildWhatsAppUrl` cannot fire
 * it: building a URL is not clicking it, and those run on render.
 *
 * Deliberately NOT wired to the admin `wa.me` links in /admin/leads,
 * /admin/conversations and /admin/builder-applications. Those are staff dialling
 * out; the buyer is not the one taking an action there.
 */
export function trackWhatsAppHandoff(
  project: WhatsAppProject | Record<string, unknown> | null | undefined,
  surface: 'panel' | 'card' | 'pricing' | 'location',
): void {
  const p = project as WhatsAppProject | null | undefined
  if (!p?.name) return
  // Imported lazily so this module stays usable from a server component.
  void import('./analytics').then(({ track }) =>
    track('whatsapp_handoff_clicked', {
      project_name: p.name,
      builder_name: p.builder?.name ?? null,
      sector: p.sector ?? null,
      surface,
    }),
  ).catch(() => {})
}
