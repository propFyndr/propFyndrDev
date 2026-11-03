// backend/src/lib/istTime.ts
//
// India has one time zone, UTC+05:30, and no daylight saving, so "today" for a
// buyer or our sales team starts at 18:30 UTC the evening before.
const IST_OFFSET_MS = 330 * 60_000

/** The UTC instant of 00:00 IST on the IST calendar day containing `date`. */
export function startOfIstDay(date: Date = new Date()): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS)
  ist.setUTCHours(0, 0, 0, 0)
  return new Date(ist.getTime() - IST_OFFSET_MS)
}
