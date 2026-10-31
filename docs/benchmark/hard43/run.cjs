// Usage: node run.cjs chatgpt|perplexity [startId]
// Logged-out, fresh page per question, headed. Passive: types a question, reads the page text. No login.
const { chromium } = require('../../../node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const site = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(',') : null;
const qs = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
const outFile = path.join(__dirname, `${site}.json`);
const results = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};

const cfg = {
  chatgpt: { url: 'https://chatgpt.com/', box: '#prompt-textarea, #mobile-composer-prompt', marker: 'ChatGPT said:' },
  perplexity: { url: 'https://www.perplexity.ai/', box: '#ask-input, textarea, [contenteditable="true"]', marker: null },
}[site];

async function body(page) { return page.evaluate(() => document.body.innerText); }

function extract(raw, q) {
  if (cfg.marker) {
    const i = raw.lastIndexOf(cfg.marker);
    return i < 0 ? '' : raw.slice(i + cfg.marker.length).trim();
  }
  const i = raw.lastIndexOf(q.slice(0, 40));
  // drop the ticking "12s" timer lines so the stability check can settle
  return i < 0 ? '' : raw.slice(i + q.length).replace(/^\d+s$/gm, '').trim();
}

(async () => {
  const profile = process.env.PPLX_PROFILE;
  const browser = profile ? null : await chromium.launch({ headless: false, channel: 'chrome' });
  const pctx = profile ? await chromium.launchPersistentContext(profile, { headless: false, channel: 'chrome', viewport: { width: 1400, height: 900 }, locale: 'en-IN' }) : null;
  for (const item of qs) {
    if (only && !only.includes(item.id)) continue;
    if (results[item.id] && results[item.id].text && results[item.id].text.length > 80) continue;
    const ctx = pctx || await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-IN' });
    const page = await ctx.newPage();
    const rec = { id: item.id, q: item.q, site, at: new Date().toISOString() };
    try {
      await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);
      const before = (await body(page)).length;
      await page.locator(cfg.box).first().click({ timeout: 15000 });
      await page.keyboard.type(item.q, { delay: 4 });
      const t0 = Date.now();
      await page.keyboard.press('Enter');
      let first = null, last = '', stableSince = Date.now();
      for (let i = 0; i < 180; i++) { // up to 90 s
        await page.waitForTimeout(500);
        const raw = await body(page);
        const ans = extract(raw, item.q);
        if (ans && first === null && ans.length > 20) first = Date.now() - t0;
        if (ans !== last) { last = ans; stableSince = Date.now(); }
        if (first !== null && Date.now() - stableSince > 6000) break;
      }
      rec.first_ms = first; rec.total_ms = Date.now() - t0 - 6000; rec.text = last; rec.url = page.url();
      rec.raw_tail = (await body(page)).slice(-6000);
      rec.before_len = before;
    } catch (e) { rec.error = String(e).slice(0, 300); }
    if (/free search limit/i.test(rec.text || '')) { console.log(site, item.id, 'FREE LIMIT REACHED, stopping'); if (!pctx) await ctx.close(); else await page.close(); break; }
    results[item.id] = rec;
    fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
    console.log(site, item.id, rec.error || `${rec.first_ms}ms ${rec.text?.length}ch`);
    if (!pctx) await ctx.close(); else await page.close();
    await new Promise(r => setTimeout(r, 4000));
  }
  if (pctx) await pctx.close(); else await browser.close();
})();
