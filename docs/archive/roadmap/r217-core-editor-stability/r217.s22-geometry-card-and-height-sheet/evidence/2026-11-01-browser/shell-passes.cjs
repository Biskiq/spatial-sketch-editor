// R217.S22 task-owned browser passes (Playwright Chromium, one context closed at exit):
//   keyboard  — Tab through every Wall Card control with a PNG per stop, then operate each control
//   coarse    — touch emulation (hasTouch, pointer: coarse) at 820x1180 and 1180x820, every
//               visible Stage-shell control measured against 44 x 44 CSS px
// Usage: node shell-passes.cjs <keyboard|coarse> <outDir> <projectId> <cookieFile>
const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/tony/Documents/Biskiq/spatial-sketch-editor/node_modules/playwright');

const [mode, OUT, PID, COOKIE_FILE] = process.argv.slice(2);
const URL = `http://localhost:5173/project/${PID}/spatial`;
const cookieValue = fs
  .readFileSync(COOKIE_FILE, 'utf8')
  .split('\n')
  .map((line) => line.split('\t'))
  .find((cols) => cols.length >= 7 && cols[5] === 'museum-editor-session')[6];

const DESCRIBE = `(() => {
  const a = document.activeElement;
  const r = a.getBoundingClientRect();
  const card = document.querySelector('aside.card');
  return {
    tag: a.tagName.toLowerCase(),
    type: a.getAttribute('type'),
    label: (a.getAttribute('aria-label') || a.getAttribute('data-card-action') || a.getAttribute('data-field') || a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    inCard: !!card && card.contains(a),
    rect: [r.left, r.top, r.width, r.height].map((v) => Math.round(v)),
    expanded: a.getAttribute('aria-expanded')
  };
})()`;

const CARD_STATE = `(() => {
  const card = document.querySelector('aside.card');
  if (!card) return { cardPresent: false };
  const b = card.getBoundingClientRect();
  return {
    cardPresent: true,
    fold: card.querySelector('.head-actions button')?.textContent.trim() ?? null,
    title: card.querySelector('h2.name')?.textContent ?? null,
    alert: card.querySelector('[role=alert]')?.textContent.trim() ?? null,
    disclosed: [...card.querySelectorAll('button')].filter((b2) => b2.textContent.includes('Confirm') || b2.textContent.trim() === 'Cancel').map((b2) => b2.textContent.trim()),
    moreOpen: card.querySelector('details.more')?.open ?? null,
    techOpen: card.querySelector('details.technical')?.open ?? null,
    rect: [b.left, b.top, b.width, b.height].map((v) => Math.round(v))
  };
})()`;

async function selectWall(page) {
  await page.getByRole('button', { name: /^Wall Wall 1/ }).first().click();
  await page.locator('aside.card').waitFor({ timeout: 10000 });
}

async function openProject(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(URL, { waitUntil: 'load' });
  await page.getByRole('application', { name: 'Spatial stage' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Index' }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
}

async function keyboard(page, errors) {
  const log = [];
  const shot = async (name) => page.screenshot({ path: path.join(OUT, name), fullPage: false });
  await openProject(page, { width: 1440, height: 900 });
  await selectWall(page);
  // Start on the Card's first header control, so Tab walks the Card in DOM order.
  await page.locator('aside.card .head-actions button').first().focus();
  for (let i = 0; i < 16; i += 1) {
    if (i > 0) await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    const d = await page.evaluate(DESCRIBE);
    log.push({ phase: 'walk', stop: i, ...d });
    await shot(`kbd-walk-wall-${String(i).padStart(2, '0')}.png`);
    if (!d.inCard && i > 2) break;
  }
  fs.writeFileSync(path.join(OUT, 'keyboard-walk-wall-1440x900.json'), JSON.stringify(log, null, 2) + '\n');

  // Operate each Card control from the keyboard; record the state after each action.
  const ops = [];
  const step = async (name, action) => {
    await action();
    await page.waitForTimeout(400);
    ops.push({ step: name, ...(await page.evaluate(CARD_STATE)), active: (await page.evaluate(DESCRIBE)).label });
    await shot(`kbd-op-${name}.png`);
  };
  const card = page.locator('aside.card');
  await step('01-collapse-enter', async () => { await card.locator('.head-actions button').first().focus(); await page.keyboard.press('Enter'); });
  await step('02-expand-enter', async () => { await page.keyboard.press('Enter'); });
  await step('03-name-type-enter', async () => {
    await card.locator('input[aria-label="Name"]').focus();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Party wall');
    await page.keyboard.press('Enter');
  });
  await page.waitForTimeout(800);
  await step('04-height-type-enter', async () => {
    await card.getByRole('textbox', { name: /^Height/ }).focus();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('3.5');
    await page.keyboard.press('Enter');
  });
  await step('05-height-refused-zero', async () => {
    await card.getByRole('textbox', { name: /^Height/ }).focus();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('0');
    await page.keyboard.press('Enter');
  });
  await step('06-delete-discloses', async () => { await card.locator('[data-card-action="layout-wall-delete"]').focus(); await page.keyboard.press('Enter'); });
  await step('07-delete-cancel', async () => { await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); });
  await step('08-bring-into-view', async () => { await card.locator('.actions .navigate').focus(); await page.keyboard.press('Enter'); });
  await step('09-more-open', async () => { await card.locator('details.more summary').focus(); await page.keyboard.press('Enter'); });
  await step('10-more-first-action', async () => { await page.keyboard.press('Tab'); });
  await step('11-more-second-action', async () => { await page.keyboard.press('Tab'); });
  await step('12-technical-open', async () => { await card.locator('details.technical summary').focus(); await page.keyboard.press('Enter'); });
  fs.writeFileSync(path.join(OUT, 'keyboard-operate-wall-1440x900.json'), JSON.stringify(ops, null, 2) + '\n');
  return { walk: log.length, operated: ops.length, errors: [...errors] };
}


async function sceneWalk(page) {
  const log = [];
  const shot = async (name) => page.screenshot({ path: path.join(OUT, name), fullPage: false });
  await openProject(page, { width: 1440, height: 900 });
  // A Scene object: arm Objects, choose Sphere, place it at the default exact position.
  await page.getByRole('button', { name: 'Objects' }).first().click();
  await page.getByRole('button', { name: /^Place/ }).first().click();
  await page.locator('aside.card').waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  await page.locator('aside.card .head-actions button').first().focus();
  for (let i = 0; i < 20; i += 1) {
    if (i > 0) await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    const d = await page.evaluate(DESCRIBE);
    log.push({ phase: 'scene-walk', stop: i, ...d });
    await shot(`kbd-scene-${String(i).padStart(2, '0')}.png`);
    if (!d.inCard && i > 2) break;
  }
  fs.writeFileSync(path.join(OUT, 'keyboard-walk-scene-1440x900.json'), JSON.stringify(log, null, 2) + '\n');
  // Operate: Collapse and expand, Bring into view, More, and Technical details, all by keyboard.
  const ops = [];
  const card = page.locator('aside.card');
  const record = async (name) => {
    await page.waitForTimeout(400);
    ops.push({ step: name, ...(await page.evaluate(CARD_STATE)), active: (await page.evaluate(DESCRIBE)).label });
    await shot(`kbd-scene-op-${name}.png`);
  };
  await card.locator('.head-actions button').first().focus();
  await page.keyboard.press('Enter');
  await record('01-collapse-enter');
  await page.keyboard.press('Enter');
  await record('02-expand-enter');
  await card.locator('.actions .navigate').focus();
  await page.keyboard.press('Enter');
  await record('03-bring-into-view');
  await card.locator('details.more summary').focus();
  await page.keyboard.press('Enter');
  await record('04-more-open');
  await card.locator('details.technical summary').focus();
  await page.keyboard.press('Enter');
  await record('05-technical-open');
  fs.writeFileSync(path.join(OUT, 'keyboard-operate-scene-1440x900.json'), JSON.stringify(ops, null, 2) + '\n');
  return { stops: log.length, labels: log.map((d) => d.label), operated: ops.length };
}

const COARSE_MEASURE = `(() => {
  const sels = 'button, summary, input, select, [role=slider], [role=button], a[href]';
  const out = [];
  for (const el of document.querySelectorAll(sels)) {
    const region = el.closest('aside.card') ? 'card' : el.closest('[data-stage-height-sheet]') ? 'sheet' : el.closest('[data-stage-zoom]') ? 'zoom' : el.closest('.stage-actions') ? 'stage-actions' : el.closest('nav[aria-label="Tools"]') ? 'dock' : el.closest('[data-stage-instrument]') ? 'palette' : el.closest('.plate-index') ? 'index' : el.closest('header') || el.closest('.head') ? 'head' : 'other';
    if (region === 'other') continue;
    const details = el.closest('details');
    if (details && !details.open && el.tagName !== 'SUMMARY') continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('data-field') || el.tagName).replace(/\\s+/g, ' ').trim().slice(0, 50);
    const w = Math.round(r.width * 10) / 10;
    const h = Math.round(r.height * 10) / 10;
    out.push({ region, tag: el.tagName.toLowerCase(), label, w, h, pass: w >= 44 && h >= 44 });
  }
  const root = document.documentElement;
  return { coarse: matchMedia('(pointer: coarse)').matches, viewport: [innerWidth, innerHeight], horizontalOverflow: root.scrollWidth > root.clientWidth, controls: out };
})()`;

async function coarse(browser, errors) {
  const results = {};
  for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    const tag = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: false });
    await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true }]);
    const page = await context.newPage();
    try {
      await page.setViewportSize(viewport);
      await openProject(page, viewport);
      // Narrow widths: the Index is closed, so open it by a tap, select Wall 1 and fold it again.
      await page.getByRole('button', { name: 'Index' }).first().tap().catch(() => {});
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /^Wall Wall 1/ }).first().tap().catch(() => {});
      await page.waitForTimeout(400);
      await page.getByRole('button', { name: 'Index' }).first().tap().catch(() => {});
      await page.locator('aside.card').waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: /^Pin the height/ }).first().tap();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `coarse-${tag}.png`) });
      const measured = await page.evaluate(COARSE_MEASURE);
      const knob = await page.evaluate(`(() => { const k = document.querySelector('[data-stage-height-sheet] .knob'); const r = k.getBoundingClientRect(); return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; })()`);
      results[tag] = { ...measured, knob, below44: measured.controls.filter((c) => !c.pass) };
      // The Card expanded by touch: its writer fields, actions and disclosures are measured too.
      await page.locator('aside.card .head-actions button').first().tap();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `coarse-${tag}-card-expanded.png`) });
      const expanded = await page.evaluate(COARSE_MEASURE);
      results[`${tag}-card-expanded`] = { ...expanded, knob, below44: expanded.controls.filter((c) => !c.pass) };
    } finally {
      await context.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'coarse-pointer-targets.json'), JSON.stringify(results, null, 2) + '\n');
  return Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { controls: v.controls.length, below44: v.below44.length, coarse: v.coarse, horizontalOverflow: v.horizontalOverflow, knob: v.knob }]));
}

(async () => {
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  try {
    if (mode === 'scene') {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true }]);
      const page = await context.newPage();
      console.log(JSON.stringify(await sceneWalk(page)));
      await context.close();
    } else if (mode === 'keyboard') {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true }]);
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      const summary = await keyboard(page, errors);
      console.log(JSON.stringify(summary));
      await context.close();
    } else {
      console.log(JSON.stringify(await coarse(browser, errors), null, 1));
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error('FAILED', String(error && error.stack ? error.stack : error).slice(0, 800));
  process.exitCode = 1;
});
