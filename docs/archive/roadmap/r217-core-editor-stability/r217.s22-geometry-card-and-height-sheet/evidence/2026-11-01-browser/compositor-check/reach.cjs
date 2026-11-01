const fs = require('fs');
const { chromium } = require('/Users/tony/Documents/Biskiq/spatial-sketch-editor/node_modules/playwright');
const [COOKIE_FILE, PID] = process.argv.slice(2);
const cookieValue = fs.readFileSync(COOKIE_FILE, 'utf8').split('\n').map((l) => l.split('\t')).find((c) => c.length >= 7 && c[5] === 'museum-editor-session')[6];
const CHECK = `(() => {
  const card = document.querySelector('aside.card');
  const cr = card.getBoundingClientRect();
  const clientBottom = cr.top + card.clientTop + card.clientHeight;
  const els = [...card.querySelectorAll('button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), a[href]')].filter((el) => { const cs = getComputedStyle(el); return el.getBoundingClientRect().width > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && !el.closest('details:not([open])') || el.tagName === 'SUMMARY'; });
  const rows = [];
  for (const el of els) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const b = el.getBoundingClientRect();
    const inside = b.top >= cr.top + card.clientTop - 0.5 && b.bottom <= clientBottom + 0.5 && b.left >= cr.left && b.right <= cr.right;
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const reachable = !!top && (top === el || el.contains(top));
    rows.push({ label: (el.getAttribute('aria-label') || el.getAttribute('data-card-action') || el.textContent || el.tagName).replace(/\\s+/g, ' ').trim().slice(0, 40), tag: el.tagName.toLowerCase(), inside, reachable, w: Math.round(b.width), h: Math.round(b.height) });
  }
  return JSON.stringify({ scrollable: card.scrollHeight > card.clientHeight, clientHeight: card.clientHeight, scrollHeight: card.scrollHeight, count: rows.length, notInside: rows.filter((r) => !r.inside).map((r) => r.label), notReachable: rows.filter((r) => !r.reachable).map((r) => r.label), rows });
})()`;
(async () => { const browser = await chromium.launch({ headless: true }); try {
  for (const [VW, VH] of [[1440, 900], [1180, 820]]) {
    const context = await browser.newContext({ viewport: { width: VW, height: VH } });
    await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true }]);
    const page = await context.newPage();
    await page.goto(`http://localhost:5173/project/${PID}/spatial`, { waitUntil: 'load' });
    await page.getByRole('application', { name: 'Spatial stage' }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);
    if (VW < 1280) await page.getByRole('button', { name: 'Index' }).first().click();
    await page.getByRole('button', { name: /^Wall Wall 1/ }).first().click();
    if (VW < 1280) await page.getByRole('button', { name: 'Index' }).first().click();
    await page.waitForTimeout(800);
    const fold = await page.evaluate(() => document.querySelector('aside.card .head-actions button').textContent.trim());
    if (fold === 'Expand') { await page.locator('aside.card .head-actions button').first().click(); await page.waitForTimeout(500); }
    // Technical details and More start closed: open More first (its actions join the walk), then Technical details.
    await page.locator('aside.card details.more summary').click();
    await page.waitForTimeout(200);
    const before = JSON.parse(await page.evaluate(CHECK));
    await page.locator('aside.card details.technical summary').click();
    await page.waitForTimeout(300);
    const after = JSON.parse(await page.evaluate(CHECK));
    const scrolledToBottom = await page.evaluate(() => { const c = document.querySelector('aside.card'); c.scrollTop = c.scrollHeight; const s = [...c.querySelectorAll('details.technical summary')][0].getBoundingClientRect(); const cr = c.getBoundingClientRect(); return { summaryInside: s.bottom <= cr.bottom + 0.5 && s.top >= cr.top, scrollTop: c.scrollTop }; });
    const canonical = await page.evaluate(() => { const c = document.querySelector('aside.card'); const dd = [...c.querySelectorAll('.technical dt')].find((t) => t.textContent.includes('Canonical ID')); const b = dd.getBoundingClientRect(); const cr = c.getBoundingClientRect(); return { inside: b.top >= cr.top && b.bottom <= cr.bottom }; });
    console.log(JSON.stringify({ viewport: [VW, VH], scrollable: before.scrollable, clientHeight: before.clientHeight, scrollHeight: before.scrollHeight, controlsBeforeTechnical: before.count, controlsAfterTechnical: after.count, notInside: after.notInside, notReachable: after.notReachable, technicalSummaryInsideAtBottom: scrolledToBottom.summaryInside, canonicalIdInsideAtBottom: canonical.inside }));
    await context.close();
  }
} finally { await browser.close(); } })().catch((e) => { console.error('FAILED', String(e).slice(0, 400)); process.exitCode = 1; });
