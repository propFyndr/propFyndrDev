const { chromium } = require('playwright');
const fs = require('fs');

async function getSlides() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://www.bepeak.in/', { waitUntil: 'networkidle' });

  const result = await page.evaluate(() => {
    const gal = document.getElementById('comp-mee1mu7y') || document.querySelector('[data-testid="slide-show-gallery"]');
    if (!gal) return { error: 'no gallery' };
    
    // Find all images or background images
    const rawHtml = gal.innerHTML;
    const matches = [...rawHtml.matchAll(/https:\/\/static\.wixstatic\.com\/media\/[^"'\s\)]+/g)].map(m => m[0]);
    return {
      uniqueUrls: [...new Set(matches)],
      htmlSnippet: rawHtml.slice(0, 1000)
    };
  });

  console.log('Result:', JSON.stringify(result, null, 2));
  await browser.close();
}

getSlides().catch(console.error);
