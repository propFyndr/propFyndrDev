import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../../../db'
import { dueDiligenceHandler } from '../dueDiligence'

/**
 * 253 of 382 projects have never been through the forensic enrichment pass.
 * Their due-diligence columns are non-nullable with defaults, so every one of
 * them reads as `lift_act_compliant: false`, `shahdara_drain_impact: false`,
 * `oc_status: NONE` — identical to a project we researched and found failing.
 *
 * The handler used to render those defaults as findings: "Clean Zone (Outside
 * Shahdara corridor buffer)", "Statutory Registration in Progress", a TDS range
 * guessed from a sector regex under a row labelled "Tested TDS Level", and
 * "RERA Registered" for a project with no RERA number on file. Each is a claim
 * about a named builder made from a column nobody ever filled.
 *
 * Driving the handler needs a full ChatTopicHandler context, so the render is
 * exercised through a captured stream below and the source is additionally
 * pinned against the specific inventions that shipped.
 */

const SRC = readFileSync(join(__dirname, '..', 'dueDiligence.ts'), 'utf8')

describe('dueDiligenceHandler — never states an unfilled column as a finding', () => {
  it('no longer infers a project TDS range from the sector', () => {
    // The corridor-wide figures survive in the no-project branch, where they
    // are market tier and carry the qualifier. What must not come back is the
    // per-project fallback that put one of them under "Tested TDS Level".
    assert.ok(
      !/water_tds_range\s*\|\|/.test(SRC),
      'an absent project TDS reading must not fall back to a typical range',
    )
    assert.ok(
      SRC.includes('typical for Noida, not verified for any one project'),
      'corridor-wide TDS figures must carry the market qualifier',
    )
  })

  it('no longer asserts ARD or AMC as installed on a specific project', () => {
    assert.ok(!SRC.includes('Mandatory ARD Equipped'), 'ARD presence was never verified per project')
    assert.ok(!SRC.includes('Registered OEM Comprehensive AMC'), 'AMC was never verified per project')
  })

  it('no longer claims RERA registration without a RERA number', () => {
    assert.ok(!/\?\s*`\*\*UPRERA[^`]*`\s*:\s*'RERA Registered'/.test(SRC), 'absent RERA number must not read as registered')
    assert.ok(!SRC.includes("'RERA Registered'"), 'absent RERA number must not read as registered')
  })

  it('no longer issues an unconditional endorsement', () => {
    assert.ok(!SRC.includes('holds strong structural fundamentals'), 'every project got the same verdict')
  })

  it('distinguishes an unenriched project from a non-compliant one', () => {
    assert.ok(SRC.includes('const enriched ='), 'handler must test for an enrichment marker')
    assert.ok(SRC.includes("confidence: enriched ? 'HIGH' : 'LOW'"), 'HIGH is reserved for verified rows')
  })

  it('renders "Not verified" rather than a default for an unenriched project', async () => {
    const project = await prisma.project
      .findFirst({
        where: { water_tds_range: null, all_in_cost_multiplier: null },
        select: { name: true },
      })
      .catch(() => null)
    if (!project) return // no DB in this environment, or every row enriched

    const tokens: string[] = []
    const ctx = {
      message: `due diligence scorecard for ${project.name}`,
      flags: { isDueDiligenceQuery: true },
      catalog: [] as Array<{ id: string; name: string }>,
      activeProjectName: project.name,
      cachedProjects: [] as unknown[],
      intent: {},
      sessionId: 'test',
      send: (event: string, payload: Record<string, unknown>) => {
        if (event === 'token') tokens.push(String(payload.token))
      },
      emitUiState: () => {},
      res: { end: () => {} },
    }

    // The catalog lookup is how the handler resolves a name to an id; give it
    // the real row so the render path (not the general fallback) runs.
    const row = await prisma.project.findFirst({
      where: { water_tds_range: null, all_in_cost_multiplier: null },
      select: { id: true, name: true },
    })
    ctx.catalog = [row as { id: string; name: string }]

    const handled = await (dueDiligenceHandler.handle as (c: unknown) => Promise<boolean>)(ctx)
    assert.equal(handled, true)

    const answer = tokens.join('')
    assert.ok(answer.includes('Not verified'), 'unfilled columns must read as Not verified')
    assert.ok(
      !/Outside the corridor buffer/.test(answer),
      'an unfilled shahdara_drain_impact must not read as a clean zone',
    )
    assert.ok(
      !/Registered and compliant/.test(answer),
      'an unfilled lift_act_compliant must not read either way',
    )
  })
})
