// backend/src/lib/chatStorage.ts
//
// What a project card costs to keep.
//
// Every assistant turn that showed cards stored the full ranked project
// objects twice — in chat_messages.artifacts (history) and chat_sessions
// .last_projects (follow-up reuse). Measured 2026-10-14: those two columns were
// 382 of the database's 627 MB and ~195 MB of growth a month, and almost all of
// it was analysis the card never shows (decisionIntelligence, buyerPersonas,
// decision/persona/recommendation profiles, competitors, amenity and
// connectivity lists) plus ranker internals (`_multidimensional_*`, `dna`) that
// must not leave the server at all — the live stream strips them, but restored
// history returned them as stored.
//
// A compact card keeps exactly the fields the chat path reads (mapped from the
// frontend: ProjectCard, MessageBubble, MobileCardShelf, SectorMap, the compare
// overlay, the callback / share / site-visit modals). Opening a card fetches
// the full project by slug, so nothing the drawer shows is lost.
//
// History is stored compact from now on. last_projects stays full while a chat
// is active — follow-up answers read decision_profile, competitors and unit
// data from it — and `compactInactiveSessions` trims it once a chat goes quiet.
// readLastProjectCards (discovery/lastProjects.ts) refuses to reuse compact
// cards, so a returning buyer simply gets a fresh (cached) search.

import { Prisma } from '@prisma/client'
import { prisma } from './db'
import { redactForResponse } from './projectExposure'
import { stripInternalFields } from './projectRepository'

/** Top-level card fields the chat path reads. Everything else is dropped. */
export const CARD_FIELDS = [
  'id', 'slug', 'name', 'sector', 'city', 'builder', 'status',
  'possession_label', 'possession_date', 'rera_number', 'rera_url',
  'price_range_label', 'price_for_bhk', 'price_min_cr', 'price_max_cr', 'missing_bhk',
  'matchReasons', 'matchReason', 'concerns', 'requirement_checklist', 'compromiseTags',
  'unit_types', 'oc_status', 'amitabh_kant_clearance', 'shahdara_drain_impact', 'water_source_type',
  'distance_km', 'images', 'hero_image_url', 'lat', 'lng', 'tagline', 'address', 'cacheSource',
] as const

const UNIT_FIELDS = ['id', 'bhk', 'super_area_sqft', 'carpet_area_sqft', 'price_min_cr', 'price_max_cr', 'price_label'] as const
const BUILDER_FIELDS = ['id', 'name', 'slug'] as const
const IMAGE_FIELDS = ['type', 'url'] as const
const MAX_IMAGES = 6

/** Artifact keys whose value is a list of project cards. */
const CARD_LIST_KEYS = ['exactResults', 'nearbyResults', 'properties', 'projects'] as const

const pick = (o: unknown, keys: readonly string[]): Record<string, unknown> | unknown => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o
  const out: Record<string, unknown> = {}
  for (const k of keys) if ((o as Record<string, unknown>)[k] !== undefined) out[k] = (o as Record<string, unknown>)[k]
  return out
}

export function isCompactCard(p: unknown): boolean {
  return !!p && typeof p === 'object' && (p as { compact?: unknown }).compact === true
}

/** The card as the buyer saw it, minus analysis and internals. Idempotent. */
export function compactCard(p: unknown): unknown {
  if (!p || typeof p !== 'object' || Array.isArray(p) || isCompactCard(p)) return p
  const redacted = redactForResponse(stripInternalFields(p as Record<string, unknown>)) as Record<string, unknown>
  const out: Record<string, unknown> = { compact: true }
  for (const k of CARD_FIELDS) {
    const v = redacted[k]
    if (v === undefined) continue
    if (k === 'unit_types' && Array.isArray(v)) out[k] = v.map((u) => pick(u, UNIT_FIELDS))
    else if (k === 'images' && Array.isArray(v)) out[k] = v.slice(0, MAX_IMAGES).map((i) => pick(i, IMAGE_FIELDS))
    else if (k === 'builder') out[k] = pick(v, BUILDER_FIELDS)
    else out[k] = v
  }
  return out
}

/** Compacts every card list inside stored message artifacts. Other artifact data is kept as is. */
export function compactArtifacts<T>(artifacts: T): T {
  if (!Array.isArray(artifacts)) return artifacts
  return artifacts.map((a) => {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return a
    const copy: Record<string, unknown> = { ...(a as Record<string, unknown>) }
    for (const key of CARD_LIST_KEYS) {
      if (Array.isArray(copy[key])) copy[key] = (copy[key] as unknown[]).map(compactCard)
    }
    return copy
  }) as unknown as T
}

export function compactCardList(list: unknown): unknown {
  return Array.isArray(list) ? list.map(compactCard) : list
}

/**
 * Trims last_projects to compact cards on chats idle for `idleDays`, in
 * batches. Returns how many sessions it rewrote. Safe to run repeatedly.
 */
export async function compactInactiveSessions(idleDays = 7, batch = 300): Promise<number> {
  const cutoff = new Date(Date.now() - idleDays * 86_400_000)
  const rows = await prisma.$queryRaw<{ id: string; last_projects: unknown }[]>`
    SELECT id, last_projects FROM chat_sessions
    WHERE last_active < ${cutoff}
      AND jsonb_typeof(last_projects) = 'array'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(last_projects) e
        WHERE jsonb_typeof(e) = 'object' AND NOT (e ? 'compact')
      )
    LIMIT ${batch}`
  for (const r of rows) {
    await prisma.chatSession.update({
      where: { id: r.id },
      data: { last_projects: compactCardList(r.last_projects) as Prisma.InputJsonValue },
    })
  }
  return rows.length
}

/** Rewrites stored message artifacts that still hold full cards, in batches. */
export async function compactStoredArtifacts(batch = 300): Promise<number> {
  const rows = await prisma.$queryRaw<{ id: string; artifacts: unknown }[]>`
    SELECT id, artifacts FROM chat_messages
    WHERE jsonb_typeof(artifacts) = 'array'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(artifacts) a,
             jsonb_array_elements(
               CASE WHEN jsonb_typeof(a->'exactResults') = 'array' THEN a->'exactResults' ELSE '[]'::jsonb END
               || CASE WHEN jsonb_typeof(a->'nearbyResults') = 'array' THEN a->'nearbyResults' ELSE '[]'::jsonb END
             ) p
        WHERE jsonb_typeof(p) = 'object' AND NOT (p ? 'compact')
      )
    LIMIT ${batch}`
  for (const r of rows) {
    await prisma.chatMessage.update({
      where: { id: r.id },
      data: { artifacts: compactArtifacts(r.artifacts) as Prisma.InputJsonValue },
    })
  }
  return rows.length
}
