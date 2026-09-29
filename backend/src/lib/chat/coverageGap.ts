// backend/src/lib/chat/coverageGap.ts
//
// What to do when a buyer names a project we do not hold.
//
// There are two different situations and they must not be conflated:
//
//   "Tell me about Godrej Woods"   — a specific project, by name, that has no
//                                    row. We can say something useful about it
//                                    from the web, and someone should be told
//                                    to add it.
//   "What's good in Noida?"        — a general question. Nothing is missing;
//                                    there is simply no single project being
//                                    asked about, and treating that as a
//                                    coverage gap would log noise and search
//                                    the web for a question the database
//                                    already answers well.
//
// So the gate is narrow on purpose: the buyer must have named something that
// reads like a project, and retrieval must have returned no row for that name.
//
// What comes back is never a project card. A card is a promise that we hold
// verified rows behind it; there are none, and rendering one would be the
// clearest possible version of the fabrication this codebase keeps removing.
// The answer is prose, labelled as unverified, with the handoff to our own
// team — never to another portal, which `sanitizeOutput` enforces on the bytes.

import { prisma } from '../db'
import { webSearch } from '../web'

/** Words that make a phrase read like the name of a development. */
const PROJECT_SHAPED = /\b(heights?|greens?|estate|vista|residenc|enclave|city|park|towers?|court|county|gardens?|homes?|villas?|avenue|meadows?|grande?|society|apartments?|nagar|vihar|floors?)\b/i

/**
 * Category words that are never a project name on their own.
 *
 * These are the nouns a buyer uses to ask for a KIND of thing — "best society
 * in sector 137" — and the intent extractor hands them over as candidate
 * names. Checking "does it look like a project name" is not enough to reject
 * them, because several of them (society, city, park, tower) are exactly the
 * words real developments are named after. They have to be named and excluded.
 */
const GENERIC_NOUN =
  /^(societ(y|ies)|projects?|builders?|developers?|flats?|apartments?|properties|property|homes?|houses?|towers?|options?|places?|areas?|sectors?|cities|city|noida|delhi|gurgaon|metro|airport)$/i

/**
 * A specification, not a name.
 *
 * The extractor offers "3 BHK", "Sector 150" and "2 crore" as candidate names,
 * and each one has a space in it, so the single-word shape test waves them
 * through. Searching the web for "3 BHK Noida residential project" would return
 * something plausible for a question that was never about one building.
 */
const SPEC_TERM =
  /^(\d+(\.\d+)?\s*(bhk|rk|cr|crore|lakh|lac|sq\.?\s?ft|sqft)|sector\s*\d+[a-z]?|under\s|below\s|budget)/i

export interface CoverageGap {
  /** The name the buyer used, as they wrote it. */
  name: string
  /** Web context to hand the model, or '' when the search found nothing. */
  context: string
}

/**
 * Is this turn genuinely about one project we do not hold?
 *
 * `notFoundNames` comes from discovery: names the intent extractor pulled out
 * of the message that matched no row. That alone is not enough — the extractor
 * will happily offer "Noida Expressway" or "3 BHK" as a name — so the phrase
 * also has to look like a development, and the message must not read as a
 * general browse.
 */
export function isSpecificUnknownProject(message: string, notFoundNames: string[]): string | null {
  if (!notFoundNames?.length) return null
  const m = (message ?? '').trim()
  if (!m) return null

  for (const raw of notFoundNames) {
    const name = raw.trim()
    if (name.length < 4) continue

    // A category word is never a project, even though several real projects
    // are named after one. "best society in sector 137" is asking us to
    // choose, not to look a building up.
    if (GENERIC_NOUN.test(name)) continue

    // A configuration or a budget is not a building.
    if (SPEC_TERM.test(name)) continue

    // A single word qualifies only if it is shaped like a development.
    // "Panache" could be anything; "Greenwood Heights" could not.
    if (!/\s/.test(name) && !PROJECT_SHAPED.test(name)) continue

    // The buyer has to have actually written it. The extractor infers names
    // from context, and acting on one the message never contained would send
    // us searching the web for something nobody asked about.
    if (!new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(m)) continue

    return name
  }
  return null
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Record that we could not answer from our own rows.
 *
 * Written to AuditLog rather than a new table: the admin panel already lists
 * these, and a schema change is a migration against the live database — not
 * something to do to add a log line. `entity_type` makes them filterable.
 *
 * Never throws. A logging failure must not cost the buyer their answer.
 */
export async function logCoverageGap(name: string, message: string, sessionId?: string | null): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entity_type: 'coverage_gap',
        entity_id: sessionId ?? 'anonymous',
        entity_name: name,
        action: 'NO_PROJECT_CARD',
        actor: 'System',
        summary: `Buyer asked about "${name}" — no matching project in the database, so no card could be shown.`,
        changes: { query: message.slice(0, 400), requestedProject: name, at: new Date().toISOString() },
      },
    })
  } catch (e) {
    console.warn('[COVERAGE_GAP] could not log:', (e as Error).message)
  }
}

/**
 * Record that a buyer asked about a sector we do not cover.
 *
 * Separate `entity_type` from the project gap so the admin panel can list them
 * as two different things: "buildings to add" and "areas to expand into" are
 * different decisions taken by different people. A repeated sector here is the
 * clearest demand signal the product produces — it is a buyer telling us where
 * they want to live, in a place we cannot sell them anything.
 *
 * Never throws.
 */
export async function logSectorGap(sector: string, sessionId?: string | null): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entity_type: 'sector_gap',
        entity_id: sessionId ?? 'anonymous',
        entity_name: sector,
        action: 'SECTOR_NOT_COVERED',
        actor: 'System',
        summary: `Buyer asked about ${sector} — we hold no projects there.`,
        changes: { sector, at: new Date().toISOString() },
      },
    })
  } catch (e) {
    console.warn('[SECTOR_GAP] could not log:', (e as Error).message)
  }
}

/**
 * Web context for a project we do not hold, fetched fast or not at all.
 *
 * 4 seconds. This runs on the buyer's turn, ahead of an answer they are already
 * waiting for, and a slow lookup here is worse than no lookup: they asked about
 * a building, not about our retrieval strategy. An empty string is a fine
 * result — the model then says we do not hold it and offers the handoff, which
 * is the honest answer and was always the fallback.
 */
export async function fetchUnknownProjectContext(name: string, city = 'Noida'): Promise<string> {
  try {
    return await Promise.race([
      webSearch(`${name} ${city} residential project builder possession RERA`, 3),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), 4000)),
    ])
  } catch {
    return ''
  }
}

/**
 * The instruction that travels with web context for an unheld project.
 *
 * Explicit about all three constraints, because each one has been violated:
 * no card (we have no rows), no external destination (rule 17), and the
 * disclaimer attached to the answer rather than to a footnote nobody reads.
 */
export const PUBLIC_RECORD_NOTICE_BADGE =
  '> 🌐 **Public Record Notice**: Sourced from live public filings. PropFyndr has not conducted an on-ground physical inspection for this project.'

export function unknownProjectDirective(name: string): string {
  return [
    '',
    `## PROJECT NOT IN OUR DATABASE: ${name}`,
    '',
    `The buyer asked about "${name}" and we hold no verified rows for it. The web`,
    'context above is UNVERIFIED and may be out of date or wrong.',
    '',
    'Answer like this, and only like this:',
    `- You MUST prepend this exact banner to the very top of your answer:`,
    `  ${PUBLIC_RECORD_NOTICE_BADGE}`,
    `- Say plainly, in your first sentence, that ${name} is not yet in our verified`,
    '  database and that what follows is unconfirmed background.',
    '- Give what the web context actually supports. Do not fill gaps from memory.',
    '  If it supports little, say little.',
    '- Do NOT present prices, possession dates or RERA numbers as facts. Attribute',
    '  them as reported and unconfirmed, or leave them out.',
    '- STRICTLY FORBIDDEN: Do NOT emit PropFyndr scores, PropFyndr ratings, or claim',
    '  on-ground physical verification for this unlisted project.',
    '- Close by offering our own advisory team to confirm the details.',
    '- Never name or link another website, portal or government site. Our team is',
    '  the only destination.',
    '',
  ].join('\n')
}
