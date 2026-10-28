// Shared helpers for the data-integrity pipeline. Read-only against the dev DB.
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join } from 'path';

export const BASE = 'https://up-rera.in';
const UA = 'Mozilla/5.0 (RealtyAsk data-integrity crawler; contact: furqan.workk@gmail.com)';

// Work files live outside git. One folder per run date keeps reruns comparable.
export const WORK_DIR = process.env.DI_WORK_DIR ?? join(process.cwd(), 'data-integrity-work');
export const workPath = (name: string) => join(WORK_DIR, name);
export const writeJson = (name: string, data: unknown) => {
  const p = workPath(name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2));
  return p;
};
export const readJson = <T>(name: string): T => JSON.parse(readFileSync(workPath(name), 'utf8'));
export const hasFile = (name: string) => existsSync(workPath(name));

// Dev (Supabase) only. The live Neon host must never be reached from here.
export function assertDevDb() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url || url.includes('neon.tech')) {
    throw new Error('Refusing: DATABASE_URL is missing or points at Neon (live).');
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── UP-RERA session: cookie jar + ASP.NET postback ───────────────────────────
export class ReraSession {
  private jar = new Map<string, string>();

  private save(res: Response) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.jar.set(kv.slice(0, i).trim(), kv.slice(i + 1));
    }
  }
  private cookie() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async get(url: string): Promise<Response> {
    const res = await fetch(url, { headers: { 'user-agent': UA, cookie: this.cookie() }, redirect: 'manual' });
    this.save(res);
    return res;
  }

  static hidden(html: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = /name="([^"]+)"/.exec(m[0])?.[1];
      const value = /value="([^"]*)"/.exec(m[0])?.[1] ?? '';
      if (name) out[name] = value;
    }
    return out;
  }

  /** Fire a homepage link (e.g. lnkRegisteredProjects) and return the page it lands on. */
  async postbackFromHome(linkId: string): Promise<string> {
    const home = await this.get(BASE + '/');
    if (home.status !== 200) throw new Error(`home ${home.status}`);
    const fields = ReraSession.hidden(await home.text());
    const body = new URLSearchParams({
      ...fields,
      __EVENTTARGET: `ctl00$ContentPlaceHolder1$${linkId}`,
      __EVENTARGUMENT: '',
    });
    const post = await fetch(BASE + '/', {
      method: 'POST',
      headers: {
        'user-agent': UA,
        cookie: this.cookie(),
        'content-type': 'application/x-www-form-urlencoded',
        referer: BASE + '/',
      },
      body,
      redirect: 'manual',
    });
    this.save(post);
    const loc = post.headers.get('location');
    if (!loc) return post.text();
    const page = await this.get(new URL(loc, BASE).href);
    if (page.status !== 200) throw new Error(`${linkId} landed on ${page.status}`);
    return page.text();
  }
}

// ── Parsing ──────────────────────────────────────────────────────────────────
const decode = (s: string) =>
  s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();

export interface ReraRow {
  list: string;
  rera_number: string;
  project_name: string;
  promoter: string;
  project_type: string;
  district: string;
  start_date: string | null;
  end_date: string | null;
  reg_date: string | null;
  flags: string[]; // e.g. "Default on QPR"
  summary_path: string | null;
}

export function parseListPage(html: string, list: string): ReraRow[] {
  const rows: ReraRow[] = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tr = m[1];
    const span = (suffix: string) => {
      const r = new RegExp(`id="[^"]*${suffix}"[^>]*>([\\s\\S]*?)</span>`).exec(tr);
      return r ? decode(r[1]) : '';
    };
    const reg = span('lblRegistrationNo');
    if (!reg) continue;
    const flagM = /id="[^"]*Label2"[^>]*>([\s\S]*?)<\/span>/.exec(tr);
    const href = /href="(Projectsummary\?[^"]+)"/.exec(tr)?.[1] ?? null;
    rows.push({
      list,
      rera_number: reg,
      project_name: span('lblProjectName'),
      promoter: span('lblPromoter'),
      project_type: span('lblProjectType'),
      district: span('lblDistrict'),
      start_date: span('lblStartDate') || null,
      end_date: span('lblEndDate') || null,
      reg_date: span('lblRegDate') || null,
      flags: flagM ? [decode(flagM[1])] : [],
      summary_path: href ? href.replace(/&amp;/g, '&') : null,
    });
  }
  return rows;
}

/**
 * A page is about this project when most of the project's name tokens appear in its URL or in the
 * saved page head (or, if no copy was saved, in the quote). "ATS Dolce sits on 14 acres" read for
 * ATS Sovereign fails: "sovereign" is nowhere.
 */
// A builder with projects in several cities reuses names ("Omaxe Riviera" in Rudrapur). A page whose address names another
// city that our project's name does not contain is about a different project.
const OTHER_CITY = /rudrapur|lucknow|kolkata|chandigarh|indore|jaipur|agra|varanasi|bhiwadi|panipat|sonipat|gurgaon|gurugram|faridabad|mumbai|pune|bangalore|bengaluru|hyderabad|chennai|kanpur|ludhiana|amritsar|dehradun|haridwar|nainital|ranchi|bhopal|nagpur|ahmedabad|surat|patna|goa|mohali|zirakpur|manesar|bahadurgarh|rohtak|meerut|bareilly|gorakhpur|prayagraj|allahabad|jhansi|mathura/i;

export function pageIsAbout(url: string, projectName: string, quote: string): boolean {
  const toks = normName(projectName).split(' ').filter(Boolean);
  if (!toks.length) return false;
  if (OTHER_CITY.test(url) && !OTHER_CITY.test(projectName)) return false;
  let head = '';
  try {
    head = readFileSync(workPath(`pages/${createHash('sha1').update(url).digest('hex')}.txt`), 'utf8').slice(0, 3000);
  } catch {
    /* no saved copy */
  }
  const hay = (url + ' ' + head + ' ' + quote).toLowerCase().replace(/[^a-z0-9]/g, '');
  return toks.filter((t) => hay.includes(t)).length / toks.length >= 0.6;
}

/** Ordinals and numerals that tell sibling registrations apart: "2nd Avenue" -> 2, "Golf View II" -> ii. */
export function idTokens(name: string): Set<string> {
  const out = new Set<string>();
  for (const t of name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)) {
    const d = /^(\d+)(st|nd|rd|th)?$/.exec(t);
    if (d) out.add(d[1]);
    else if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(t)) out.add(t);
  }
  return out;
}
/** True when both names carry identifiers and share none: "2nd Avenue" vs "7th Avenue". */
export const idsContradict = (a: string, b: string) => {
  const A = idTokens(a), B = idTokens(b);
  return A.size > 0 && B.size > 0 && ![...A].some((t) => B.has(t));
};

/** Normalise a name for matching: lowercase, drop punctuation and filler words. */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(the|by|pvt|ltd|private|limited|project|phase|tower|towers|residency|apartments?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
