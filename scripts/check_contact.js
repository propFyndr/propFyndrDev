const { chromium } = require('playwright');
const fs = require('fs');

async function checkContact() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://www.bepeak.in/contact', { waitUntil: 'load', timeout: 20000 });
    console.log('Contact title:', await page.title());
    await page.screenshot({ path: 'C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/page_contact.png', fullPage: true });
  } catch (e) {
    console.log('Contact error:', e.message);
  }
  await browser.close();
}

checkContact();
