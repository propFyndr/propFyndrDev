const { chromium } = require('playwright');
const fs = require('fs');

async function extractExactImageMapping() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://www.bepeak.in/', { waitUntil: 'networkidle' });

  // Scroll down to ensure all images load
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(400);
  }

  const mapping = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img')).map(img => {
      // Find nearby text (parent or siblings)
      let parent = img.parentElement;
      let text = '';
      for (let i = 0; i < 4 && parent; i++) {
        if (parent.innerText && parent.innerText.trim()) {
          text = parent.innerText.trim().slice(0, 120).replace(/\n/g, ' ');
          break;
        }
        parent = parent.parentElement;
      }
      return {
        src: img.src,
        currentSrc: img.currentSrc,
        alt: img.alt,
        contextText: text
      };
    });
    return images;
  });

  fs.writeFileSync('C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/exact_live_images.json', JSON.stringify(mapping, null, 2));
  console.log('Saved exact mapping for', mapping.length, 'live images.');
  await browser.close();
}

extractExactImageMapping().catch(console.error);
