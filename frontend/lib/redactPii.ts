/**
 * Strip direct identifiers out of free text before it leaves the browser.
 *
 * Buyer chat is the product signal — "3BHK in Sector 150 under 1.5cr" is
 * exactly what analytics should see. What analytics should NOT see is the half
 * of that message where the buyer writes "call me on 98765 43210", which they
 * do, unprompted, several times a session.
 *
 * Deliberately narrow. It removes things that are identifiers by construction —
 * phone numbers, emails, PAN, Aadhaar — and touches nothing else, because an
 * over-eager redactor that eats "1.5 cr" or "Sector 150" destroys the reason
 * the text is being captured at all. This is not a general PII classifier and
 * must not be mistaken for one: it reduces exposure, it does not guarantee a
 * clean string.
 *
 * The buyer's real message is still stored server-side against their session —
 * this is only about what is shipped to a third-party analytics provider.
 */

/** Aadhaar: 12 digits, usually written in three groups of four. Run first — it overlaps the phone pattern. */
const AADHAAR = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g

/**
 * Indian mobile: ten digits opening 6-9, with an optional +91 and separators
 * wherever the person felt like putting them.
 *
 * Written as "a leading digit then nine more, each optionally preceded by a
 * separator" rather than a fixed 3-3-4 grouping, because people write
 * "98765 43210" (5-5) at least as often as "987 654 3210". The fixed grouping
 * missed the commonest form.
 */
const PHONE = /(?:\+?91[\s-]?)?\b[6-9](?:[\s-]?\d){9}\b/g

const EMAIL = /\b[^\s@]+@[^\s@]+\.[^\s@]{2,}\b/g

/** PAN: five letters, four digits, one letter. */
const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/gi

export function redactPii(text: string): string {
  if (!text) return text
  return text
    .replace(EMAIL, '[email]')
    .replace(AADHAAR, '[id]')
    .replace(PHONE, '[phone]')
    .replace(PAN, '[id]')
}

/** True when redaction changed something — useful to know how often it fires. */
export function containsPii(text: string): boolean {
  return redactPii(text) !== text
}
