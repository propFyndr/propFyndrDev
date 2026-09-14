// Does this turn ask us about the conversation itself?
//
// Extracted from chat-router so it can be pinned by a test. The router answers
// a yes here from the transcript and the session's own state, never from a
// model: a paraphrase of what the buyer said is a chance to get it wrong, and
// getting it wrong is the single most expensive kind of wrong we can be. An
// earlier run recapped a four-turn session about Sector 150 as projects by
// "Samridhi, ATS, Eldeco, Tata and Godrej", none of which had been shown.
export function asksAboutTheConversation(message: string): boolean {
  const m = message ?? ''
  return (
    /\bwhat (did|have) i (ask|asked|say|said|tell|told)\b/i.test(m) ||
    // "are you assuming" as well as "do you assume" — CLAUDE.md names the
    // progressive phrasing by hand, and only the simple one was covered.
    /\bwhat (do|did|are) you (know|remember|assume|assuming) about me\b/i.test(m) ||
    /\bwhat have i told you\b/i.test(m) ||
    /\b(remind me|recap) what (i|we)\b/i.test(m) ||
    // The same question asked at the end of a session instead of the middle.
    /\b(summari[sz]e|summary of|recap|sum up|go over|run through)\b[^?.!]{0,28}\b(our|this|the) (conversation|chat|discussion|session|talk)\b/i.test(m) ||
    /\b(conversation|chat|discussion) summary\b/i.test(m) ||
    /\bwhat (did|have) we (discuss|discussed|cover|covered|talk|talked|look|looked)\b/i.test(m)
  )
}
