// Stage 30: UP-RERA orders as PENDING drafts. Dev DB only.
//
// What UP-RERA publishes openly (checked 4 Nov 2026):
//   - JudgementView ("selected judgements"): a short list of orders with complaint number, promoter,
//     project, bench, order date and a PDF link. Read here via WebService1.asmx/loadjudgement.
//   - Every other order is looked up one complaint number at a time behind a captcha
//     (frm_OrderExecution.aspx). Not crawled: we do not get around a captcha.
//   - The abeyance list (Frm_view_Abeyance_Projectlist.aspx) returned "There was an error processing
//     the request" for every input, in a real browser too. Nothing to stage until it works.
//
// A published order is matched to our project by exact normalised project name only (a name-only
// match always carries needs_review: true; a person opens the PDF before approving). Rows go to
// project_field_drafts (field 'rera_orders'), which is in FORBIDDEN_RELATIONS: no buyer or prompt
// sees them until a named person approves them.
//
// Dry run by default. Idempotent: replaces only its own pending rows. Backs up before writing.
//   npx tsx scripts/data-integrity/30-orders-drafts.ts [--apply]
import { PrismaClient } from '@prisma/client';
import { BASE, assertDevDb, normName, writeJson } from './lib';

export const FIELD = 'rera_orders';
export const LABEL = 'UP-RERA published orders (JudgementView)';

export interface PublishedOrder {
  complaint_no: string;
  complainant: string;
  promoter: string;
  project: string;
  bench: string;
  order_date: string; // dd-mm-yyyy as published
  pdf_url: string | null;
}

const text = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** The service returns table HTML in `d`; one order per body row. */
export function parseOrders(html: string): PublishedOrder[] {
  const out: PublishedOrder[] = [];
  for (const m of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    if (cells.length < 8) continue;
    const href = /href='([^']+)'/.exec(cells[7])?.[1] ?? null;
    out.push({
      complaint_no: text(cells[1]),
      complainant: text(cells[2]),
      promoter: text(cells[3]),
      project: text(cells[4]),
      bench: text(cells[5]),
      order_date: text(cells[6]),
      pdf_url: href ? new URL(href, BASE + '/').href : null,
    });
  }
  return out;
}

async function fetchOrders(): Promise<PublishedOrder[]> {
  const res = await fetch(`${BASE}/WebService1.asmx/loadjudgement`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', referer: `${BASE}/JudgementView`, 'user-agent': 'Mozilla/5.0 (RealtyAsk data-integrity crawler)' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`loadjudgement ${res.status}`);
  return parseOrders(((await res.json()) as { d: string }).d);
}

async function main() {
  assertDevDb();
  const prisma = new PrismaClient();
  const APPLY = process.argv.includes('--apply');
  try {
    const readAt = new Date();
    const orders = await fetchOrders();
    const projects = await prisma.project.findMany({ select: { id: true, name: true } });
    const byName = new Map<string, { id: string; name: string }[]>();
    for (const p of projects) byName.set(normName(p.name), [...(byName.get(normName(p.name)) ?? []), p]);

    const rows = orders.flatMap((o) => {
      const hits = byName.get(normName(o.project)) ?? [];
      if (hits.length !== 1) return [];
      return [{
        project_id: hits[0].id,
        field_name: FIELD,
        proposed_value: { ...o, read_at: readAt.toISOString(), match_method: 'name_exact', needs_review: true },
        source_url: o.pdf_url ?? `${BASE}/JudgementView`,
        source_label: LABEL,
        fetched_at: readAt,
        status: 'pending',
      }];
    });
    console.log(`published orders=${orders.length}; matched to one of our projects=${rows.length}`);
    for (const r of rows) console.log(`  ${(r.proposed_value as PublishedOrder).project} <- order ${(r.proposed_value as PublishedOrder).order_date}`);
    writeJson(`orders-${readAt.getTime()}.json`, orders);

    const own = await prisma.projectFieldDraft.findMany({ where: { field_name: FIELD, source_label: LABEL, status: 'pending' } });
    console.log(`existing own pending rows=${own.length}${APPLY ? '' : ' [dry run: pass --apply to write]'}`);
    if (!APPLY) return;
    writeJson(`backup-orders-drafts-${Date.now()}.json`, own);
    await prisma.$transaction([
      prisma.projectFieldDraft.deleteMany({ where: { field_name: FIELD, source_label: LABEL, status: 'pending' } }),
      prisma.projectFieldDraft.createMany({ data: rows as never }),
    ]);
    console.log('written.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
