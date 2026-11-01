const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/tony/Documents/Biskiq/spatial-sketch-editor/node_modules/playwright');
const [COOKIE_FILE, PID, OUTDIR] = process.argv.slice(2);
const cookieValue = fs.readFileSync(COOKIE_FILE, 'utf8').split('\n').map((l) => l.split('\t')).find((c) => c.length >= 7 && c[5] === 'museum-editor-session')[6];
const VARIANTS = {
  base: null,
  'no-transition': 'aside.card { transition: none !important; }',
  'overflow-hidden': 'aside.card { overflow: hidden !important; }',
  'no-transition-no-shadow': 'aside.card { transition: none !important; box-shadow: none !important; }',
  'stage-bg-red': '.stage { background: #ff0000 !important; }',
  'canvas-bg-green': 'canvas { background: #00ff00 !important; }',
  'canvas-hidden': 'canvas { visibility: hidden !important; }',
  'card-display-none': 'aside.card { display: none !important; }',
  'no-box-shadow': 'aside.card { box-shadow: none !important; }',
  'max-height-none': 'aside.card { max-height: none !important; }',
  'overflow-visible': 'aside.card { overflow: visible !important; }',
  'opacity-zero': 'aside.card { opacity: 0 !important; transition: none !important; }',
  'zoom-hidden': '.stage-zoom-slot { display: none !important; }',
};
(async () => { const browser = await chromium.launch({ headless: true }); try {
  for (const [name, css] of Object.entries(VARIANTS)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true }]);
    const page = await context.newPage();
    await page.goto(`http://localhost:5173/project/${PID}/spatial`, { waitUntil: 'load' });
    await page.getByRole('application', { name: 'Spatial stage' }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /^Wall Wall 1/ }).first().click();
    await page.waitForTimeout(1000);
    if (css) { await page.addStyleTag({ content: css }); await page.waitForTimeout(400); }
    await page.screenshot({ path: path.join(OUTDIR, `probe-${name}.png`) });
    console.log('captured', name);
    await context.close();
  }
} finally { await browser.close(); } })().catch((e) => { console.error('FAILED', String(e).slice(0, 400)); process.exitCode = 1; });
