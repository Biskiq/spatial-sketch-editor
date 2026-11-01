// R217.S22 task-owned pass: edit a subject under the expanded Card at 1180x820 (fine pointer).
// Press on Wall 1's movable end handle outside the Card, drag into the Card's area, record the
// Card's state while the drag is live and after release. Usage: node edit-under-card.cjs <outDir> <projectId> <cookieFile>
const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/tony/Documents/Biskiq/spatial-sketch-editor/node_modules/playwright');
const [OUT, PID, COOKIE_FILE] = process.argv.slice(2);
const cookieValue = fs.readFileSync(COOKIE_FILE, 'utf8').split('\n').map((l) => l.split('\t')).find((c) => c.length >= 7 && c[5] === 'museum-editor-session')[6];
const CARD = `(() => { const c = document.querySelector('aside.card'); const b = c.getBoundingClientRect(); const cs = getComputedStyle(c); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return JSON.stringify({ opacity: cs.opacity, pointerEvents: cs.pointerEvents, gesturing: c.getAttribute('data-card-gesturing'), rect: [b.left, b.top, b.width, b.height].map((v) => Math.round(v)), hitAtCardCenterIsCard: c.contains(hit), fold: c.querySelector('.head-actions button').textContent.trim() }); })()`;
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true }]);
    const page = await context.newPage();
    await page.goto(`http://localhost:5173/project/${PID}/spatial`, { waitUntil: 'load' });
    await page.getByRole('application', { name: 'Spatial stage' }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: 'Index' }).first().click();
    await page.getByRole('button', { name: /^Wall Wall 1/ }).first().click();
    await page.getByRole('button', { name: 'Index' }).first().click();
    await page.locator('aside.card .head-actions button').first().click();
    await page.waitForTimeout(500);
    const before = await page.evaluate(CARD);
    await page.mouse.move(737, 387);
    await page.mouse.down();
    await page.mouse.move(800, 392, { steps: 4 });
    await page.mouse.move(900, 400, { steps: 4 });
    await page.waitForTimeout(400);
    const during = await page.evaluate(CARD);
    await page.screenshot({ path: path.join(OUT, 'edit-under-card-1180x820-during.png') });
    await page.mouse.up();
    await page.waitForTimeout(600);
    const after = await page.evaluate(CARD);
    await page.screenshot({ path: path.join(OUT, 'edit-under-card-1180x820-after.png') });
    fs.writeFileSync(path.join(OUT, 'edit-under-card-1180x820.json'), JSON.stringify({ before: JSON.parse(before), during: JSON.parse(during), after: JSON.parse(after) }, null, 2) + '\n');
    console.log(JSON.stringify({ before: JSON.parse(before), during: JSON.parse(during), after: JSON.parse(after) }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAILED', String(e).slice(0, 400)); process.exitCode = 1; });
