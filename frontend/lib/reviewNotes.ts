// Parses the reviewer notes the blog generator writes (backend
// src/lib/blog/generateDraft.ts, `notes`). Coupled to that wording on purpose:
// the notes stay plain text for the reviewer and for the stored record, and
// this turns them into a checklist. A line this file does not recognise is
// still shown, as an unclassified flag, so a new backend note is never hidden.

export interface ParsedReviewNotes {
  topic?: string
  sourcesFound?: number
  sourcesCited?: number
  rewrittenReason?: string
  noSourceCited: boolean
  unverifiedFigures: string[]
  wordCount?: number
  templateVocabulary: string[]
  /** Every other line: each one is something the reviewer should look at. */
  otherFlags: string[]
  /** True when anything beyond the summary line needs attention. */
  needsReview: boolean
}

const list = (s: string) => s.split(',').map(x => x.trim().replace(/^["'“”]|["'“”]$/g, '')).filter(Boolean)

export function parseReviewNotes(raw: string | null | undefined): ParsedReviewNotes {
  const out: ParsedReviewNotes = { noSourceCited: false, unverifiedFigures: [], templateVocabulary: [], otherFlags: [], needsReview: false }
  for (const line of (raw ?? '').split('\n').map(l => l.trim()).filter(Boolean)) {
    // Summary: AI draft on "topic". 5 sources found, 0 cited. Rewritten once because: x; y.
    const summary = /^AI draft on ["“](.+?)["”]\.\s*(\d+) sources? found, (\d+) cited\.(?:\s*Rewritten once because:\s*(.+?)\.?$)?/i.exec(line)
    if (summary) {
      out.topic = summary[1]
      out.sourcesFound = Number(summary[2])
      out.sourcesCited = Number(summary[3])
      out.rewrittenReason = summary[4]?.trim()
      continue
    }
    if (/^NO SOURCE CITED/i.test(line)) { out.noSourceCited = true; continue }
    const figures = /^Figures not found in any source[^:]*:\s*(.+)$/i.exec(line)
    if (figures) { out.unverifiedFigures = list(figures[1]); continue }
    const vocab = /^Template vocabulary to replace:\s*(.+?)\.?$/i.exec(line)
    if (vocab) { out.templateVocabulary = list(vocab[1]); continue }
    // Only the length line sets the word count; "(SEO target 40-65)" on a
    // title line used to overwrite the word target.
    const length = /^Length is (\d+) words/i.exec(line)
    if (length) { out.wordCount = Number(length[1]) }
    out.otherFlags.push(line)
  }
  out.needsReview = out.noSourceCited || out.unverifiedFigures.length > 0 || out.templateVocabulary.length > 0 || out.otherFlags.length > 0
  return out
}
