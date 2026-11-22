/*
 * Align on wall (or floor): the faced surface straight on — the camera's `face` intent, not a
 * second camera — with a metre ruler, the repeat grid, and two handles: drag the square to move
 * the pattern (offset), drag the round one to turn it. Size is the Card's real-size control.
 * Every release is one undo through the same Finish writer; "Put back" exits. The ruler, grid and
 * handles are view overlays and are never saved.
 */
import { U, setUi } from './ui-state.js';
import { TARGETS, faceFrame } from './stage.js';
import * as T from './thumbs.js';
import { $, h } from './ui-kit.js';
import * as A from './actions.js';
import * as F from './finish.js';

const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); e.append(...kids); return e; };
const mod = (a, n) => ((a % n) + n) % n;

export function renderAlign() {
  let el = $('#align');
  const A0 = U.align;
  const fm = A0 && F.finishModel();
  if (!A0 || !fm || fm.t !== A0.target) { if (el) { el.hidden = true; el.innerHTML = ''; } return; }
  el.hidden = false; el.innerHTML = '';
  const t = A0.target, fr = faceFrame(t);
  const L = fm.L, tile = L.tile[0];
  let off = [...(L.offset || [0, 0])], rot = L.rot || 0;

  // fit the faced surface into the stage area with room for rulers
  const box = el.getBoundingClientRect();
  const W = Math.max(320, box.width), H = Math.max(260, box.height - 52);
  const pad = { l: 44, r: 24, t: 20, b: 40 };
  const s = Math.min((W - pad.l - pad.r) / fr.w, (H - pad.t - pad.b) / fr.h);
  const X0 = pad.l + ((W - pad.l - pad.r) - fr.w * s) / 2, Y1 = pad.t + ((H - pad.t - pad.b) + fr.h * s) / 2;   // bottom-left of the surface
  const ts = tile * s;
  const img = T.url({ ...L, rot: 0, offset: undefined }, 'tile', 256);

  const svg = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'al-svg', role: 'img', 'aria-label': `${A.shortTarget(t)} faced straight on, ${fr.w.toFixed(1)} by ${fr.h.toFixed(1)} metres` });
  const defs = sv('defs');
  const pat = sv('pattern', { id: 'al-p', patternUnits: 'userSpaceOnUse', x: 0, y: -ts, width: ts, height: ts }, sv('image', { href: img, x: 0, y: 0, width: ts, height: ts, preserveAspectRatio: 'none' }));
  const grid = sv('pattern', { id: 'al-g', patternUnits: 'userSpaceOnUse', x: 0, y: -ts, width: ts, height: ts }, sv('path', { d: `M0 0.7h${ts - 0.7}v${ts}`, fill: 'none', stroke: '#fff', 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: 0.9 }));
  const clip = sv('clipPath', { id: 'al-c' }, sv('rect', { x: X0, y: Y1 - fr.h * s, width: fr.w * s, height: fr.h * s }));
  defs.append(pat, grid, clip); svg.append(defs);
  const area = { x: X0, y: Y1 - fr.h * s, width: fr.w * s, height: fr.h * s };
  svg.append(sv('rect', { ...area, fill: 'url(#al-p)' }), sv('rect', { ...area, fill: 'url(#al-g)', 'clip-path': 'url(#al-c)' }), sv('rect', { ...area, fill: 'none', stroke: 'rgba(18,38,29,.55)', 'stroke-width': 1.5 }));

  // rulers: metre labels, 10 cm ticks
  const ru = sv('g', { class: 'al-ruler' });
  for (let m = 0; m <= fr.w + 1e-6; m += 0.1) { const x = X0 + m * s, major = Math.abs(m - Math.round(m)) < 1e-6; ru.append(sv('line', { x1: x, x2: x, y1: Y1 + 4, y2: Y1 + (major ? 14 : 8) })); if (major) ru.append(sv('text', { x, y: Y1 + 27, 'text-anchor': 'middle' }, `${Math.round(m)} m`)); }
  for (let m = 0; m <= fr.h + 1e-6; m += 0.1) { const y = Y1 - m * s, major = Math.abs(m - Math.round(m)) < 1e-6; ru.append(sv('line', { x1: X0 - 4, x2: X0 - (major ? 14 : 8), y1: y, y2: y })); if (major) ru.append(sv('text', { x: X0 - 18, y: y + 4, 'text-anchor': 'end' }, `${Math.round(m)}`)); }
  svg.append(ru);

  // handles: the square sits on a repeat corner inside the first tile; the round one turns
  const hg = sv('g', { class: 'al-h' });
  const arm = sv('line', { class: 'arm' });
  const sq = sv('rect', { width: 16, height: 16, rx: 3, class: 'hsq', tabindex: 0, role: 'slider', 'aria-label': 'Move the pattern (offset)' });
  const rh = sv('circle', { r: 8, class: 'hrot', tabindex: 0, role: 'slider', 'aria-label': 'Turn the pattern' });
  hg.append(arm, sq, rh); svg.append(hg);
  const readout = h('span', { class: 'al-read mono' });

  function place() {
    const ox = mod(off[0], tile), oy = mod(off[1], tile);
    const tf = `translate(${X0 + off[0] * s} ${Y1 - off[1] * s}) rotate(${-rot})`;
    pat.setAttribute('patternTransform', tf); grid.setAttribute('patternTransform', tf);
    const hx = X0 + Math.min(ox, fr.w) * s, hy = Y1 - Math.min(oy, fr.h) * s;
    sq.setAttribute('x', hx - 8); sq.setAttribute('y', hy - 8);
    const R = Math.min(Math.max(ts * 0.9, 56), 120), a = -rot * Math.PI / 180;
    const rx = hx + Math.cos(a) * R, ry = hy + Math.sin(a) * R;
    arm.setAttribute('x1', hx); arm.setAttribute('y1', hy); arm.setAttribute('x2', rx); arm.setAttribute('y2', ry);
    rh.setAttribute('cx', rx); rh.setAttribute('cy', ry);
    readout.textContent = `offset ${ox.toFixed(2)} → · ${oy.toFixed(2)} ↑ m   ·   ${rot.toFixed(0)}°   ·   repeat ${tile.toFixed(2)} m`;
  }
  place();

  const commitOff = () => fm.edit({ offset: Math.abs(mod(off[0], tile)) < 1e-4 && Math.abs(mod(off[1], tile)) < 1e-4 ? undefined : [+mod(off[0], tile).toFixed(3), +mod(off[1], tile).toFixed(3)] }, 'offset');
  const commitRot = () => fm.edit({ rot: mod(Math.round(rot), 360) || undefined }, 'rot');
  drag(sq, (dx, dy, start, e) => { const snap = e.shiftKey ? 1e-3 : 0.01; off = [Math.round((start[0] + dx / s) / snap) * snap, Math.round((start[1] - dy / s) / snap) * snap]; place(); }, () => [...off], commitOff);
  drag(rh, (dx, dy, start, e) => { const b = sq.getBBox(); const cx = b.x + 8, cy = b.y + 8; const p = svgPoint(svg, e); let a = -Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI; if (!e.altKey) a = Math.round(a / 15) * 15; rot = mod(a, 360); place(); }, () => rot, commitRot);
  key(sq, (k, e) => { const st = e.shiftKey ? 0.1 : 0.01; if (k === 'ArrowLeft') off[0] -= st; else if (k === 'ArrowRight') off[0] += st; else if (k === 'ArrowUp') off[1] += st; else if (k === 'ArrowDown') off[1] -= st; else return false; place(); commitOff(); return true; });
  key(rh, (k) => { if (k === 'ArrowLeft' || k === 'ArrowUp') rot = mod(rot + 15, 360); else if (k === 'ArrowRight' || k === 'ArrowDown') rot = mod(rot - 15, 360); else return false; place(); commitRot(); return true; });

  el.append(
    h('div', { class: 'al-bar' },
      h('b', {}, TARGETS[t].group === 'floor' ? 'Align on floor' : 'Align on wall'),
      h('span', {}, `${A.shortTarget(t)} · ${fr.w.toFixed(1)} × ${fr.h.toFixed(1)} m · straight on`),
      readout,
      h('button', { class: 'btn sm ghost', 'data-fid': 'al-reset', title: 'No offset, no turn — one undo', onClick: () => fm.edit({ offset: undefined, rot: undefined }, 'align-reset') }, 'Reset'),
      h('button', { class: 'btn sm pri', 'data-fid': 'al-back', title: 'Back to the room view (Esc)', onClick: () => setUi({ align: null }) }, 'Put back')),
    svg,
    h('div', { class: 'al-note' }, 'Drag the square to move the pattern (1 cm snap, Shift for 1 mm) · drag the round handle to turn it (15° steps, Alt for any angle) · arrows nudge. Ruler, grid and handles are never saved.'));
}

function svgPoint(svg, e) { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function drag(node, move, startVal, end) {
  node.addEventListener('pointerdown', (e) => {
    e.preventDefault(); node.setPointerCapture(e.pointerId);
    const x0 = e.clientX, y0 = e.clientY, start = startVal();
    const mv = (ev) => move(ev.clientX - x0, ev.clientY - y0, start, ev);
    const up = () => { node.removeEventListener('pointermove', mv); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', up); end(); };
    node.addEventListener('pointermove', mv); node.addEventListener('pointerup', up); node.addEventListener('pointercancel', up);
  });
}
function key(node, fn) { node.addEventListener('keydown', (e) => { if (fn(e.key, e)) { e.preventDefault(); e.stopPropagation(); } }); }
