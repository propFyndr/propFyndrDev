const { chromium } = require('playwright');

async function inspectHeroElement() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://www.bepeak.in/', { waitUntil: 'networkidle' });

  const heroDetails = await page.evaluate(() => {
    // Find element containing "Lose 5–7kg in 28 days"
    const all = Array.from(document.querySelectorAll('*'));
    const target = all.find(el => el.textContent && el.textContent.includes('Lose 5–7kg in 28 days') && el.children.length === 0);
    if (!target) return 'Not found';

    // Traverse up parents to find background image or video
    let curr = target;
    const parents = [];
    while (curr && curr !== document.body) {
      const style = window.getComputedStyle(curr);
      const bg = style.backgroundImage;
      const bgCol = style.backgroundColor;
      parents.push({
        tag: curr.tagName,
        id: curr.id,
        className: curr.className,
        backgroundImage: bg !== 'none' ? bg : undefined,
        backgroundColor: bgCol,
        width: curr.offsetWidth,
        height: curr.offsetHeight
      });
      curr = curr.parentElement;
    }

    // Also find any element with background image containing wixstatic or similar
    const allWithBg = all.filter(el => {
      const s = window.getComputedStyle(el);
      return s.backgroundImage && s.backgroundImage.includes('wixstatic');
    }).map(el => ({
      id: el.id,
      bg: window.getComputedStyle(el).backgroundImage,
      w: el.offsetWidth,
      h: el.offsetHeight
    }));

    // Find all img tags in top 1000px
    const topImgs = Array.from(document.querySelectorAll('img')).map(img => {
      const rect = img.getBoundingClientRect();
      return {
        src: img.src,
        currentSrc: img.currentSrc,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        alt: img.alt
      };
    }).filter(img => img.top < 1200);

    return { parents, allWithBg, topImgs };
  });

  console.log('Hero details:', JSON.stringify(heroDetails, null, 2));
  await browser.close();
}

inspectHeroElement().catch(console.error);
