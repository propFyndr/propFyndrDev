// backend/src/lib/ai/endsRagged.ts
//
// Does this text look cut off mid-word or mid-sentence? Shared between the
// corpus grader and the live adapters — same question, same answer.
//
// Found live, 8 Sep: a free-tier Gemini answer stopped after 95 completion
// tokens ("...as developers in this micro-market primarily focus on larger 2,
// 3, and 4 BHK configurations. \n\nWould") with `finishReason` something other
// than MAX_TOKENS — so the one continuation guard in gemini.ts, gated on
// `finishReason === 'MAX_TOKENS'`, never fired. Whatever finishReason a
// provider reports, an answer that trails off on a bare word is not finished.
export function endsRagged(text: string): boolean {
  const s = text.trimEnd()
  if (!s) return false
  if (/[.!?:)"'\]`*]$/.test(s)) return false
  const last = s.split('\n').pop()!.trim()
  if (last.startsWith('|') && last.endsWith('|')) return false
  return true
}
