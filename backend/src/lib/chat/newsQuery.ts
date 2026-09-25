/**
 * Does this turn ask about a builder announcement?
 *
 * One definition, because there were four. The same literal was pasted into
 * chat-router.ts twice (the coverage suppressor and the NEWS_MILESTONE lane) and
 * groundedAnswer.ts twice (the news context builder and the web-search gate), so
 * tuning it in one place silently disagreed with the other three.
 *
 * The term list is deliberately short. It previously carried `corridor`,
 * `flagship`, `delivery schedule` and `audit` — ordinary real-estate vocabulary,
 * not announcement vocabulary. Because the news lane returns the turn, "what's
 * in the Noida Expressway corridor" was answered as a builder press release
 * instead of reaching inventory. A term earns its place here only if a buyer
 * using it is asking about something a developer *published*.
 *
 * The old form also fired on `/["“][^"”]{8,}["”]/` — any quoted phrase of eight
 * characters or more, which is a thing people type for all sorts of reasons.
 * It is gone: the rail's own question ("...'s recent update: \"<headline>\"")
 * already matches on `recent update`, so the quote never needed to trigger
 * anything by itself.
 */
const NEWS_TERMS =
  /\b(recent\s+update|latest\s+update|news|milestone|announce(?:d|s|ment|ments)?|press\s+release)\b/i

export function isNewsQuery(message: string): boolean {
  return NEWS_TERMS.test(message)
}
