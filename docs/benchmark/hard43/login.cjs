// Opens a persistent Chrome profile on perplexity.ai so the owner can log in by hand.
// Profile lives outside the repo. Close the window when logged in; this script then exits.
const { chromium } = require('../../../node_modules/playwright-core');
const profile = process.env.PPLX_PROFILE;
(async () => {
  const ctx = await chromium.launchPersistentContext(profile, { headless: false, channel: 'chrome', viewport: null });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://www.perplexity.ai/');
  ctx.on('close', () => process.exit(0));
  await new Promise(() => {});
})();
