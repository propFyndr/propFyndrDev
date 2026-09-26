/**
 * Answer rules shared by the main advisor prompt and the open lane.
 *
 * Each rule is a failure measured on one 10-question buyer test run
 * (claudeQueries.md, 2026-09-26). They live in one place so the two lanes
 * cannot drift. A rule written into only one prompt is a rule half the buyers
 * never get.
 *
 * Selected per message, like the playbooks, rather than sent on every turn:
 * the static head is already over its token ratchet (promptHeadSize.test.ts),
 * and a metro-timeline rule is noise on a payment-plan question. Placed after
 * SYSTEM_PROMPT_BOUNDARY, so none of this touches the cached head.
 */

interface AnswerRule {
  matches: RegExp
  text: string
}

const RULES: AnswerRule[] = [
  {
    matches: /\b(noida\s+ext\w*|greater\s+noida\s+west|gnw)\b/i,
    text: '**Noida Extension is Greater Noida West (GNW).** They are the same place, under GNIDA, so treat them as one micro-market. When the buyer compares it with the Expressway, weigh the commute to their stated workplace, whether a metro exists today on each side, and name real projects on both sides.',
  },
  {
    matches: /\b(\d\s*bhk|budget|cr(?:ore)?s?|lakh|lac|family|kids?|children|options?|recommend|suggest|what can i (?:actually )?get|shortlist)\b/i,
    text: "**Never change the buyer's configuration.** If they said 3 BHK, or described a family that needs one (for example, two kids), answer for that. If the budget can't buy it where they asked, say so plainly first, then offer the nearest real alternative. **When you recommend, name each project in your prose**, one line each: name, sector, the reason, and the trade-off. Cards are not a substitute, because the buyer's next message will point back at what you named. When the buyer said \"all inclusive\", state each option's all-in figure or range, not the base price.",
  },
  {
    matches: /\b(fair|overpriced|over\s*priced|negotiat\w*|quoted|quote|good\s+deal|too\s+(?:high|expensive))\b/i,
    text: "**\"Fair or overpriced?\"** Answer from named comparables in the project data: 2–3 nearby projects with their recorded rates. If you hold no recorded comparables, say so plainly and don't give an invented market rate. The negotiation room you state must follow from those comparables.",
  },
  {
    matches: /\b(catch|downside|negatives?|cons\b|won'?t tell|not tell|hidden|red\s*flags?|problems?\s+with)\b/i,
    text: "**\"What's the catch?\"** Lead with the project's own negatives, not the buyer's budget. Label each one: *(from our records)* when it comes from the project data, *(unverified — public reports)* otherwise. Mention a budget mismatch last, in one line. Never name a road, junction or flyover as a problem for a project unless it is on that project's route.",
  },
  {
    matches: /\b(registry|solved|resolved|cleared|status|approv\w*|court|nclt|dispute|ban|embargo|stuck|sports\s*city)\b/i,
    text: '**Status questions need a date.** For a registry hold, an authority dispute, a court case or an approval, state the latest status with its date and source. If you don\'t hold a dated status, say so. Never say "solved", "cleared" or "on track" without a date.',
  },
  {
    matches: /\b(metro|expressway|airport|jewar|flyover|kab\s+tak|when\s+will|opening|operational|line)\b/i,
    text: "**Infrastructure timelines.** If a metro line or road isn't operational, say so first. Then give the latest dated status (sanctioned / tendered / under construction) and the official expected window. **Never give an exact opening date**, even if asked. Official timelines in NCR routinely slip, so say that.",
  },
  {
    matches: /\b(eo[il]|expression of interest|token|booking amount|pre[- ]?launch|new launch|refund\w*)\b/i,
    text: '**Money before registration.** Never encourage paying an EOI, token or booking amount for a project without a live RERA registration for that exact phase. No urgency or FOMO framing.',
  },
]

/** The rules this message needs, or '' when none apply. */
export function selectAnswerRules(message: string): string {
  const hits = RULES.filter(r => r.matches.test(message ?? ''))
  if (!hits.length) return ''
  return ['', '## ANSWER RULES FOR THIS QUESTION', ...hits.map(r => `- ${r.text}`), ''].join('\n')
}
