// Stage 12: possession bundle (status + label + date together) from builder and portal pages. Dev DB read only.
// The three columns are coupled, so they are proposed together or not at all. A proposal needs a builder-site quote or
// two agreeing sources; a single portal line stays a draft. Past dates are skipped: "possession May 2024" does not say
// whether the project was delivered or delayed.
// Run: npx tsx scripts/data-integrity/12-possession.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { assertDevDb, pageIsAbout, readJson, writeJson, workPath } from './lib';
import { readdirSync } from 'fs';

assertDevDb();
const prisma = new PrismaClient();
const TODAY = new Date('2026-10-28T00:00:00Z');
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const LABEL_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const READY = /ready\s*to\s*move|ready\s*for\s*possession|possession\s*(given|offered\s*now)|already\s*delivered|fully\s*delivered|\bdelivered\b|\bcompleted\b/i;

/** "Dec'26", "September 2029", "May, 2024", "Q4 2027" -> "YYYY-MM"; year-only and anything vague -> null. */
function parseMonth(text: string): string | null {
  const q = /\bQ([1-4])\s*[-']?\s*((?:20)?\d{2})\b/i.exec(text);
  if (q) return `${q[2].length === 2 ? '20' + q[2] : q[2]}-${String(+q[1] * 3).padStart(2, '0')}`;
  const m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s,'-]*((?:20)?\d{2})\b/i.exec(text);
  if (m) return `${m[2].length === 2 ? '20' + m[2] : m[2]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, '0')}`;
  return null;
}
const classify = (text: string): string | null => (parseMonth(text) ?? (READY.test(text) ? 'READY' : null));

async function main() {
  const projects = await prisma.project.findMany({
    where: { archived_duplicate_of: null },
    select: { id: true, name: true, status: true, possession_label: true, possession_date: true },
  });
  const byId = new Map(projects.map((p) => [p.id, p]));
  const out: any[] = [];
  const stats: Record<string, number> = { researched: 0, had_candidates: 0, conflict: 0, single_source_draft: 0, past_date_skipped: 0, proposals: 0, status_flips_to_ready: 0, status_flips_to_uc: 0, already_consistent: 0 };

  for (const f of readdirSync(workPath('research'))) {
    const r = readJson<any>(`research/${f}`);
    const p = byId.get(r.project_id);
    if (!p) continue;
    stats.researched++;
    const cands = (r.fields?.possession_label?.candidates ?? [])
      .filter((c: any) => pageIsAbout(c.source_url, p.name, c.quote))
      .map((c: any) => ({ ...c, key: classify(`${c.value} ${c.quote}`) }))
      // Not a seller statement (an artifact of the page text), or a bare date with no possession word around it.
      .filter((c: any) => !/dataset|treated as/i.test(c.quote))
      .filter((c: any) => c.key === 'READY' || /possess|hands?over|completion|deliver|ready|launch/i.test(c.quote))
      .filter((c: any) => c.key);
    if (!cands.length) continue;
    stats.had_candidates++;

    const groups = new Map<string, any[]>();
    for (const c of cands) groups.set(c.key, [...(groups.get(c.key) ?? []), c]);
    const [key, hits] = [...groups].sort((a, b) => b[1].length - a[1].length)[0];
    if (groups.size > 1 && !(hits.length >= 2 && hits.length > cands.length / 2)) { stats.conflict++; continue; }
    const builder = hits.some((h: any) => h.tier === 'builder');
    if (!builder && new Set(hits.map((h: any) => h.source_url)).size < 2) { stats.single_source_draft++; continue; }

    let next: { status: string; label: string; date: string | null } | null = null;
    if (key === 'READY') {
      next = { status: 'ready_to_move', label: 'Ready to Move', date: null }; // the real delivery date is not known: leave the date alone
    } else {
      const [y, m] = key.split('-').map(Number);
      const end = new Date(Date.UTC(y, m, 0)); // last day of that month
      if (end < TODAY) { stats.past_date_skipped++; continue; }
      next = { status: p.status === 'new_launch' ? 'new_launch' : 'under_construction', label: `${LABEL_MON[m - 1]} ${y}`, date: end.toISOString() };
    }
    // Keep an informative label ("Delivered (May 2019)") rather than flatten it to the generic one.
    if (key === 'READY' && p.status === 'ready_to_move' && /ready|deliver|complet|possession/i.test(p.possession_label ?? '')) { stats.already_consistent++; continue; }
    const sameLabel = (p.possession_label ?? '').toLowerCase() === next.label.toLowerCase();
    if (p.status === next.status && sameLabel && (next.date === null || p.possession_date?.toISOString().slice(0, 10) === next.date.slice(0, 10))) { stats.already_consistent++; continue; }

    if (next.status === 'ready_to_move' && p.status !== 'ready_to_move') stats.status_flips_to_ready++;
    if (next.status === 'under_construction' && p.status === 'ready_to_move') stats.status_flips_to_uc++;
    stats.proposals++;
    out.push({
      project_id: p.id, name: p.name,
      old: { status: p.status, label: p.possession_label, date: p.possession_date?.toISOString() ?? null },
      new: next, basis: builder ? 'builder site' : `${hits.length} agreeing pages`,
      evidence: hits.slice(0, 2).map((h: any) => ({ url: h.source_url, quote: h.quote, tier: h.tier })),
    });
  }
  writeJson('possession-proposals.json', { generated_at: new Date().toISOString(), stats, proposals: out });
  console.log(stats);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
