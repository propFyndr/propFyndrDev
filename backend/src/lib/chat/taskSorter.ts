// backend/src/lib/chat/taskSorter.ts
//
// RealtyAsk's own question sorter: one task per buyer message, by plain ordered rules.
// No model call, so it costs nothing and gives the same answer every time.
//
// Measurement only for now (docs/benchmark/TASK_SORTER_REPORT_2026-10-27.md): it is scored
// against hand labels of real live turns (src/lib/eval/task-labels.json) and compared with the
// lane the router actually used. Nothing on the live request path calls it yet; a task moves
// to it only after its score is good enough and the owner chooses to switch it.

export const TASKS = [
  'search', 'project_fact', 'compare', 'price_check', 'cost_calc', 'advice',
  'legal', 'meta', 'action', 'followup', 'smalltalk', 'out_of_scope', 'other',
] as const
export type Task = (typeof TASKS)[number]

export interface Sorted {
  task: Task
  /** The rule that decided it, for reading reports. */
  rule: string
}

// Ordered: the first rule that matches decides. Earlier rules are the more specific ones.
const RULES: Array<{ task: Task; rule: string; test: (m: string, words: number) => boolean }> = [
  // Context-dependent replies: meaningless without the previous turn.
  { task: 'followup', rule: 'ui-or-answer', test: (m) => /^\[user selected ui option|\(answering:/.test(m) },
  { task: 'followup', rule: 'short-reply', test: (m, w) =>
    w <= 4 && /^(yes|yeah|yep|no|nope|ok(ay)?|sure|next|go on|okay go on|the (former|latter)|yes (please|show me( please)?)|step \d+|next step|\d+[a-z]?|[\d,]{4,})\b[\s?!.]*$/.test(m) },
  { task: 'followup', rule: 'step-count', test: (m) => /^(next step|how many steps|step \d+)/.test(m) },

  { task: 'smalltalk', rule: 'greeting', test: (m, w) =>
    w <= 3 && /^(hi+|hey+|hello|whats ?up|thanks?( you)?|nice|cool|great|ok)\b[\s!.?]*$/.test(m) },
  { task: 'smalltalk', rule: 'joke-or-noise', test: (m, w) =>
    /\bjoke\b/.test(m) || /^[^a-z0-9]+$/.test(m) || (w === 1 && m.length >= 4 && !/\d/.test(m) && !/[aeiou]/.test(m.replace(/[^a-z]/g, '').slice(1))) },

  // Questions about the advisor itself.
  { task: 'meta', rule: 'about-advisor', test: (m) =>
    /\b(which|what) (reasoning )?(model|llm)\b|\bare you (gpt|4o|chatgpt|claude|gemini)|\b4o\b|manually verified|verified by you|why should i trust|trust the information|what (all )?do you know about (me|my)|what (can you|you can) do( for me)?|user feedbacks?|reviews? (by|from) existing|properties (are )?(registered|listed) (in|on) your/.test(m) },

  // Outside V1 scope: other cities, rentals, resale listings, unrelated topics.
  { task: 'out_of_scope', rule: 'other-city', test: (m) =>
    /\b(mumbai|bangalore|bengaluru|pune|hyderabad|chennai|kolkata|gurgaon|gurugram|saket)\b/.test(m) && !/\bnoida\b/.test(m) },
  { task: 'out_of_scope', rule: 'rental', test: (m) =>
    !/\b(income|salary|emi|loan)\b/.test(m) && /\bunder \d{2}k\b|\b\d{2},?000\s*(\/|per)\s*month\b|\b(for rent|on rent|rental)\b/.test(m) },
  { task: 'out_of_scope', rule: 'resale-listing', test: (m) => /\b(show|share|find|list)\b.*\bresale\b|\bresale\b.*\b(under|listings?)\b/.test(m) },
  { task: 'out_of_scope', rule: 'unrelated', test: (m) => /\b(ipo|stock|shares? market|restaurant|restraunt|cafe|metro number of lines)\b/.test(m) },

  // Things the buyer wants done.
  { task: 'action', rule: 'dossier-or-lead', test: (m) =>
    /\b(dossier|shareable|summary i can share|site visit|callback|call back|book (a )?(site )?visit)\b/.test(m) },

  // Money arithmetic.
  { task: 'cost_calc', rule: 'tax-loan-afford', test: (m) =>
    /\b(stamp duty|registration (fee|charges?)|gst\b|emi|home loan|loan|afford|monthly income|income|salary|down ?payment|total cost|kitna padega|sab milake|transfer charges|maintenance)\b/.test(m) },

  // Legal and title risk.
  { task: 'legal', rule: 'legal-risk', test: (m) =>
    /\b(registry|land titles?|legal|litigation|eoi|refundable|refund)\b/.test(m) },

  // Picking between named options.
  { task: 'compare', rule: 'compare', test: (m) =>
    /\bcompare\b|\bvs\.?\b|\bversus\b|confused between|\bbetween (these|the shortlisted|the)\b|which (one )?would you (pick|buy|choose)|which \d+ would you|which (builder|one|has the best)|\bshortlist\b|\bthe top \d\b/.test(m) },

  // Is this price or budget right?
  { task: 'price_check', rule: 'fairness', test: (m) =>
    /\b(fair( price)?|overpa\w*|overpriced|too much|reasonable budget|minimum (budget)?|negotiat\w*|good deal)\b/.test(m) },

  // A feature asked of many properties is a search, not one project's fact.
  { task: 'search', rule: 'feature-search', test: (m) => /\b(properties|projects|flats)\b (which|that|with) (has|have)\b/.test(m) },

  // One project's facts: strong cues that name a property question, not a search.
  { task: 'project_fact', rule: 'project-cue', test: (m) =>
    /\bwhat'?s the catch\b|\bcost sheet\b|\bpayment (plans?|schedule)\b|\bsizes?\b|\bamenit\w*\b|what'?s (near|around)|\bwhat is near\b|\bhow far\b|\brecent update\b|\bprice (trend|history)\b|price of .+ changed|\bdeveloper of\b|\btrack record\b|\brera\b|\boc\b|\bwater quality\b|\bready to move\?|\bhow reliable\b|\bbadminton\b|\bpadel\b|\bpaddle\b|\bthere\??$|\bthis (property|project|specific)\b|\bflat options\b|\bshow me [a-z]+ ?[a-z]*\.?$/.test(m) },

  // General guidance.
  { task: 'advice', rule: 'guidance', test: (m) =>
    /\bwhich (noida )?sectors?\b|\bwhere should\b|\bgood time\b|what should i (check|consider|actually consider)|\bbefore buying\b|\broadmap\b|\bbest locations? to invest\b|\brent(ing)? instead\b|\btop residential sectors\b|\bnearest to\b|\bwhich (area|locality)\b|\bnoida extension ya\b/.test(m) },

  // Finding properties: criteria or a request to see options.
  { task: 'search', rule: 'criteria', test: (m) =>
    /\b\d\s?bhk\b|\bbhk\b|\bcrores?\b|\b\d+(\.\d+)?\s?cr\b|\blakhs?\b|\bbudget\b|\bsector\b|\bprojects?\b|\boptions\b|\bflats?\b|\bapartments?\b|\bpropert(y|ies)\b|\bplots?\b|\bstudios?\b|\bready to move\b|\bupcoming\b|\bshow me\b|\bfind me\b|\blooking for\b|\bi want\b|\bsearch\b/.test(m) },
]

export function sortTask(message: string | null | undefined): Sorted {
  const m = String(message ?? '').toLowerCase().replace(/[“”]/g, '"').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()
  if (!m) return { task: 'other', rule: 'empty' }
  const words = m.split(' ').length
  for (const r of RULES) if (r.test(m, words)) return { task: r.task, rule: r.rule }
  return { task: 'other', rule: 'no-rule' }
}
