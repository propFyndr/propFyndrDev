// backend/src/lib/priceMovement.ts
//
// Is the buyer asking how a price MOVED over time?
//
// "Has the price of X changed over the last 12 months?" matched nothing in the
// old topic table, which only knew "price trend / history / movement / change"
// as adjacent words. The relation that answers it (price_history) was therefore
// never loaded, the model was handed no history, and said it was not available
// while six rows sat in the database. This reads the question the way a person
// asks it: a price word and a movement word near each other, in either order, or
// a price word tied to a point in time.
//
// Deliberately about the PAST. "Will the price rise" is a forward-looking
// question and is handled by the withheld-by-policy path, not here; this only
// decides whether to fetch the recorded series.

const PRICE =
  '(?:price|prices|pricing|rate|rates|psf|per\\s*sq\\s*ft|per\\s*square\\s*foot|cost|value|costlier|cheaper|' +
  'expensive|mehang\\w*|mahang\\w*|keemat|kimat|bhav|daam|dam)'

const MOVEMENT =
  '(?:chang\\w*|mov(?:e|ed|es|ing|ement)|trend\\w*|histor\\w*|grow\\w*|grew|ris(?:e|es|en|ing)|rose|' +
  'went\\s+up|gone\\s+up|go(?:es|ing)?\\s+up|increas\\w*|decreas\\w*|dropp?\\w*|fell|fall\\w*|hike\\w*|' +
  'jump\\w*|appreciat\\w*|depreciat\\w*|inflat\\w*|surg\\w*|climb\\w*|up\\s+by|down\\s+by|' +
  'badh\\w*|badha\\w*|ghat\\w*|gir\\w*|chadh\\w*|bad(?:h|d)\\s*gay\\w*)'

const WINDOW = '[^.?!\\n]{0,45}'

const PRICE_THEN_MOVE = new RegExp(`\\b${PRICE}\\b${WINDOW}\\b${MOVEMENT}\\b`, 'i')
const MOVE_THEN_PRICE = new RegExp(`\\b${MOVEMENT}\\b${WINDOW}\\b${PRICE}\\b`, 'i')

// A price tied to a point in the past: "price in 2023", "a year ago", "since 2021".
const PRICE_AT_A_TIME = new RegExp(
  `\\b${PRICE}\\b${WINDOW}(?:` +
    '\\b(?:\\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|few|couple\\s+of)\\s*(?:months?|years?|yrs?|quarters?)\\s+ago\\b|' +
    '\\b(?:a|one|last|past|previous)\\s+(?:year|yr|quarter|month)\\b|' +
    '\\b(?:in|during|since|from|back\\s+in|around|by)\\s+(?:q[1-4]\\s+)?(?:19|20)\\d\\d\\b|' +
    '\\bover\\s+the\\s+(?:years?|last|past|time)\\b|' +
    '\\b(?:pichle|pichhle|pehle)\\s+(?:saal|sal|mahine|year)\\b' +
  ')',
  'i',
)

// Phrasings that name the idea outright, including "become more expensive" and
// the Hinglish "mehnga hua", where the movement is carried by the verb.
const NAMED_IDEA = new RegExp(
  '\\b(?:cagr|capital\\s+gains?|appreciat\\w*|' +
    'how\\s+much\\s+(?:has|have|did)\\s+[^.?!\\n]{0,40}(?:gone|grown|risen|increased|moved)|' +
    'price\\s+(?:history|trend|movement|graph|chart)|' +
    '(?:becom\\w*|became|got|gotten|getting|turn(?:ed|ing)?)\\s+(?:much\\s+|a\\s+lot\\s+|more\\s+)*(?:expensive|costly|costlier|pricey|cheaper)|' +
    '(?:mehng\\w*|mahng\\w*|sast\\w*)\\s+(?:hua|hue|hui|ho\\s+gay\\w*|ho\\s+rah\\w*)' +
  ')\\b',
  'i',
)

export function asksPriceMovement(message: string): boolean {
  const m = (message || '').trim()
  if (!m) return false
  return PRICE_THEN_MOVE.test(m) || MOVE_THEN_PRICE.test(m) || PRICE_AT_A_TIME.test(m) || NAMED_IDEA.test(m)
}
