// backend/scripts/measure-prompt-tail.ts
//
//   npx tsx scripts/measure-prompt-tail.ts
//
// Where the per-turn tail's characters go.
//
// Gemini's free tier reports cachedContentTokenCount = 0 on every call and
// refuses explicit caches outright (limit=0), so nothing in this prompt is
// cached today whatever its prefix stability. Until billing is enabled the only
// lever on cost is sending fewer characters, and the per-turn segments are
// where they are: measured live, head 26,387 chars vs tail 15,991.
//
// Prints the split so a change can be measured rather than asserted.

import { buildSystemPromptWithCache, STATIC_PREFIX_MARKER } from '../src/lib/ai/systemPromptCache'
import { splitSystemPrompt } from '../src/lib/ai/prompts/base'
import { discoverProjects } from '../src/lib/discovery/projects'

async function main(): Promise<void> {
  const intentDiscovery = { sector: 'Sector 75', city: 'Noida', spatialScope: 'EXACT', queryKind: 'DISCOVERY' }
  const intentSingle = { projectNames: ['Gardenia Golf City'], city: 'Noida', spatialScope: 'EXACT', queryKind: 'PROJECT_DEEP_DIVE' }
  const intentCompare = { projectNames: ['Gardenia Golf City', 'DASNAC Burj Noida'], city: 'Noida', spatialScope: 'EXACT', queryKind: 'COMPARISON' }
  const found = await discoverProjects(intentDiscovery as never, 0)

  const tok = (s: string) => Math.round(s.length / 3.6)

  console.log('\n--- EVALUATING DYNAMIC RULES ACROSS QUERY MODES ---')
  for (const { label, intent, limit } of [
    { label: 'Single Project', intent: intentSingle, limit: 12 },
    { label: 'Comparison', intent: intentCompare, limit: 12 },
    { label: 'Discovery (4 projects)', intent: intentDiscovery, limit: 4 },
  ]) {
    const full = buildSystemPromptWithCache(
      intent, found.exactResults.slice(0, limit) as never, {}, null, null, null, [], [], [], 'GATHERING', 'Noida',
      undefined, true, true, 'properties in noida sector 75',
    )
    const { head, tail } = splitSystemPrompt(full)
    const at = tail.indexOf(STATIC_PREFIX_MARKER)
    const perTurnRules = at === -1 ? tail : tail.slice(0, at)
    const dynamic = at === -1 ? '' : tail.slice(at + STATIC_PREFIX_MARKER.length)
    console.log(
      `${label.padEnd(25)} head=${String(head.length).padStart(6)}c  ` +
      `rules=${String(perTurnRules.length).padStart(6)}c  projectBlock=${String(dynamic.length).padStart(6)}c  ` +
      `total=${String(full.length).padStart(6)}c  ~${tok(full)} tok`,
    )
  }
}

main()
