// Stage 25: match our projects to UP-RERA's official "Project(s) under NCLT" list (read 2026-10-28, nclt-list.json). Dev DB read only.
// 1) the project's stored RERA number is on the list; 2) otherwise a near-exact project name (token overlap >= 0.9, no phase/avenue
// contradiction, a single best row). Writes nclt-matches.json. Run: npx tsx scripts/data-integrity/25-nclt-match.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { assertDevDb, idsContradict, normName, readJson, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const tok = (s: string) => new Set(normName(s).split(' ').filter(Boolean));
const jac = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let i = 0; for (const t of a) if (b.has(t)) i++; return i / (a.size + b.size - i); };

async function main() {
  const list = readJson<{ rows: { reg: string; project: string; promoter: string; irp: string; order: string }[] }>('nclt-list.json').rows;
  const byReg = new Map(list.map((r) => [r.reg, r]));
  const projects = await prisma.project.findMany({ where: { archived_duplicate_of: null }, select: { id: true, name: true, rera_number: true } });
  const out: Record<string, any> = {};
  const excluded: string[] = [];
  for (const p of projects) {
    const r = p.rera_number ? byReg.get(p.rera_number.trim()) : undefined;
    if (r) {
      // The number alone is not enough: several stored numbers belong to a sibling project ("Jaypee Kosmos" holds Pavilion Court's).
      const sim = jac(tok(p.name), tok(r.project));
      if (sim >= 0.5 && !idsContradict(p.name, r.project)) out[p.id] = { ...r, how: `stored RERA number is on the list (name similarity ${sim.toFixed(2)})` };
      else excluded.push(`${p.name} vs list "${r.project}" (${sim.toFixed(2)})`);
      continue;
    }
    const mine = tok(p.name);
    const scored = list.map((x) => ({ x, s: jac(mine, tok(x.project)) })).filter((c) => c.s >= 0.9 && !idsContradict(p.name, c.x.project)).sort((a, b) => b.s - a.s);
    if (scored.length === 1 || (scored.length > 1 && scored[0].s > scored[1].s)) out[p.id] = { ...scored[0].x, how: `project name matches (${scored[0].s.toFixed(2)})` };
  }
  writeJson('nclt-matches.json', { read_at: '2026-10-28', source: 'https://up-rera.in/Frm_view_NCLT_Projectlist.aspx', matches: out });
  const v = Object.values(out) as any[];
  console.log({ list_rows: list.length, our_projects_matched: v.length, by_number: v.filter((m) => m.how.startsWith('stored')).length, by_name: v.filter((m) => m.how.startsWith('project name')).length });
  console.log('kept:', v.map((m) => m.project.slice(0, 28)).join(' | ').slice(0, 600));
  console.log('excluded (number on the list, name differs):', excluded.join(' | ').slice(0, 700));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
