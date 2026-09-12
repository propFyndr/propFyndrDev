/**
 * Open-query detection.
 *
 * The rest of the taxonomy in queryClassifier.ts assumes the user is shopping for
 * a property. A large class of real questions is not: "which sector do the richest
 * people live in", "tell me about Investors Clinic", "who founded Elite Group".
 * Those used to fail open to DISCOVERY and came back as property cards.
 *
 * This module recognises them and says what kind of grounding they need. It never
 * answers anything itself — groundedAnswer.ts does that.
 */

export type OpenTopic =
  | 'SECTOR_PROFILE' // who lives where / which area suits which buyer class
  | 'ENTITY'         // a company, builder, brokerage or person we may not hold
  | 'GENERAL'        // real-estate question with no property-search shape

export interface OpenQueryDetection {
  topic: OpenTopic
  /** Subject of an ENTITY lookup, cleaned. Absent for the other topics. */
  entity?: string
  reason: string
}

/** Buyer-class / demographic vocabulary — the "who lives here" family of questions. */
const DEMOGRAPHIC_RE =
  /\b(rich|richest|wealthy|wealthiest|affluent|posh|poshest|elite|upscale|hnw|high[- ]net[- ]worth|millionaires?|middle[- ]class|lower[- ]middle|upper[- ]class|working[- ]class|budget[- ]conscious|celebrities|politicians|bureaucrats|expats?|nris?)\b/i

/** Verbs that turn a demographic noun into a "where do they live" question. */
const RESIDENCE_RE =
  /\b(live|lives|living|reside|resides|residing|settle|settled|stay|prefer|prefers|preferred|buy|buys|buying|move|moving|located|concentrated)\b/i

const AREA_NOUN_RE = /\b(sector|sectors|area|areas|locality|localities|neighbourhood|neighborhood|micro[- ]market|part of|pocket)\b/i

/** Strongly entity-shaped phrasings. Ordered most specific first. */
const ENTITY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /(?:who\s+(?:are|is|was|were)\s+(?:the\s+)?(?:founders?|co[- ]founders?|owners?|ceo|promoters?|directors?|md|managing\s+director|chairman|chairperson)\s+of\s+)([^?.,\n]+)/i,
    reason: 'Leadership/ownership lookup',
  },
  {
    re: /\b(?:history|track\s+record|background|credibility|legitimacy|reviews?|complaints?)\s+of\s+([^?.,\n]+)/i,
    reason: 'Company background lookup',
  },
  {
    re: /(?:tell\s+me|know|give\s+me|need|want)\s+(?:more\s+)?(?:about|on)\s+([^?.,\n]+)/i,
    reason: 'Open "tell me about X" lookup',
  },
  {
    re: /^\s*(?:who|what)\s+(?:is|are|was|were)\s+([^?.,\n]+)/i,
    reason: 'Definitional "who/what is X" lookup',
  },
  {
    re: /\bis\s+([^?.,\n]+?)\s+(?:legit|legitimate|genuine|trustworthy|reliable|credible|any\s+good|a\s+scam|safe\s+to\s+deal\s+with)\b/i,
    reason: 'Trust check on a named party',
  },
  {
    re: /^\s*how\s+(?:is|are|good\s+is|reliable\s+is|reputed\s+is)\s+([^?.,\n]+)/i,
    reason: '"How is X" quality question',
  },
  {
    re: /\b(?:can|should|could)\s+i\s+(?:buy|purchase|book|deal|invest|work)\s+(?:a\s+\w+\s+)?(?:with|from|through|via)\s+([^?.,\n]+)/i,
    reason: 'Can-I-transact-with-X question',
  },
  {
    re: /\b(?:opinion|thoughts|view)\s+(?:on|about)\s+([^?.,\n]+)/i,
    reason: 'Opinion request about a named party',
  },
  {
    re: /\bwhat\s+do\s+you\s+think\s+(?:of|about)\s+([^?.,\n]+)/i,
    reason: 'Opinion request about a named party',
  },
]

/** Trailing noise that survives the capture group but is not part of the name. */
const ENTITY_TAIL_RE =
  /\s+(?:in|at|from|for|of)\s+(?:noida|greater\s+noida|noida\s+extension|delhi|ncr|india)\b.*$/i

function cleanEntity(raw: string): string {
  return raw
    .replace(ENTITY_TAIL_RE, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\s+(?:please|exactly|briefly)$/i, '')
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

/** A "name" that is really us, or the user, or nothing at all. */
const OWN_RECORD_RE = /^(?:noida|greater\s+noida|noida\s+extension|propfyndr|you|this\s+project|the\s+project|this|that|it|them|they|him|her|us|these|those)$/i

/**
 * Property attributes that survive the "what is X" capture but are not names.
 * "What is the payment plan" is a DRILLDOWN about the project in context, not a
 * question about a company called Payment Plan.
 */
const ATTRIBUTE_NOUN_RE =
  /\b(payment\s+plan|cost\s+sheet|carpet\s+area|super\s+area|price|pricing|rate|emi|stamp\s+duty|gst|amenit|possession|rera|floor\s+plan|layout|maintenance|parking|brochure|loan|down\s+payment|booking\s+amount|circle\s+rate|budget|status|way|ways|make\s+money|making\s+money|save\s+money|saving\s+money|invest|investing|investment|return|returns|roi|strategy|strategies|steps|step\s+by\s+step|tips|advice|guide|guidance|checklist|process|procedure|method|rules|young|age|career)\b/i

/**
 * Inventory vocabulary. "Tell me about 3BHK properties" is a search phrased as a
 * question — the discovery pipeline owns it, and answering it here would trade
 * real listings for prose.
 */
const INVENTORY_NOUN_RE =
  /\b(\d\s*bhk|bhk|propert(?:y|ies)|flats?|apartments?|homes?|houses?|villas?|plots?|units?|listings?|societ(?:y|ies)|projects?|builders?|developers?|group)\b/gi

const FILLER_WORD_RE = /\b(the|a|an|and|of|in|for|some|any|good|best|new|top)\b/gi

/**
 * Price, size and superlative terms. Their presence means the user is shopping,
 * whatever the sentence shape — the discovery and ranking paths own those.
 * Checked after the demographic branch, which is a question about people rather
 * than a filter and legitimately says things like "affordable".
 */
const SHOPPING_VOCAB_RE =
  /\b(best|top|cheapest|costliest|affordable|budget|under|below|within|over|above|between|crore|cr|lakh|lac|\d\s*bhk|bhk|sq\.?\s?ft|per\s+sqft)\b/i

/**
 * Words naming a PARTY you deal with rather than a thing you buy.
 *
 * These survive the shopping-vocabulary guard, because "which is the best broker
 * in Noida" is a question about companies and the discovery pipeline answers it
 * with property cards. `builder` and `developer` are deliberately absent: they
 * appear in `INVENTORY_NOUN_RE` above and "best builder projects in Sector 150"
 * is a search. A named builder still reaches the entity path through the
 * `ENTITY_PATTERNS` shapes, which do not need this exemption.
 */
const PARTY_NOUN_RE =
  /\b(broker|brokers|brokerage|brokerages|channel\s+partners?|agent|agents|agency|agencies|consultant|consultants|consultancy|realtor|realtors|advisor|advisors|advisory|firm|firms|clinic|middlemen|middleman|dealer|dealers)\b/i

/**
 * True when nothing survives after removing generic vocabulary — i.e. the capture
 * was a category, not a name.
 *
 * Word-level rather than a plain keyword test on purpose: half the developers in
 * NCR are named "<Something> Properties", "<Something> Homes" or "<Something>
 * Group", and rejecting on the generic half alone would drop every one of them.
 */
function isGenericPhrase(entity: string): boolean {
  const residue = entity
    .replace(INVENTORY_NOUN_RE, ' ')
    .replace(FILLER_WORD_RE, ' ')
    .replace(/[\d.,%₹-]/g, ' ')
    .trim()
  return residue.length < 3
}

/** Sector references answer from sector_intelligence, not from a company lookup. */
const SECTOR_NAME_RE = /^sector\s*\d+/i

/**
 * Classify a message as an open question, or return null to leave it to the
 * property taxonomy.
 *
 * `hasProjectNames` comes from intent extraction: if the extractor already tied
 * the message to a project in our database, the existing DRILLDOWN path is the
 * right owner and we stay out of the way.
 */
export function detectOpenQuery(
  userMessage: string,
  hasProjectNames: boolean,
): OpenQueryDetection | null {
  const msg = (userMessage || '').trim()
  if (msg.length < 3) return null

  // 1. General investment strategy, legal, financial, tax, or advisory questions in real estate -> GENERAL
  const isGeneralStrategyQuestion = /\b(make\s+money|making\s+money|save\s+money|saving\s+money|investing\s+strategy|how\s+to\s+invest|way\s+around|where\s+(?:should\s+i|can\s+i|to)\s+invest|portfolio\s*(?:allocation|strategy)?|career|age\s*\d+|young\s+buyer|first\s+time\s+buyer|roi|rental\s+income|commercial\s+vs\s+residential|flipping|payment\s+plan\s+safe|marketing\s+trap|10:90|20:80|30:70|downpayment|down\s+payment|leasehold|freehold|delay|possession\s+delay|penalty|compensation|r\.?e\.?r\.?a\s+date|hidden\s+costs?|bsp|section\s+54|ancestral|nri|nre|nro|repatriat|tax\s+exemption|tax\s+deduction|80c|24b|title\s+deed|encumbrance|token\s+money|circle\s+rate|market\s+rate|occupancy\s+certificate|double\s+gst|\d+%\s*gst|gst\s+on\s+(?:flat|property|apartment)|under[- ]construction\s*(?:flat|property|apartment|unit)?\s*(?:with\s*\d+%\s*gst|\s*vs|\s*or)|ready[- ]to[- ]move\s*(?:flat|property|apartment|unit)?\s*(?:with\s*\d+%\s*gst|\s*vs|\s*or)|discount\s+negotiat|stamp\s+duty\s+saving|transfer\s+memorandum|\btm\b|transfer\s+charges?|society\s+ndc|rwa\s+ndc|sub[- ]lease|document\s+chain|carpet\s+loading|loading\s+percentage|loading\s+%|lease\s+rent|one[- ]time\s+lease|yeida|jewar\s+airport|unauthorized\s+plotting|ganga\s+water|groundwater|tds|mivan|precast|far\s+3\.5|far\s+4\.0|floor\s+area\s+ratio|ground\s+coverage|loading\s+factor|kisan\s+quota|abadi\s+plot|authority\s+sealing|authority\s+seal|flat\s+sealed|registry\s*(?:is\s*)?(?:blocked|delayed|freeze|frozen|stalled|pending)|physical\s+keys|nri\s+repatriation|form\s+15ca|form\s+15cb|fema|special\s+power\s+of\s+attorney|\bspa\b|remote\s+registration|annual\s+ground\s+rent|lease\s+rent\s+revision|pvvnl|dg\s+backup|dg\s+power|power\s+backup\s+rate|194[- ]?ia|tds\s+on\s+property|capital\s+gains|pre[- ]leased\s+commercial|commercial\s+yield|construction\s+quality|mivan\s+vs\s+rcc|aluminium\s+shuttering)\b/i.test(msg)
  if (isGeneralStrategyQuestion) {
    return { topic: 'GENERAL', reason: 'Real estate advisory / financial / legal / strategy question' }
  }

  // 2. "Where do the rich / middle class live" — answerable from sector_intelligence.
  if (DEMOGRAPHIC_RE.test(msg) && (RESIDENCE_RE.test(msg) || AREA_NOUN_RE.test(msg))) {
    return { topic: 'SECTOR_PROFILE', reason: 'Demographic + residence/area question' }
  }

  if (hasProjectNames) return null

  /**
   * Shopping vocabulary anywhere in the message disqualifies the entity patterns.
   * "What are the best projects under 1.5 crore in Sector 62?" matches the
   * "what is X" shape and would otherwise be looked up as a company named
   * "best projects under 1.5 crore".
   *
   * Unless the message is about a PARTY rather than a property. "Which is the
   * best broker in Noida", "who is the most trustworthy consultant", "cheapest
   * channel partner" all carry `best`/`cheapest` and are not property searches —
   * and this guard sent every one of them to discovery, which answered a question
   * about a company with a shelf of property cards. Nothing downstream can
   * recover from that: the discovery path has no notion of a brokerage.
   *
   * Narrow deliberately. The exemption needs an explicit party noun; a
   * superlative plus an inventory noun is still shopping and still goes to
   * discovery, which is where the citywide band shelf now answers it.
   */
  if (SHOPPING_VOCAB_RE.test(msg) && !PARTY_NOUN_RE.test(msg)) return null

  // 2. Named third party we may not hold — brokerage, builder, person.
  for (const { re, reason } of ENTITY_PATTERNS) {
    const match = msg.match(re)
    if (!match?.[1]) continue
    const entity = cleanEntity(match[1])
    if (entity.length < 3) continue
    // "tell me about sector 150" is a sector question, not a company one.
    if (SECTOR_NAME_RE.test(entity)) {
      return { topic: 'SECTOR_PROFILE', reason: 'Sector profile via "about" phrasing' }
    }
    if (OWN_RECORD_RE.test(entity) || ATTRIBUTE_NOUN_RE.test(entity) || isGenericPhrase(entity)) continue
    return { topic: 'ENTITY', entity, reason }
  }

  /**
   * A question about a CATEGORY of party, with nobody named.
   *
   * "Which is the best broker in Noida" has no entity to look up — there is no
   * company called "the best broker" — so it matches none of the patterns above
   * and fell through to the property taxonomy, which answered a question about
   * companies with a shelf of property cards.
   *
   * Last, not first: a NAMED party has to win. Checked ahead of the loop this
   * swallowed "what do you think of Investors Clinic" and returned GENERAL,
   * throwing away the one thing that made the question answerable.
   */
  if (PARTY_NOUN_RE.test(msg)) {
    return { topic: 'GENERAL', reason: 'Question about a category of party, none named' }
  }

  return null
}

/** Signals that the user is shopping, not asking. Used to decide the fail-open lane. */
export function hasPropertySearchSignal(intent: Record<string, unknown>): boolean {
  const bhk = intent.bhk
  return Boolean(
    (Array.isArray(bhk) && bhk.length > 0) ||
      intent.budgetMin ||
      intent.budgetMax ||
      intent.sector ||
      intent.possession ||
      (Array.isArray(intent.projectNames) && intent.projectNames.length > 0),
  )
}
