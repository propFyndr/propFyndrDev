// backend/src/lib/discovery/coverage.ts
//
// "I have Gurgaon in mind."
//
// Measured on a cold funnel run: that message was answered with a confident
// tour of Gurgaon's market — "luxury high-rises and vibrant social
// infrastructure along major axes like Golf Course Extension and the Dwarka
// Expressway" — and never once said we do not cover the city. None of it came
// from a row we hold, about a city we have no inventory in, phrased exactly
// like something we had checked.
//
// `outOfScopeCity` already names the city. All it did was drop the sector
// filter, which is right but silent: with no sector the turn reached the
// general lane, which then free-associated.
//
// The distinction that matters, and the reason this is not one regex: a foreign
// city is a coverage problem when it is where they want to BUY, and a useful
// signal when it is where they WORK. "I have a daily commute to Gurgaon" is the
// single most valuable thing a Noida buyer can tell us — it picks the corridor.
// Declining that message would be worse than the bug it fixes.

import { outOfScopeCity } from '../config/cities'

/**
 * Ways of naming a place you commute to rather than buy in.
 *
 * Checked against the words immediately around the city, not the whole
 * message: "my office is in Gurgaon but I want to buy in Noida" mentions both,
 * and the reading that matters is which one attaches to the city named.
 */
const ANCHOR_CONTEXT =
  /\b(commut\w*|offic\w*|work\w*|job|employ\w*|travel\w*|drive|driving|daily|company|firm|campus|based\s+in|posted\s+in|shift\w*)\b/i

/** Ways of naming a place you intend to buy in. */
const TARGET_CONTEXT =
  /\b(buy\w*|purchas\w*|propert\w*|flat|flats|apartment\w*|hous\w*|home|homes|project\w*|societ\w*|invest\w*|shortlist\w*|looking|interested|considering|in\s+mind|options?|budget|bhk|villa\w*|plot\w*|land|farmhouse\w*|listing\w*|for\s+sale|yield|rent\w*|kothi|bungalow\w*)\b/i

export interface CoverageVerdict {
  /** The out-of-scope city they want to buy in, if that is what this is. */
  city: string | null
  reason: string
}

/**
 * Is this message asking us to find property in a city we do not cover?
 *
 * Returns the city only when it reads as the buying target. A commute anchor,
 * or a bare mention with neither signal, returns null — the commute path and
 * the ordinary lanes handle those, and both are better than a decline.
 */
export function buyingTargetOutOfScope(message: string): CoverageVerdict {
  const text = message ?? ''
  const city = outOfScopeCity(text)
  if (!city) return { city: null, reason: 'no out-of-scope city named' }

  // A stated intention to buy in one of OUR cities settles it, whatever else
  // the message mentions: "moving from Gurgaon, want a 3BHK in Sector 150".
  //
  // Exception: "Noida or Bangalore" names Noida only to compare against it —
  // the buying target is still open, and the out-of-scope city still needs
  // its honest disclosure rather than being silently absorbed into "we cover
  // Noida so this is fine".
  const mentionsNoida = /\b(noida|greater\s+noida)\b/i.test(text)
  const comparedAgainstNoida =
    mentionsNoida && /\b(or|vs\.?|versus|compared?\s+to|better\s+than|against)\b/i.test(text)
  if (mentionsNoida && !comparedAgainstNoida) {
    return { city: null, reason: 'the buying target is a city we cover' }
  }

  // Look at the clause the city sits in rather than the whole message.
  const at = text.toLowerCase().indexOf(city.toLowerCase())
  const around = text.slice(Math.max(0, at - 60), Math.min(text.length, at + city.length + 40))

  if (ANCHOR_CONTEXT.test(around)) {
    return { city: null, reason: `${city} reads as a commute anchor, not a target` }
  }
  if (TARGET_CONTEXT.test(around) || TARGET_CONTEXT.test(text)) {
    return { city, reason: `${city} reads as the buying target` }
  }
  // Named with neither signal. Not enough to decline on.
  return { city: null, reason: `${city} mentioned without buying or commute context` }
}
