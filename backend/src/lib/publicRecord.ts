import { tavilySearch, type WebResult } from './web'
import { checkRateLimit } from './cache'
import { publicRecordQualifier } from './factPresentation'

/**
 * Public-record lookup for a project we do not hold.
 *
 * Only official sources count: UP-RERA, and government or court portals (*.gov.in,
 * *.nic.in). A listing portal's price is an advertisement, and a builder's own site
 * is the builder speaking, so neither is read here. Anything that comes back is
 * stated with its source host and the day it was read (`public_record` tier).
 *
 * Paid search is bounded: web.ts caches every query for days, and each buyer gets a
 * small hourly allowance on top.
 */

const HOURLY_LOOKUPS = 5

export interface PublicRecordHit {
  title: string
  url: string
  host: string
  snippet: string
  reraNumber: string | null
}

export interface PublicRecordResult {
  hits: PublicRecordHit[]
  fetchedAt: Date
  limited: boolean
}

export function isOfficialSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'up-rera.in' || host.endsWith('.up-rera.in') || host.endsWith('.gov.in') || host.endsWith('.nic.in')
  } catch {
    return false
  }
}

const RERA_NUMBER = /\bUPRERAPRJ\d+(?:\/\d+\/\d+)?\b/i

export function toHits(results: ReadonlyArray<WebResult>): PublicRecordHit[] {
  return results
    .filter(r => isOfficialSource(r.url))
    .slice(0, 3)
    .map(r => ({
      title: r.title,
      url: r.url,
      host: new URL(r.url).hostname,
      snippet: r.content.replace(/\s+/g, ' ').trim().slice(0, 300),
      reraNumber: RERA_NUMBER.exec(`${r.title} ${r.content}`)?.[0] ?? null,
    }))
}

type Search = (query: string, max: number) => Promise<ReadonlyArray<WebResult>>

const defaultSearch: Search = async (query, max) =>
  (await tavilySearch(query, max, { restrictDomains: true, includeAnswer: false })).results

export async function lookupPublicRecord(
  projectName: string,
  allowanceKey: string,
  search: Search = defaultSearch,
  now: Date = new Date(),
): Promise<PublicRecordResult> {
  const allowed = (await checkRateLimit(`publicrecord:${allowanceKey}`, HOURLY_LOOKUPS, 3600).catch(() => ({ allowed: true }))).allowed
  if (!allowed) return { hits: [], fetchedAt: now, limited: true }
  const results = await search(`${projectName} UP-RERA registration Noida Greater Noida`, 8)
  return { hits: toHits(results), fetchedAt: now, limited: false }
}

export function publicRecordAnswer(projectName: string, r: PublicRecordResult): string {
  if (r.limited) {
    return `I've looked up several projects for you in the last hour, so I'll pause the live lookups to keep them reliable. Try again shortly, or ask our advisory team to pull ${projectName}'s official records.`
  }
  if (r.hits.length === 0) {
    return `**${projectName}** isn't in our records, and I found no official RERA or court record for it that I could read just now. That doesn't mean it is unregistered. Our advisory team can pull its official filing for you. Until there is a registration number that matches the project and promoter, I wouldn't treat it as verified.`
  }
  const lines = r.hits.map(h => `- **${h.title}** (${publicRecordQualifier(h.host, r.fetchedAt)})${h.reraNumber ? `\n  Registration number shown: \`${h.reraNumber}\`` : ''}\n  ${h.snippet}\n  ${h.url}`)
  return `**${projectName}** isn't in our records. This is what official public sources show, not something we hold or have checked:\n\n${lines.join('\n\n')}\n\nCheck that the project name, promoter and tower on the record match what you were given. Where a record and the seller's figures differ, the difference is the question to ask.`
}
