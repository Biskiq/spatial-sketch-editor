const fs = require('fs');
const { chromium } = require('/Users/tony/Documents/Biskiq/spatial-sketch-editor/node_modules/playwright');
const [COOKIE_FILE, PID, VW, VH] = process.argv.slice(2);
const cookieValue = fs.readFileSync(COOKIE_FILE, 'utf8').split('\n').map((l) => l.split('\t')).find((c) => c.length >= 7 && c[5] === 'museum-editor-session')[6];
(async () => { const browser = await chromium.launch({ headless: true }); try {
  const context = await browser.newContext({ viewport: { width: +VW, height: +VH } });
  await context.addCookies([{ name: 'museum-editor-session', value: cookieValue, domain: 'localhost', path: '/', httpOnly: true }]);
  const page = await context.newPage();
  await page.goto(`http://localhost:5173/project/${PID}/spatial`, { waitUntil: 'load' });
  await page.getByRole('application', { name: 'Spatial stage' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  if (+VW >= 1280) { /* index open */ } else { await page.getByRole('button', { name: 'Index' }).first().click(); await page.waitForTimeout(300); }
  await page.getByRole('button', { name: /^Wall Wall 1/ }).first().click();
  if (+VW < 1280) { await page.getByRole('button', { name: 'Index' }).first().click(); }
  await page.waitForTimeout(1200);
  const out = await page.evaluate(() => {
    const card = document.querySelector('aside.card');
    const cb = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const x = Math.round(cb.left + cb.width / 2) + 0, y = 850;
    const px = Math.round(cb.left + cb.width * 0.5);
    const describe = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return { tag: el.tagName.toLowerCase(), cls: (el.className && el.className.baseVal === undefined ? el.className : '') + '', id: el.id || null, aria: el.getAttribute('aria-label'), rect: [b.left, b.top, b.right, b.bottom].map((v) => Math.round(v)), bg: s.backgroundColor, bgImg: s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 60) : null, opacity: s.opacity, z: s.zIndex, pos: s.position, overflow: s.overflow, pe: s.pointerEvents, outline: s.outlineStyle, filter: s.filter !== 'none' ? s.filter : null, shadow: s.boxShadow !== 'none' ? s.boxShadow.slice(0, 80) : null }; };
    const stack = document.elementsFromPoint(px, y).slice(0, 12).map(describe);
    const cardInfo = { rect: [cb.left, cb.top, cb.right, cb.bottom].map((v) => Math.round(v)), maxHeight: cs.maxHeight, bottom: cs.bottom, clientHeight: card.clientHeight, scrollHeight: card.scrollHeight, overflowY: cs.overflowY, bg: cs.backgroundColor, shadow: cs.boxShadow };
    const sheet = document.querySelector('[data-stage-height-sheet]')?.getBoundingClientRect();
    const zoom = document.querySelector('[data-stage-zoom]')?.getBoundingClientRect();
    const frame = document.querySelector('.stage-frame');
    return { probe: [px, y], card: cardInfo, stack, sheet: sheet ? [sheet.left, sheet.top, sheet.right, sheet.bottom].map(Math.round) : null, zoom: zoom ? [zoom.left, zoom.top, zoom.right, zoom.bottom].map(Math.round) : null, frameVars: frame.getAttribute('style'), viewport: [innerWidth, innerHeight] };
  });
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); } })().catch((e) => { console.error('FAILED', String(e).slice(0, 400)); process.exitCode = 1; });
