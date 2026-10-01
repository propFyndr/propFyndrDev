/**
 * "Compare the top 3 you showed — just tell me which one you'd buy for a family."
 *
 * The prompt told the model to name one, and large models did; small free-tier
 * models hedged or picked on vibes. The choice is mechanical once the order is
 * fixed, and CLAUDE.md fixes it (§ Recommendation Framework): budget fit,
 * possession timeline, then builder/legal standing. Code makes the pick and
 * names the drawback from the rows; the model only writes the sentences.
 */
export interface PickCandidate {
  name: string
  status?: string | null
  price_min_cr?: number | null
  possession_date?: Date | string | null
  possession_label?: string | null
  rera_number?: string | null
  oc_status?: string | null
  legal_flag?: string | null
  nclt_moratorium_active?: boolean | null
  location_concerns?: string[] | null
  builder?: { legal_flag?: string | null; insolvency_history?: boolean | null } | null
}

export interface ComputedPick {
  name: string
  reasons: string[]
  drawback: string
}

function possessionTime(p: PickCandidate): number {
  if (p.status === 'ready_to_move') return 0
  const d = p.possession_date ? new Date(p.possession_date).getTime() : NaN
  return Number.isFinite(d) ? d : Number.POSITIVE_INFINITY
}

export function computePick(projects: readonly PickCandidate[], budgetMax?: number | null): ComputedPick | null {
  if (projects.length < 2) return null
  const scored = projects.map((p) => {
    let score = 0
    const reasons: string[] = []
    const withinBudget = budgetMax != null && typeof p.price_min_cr === 'number' && p.price_min_cr <= budgetMax
    if (withinBudget) { score += 3; reasons.push(`starts within your ₹${budgetMax} Cr budget (₹${p.price_min_cr!.toFixed(2)} Cr)`) }
    if (p.status === 'ready_to_move') { score += 2; reasons.push('ready to move, so no construction risk and no GST') }
    if (p.rera_number) score += 1
    if (p.legal_flag || p.nclt_moratorium_active || p.builder?.legal_flag || p.builder?.insolvency_history) score -= 4
    return { p, score, reasons }
  })
  scored.sort((a, b) =>
    b.score - a.score ||
    possessionTime(a.p) - possessionTime(b.p) ||
    (a.p.price_min_cr ?? Infinity) - (b.p.price_min_cr ?? Infinity))
  const best = scored[0]
  const p = best.p

  let drawback: string
  if (p.legal_flag || p.builder?.legal_flag) drawback = `legal flag on record: ${p.legal_flag ?? p.builder?.legal_flag}`
  else if (p.status !== 'ready_to_move') drawback = /\d/.test(p.possession_label ?? '') || p.possession_date
    ? `still under construction (possession on record: ${p.possession_label ?? String(p.possession_date).slice(0, 10)})`
    : 'still under construction, and we hold no possession date'
  else if (budgetMax != null && typeof p.price_min_cr === 'number' && p.price_min_cr > budgetMax) drawback = `starts above your budget at ₹${p.price_min_cr.toFixed(2)} Cr`
  else if (!p.oc_status || p.oc_status === 'NONE') drawback = 'we hold no occupancy certificate for it — confirm it before paying'
  else if (p.location_concerns?.length) drawback = p.location_concerns[0].trim().replace(/\.+$/, '')
  else drawback = 'nothing adverse in our records — verify the OC and authority dues before you pay'

  const reasons = best.reasons.length ? best.reasons : ['the strongest of the three on the records we hold, though none is a clear winner']
  return { name: p.name, reasons, drawback }
}

export function pickDirective(pick: ComputedPick): string {
  return `\nCOMPUTED PICK (from the project data, ranked budget fit > possession > legal standing): ${pick.name}. Reasons from the data: ${pick.reasons.join('; ')}. Biggest drawback from the data: ${pick.drawback}. Use this pick and this drawback unless a fact in the data above contradicts them.\n`
}
