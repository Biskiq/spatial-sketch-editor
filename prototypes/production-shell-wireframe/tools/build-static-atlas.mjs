#!/usr/bin/env node
// Builds ../atlas-static.html: one self-contained, scriptless snapshot of atlas.html.
//
// Each live frame (index.html?atlas=KEY) is rendered in Chromium at its own W x H, its settled
// DOM is captured (scripts removed, styles.css inlined) and placed in a srcdoc iframe with the
// same classes, scale and size the live board computed. The result opens from file:// with no
// server, no modules and no network.
//
// Usage (from the repository root):
//   node prototypes/production-shell-wireframe/tools/build-static-atlas.mjs
//   node prototypes/production-shell-wireframe/tools/build-static-atlas.mjs --base http://127.0.0.1:8850
//
// Without --base the script serves this folder itself on an ephemeral port and stops it on exit.
// It uses Playwright from prototypes/experience-authoring/node_modules.

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TOOL_DIR, '..'); // prototypes/production-shell-wireframe
const REPO = resolve(ROOT, '..', '..');
const OUT = join(ROOT, 'atlas-static.html');

const require = createRequire(join(REPO, 'prototypes', 'experience-authoring', 'build-static-atlas.cjs'));
const { chromium } = require('playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://local');
      const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'atlas.html';
      const file = resolve(ROOT, rel);
      if (!file.startsWith(ROOT + sep)) return void res.writeHead(403).end();
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// Runs inside each live frame page: returns a scriptless, self-contained HTML document.
function captureFrame(cssText) {
  const live = [...document.querySelectorAll('input, textarea')];
  const root = document.documentElement.cloneNode(true);
  // Mirror state that lives in properties, not attributes, so the snapshot matches the live DOM.
  const mirror = [...root.querySelectorAll('input, textarea')];
  live.forEach((el, i) => {
    const m = mirror[i];
    if (!m) return;
    if (el.tagName === 'TEXTAREA') m.textContent = el.value;
    else {
      m.setAttribute('value', el.value);
      if (el.checked) m.setAttribute('checked', '');
    }
  });
  for (const el of root.querySelectorAll('script, .wfbar, #tourlayer, #wfmenu, link[rel="preload"], link[rel="modulepreload"]')) el.remove();
  for (const link of root.querySelectorAll('link[rel="stylesheet"]')) {
    const style = root.ownerDocument.createElement('style');
    style.textContent = cssText;
    link.replaceWith(style);
  }
  return '<!doctype html>\n' + root.outerHTML;
}

async function main() {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf('--base');
  let server = null;
  let base = baseIndex >= 0 ? args[baseIndex + 1] : null;
  if (!base) {
    server = await startServer();
    base = `http://127.0.0.1:${server.address().port}`;
  }
  base = base.replace(/\/$/, '');

  const css = await readFile(join(ROOT, 'styles.css'), 'utf8');
  if (css.includes('</style')) throw new Error('styles.css contains "</style"; cannot inline it safely');

  const browser = await chromium.launch();
  try {
    // 1. Read the live board: tile keys, frame sizes and the scale its script computed.
    const board = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await board.newPage();
    await page.goto(`${base}/atlas.html`, { waitUntil: 'load' });
    const tiles = await page.evaluate(() =>
      [...document.querySelectorAll('figure.tile[data-k]')].map((t) => ({
        k: t.dataset.k,
        w: +(t.dataset.w || 1280),
        h: +(t.dataset.h || 800),
        spec: t.dataset.k.startsWith('spec-'),
      })),
    );
    // Scroll through the board so every lazy iframe is created and loaded.
    for (let y = 0; ; y += 300) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(120);
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      if (y >= max) break;
    }
    await page.waitForFunction(
      () => [...document.querySelectorAll('.vp iframe')].every((f) => {
        try { return f.contentDocument?.body?.classList.contains('atlas'); } catch { return false; }
      }),
      null,
      { timeout: 120000 },
    );
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    const scales = await page.evaluate(() =>
      [...document.querySelectorAll('.vp iframe')].map((f) => ({
        k: f.closest('figure').dataset.k,
        transform: f.style.transform,
        width: f.style.width,
        height: f.style.height,
        vpHeight: f.parentElement.style.height,
      })),
    );

    // 2. Capture each live frame in its own W x H page, in a fresh context.
    const snapshots = {};
    const frameErrors = {};
    for (const t of tiles.filter((x) => !x.spec)) {
      const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h } });
      const p = await ctx.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(String(e)));
      p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      try {
        await p.goto(`${base}/index.html?atlas=${encodeURIComponent(t.k)}`, { waitUntil: 'networkidle' });
        await p.waitForFunction(() => document.body.classList.contains('atlas'));
        await p.waitForTimeout(600);
        snapshots[t.k] = await p.evaluate(captureFrame, css);
        frameErrors[t.k] = errors;
      } finally {
        await ctx.close();
      }
    }

    // 3. Rewrite the live board's own DOM into the static board.
    const fitScript = `(function () {
  var tiles = document.querySelectorAll('figure.tile[data-k]');
  function fit() {
    for (var i = 0; i < tiles.length; i++) {
      var vp = tiles[i].querySelector('.vp');
      var f = vp && vp.querySelector('iframe');
      if (!f) continue;
      var w = +f.getAttribute('width'), h = +f.getAttribute('height');
      var s = vp.clientWidth / w;
      f.style.width = w + 'px';
      f.style.height = h + 'px';
      f.style.transform = 'scale(' + s + ')';
      vp.style.height = h * s + 'px';
    }
  }
  window.addEventListener('resize', fit);
  fit();
})();`;

    await page.evaluate(({ snaps, fit }) => {
      for (const tile of document.querySelectorAll('figure.tile[data-k]')) {
        const k = tile.dataset.k;
        if (k.startsWith('spec-')) continue;
        const vp = tile.querySelector('.vp');
        const live = vp.querySelector('iframe');
        const f = document.createElement('iframe');
        f.setAttribute('width', live.getAttribute('width'));
        f.setAttribute('height', live.getAttribute('height'));
        f.title = live.title;
        f.tabIndex = -1;
        f.setAttribute('srcdoc', snaps[k]);
        f.style.cssText = live.style.cssText;
        live.replaceWith(f);
        vp.querySelector('a.live')?.remove();
      }
      for (const s of document.querySelectorAll('script')) s.remove();
      document.title = 'Biskiq shell atlas, static snapshot';
      document.querySelector('.ttl').innerHTML = 'Production shell<br>Visual-language atlas — round 2, static';
      document.querySelector('p.intro').innerHTML =
        'Every frame below is a <b>static snapshot of round 2</b> (regenerate with <code>tools/build-static-atlas.mjs</code>). ' +
        'Each frame is the wireframe in one scripted state (<code>index.html?atlas=…</code>), captured as HTML and stored inside this file. ' +
        'It needs no server, no scripts and no network, and it does not respond to hover or clicks. ' +
        '<b>Unratified exploration</b>: nothing here amends PLATE or production. Read ' +
        '<a href="DESIGN-NOTE.md" style="color:#cfdcd2">DESIGN-NOTE.md</a> for the reasoning, the open choices and the proposed departures.';
      document.querySelector('footer').innerHTML =
        'Wireframe chrome, not product. Frames are rendered at their simulated size and scaled to fit. ' +
        'The live wireframe needs its local server (<code>python3 serve.py 8850</code>); this file does not.';
      const script = document.createElement('script');
      script.textContent = fit;
      document.body.appendChild(script);
      return null;
    }, { snaps: snapshots, fit: fitScript });

    const html = await page.evaluate(() => '<!doctype html>\n' + document.documentElement.outerHTML);
    await writeFile(OUT, html, 'utf8');
    await board.close();

    // 4. Report.
    const frames = tiles.filter((t) => !t.spec);
    console.log(`base: ${base}`);
    console.log(`tiles: ${tiles.length} (${frames.length} live frames, ${tiles.length - frames.length} spec)`);
    for (const s of scales) console.log(`  ${s.k.padEnd(18)} ${s.width} x ${s.height}  ${s.transform}`);
    const problems = Object.entries(frameErrors).filter(([, e]) => e.length);
    console.log(problems.length ? `frame console/page errors: ${JSON.stringify(Object.fromEntries(problems))}` : 'frame console/page errors: none');
    console.log(`wrote ${OUT} (${(html.length / 1048576).toFixed(2)} MiB)`);
  } finally {
    await browser.close();
    if (server) server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
