// backend/src/lib/priceVerification.ts
//
// Who confirmed a price, and when. Rides on the existing FactVerification table
// (one row per entity + field) instead of new columns on Project / UnitType.
//
// Rules this file owns:
//  * An admin attests the price fields of an entity as they stand after the
//    save: tier BUILDER_ATTESTED ("the seller said so") or VERIFIED ("a record
//    we hold says so"), a date, who entered it, and an optional source.
//  * A price that changes WITHOUT an attestation drops back to SCRAPED with no
//    date. The old date described the old number; keeping it would put a fresh
//    date on a figure nobody confirmed.
//  * The buyer-facing wording never implies a site inspection, and a price
//    older than PRICE_FRESHNESS_DAYS is stated with its date and "may have
//    changed", never as current.
import { z } from 'zod'
import type { FactTier, Prisma } from '@prisma/client'

export const PRICE_FIELDS = {
  Project: ['price_min_cr', 'price_range_label'],
  UnitType: ['price_min_cr', 'price_max_cr', 'price_label'],
} as const

export type PriceEntity = keyof typeof PRICE_FIELDS

/** CLAUDE.md § Verified Supply Chain: proposed window for price. */
export const PRICE_FRESHNESS_DAYS = 30

const DAY_MS = 86_400_000

const InputSchema = z.object({
  tier: z.enum(['BUILDER_ATTESTED', 'VERIFIED']),
  verified_at: z.string().optional(),
  source_url: z.string().url().max(500).nullish(),
  source_doc: z.string().max(200).nullish(),
})

export interface PriceVerificationInput {
  tier: 'BUILDER_ATTESTED' | 'VERIFIED'
  verified_at: Date
  source_url: string | null
  source_doc: string | null
}

export type ParsedVerification =
  | { ok: true; value: PriceVerificationInput | null }
  | { ok: false; error: string }

/** `raw` is the request's `price_verification` block; absent means "no attestation". */
export function parsePriceVerification(raw: unknown, now: Date = new Date()): ParsedVerification {
  if (raw === undefined || raw === null) return { ok: true, value: null }
  const parsed = InputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'price_verification is invalid: ' + parsed.error.issues[0]?.message }
  const when = parsed.data.verified_at ? new Date(parsed.data.verified_at) : now
  if (Number.isNaN(when.getTime())) return { ok: false, error: 'price_verification.verified_at is not a date' }
  if (when.getTime() > now.getTime() + DAY_MS) return { ok: false, error: 'price_verification.verified_at is in the future' }
  return {
    ok: true,
    value: {
      tier: parsed.data.tier,
      verified_at: when,
      source_url: parsed.data.source_url ?? null,
      source_doc: parsed.data.source_doc ?? null,
    },
  }
}

function same(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  const na = Number(a)
  const nb = Number(b)
  if (typeof a !== 'string' && typeof b !== 'string') return a === b
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na === nb
  return String(a).trim() === String(b).trim()
}

/** Price fields the save changes. A field absent from `incoming` is untouched. */
export function changedPriceFields(
  entity: PriceEntity,
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): string[] {
  return PRICE_FIELDS[entity].filter((f) => incoming[f] !== undefined && !same(existing[f], incoming[f]))
}

export interface FactRowWrite {
  entityType: PriceEntity
  entityId: string
  fieldName: string
  data: {
    tier: FactTier
    verifiedAt: Date | null
    verifiedBy: string | null
    sourceUrl: string | null
    sourceDoc: string | null
  }
}

/**
 * The FactVerification rows to write for one save.
 *
 * With an attestation: every price field the entity holds after the save.
 * Without: only the fields that changed, reset to SCRAPED / undated.
 */
export function priceFactWrites(args: {
  entity: PriceEntity
  entityId: string
  after: Record<string, unknown>
  changed: string[]
  verification: PriceVerificationInput | null
  verifiedBy: string | null
}): FactRowWrite[] {
  const { entity, entityId, after, changed, verification, verifiedBy } = args
  const fields = verification
    ? PRICE_FIELDS[entity].filter((f) => after[f] != null && String(after[f]).trim() !== '')
    : changed
  const data = verification
    ? {
        tier: verification.tier as FactTier,
        verifiedAt: verification.verified_at,
        verifiedBy,
        sourceUrl: verification.source_url,
        sourceDoc: verification.source_doc,
      }
    : { tier: 'SCRAPED' as FactTier, verifiedAt: null, verifiedBy: null, sourceUrl: null, sourceDoc: null }
  return fields.map((fieldName) => ({ entityType: entity, entityId, fieldName, data }))
}

/** Writes the rows inside the caller's transaction, so a price and its date change together. */
export async function applyFactWrites(
  tx: Pick<Prisma.TransactionClient, 'factVerification'>,
  writes: FactRowWrite[],
): Promise<void> {
  for (const w of writes) {
    await tx.factVerification.upsert({
      where: { entityType_entityId_fieldName: { entityType: w.entityType, entityId: w.entityId, fieldName: w.fieldName } },
      create: { entityType: w.entityType, entityId: w.entityId, fieldName: w.fieldName, ...w.data },
      update: w.data,
    })
  }
}

// ── Buyer-facing freshness ────────────────────────────────────────────────

export interface PriceRecord {
  tier: FactTier
  verifiedAt: Date | null
}

export type PriceFreshness =
  | { state: 'fresh'; tier: FactTier; verifiedAt: Date; days: number }
  | { state: 'stale'; tier: FactTier; verifiedAt: Date; days: number }
  | { state: 'undated' }

export function priceFreshness(rec: PriceRecord | null | undefined, now: Date = new Date()): PriceFreshness {
  // SCRAPED, or a date on a tier that is not an attestation, is not a confirmation.
  if (!rec || !rec.verifiedAt || (rec.tier !== 'BUILDER_ATTESTED' && rec.tier !== 'VERIFIED')) {
    return { state: 'undated' }
  }
  const days = Math.max(0, Math.floor((now.getTime() - rec.verifiedAt.getTime()) / DAY_MS))
  return { state: days > PRICE_FRESHNESS_DAYS ? 'stale' : 'fresh', tier: rec.tier, verifiedAt: rec.verifiedAt, days }
}

/**
 * One freshness for a project's price statement: only as fresh as its stalest
 * part, and undated as soon as any priced part is undated. `records` holds one
 * entry per price we hold, `null` for a price with no usable confirmation.
 * Mixed tiers take the weaker claim (builder-attested).
 */
export function combinePriceFreshness(records: Array<PriceRecord | null>, now: Date = new Date()): PriceFreshness {
  if (records.length === 0) return { state: 'undated' }
  const each = records.map((r) => priceFreshness(r, now))
  if (each.some((f) => f.state === 'undated')) return { state: 'undated' }
  const dated = each as Array<Extract<PriceFreshness, { state: 'fresh' | 'stale' }>>
  const stalest = dated.reduce((a, b) => (b.verifiedAt < a.verifiedAt ? b : a))
  const tier: FactTier = dated.some((f) => f.tier === 'BUILDER_ATTESTED') ? 'BUILDER_ATTESTED' : 'VERIFIED'
  return { ...stalest, tier }
}

/**
 * One clause for a list of projects: the note they share, or a pointer to the
 * per-project difference. null when there is nothing to say.
 */
export function summarisePriceNotes(notes: string[]): string | null {
  const unique = [...new Set(notes)]
  if (unique.length === 0) return null
  return unique.length === 1 ? unique[0] : 'confirmation dates differ by project, so ask for the date on any you shortlist'
}

function fmt(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

/** What a price with no usable confirmation says. Also the fallback when a lookup returns nothing. */
export const UNDATED_NOTE = 'date of last confirmation not on record'

/** One clause to sit next to a price. Never says "inspected" or "live". */
export function priceDateNote(f: PriceFreshness): string {
  if (f.state === 'undated') return UNDATED_NOTE
  const source = f.tier === 'BUILDER_ATTESTED' ? 'confirmed by the builder' : 'checked against records we hold'
  if (f.state === 'stale') return `last ${source} on ${fmt(f.verifiedAt)} (${f.days} days ago), so it may have changed`
  return `${source} on ${fmt(f.verifiedAt)}`
}
