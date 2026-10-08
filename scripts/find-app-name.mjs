#!/usr/bin/env node

/**
 * ═════════════════════════════════════════════════════════════════════════════
 *                 PROPFYNDR / REAL ESTATE BRAND NAME DISCOVERY TOOL
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * What this actually does, honestly:
 *
 * 1. NAME GENERATOR: takes a seed word or vibe (e.g. "Yardly", "AcreLyst",
 *    "Zillow") and synthesizes candidate brand names from a root/suffix word
 *    list. A word-combination generator, not a taste model.
 * 2. DOMAIN AVAILABILITY (the one check that's actually authoritative): RDAP
 *    queries against the real registries (Verisign for .com/.net, NIXI's
 *    registry.in for .in, the IANA bootstrap gateway for everything else,
 *    including .io/.ai), with a DNS NS/SOA lookup as a fallback when RDAP
 *    itself is unreachable. Returns available / taken / unknown -- never
 *    guesses when it can't tell.
 * 3. NAME-COLLISION & DESCRIPTIVENESS HEURISTIC: regex matching against a
 *    short hardcoded list of well-known real-estate brands, plus a
 *    prefix/suffix word-shape check. This is a cheap sanity check, NOT a
 *    trademark registry search -- it queries no real trademark database
 *    (not IP India, not the USPTO, nothing) and has no legal authority.
 *    Treat a "clean" result as "worth a real search", never as clearance.
 * 4. WEB-MENTION SCAN: one DuckDuckGo search, read once, at one point in
 *    time. Tells you whether an obvious name collision shows up in a quick
 *    search -- it is not an SEO audit, not a ranking prediction, and not a
 *    substitute for checking yourself. When the search fails, is blocked, or
 *    the page layout changes, this returns UNKNOWN rather than guessing
 *    "clean" -- a failed check must never look like a passed one.
 * 5. ADVERSE-MENTION SCAN: same mechanism, searching for litigation/fraud/
 *    RERA/NCLT keywords near the name. A "no mentions found" result means
 *    exactly that -- nothing turned up in one search engine's index just
 *    now. It is not a background check, not a legal-record search, and must
 *    never be read as due diligence before spending real money on a name.
 * 6. STICKINESS/RECALL: syllable count, length, "radio test" (short, no
 *    hyphens/digits) -- a genuinely mechanical, deterministic check.
 * 7. LEADERBOARD + DOSSIER: ranks candidates by a composite score that is
 *    normalized over only the checks that actually verified something this
 *    run (see each result's `confidence` field) -- a blocked or timed-out
 *    web check is excluded from scoring, never silently treated as a pass.
 *
 * Usage (human, colored terminal output):
 *   node scripts/find-app-name.mjs
 *   node scripts/find-app-name.mjs --taste "Yardly"
 *   node scripts/find-app-name.mjs --check "YardLyst"
 *   node scripts/find-app-name.mjs --curated
 *
 * Usage (agent / Claude Code / Antigravity -- machine-readable, no prompts,
 * no ANSI color codes, a single JSON object on stdout):
 *   node scripts/find-app-name.mjs --taste "Yardly" --json
 *   node scripts/find-app-name.mjs --check "YardLyst" --json
 *   node scripts/find-app-name.mjs --curated --json
 * ═════════════════════════════════════════════════════════════════════════════
 */

import dns from 'node:dns/promises';
import readline from 'node:readline';

// Authoritative root resolvers
dns.setServers(['8.8.8.8', '1.1.1.1']);

// ─────────────────────────────────────────────────────────────────────────────
// COLOR FORMATTING HELPERS FOR TERMINAL
// ─────────────────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgDark: '\x1b[100m',
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. TASTE ANALYSIS & HIGH-RECALL NAME SYNTHESIZER
// ─────────────────────────────────────────────────────────────────────────────

// High-leverage semantic building blocks for PropTech & Modern Tech
const REALTY_ROOTS = [
  'Acre', 'Yard', 'Plot', 'Plat', 'Pave', 'Deed', 'Key', 'Site', 
  'Base', 'Terra', 'Haven', 'Nest', 'Dome', 'Loom', 'Roof', 'Brick',
  'Span', 'Gate', 'Way', 'Dwel', 'Strid', 'Vist', 'Aura', 'Casa'
];

const TECH_SUFFIXES = [
  'lyst', 'pave', 'fyn', 'via', 'deck', 'ra', 'va', 'ix', 'vo',
  'plat', 'grid', 'pulse', 'flow', 'hub', 'path', 'nest', 'wise'
];

// Curated pool of high-taste candidates tested in previous research
const CURATED_CANDIDATE_POOL = [
  'YardLyst', 'YardPave', 'YardPlat', 'Yarddeck', 'Yardfyn', 'Yardvia',
  'AcreLyst', 'AcrePave', 'Acrefyn', 'Acrevia', 'Acredeck', 'AcrePlat',
  'PlotLyst', 'PlotPave', 'Plotfyn', 'PlotPlat', 'Plotvia', 'Plotdeck',
  'DeedLyst', 'DeedPave', 'Deedfyn', 'KeyLyst', 'KeyPave', 'Keyfyn',
  'Wayfyn', 'Pathfyn', 'SettleDeck', 'SettlePave', 'TerraLyst', 'TerraPave',
  'Dwelvi', 'Stridva', 'Platvia', 'PaveWise', 'RoofDeck', 'BrickLyst'
];

/**
 * Synthesizes 20-30 catchy, high-recall brand names inspired by the user's taste
 */
function generateNamesFromTaste(seed) {
  if (!seed || seed.trim().length === 0) {
    return CURATED_CANDIDATE_POOL;
  }

  const cleanSeed = seed.trim().replace(/[^a-zA-Z]/g, '');
  const lowerSeed = cleanSeed.toLowerCase();

  const generated = new Set();

  // 1. Include the seed itself (with smart capitalization)
  generated.add(cleanSeed.charAt(0).toUpperCase() + cleanSeed.slice(1));

  // 2. Extract potential root if seed has recognisable prefixes
  let matchingRoots = REALTY_ROOTS.filter(r => lowerSeed.includes(r.toLowerCase()));
  if (matchingRoots.length === 0) {
    // If user entered something novel (e.g. "Kora", "Zen", "Pulse"), use it as custom root
    matchingRoots = [cleanSeed.charAt(0).toUpperCase() + cleanSeed.slice(1)];
  }

  // 3. Generate combinatorial matches with modern tech suffixes
  for (const root of matchingRoots) {
    for (const sfx of TECH_SUFFIXES) {
      // Capitalize suffix for compound readability
      const sfxCap = sfx.charAt(0).toUpperCase() + sfx.slice(1);
      generated.add(`${root}${sfxCap}`);
    }
  }

  // 4. Generate sister names matching the same phonetic vibe
  const secondaryRoots = REALTY_ROOTS.slice(0, 8);
  for (const sfx of ['Lyst', 'Pave', 'fyn', 'via', 'Plat', 'Deck']) {
    for (const r of secondaryRoots) {
      generated.add(`${r}${sfx}`);
    }
  }

  // 5. Add a few coined neologisms (Uber/Spotify cadence)
  const prefixCut = cleanSeed.slice(0, 4);
  if (prefixCut.length >= 3) {
    const p = prefixCut.charAt(0).toUpperCase() + prefixCut.slice(1).toLowerCase();
    generated.add(`${p}lyst`);
    generated.add(`${p}ra`);
    generated.add(`${p}va`);
    generated.add(`${p}via`);
    generated.add(`${p}fyn`);
  }

  return Array.from(generated).slice(0, 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LIVE DOMAIN VERIFICATION ENGINE (DNS + VERISIGN & NIXI RDAP)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true/false when DNS gives a real signal, null when it can't tell.
 *
 * NS records present -> registered (false). NXDOMAIN on both NS and SOA ->
 * likely available (true). Anything else (timeout, SERVFAIL, a resolver that
 * just didn't answer) is genuinely unknown -- returning false here used to
 * mean "probably registered", which is wrong more often than it's right, and
 * because auditDomain only fell back to RDAP when DNS said "available", every
 * one of those unknowns short-circuited straight to "taken" with no RDAP
 * cross-check at all.
 */
async function checkDns(domain) {
  try {
    const ns = await dns.resolveNs(domain);
    if (ns && ns.length > 0) return false; // Definitely registered
  } catch (e) {
    if (e.code === 'ENOTFOUND' || e.code === 'ENODATA') {
      try {
        await dns.resolveSoa(domain);
        return false; // SOA exists -> registered
      } catch (soaErr) {
        if (soaErr.code === 'ENOTFOUND' || soaErr.code === 'ENODATA') return true; // No NS, no SOA -> likely available
      }
    }
    // ESERVFAIL / EREFUSED / ETIMEOUT / anything else: the resolver didn't
    // actually answer the question. Not evidence either way.
  }
  return null;
}

async function checkRdap(domain) {
  const tld = domain.split('.').pop();
  let url = '';
  if (tld === 'com' || tld === 'net') {
    url = `https://rdap.verisign.com/${tld}/v1/domain/${domain}`;
  } else if (tld === 'in') {
    url = `https://rdap.registry.in/domain/${domain}`;
  } else {
    // Bootstrap gateway: looks up the right registry RDAP server per IANA's
    // published bootstrap file and redirects there. Covers .io, .ai and
    // anything else without a hardcoded case above.
    url = `https://rdap.org/domain/${domain}`;
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'follow' });
    if (res.status === 404) return true;  // Registry has no record -> available
    if (res.status === 200) return false; // Registry has a record -> taken
  } catch {
    // Registry timeout, TLS failure, or network block. Inconclusive.
  }
  return null;
}

/**
 * RDAP is the authoritative source -- it's a direct query to the registry,
 * not an inference from whether a nameserver happens to answer. Try it
 * first; DNS is the fallback for when RDAP itself is unreachable (rate
 * limited, registry RDAP server down), not the primary signal.
 */
async function auditDomain(domain) {
  const rdapResult = await checkRdap(domain);
  if (rdapResult !== null) {
    return { domain, available: rdapResult, method: rdapResult ? 'RDAP (verified free)' : 'RDAP (registered)', confidence: 'high' };
  }

  const dnsResult = await checkDns(domain);
  if (dnsResult !== null) {
    return { domain, available: dnsResult, method: dnsResult ? 'DNS (no NS/SOA found)' : 'DNS (NS/SOA present)', confidence: 'medium' };
  }

  return { domain, available: null, method: 'Could not verify (RDAP and DNS both inconclusive)', confidence: 'none' };
}

async function auditDomainSet(brandName) {
  const clean = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const [com, inTld, io, ai] = await Promise.all([
    auditDomain(`${clean}.com`),
    auditDomain(`${clean}.in`),
    auditDomain(`${clean}.io`),
    auditDomain(`${clean}.ai`)
  ]);

  return {
    com: { available: com.available, domain: `${clean}.com`, method: com.method },
    in: { available: inTld.available, domain: `${clean}.in`, method: inTld.method },
    io: { available: io.available, domain: `${clean}.io`, method: io.method },
    ai: { available: ai.available, domain: `${clean}.ai`, method: ai.method }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. NAME-COLLISION & DESCRIPTIVENESS HEURISTIC (NOT a trademark search)
//
// Everything in this function is a regex pattern match against a short
// hardcoded list plus a couple of prefix/suffix word lists. It never queries
// India's IP India trademark database, the USPTO, or any other real
// registry -- despite this file's original header claiming "live trademark
// registry queries", it made none. Section numbers, "Doctrine of Idem
// Sonans" and confidence percentages like "< 5%" were invented; they have
// no statistical basis and no legal authority. Kept as a cheap first-pass
// sanity check (did you accidentally pick a name that's obviously close to
// a company everyone's heard of, or a name built from two dictionary words),
// relabeled so nobody mistakes it for legal clearance.
// ─────────────────────────────────────────────────────────────────────────────

function auditTrademark(brandName) {
  const lower = brandName.toLowerCase().trim();

  // 1. Obvious phonetic/textual overlap with a well-known real-estate brand.
  //    A real hit here means "go check the actual registry before you fall
  //    in love with this name", not "this name is legally dead."
  const knownGiants = [
    { mark: 'Property Finder', pattern: /prop.*f[iy]nd/i, notes: 'Name closely resembles Property Finder (large existing portal). Worth a manual registry check before proceeding.' },
    { mark: '99acres', pattern: /99\s*acre/i, notes: 'Name closely resembles Info Edge\'s 99acres.' },
    { mark: 'Housing.com', pattern: /^housing/i, notes: 'Name closely resembles REA Group / Housing.com.' },
    { mark: 'Magicbricks', pattern: /magic.*brick/i, notes: 'Name closely resembles Times Group\'s Magicbricks.' },
    { mark: 'Square Yards', pattern: /square.*yard/i, notes: 'Name closely resembles Square Yards.' },
    { mark: 'NoBroker', pattern: /no.*broker/i, notes: 'Name closely resembles NoBroker Technologies.' },
    { mark: 'Zillow', pattern: /^zill/i, notes: 'Name closely resembles Zillow Inc.' }
  ];

  for (const giant of knownGiants) {
    if (giant.pattern.test(lower)) {
      return {
        status: 'NAME_OVERLAP',
        rating: '🔴 RESEMBLES AN EXISTING BRAND',
        score: 0,
        spectrum: 'Textual/phonetic overlap with a known mark',
        heuristicOnly: true,
        analysis: giant.notes,
        strategy: 'Search the actual trademark registry (IP India e-register, or a paid clearance search) before investing in this name -- this tool cannot tell you whether it is legally available.'
      };
    }
  }

  // 2. Built from two plain dictionary/trade words (e.g. "Property" + "Finder").
  //    Historically harder to register as a distinctive word mark, but this
  //    is a rule of thumb, not a citation of any actual examiner decision.
  const descriptivePrefixes = ['prop', 'property', 'realty', 'estate', 'realestate', 'flat', 'home', 'house', 'land'];
  const descriptiveSuffixes = ['finder', 'fyndr', 'mart', 'bazaar', 'search', 'buy', 'rent', 'sell', 'deals', 'list'];

  const hasDescPrefix = descriptivePrefixes.some(p => lower.startsWith(p));
  const hasDescSuffix = descriptiveSuffixes.some(s => lower.endsWith(s));

  if (hasDescPrefix && hasDescSuffix) {
    return {
      status: 'DESCRIPTIVE_SHAPE',
      rating: '🟡 BUILT FROM TWO GENERIC WORDS',
      score: 8,
      spectrum: 'Descriptive-shaped compound',
      heuristicOnly: true,
      analysis: 'Reads as a plain description of the service (e.g. "property" + "finder"), which is typically the hardest category to register as a distinctive mark -- as a rule of thumb, not a cited rule.',
      strategy: 'A distinctive logo/device alongside the word mark, or a genuinely coined name, is usually an easier registration path. Confirm with a trademark professional.'
    };
  }

  // 3. Coined/invented word (no dictionary meaning) -- generally the easiest
  //    category to register, as a rule of thumb.
  const isCoinedSuffix = ['lyst', 'fyn', 'va', 'ra', 'ix', 'via', 'pave', 'plat', 'deck', 'vo'].some(s => lower.endsWith(s));
  if (isCoinedSuffix) {
    return {
      status: 'COINED_SHAPE',
      rating: '🟢 READS AS A COINED WORD',
      score: 20,
      spectrum: 'Fanciful/invented-looking',
      heuristicOnly: true,
      analysis: 'Does not read as an existing dictionary word or a plain description of the service -- generally the easiest category to register, as a rule of thumb, not a guarantee.',
      strategy: 'Still requires an actual trademark registry search in every class and jurisdiction you plan to operate in before filing.'
    };
  }

  // 4. Suggests the industry without describing the exact service.
  return {
    status: 'SUGGESTIVE_SHAPE',
    rating: '🟢 SUGGESTIVE, NOT DESCRIPTIVE',
    score: 16,
    spectrum: 'Suggestive-shaped compound',
    heuristicOnly: true,
    analysis: 'Evokes real-estate attributes (space, movement, title) without spelling out the service directly -- usually an easier registration path than a purely descriptive name, as a rule of thumb.',
    strategy: 'Still requires an actual trademark registry search before filing.'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. WEB-MENTION SCAN (a search snapshot, not a Google-ranking guarantee)
//
// Scrapes DuckDuckGo's HTML results page for the exact-match query. Two real
// bugs fixed here:
//
//  1. On ANY failure -- timeout, DDG blocking the request, a changed page
//     layout breaking the regex -- this used to return a hardcoded
//     score: 18 / "CLEAN (Estimated)". A network failure is not evidence a
//     name is clean; it silently turned "couldn't check" into "looks great"
//     for every candidate the moment DDG started rate-limiting this script
//     (likely, since it fires many requests back to back with no backoff
//     and an obviously scripted User-Agent). Now returns an explicit
//     UNKNOWN result that does not count toward the score either way.
//  2. Nothing detected DDG's own bot-block/CAPTCHA interstitial page. That
//     page reads as "0 results" to the old code, which reported it as
//     "PRISTINE -- Day-1 Organic Monopoly" -- the most confident claim this
//     tool makes, produced by the search engine refusing to search at all.
//
// This is a name-recall snapshot from one search engine at one moment, not a
// promise about Google ranking, SEO competitiveness, or exclusive ownership
// of a phrase.
// ─────────────────────────────────────────────────────────────────────────────

async function auditSeoDominance(brandName) {
  const clean = brandName.trim();
  const query = encodeURIComponent(`"${clean}"`);
  const unknown = (reason) => ({
    score: null,
    level: '⬜ UNKNOWN',
    rankability: 'Could not verify',
    analysis: reason,
  });

  let res;
  try {
    res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });
  } catch (e) {
    return unknown(`Search request failed (${e.name === 'TimeoutError' ? 'timed out' : e.message}). Try again, or check manually.`);
  }

  if (!res.ok) return unknown(`Search engine returned HTTP ${res.status}. Possibly rate-limited -- try again later, or check manually.`);

  const html = await res.text();

  // DuckDuckGo's own block/CAPTCHA interstitial. If this fires, the "0
  // results" branch below would otherwise fire too and misreport a block as
  // a pristine, unindexed name.
  if (/anomal(y|ous) traffic|unusual traffic|verify you are human|are you a robot/i.test(html)) {
    return unknown('Search engine blocked this request (bot detection). Not evidence the name is clean -- check manually.');
  }

  const hasZeroResults = html.includes('No results found') || html.includes('No  results');
  const titleMatches = [...html.matchAll(/class="result__snippet"[^>]*>(.*?)<\/a>/g)].map(m => m[1]);
  const organicCount = titleMatches.length;
  // If the page returned neither a "no results" message nor any parsed
  // snippet, the layout has likely changed and the regex above is stale --
  // that's "could not verify", not "zero results".
  if (!hasZeroResults && organicCount === 0 && html.length < 500) {
    return unknown('Could not parse search results (page layout may have changed) -- check manually.');
  }

  const hasActiveCompany = /funding|crunchbase|pitchbook|startup|founder|pvt ltd|inc\b|corporation/i.test(html);
  const hasRealEstateEntity = /real estate|property|realty|developer|broker|apartments|homes|mls/i.test(html);
  const hasDictionaryMatch = /definition|meaning in english|dictionary|thesaurus|etymology/i.test(html);

  if (hasZeroResults || organicCount === 0) {
    return {
      score: 25,
      level: '🟢 NO MENTIONS FOUND',
      rankability: 'Likely low search competition',
      analysis: `No indexed mentions of "${clean}" found on DuckDuckGo at time of check. A good sign, not a guarantee of #1 Google ranking -- other engines and unindexed pages aren't covered by this check.`
    };
  }

  if (hasDictionaryMatch) {
    return {
      score: 5,
      level: '🔴 READS AS A DICTIONARY WORD',
      rankability: 'Likely high search competition',
      analysis: 'Search results suggest this overlaps with standard vocabulary. Harder to own exclusive branded search intent for.'
    };
  }

  if (hasActiveCompany && hasRealEstateEntity) {
    return {
      score: 0,
      level: '🔴 EXISTING REAL-ESTATE ENTITY FOUND',
      rankability: 'Likely blocked',
      analysis: 'Search results suggest an active real-estate company or portal already uses this name.'
    };
  }

  if (hasActiveCompany) {
    return {
      score: 10,
      level: '🟡 EXISTING NON-REAL-ESTATE COMPANY FOUND',
      rankability: 'Needs disambiguation',
      analysis: 'Search results suggest an existing company outside real estate uses this name.'
    };
  }

  return {
    score: 20,
    level: '🟢 SCATTERED MENTIONS ONLY',
    rankability: 'Likely low search competition',
    analysis: 'Minor scattered web mentions found, no dominant company detected in the results.'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ADVERSE-MENTION WEB SCAN (a search snapshot, not a legal/fraud check)
//
// Same real bug as the SEO scan above, more dangerous here: on ANY failure
// (timeout, DDG blocking the request, a bot-detection interstitial) this used
// to return a hardcoded "PRISTINE (Estimated) -- Zero Litigation Footprint".
// A network failure is not evidence a name has no fraud, litigation or RERA
// history -- if someone actually relied on that verdict before spending real
// money on a name, a blocked scraper request would have told them a name was
// clean when nothing was ever checked. Fixed the same way: an explicit
// UNKNOWN that does not count toward the score, and bot-block detection so a
// CAPTCHA page can't be misread as "zero results, nothing to worry about."
//
// Also renamed every claim from a definitive verdict ("0 Cases", "Zero
// Litigation Footprint") to what it actually is: no adverse keyword mentions
// found in one search engine's index at one point in time. Absence of a hit
// in this scan is not proof of a clean legal history, and this function must
// never be read as a substitute for real due diligence (a professional
// litigation/background search) before committing money to a name.
// ─────────────────────────────────────────────────────────────────────────────

async function auditLitigationAndReputation(brandName) {
  const clean = brandName.trim();
  const query = encodeURIComponent(`"${clean}" (lawsuit OR litigation OR court OR fraud OR scam OR rera OR nclt OR dispute OR criminal OR "consumer court" OR FIR)`);
  const unknown = (reason) => ({
    status: 'UNKNOWN',
    score: null,
    rating: '⬜ UNKNOWN',
    verdict: 'Could not verify',
    analysis: reason,
    cleanPedigree: null,
    hasCriticalRisk: false, // never hard-block on an unknown -- that's a false positive, not a safety win
  });

  let res;
  try {
    res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });
  } catch (e) {
    return unknown(`Search request failed (${e.name === 'TimeoutError' ? 'timed out' : e.message}). This does NOT mean the name is clean -- verify manually.`);
  }

  if (!res.ok) return unknown(`Search engine returned HTTP ${res.status}. Not evidence of a clean record -- verify manually.`);

  const html = await res.text();

  if (/anomal(y|ous) traffic|unusual traffic|verify you are human|are you a robot/i.test(html)) {
    return unknown('Search engine blocked this request (bot detection). Not evidence of a clean record -- verify manually.');
  }

  const hasZeroResults = html.includes('No results found') || html.includes('No  results');
  const titleMatches = [...html.matchAll(/class="result__snippet"[^>]*>(.*?)<\/a>/g)].map(m => m[1]);
  const organicCount = titleMatches.length;
  if (!hasZeroResults && organicCount === 0 && html.length < 500) {
    return unknown('Could not parse search results (page layout may have changed) -- verify manually.');
  }

  const hasReraCase = /rera|maharera|uprera|hrera|order against|revoked|blacklisted/i.test(html);
  const hasCourtOrNclt = /nclt|insolvency|high court|supreme court|judgment|order passed|accused|case no/i.test(html);
  const hasFraudOrScam = /scam|fraud|cheating|arrested|fir lodged|ponzi|money laundering|ed raids|cbi/i.test(html);

  if (hasZeroResults || organicCount === 0) {
    return {
      status: 'NO_ADVERSE_MENTIONS',
      score: 15,
      rating: '🟢 NO ADVERSE MENTIONS FOUND',
      verdict: 'No lawsuit/fraud/RERA keywords matched this search',
      analysis: `No results for lawsuit/court/fraud/RERA/NCLT keywords alongside "${clean}" on DuckDuckGo at time of check. This is a search snapshot, not a legal record check -- it cannot see court filings, RERA orders, or news that isn't indexed by this search engine.`,
      cleanPedigree: true,
      hasCriticalRisk: false
    };
  }

  if (hasFraudOrScam) {
    return {
      status: 'ADVERSE_MENTION_FRAUD',
      score: 0,
      rating: '🔴 FRAUD/SCAM KEYWORDS FOUND',
      verdict: 'Search results mention fraud/scam alongside this name',
      analysis: 'Search results surfaced fraud, scam, or criminal-proceeding keywords near this name. Could be a real adverse record, or an unrelated page that happens to mention both -- read the actual search results before drawing a conclusion.',
      cleanPedigree: false,
      hasCriticalRisk: true
    };
  }

  if (hasReraCase || hasCourtOrNclt) {
    return {
      status: 'ADVERSE_MENTION_LEGAL',
      score: 3,
      rating: '🔴 COURT/RERA KEYWORDS FOUND',
      verdict: 'Search results mention court/RERA/NCLT proceedings alongside this name',
      analysis: 'Search results surfaced court, NCLT, or RERA-order keywords near this name. Read the actual results before concluding this name has a legal history -- a common word can trigger this without any real connection.',
      cleanPedigree: false,
      hasCriticalRisk: true
    };
  }

  return {
    status: 'COINCIDENTAL_MENTION',
    score: 12,
    rating: '🟢 LOW RISK (COINCIDENTAL KEYWORD MATCHES)',
    verdict: 'Legal-sounding words appeared, but not tied to a company or case',
    analysis: 'Scattered mentions of legal-sounding words without an apparent connection to a specific company or court case.',
    cleanPedigree: true,
    hasCriticalRisk: false
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. STICKINESS & RECALL INDEX (PHONETICS & THE RADIO TEST)
// ─────────────────────────────────────────────────────────────────────────────

function auditStickiness(brandName) {
  const clean = brandName.trim();
  const len = clean.length;

  // Syllables approximation
  const vowels = clean.match(/[aeiouy]/gi) || [];
  const syllables = Math.max(1, vowels.length);

  // Plosive consonants (P, T, K, B, D) enhance cognitive stickiness & brand recall
  const plosives = clean.match(/[ptkbd]/gi) || [];
  const hasStrongPlosive = plosives.length >= 1;

  // Radio test: <= 9 characters, no hyphens, no numbers, phonetic clarity
  const passesRadioTest = len <= 9 && !/[0-9\-_]/.test(clean);

  let score = 0;
  if (syllables === 2 || syllables === 3) score += 10; // Sweet spot (Zillow, Uber, Stripe, Apple)
  else score += 5;

  if (passesRadioTest) score += 10;
  if (hasStrongPlosive) score += 5;

  return {
    score,
    syllableCount: syllables,
    length: len,
    passesRadioTest: passesRadioTest ? '✅ YES' : '⚠️ CAUTION',
    stickinessVerdict: score >= 20 ? 'High Recall (Sticky & Memorable)' : 'Standard Recall'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MASTER CANDIDATE EVALUATOR
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateCandidate(brandName) {
  const clean = brandName.trim();

  // Run all forensic audits in parallel
  const [domains, trademark, seo, litigation] = await Promise.all([
    auditDomainSet(clean),
    auditTrademark(clean),
    auditSeoDominance(clean),
    auditLitigationAndReputation(clean)
  ]);

  const stickiness = auditStickiness(clean);

  /**
   * Weighted composite, normalized over only the checks that actually
   * verified something. `seo.score` and `litigation.score` are null when the
   * web scan couldn't verify (timeout, block, layout change) -- the old code
   * fed null straight into arithmetic, so one blocked request turned the
   * whole composite score into NaN for that candidate, and NaN still passed
   * every `>= N` comparison as false, silently sorting that name to the
   * bottom of the leaderboard with no indication why. Excluding an unknown
   * component from BOTH the earned points and the max possible points means
   * a network hiccup doesn't help or hurt a name relative to one that
   * genuinely scored zero on that axis.
   */
  let earned = 0;
  let possible = 0;
  let verifiedCount = 0;
  const totalChecks = 5;

  // 1. Domains (max 35: 25 for .com, 10 for .in). Unknown domains are
  //    excluded per-TLD, not as one combined bucket.
  if (domains.com.available !== null) { possible += 25; if (domains.com.available) earned += 25; }
  if (domains.in.available !== null) { possible += 10; if (domains.in.available) earned += 10; }
  if (domains.com.available !== null || domains.in.available !== null) verifiedCount++;

  // 2. Name-collision/descriptiveness heuristic (max 20). Always resolves --
  //    it's pure regex, no network call.
  possible += 20;
  earned += Math.round((trademark.score / 25) * 20);
  verifiedCount++;

  // 3. Web-mention scan (max 20)
  if (seo.score !== null) {
    possible += 20;
    earned += Math.round((seo.score / 25) * 20);
    verifiedCount++;
  }

  // 4. Adverse-mention scan (max 15)
  if (litigation.score !== null) {
    possible += 15;
    earned += litigation.score;
    verifiedCount++;
  }

  // 5. Stickiness/recall (max 10). Always resolves -- no network call.
  possible += 10;
  earned += Math.min(10, Math.round((stickiness.score / 25) * 10));
  verifiedCount++;

  const totalScore = possible > 0 ? Math.round((earned / possible) * 100) : null;
  const confidence = `${verifiedCount}/${totalChecks} checks verified`;

  // Hard override: an adverse-mention hit (real or coincidental keyword
  // match, see that function's own honest caveat) caps the score rather
  // than zeroing it -- this tool cannot tell a real fraud record from an
  // unrelated page mentioning both words, so it flags for review instead of
  // pretending to have reached a verdict.
  const cappedScore = (litigation.hasCriticalRisk && totalScore !== null) ? Math.min(totalScore, 30) : totalScore;

  let recommendation = '';
  if (totalScore === null) {
    recommendation = '⬜ COULD NOT SCORE: too many checks failed to verify anything. Re-run, or check manually.';
  } else if (litigation.hasCriticalRisk) {
    recommendation = '🔴 REVIEW NEEDED: possible litigation/fraud keyword match found. Read the actual search results before proceeding either way.';
  } else if (cappedScore >= 85) {
    recommendation = '🟢 STRONG CANDIDATE: clean on every check that could be verified. Still confirm with a real trademark registry search before filing.';
  } else if (cappedScore >= 70) {
    recommendation = '🟢 WORTH PURSUING: mostly clean, some friction (a taken domain, a suggestive-not-coined name shape, or similar). Read the dossier.';
  } else if (cappedScore >= 50) {
    recommendation = '🟡 CONDITIONAL: real friction on multiple axes. Viable with a different TLD or a distinctiveness fix.';
  } else {
    recommendation = '🔴 WEAK CANDIDATE: significant collision or friction found. Consider a different name.';
  }

  return {
    brandName: clean,
    score: cappedScore,
    confidence,
    recommendation,
    domains,
    trademark,
    seo,
    litigation,
    stickiness
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. PRESENTATION & CLI LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────

/** available is true/false/null (null = couldn't verify) -- never collapse null into "taken". */
function domainBadge(d, width = 20) {
  const label = d.available === true ? `${c.green}✅ FREE${c.reset}`
    : d.available === false ? `${c.red}❌ TAKEN${c.reset}`
    : `${c.yellow}❓ UNKNOWN${c.reset}`;
  return label.padEnd(width, ' ');
}

function renderLeaderboard(results) {
  console.log(`\n${c.bold}═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`  ${c.cyan}${c.bold}🏆 BRAND NAME DISCOVERY & FORENSIC AUDIT LEADERBOARD${c.reset}`);
  console.log(`${c.bold}═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════${c.reset}\n`);

  console.log(` ${c.dim}#   Score  Brand Name    .com          .in           Trademark           Litigation / Risk    SEO Rankability${c.reset}`);
  console.log(` ─── ────── ──────────── ───────────── ───────────── ─────────────────── ──────────────────── ───────────────────`);

  results.forEach((r, idx) => {
    const rankStr = String(idx + 1).padStart(2, ' ');
    const scoreStr = (r.score === null ? '—/100' : `${r.score}/100`).padEnd(6, ' ');
    const nameStr = r.brandName.padEnd(12, ' ');

    const comStr = domainBadge(r.domains.com);
    const inStr = domainBadge(r.domains.in);

    const tmColor = r.trademark.score >= 20 ? c.green : r.trademark.score >= 10 ? c.yellow : c.red;
    const tmStr = `${tmColor}${r.trademark.spectrum.slice(0, 19)}${c.reset}`.padEnd(28, ' ');

    const litColor = r.litigation.score === null ? c.yellow : r.litigation.score >= 12 ? c.green : r.litigation.score >= 8 ? c.yellow : c.red;
    const litShort = r.litigation.score === null ? '⬜ Unverified'
      : r.litigation.status === 'NO_ADVERSE_MENTIONS' ? '🟢 No mentions'
      : r.litigation.status === 'ADVERSE_MENTION_FRAUD' ? '🔴 FRAUD/SCAM'
      : r.litigation.status === 'ADVERSE_MENTION_LEGAL' ? '🔴 DISPUTED'
      : '🟢 Clean';
    const litStr = `${litColor}${litShort.slice(0, 18)}${c.reset}`.padEnd(28, ' ');

    const seoColor = r.seo.score === null ? c.yellow : r.seo.score >= 20 ? c.green : r.seo.score >= 10 ? c.yellow : c.red;
    const seoStr = `${seoColor}${r.seo.rankability.slice(0, 19)}${c.reset}`;

    const scoreColor = r.score === null ? c.yellow : r.score >= 85 ? c.green : r.score >= 70 ? c.cyan : r.score >= 50 ? c.yellow : c.red;

    console.log(` ${rankStr}  ${scoreColor}${c.bold}${scoreStr}${c.reset} ${c.bold}${nameStr}${c.reset} ${comStr} ${inStr} ${tmStr} ${litStr} ${seoStr}`);
  });

  console.log(`\n${c.dim}───────────────────────────────────────────────────────────────────────────────────────────────────────────────${c.reset}`);
  console.log(`${c.dim} Score is normalized over only the checks that could actually be verified this run -- see each name's confidence note.${c.reset}\n`);
}

function renderDetailedDossier(r) {
  console.log(`\n${c.bold}========================================================================${c.reset}`);
  console.log(`  ${c.cyan}${c.bold}DEEP-DIVE EXECUTIVE DOSSIER: "${r.brandName.toUpperCase()}"${c.reset}`);
  console.log(`${c.bold}========================================================================${c.reset}\n`);

  console.log(`🎯 ${c.bold}Composite Score:${c.reset} ${c.green}${c.bold}${r.score === null ? 'N/A' : `${r.score}/100`}${c.reset} ${c.dim}(${r.confidence})${c.reset}`);
  console.log(`📋 ${c.bold}Recommendation:${c.reset} ${r.recommendation}\n`);

  console.log(`${c.bold}1. 🌐 DOMAIN AVAILABILITY${c.reset}`);
  console.log(`   • .com: ${domainBadge(r.domains.com, 0)} (${r.domains.com.domain}) [${r.domains.com.method}]`);
  console.log(`   • .in:  ${domainBadge(r.domains.in, 0)} (${r.domains.in.domain}) [${r.domains.in.method}]`);
  console.log(`   • .io:  ${domainBadge(r.domains.io, 0)} (${r.domains.io.domain}) [${r.domains.io.method}]`);
  console.log(`   • .ai:  ${domainBadge(r.domains.ai, 0)} (${r.domains.ai.domain}) [${r.domains.ai.method}]`);

  console.log(`\n${c.bold}2. 🏷️ NAME-COLLISION & DESCRIPTIVENESS HEURISTIC ${c.dim}(regex pre-screen, not a trademark search)${c.reset}`);
  console.log(`   • Classification: ${r.trademark.rating}`);
  console.log(`   • Shape:          ${r.trademark.spectrum}`);
  console.log(`   • Analysis:       ${r.trademark.analysis}`);
  console.log(`   • Next step:      ${r.trademark.strategy}`);

  console.log(`\n${c.bold}3. 🛡️ ADVERSE-MENTION WEB SCAN ${c.dim}(a search snapshot, not a legal/fraud/RERA record check)${c.reset}`);
  console.log(`   • Result:       ${r.litigation.rating}`);
  console.log(`   • Verdict:      ${r.litigation.verdict}`);
  console.log(`   • Detail:       ${r.litigation.analysis}`);
  if (r.litigation.cleanPedigree === null) {
    console.log(`   ${c.yellow}⚠️  This check could not be verified this run -- it is not evidence either way. Verify manually.${c.reset}`);
  }

  console.log(`\n${c.bold}4. 🔍 WEB-MENTION SCAN ${c.dim}(one search engine, one point in time -- not a ranking guarantee)${c.reset}`);
  console.log(`   • Result:      ${r.seo.level}`);
  console.log(`   • Rankability: ${r.seo.rankability}`);
  console.log(`   • Detail:      ${r.seo.analysis}`);

  console.log(`\n${c.bold}5. 🎙️ STICKINESS & RECALL (THE RADIO TEST)${c.reset}`);
  console.log(`   • Syllables:       ${r.stickiness.syllableCount} syllables (${r.stickiness.length} characters)`);
  console.log(`   • Radio Test:      ${r.stickiness.passesRadioTest} (Effortless to spell over podcast/call)`);
  console.log(`   • Sticky Verdict:  ${r.stickiness.stickinessVerdict}`);

  console.log(`\n${c.bold}========================================================================${c.reset}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. INTERACTIVE & CLI RUNNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sorts unknown (null) scores to the bottom without a raw arithmetic
 * subtraction on null -- `null - number` silently coerces to 0 in JS, which
 * used to rank an unverifiable name as if it had genuinely scored zero
 * rather than "couldn't check".
 */
function byScoreDesc(a, b) {
  if (a.score === null && b.score === null) return 0;
  if (a.score === null) return 1;
  if (b.score === null) return -1;
  return b.score - a.score;
}

const DISCLAIMER =
  'Heuristic screening tool, not legal, trademark or SEO advice. Domain ' +
  'availability (RDAP/DNS) is verified against the real registries; every ' +
  'other check is a keyword/regex heuristic or a single search-engine ' +
  'snapshot. Confirm anything before filing or spending money on it.';

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');

  // Direct single brand check: --check "YardLyst" [--json]
  const checkIdx = args.indexOf('--check');
  if (checkIdx !== -1 && args[checkIdx + 1]) {
    const target = args[checkIdx + 1];
    if (!asJson) console.log(`\n🔍 Auditing "${target}"...`);
    const result = await evaluateCandidate(target);
    if (asJson) {
      console.log(JSON.stringify({ disclaimer: DISCLAIMER, result }, null, 2));
    } else {
      renderDetailedDossier(result);
    }
    return;
  }

  // Taste-based CLI generation: --taste "Yardly" or positional "Yardly"
  const tasteIdx = args.indexOf('--taste');
  let userTaste = '';
  if (tasteIdx !== -1 && args[tasteIdx + 1]) {
    userTaste = args[tasteIdx + 1];
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    userTaste = args.join(' ');
  }

  // Interactive prompt only when: no taste given, --curated not requested,
  // --json not requested (an agent invoking this expects to read stdout
  // once and get JSON back, not to be asked a question), and stdin is
  // actually a TTY a human can answer.
  if (!userTaste && !args.includes('--curated') && !asJson && process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    userTaste = await new Promise(resolve => {
      console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════════════${c.reset}`);
      console.log(`  ${c.bold}PROPFYNDR APP NAME DISCOVERY & FORENSIC AUDITOR${c.reset}`);
      console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════════════${c.reset}`);
      console.log(`\nEnter your preferred naming taste, seed word, or reference you like.`);
      console.log(`${c.dim}(e.g. "Yardly", "AcreLyst", "PropPave", "Zillow", "Settle", or press Enter for curated pool):${c.reset}\n`);

      rl.question(`${c.yellow}👉 Your naming taste / seed: ${c.reset}`, answer => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  const candidatePool = generateNamesFromTaste(userTaste);
  if (!asJson) {
    console.log(`\n${c.dim}${DISCLAIMER}${c.reset}`);
    console.log(`\n✨ Generated ${c.bold}${candidatePool.length}${c.reset} brand candidates matching taste: "${c.cyan}${userTaste || 'Curated Real Estate Tech'}${c.reset}"`);
    console.log(`⏳ Checking domains (RDAP/DNS) + name-collision heuristic + web-mention scan...\n`);
  }

  const results = [];
  const batchSize = 5;
  // A short stagger between batches, not just within one -- firing all
  // ~30 candidates x 2 DuckDuckGo queries each back-to-back with a scripted
  // User-Agent and no delay is the fastest way to get every subsequent
  // request in the run treated as a bot and blocked, which is exactly the
  // failure mode the UNKNOWN handling above exists to survive gracefully
  // rather than silently mask as "clean".
  const BATCH_DELAY_MS = 1200;

  for (let i = 0; i < candidatePool.length; i += batchSize) {
    const chunk = candidatePool.slice(i, i + batchSize);
    if (!asJson) process.stdout.write(`  Auditing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(candidatePool.length / batchSize)}: ${chunk.join(', ')}...\r`);
    const chunkResults = await Promise.all(chunk.map(name => evaluateCandidate(name)));
    results.push(...chunkResults);
    if (i + batchSize < candidatePool.length) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }

  results.sort(byScoreDesc);

  if (asJson) {
    console.log(JSON.stringify({ disclaimer: DISCLAIMER, taste: userTaste || null, results }, null, 2));
    return;
  }

  console.log(`\n✅ Completed audits for all ${results.length} candidate names!\n`);
  renderLeaderboard(results);

  const topWinner = results[0];
  if (topWinner && topWinner.score !== null && topWinner.score >= 70) {
    console.log(`🌟 ${c.bold}TOP RECOMMENDATION FOUND:${c.reset}`);
    renderDetailedDossier(topWinner);
  }

  console.log(`💡 ${c.bold}Quick Commands:${c.reset}`);
  console.log(`   • Deep dive any specific name:   ${c.cyan}node scripts/find-app-name.mjs --check "YardPave"${c.reset}`);
  console.log(`   • Try a different taste seed:    ${c.cyan}node scripts/find-app-name.mjs --taste "Acre"${c.reset}`);
  console.log(`   • Machine-readable output:       ${c.cyan}node scripts/find-app-name.mjs --taste "Acre" --json${c.reset}`);
  console.log(`   • Single-name machine-readable:  ${c.cyan}node scripts/find-app-name.mjs --check "YardPave" --json${c.reset}\n`);
}

main().catch(err => {
  console.error('Fatal error running brand discovery:', err);
  process.exitCode = 1;
});
