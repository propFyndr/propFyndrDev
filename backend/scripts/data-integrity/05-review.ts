// Stage 5: merge RERA evidence + web research, diff against current dev values, write a review file.
// Read-only: nothing is written to any database. Outputs review.csv (for people) and proposals.json (for stage 6).
// Run: npx tsx scripts/data-integrity/05-review.ts
import { PrismaClient } from '@prisma/client';
import { assertDevDb, hasFile, pageIsAbout, readJson, writeJson, workPath } from './lib';
import { readdirSync, writeFileSync } from 'fs';

assertDevDb();
const prisma = new PrismaClient();

const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
const same = (a: unknown, b: unknown) => String(a ?? '').toLowerCase().trim() === String(b ?? '').toLowerCase().trim();

// Researched field -> DB column. Dates stay as written: stage 5 reports, it does not reformat.
const COLUMN = ['total_units', 'total_towers', 'land_area_acres', 'floors', 'possession_label', 'architect', 'price_min_cr'];

export interface Item {
  project_id: string;
  project: string;
  field: string;
  old_value: unknown;
  proposed: unknown;
  status: string; // differs | new | conflict | wrong_project | ambiguous
  tier: 'official' | 'builder' | 'portal';
  source_url: string;
  quote: string;
  candidates?: unknown[];
  needs_review: boolean;
}

async function main() {
  const projects = await prisma.project.findMany({
    where: { archived_duplicate_of: null },
    select: { id: true, name: true, total_units: true, total_towers: true, land_area_acres: true, floors: true, possession_label: true, architect: true, price_min_cr: true },
  });
  const byId = new Map(projects.map((p) => [p.id, p as Record<string, any>]));
  const items: Item[] = [];
  const stats: Record<string, number> = { projects: projects.length, researched: 0, withFields: 0, differs: 0, new: 0, conflict: 0, same: 0, reraCorrections: 0, wrongOwner: 0, ambiguous: 0, noMatch: 0, droppedOffProject: 0 };

  // RERA number corrections (stage 3). A name match is a candidate, so every one needs a person.
  if (hasFile('rera-evidence.json')) {
    for (const p of readJson<{ proposals: any[] }>('rera-evidence.json').proposals) {
      const proj = byId.get(p.project_id);
      if (!proj) continue;
      items.push({ project_id: p.project_id, project: proj.name, field: 'rera_number', old_value: p.old_value, proposed: p.new_value, status: 'differs', tier: 'official', source_url: p.source_url, quote: p.quote, needs_review: true });
      stats.reraCorrections++;
    }
  }

  // Stored numbers that belong to another project, and ambiguous candidates (stage 2)
  for (const m of readJson<{ results: any[] }>('match.json').results) {
    if (m.stored_number_belongs_to) {
      const o = m.stored_number_belongs_to;
      stats.wrongOwner++;
      items.push({ project_id: m.project_id, project: m.name, field: 'rera_number', old_value: m.db_rera, proposed: null, status: 'wrong_project', tier: 'official', source_url: '', quote: `Stored number ${o.rera} belongs to "${o.name}" (${o.promoter}, ${o.district})`, needs_review: true });
    } else if (m.method === 'ambiguous') {
      stats.ambiguous++;
      items.push({ project_id: m.project_id, project: m.name, field: 'rera_number', old_value: m.db_rera, proposed: null, status: 'ambiguous', tier: 'official', source_url: '', quote: '', candidates: m.candidates, needs_review: true });
    } else if (m.method === 'none') stats.noMatch++;
  }

  // Web research (stage 4)
  let files: string[] = [];
  try { files = readdirSync(workPath('research')); } catch { /* stage 4 has not run */ }
  for (const f of files) {
    const r = readJson<any>(`research/${f}`);
    const proj = byId.get(r.project_id);
    if (!proj) continue;
    stats.researched++;
    if (Object.keys(r.fields).length) stats.withFields++;
    for (const [field, raw] of Object.entries<any>(r.fields)) {
      if (!COLUMN.includes(field)) continue;
      // Drop candidates read from a page about a different project (a builder portfolio page, a sibling project).
      const kept = raw.candidates.filter((c: any) => pageIsAbout(c.source_url, proj.name, c.quote));
      stats.droppedOffProject += raw.candidates.length - kept.length;
      if (!kept.length) continue;
      const distinct = new Set(kept.map((c: any) => String(c.value).toLowerCase().trim()));
      const v = { agreed: distinct.size === 1, value: distinct.size === 1 ? kept[0].value : null, candidates: kept };
      const first = v.candidates[0];
      const cur = proj[field];
      const status = !v.agreed ? 'conflict' : cur === null || cur === undefined ? 'new' : same(cur, v.value) ? 'same' : 'differs';
      stats[status]++;
      if (status === 'same') continue;
      // Builder-site facts are the seller's claim and portal figures are advertisements: both need a person.
      items.push({ project_id: r.project_id, project: proj.name, field, old_value: cur, proposed: v.agreed ? v.value : null, status, tier: first.tier, source_url: first.source_url, quote: first.quote, candidates: v.agreed ? undefined : v.candidates, needs_review: true });
    }
  }

  const head = ['project', 'field', 'db_value', 'proposed', 'status', 'source_tier', 'source_url', 'quote'];
  const lines = items.map((i) => [i.project, i.field, i.old_value, i.candidates && i.proposed === null ? i.candidates.map((c: any) => `${c.value ?? c.rera + ' ' + c.name} (${c.source_url ?? c.promoter})`).join(' | ') : i.proposed, i.status, i.tier, i.source_url, i.quote]);
  writeFileSync(workPath('review.csv'), '﻿' + [head, ...lines].map((r) => r.map(csv).join(',')).join('\n'));
  writeJson('proposals.json', { generated_at: new Date().toISOString(), items });
  writeJson('review-summary.json', stats);
  console.log(stats, '->', workPath('review.csv'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
