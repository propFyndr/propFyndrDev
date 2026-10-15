// backend/scripts/laneCoverage.ts
//
// Which lanes can the chat router answer from, and which of them does a route
// replay case pin? Read-only: it reads source files and route-replay.json, and
// touches no database.
//
//   npx tsx scripts/laneCoverage.ts
//
// A lane with no case is a gate nobody would notice stealing a question. Run
// this before moving code out of chat-router.ts, and add a case for any lane
// about to move.
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const SRC = join(__dirname, '..', 'src')
const read = (p: string) => readFileSync(join(SRC, p), 'utf8')

const router = read('routes/chat-router.ts')
const factRouter = read('lib/chat/deterministicFactRouter.ts')
const handlersDir = join(SRC, 'lib', 'chat', 'handlers')

const found = new Map<string, string>() // lane -> how it is named
const add = (lane: string, how: string) => { if (!found.has(lane)) found.set(lane, how) }

for (const m of router.matchAll(/persistEarlyTurn\(\s*'([^']+)'/g)) add(m[1], 'persistEarlyTurn')
for (const m of router.matchAll(/answerAsGeneralQuestion\('([^']+)'\)/g)) add(m[1], 'answerAsGeneralQuestion')
for (const m of router.matchAll(/turnTrace\.lane = '([^']+)'/g)) add(m[1], 'turnTrace.lane')
for (const m of router.matchAll(/Object\.assign\(turnTrace,\s*\{\s*lane: '([^']+)'/g)) add(m[1], 'Object.assign(turnTrace)')
for (const m of factRouter.matchAll(/turnTrace\.lane = '([^']+)'/g)) add(m[1], 'deterministicFactRouter')
// The lane persistEarlyTurn is given a template for: one per registered topic handler.
const registry = read('lib/chat/handlers/index.ts')
const registered = new Set([...registry.matchAll(/^import \{ (\w+) \} from '\.\/\w+'/gm)].map((m) => m[1]))
const parsed = new Set<string>()
for (const file of readdirSync(handlersDir).filter((f) => f.endsWith('.ts'))) {
  const text = readFileSync(join(handlersDir, file), 'utf8')
  for (const m of text.matchAll(/export const (\w+): ChatTopicHandler = \{\s*id: '([^']+)'/g)) {
    if (registered.has(m[1])) { add(`topic:${m[2]}`, 'topic handler'); parsed.add(m[1]) }
  }
}
const unparsed = [...registered].filter((n) => !parsed.has(n))
console.log(`Topic handlers in the registry: ${registered.size}, ids read: ${parsed.size}`)
if (unparsed.length) console.log(`WARNING: registered handlers whose id could not be read (their lanes are missing below): ${unparsed.join(', ')}\n`)

type Expect = { lane?: string; laneOneOf?: string[] }
const cases = JSON.parse(readFileSync(join(SRC, 'lib', 'eval', 'route-replay.json'), 'utf8')) as Array<{
  id: string
  turns: Array<{ expect?: Expect }>
}>
const pinned = new Map<string, Set<string>>()
for (const c of cases) {
  for (const t of c.turns) {
    for (const lane of [t.expect?.lane, ...(t.expect?.laneOneOf ?? [])]) {
      if (lane) (pinned.get(lane) ?? pinned.set(lane, new Set()).get(lane)!).add(c.id)
    }
  }
}

const lanes = [...found.keys()].sort((a, b) => a.localeCompare(b))
const covered = lanes.filter((l) => pinned.has(l))
const uncovered = lanes.filter((l) => !pinned.has(l))

console.log(`Lanes the router can name: ${lanes.length}  (pinned by a replay case: ${covered.length}, not pinned: ${uncovered.length})\n`)
console.log('NOT PINNED')
for (const l of uncovered) console.log(`  ${l.padEnd(28)} ${found.get(l)}`)
console.log('\nPINNED')
for (const l of covered) console.log(`  ${l.padEnd(28)} ${String(pinned.get(l)!.size).padStart(2)} case(s)  ${[...pinned.get(l)!].slice(0, 3).join(', ')}`)
const strays = [...pinned.keys()].filter((l) => !found.has(l)).sort()
if (strays.length) {
  console.log('\nPINNED BUT NOT FOUND IN SOURCE (named another way, or stale)')
  for (const l of strays) console.log(`  ${l}`)
}
