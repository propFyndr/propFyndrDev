const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function scrapeLiveSite() {
  console.log('Launching browser to inspect https://www.bepeak.in/ ...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  const networkUrls = new Set();
  const mediaUrls = new Set();
  const videoUrls = new Set();

  page.on('response', async (response) => {
    const url = response.url();
    networkUrls.add(url);
    const contentType = response.headers()['content-type'] || '';
    if (contentType.includes('video') || url.includes('.mp4') || url.includes('video.wixstatic.com')) {
      videoUrls.add(url);
      console.log('FOUND VIDEO URL:', url, contentType);
    }
    if (contentType.includes('image') || url.includes('.png') || url.includes('.jpg') || url.includes('.webp') || url.includes('.gif') || url.includes('.svg')) {
      mediaUrls.add(url);
    }
  });

  console.log('Navigating to https://www.bepeak.in/ ...');
  await page.goto('https://www.bepeak.in/', { waitUntil: 'networkidle', timeout: 60000 });

  console.log('Page loaded. Scrolling down to trigger lazy loading...');
  // Scroll down smoothly
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(3000);

  // Take full page screenshot
  const screenshotPath = path.resolve('C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/live_full_screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Full page screenshot saved to:', screenshotPath);

  // Find all video tags on the page
  const videosOnPage = await page.$$eval('video', (els) => els.map(v => ({
    src: v.src,
    currentSrc: v.currentSrc,
    sources: Array.from(v.querySelectorAll('source')).map(s => s.src)
  })));
  console.log('Video elements on page:', JSON.stringify(videosOnPage, null, 2));

  // Find all iframe embeds (like vimeo, youtube, etc)
  const iframes = await page.$$eval('iframe', (els) => els.map(f => f.src));
  console.log('Iframes on page:', iframes);

  // Save the full rendered HTML
  const renderedHtml = await page.content();
  fs.writeFileSync('C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/live_rendered.html', renderedHtml);
  console.log('Rendered HTML saved (size:', renderedHtml.length, 'bytes)');

  console.log('Total network requests:', networkUrls.size);
  console.log('Total media URLs found:', mediaUrls.size);
  console.log('Total video URLs found:', videoUrls.size, Array.from(videoUrls));

  fs.writeFileSync('C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/scraped_media_urls.json', JSON.stringify({
    videos: Array.from(videoUrls),
    images: Array.from(mediaUrls),
    videosOnPage,
    iframes
  }, null, 2));

  await browser.close();
}

scrapeLiveSite().catch(err => {
  console.error('Scrape error:', err);
  process.exit(1);
});
