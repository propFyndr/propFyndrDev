// Stage 1: crawl every public UP-RERA project list into one index. No DB access.
// Run: npx tsx scripts/data-integrity/01-rera-index.ts
import { ReraSession, parseListPage, sleep, writeJson, type ReraRow } from './lib';

const LISTS = [
  'lnkRegisteredProjects',
  'lnkCompletedProjects',
  'lnkNCLTProjects',
  'lnkNCLTProjectsUnderSection',
  'lnkAbeyanceProjects',
  'lnkWithdrawn',
];

async function main() {
  const all: ReraRow[] = [];
  const counts: Record<string, number> = {};

  for (const link of LISTS) {
    // A fresh session per list: each postback replaces the page state.
    const session = new ReraSession();
    try {
      const html = await session.postbackFromHome(link);
      const rows = parseListPage(html, link);
      counts[link] = rows.length;
      all.push(...rows);
      console.log(`${link}: ${rows.length} rows`);
    } catch (e) {
      counts[link] = -1;
      console.error(`${link}: FAILED ${(e as Error).message}`);
    }
    await sleep(3000); // be polite to a public government site
  }

  // The same registration can sit in more than one list (e.g. registered and NCLT).
  const byReg = new Map<string, ReraRow[]>();
  for (const r of all) byReg.set(r.rera_number, [...(byReg.get(r.rera_number) ?? []), r]);

  const path = writeJson('rera-index.json', {
    fetched_at: new Date().toISOString(),
    counts,
    unique_registrations: byReg.size,
    rows: all,
  });
  console.log(`unique registrations: ${byReg.size} -> ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
