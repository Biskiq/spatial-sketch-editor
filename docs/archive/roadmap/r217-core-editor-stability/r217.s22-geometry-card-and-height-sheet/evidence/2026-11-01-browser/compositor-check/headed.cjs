const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/tony/Documents/Biskiq/spatial-sketch-editor/node_modules/playwright');
const [COOKIE_FILE, PID, OUTDIR, HEADLESS] = process.argv.slice(2);
const cookieValue = fs.readFileSync(COOKIE_FILE, 'utf8').split('\n').map((l) => l.split('\t')).find((c) => c.length >= 7 && c[5] === 'museum-editor-session')[6];
(async () => { const browser = await chromium.launch({ headless: HEADLESS !== 'headed', args: HEADLESS === 'headed' ? [] : [] }); try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true }]);
  const page = await context.newPage();
  await page.goto(`http://localhost:5173/project/${PID}/spatial`, { waitUntil: 'load' });
  await page.getByRole('application', { name: 'Spatial stage' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /^Wall Wall 1/ }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTDIR, `mode-${HEADLESS}.png`) });
  console.log('captured', HEADLESS, await page.evaluate(() => navigator.userAgent.includes('HeadlessChrome') ? 'headless-ua' : 'headed-ua'));
} finally { await browser.close(); } })().catch((e) => { console.error('FAILED', String(e).slice(0, 300)); process.exitCode = 1; });
