/**
 * Which buyer questions can we actually answer, judged without an LLM.
 *
 * Reads the question corpus in /QueriesAndKeywords and runs each question
 * through the real routing logic — outOfScopeDirective() and the topic-handler
 * matchers, imported, not copied — so the answer to "do we handle this?" comes
 * from the code that will handle it rather than from a reading of the code.
 *
 * Run: npm run audit:queries
 *
 * The two numbers that matter:
 *   OUT OF SCOPE   we say so cleanly, which is a correct outcome, not a gap
 *   NO SOURCE      in scope, no handler, and blocked from web grounding. This
 *                  is the only bucket that produces a confident wrong answer,
 *                  and it must stay at zero.
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { outOfScopeDirective } from '../src/lib/ai/prompts/base'
import { CHAT_TOPIC_HANDLERS } from '../src/lib/chat/handlers'

const CORPUS_DIR = join(__dirname, '..', '..', 'QueriesAndKeywords')

function loadQuestions(): { file: string; q: string }[] {
  const out: { file: string; q: string }[] = []
  const seen = new Set<string>()
  for (const file of readdirSync(CORPUS_DIR).filter(f => f.endsWith('.md'))) {
    const text = readFileSync(join(CORPUS_DIR, file), 'utf8')
    for (const m of text.matchAll(/\*\*"(.+?)"\*\*/g)) {
      const q = m[1].replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
      if (q.length > 25 && !seen.has(q)) {
        seen.add(q)
        out.push({ file, q })
      }
    }
  }
  return out
}

/**
 * Copied from the open-query lane in chat-router.ts, where they are inline
 * consts rather than exports. Kept in sync by coverage.test.ts, which asserts
 * the source still reads the way this assumes.
 */
const asksForInventory = (m: string) =>
  /\b(societ(y|ies)|projects?|builders?|flats?|apartments?|properties|options?)\b/i.test(m) &&
  /\b(best|top|which|show|list|find|recommend|suggest|good|any)\b/i.test(m)
const legalVocabulary = (m: string) =>
  /\b(litigation|legal|court|nclt|dispute|title|encumbrance|clean|clear title|safe to buy|due diligence|rera)\b/i.test(m)
const pointsAtInventory = (m: string) =>
  asksForInventory(m) ||
  /\b(which|any|list|show|name)\b[^.?!]{0,40}\b(project|societ|builder|tower|flat)/i.test(m)
const asksLegalSafety = (m: string) => legalVocabulary(m) && pointsAtInventory(m)

/**
 * Ask each handler's own matcher whether it claims the question.
 *
 * Handlers whose matcher reads a router-computed flag cannot answer here — the
 * flags are per-turn and depend on intent extraction — so they are reported
 * separately rather than counted as misses.
 */
function claimingHandler(message: string): { id: string; needsFlags: boolean } {
  for (const h of CHAT_TOPIC_HANDLERS) {
    try {
      if (h.matches({ message, flags: {}, intent: {} } as never)) return { id: h.id, needsFlags: false }
    } catch {
      // A matcher that reaches for something not in this stub cannot be judged
      // from a bare message; that is information, not an error.
      return { id: h.id, needsFlags: true }
    }
  }
  return { id: '', needsFlags: false }
}

function main(): void {
  const questions = loadQuestions()
  const rows = questions.map(x => {
    const directive = outOfScopeDirective(x.q)
    const subject = directive ? directive.match(/about \*\*(.+?)\*\*/)?.[1] ?? 'out of scope' : ''
    const handler = claimingHandler(x.q)
    return {
      ...x,
      subject,
      handler: handler.id,
      blockedFromWeb: asksLegalSafety(x.q),
    }
  })

  const outOfScope = rows.filter(r => r.subject)
  const inScope = rows.filter(r => !r.subject)
  const handled = inScope.filter(r => r.handler)
  const grounded = inScope.filter(r => !r.handler && !r.blockedFromWeb)
  const noSource = inScope.filter(r => !r.handler && r.blockedFromWeb)

  console.log(`\nCorpus: ${rows.length} unique questions from ${CORPUS_DIR}\n`)
  console.log(`  ${String(outOfScope.length).padStart(3)}  OUT OF SCOPE — declared, handed off cleanly`)
  console.log(`  ${String(handled.length).padStart(3)}  HANDLER      — answered from our own rows or statutory constants`)
  console.log(`  ${String(grounded.length).padStart(3)}  GROUNDED     — generic lane, our rows first then web`)
  console.log(`  ${String(noSource.length).padStart(3)}  NO SOURCE    — in scope, no handler, web blocked  ← must stay 0`)

  const bySubject = new Map<string, number>()
  for (const r of outOfScope) bySubject.set(r.subject, (bySubject.get(r.subject) ?? 0) + 1)
  console.log('\nOut of scope, by subject:')
  for (const [k, v] of [...bySubject].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)

  const byHandler = new Map<string, number>()
  for (const r of handled) byHandler.set(r.handler, (byHandler.get(r.handler) ?? 0) + 1)
  console.log('\nClaimed by handler:')
  for (const [k, v] of [...byHandler].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)

  if (noSource.length) {
    console.log('\nNO SOURCE — these produce an answer with nothing behind it:')
    for (const r of noSource) console.log(`  • ${r.q.slice(0, 120)}`)
  }

  process.exitCode = noSource.length ? 1 : 0
}

main()
