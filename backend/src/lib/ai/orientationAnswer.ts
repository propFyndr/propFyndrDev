// backend/src/lib/ai/orientationAnswer.ts
//
// Which of a project's configurations face a direction, said without overreach.
//
// Orientation is stored per configuration (`UnitType.unit_orientations`), never per
// tower or floor: a "3 BHK Premier" is listed as north-facing, which does not say
// which tower or which floor. So the answer names configurations, says that is
// what the record is, and sends the buyer to the floor plan for the exact unit.
// It never says "flat 1204 faces east", and it says plainly when we hold no
// orientation at all or hold none for the direction asked.

import { facingLabel, facingList, satisfiesFacing } from '../discovery/facing'

export interface ConfigOrientation {
  name: string
  bhk: number
  orientations: string[]
}

/** The orientation values that exist in our data at all. */
export const RECORDED_ORIENTATIONS: ReadonlySet<string> = new Set([
  'east_facing', 'north_facing', 'park_facing', 'road_facing', 'pool_view', 'garden_view', 'golf_view', 'corner_unit',
])

export interface OrientationAnswer {
  text: string
  /** Configurations that list a wanted direction. */
  matched: number
  /** Configurations with any orientation on record. */
  withData: number
}

const NOTE =
  'Orientation is recorded per configuration, not per tower or floor, so confirm the facing of the exact unit on the builder\'s floor plan before you book.'

const configLabel = (c: ConfigOrientation) => c.name || `${c.bhk} BHK`
const describe = (c: ConfigOrientation) => `${configLabel(c)} (${c.orientations.map(facingLabel).join(', ')})`

export function renderOrientation(projectName: string, configs: ConfigOrientation[], wanted: readonly string[], opts: { sunrise?: boolean } = {}): OrientationAnswer {
  const sorted = [...configs].sort((a, b) => a.bhk - b.bhk || configLabel(a).localeCompare(configLabel(b)))
  const withData = sorted.filter((c) => c.orientations.length > 0)
  const head = `### Facing — ${projectName}\n\n`

  if (withData.length === 0) {
    return {
      matched: 0,
      withData: 0,
      text:
        `${head}We hold no orientation (facing or view) for any configuration of ${projectName}, so I can't say which flats face ${wanted.length ? facingList(wanted, 'or').replace(/-facing/g, '') : 'which way'}. ` +
        `The builder's floor plans show it for each tower and floor, and our advisory team can request them.`,
    }
  }

  const table =
    '| Configuration | Facing / view on record |\n| :--- | :--- |\n' +
    sorted.map((c) => `| ${configLabel(c)} | ${c.orientations.length ? c.orientations.map(facingLabel).join(', ') : 'Not on record'} |`).join('\n')

  if (wanted.length === 0) {
    return { matched: 0, withData: withData.length, text: `${head}${table}\n\n${NOTE}` }
  }

  const matching = withData.filter((c) => satisfiesFacing(c.orientations, wanted))
  const others = withData.filter((c) => !satisfiesFacing(c.orientations, wanted))
  const noData = sorted.filter((c) => c.orientations.length === 0)
  const want = facingList(wanted)
  const sunrise = opts.sunrise && wanted.includes('east_facing') ? ' (sunrise side is east in our records)' : ''

  const lines: string[] = []
  if (matching.length > 0) {
    lines.push(`**${want[0].toUpperCase()}${want.slice(1)} configurations on record${sunrise}:** ${matching.map(configLabel).join('; ')}.`)
    if (others.length > 0) lines.push(`Not listed as ${want}: ${others.map(describe).join('; ')}.`)
  } else {
    lines.push(`None of ${projectName}'s configurations lists ${want}${sunrise}. What it records: ${withData.map(describe).join('; ')}.`)
  }
  if (noData.length > 0) lines.push(`No orientation on record for: ${noData.map(configLabel).join('; ')}.`)
  const unrecorded = wanted.filter((w) => !RECORDED_ORIENTATIONS.has(w))
  if (unrecorded.length > 0) {
    lines.push(`We do not record ${facingList(unrecorded, 'or')} for any project, so no project can be shown for it.`)
  }

  return { matched: matching.length, withData: withData.length, text: `${head}${lines.join('\n\n')}\n\n${table}\n\n${NOTE}` }
}
