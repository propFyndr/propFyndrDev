// backend/src/lib/ai/toolBlindGuard.ts
//
// Mistral, Cerebras and Groq carry supportsTools: false. On those legs the
// model cannot call sector_projects, rera_check or any other lookup — it holds
// only whatever the prompt injected. The no-tools prompt block tells it to say
// so. Measured over a 67-query run on 30 Aug, with the billed Gemini balance
// depleted and every turn landing on a tool-blind leg, it did not:
//
//   "best society in sector 137 noida"
//     → **Shriram Suites** | Shriram Properties | STRONG_BUY | OC issued
//       No Shriram row exists. Sector 137 holds ten real projects.
//   "property dealers in sector 75 noida"
//     → Square Yards, PropTiger (Housing.com), each with an invented
//       "UP-RERA Form-7 No. 1023" registration.
//
// Both were graded a pass by the corpus runner and would have been read by a
// buyer as verified. A prompt rule the model ignores is not a control, so this
// is the mechanical one: on a tool-blind leg the finished answer is checked
// against the facts the prompt actually carried, and an answer that names
// something we did not give it is discarded and the turn rolls to the next leg.
//
// Deliberately narrow. It does not judge advice, tone or completeness — only
// whether a name, a registration number or a rival portal appeared from nowhere.
import { extractFactsFromPrompt } from './guardrails-v2'
import { prisma } from '../db'

/** Named in the prompt's COMPETITOR BAN. Never ours to recommend, ever. */
const COMPETITORS = [
  'proptiger', 'magicbricks', '99acres', 'housing.com', 'nobroker',
  'square yards', 'squareyards', 'commonfloor', 'makaan',
]

/**
 * Any registration-shaped claim, not only a well-formed UPRERAPRJ id.
 * The fabricated ones read "UP-RERA Form-7 No. 1023", which the existing
 * UPRERAPRJ pattern in guardrails-v2 does not see at all.
 */
const RERA_CLAIM = /\bUP[\s‑-]?RERA[^\n|]{0,40}?(\d{3,})/gi
const UPRERAPRJ = /UPRERAPRJ[\w/]+/gi

/**
 * Bolding is how the model presents a project it is claiming exists —
 * "**Shriram Suites** | Shriram Properties | STRONG_BUY".
 *
 * A first-column scan was tried alongside this and removed: over a 67-query run
 * it contributed only label cells from two-column "Factor | Reality Check"
 * tables, and every real project claim it found was bolded anyway, so it cost
 * three discarded-but-honest answers and caught nothing this does not.
 */
const BOLD_NAME = /\*\*([^*\n]{3,60})\*\*/g

/** A bolded label introducing prose — "**Rental Yield**: 2.5%–3.5% gross". */
const LABEL_SUFFIX = /^\s*[::—-]/

/**
 * What makes a bolded phrase a claim that a BUILDING exists.
 *
 * The first version of this guard asked the opposite question — a blocklist of
 * words that open a heading — and it was whack-a-mole. Every run produced new
 * labels it had not been told about ("Carpet Efficiency Gap", "Power Backup
 * Tariffs", "Rental Yield Anchor"), and each one discarded an honest answer.
 * The list can never be finished, because prose invents headings freely and
 * project names do not.
 *
 * Asking the positive question terminates: a project is named after a place,
 * so its name carries a place word. This list is closed in a way a blocklist
 * is not — the same trick guardrails-v2 already uses on its own name pattern.
 */
const PROJECT_WORD =
  /\b(heights?|towers?|city|plaza|square|park|parks|garden|gardens|grove|greens?|residency|residences?|court|manor|enclave|complex|villas?|apartments?|suites?|homes?|estate|vista|acres|riverfront|meadows|avenue|boulevard|habitat|paradise|oasis|valley|springs?|lake|county|society|floors|heights|nagar|vihar|kunj|dham|puram|bagh)\b/i

/**
 * A place word is not the only shape. "Sobha Quartz", "Mahagun Moderne" and
 * "Omaxe The Hemisphere" carry none — they lead with the builder instead. So a
 * candidate whose first word names a builder the prompt actually supplied is
 * treated as a project claim too, which is precisely the turn ("best society in
 * sector X") where the facts block carries that builder and the model then
 * invents a project under it.
 */
const leadsWithKnownBuilder = (name: string, builders: string[]): boolean => {
  const first = name.split(/\s+/)[0]?.toLowerCase()
  return !!first && first.length >= 4 && builders.some(b => b.split(/\s+/)[0]?.toLowerCase() === first)
}

/** Areas and pockets are places we do not hold rows for, not buildings. */
const IS_A_PLACE = /^(sector|techzone|knowledge park|phase|block|pocket|zone|chi|alpha|beta|gamma|omicron)\b/i

export interface ToolBlindViolation {
  kind: 'unknown_name' | 'invented_rera' | 'competitor'
  detail: string
}

/** Title Case, at least two words, no stray punctuation or figures. */
function looksLikeAName(s: string, builders: string[]): boolean {
  const t = s.trim()
  if (t.length < 5 || IS_A_PLACE.test(t)) return false
  if (/[₹%|]|\d{4}|\bcr\b|\blakh\b|\bbhk\b|\bsq/i.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length < 2 || words.length > 6) return false
  // "Space per Rupee" and "Best Value for Money" fall out here: a lowercase
  // connective is prose, and a project name does not carry one.
  if (!words.every(w => /^[A-Z0-9][\w'&.-]*$/.test(w))) return false
  return PROJECT_WORD.test(t) || leadsWithKnownBuilder(t, builders)
}

/**
 * Every project and builder name we hold, cached in process.
 *
 * The prompt's own facts block is not enough to check against. A GATHERING turn
 * retrieves no projects, so the block is empty — and on exactly such a turn
 * Mistral answered an affordability question with six invented projects
 * (Prateek Omni, Paramount Golfshire, Omaxe The Mayfair, Godrej Aristocrat…),
 * four of them hung on builders we really do hold. Attaching a fictional
 * project to a real developer is the most convincing fabrication available, and
 * with an empty facts block there was nothing to catch it with.
 *
 * ~400 short strings, refreshed every ten minutes. A failure resolves to null
 * and the check falls back to prompt facts alone: a guard that cannot read the
 * database must not fail a turn the database would have cleared.
 */
const NAME_CACHE_TTL_MS = 10 * 60 * 1000
let nameCache: { at: number; projects: string[]; builders: string[]; rera: string[] } | null = null
let nameCacheInFlight: Promise<void> | null = null

async function loadKnownNames(): Promise<{ projects: string[]; builders: string[]; rera: string[] } | null> {
  if (nameCache && Date.now() - nameCache.at < NAME_CACHE_TTL_MS) return nameCache
  // Concurrent turns share one query rather than each issuing their own.
  if (!nameCacheInFlight) {
    nameCacheInFlight = (async () => {
      try {
        const [projects, builders] = await Promise.all([
          prisma.project.findMany({ select: { name: true, rera_number: true } }),
          prisma.builder.findMany({ select: { name: true } }),
        ])
        nameCache = {
          at: Date.now(),
          projects: projects.map(p => p.name).filter(Boolean),
          builders: builders.map(b => b.name).filter(Boolean),
          // Registration numbers we actually hold. Without these the RERA check
          // could only compare against the prompt text, and on a tool-calling
          // turn the number arrives in a tool RESULT and never appears in the
          // prompt at all — so a correct number read straight from our own row
          // was reported as invented. Measured: UPRERAPRJ76128 (Amrapali
          // Silicon City) and UPRERAPRJ168120 (Samridhi Daksh Avenue), both
          // ours, both discarded, on a table where zero of 280 rows lack a
          // registration number.
          rera: projects.map(p => p.rera_number).filter((r): r is string => Boolean(r && r.trim())),
        }
      } catch (err) {
        console.warn('[TOOL_BLIND_GUARD] could not load known names, falling back to prompt facts:', err)
      } finally {
        nameCacheInFlight = null
      }
    })()
  }
  await nameCacheInFlight
  return nameCache
}

/**
 * Test seam. Priming the snapshot keeps the unit tests off the database — they
 * assert on the name rules, not on what happens to be in Postgres today.
 * Passing null drops it so the next check loads for real.
 */
export function setKnownNamesForTest(
  v: { projects: string[]; builders: string[]; rera?: string[] } | null,
): void {
  nameCache = v ? { at: Date.now(), rera: [], ...v } : null
}

/**
 * Checks a finished answer from a leg that could not look anything up.
 *
 * Returns every violation found. An empty array means the answer said nothing
 * it was not given — it does NOT mean the answer is good.
 */
export async function checkToolBlindAnswer(text: string, systemPrompt: string): Promise<ToolBlindViolation[]> {
  return runCheck(text, systemPrompt, await loadKnownNames())
}

/**
 * The same check, without the database round-trip.
 *
 * Returns `null` when the name cache is cold, which means "cannot judge" and is
 * not the same as "clean". Paragraph-level release depends on this distinction:
 * an answer may only be shown early on a check that actually ran, so a cold
 * cache falls back to buffering the whole answer exactly as before.
 */
export function checkToolBlindAnswerSync(text: string, systemPrompt: string): ToolBlindViolation[] | null {
  const held = nameCache && Date.now() - nameCache.at < NAME_CACHE_TTL_MS ? nameCache : null
  if (!held) return null
  return runCheck(text, systemPrompt, held)
}

/** Fills the name cache so the sync check can run. Failure is not fatal. */
export function warmKnownNames(): void {
  void loadKnownNames().catch(() => {})
}

function runCheck(
  text: string,
  systemPrompt: string,
  held: { projects: string[]; builders: string[]; rera: string[] } | null,
): ToolBlindViolation[] {
  const violations: ToolBlindViolation[] = []
  const lower = text.toLowerCase()

  for (const rival of COMPETITORS) {
    if (lower.includes(rival)) {
      violations.push({ kind: 'competitor', detail: rival })
    }
  }

  const facts = extractFactsFromPrompt(systemPrompt)
  const builderNames = [...facts.builders, ...(held?.builders ?? [])]
    .map(n => n.trim())
    .filter(n => n.length >= 3)
  const known = [...facts.projectNames, ...facts.builders, ...(held?.projects ?? []), ...(held?.builders ?? [])]
    .map(n => n.toLowerCase().trim())
    .filter(n => n.length >= 3)

  // A registration number is a regulatory claim. It is never something to
  // reason out, so it is checked even when the prompt carried no facts at all —
  // which is exactly the turn the invented ones appeared on.
  const claimed = new Set<string>()
  for (const m of text.matchAll(RERA_CLAIM)) claimed.add(m[0].trim())
  for (const m of text.matchAll(UPRERAPRJ)) claimed.add(m[0].trim())
  /**
   * The reference set is the database, not the prompt — for numbers too.
   *
   * That principle was already applied to project names and never to
   * registration numbers, which were checked only against `facts.reraNumbers`
   * scraped out of the prompt text. On a turn where the model CALLS a tool the
   * number comes back in the tool RESULT and is never in the prompt at all, so
   * a correct registration read straight from our own row was reported as
   * invented and the answer discarded. Measured: UPRERAPRJ76128 (Amrapali
   * Silicon City) and UPRERAPRJ168120 (Samridhi Daksh Avenue), both ours, both
   * binned — on a table where zero of 280 rows lack a registration number. The
   * check was pure false positive on every tool-calling turn.
   *
   * A database read that fails leaves `heldRera` empty and this falls back to
   * prompt facts alone, exactly as the name check does: a guard that cannot
   * read the database must not fail a turn the database would have cleared.
   */
  const canonRera = (r: string) => r.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const knownRera = [...(held?.rera ?? []), ...facts.reraNumbers]
    .map(canonRera)
    .filter(r => r.length >= 5)
  for (const claim of claimed) {
    const digits = canonRera(claim)
    // The model writes "UPRERAPRJ76128" and also "UP-RERA No. 76128", so a
    // claim matches when it contains a registration we hold or is contained
    // by one.
    const verified = knownRera.some(r => digits.includes(r) || r.includes(digits))
    if (!verified) violations.push({ kind: 'invented_rera', detail: claim })
  }

  // Nothing to compare against — the prompt carried no facts AND the database
  // could not be read. Anything flagged here would be flagged for want of a
  // reference set, not for being wrong. The RERA and competitor checks above
  // still ran, so this is a narrowing, not a bypass.
  if (known.length === 0) return violations

  const candidates = new Set<string>()
  for (const m of text.matchAll(BOLD_NAME)) {
    // What follows the closing ** decides what it was. A colon or a dash means
    // the bold text labelled the sentence after it; a project name does not.
    if (LABEL_SUFFIX.test(text.slice(m.index + m[0].length))) continue
    candidates.add(m[1].trim())
  }

  for (const name of candidates) {
    if (!looksLikeAName(name, builderNames)) continue
    const lc = name.toLowerCase()
    if (known.some(k => k.includes(lc) || lc.includes(k))) continue
    violations.push({ kind: 'unknown_name', detail: name })
  }

  return violations
}
