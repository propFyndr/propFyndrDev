// Live activity strip for a project's Overview tab.
// Every number here is a real-time count from actual events — never simulated.
// Numbers below their threshold are hidden (null) rather than shown as a weak/zero value.

import { prisma } from './db'

export interface LiveActivity {
  viewing_now: number | null
  visits_booked_last_hour: number | null
  units_left: number | null
}

const VIEWING_NOW_WINDOW_MINUTES = 15
const VIEWING_NOW_MIN_TO_SHOW = 2 // "1 person viewing" reads as empty, not exciting
const VISITS_MIN_TO_SHOW = 1
const UNITS_LEFT_MIN_TO_SHOW = 1

export function applyActivityThresholds(
  viewingNowRaw: number,
  visitsBookedRaw: number,
  unitsLeftRaw: number | null,
): LiveActivity {
  return {
    viewing_now: viewingNowRaw >= VIEWING_NOW_MIN_TO_SHOW ? viewingNowRaw : null,
    visits_booked_last_hour: visitsBookedRaw >= VISITS_MIN_TO_SHOW ? visitsBookedRaw : null,
    units_left: unitsLeftRaw != null && unitsLeftRaw >= UNITS_LEFT_MIN_TO_SHOW ? unitsLeftRaw : null,
  }
}

export async function computeLiveActivity(projectId: string): Promise<LiveActivity> {
  const windowStart = new Date(Date.now() - VIEWING_NOW_WINDOW_MINUTES * 60 * 1000)
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)

  // UnitType.inventory_left (dropped, lean-schema migration 2026-10) had no
  // write path either and was never a real count. UnitInventory is the real,
  // per-unit table this product intends for this — also has no write path
  // yet (CLAUDE.md: "table exists, no write path"), so this correctly reads
  // null today and starts working the moment that ships, with no further
  // code change needed here.
  const [viewingSessions, visitsBooked, availableUnitCount, anyInventoryRows] = await Promise.all([
    prisma.propertyEvent.findMany({
      where: { project_id: projectId, action: 'view', created_at: { gte: windowStart } },
      select: { session_id: true },
      distinct: ['session_id'],
    }),
    prisma.siteVisitRequest.count({
      where: { project_id: projectId, created_at: { gte: hourAgo } },
    }),
    prisma.unitInventory.count({
      where: { project_id: projectId, status: 'available' },
    }),
    prisma.unitInventory.count({ where: { project_id: projectId } }),
  ])

  const unitsLeftTotal = anyInventoryRows > 0 ? availableUnitCount : null

  return applyActivityThresholds(viewingSessions.length, visitsBooked, unitsLeftTotal)
}
