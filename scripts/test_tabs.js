const { chromium } = require('playwright');

async function testTabs() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5000/', { waitUntil: 'networkidle' });

  // Click About
  await page.click('button:has-text("About")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/test_about.png', fullPage: true });

  // Click Contact Us
  await page.click('button:has-text("Contact Us")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/test_contact_modal.png' });

  // Close modal and click Contact in footer
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('footer button:has-text("Contact")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/test_contact_page.png', fullPage: true });

  console.log('Tabs and modal tested and screenshots saved.');
  await browser.close();
}

testTabs().catch(console.error);
