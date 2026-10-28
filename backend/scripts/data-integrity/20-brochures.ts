// Stage 20: Square Yards brochure PDFs -> text, fully automatic and memory-safe.
// The brochure address is derived from the project page address (verified on Mahagun Mantra I) and only downloaded if it exists.
// robots.txt for doc.squareyards.com allows it. Plain, paced, honest requests. Each PDF is extracted by the isolated Python tool
// (digital pages: native text; image-only pages: RapidOCR on CPU) one at a time, and the PDF is deleted afterwards.
// Free RAM is checked before every PDF; below the floor it waits, then stops. Output is saved the way stage 19 reads pages.
// Run: npx tsx scripts/data-integrity/20-brochures.ts [--limit N] [--delay-ms 2000] [--min-free-gb 1.2]
import 'dotenv/config';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { freemem } from 'os';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { hasFile, readJson, sleep, workPath, writeJson } from './lib';

const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const LIMIT = Number(arg('limit', '100000'));
const DELAY = Number(arg('delay-ms', '2000'));
const MIN_FREE_GB = Number(arg('min-free-gb', '1.2'));
const UA = 'RealtyAsk-data-integrity/1.0 (+furqan.workk@gmail.com)';
const MAX_BYTES = 40 * 1024 * 1024;
const PY = resolve(process.cwd(), 'scripts/doc-ingest/.venv/Scripts/python.exe');
const EXTRACT = resolve(process.cwd(), 'scripts/doc-ingest/extract_pdf.py');

const freeGb = () => freemem() / 1024 ** 3;

/** Project page -> candidate brochure addresses. Name casing varies on the host, so a few spellings are tried. */
function brochureCandidates(pageUrl: string): string[] {
  const m = /^https?:\/\/(?:www\.)?squareyards\.com\/([^/]+)\/([^/]+)\/(\d+)\/project/i.exec(pageUrl);
  if (!m) return [];
  const [, region, slug, id] = m;
  const words = slug.split('-');
  const title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
  const lower = words.join('_');
  const upper = words.map((w) => w.toUpperCase()).join('_');
  const base = `https://doc.squareyards.com/ProjectBrouchure/${region}/${slug}/${id}/project/brochure`;
  return [...new Set([title, lower, upper].map((n) => `${base}/${n}_Brochure_${id}.pdf`))];
}

async function download(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(90000) });
  if (!res.ok) return null;
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length <= MAX_BYTES && buf.subarray(0, 4).toString() === '%PDF' ? buf : null;
}

async function main() {
  if (!existsSync(PY)) throw new Error('doc-ingest venv missing: run python -m venv .venv and pip install rapidocr onnxruntime pdfplumber pypdfium2 psutil in scripts/doc-ingest');
  const pagesIn = readJson<{ pages: Record<string, any[]> }>('portal-pages.json').pages;
  const out: Record<string, any[]> = hasFile('portal-pages-3.json') ? readJson<{ pages: Record<string, any[]> }>('portal-pages-3.json').pages : {};
  const stats = { projects: 0, found: 0, not_found: 0, extracted: 0, ocr_pages: 0, skipped_low_memory: 0 };
  let n = 0;
  for (const [pid, rows] of Object.entries(pagesIn)) {
    const sy = rows.find((r) => r.ok && r.host === 'squareyards.com');
    if (!sy || out[pid] !== undefined || n >= LIMIT) continue;
    n++;
    stats.projects++;
    let pdf: Buffer | null = null, used = '';
    for (const cand of brochureCandidates(sy.url)) {
      try { pdf = await download(cand); } catch { pdf = null; }
      await sleep(DELAY);
      if (pdf) { used = cand; break; }
    }
    if (!pdf) { out[pid] = []; stats.not_found++; continue; }
    stats.found++;

    // wait for memory rather than push the laptop into swap
    for (let i = 0; i < 10 && freeGb() < MIN_FREE_GB; i++) await sleep(30000);
    if (freeGb() < MIN_FREE_GB) { stats.skipped_low_memory++; console.error(`stopping: free RAM ${freeGb().toFixed(1)} GB is under ${MIN_FREE_GB} GB`); break; }

    const key = createHash('sha1').update(used).digest('hex');
    const pdfPath = workPath(`brochures/${key}.pdf`), jsonPath = workPath(`brochures/${key}.json`);
    mkdirSync(dirname(pdfPath), { recursive: true });
    writeFileSync(pdfPath, pdf);
    try {
      execFileSync(PY, [EXTRACT, pdfPath, jsonPath, '--min-free-gb', String(Math.max(0.8, MIN_FREE_GB - 0.4)), '--threads', '3'], { timeout: 15 * 60 * 1000, stdio: 'ignore' });
      const ex = JSON.parse(readFileSync(jsonPath, 'utf8'));
      const text = ex.pages.map((p: any) => `[page ${p.page}] ${p.text}`).join('\n');
      const pagePath = workPath(`pages/${key}.txt`);
      mkdirSync(dirname(pagePath), { recursive: true });
      writeFileSync(pagePath, `${used}\n\n${text.slice(0, 60000)}`);
      out[pid] = [{ url: used, host: 'doc.squareyards.com', ok: true, status: 200, chars: text.length, pages: ex.page_count, ocr_pages: ex.ocr_pages }];
      stats.extracted++; stats.ocr_pages += ex.ocr_pages;
    } catch (e) {
      out[pid] = [{ url: used, host: 'doc.squareyards.com', ok: false, error: (e as Error).message.slice(0, 80) }];
    } finally {
      try { unlinkSync(pdfPath); } catch { /* already gone */ }
    }
    if (n % 15 === 0) { writeJson('portal-pages-3.json', { generated_at: new Date().toISOString(), pages: out }); console.log(`${n} projects, ${stats.found} brochures found`); }
  }
  writeJson('portal-pages-3.json', { generated_at: new Date().toISOString(), pages: out });
  console.log(stats);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
