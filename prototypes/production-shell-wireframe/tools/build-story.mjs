#!/usr/bin/env node
// Builds ../story.html: one end-to-end walkthrough as numbered PNG frames with captions,
// embedded as data URIs so it opens from file://. Frames are atlas presets (index.html?atlas=KEY);
// PNGs are also written to ../story/ for slides.
//
// Usage (from the repository root):
//   node prototypes/production-shell-wireframe/tools/build-story.mjs [--base http://127.0.0.1:8850]

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(ROOT, '..', '..');
const require = createRequire(join(REPO, 'prototypes', 'experience-authoring', 'x.cjs'));
const { chromium } = require('playwright');

// [atlas key, chapter, title, caption]
const FRAMES = [
  ['st-blank', 'Start', 'An empty World', 'A Biskiq project opens on one ground Level. World is where the building is authored; Experience is how visitors will move through it.'],
  ['st-wall-draw', 'Sketch', 'Draw the first wall', 'Arm Ink with the Line pen and click along the ground. The live tag reads the length as you go.'],
  ['st-wall-done', 'Sketch', 'The stroke becomes a wall', 'A line on the ground is read as a wall, risen to the next Level up. No dialog, no type picker.'],
  ['st-layout', 'Layout', 'Box out the rooms', 'Box strokes become Rooms. The reading chip appears only when a closed shape is ambiguous — room, platform or Shape.'],
  ['st-sheet', 'Sheet', 'Raise the Sheet', 'A box re-read as a raised platform gets its height pinned. The Sheet on the right is the drawing height: long ticks are Levels, short ticks found surfaces, round heads pins. Here it sits at 0.45.'],
  ['st-sheet-draw', 'Sheet', 'Draw on the raised surface', 'With the Sheet at 0.45, a Line stroke stands its wall on the platform, not on the ground.'],
  ['rest', 'Layout', 'A finished gallery', 'Skipping ahead: the Boathouse — a long gallery and a studio, with openings, a roof and objects placed.'],
  ['obj-rays', 'Arrange', 'Move and size objects directly', 'Select the bench: rays leave its faces. Drag one to stretch that side; the size read-out follows the hand.'],
  ['obj-rays-closed', 'Arrange', 'Some objects keep their proportions', 'A sculpture has one size ray that scales it as a whole. Exact numbers stay in the Card.'],
  ['wall-rays', 'Arrange', 'The same language on walls', 'A wall offers its top, ends and thickness as handles — architecture is edited like objects.'],
  ['opening', 'Arrange', 'Openings on their wall', 'A window slides along its host wall; its sill and head are handles too.'],
  ['slice', 'Inspect', 'Slice to look inside', 'The Slice tool cuts a live section with a depth. Put back restores the whole building.'],
  ['st-elev', 'Inspect', 'Elevation', 'The Reading menu turns the same model into a flat elevation of any face — S, E, N or W.'],
  ['roof-select', 'Roof', 'A common roof', 'Select the gallery roof: its eave and ridge are handles on the building itself.'],
  ['roof-3d', 'Roof', 'Edit its shape in 3D', 'Edit Shape opens the roof profile in place; each joint can be dragged.'],
  ['roof-section', 'Roof', 'Or in Section', 'Switch to Section for a true 2D profile, without losing the rest of the building.'],
  ['st-exp', 'Experience', 'Switch to Experience', 'Same Stage, Index and Card; now the subjects are Presentations — what visitors are shown.'],
  ['st-look', 'Experience', 'Capture a View', 'Look through a View: the Stage becomes the camera, framed in gold. Re-aim, then Capture or Update.'],
  ['st-guide', 'Experience', 'Build the guided tour', 'The Guide strings Stops (Presentations with a hold) and transitions — travel or cut. Play and scrub it.'],
  ['st-preview', 'Present', 'Preview as a visitor', 'Preview hands over to the visitor view: one Stop at a time, guided or free.'],
  ['st-phone', 'Present', 'Check it on a phone', 'Visitors may be on phones even though the editor is not. Exit returns exactly where you were.'],
];

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
const arg = process.argv.indexOf('--base'); let base = arg > 0 ? process.argv[arg + 1] : null, srv = null;
if (!base) {
  srv = createServer(async (q, r) => { const f = resolve(ROOT, '.' + decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(ROOT + sep)) { r.writeHead(403); return r.end(); } try { const b = await readFile(f); r.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); base = `http://127.0.0.1:${srv.address().port}`;
}
await mkdir(join(ROOT, 'story'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const cards = [];
for (const [i, [key, ch, title, cap]] of FRAMES.entries()) {
  await page.goto(`${base}/index.html?atlas=${key}`); await page.waitForTimeout(500);
  const png = await page.screenshot(); const n = String(i + 1).padStart(2, '0');
  await writeFile(join(ROOT, 'story', `${n}-${key}.png`), png);
  cards.push(`<section class="step"><div class="meta"><span class="n">${n}</span><span class="ch">${ch}</span></div><h2>${title}</h2><p>${cap}</p><img alt="${title}" src="data:image/png;base64,${png.toString('base64')}"></section>`);
  console.log(n, key, png.length);
}
await browser.close(); srv?.close();
if (errs.length) { console.error('page errors:\n' + errs.join('\n')); process.exitCode = 1; }
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Biskiq walkthrough</title><style>
:root{--bg:#f4f1ea;--ink:#1d1d1b;--mut:#6b675e;--acc:#a8842c;--card:#fffdf8;--line:#e3ddd0}
@media (prefers-color-scheme:dark){:root{--bg:#171614;--ink:#ece8df;--mut:#a29d92;--card:#201f1c;--line:#34322d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,sans-serif}
main{max-width:1180px;margin:0 auto;padding:48px 16px 96px}header h1{font-size:34px;margin:0 0 8px}header p{color:var(--mut);max-width:720px;margin:0 0 8px}
.flow{display:flex;flex-wrap:wrap;gap:6px;margin:20px 0 40px}.flow span{border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:13px;color:var(--mut)}
.step{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;margin:0 0 28px}.meta{display:flex;gap:10px;align-items:center;font-size:13px}
.n{font-weight:700;color:var(--acc)}.ch{text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}.step h2{margin:6px 0 4px;font-size:22px}.step p{margin:0 0 14px;color:var(--mut);max-width:760px}
.step img{width:100%;height:auto;display:block;border-radius:8px;border:1px solid var(--line)}
</style></head><body><main><header><h1>Biskiq, start to finish</h1><p>Biskiq is a spatial editor for exhibitions: you sketch a building in <b>World</b>, then compose what visitors see and how they move through it in <b>Experience</b>, and preview it as they will.</p><p>Wireframe captures from the production-shell prototype — ratified Round 2 evidence, not product.</p>
<div class="flow">${[...new Set(FRAMES.map((f) => f[1]))].map((c) => `<span>${c}</span>`).join('')}</div></header>${cards.join('\n')}</main></body></html>`;
await writeFile(join(ROOT, 'story.html'), html); console.log('story.html', html.length);
