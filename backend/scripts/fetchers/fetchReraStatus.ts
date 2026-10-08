import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface ReraStatusResult {
  projectReraNumber: string
  completionPct: number
  quarterLabel: string
  sourceUrl: string
  status: 'DRAFT'
}

// --- Investigation notes (2026-10-08) ---
// There is no single UP-RERA feed of "quarterly report updates" — that was an invented shape.
// up-rera.in is a real ASP.NET WebForms portal. Its registered-projects listing
// (ctl00$ContentPlaceHolder1$lnkRegisteredProjects) is driven by __doPostBack with a
// __VIEWSTATE/__EVENTVALIDATION token pair, not a plain GET. There is also no working
// per-project GET-by-regno detail URL: `ProjectDetails.aspx?regno=...` and
// `frm_project_details.aspx?regno=...` both redirect to /servermaintenance.aspx
// (confirmed by curl — HTTP 302 to an error path, not a project page).
//
// That means per-project lookup by RERA registration number (the realistic shape, pulling
// regnos from Project.rera_number) cannot be done with a simple fetch + regex: it needs a
// stateful ASP.NET postback session (GET the form, scrape __VIEWSTATE, POST it back with the
// target control) and the resulting markup/field names for a single project's progress
// percentage are unverified from here.
//
// Per project instructions: do not fake this. Below, fetchReraStatus takes the RERA numbers
// to look up (callers should pull these from Project.rera_number) and, for each one, logs a
// clear skip — no DB write, no fabricated completion percentage.
//
// What a human needs to confirm before this is trusted:
// 1. Open up-rera.in/project (or the Registered Projects link) in a real browser, use devtools
//    to find the actual request (likely a __doPostBack form submit, possibly an internal API
//    call) that returns a single project's progress/completion data.
// 2. Confirm whether that response is reachable without an authenticated session.
// 3. Only then replace the loop body below with a real fetch + parse per regno.
export function parseReraReportHtml(_htmlContent: string): ReraStatusResult[] {
  // Intentionally not implemented: no verified page shape exists to parse against (see notes
  // above). Kept as a named export so a future implementation can slot in without callers
  // changing.
  return []
}

export async function fetchReraStatus(reraNumbers: string[], isDryRun: boolean = false) {
  console.log(
    `[FETCHER:RERA] Requested lookup for ${reraNumbers.length} RERA registration number(s) (dryRun=${isDryRun})...`,
  )

  if (reraNumbers.length === 0) {
    console.log('[FETCHER:RERA] No RERA numbers supplied — nothing to do.')
    return []
  }

  console.warn(
    '[FETCHER:RERA] WARNING: up-rera.in has no verified, scrapable per-project endpoint from here ' +
      '(registered-projects list requires an ASP.NET __doPostBack/ViewState session; direct ' +
      'ProjectDetails.aspx?regno=... URLs redirect to a server-maintenance error page). ' +
      'Skipping all lookups — no database writes, no fabricated completion data. ' +
      'See the comment at the top of this file for what a human needs to verify next.',
  )
  for (const regno of reraNumbers) {
    console.warn(`[FETCHER:RERA]   skipped: ${regno} (no verified source)`)
  }

  if (isDryRun) {
    console.log('[FETCHER:RERA] Dry run mode — no writes would have occurred anyway.')
  }

  return []
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run')
  const cliRegnos = process.argv.slice(2).filter((a) => !a.startsWith('-'))

  const run = async () => {
    // Real usage: pull RERA numbers from projects that have one, rather than inventing a feed.
    let reraNumbers = cliRegnos
    if (reraNumbers.length === 0) {
      const projects = await prisma.project.findMany({
        where: { rera_number: { not: null } },
        select: { rera_number: true },
        take: 20,
      })
      reraNumbers = projects
        .map((p) => p.rera_number)
        .filter((n): n is string => Boolean(n))
    }
    return fetchReraStatus(reraNumbers, isDryRun)
  }

  run()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('[FETCHER:RERA] Fetcher execution failed:', err)
      prisma.$disconnect()
      process.exit(1)
    })
}
