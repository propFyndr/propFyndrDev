import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The configurations slot, and why the card is a fixed height.
 *
 * Cards in the recommendation grid must all be the same height, so the
 * configurations slot is a fixed-size box. It was capped at 56px with
 * overflow-hidden, which fits exactly two rows and nothing else — so on any
 * project with three or more configurations the "+X more configurations
 * available" line rendered and was then clipped by the very container meant to
 * keep the cards tidy. The buyer learned there were more configurations only if
 * they noticed a sliver of cut-off text.
 *
 * These are source assertions rather than render assertions on purpose: the
 * behaviour being protected is a layout constraint expressed in classes, and a
 * jsdom render reports every height as zero.
 */

const SRC = readFileSync(
  join(__dirname, '..', 'components', 'ProjectCard.tsx'),
  'utf8',
)

describe('project card layout', () => {
  it('stretches to the grid row height', () => {
    // Grid items stretch, but the card inside sized to its own content, so a
    // project with a shorter tagline produced a shorter card and the row
    // looked ragged.
    expect(SRC).toMatch(/group relative w-full h-full flex flex-col rounded-/)
  })

  it('gives the configurations slot room for the "+X more" line', () => {
    const slot = SRC.match(/min-h-\[(\d+)px\] max-h-\[(\d+)px\] flex flex-col justify-center/)
    expect(slot).not.toBeNull()
    const [, min, max] = slot as RegExpMatchArray
    expect(min).toBe(max) // fixed height keeps the grid uniform
    // Two rows plus the gap plus the link needs more than the old 56px.
    expect(Number(max)).toBeGreaterThanOrEqual(72)
  })

  it('does not clip the slot', () => {
    // overflow-hidden on this container is what swallowed the link.
    const slot = SRC.match(/min-h-\[\d+px\] max-h-\[\d+px\] flex flex-col justify-center[^"]*/)
    expect(slot).not.toBeNull()
    expect(slot?.[0]).not.toContain('overflow-hidden')
  })

  it('makes "+X more configurations" a real control', () => {
    expect(SRC).toMatch(/more configurations`/)
    // It must be a button, not a div: it is the only way to see the rest.
    const idx = SRC.indexOf('more configurations`')
    const before = SRC.slice(Math.max(0, idx - 700), idx)
    expect(before).toContain('<button')
    expect(before).toContain('setShowAllConfigs')
  })

  it('stops the click reaching the card', () => {
    // The card itself opens the detail panel, so without this the expand
    // button would navigate away instead of expanding.
    const idx = SRC.indexOf('setShowAllConfigs(v => !v)')
    expect(idx).toBeGreaterThan(-1)
    expect(SRC.slice(Math.max(0, idx - 200), idx)).toContain('e.stopPropagation()')
  })

  it('expands without changing the card height', () => {
    // Growing the card would push its grid row taller than its neighbours,
    // which is exactly what the fixed slot exists to prevent, so the full
    // list overlays the slot and scrolls.
    const idx = SRC.indexOf('All configurations')
    expect(idx).toBeGreaterThan(-1)
    const panel = SRC.slice(Math.max(0, idx - 600), idx)
    expect(panel).toContain('absolute')
    expect(panel).toMatch(/overflow-y-auto/)
  })
})
