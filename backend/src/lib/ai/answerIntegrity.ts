// backend/src/lib/ai/answerIntegrity.ts
//
// One gate every finished answer passes before a buyer reads it.
//
// `toolBlindGuard` already asked "did this leg invent a project?", but only on
// legs that could not call a tool. That was the wrong boundary: measured live,
// the tool-capable Gemini leg answered "What is Skyline Verdant Quartz
// Residency?" — a name that does not exist — with "a prominent high-rise
// residential development in Noida, crafted by **Supertech Limited**", and no
// guard ran at all, because the leg had tools.
//
// Two more classes showed up in the same session, and neither is fabrication:
//
//   "What about the second one?"
//     → "The user asks 'What about the second one?', but the provided verified
//        facts block only contains information for a single project…
//        We only have records for Samridhi Daksh Avenue in Sector 150 Noida,
//        as no second project was provided in the database."
//
// That is the prompt's own scaffolding read aloud to a buyer, wrapped around a
// false claim about our coverage — we hold nineteen projects in Sector 150.
//
//   "Hi"
//     → "We currently maintain verified data on 280 projects across 61 sectors"
//
// which is the shape of our table, told to anyone who types a greeting.
//
// So the gate asks three questions, and they carry different consequences:
//
//   FABRICATION  — a project or registration number from nowhere.  discard
//   META_LEAK    — the answer describes the prompt, or denies data we hold. discard
//   INVENTORY    — a count of what we hold.                        discard
//   FRAMING      — "our database", "in our records".               rewrite
//
// Discard means the turn rolls to the next leg with nothing sent, exactly as a
// provider failure does. Rewrite means the phrase is replaced in place, because
// binning a good answer over a house-style slip is the more expensive error.

import { checkToolBlindAnswer, type ToolBlindViolation } from './toolBlindGuard'

export type IntegrityKind =
  | 'fabrication'
  | 'meta_leak'
  | 'inventory_size'
  | 'unfounded_warning'
  | 'raw_payload'
  | 'opaque_score'

/**
 * The answer is not an answer — it is the data we handed the model.
 *
 * Measured in a demo replay, "Show me 3 BHK projects in Sector 150 under 2
 * crore" was answered with 1,400 characters of pretty-printed JSON, opening:
 *
 *     [
 *         {
 *             "id": "88319d1f-5049-410e-9c2a-2913c1f373b3",
 *             "name": "ATS Pious Hideaways / Orchards",
 *
 * — every internal id included, cut off mid-array by the reply ceiling. A leg
 * echoed its tool result instead of writing prose. Nothing caught it: it names
 * only real projects, quotes no rule, claims no score, so every existing check
 * passed it.
 *
 * The same turn also produced `[Godrej Nest](#entity:09f087b6-5288-...)` —
 * internal UUIDs as link targets in buyer-visible markdown.
 *
 * Both are the same defect: our internal representation reaching the screen.
 */
/**
 * An analyst score that reached the answer anyway.
 *
 * `projectExposure` removes these at the source and `opaqueScores.test.ts`
 * stops a new emitter appearing — but that is a SOURCE check, and twice now a
 * score has arrived by a path the source check was not watching: seven separate
 * emitters the first time, then `builderOnTimeDeliveryPercent`, a field whose
 * name promised a unit its value did not have. Both shipped "a 92% builder
 * delivery score" to a buyer.
 *
 * So there is a runtime check too. The source test prevents the class; this
 * catches the instance.
 *
 * Narrow on purpose. A percentage is usually a real fact here — "82% open green
 * space", "5% GST", "7% stamp duty", "80% of the podium" — so the pattern fires
 * only when the number sits next to scoring vocabulary. A bare "/100" is always
 * one of ours; nothing legitimate is expressed that way.
 */
const SCORE_WORD = '(?:score|rating|delivery|compliance|quality|satisfaction|track\\s+record)'
const OPAQUE_SCORE: Array<[RegExp, string]> = [
  [new RegExp(`\\b\\d{1,3}\\s*%[^.\\n]{0,24}\\b${SCORE_WORD}`, 'i'), 'quotes an analyst score as a percentage'],
  [new RegExp(`\\b${SCORE_WORD}[^.\\n]{0,24}\\b\\d{1,3}\\s*%`, 'i'), 'quotes an analyst score as a percentage'],
  [/\b\d{1,3}\s*\/\s*100\b/, 'quotes a score out of 100'],
]

const RAW_PAYLOAD: Array<[RegExp, string]> = [
  // A JSON object or array as the body of the answer, not an inline snippet.
  [/^\s*[[{][\s\S]{0,80}"\w+"\s*:/, 'the answer opens as a JSON payload'],
  // Structural JSON anywhere in quantity: three or more quoted keys.
  [/("(?:id|name|slug|sector|status|price_min_cr|rera_number|builder|unit_types|amenities)"\s*:[\s\S]{0,120}){3,}/, 'the answer contains a JSON row dump'],
  // A UUID is ours and means nothing to a buyer.
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, 'exposes an internal id'],
  [/#entity:/i, 'exposes an internal entity link'],
]

/**
 * Telling a buyer to avoid a developer we hold no legal finding against.
 *
 * BUILDER DATA RULES already say it: "Never name a non-flagged builder as risky
 * — this creates defamation risk." Measured in the demo replay, a leg wrote
 * "**Skip Antriksh and Ajnara projects** – they carry low-risk or legal flags
 * that mean extra caution is warranted", inventing the flags as it went. That
 * is a published statement about a real company's conduct, made up by a model
 * that had no such field in front of it.
 *
 * A warning IS allowed when the prompt actually carried the grounds — a
 * `legal_flag`, an NCLT note, or a name on the blocked list HARD RULE 6c
 * injects. So the check is not "did it warn" but "was the warning supplied".
 */
const AVOID_VERB = /\b(?:avoid|skip|steer\s+clear\s+of|stay\s+away\s+from|do\s+not\s+(?:buy|consider)|don't\s+(?:buy|consider)|not\s+recommended|be\s+wary\s+of|beware)\b/i

/**
 * Capitalised runs following an avoid-verb, up to a short distance.
 *
 * The verb is spelled in both cases rather than carrying an `i` flag: the
 * capture depends on `[A-Z]` to find a developer's NAME, and a case-insensitive
 * flag applies to the whole pattern, so it would match any lowercase word and
 * flag "avoid paying anything upfront" as a warning about a company.
 */
const AVOID_TARGET = /\b(?:[Aa]void|[Ss]kip|[Ss]teer\s+clear\s+of|[Ss]tay\s+away\s+from|[Bb]e\s+wary\s+of|[Bb]eware(?:\s+of)?)\b[^.\n]{0,40}?\b([A-Z][A-Za-z&.]{2,}(?:\s+[A-Z][A-Za-z&.]{2,}){0,2})/g

/** Words that look like a name after "avoid" but are not a developer. */
const NOT_A_DEVELOPER = /^(?:The|A|An|Any|All|Under|Ready|Sector|Noida|Greater|RERA|UP|GST|EMI|NCLT|Projects?|Builders?|Developers?|Properties|Buying|Paying|Making|Signing|This|That|These|Those|It|If|When|Where|What|I|We|You)$/i

function unfoundedWarnings(text: string, prompt: string): IntegrityViolation[] {
  if (!AVOID_VERB.test(text)) return []
  const promptLower = prompt.toLowerCase()
  const out: IntegrityViolation[] = []
  const seen = new Set<string>()

  for (const m of text.matchAll(AVOID_TARGET)) {
    const name = m[1].trim()
    const first = name.split(/\s+/)[0]
    if (NOT_A_DEVELOPER.test(first)) continue
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())

    // The grounds have to be in the prompt: a legal flag, an insolvency note,
    // or the blocked list. A name appearing merely as inventory is not grounds.
    const at = promptLower.indexOf(first.toLowerCase())
    if (at < 0) continue // not a name the prompt supplied at all — fabrication check owns it
    const around = promptLower.slice(Math.max(0, at - 400), at + 400)
    const grounded =
      /legal_flag|blocked builder|nclt|insolvenc|court proceedings|rera cancellation|receivership|never recommend/.test(around)
    if (!grounded) {
      out.push({ kind: 'unfounded_warning', detail: `told the buyer to avoid "${name}" with no flag in the prompt` })
    }
  }
  return out
}

export interface IntegrityViolation {
  kind: IntegrityKind
  detail: string
}

/**
 * The model describing its own inputs, or denying data on the grounds that the
 * prompt did not carry it.
 *
 * Every pattern is anchored on OUR internal vocabulary — facts block, context,
 * prompt, injected, system instruction — rather than on ordinary English. "The
 * builder has not provided a possession date" is a real sentence a buyer should
 * read; "no second project was provided in the database" is not.
 */
const META_LEAK: Array<[RegExp, string]> = [
  [/\b(?:verified\s+)?facts?\s+block\b/i, 'names the facts block'],
  [/\bsystem\s+(?:prompt|instruction)/i, 'names the system prompt'],
  [/\b(?:the|my)\s+(?:instructions?|prompt)\s+(?:say|says|state|states|tell|told)/i, 'quotes its instructions'],
  // An adverb may sit between. Measured: "The user **simply** said 'sectors 1
  // and 2'" walked past the tight version of this pattern.
  [/\bthe\s+user\s+(?:\w+\s+){0,2}(?:asks|asked|is\s+asking|says|said|wants|wanted|mentioned|provided)\b/i, 'narrates the request in the third person'],
  /**
   * The model reading its own rulebook aloud.
   *
   * Measured on "sectors 1 and 2": the reply opened "The user simply said…",
   * then "Wait, looking at the rules:" and recited three of them as bullets —
   * "**No search was run this turn.** Do not say a sector is absent",
   * "**One question max.**" That is the prompt, verbatim, delivered to a buyer.
   */
  [/\b(?:looking\s+at|according\s+to|per|checking)\s+the\s+rules\b/i, 'reads its rulebook aloud'],
  [/^\s*wait,/im, 'thinks out loud in the answer'],
  [/\b(?:one\s+question\s+max|no\s+search\s+was\s+run\s+this\s+turn|do\s+not\s+say\s+a\s+sector\s+is\s+absent)\b/i, 'quotes a prompt rule verbatim'],
  [/\bas\s+an\s+AI\b|\blanguage\s+model\b/i, 'breaks character'],
  // "…was not provided in the database". The trailing noun is what makes this a
  // complaint about our input rather than a fact about a builder: "the builder
  // has not provided a possession date" is a sentence a buyer needs to read.
  [/\b(?:was|were|is|are)\s+not\s+(?:provided|supplied|included|present)\s+(?:in|to|within)\s+(?:the\s+|our\s+|my\s+)?(?:database|context|prompt|facts?|block|data\s?set)/i, 'blames the prompt for missing data'],
  [/\bno\s+\w+(?:\s+\w+)?\s+(?:was|were)\s+(?:provided|supplied|injected)\b/i, 'blames the prompt for missing data'],
  [/\b(?:provided|given|injected|supplied)\s+(?:verified\s+)?(?:facts|context|data\s+block)/i, 'names the injected block'],
  [/\b(?:the\s+)?context\s+(?:provided|given|window|supplied)\b/i, 'names the context'],
  // Reporting the shape of its input rather than answering from it.
  [/\bonly\s+(?:contains?|includes?|has|holds?)\s+(?:information|details?|data)\s+(?:for|on|about)\b/i, 'reports the shape of its input'],
]

/** Numbers a model writes as words when it is counting something small. */
const WORD_COUNT = '(?:a\\s+single|one|two|three|four|five|six|seven|eight|nine|ten|no)'
const DIGIT_COUNT = '\\d[\\d,]*\\+?'
const ANY_COUNT = `(?:${DIGIT_COUNT}|${WORD_COUNT})`

/** "our database", "our verified database", "the data set we maintain". */
const OUR_STORE = '(?:our|the|my)\\s+(?:\\w+\\s+){0,2}?(?:database|records?|inventory|portfolio|catalogue|catalog|data\\s?set|data|listings)'

/**
 * A claim about how much inventory we hold.
 *
 * Not the same thing as counting what is on screen. "Three of these six are
 * ready to move" is a fact about the shortlist the buyer is looking at and is
 * useful; "we hold 280 projects across 61 sectors" is the size of our table and
 * belongs to us. The distinction the patterns draw is the possessive: a count
 * attached to *we / our / the database*, not a count attached to *these*.
 */
const HEDGE = '(?:currently\\s+|right\\s+now\\s+|only\\s+|just\\s+|over\\s+|around\\s+|about\\s+|more\\s+than\\s+|nearly\\s+|approximately\\s+)*'

const INVENTORY_SIZE: Array<[RegExp, string]> = [
  // "We hold / maintain verified data on 280 projects". Digits only: a bare
  // "we hold one project" is how our own sector-coverage reply is phrased, and
  // it is scoped to a sector rather than to the table.
  // "verified" may sit either side of the number. Measured: "We track 12
  // verified projects in Sector 1 alone" walked past the version that only
  // allowed it before the digit.
  [new RegExp(`\\b(?:we|i)\\s+(?:hold|have|track|cover|maintain|list|carry)\\s+(?:verified\\s+|only\\s+)?(?:data\\s+on\\s+)?${HEDGE}${DIGIT_COUNT}\\s+(?:[\\w-]+\\s+){0,2}?(?:projects?|societies|properties|sectors?|builders?|developers?|listings?)`, 'i'), 'counts our holdings'],
  // "280 projects across 61 sectors" — the shape of the table, whoever says it.
  [new RegExp(`\\b${DIGIT_COUNT}\\s*(?:projects?|societies|properties)\\s+across\\s+${DIGIT_COUNT}\\s*(?:sectors?|micro[- ]?markets?|cities)`, 'i'), 'counts our holdings'],
  // "Our verified database currently contains details for only one project".
  // Word counts included here, because the subject is the store itself.
  [new RegExp(`${OUR_STORE}\\s+${HEDGE}(?:has|have|holds?|contains?|covers?|includes?|spans?|lists?)\\s+(?:details?\\s+(?:for|on)\\s+)?${HEDGE}${ANY_COUNT}\\b`, 'i'), 'reports the size of our holdings'],
  [new RegExp(`\\b(?:database|records?|inventory)\\s+(?:of|with)\\s+${HEDGE}${DIGIT_COUNT}\\s*(?:projects?|societies|properties|sectors?)`, 'i'), 'counts our holdings'],
  [new RegExp(`\\b(?:total|entire|full|whole)\\s+(?:inventory|database|portfolio)\\s+(?:of|is|has)\\s+${HEDGE}${ANY_COUNT}`, 'i'), 'counts our holdings'],
  // "We only have records for X" — a claim that our coverage ends at one row.
  [new RegExp(`\\b(?:we|i)\\s+only\\s+(?:have|hold)\\s+(?:records?|data|details?|information)\\s+(?:for|on|about)\\b`, 'i'), 'reports the size of our holdings'],
]

/**
 * House-style slips that are not worth binning an answer over.
 *
 * "Here are the verified matching projects in our database" is accurate and
 * harmless in substance; it just says out loud that there is a database, which
 * is our business and not the buyer's. Rewritten, never discarded — the
 * replacement has to read naturally in mid-sentence, so each pair is chosen to
 * drop into the same grammatical slot.
 */
const FRAMING_REWRITES: Array<[RegExp, string]> = [
  // Most specific first: the negative forms have to win before the bare "in the
  // database" rule rewrites their middle and leaves "not in our verified data",
  // which is not what we mean.
  [/\bnot\s+(?:currently\s+)?in\s+(?:our|the)\s+(?:\w+\s+){0,2}?database\b/gi, 'not something we hold'],
  [/\bin\s+(?:our|the)\s+(?:\w+\s+){0,2}?database\b/gi, 'in our verified data'],
  [/\bfrom\s+(?:our|the)\s+(?:\w+\s+){0,2}?database\b/gi, 'from our verified data'],
  [/\b(?:our|the)\s+(?:\w+\s+){0,2}?database\s+(?:shows|says|lists|contains)\b/gi, 'our verified data shows'],
  [/\b(?:our|my)\s+(?:\w+\s+){0,2}?database\b/gi, 'our verified data'],
  [/\bin\s+our\s+records\b/gi, 'in what we hold'],
  // Anything still saying "database" after the shaped rules above. Kept last so
  // the natural phrasings win first; this only stops the word escaping.
  [/\b(?:the\s+)?database\b/gi, 'our verified data'],
]

/** Strips the house-style slips. Never fails an answer. */
export function rewriteFraming(text: string): { text: string; rewrites: number } {
  let out = text
  let rewrites = 0
  for (const [pattern, replacement] of FRAMING_REWRITES) {
    out = out.replace(pattern, () => {
      rewrites++
      return replacement
    })
  }
  return { text: out, rewrites }
}

/**
 * The disclosure half of the gate: meta-leak and inventory size.
 *
 * Exported because it is pure and is the half worth pinning with real strings.
 * The fabrication half needs the database and is covered by toolBlindGuard.
 */
export function scanDisclosure(text: string): IntegrityViolation[] {
  return [
    ...scan(text, META_LEAK, 'meta_leak'),
    ...scan(text, INVENTORY_SIZE, 'inventory_size'),
    ...scan(text, RAW_PAYLOAD, 'raw_payload'),
    ...scan(text, OPAQUE_SCORE, 'opaque_score'),
  ]
}

function scan(text: string, table: Array<[RegExp, string]>, kind: IntegrityKind): IntegrityViolation[] {
  const found: IntegrityViolation[] = []
  for (const [pattern, detail] of table) {
    const m = pattern.exec(text)
    if (m) found.push({ kind, detail: `${detail}: "${m[0].slice(0, 60)}"` })
  }
  return found
}

/**
 * Everything that must be true before a buyer reads this answer.
 *
 * `prompt` is the system prompt the leg was actually given — the fabrication
 * check needs it to know which names were legitimately supplied. `hasTools`
 * only affects reporting: the check itself is the same either way, which is the
 * point. A leg that CAN look something up and invents it anyway is worse than
 * one that cannot, not better.
 */
export async function checkAnswerIntegrity(
  text: string,
  prompt: string,
): Promise<IntegrityViolation[]> {
  const body = text.trim()
  if (!body) return []

  const violations: IntegrityViolation[] = [
    ...scanDisclosure(body),
    ...unfoundedWarnings(body, prompt),
  ]

  // Only worth the database round-trip when nothing cheaper has already failed
  // the answer — the result is the same and the check is cached, but a turn
  // that is already rolling over should roll over now.
  if (violations.length === 0) {
    const fabrications: ToolBlindViolation[] = await checkToolBlindAnswer(body, prompt)
    for (const f of fabrications) {
      violations.push({ kind: 'fabrication', detail: `${f.kind}(${f.detail})` })
    }
  }

  return violations
}
