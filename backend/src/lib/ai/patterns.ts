// Single source of truth for all guardrail patterns.
export const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+|previous\s+|your\s+)*(?:system\s+|prior\s+)?instructions/i,
  /disregard\s+(your\s+|the\s+)?(system\s+|prior\s+|previous\s+)?prompt/i,
  // "You are now" alone refused "you are now showing me 2BHKs?". The jailbreak
  // is "you are now" plus a persona defined by not having our rules.
  /you\s+are\s+now\s+(?:an?\s+)?(?:dan\b|free\b|unrestricted|unfiltered|uncensored|jailbroken|evil|in\s+(?:developer|dev|god|jailbreak)\s+mode|no\s+longer|not\s+bound|(?:a\s+)?different\s+(?:ai|assistant|model|bot)|(?:ai|assistant|model|chatbot)\s+(?:without|with\s+no|that\s+ignores))/i,
  // The persona can be anything ("you are now an advisor who…"); the tell is
  // the rule it drops.
  /\b(?:ignores?|ignoring|bypass(?:es|ing)?|disregards?|disregarding)\s+(?:(?:all|any|your|its|the|of)\s+)*(?:safety|rules|restrictions|guidelines|guardrails|filters)\b/i,
  /repeat\s+(the\s+|your\s+|above\s+|following\s+)(text|prompt|instructions)/i,
  // Upper case only: /\bDAN\b/i refused every buyer named Dan.
  /\bDAN\b/,
  /\bdo\s+anything\s+now\b/i,
  // "act as" alone blocked "can you act as my negotiator" — a request this
  // product exists to serve; `negotiat` is in the classifier's own advisory
  // pattern. A guardrail that dead-ends a buyer asking for negotiation help is
  // a worse outcome than the jailbreak it was aimed at, and the jailbreak shape
  // is always "act as" plus a persona defined by NOT having our rules.
  /\bact\s+as\s+(?:a|an|the)?\s*(?:dan\b|unrestricted|unfiltered|uncensored|jailbreak|jailbroken|different\s+(?:ai|assistant|model)|another\s+(?:ai|assistant|model)|chatgpt|gpt|claude|language\s+model|ai\s+(?:without|with\s+no))/i,
  /\bact\s+as\s+if\s+you\s+(?:have\s+no|had\s+no|are\s+not\s+bound|don'?t\s+have)/i,
  // A persona without rules, not any "pretend": "pretend I am a first-time
  // buyer, what should I check?" is a normal question.
  /pretend\s+(?:that\s+)?(?:you\s+)?(?:are|to\s+be)\s+(?:an?\s+)?(?:dan\b|unrestricted|unfiltered|uncensored|jailbroken|evil|free\s+(?:from|of)|no\s+longer|not\s+bound|(?:a\s+)?different\s+(?:ai|assistant|model|bot)|(?:ai|assistant|model|chatbot)\s+(?:without|with\s+no))/i,
  /pretend\s+(?:that\s+)?(?:you\s+)?(?:have|had)\s+no\s+(?:rules|restrictions|guidelines|instructions|filters|limits)/i,
  /hypothetically\s+you\s+/i, // "hypothetically you are..."
  // "Space for a game room" is a flat requirement; games are covered by the
  // let's-play pattern below.
  /for\s+a\s+(?:screenplay|novel|story|scene|script)\b/i, // Fiction framings
  /let'?s?\s+play\s+a?\s+(?:game|scenario|roleplay|role\s+play)/i, // Roleplay framings
  // The grandma exploit, not hearsay: "my friend said Sector 150 is good" is a
  // buyer repeating advice and was refused as a jailbreak.
  /my\s+(?:late\s+|dead\s+)?(?:grandmother|grandma|granny|dadi|nani)\s+(?:used\s+to|would)\s+(?:read|tell|recite|say)/i,
  /translate\s+(?:the\s+)?following\s+(?:and\s+then\s+)?(?:execute|follow|obey|run)/i, // Indirect instruction injection
  /override\s+(your\s+)?(programming|training|instructions)/i,
  /what\s+(is|are)\s+your\s+system\s+prompt/i,
  /reveal\s+(your\s+)?(system|internal)\s+(prompt|instructions)/i,
  /(reveal|print|show|repeat|output|quote|dump)\s+(your|the|entire)\s+(system\s+)?(prompt|instructions)/i,
  /forget\s+(everything|all|your instructions)/i,
  /bypass\s+(all\s+)?filters/i,
  /enter\s+(developer|jailbreak)\s+mode/i,
  /system override/i,
  /quote\s+(the\s+)?entire\s+document/i,
  // Hindi/Hinglish jailbreak attempts (including pure Devanagari)
  /system\s+prompt\s+batao/i,
  /apne\s+rules\s+bhool\s+jao/i,
  /system\s+prompt\s+kya\s+hai/i,
  /apne\s+instructions\s+bhool\s+jao/i,
  /rules\s+mat\s+mano/i,
  /pehle\s+wale\s+instructions\s+ignore/i,
  /koi\s+bhi\s+role\s+play\s+karo/i,
  // Devanagari jailbreak patterns, as PHRASES.
  //
  // These were two bare word-alternations wrapped in `[ऀ-ॿ]*`, which matches
  // the empty string — so the patterns reduced to "contains सिस्टम, प्रॉम्प्ट,
  // निर्देश, भूल, छुपा or दिखा anywhere". दिखा is "show" and निर्देश is
  // "instruction/guideline", so "मुझे Sector 150 में फ्लैट दिखाओ" — show me
  // flats in Sector 150 — was refused as a prompt injection, as was
  // "घर खरीदने के दिशा निर्देश बताइए", a request for home-buying guidelines.
  // A jailbreak is the words together, never one of them alone.
  /सिस्टम\s*(?:प्रॉम्प्ट|प्रांप्ट)/i,
  /प्रॉम्प्ट\s*(?:बताओ|बताइए|दिखाओ|क्या\s*है)/i,
  /(?:निर्देश|नियम|इंस्ट्रक्शन)[^\n]{0,12}(?:भूल|अनदेखा|नज़रअंदाज|मत\s*मानो)/i,
  /भूल\s*जा(?:ओ|)[^\n]{0,20}(?:निर्देश|नियम|सब\s*कुछ)/i,
  /\[system\]/i,
  /<\|im_start\|>/i,
  /<\|endoftext\|>/i,
  /### instruction/i,
  /\[INST\]/i,
  /base64.*decode/i,
  /rot13/i,
]

export const COMPETITOR_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /magicbricks/i, name: 'MagicBricks' },
  { pattern: /99acres/i, name: '99acres' },
  { pattern: /housing\.com/i, name: 'Housing.com' },
  { pattern: /nobroker/i, name: 'NoBroker' },
  { pattern: /proptiger/i, name: 'PropTiger' },
  { pattern: /squareyards/i, name: 'Square Yards' },
  { pattern: /makaan\.com/i, name: 'Makaan' },
]
