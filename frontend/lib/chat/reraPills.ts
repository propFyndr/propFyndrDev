/**
 * Marks each RERA number in the answer that belongs to a project on screen,
 * so the buyer can open the record we hold for it. Matching is against our
 * rows, not the model's say-so: a number we don't hold stays plain text.
 */
export function tagHeldReraNumbers(text: string, projects: Array<{ rera_number?: string | null }>): string {
  const held = Array.from(new Set(projects.map(p => p.rera_number?.trim()).filter((n): n is string => !!n && n.length >= 6)))
  if (!held.length || text.includes('#provenance:')) return text
  const escaped = held.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(?<![\\w\\[/#:])(${escaped.join('|')})(?![\\w\\]])`, 'gi')
  return text.replace(re, n => `[Verified: ${n}](#provenance:${encodeURIComponent(n)})`)
}
