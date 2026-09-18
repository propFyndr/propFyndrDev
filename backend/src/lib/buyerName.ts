// backend/src/lib/buyerName.ts
//
// Pulling a buyer's name out of what they typed.
//
// The chat lead-capture used `/name[:\s]*([a-zA-Z\s;]+)/i`, which on
//
//   "My name is Rahul Sharma and my phone number is 9876543210"
//
// captured everything from "is" up to the first digit, producing a lead called
// "Is Rahul Sharma and my phone number is". A salesperson opening the queue to
// call somebody cannot use that, and it is the first thing they see.
//
// ── The rule ───────────────────────────────────────────────────────────────
//
// Take the words immediately after the introduction, stop at the first word
// that cannot be part of a name, and refuse anything that does not look like
// one. Refusing matters more than capturing: a lead called "Valued Buyer" is
// awkward, a lead called "Is Rahul Sharma And My Phone Number Is" is a bug
// somebody has to apologise for on a phone call.

/**
 * Words that end a name. Everything after one of these belongs to the next
 * clause — which is precisely where the old pattern kept reading.
 */
const TERMINATORS = new Set([
  'and', 'my', 'phone', 'number', 'mobile', 'contact', 'call', 'me', 'at',
  'i', 'im', 'the', 'is', 'am', 'was', 'please', 'you', 'can', 'could',
  'would', 'want', 'need', 'looking', 'interested', 'for', 'in', 'on',
  'from', 'to', 'with', 'this', 'that', 'it', 'we', 'they', 'sir', 'madam',
])

/**
 * Filler that can sit between "name" and the actual name.
 *
 * "my name is Rahul" -> after `name` comes `is`, which is filler here and a
 * terminator later. Order is what separates them, so they are two lists.
 */
const LEADING_FILLER = new Set(['is', 'are', 'was', 'the', 'a'])

/** A plausible name word: letters, optionally hyphenated or apostrophed. */
const NAME_WORD = /^[A-Za-z][A-Za-z'’-]{0,24}$/

/** Longest a real name runs before it is almost certainly a sentence. */
const MAX_WORDS = 4

/**
 * Title-cases each part of a compound name.
 *
 * A single `charAt(0).toUpperCase()` turns "Anne-Marie" into "Anne-marie",
 * which is a misspelling of somebody's name rather than a formatting quirk.
 */
function titleCase(word: string): string {
  return word
    .split(/([-'’])/)
    .map((part) => (/[-'’]/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join('')
}

/**
 * The buyer's name, or null when the message does not clearly contain one.
 *
 * Null is a real answer and the caller should use its own placeholder rather
 * than this guessing. Every rejection below is a case where guessing produced
 * something worse than admitting we do not know.
 */
export function extractBuyerName(message: string): string | null {
  if (!message) return null

  // Where the introduction ends. `name` covers "my name is X" and "name: X";
  // the others cover the forms people actually type instead.
  /**
   * Word boundaries sit on the alternatives that end in a letter, not on the
   * group as a whole. A trailing `\b` after the group never matched `name:` —
   * a colon and the space after it are both non-word characters, so there is
   * no boundary between them, and every "Name: X" message fell through to
   * null. Dropping it entirely would let `i\s+am` match inside "I amazing".
   */
  const intro = message.match(/(?:\bmy\s+name\s+is\b|\bname\s*[:\-]|\bthis\s+is\b|\bi\s+am\b|\bi'?m\b)/i)
  if (!intro) return null

  const after = message.slice(intro.index! + intro[0].length)

  // Stop at the first punctuation that ends a clause, so "Rahul, call me"
  // never reaches the word loop.
  const clause = after.split(/[,.;:!?\n]/)[0]

  const words: string[] = []
  for (const raw of clause.trim().split(/\s+/)) {
    const word = raw.replace(/[^A-Za-z'’-]/g, '')
    if (!word) break

    const lower = word.toLowerCase()

    // Filler only counts while nothing real has been taken yet.
    if (words.length === 0 && LEADING_FILLER.has(lower)) continue

    if (TERMINATORS.has(lower)) break
    if (!NAME_WORD.test(word)) break

    words.push(word)
    if (words.length === MAX_WORDS) break
  }

  if (words.length === 0) return null

  const name = words.map(titleCase).join(' ')

  /**
   * A single letter is initials or a stray token, not a name we can greet
   * somebody by. Two characters is the shortest real Indian given name we can
   * defend ("Om", "Jo").
   */
  if (name.replace(/[^A-Za-z]/g, '').length < 2) return null

  return name
}
