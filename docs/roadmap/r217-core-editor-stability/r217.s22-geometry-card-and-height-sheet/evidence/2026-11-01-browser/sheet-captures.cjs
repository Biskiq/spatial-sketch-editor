// R217.S23 task-owned captures of the Height Sheet on the light ground (Playwright Chromium).
// For each state: a PNG of the Stage and a JSON of the Sheet's element rects and computed inks.
// Usage: node sheet-captures.cjs <outDir> <projectId> <cookieFile>
const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/tony/Documents/Biskiq/spatial-sketch-editor/node_modules/playwright');
const [OUT, PID, COOKIE_FILE] = process.argv.slice(2);
const cookieValue = fs.readFileSync(COOKIE_FILE, 'utf8').split('\n').map((l) => l.split('\t')).find((c) => c.length >= 7 && c[5] === 'museum-editor-session')[6];
const URL = `http://localhost:5173/project/${PID}/spatial`;

const ITEMS = `(() => {
  const sheet = document.querySelector('[data-stage-height-sheet]');
  const box = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map((v) => Math.round(v * 10) / 10); };
  const items = [];
  const add = (name, el, prop, kind) => { if (!el) return; const cs = getComputedStyle(el); items.push({ name, kind, rect: box(el), ink: cs[prop], visible: parseFloat(cs.opacity) > 0.5 && cs.visibility !== 'hidden' }); };
  const track = sheet.querySelector('.track');
  const tb = track.getBoundingClientRect();
  const cx = tb.left + tb.width / 2;
  items.push({ name: 'capsule-plate', kind: 'plate', rect: [cx - 10, tb.top, cx + 10, tb.bottom].map((v) => Math.round(v * 10) / 10), ink: null, visible: true });
  add('rail', sheet.querySelector('.rail'), 'backgroundColor', 'line');
  sheet.querySelectorAll('.tick').forEach((t, i) => add('tick-' + i + ':' + (t.getAttribute('title') || ''), t, 'backgroundColor', 'line'));
  add('knob-ring', sheet.querySelector('.knob'), 'borderTopColor', 'line');
  add('add-glyph', sheet.querySelector('.add'), 'color', 'text');
  add('add-face', sheet.querySelector('.add'), 'backgroundColor', 'plate-face');
  sheet.querySelectorAll('.pin').forEach((p, i) => { add('pin-glyph-' + i, p, 'color', 'text'); add('pin-face-' + i, p, 'backgroundColor', 'plate-face'); });
  add('readout', sheet.querySelector('.readout'), 'color', 'text');
  add('snap', sheet.querySelector('.snap'), 'color', 'text');
  document.querySelectorAll('.tick-label').forEach((t, i) => add('label-' + i + ':' + t.textContent.trim(), t, 'color', 'text'));
  add('hint', document.querySelector('p.hint[data-pin-hint]'), 'color', 'text');
  const card = document.querySelector('aside.card');
  const shell = { sheet: box(sheet), card: card ? box(card) : null, zoom: document.querySelector('[data-stage-zoom]') ? box(document.querySelector('[data-stage-zoom]')) : null, dock: document.querySelector('nav[aria-label="Tools"]') ? box(document.querySelector('nav[aria-label="Tools"]')) : null };
  return JSON.stringify({ viewport: [innerWidth, innerHeight], coarse: matchMedia('(pointer: coarse)').matches, ticks: [...sheet.querySelectorAll('.tick')].map((t) => t.getAttribute('title')), labels: [...document.querySelectorAll('.tick-label')].map((t) => t.textContent.trim()), items, shell, sheetOverflowX: sheet.scrollWidth > sheet.clientWidth + 1 });
})()`;

async function openStage(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(URL, { waitUntil: 'load' });
  await page.getByRole('application', { name: 'Spatial stage' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Index' }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
}

async function selectWall(page, viewport) {
  // The Index is open at wide widths and folded below 1280 px; select Wall 1 from it either way.
  const index = page.getByRole('button', { name: 'Index' }).first();
  const indexOpen = await page.evaluate(() => { const i = document.querySelector('.plate-index'); return !!i && getComputedStyle(i).display !== 'none'; });
  if (!indexOpen) await index.click();
  await page.getByRole('button', { name: /^Wall Wall 1/ }).first().click();
  if (!indexOpen) await index.click();
  await page.waitForTimeout(500);
}

async function setAppearance(page, mode) {
  if (mode !== 'shaded-2d') return;
  // The appearance is a preference: set it before a Wall is selected, so Find's list is not covered.
  await page.keyboard.press('Control+k');
  await page.getByRole('button', { name: /Set 2D appearance: Shaded/ }).first().click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function setMode(page, mode) {
  if (mode === '3d') return;
  await page.getByRole('button', { name: '2D', exact: true }).first().click();
  await page.waitForTimeout(1200);
}

async function captureState(page, name, viewport, mode, state) {
  await openStage(page, viewport);
  await setAppearance(page, mode);
  await selectWall(page, viewport);
  await setMode(page, mode);
  const sheet = page.locator('[data-stage-height-sheet]');
  if (state === 'pinned') {
    await page.getByRole('button', { name: /^Pin the height/ }).first().click();
  } else if (state === 'dragging') {
    const box = await page.locator('[data-stage-height-sheet] .track').boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.5;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 30, { steps: 5 });
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(600);
  const info = JSON.parse(await page.evaluate(ITEMS));
  const shellInfo = JSON.parse(await page.evaluate(`(() => { const r = document.documentElement; return JSON.stringify({ horizontalOverflow: r.scrollWidth > r.clientWidth, overlaps: null }); })()`));
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  if (state === 'dragging') await page.mouse.up();
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ name, mode, state, ...info, horizontalOverflow: shellInfo.horizontalOverflow }, null, 2) + '\n');
  await sheet.count();
  return info;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const jobs = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1180, height: 820 }]) {
    for (const mode of ['3d', '2d-paper', 'shaded-2d']) {
      if (mode === 'shaded-2d' && viewport.width !== 1440) continue;
      for (const state of ['pinned', 'dragging']) jobs.push({ viewport, mode, state, name: `sheet-${mode}-${state}-${viewport.width}x${viewport.height}` });
    }
  }
  const summary = {};
  try {
    for (const job of jobs) {
      const context = await browser.newContext({ viewport: job.viewport });
      await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true }]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
      try {
        const info = await captureState(page, job.name, job.viewport, job.mode, job.state);
        summary[job.name] = { ticks: info.ticks, labels: info.labels, pageErrors: errors.length };
      } finally {
        await context.close();
      }
    }
    // Coarse pass: touch emulation, 820 x 1180, pinned in 3D.
    const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
    await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true }]);
    const page = await context.newPage();
    try {
      await openStage(page, { width: 820, height: 1180 });
      await page.getByRole('button', { name: 'Index' }).first().tap().catch(() => {});
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /^Wall Wall 1/ }).first().tap().catch(() => {});
      await page.waitForTimeout(400);
      await page.getByRole('button', { name: 'Index' }).first().tap().catch(() => {});
      await page.getByRole('button', { name: /^Pin the height/ }).first().tap();
      await page.waitForTimeout(800);
      const info = JSON.parse(await page.evaluate(ITEMS));
      await page.screenshot({ path: path.join(OUT, 'sheet-3d-pinned-coarse-820x1180.png') });
      fs.writeFileSync(path.join(OUT, 'sheet-3d-pinned-coarse-820x1180.json'), JSON.stringify({ name: 'sheet-3d-pinned-coarse-820x1180', mode: '3d', state: 'pinned', ...info }, null, 2) + '\n');
      summary['sheet-3d-pinned-coarse-820x1180'] = { ticks: info.ticks, labels: info.labels, coarse: info.coarse };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(summary, null, 1));
})().catch((e) => { console.error('FAILED', String(e.stack || e).slice(0, 600)); process.exitCode = 1; });
