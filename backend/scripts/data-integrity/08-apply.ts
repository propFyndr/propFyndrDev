// Stage 8: build one plan, apply it to dev, then replay the SAME plan on live.
//   npx tsx scripts/data-integrity/08-apply.ts --dry-run                 build apply-plan.json from dev values, write nothing
//   npx tsx scripts/data-integrity/08-apply.ts --target dev              apply the plan to dev (backup first)
//   npx tsx scripts/data-integrity/08-apply.ts --target live --confirm-live   replay apply-plan.json on Neon (backup first)
// Every write is guarded: a field is written only if the target still holds the value the plan was built from.
// Owner decision 2026-10-28: web-sourced facts may be written to project columns (CLAUDE.md "verified" rule overridden once).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { BASE, assertDevDb, hasFile, idTokens, idsContradict, pageIsAbout, readJson, writeJson, type ReraRow } from './lib';

const arg = (n: string) => process.argv.includes(`--${n}`);
const val = (n: string) => process.argv[process.argv.indexOf(`--${n}`) + 1];
const TARGET = arg('target') ? val('target') : 'dev';
const DRY = arg('dry-run');
// Each batch is its own plan file (default apply-plan.json). A plan is built from dev's CURRENT values, so after a batch is
// applied it no longer shows as a difference: keep every batch's file and replay them on live in order (--plan apply-plan-1.json, then -2).
const PLAN_FILE = arg('plan') ? val('plan') : 'apply-plan.json';
const BACKUP_DIR = process.env.DI_BACKUP_DIR ?? 'C:/Users/Furqan/Desktop/RealtyPals-data-integrity-2026-10-28';
const STAMP = 'di-pipeline 2026-10-28';

if (TARGET === 'live') {
  if (!arg('confirm-live')) throw new Error('live needs --confirm-live');
  if (!process.env.NEON_DB) throw new Error('NEON_DB is not set');
} else if (TARGET === 'dev') assertDevDb();
else throw new Error('--target must be dev or live');

const prisma = TARGET === 'live' ? new PrismaClient({ datasources: { db: { url: process.env.NEON_DB! } } }) : new PrismaClient();

const FACT_FIELDS = ['total_units', 'total_towers', 'land_area_acres', 'floors', 'architect'] as const;
// Left out on purpose, each coupled to columns this pass does not own:
//  - possession_label: coupled to possession_date and status; a label alone would contradict them.
//  - price_min_cr: shown beside price_range_label and the unit price rows; changing only the minimum would
//    contradict both. Price needs label + unit_types rebuilt together from the portal configs (next step).

interface Change { field: string; old: unknown; new: unknown; source: string; url: string; quote: string }
interface Plan {
  project_id: string; name: string; slug: string;
  changes: Change[];
  rera?: { old: string | null; new: string; summary_url: string; how: string; replace_number: boolean; score: number };
}

// Dates compare as ISO strings (a DB Date and the plan's JSON string are the same instant).
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
// A quote about "Sun Court III" is not evidence for a project called "Sun Court": a Roman-numeral phase the project's own name lacks.
const ROMAN = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/;
const foreignPhase = (quote: string, name: string) => { const mine = idTokens(name); return [...idTokens(quote)].some((t) => ROMAN.test(t) && !mine.has(t)); };
const eq = (a: unknown, b: unknown) => (iso(a) ?? null) === (iso(b) ?? null) || String(iso(a) ?? '') === String(iso(b) ?? '');
const DATE_FIELDS = new Set(['rera_valid_until', 'possession_date', 'launch_date']);
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "Feb 2013", "September 2017", "Mar'11" -> "YYYY-MM"; anything vaguer -> null. */
function parseMonthYear(v: string): string | null {
  const m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s,'-]*((?:20)?\d{2})\b/i.exec(v);
  return m ? `${m[2].length === 2 ? '20' + m[2] : m[2]}-${String(MON.indexOf(m[1].toLowerCase()) + 1).padStart(2, '0')}` : null;
}

// ── sanity bounds & normalisation for web facts ─────────────────────────────
function clean(field: string, value: unknown, quote: string): unknown | null {
  const num = Number(String(value).replace(/,/g, ''));
  switch (field) {
    case 'total_units': return Number.isInteger(num) && num >= 20 && num <= 15000 ? num : null;
    case 'total_towers': return Number.isInteger(num) && num >= 1 && num <= 80 ? num : null;
    case 'land_area_acres': return num >= 0.3 && num <= 60 ? num : null; // above that a page is quoting the whole township, not this project
    case 'price_min_cr': return num >= 0.2 && num <= 40 ? num : null;
    case 'floors': {
      if (/floor\s*plan/i.test(quote)) return null; // a heading, not a floor count
      const m = /^G\s*\+\s*(\d{1,2})$/i.exec(String(value).trim());
      return m && +m[1] >= 1 && +m[1] <= 90 ? `G + ${m[1]}` : null; // only the stored "G + N" shape; "47 storeys" is ambiguous
    }
    case 'architect': {
      const s = String(value).trim();
      return s.length >= 3 && s.length <= 60 && !/\d/.test(s) ? s : null;
    }
  }
  return null;
}

/** Agreed value, or a strict majority of the sources; otherwise nothing. */
function pick(cands: any[]): any | null {
  const groups = new Map<string, any[]>();
  for (const c of cands) groups.set(String(c.value).toLowerCase().trim(), [...(groups.get(String(c.value).toLowerCase().trim()) ?? []), c]);
  const best = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  if (!best) return null;
  if (groups.size === 1) return best[0];
  return best.length >= 2 && best.length > cands.length / 2 ? best[0] : null;
}

async function buildPlan(): Promise<Plan[]> {
  const idx = readJson<{ rows: ReraRow[] }>('rera-index.json').rows;
  const byReg = new Map(idx.map((r) => [r.rera_number, r]));
  const match = readJson<{ results: any[] }>('match.json').results;
  const mById = new Map(match.map((m) => [m.project_id, m]));
  const resolved = new Map((hasFile('rera-resolved.json') ? readJson<{ resolved: any[] }>('rera-resolved.json').resolved : []).map((r) => [r.project_id, r]));
  const link = (row: ReraRow) => `${BASE.replace('://up-rera', '://www.up-rera')}/${row.summary_path}`;

  const projects = await prisma.project.findMany({
    where: { archived_duplicate_of: null },
    select: { id: true, name: true, slug: true, rera_number: true, rera_url: true, rera_valid_until: true, lat: true, lng: true, status: true, possession_label: true, possession_date: true, hospital_distance_km: true, police_station_distance_km: true, launch_date: true, hero_image_url: true, airport_distance_km: true, expected_handover_quarter: true, images: { select: { url: true, type: true, sort_order: true }, orderBy: { sort_order: 'asc' } }, total_units: true, total_towers: true, land_area_acres: true, floors: true, architect: true, price_min_cr: true },
  });

  const geo: Record<string, any> = hasFile('geocode-results.json') ? readJson<{ results: Record<string, any> }>('geocode-results.json').results : {};
  const poss: Record<string, any> = Object.fromEntries((hasFile('possession-proposals.json') ? readJson<{ proposals: any[] }>('possession-proposals.json').proposals : []).map((x) => [x.project_id, x]));
  const near: Record<string, any> = hasFile('nearby-results.json') ? readJson<{ results: Record<string, any> }>('nearby-results.json').results : {};
  const rpRes: Record<string, any> = hasFile('routes-places-results.json') ? readJson<{ results: Record<string, any> }>('routes-places-results.json').results : {};
  const plans: Plan[] = [];
  for (const p of projects as any[]) {
    const plan: Plan = { project_id: p.id, name: p.name, slug: p.slug, changes: [] };
    const m = mById.get(p.id);

    // RERA number
    const genericUrl = !p.rera_url || /up-rera\.in\/?$/.test(p.rera_url.replace(/^https?:\/\/(www\.)?/, 'https://'));
    if (m?.method === 'exact' && m.registry?.summary_path && !idsContradict(p.name, m.registry.project_name)) {
      plan.rera = { old: p.rera_number, new: p.rera_number, summary_url: link(m.registry), how: 'registry exact (number, and name or builder)', replace_number: false, score: 2 };
    } else if (resolved.has(p.id)) {
      const r = resolved.get(p.id);
      const row = byReg.get(r.new);
      // The same sentence listing several numbers is a guess unless the name is an exact match.
      const multi = (r.sources as any[]).some((s) => new Set(String(s.quote).match(/UPRERAPRJ\d+(?:\/\d{2}\/\d{4})?/g) ?? []).size > 1);
      // Below 0.5 the registry name is a different product or a tower-split registration (A-F vs L-Q): a guess.
      // A weak name match needs a second leg: the builder in the promoter name, or a second source page.
      const bToks = String(r.builder).toLowerCase().replace(/\(.*?\)|group|infra\w*|developers?|builders?|properties|realty|homes|limited|private|pvt|ltd/g, ' ').split(/[^a-z]+/).filter((t) => t.length >= 4);
      const builderLinked = bToks.some((t) => String(r.registry.promoter).toLowerCase().includes(t));
      const weak = r.name_score < 0.6 && !builderLinked && new Set((r.sources as any[]).map((s) => s.url)).size < 2;
      const rejected = idsContradict(p.name, r.registry.name) || (multi && r.name_score < 1) || r.name_score < 0.5 || weak;
      if (row?.summary_path && !rejected) plan.rera = { old: p.rera_number, new: r.new, summary_url: link(row), how: `portal/search stated, registry-checked (${r.confidence})`, replace_number: r.new !== p.rera_number, score: r.name_score };
    } else if (m?.method === 'name_unique' && m.score >= 0.99 && m.registry?.summary_path) {
      const toks = String(m.builder).toLowerCase().replace(/group|infra\w*|developers?|builders?|properties|realty|homes|limited|private|pvt|ltd/g, ' ').split(/[^a-z]+/).filter((t) => t.length >= 4);
      if (toks.some((t) => (m.registry.promoter as string).toLowerCase().includes(t))) {
        plan.rera = { old: p.rera_number, new: m.registry.rera_number, summary_url: link(m.registry), how: 'registry identical name + builder in promoter', replace_number: m.registry.rera_number !== p.rera_number, score: 1 };
      }
    }
    if (plan.rera) {
      if (plan.rera.replace_number) plan.changes.push({ field: 'rera_number', old: p.rera_number, new: plan.rera.new, source: 'UP-RERA registry', url: plan.rera.summary_url, quote: plan.rera.how });
      if (plan.rera.replace_number || genericUrl) plan.changes.push({ field: 'rera_url', old: p.rera_url, new: plan.rera.summary_url, source: 'UP-RERA registry', url: plan.rera.summary_url, quote: 'direct registry record link' });
    }

    // RERA validity: the registry's declared completion date for this project's verified registration.
    if (plan.rera) {
      const row = byReg.get(plan.rera.new);
      const dm = row?.end_date ? /^(\d{2})-(\d{2})-(\d{4})$/.exec(row.end_date) : null;
      if (dm) {
        const when = new Date(Date.UTC(+dm[3], +dm[2] - 1, +dm[1]) - 5.5 * 3600 * 1000); // IST midnight, the way dates are stored today
        // Fill empty values only: the summary shows the originally declared date, and a granted extension would make an existing value the later, truer one.
        if (p.rera_valid_until == null) {
          plan.changes.push({ field: 'rera_valid_until', old: iso(p.rera_valid_until) ?? null, new: when.toISOString(), source: 'UP-RERA registry (declared completion date)', url: plan.rera.summary_url, quote: `Declared Date Of Completion | ${row!.end_date}` });
        }
      }
    }

    // Coordinates (stage 11): only for projects that have none, and only a result that passed the area and name checks.
    const g = geo[p.id];
    if (g?.accepted && p.lat == null && p.lng == null) {
      const src = 'Google Places text search (' + g.place + ')';
      plan.changes.push({ field: 'lat', old: null, new: g.lat, source: src, url: '', quote: g.address });
      plan.changes.push({ field: 'lng', old: null, new: g.lng, source: src, url: '', quote: g.address });
    }

    // Nearest hospital / police station (stage 13): straight-line km from the project's coordinates, empty values only.
    const nb = near[p.id];
    if (nb?.hospital && p.hospital_distance_km == null) plan.changes.push({ field: 'hospital_distance_km', old: null, new: nb.hospital.km, source: 'Google Places (nearest hospital, straight-line)', url: '', quote: nb.hospital.name });
    if (nb?.police && p.police_station_distance_km == null) plan.changes.push({ field: 'police_station_distance_km', old: null, new: nb.police.km, source: 'Google Places (nearest police station, straight-line)', url: '', quote: nb.police.name });

    // Airport road distance (stage 21), to Noida International Airport via Google Routes; empty values only.
    const rp = rpRes[p.id];
    if (rp?.airport_km && p.airport_distance_km == null) plan.changes.push({ field: 'airport_distance_km', old: null, new: rp.airport_km, source: 'Google Routes (driving km to Noida International Airport)', url: '', quote: `${rp.airport_km} km by road` });
    // expected_handover_quarter is deliberately NOT derived from possession_date: most stored dates are year-end placeholders
    // (2027-12-31) or already past on projects still marked under construction, so a derived quarter would copy a stale value.

    // Hero image: a project with none uses the first real image of its own gallery, never a stock photo.
    if (!p.hero_image_url) {
      const real = (p.images as any[]).filter((i) => !/unsplash\.com|pexels\.com|pixabay\.com/i.test(i.url));
      const own = real.find((i) => i.type === 'hero') ?? real[0];
      if (own) plan.changes.push({ field: 'hero_image_url', old: null, new: own.url, source: "the project's own gallery", url: '', quote: 'first real image in the project gallery' });
    }
    // Launch date, month precision: only when the project has none and every page agrees on the month.
    if (p.launch_date == null && hasFile(`research/${p.id}.json`)) {
      const cands = (readJson<any>(`research/${p.id}.json`).fields?.launch_date?.candidates ?? []).filter((c: any) => pageIsAbout(c.source_url, p.name, c.quote));
      const months = new Set(cands.map((c: any) => parseMonthYear(String(c.value))).filter(Boolean));
      if (months.size === 1) plan.changes.push({ field: 'launch_date', old: null, new: `${[...months][0]}-01T00:00:00.000Z`, source: 'listing portal or builder (month precision)', url: cands[0].source_url, quote: cands[0].quote });
    }

    // Possession bundle (stage 12): status, label and date move together, from a builder quote or two agreeing sources.
    const pp = poss[p.id];
    if (pp) {
      const src = `possession per ${pp.basis}`, url = pp.evidence[0].url, quote = pp.evidence[0].quote;
      if (p.status !== pp.new.status) plan.changes.push({ field: 'status', old: p.status, new: pp.new.status, source: src, url, quote });
      if ((p.possession_label ?? '') !== pp.new.label) plan.changes.push({ field: 'possession_label', old: p.possession_label ?? null, new: pp.new.label, source: src, url, quote });
      if (pp.new.date && !eq(p.possession_date, pp.new.date)) plan.changes.push({ field: 'possession_date', old: iso(p.possession_date) ?? null, new: pp.new.date, source: src, url, quote });
    }

    // Web facts
    if (hasFile(`research/${p.id}.json`)) {
      const r = readJson<any>(`research/${p.id}.json`);
      for (const f of FACT_FIELDS) {
        const raw = r.fields?.[f]?.candidates ?? [];
        const cands = raw.filter((c: any) => pageIsAbout(c.source_url, p.name, c.quote)).filter((c: any) => clean(f, c.value, c.quote) !== null)
          .filter((c: any) => !(['total_units', 'total_towers', 'land_area_acres'].includes(f) && foreignPhase(c.quote, p.name)));
        const chosen = pick(cands);
        if (!chosen) continue;
        const v = clean(f, chosen.value, chosen.quote);
        if (v === null || eq(p[f], v)) continue;
        // An architect is a claim two portals can contradict each other on, and ours may be the right one: fill empty values only.
        if (f === 'architect' && p.architect != null) continue;
        plan.changes.push({ field: f, old: p[f], new: v, source: chosen.tier === 'builder' ? 'builder website (seller claim)' : 'listing portal (advertised)', url: chosen.source_url, quote: chosen.quote });
      }
    }
    if (plan.changes.length || plan.rera) plans.push(plan);
  }

  // One registry number can belong to only one of our projects. When several claim it, the best name match keeps it;
  // a tie drops all (Galaxy North Avenue 1 and 2 both pointed at "TOWER G"). A verified stamp always outranks a replacement.
  const claims = new Map<string, Plan[]>();
  for (const pl of plans) if (pl.rera) claims.set(pl.rera.new, [...(claims.get(pl.rera.new) ?? []), pl]);
  for (const group of claims.values()) {
    if (group.length < 2) continue;
    const top = Math.max(...group.map((g) => g.rera!.score));
    const winners = group.filter((g) => g.rera!.score === top);
    for (const g of group) {
      if (winners.length === 1 && g === winners[0]) continue;
      g.changes = g.changes.filter((c) => c.field !== 'rera_number' && c.field !== 'rera_url');
      delete g.rera;
    }
  }
  return plans.filter((p) => p.changes.length || p.rera);
}

const tally = (plans: Plan[]) => {
  const t: Record<string, number> = {};
  for (const p of plans) for (const c of p.changes) t[c.field] = (t[c.field] ?? 0) + 1;
  return { projects: plans.length, rera_stamps_only: plans.filter((p) => p.rera && !p.rera.replace_number).length, rera_replacements: plans.filter((p) => p.rera?.replace_number).length, fields: t };
};

async function applyPlan(plans: Plan[]) {
  const ids = plans.map((p) => p.project_id);
  // Select exactly the columns the plans touch, so the guard compares real values (and the backup holds them for rollback).
  const cols = new Set(plans.flatMap((p) => p.changes.map((c) => c.field)));
  const select: Record<string, unknown> = { id: true, name: true, slug: true, rera_number: true, rera_url: true, rera_registrations: true };
  for (const c of cols) select[c] = true;
  const before = await prisma.project.findMany({ where: { id: { in: ids } }, select: select as any });
  const bPath = `${BACKUP_DIR}/backup-${TARGET}-${Date.now()}.json`;
  mkdirSync(dirname(bPath), { recursive: true });
  writeFileSync(bPath, JSON.stringify(before, null, 2)); // before any write
  console.log(`backup of ${before.length} project rows -> ${bPath}`);
  const cur = new Map((before as any[]).map((b) => [b.id, b]));

  const result = { applied: {} as Record<string, number>, skipped_changed: [] as string[], skipped_missing: [] as string[], registrations_written: 0, legacy_rows_removed: 0, errors: [] as string[] };
  for (const plan of plans) {
    const now: any = cur.get(plan.project_id);
    if (!now || now.slug !== plan.slug) { result.skipped_missing.push(plan.name); continue; }
    const data: Record<string, unknown> = {};
    const done: Change[] = [];
    for (const c of plan.changes) {
      if (!eq(now[c.field], c.old)) { result.skipped_changed.push(`${plan.name}.${c.field}: now ${JSON.stringify(now[c.field])}, plan expected ${JSON.stringify(c.old)}`); continue; }
      data[c.field] = DATE_FIELDS.has(c.field) ? new Date(c.new as string) : c.new;
      done.push(c);
    }
    try {
      await prisma.$transaction(async (tx) => {
        if (Object.keys(data).length) {
          await tx.project.update({ where: { id: plan.project_id }, data: data as any });
          await tx.auditLog.create({ data: { entity_type: 'project', entity_id: plan.project_id, entity_name: plan.name, action: 'UPDATE', actor: 'System', summary: `Data-integrity pass 2026-10-28: ${done.map((d) => d.field).join(', ')}`, changes: done.map((d) => ({ field: d.field, old: d.old, new: d.new, label: `${d.source} | ${d.url} | ${d.quote.slice(0, 160)}` })) as any } });
        }
        const rera = plan.rera;
        const numberOk = rera && (data.rera_number !== undefined || eq(now.rera_number, rera.new));
        if (rera && numberOk) {
          if (rera.replace_number && data.rera_number !== undefined) {
            const del = await tx.projectReraRegistration.deleteMany({ where: { project_id: plan.project_id, rera_number: rera.old ?? '', source: 'legacy_projects_column' } });
            result.legacy_rows_removed += del.count;
          }
          await tx.projectReraRegistration.upsert({
            where: { project_id_rera_number: { project_id: plan.project_id, rera_number: rera.new } },
            create: { project_id: plan.project_id, rera_number: rera.new, format_ok: true, rera_url: rera.summary_url, source: 'up_rera_registry', source_url: rera.summary_url, verified_at: new Date(), verified_by: STAMP },
            update: { format_ok: true, rera_url: rera.summary_url, source: 'up_rera_registry', source_url: rera.summary_url, verified_at: new Date(), verified_by: STAMP },
          });
          result.registrations_written++;
        }
      });
      for (const d of done) result.applied[d.field] = (result.applied[d.field] ?? 0) + 1;
    } catch (e) {
      result.errors.push(`${plan.name}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return result;
}

async function main() {
  let plans: Plan[];
  if (TARGET === 'live') plans = readJson<{ plans: Plan[] }>(PLAN_FILE).plans; // the exact reviewed plan
  else {
    plans = await buildPlan();
    writeJson(PLAN_FILE, { built_at: new Date().toISOString(), from: 'dev', summary: tally(plans), plans });
  }
  console.log(`${TARGET}${DRY ? ' (dry run)' : ''} plan:`, JSON.stringify(tally(plans)));
  if (DRY) return;
  const result = await applyPlan(plans);
  const out = writeJson(`apply-result-${TARGET}.json`, result);
  console.log({ applied: result.applied, registrations_written: result.registrations_written, legacy_rows_removed: result.legacy_rows_removed, skipped_changed: result.skipped_changed.length, skipped_missing: result.skipped_missing.length, errors: result.errors.length }, '->', out);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
