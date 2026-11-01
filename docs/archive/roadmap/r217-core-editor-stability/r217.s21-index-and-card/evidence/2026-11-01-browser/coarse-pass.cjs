// Task-owned coarse-pointer pass (touch emulation, Chromium). Builds the S21 scene at 1440x900,
// then measures every visible Card and Index control at 820x1180 and 1180x820.
const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/tony/Documents/Biskiq/spatial-sketch-editor/node_modules/playwright');
const LABEL = process.argv[2] || 'run';
const OUT = process.argv[3];
const BASE = 'http://127.0.0.1:5273/editor';
const LONG = 'The long exterior wall of the east range, with its later-added return to the courtyard';

const MEASURE = `(() => {
  const vw = document.documentElement.clientWidth;
  const sw = document.documentElement.scrollWidth;
  const sels = '.card button, .card summary, .card input, .plate-index button, .plate-index input, .plate-index summary';
  const out = [];
  for (const el of document.querySelectorAll(sels)) {
    if (el.closest('[hidden]')) continue;
    const details = el.closest('details');
    if (details && !details.open && el.tagName !== 'SUMMARY') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const region = el.closest('.card') ? 'card' : 'index';
    const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('data-field') || el.getAttribute('name') || el.type || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 70);
    const w = Math.round(r.width * 10) / 10, h = Math.round(r.height * 10) / 10;
    out.push({ region, tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || '', label, w, h, pass: w >= 44 && h >= 44, inView: r.right <= vw + 0.5 });
  }
  return JSON.stringify({ coarse: matchMedia('(pointer: coarse)').matches, viewport: [innerWidth, innerHeight], scrollWidth: sw, clientWidth: vw, horizontalOverflow: sw > vw, controls: out });
})()`;

async function tapRow(page, id) {
  const sel = id === 'opening' ? '.item[data-source-id^="layout:opening:"] .item-row' : `.item[data-source-id$=":${id}"] .item-row`;
  await page.locator(sel).tap();
  await page.waitForTimeout(700);
}
async function ensureIndex(page) {
  const t = page.locator('[data-head-index]');
  if ((await t.getAttribute('aria-expanded')) === 'false') { await t.click(); await page.waitForTimeout(500); }
}
async function ensureCard(page) {
  const b = page.locator('.card .head-actions button[aria-expanded="false"]');
  if (await b.count()) { await b.first().click(); await page.waitForTimeout(500); }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForURL(/\/spatial/, { timeout: 30000 });
  await page.waitForTimeout(1500);

  // Build the scene (fine-pointer geometry, same clicks as the S21 browser matrix).
  await page.locator('summary').filter({ hasText: /^Find$/ }).click();
  await page.locator('[data-head-find] button', { hasText: 'Use enclosed room starter' }).click();
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await page.waitForSelector('.item[data-source-id$=":wall-chain-1.starter-template"]', { timeout: 30000 });
  await page.waitForTimeout(1500);

  await tapRow(page, 'wall-chain-1.starter-template');
  await page.fill('.rename input', LONG); await page.press('.rename input', 'Enter'); await page.waitForTimeout(600);
  for (const n of [2, 3]) {
    await tapRow(page, `wall-chain-${n}.starter-template`);
    await page.fill('.rename input', 'Party wall'); await page.press('.rename input', 'Enter'); await page.waitForTimeout(600);
  }
  await page.locator('[aria-label="Ink · Wall"]').click(); await page.waitForTimeout(500);
  await page.getByRole('radio', { name: 'Opening' }).check(); await page.waitForTimeout(400);
  await page.mouse.move(830, 366); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(1200);
  await page.locator('[aria-label="Select"]').click(); await page.waitForTimeout(400);
  await page.locator('[aria-label="Objects"]').click(); await page.waitForTimeout(500);
  await page.locator('button', { hasText: /^Sphere$/ }).click(); await page.waitForTimeout(300);
  await page.mouse.move(850, 480); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(1200);
  await page.locator('button', { hasText: /^Box$/ }).click(); await page.waitForTimeout(300);
  await page.mouse.move(730, 505); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(1200);
  await page.locator('[aria-label="Select"]').click(); await page.waitForTimeout(400);
  const names = await page.locator('.item .item-name').allTextContents();
  console.log('scene:', names.join(' | '));

  const states = [];
  for (const [W, H] of [[820, 1180], [1180, 820]]) {
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(1200);
    const tag = `${W}x${H}`;
    await ensureIndex(page);
    // Wall: row selected by tap, Card expanded, More and this row's Actions disclosed.
    await tapRow(page, 'wall-chain-3.starter-template'); await ensureCard(page);
    await page.locator('.card [data-card-more] summary').tap().catch(async () => { await page.locator('.card [data-card-more] summary').click(); });
    await page.locator('.item[data-source-id$=":wall-chain-3.starter-template"] .item-actions-toggle').tap();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `${LABEL}-wall-${tag}.png`) });
    states.push({ state: 'wall', tag, ...JSON.parse(await page.evaluate(MEASURE)) });
    // Opening (Door): Card expanded, More open.
    await tapRow(page, 'opening'); await ensureCard(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${LABEL}-opening-${tag}.png`) });
    states.push({ state: 'opening', tag, ...JSON.parse(await page.evaluate(MEASURE)) });
    // Object (Sphere): More opened, Duplicate and Focus reachable.
    await page.locator('.item[data-source-id^="scene:entity:"]:has(.item-kind:text-is("Primitive")) .item-row').tap(); await page.waitForTimeout(700);
    await ensureCard(page);
    await page.locator('.card [data-card-more] summary').tap().catch(async () => { await page.locator('.card [data-card-more] summary').click(); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${LABEL}-object-${tag}.png`) });
    states.push({ state: 'object', tag, ...JSON.parse(await page.evaluate(MEASURE)) });
    // Native form (Shape): the form's own writer and Delete.
    await page.locator('.item[data-source-id^="scene:entity:"]:has(.item-kind:text-is("Form")) .item-row').tap(); await page.waitForTimeout(700);
    await ensureCard(page); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${LABEL}-form-${tag}.png`) });
    states.push({ state: 'form', tag, ...JSON.parse(await page.evaluate(MEASURE)) });
  }
  const result = { label: LABEL, minTargetPx: 44, method: 'Chromium via Playwright, hasTouch and isMobile emulation (pointer: coarse matches)', states, errors };
  fs.writeFileSync(path.join(OUT, `coarse-pointer-targets-${LABEL}.json`), JSON.stringify(result, null, 1));
  let total = 0, failing = [];
  for (const s of states) for (const c of s.controls) { total++; if (!c.pass) failing.push({ state: s.state, tag: s.tag, ...c }); }
  console.log(JSON.stringify({ label: LABEL, controls: total, failing: failing.length, failingSample: failing.slice(0, 8), errors: errors.length, overflow: states.some((s) => s.horizontalOverflow), coarse: states.every((s) => s.coarse) }));
  await browser.close();
})().catch((e) => { console.error('ERR', e.stack || e.message); process.exit(1); });
