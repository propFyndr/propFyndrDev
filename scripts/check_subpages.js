const { chromium } = require('playwright');
const fs = require('fs');

async function checkSubpages() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const paths = ['/about', '/contact', '/app'];
  for (const p of paths) {
    try {
      const resp = await page.goto('https://www.bepeak.in' + p, { waitUntil: 'networkidle', timeout: 30000 });
      console.log(p, 'status:', resp.status(), 'title:', await page.title());
      const content = await page.content();
      fs.writeFileSync(`C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/page_${p.replace('/', '')}.html`, content);
      await page.screenshot({ path: `C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/page_${p.replace('/', '')}.png`, fullPage: true });
    } catch(e) {
      console.log(p, 'failed:', e.message);
    }
  }
  await browser.close();
}

checkSubpages().catch(console.error);
