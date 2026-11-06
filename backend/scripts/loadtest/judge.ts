// Shared by chat-load.ts and failure-drills.ts.
export type Verdict = 'ok' | 'notice' | 'empty' | 'limited' | 'error'
// Wording CLAUDE.md forbids: appreciation forecasts and the verdict words dropUnsourcedJudgements removes.
export const BANNED = /appreciation|poised for|capital growth|robust (price|demand)|(strong|excellent|high|good|attractive|healthy|solid) rental (yield|demand)s?|appreciation potential|every project [^.]{0,40}(verified|screened)|objectively|risk-free|zero-delay|superior choice|unblemished|clean legal standing|guaranteed returns?/i
export const NOTICE = /briefly unavailable|briefly unreachable|rather say so than guess|experiencing high traffic|too many messages|temporarily hit capacity/i

/** Judge one finished SSE body. */
export function judge(status: number | null, body: string): { verdict: Verdict; answer: string; lane: string | null; done: boolean; flags: string[] } {
  const events = body.split('\n\n').flatMap((p) => {
    const ev = /^event: (\w+)/m.exec(p); const data = /^data: (.+)$/m.exec(p)
    if (!ev || !data) return []
    try { return [{ event: ev[1], data: JSON.parse(data[1]) as Record<string, unknown> }] } catch { return [] }
  })
  // A token event with replace:true restarts the answer (outage notice, integrity retry).
  const answer = events.filter((e) => e.event === 'token').reduce((t, e) => (e.data.replace ? '' : t) + String(e.data.token ?? ''), '')
  const done = events.some((e) => e.event === 'done')
  const lane = (events.find((e) => e.event === 'timing')?.data.lane as string | undefined) ?? null
  const flags = [...new Set(answer.match(new RegExp(BANNED.source, 'gi')) ?? [])].map((x) => x.toLowerCase())
  if (answer.trim() && /^[a-z)\]]/.test(answer.trim())) flags.push('starts-mid-sentence')
  if (status === 429) return { verdict: 'limited', answer, lane, done, flags }
  if (status !== 200) return { verdict: 'error', answer, lane, done, flags }
  if (!done) return { verdict: 'error', answer, lane, done, flags }
  if (!answer.trim()) return { verdict: 'empty', answer, lane, done, flags }
  if (NOTICE.test(answer) && answer.length < 400) return { verdict: 'notice', answer, lane, done, flags }
  return { verdict: 'ok', answer, lane, done, flags }
}
