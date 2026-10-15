/**
 * A builder's possession date that has passed while the project is still
 * recorded as under construction or a new launch.
 *
 * "Possession June 2025", read in October 2026, is not a handover and not a
 * schedule: the date was missed and we hold no revised one. Shown as-is it read
 * as on time, ranked as "possession within a year", and carded as "possession
 * in 6 months" (a negative month count is <= 6).
 */
export const DATE_PASSED_NOTE = 'possession date passed — status unconfirmed'

export function possessionDatePassed(
  status: unknown,
  date: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!date || (status !== 'under_construction' && status !== 'new_launch')) return false
  const d = date instanceof Date ? date : new Date(date)
  return !isNaN(d.getTime()) && d.getTime() <= now.getTime()
}

/** The possession text a buyer sees: the label, flagged when its date has passed. */
export function possessionDisplay(
  label: string | null | undefined,
  status: unknown,
  date: Date | string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!possessionDatePassed(status, date, now)) return label ?? null
  const d = date instanceof Date ? date : new Date(date as string)
  const when = label || d.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
  return `${when} (${DATE_PASSED_NOTE})`
}
