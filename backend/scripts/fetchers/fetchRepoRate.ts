import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// RBI's own press-release pages (BS_PressReleaseDisplay.aspx) are rendered per-notification
// and change markup often. The homepage "Current Rates" widget, however, is a stable, plain
// HTML table (no JS rendering) that RBI keeps up to date whenever the MPC changes the repo
// rate. That widget is what we scrape.
const RBI_HOMEPAGE_URL = 'https://www.rbi.org.in/'

export interface RepoRateResult {
  repoRatePct: number
  effectiveFrom: Date
  sourceUrl: string
  status: 'DRAFT'
}

/**
 * Parses the RBI homepage HTML for the "Policy Repo Rate" row in the Current Rates widget.
 * Returns null (never a guess) if the row isn't found in the shape we expect.
 */
export function parseRbiNotificationHtml(htmlContent: string): RepoRateResult | null {
  const match = htmlContent.match(/Policy Repo Rate[\s\S]{0,200}?(\d{1,2}\.\d{2})\s*%/i)
  if (match) {
    const rate = parseFloat(match[1])
    return {
      repoRatePct: rate,
      effectiveFrom: new Date(),
      sourceUrl: RBI_HOMEPAGE_URL,
      status: 'DRAFT',
    }
  }
  return null
}

export async function fetchRepoRate(isDryRun: boolean = false) {
  console.log(`[FETCHER:RBI] Checking RBI current rates (dryRun=${isDryRun})...`)

  let html: string
  try {
    const res = await fetch(RBI_HOMEPAGE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PropFyndrFetcher/1.0)' },
    })
    if (!res.ok) {
      console.warn(`[FETCHER:RBI] WARNING: RBI site returned HTTP ${res.status}. Skipping — no data written.`)
      return null
    }
    html = await res.text()
  } catch (err) {
    console.warn('[FETCHER:RBI] WARNING: could not reach rbi.org.in. Skipping — no data written.', err)
    return null
  }

  const parsed = parseRbiNotificationHtml(html)

  if (!parsed) {
    // Unverified: if RBI changes the widget's markup (label text, table structure) this regex
    // stops matching. That's by design — we never fall back to a guessed rate. A human should
    // check https://www.rbi.org.in/ manually and update the regex above if this keeps happening.
    console.warn('[FETCHER:RBI] WARNING: "Policy Repo Rate" row not found in expected shape. Skipping — no data written.')
    return null
  }

  console.log(`[FETCHER:RBI] Detected Repo Rate Policy: ${parsed.repoRatePct}%`)

  if (isDryRun) {
    console.log('[FETCHER:RBI] Dry run mode — skipping database writes.')
    console.log(JSON.stringify(parsed, null, 2))
    return parsed
  }

  await prisma.statutoryRate.create({
    data: {
      state_code: 'ALL_INDIA',
      kind: 'repo_rate',
      rate_pct: parsed.repoRatePct,
      condition: { authority: 'RBI' },
      effective_from: parsed.effectiveFrom,
      source_url: parsed.sourceUrl,
      status: 'DRAFT',
    },
  })

  console.log('[FETCHER:RBI] Saved draft statutory rate entry successfully.')
  return parsed
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run')
  fetchRepoRate(isDryRun)
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('[FETCHER:RBI] Fetcher execution failed:', err)
      prisma.$disconnect()
      process.exit(1)
    })
}
