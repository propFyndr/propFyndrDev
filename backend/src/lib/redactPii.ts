/**
 * Strip direct identifiers out of free text before it goes to a third-party
 * observability provider (Langfuse).
 *
 * Same rules as frontend/lib/redactPii.ts (the two packages cannot import each
 * other) — keep them in step. Deliberately narrow: phone numbers, emails, PAN
 * and Aadhaar only, so "3BHK in Sector 150 under 1.5cr" survives intact. It
 * reduces exposure; it does not guarantee a clean string.
 */

/** Aadhaar: 12 digits, usually in three groups of four. Run first — it overlaps the phone pattern. */
const AADHAAR = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g

/** Indian mobile: ten digits opening 6-9, optional +91, separators anywhere. */
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
