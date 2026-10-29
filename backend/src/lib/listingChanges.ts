// backend/src/lib/listingChanges.ts
//
// A builder proposes a price or availability change for one flat type; we
// approve or reject it. CLAUDE.md § The Verified Supply Chain:
//  * A proposal is never a write. The UnitType row changes only on approval,
//    in one transaction with a PriceHistory row (who gave it, who approved it),
//    the FactVerification rows (builder-attested, dated) and an AuditLog row.
//  * Scope comes from the session: the caller passes the builder id it read
//    off the session, and the flat type must belong to that builder.
//  * Conflicts surface, never silently resolve: if the row changed since the
//    builder saw it, approval is refused with both values.
//
// Every unit_types read here opts out of the sold-out filter
// (`availability: undefined`), because a builder and an approver must see
// the sold-out rows that buyers do not.
import { z } from 'zod'
import { prisma } from './db'
import { applyFactWrites, priceFactWrites } from './priceVerification'
import { buildPriceRangeLabel } from './discovery/scoring'

export const KINDS = ['price', 'sold_out', 'available'] as const
export type ListingChangeKind = (typeof KINDS)[number]

export const ProposalSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('price'),
    unit_type_id: z.string().min(1),
    // Crore. A flat in Noida/GNW under ₹10 L or over ₹100 Cr is a typo, not a price.
    price_min_cr: z.number().min(0.1).max(100),
    price_max_cr: z.number().min(0.1).max(100),
    source_note: z.string().trim().max(300).optional(),
  }).strict(),
  z.object({ kind: z.literal('sold_out'), unit_type_id: z.string().min(1), source_note: z.string().trim().max(300).optional() }).strict(),
  z.object({ kind: z.literal('available'), unit_type_id: z.string().min(1), source_note: z.string().trim().max(300).optional() }).strict(),
]).refine((v) => v.kind !== 'price' || v.price_max_cr >= v.price_min_cr, { message: 'The highest price is below the lowest', path: ['price_max_cr'] })
export type Proposal = z.infer<typeof ProposalSchema>

const UNIT_SELECT = {
  id: true, project_id: true, name: true, bhk: true, super_area_sqft: true,
  price_min_cr: true, price_max_cr: true, price_label: true, availability: true,
  project: { select: { id: true, name: true, builder_id: true } },
} as const

export const crLabel = (n: number) => (n >= 1 ? `₹${Number(n.toFixed(2))} Cr` : `₹${Math.round(n * 100)} L`)

export function unitPriceLabel(min: number, max: number): string {
  return max > min ? `${crLabel(min)} – ${crLabel(max)}` : crLabel(min)
}

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string; detail?: unknown }

/** The builder's flat types, sold-out ones included, with any pending proposal. */
export async function builderUnitTypes(builderId: string) {
  return prisma.project.findMany({
    where: { builder_id: builderId },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, sector: true,
      unit_types: {
        where: { availability: undefined },
        orderBy: [{ bhk: 'asc' }, { price_min_cr: 'asc' }],
        select: {
          id: true, name: true, bhk: true, super_area_sqft: true,
          price_min_cr: true, price_max_cr: true, availability: true,
          listing_changes: {
            orderBy: { created_at: 'desc' },
            take: 5,
            select: { id: true, kind: true, new_value: true, status: true, reject_reason: true, created_at: true, reviewed_at: true },
          },
        },
      },
    },
  })
}

export async function propose(p: Proposal, builderId: string, actor: { email: string; role: string }): Promise<Result<{ id: string }>> {
  const unit = await prisma.unitType.findFirst({ where: { id: p.unit_type_id, availability: undefined }, select: UNIT_SELECT })
  // Same answer for "not yours" and "does not exist": a builder learns nothing about other builders' rows.
  if (!unit || unit.project.builder_id !== builderId) return { ok: false, status: 404, error: 'Flat type not found' }

  if (p.kind === 'price' && unit.price_min_cr === p.price_min_cr && unit.price_max_cr === p.price_max_cr) {
    return { ok: false, status: 400, error: 'That is already the price on record' }
  }
  if (p.kind === 'sold_out' && unit.availability === 'sold_out') return { ok: false, status: 400, error: 'Already marked sold out' }
  if (p.kind === 'available' && unit.availability !== 'sold_out') return { ok: false, status: 400, error: 'Already available' }

  const group = p.kind === 'price' ? ['price'] : ['sold_out', 'available']
  const pending = await prisma.listingChange.findFirst({
    where: { unit_type_id: unit.id, kind: { in: group }, status: 'pending_realtyask' },
    select: { id: true },
  })
  if (pending) return { ok: false, status: 409, error: 'A change for this flat type is already waiting for review' }

  const row = await prisma.listingChange.create({
    data: {
      project_id: unit.project_id,
      unit_type_id: unit.id,
      kind: p.kind,
      old_value: p.kind === 'price'
        ? { price_min_cr: unit.price_min_cr, price_max_cr: unit.price_max_cr }
        : { availability: unit.availability },
      new_value: p.kind === 'price'
        ? { price_min_cr: p.price_min_cr, price_max_cr: p.price_max_cr }
        : { availability: p.kind === 'sold_out' ? 'sold_out' : 'available' },
      source_note: p.source_note || null,
      submitted_by: actor.email,
      submitted_role: actor.role,
    },
    select: { id: true },
  })
  return { ok: true, value: row }
}

export async function reviewQueue(status: string) {
  return prisma.listingChange.findMany({
    where: { status },
    orderBy: { created_at: status === 'pending_realtyask' ? 'asc' : 'desc' },
    take: 200,
    include: {
      project: { select: { id: true, name: true, sector: true, builder: { select: { name: true } } } },
      unit_type: { select: { name: true, bhk: true, super_area_sqft: true, price_min_cr: true, price_max_cr: true, availability: true } },
    },
  })
}

/** Field by field: jsonb does not keep key order, so a string comparison reports false conflicts. */
function sameValue(current: Record<string, unknown>, stored: Record<string, unknown>): boolean {
  return Object.keys(current).every((k) => (current[k] ?? null) === (stored[k] ?? null))
}

export async function approve(id: string, approver: { email: string; adminId: string | null }): Promise<Result<{ id: string }>> {
  return prisma.$transaction(async (tx) => {
    const change = await tx.listingChange.findUnique({ where: { id } })
    if (!change) return { ok: false, status: 404, error: 'Proposal not found' }
    if (change.status !== 'pending_realtyask') return { ok: false, status: 409, error: `Already ${change.status}` }

    const unit = await tx.unitType.findFirst({ where: { id: change.unit_type_id, availability: undefined }, select: UNIT_SELECT })
    if (!unit) return { ok: false, status: 404, error: 'Flat type no longer exists' }

    const old = change.old_value as Record<string, unknown>
    const current = change.kind === 'price'
      ? { price_min_cr: unit.price_min_cr, price_max_cr: unit.price_max_cr }
      : { availability: unit.availability }
    if (!sameValue(current, old)) {
      return { ok: false, status: 409, error: 'The flat type changed after this was proposed', detail: { current, proposed_over: old, proposed: change.new_value } }
    }

    const now = new Date()
    const next = change.new_value as Record<string, unknown>
    const changes: Array<{ field: string; old: unknown; new: unknown }> = []

    if (change.kind === 'price') {
      const min = Number(next.price_min_cr)
      const max = Number(next.price_max_cr)
      const data = {
        price_min_cr: min,
        price_max_cr: max,
        price_label: unitPriceLabel(min, max),
        // price_min ÷ SUPER area, never carpet (schema § Global Conventions).
        price_per_sqft: unit.super_area_sqft ? Math.round((min * 1e7) / unit.super_area_sqft) : null,
      }
      await tx.unitType.update({ where: { id: unit.id }, data })
      await applyFactWrites(tx, priceFactWrites({
        entity: 'UnitType',
        entityId: unit.id,
        after: data,
        changed: [],
        verification: { tier: 'BUILDER_ATTESTED', verified_at: change.created_at, source_url: null, source_doc: `Builder portal, approved by ${approver.email}` },
        verifiedBy: change.submitted_by,
      }))
      await tx.priceHistory.create({
        data: {
          project_id: unit.project_id,
          unit_type_id: unit.id,
          bhk: unit.bhk,
          recorded_at: now,
          total_price_cr: min,
          total_price_max_cr: max,
          price_per_sqft: data.price_per_sqft,
          source: 'builder_portal',
          submitted_by: change.submitted_by,
          approved_by: approver.email,
          event_note: change.source_note,
        },
      })
      changes.push({ field: 'price_min_cr', old: unit.price_min_cr, new: min }, { field: 'price_max_cr', old: unit.price_max_cr, new: max })
    } else {
      const availability = change.kind === 'sold_out' ? 'sold_out' : 'available'
      await tx.unitType.update({ where: { id: unit.id }, data: { availability, inventory_as_of: change.created_at } })
      await tx.factVerification.upsert({
        where: { entityType_entityId_fieldName: { entityType: 'UnitType', entityId: unit.id, fieldName: 'availability' } },
        create: { entityType: 'UnitType', entityId: unit.id, fieldName: 'availability', tier: 'BUILDER_ATTESTED', verifiedAt: change.created_at, verifiedBy: change.submitted_by, sourceDoc: `Builder portal, approved by ${approver.email}` },
        update: { tier: 'BUILDER_ATTESTED', verifiedAt: change.created_at, verifiedBy: change.submitted_by, sourceDoc: `Builder portal, approved by ${approver.email}` },
      })
      changes.push({ field: 'availability', old: unit.availability, new: availability })
    }

    await syncProjectPrice(tx, unit.project_id)

    await tx.listingChange.update({ where: { id }, data: { status: 'approved', reviewed_by: approver.email, reviewed_at: now } })
    await tx.auditLog.create({
      data: {
        entity_type: 'unit_type',
        entity_id: unit.id,
        entity_name: `${unit.project.name} · ${unit.name}`,
        action: 'UPDATE',
        actor: approver.email,
        actor_admin_id: approver.adminId,
        summary: change.kind === 'price'
          ? `Approved builder price ${unitPriceLabel(Number(next.price_min_cr), Number(next.price_max_cr))} (proposed by ${change.submitted_by})`
          : `Approved builder change: ${change.kind === 'sold_out' ? 'sold out' : 'available again'} (proposed by ${change.submitted_by})`,
        changes: changes as never,
      },
    })
    return { ok: true, value: { id } }
  })
}

/**
 * Keeps Project.price_min_cr / price_range_label in step with the flat types a
 * buyer can still be offered. Those two columns are read on their own by cards
 * and the advisor; left alone, a sold-out cheapest type would still set the
 * "from" price. A recomputed value is not an attestation, so its date is reset.
 */
async function syncProjectPrice(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], projectId: string): Promise<void> {
  const [project, units] = await Promise.all([
    tx.project.findUnique({ where: { id: projectId }, select: { price_min_cr: true, price_range_label: true } }),
    tx.unitType.findMany({ where: { project_id: projectId, availability: 'available' }, select: { price_min_cr: true, price_max_cr: true } }),
  ])
  if (!project) return
  const mins = units.map((u) => u.price_min_cr).filter((n): n is number => n != null)
  const maxs = units.map((u) => u.price_max_cr ?? u.price_min_cr).filter((n): n is number => n != null)
  const min = mins.length ? Math.min(...mins) : null
  const label = min == null ? null : buildPriceRangeLabel(min, maxs.length ? Math.max(...maxs) : null)
  if (project.price_min_cr === min && project.price_range_label === label) return
  await tx.project.update({ where: { id: projectId }, data: { price_min_cr: min, price_range_label: label } })
  await applyFactWrites(tx, priceFactWrites({
    entity: 'Project', entityId: projectId, after: { price_min_cr: min, price_range_label: label },
    changed: ['price_min_cr', 'price_range_label'], verification: null, verifiedBy: null,
  }))
}

export async function reject(id: string, reason: string, approver: { email: string; adminId: string | null }): Promise<Result<{ id: string }>> {
  const change = await prisma.listingChange.findUnique({ where: { id }, select: { status: true, unit_type_id: true, kind: true, submitted_by: true } })
  if (!change) return { ok: false, status: 404, error: 'Proposal not found' }
  if (change.status !== 'pending_realtyask') return { ok: false, status: 409, error: `Already ${change.status}` }
  await prisma.$transaction([
    prisma.listingChange.update({ where: { id }, data: { status: 'rejected', reject_reason: reason, reviewed_by: approver.email, reviewed_at: new Date() } }),
    prisma.auditLog.create({
      data: {
        entity_type: 'unit_type', entity_id: change.unit_type_id, action: 'REJECT',
        actor: approver.email, actor_admin_id: approver.adminId,
        summary: `Rejected builder ${change.kind} change from ${change.submitted_by}: ${reason}`,
      },
    }),
  ])
  return { ok: true, value: { id } }
}

/** Every price we hold for one flat type, newest first, with who gave it and when. */
export async function priceHistoryFor(unitTypeId: string) {
  const unit = await prisma.unitType.findFirst({ where: { id: unitTypeId, availability: undefined }, select: { id: true, project_id: true, bhk: true, name: true } })
  if (!unit) return null
  const rows = await prisma.priceHistory.findMany({
    where: { OR: [{ unit_type_id: unit.id }, { project_id: unit.project_id, unit_type_id: null, bhk: unit.bhk }] },
    orderBy: { recorded_at: 'desc' },
    select: { id: true, recorded_at: true, total_price_cr: true, total_price_max_cr: true, price_per_sqft: true, source: true, submitted_by: true, approved_by: true, event_note: true, unit_type_id: true },
  })
  return { unit, rows }
}
