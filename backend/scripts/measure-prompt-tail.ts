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

import { buildSystemPromptWithCache } from '../src/lib/ai/systemPromptCache'
import { splitSystemPrompt } from '../src/lib/ai/prompts/base'
import { discoverProjects } from '../src/lib/discovery/projects'

const STATIC_PREFIX_MARKER = '<!-- STATIC_PREFIX_END -->'

async function main(): Promise<void> {
  const intent = { sector: 'Sector 75', city: 'Noida', spatialScope: 'EXACT', queryKind: 'DISCOVERY' }
  const found = await discoverProjects(intent as never, 0)

  for (const limit of [12, 8, 6, 4]) {
    const projects = found.exactResults.slice(0, limit)
    const full = buildSystemPromptWithCache(
      intent, projects as never, {}, null, null, null, [], [], [], 'GATHERING', 'Noida',
      undefined, true, true, 'properties in noida sector 75',
    )
    const { head, tail } = splitSystemPrompt(full)
    const at = tail.indexOf(STATIC_PREFIX_MARKER)
    const perTurnRules = at === -1 ? tail : tail.slice(0, at)
    const dynamic = at === -1 ? '' : tail.slice(at + STATIC_PREFIX_MARKER.length)
    const tok = (s: string) => Math.round(s.length / 3.6)
    console.log(
      `projects=${String(limit).padStart(2)}  head=${String(head.length).padStart(6)}c  ` +
      `rules=${String(perTurnRules.length).padStart(6)}c  projectBlock=${String(dynamic.length).padStart(6)}c  ` +
      `total=${String(full.length).padStart(6)}c  ~${tok(full)} tok`,
    )
  }
}

main()
