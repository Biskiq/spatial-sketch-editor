// Visual-reference entry; rebuild instructions are in docs/roadmap/r217-core-editor-stability/world-shell-recovery/opening-design-review.md.
// G, glyph and knob are the existing interaction sheet's sticker vocabulary.
/* global G, glyph, knob */
import {
  createEmptyWallFirstLayoutDocument, planWallChain, mintLayoutIdCapture,
  planCreateWallFirstOpening, planUpdateWallFirstOpening, WALL_OPENING_DEFAULTS
} from '@portfolio/layout-core';
import { buildArchProfile } from '../../../../packages/layout-core/src/layout-geometry-openings.ts';
import { openingRefusalWords } from '../../../../apps/editor/src/lib/authoring/adapters/layout/refusals.ts';

const q = s => document.querySelector(s), svg = q('#op-stage');
let serial = 0;
const capture = () => mintLayoutIdCapture(() => `opening-design-${++serial}`);
let doc, wallId, selected, tool = 'door', lastKind = 'door', profile = 'rectangular';
let view = 'plan', candidate = null, attempt = null, drag = null, host = false;
let resizeHover = null;
let values = { ...WALL_OPENING_DEFAULTS.door, offset: 3 };
const title = value => value[0].toUpperCase() + value.slice(1);

function reset() {
  const base = createEmptyWallFirstLayoutDocument();
  const result = planWallChain({baseline: base, points: [[0,0],[8,0]], close: false,
    capture: capture(), levelId: base.floor.id});
  if (result.kind !== 'success') throw Error('Specimen Wall refused');
  doc = result.document; wallId = doc.walls[0].id;
  for (const [kind, offset] of [['door', .8], ['window', 5.5]]) {
    const p = planCreateWallFirstOpening(doc, {wallId, kind, offset}, capture(), doc.floor.id);
    if (p.kind !== 'success') throw Error('Specimen Opening refused');
    doc = p.document;
  }
  selected = null; candidate = null; attempt = null; drag = null; host = false;
  tool = lastKind = 'door'; profile = 'rectangular';
  values = {...WALL_OPENING_DEFAULTS.door, offset: 3};
  fields(); render();
}
function selectedOpening() { return doc.openings.find(o => o.id === selected); }
function fields() {
  q('#op-title').textContent = title(selectedOpening()?.kind ?? lastKind);
  for (const [target, entries] of [
    ['#op-fields', [['width','Width'], ['height','Height']]],
    ['#op-extra-fields', [['sillHeight','Sill'], ['offset','Offset']]]
  ]) q(target).innerHTML = entries.map(([key,label]) => `<div class="fld">
    <label for="op-${key}">${label}</label><div class="box"><input id="op-${key}"
    data-field="${key}" type="number" step="0.05" value="${values[key].toFixed(2)}">
    <span class="u">m</span></div></div>`).join('');
  q('#op-place').textContent = selected ? 'Apply' : 'Place';
}
function propose(field, value) {
  const old = selectedOpening();
  const cornerKey = drag?.corner ?? 'tr';
  const patch = field === 'uniform' ? {width: old.width * value, height: old.height * value, offset: cornerKey.includes('l') ? old.offset+old.width*(1-value) : old.offset, sillHeight: cornerKey.includes('b') ? old.sillHeight+old.height*(1-value) : old.sillHeight} : field === 'bottom' ? {sillHeight:value,height:old.height+old.sillHeight-value} : field === 'leftEdge' ? {offset: value, width: old.offset + old.width - value} : {[field]: value};
  attempt = old ? {...old, ...patch} : {...values, wallId, kind: tool, profile};
  candidate = old ? planUpdateWallFirstOpening(doc, old.id, patch)
    : planCreateWallFirstOpening(doc, attempt, capture(), doc.floor.id);
  render();
}
function accept() {
  if (candidate?.kind !== 'success') return;
  doc = candidate.document;
  if (!selected) selected = candidate.changedOpeningIds[0];
  tool = 'select'; values = {...selectedOpening()};
  profile = values.profile; lastKind = values.kind;
  candidate = null; attempt = null; fields(); render();
}
function point(x, z = 0) {
  return view === 'plan' ? [65 + x * 76, 190] : [65 + x * 70, 315 - x * 12 - z * 65];
}
const path = points => 'M' + points.map(p => p.join(',')).join('L') + 'Z';
function shape(o, cls) {
  const x = o.offset, w = o.width, b = o.sillHeight, t = b + o.height;
  if (view === 'space') {
    const arch = buildArchProfile(o.profile ?? 'rectangular', w, o.height).profile;
    // A refused profile still shows its attempted bounds, never a repaired cut.
    const top = arch?.topBoundary ?? [[0, o.height], [w, o.height]];
    return `<path d="${path([point(x,b), point(x+w,b), ...[...top].reverse().map(([u,z]) => point(x+u,b+z))])}" class="${cls}"/>`;
  }
  const a = point(x)[0], end = point(x+w)[0], thick = doc.walls[0].thickness * 76;
  const near = 190 - thick / 2, far = 190 + thick / 2;
  const threshold = path([[a,near], [end,near], [end,far], [a,far]]);
  if (cls === 'op-cut') return `<path d="${threshold}" class="op-cut"/>`;
  if (cls.includes('ghost') || cls === 'refused') return `<path d="${threshold}" class="${cls}"/>`;
  const jambs = `M${a} ${near}V${far}M${end} ${near}V${far}`;
  const symbol = o.kind === 'door'
    ? `${jambs}M${a} ${near}V${near-w*76}M${a} ${near-w*76}A${w*76} ${w*76} 0 0 1 ${end} ${near}`
    : `${jambs}M${a} ${190-thick*.2}H${end}M${a} ${190+thick*.2}H${end}`;
  return `<path d="${symbol}" class="${cls} op-symbol"/>`;
}
const labels = {
  uniform: 'Scale width and height uniformly', offset: 'Slide along Wall', width: 'Resize from right edge', leftEdge: 'Resize from left edge · right edge stays fixed',
  height: 'Adjust top · sill stays fixed', sillHeight: 'Lift sill · height stays fixed'
};
function grip(p, key, art) {
  return `<g class="op-handle" data-grip="${key}" tabindex="0" role="button" aria-label="${labels[key]}. Arrow keys adjust.">
    <title>${labels[key]}</title><circle class="op-hit" cx="${p[0]}" cy="${p[1]}" r="22"/>${art}</g>`;
}
function handles(o) {
  const mid = point(o.offset+o.width/2, view === 'space' ? o.sillHeight+o.height*.45 : 0);
  return grip(mid, 'offset', glyph(G.move, mid, 0, false, ' scale(.65)'));
}
function resizeCursor(angle, double) {
  // Reuse the sheet's exact geometry: G.arrow and chip()'s diagonal scale icon.
  // The chip backing is omitted because this is the pointer, not a Stage control.
  const chipPath = 'M-5,5 L5,-5 M-5,5 h4.2 M-5,5 v-4.2 M5,-5 h-4.2 M5,-5 v4.2';
  const mark = double
    ? `<g transform="rotate(${angle+45}) scale(1.4)"><path d="${chipPath}" fill="none" stroke="#1b201c" stroke-width="2.8"/><path d="${chipPath}" fill="none" stroke="white" stroke-width="1.5"/></g>`
    : `<path d="${G.arrow}" transform="rotate(${angle}) translate(-8.25 0)" fill="white" stroke="#1b201c" stroke-width="1.1"/>`;
  const art = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g transform="translate(16 16)" stroke-linecap="round" stroke-linejoin="round">${mark}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(art)}") 16 16, auto`;
}

function targetResize(p, o) {
  const x = (p.x-65)/(view === 'plan' ? 76 : 70);
  const z = view === 'space' ? (315-x*12-p.y)/65 : (190-p.y)/55;
  const bottom = view === 'space' ? o.sillHeight : -doc.walls[0].thickness*38/55;
  const top = view === 'space' ? o.sillHeight+o.height : doc.walls[0].thickness*38/55;
  // A 22 CSS-pixel halo remains easy to acquire as the specimen scales.
  const scale = svg.getBoundingClientRect().width / 760 || 1;
  const halo = 22 / scale;
  const dx = halo / (view === 'plan' ? 76 : 70), dz = halo / 65;
  const nearL=Math.abs(x-o.offset)<dx, nearR=Math.abs(x-o.offset-o.width)<dx;
  if (view === 'plan') {
    if (Math.abs(p.y-190)>doc.walls[0].thickness*38+halo || (!nearL&&!nearR)) return null;
    const left = Math.abs(x-o.offset) <= Math.abs(x-o.offset-o.width);
    return {key:left?'leftEdge':'width',angle:left?180:0};
  }
  const nearT=Math.abs(z-top)<dz, nearB=Math.abs(z-bottom)<dz;
  if((nearL||nearR)&&(nearT||nearB)) {
    const corner=(nearT?'t':'b')+(nearL?'l':'r');
    return {key:'uniform',corner,angle:corner==='tr'||corner==='bl'?-45:45,double:true};
  }
  if(z>=bottom-dz&&z<=top+dz&&(nearL||nearR))return {key:nearL?'leftEdge':'width',angle:nearL?180:0};
  if(x>=o.offset-dx&&x<=o.offset+o.width+dx&&(nearT||nearB))return {key:nearT?'height':'bottom',angle:nearT?-90:90};
  return null;
}
function render() {
  q('#op-tools').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === (tool === 'select' ? 'select' : 'opening'))));
  q('#op-kind').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === lastKind)));
  q('#op-profile').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.profile === profile)));
  q('#op-view').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  const shown = attempt ?? selectedOpening() ?? values;
  q('#op-head').textContent = (shown.sillHeight + shown.height).toFixed(2) + ' m';
  q('#op-profile-name').textContent = title(shown.profile ?? profile);
  let html = `<rect width="760" height="400" class="paper"/><text x="25" y="32" class="room-name">Wall 1 · ${view === 'plan' ? 'Plan' : '3D schematic'} · 8.00 m</text>`;
  if (view === 'plan') html += `<path d="M65 190H673" stroke="var(--ink)" stroke-width="${doc.walls[0].thickness*76}"/>`;
  else html += `<path d="${path([point(0), point(8), point(8,doc.walls[0].height), point(0,doc.walls[0].height)])}" fill="var(--hair2)" stroke="var(--ink2)"/>`;
  for (const o of doc.openings) {
    const p = point(o.offset + o.width/2, view === 'space' ? o.sillHeight + o.height/2 : 0);
    html += `<g data-id="${o.id}" aria-label="${title(o.kind)}"><title>${title(o.kind)}</title>${shape(o,'op-cut')}${shape(o, o.id === selected ? 'sel-edge' : 'inkl')}`;
    if (view === 'plan') html += `<path class="op-hit" d="${path([[point(o.offset)[0],178], [point(o.offset+o.width)[0],178], [point(o.offset+o.width)[0],202], [point(o.offset)[0],202]])}"/>`;
    if (view === 'space' && o.id !== selected) html += `<text x="${p[0]}" y="${p[1]+4}" text-anchor="middle" class="room-name">${o.kind === 'door' ? 'D' : 'W'}</text>`;
    html += '</g>';
  }
  if (attempt && candidate) html += shape(attempt, candidate.kind === 'success' ? 'ghost tint' : 'refused');
  const o = selectedOpening();
  if (o) html += handles(o);
  // Preserve focus when keyboard adjustments redraw the selected handles.
  const focused = document.activeElement?.getAttribute('data-grip');
  svg.innerHTML = html;
  if (focused) svg.querySelector(`[data-grip="${focused}"]`)?.focus();
  q('#op-status').textContent = candidate?.kind === 'rejected'
    ? openingRefusalWords(doc,candidate.rejection,attempt)
    : candidate?.kind === 'success' ? 'Fits Wall 1 · ' + (drag ? 'Release to apply.' : selected ? 'Apply this change.' : 'Click to place.')
    : selected ? (view === 'space' ? 'Move glyph slides the Opening. Hover an edge to resize; hover any corner to scale uniformly.' : 'Move glyph slides the Opening. Hover near the left or right edge to resize. Height and sill remain in the Card.')
    : 'Aim at Wall 1, or enter Offset in More and choose Place.';
  q('#op-status').style.color = candidate?.kind === 'rejected' ? 'var(--problem)' : 'var(--ink2)';
  q('#op-place').disabled = candidate?.kind === 'rejected' || (tool === 'select' && !candidate);
}
function local(e) { return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse()); }
svg.addEventListener('pointermove', e => {
  const p = local(e);
  if (drag) {
    if (drag.key === 'uniform') { propose('uniform', Math.max(.01, 1 + ((p.x-drag.x)*(drag.corner?.includes('l')?-1:1)+(p.y-drag.y)*(drag.corner?.includes('b')?1:-1))/140)); return; }
    const delta = ['height','sillHeight','bottom'].includes(drag.key) ? (drag.y-p.y)/(view === 'plan' ? 55 : 65) : (p.x-drag.x)/(view === 'plan' ? 76 : 70);
    propose(drag.key,drag.value+delta); return;
  }
  if (tool === 'select') {
    resizeHover = selectedOpening() ? targetResize(p,selectedOpening()) : null;
    svg.style.cursor=resizeHover ? resizeCursor(resizeHover.angle,resizeHover.double) : '';
    return;
  }
  const x = (p.x-65)/(view === 'plan' ? 76 : 70), y = view === 'plan' ? 190 : 315-x*12;
  host = x >= 0 && x <= 8 && (view === 'plan' ? Math.abs(p.y-y) < 38 : p.y <= y && p.y >= y-doc.walls[0].height*65);
  if (host) { values.offset = x-values.width/2; propose(); }
  else { candidate = null; attempt = null; render(); }
});
svg.addEventListener('pointerleave', () => {
  if(!drag){resizeHover=null;svg.style.cursor='';}
  if (!drag && tool !== 'select') { host = false; candidate = null; attempt = null; render(); }
});
svg.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  e.preventDefault();
  svg.focus({preventScroll:true});
  const key = e.target.closest('[data-grip]')?.dataset.grip ?? resizeHover?.key;
  if (key && selected) {
    const p = local(e); drag = {key, corner:resizeHover?.corner, x:p.x, y:p.y, value:key === 'uniform' ? 1 : selectedOpening()[key === 'leftEdge' ? 'offset' : key === 'bottom' ? 'sillHeight' : key]};
    svg.setPointerCapture(e.pointerId); return;
  }
  if (tool !== 'select') { if (host) accept(); return; }
  const id = e.target.closest('[data-id]')?.dataset.id;
  if (id) {
    selected = id; values = {...selectedOpening()}; profile = values.profile; lastKind = values.kind;
    candidate = null; attempt = null; fields(); render();
  }
});
svg.addEventListener('pointerup', () => { if (drag) { drag = null; accept(); } });
function cancel() {
  drag = null; candidate = null; attempt = null;
  if (selected) { values = {...selectedOpening()}; profile = values.profile; }
  fields(); render();
}
svg.addEventListener('pointercancel',cancel);
svg.addEventListener('lostpointercapture', () => { if (drag) cancel(); });
window.addEventListener('blur',cancel);
q('#s-opening').addEventListener('keydown', e => {
  if (e.key === 'Escape') { cancel(); tool = 'select'; render(); }
  const key = e.target.closest('[data-grip]')?.dataset.grip;
  if (key && selected && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const delta = ['ArrowRight','ArrowUp'].includes(e.key) ? .05 : -.05;
    propose(key, (key === 'uniform' ? 1 : selectedOpening()[key === 'leftEdge' ? 'offset' : key === 'bottom' ? 'sillHeight' : key]) + delta); accept();
  }
});
q('#s-opening').addEventListener('change', e => {
  const key = e.target.dataset.field;
  if (!key) return;
  const n = e.target.valueAsNumber;
  if (!Number.isFinite(n)) { q('#op-status').textContent = 'Enter a finite dimension.'; q('#op-place').disabled = true; return; }
  if (selected) values = {...selectedOpening()};
  values[key] = n; propose(key,n);
});
q('#op-place').onclick = () => { if (!selected && !candidate) propose(); accept(); };
q('#op-cancel').onclick = () => { cancel(); tool = 'select'; render(); };
function arm(kind) {
  cancel(); tool = lastKind = kind; selected = null; host = false;
  values = {...WALL_OPENING_DEFAULTS[kind], offset:3}; fields(); render();
}
q('#op-tools').onclick = e => {
  const next = e.target.closest('[data-tool]')?.dataset.tool;
  if (next === 'opening') arm(lastKind);
  if (next === 'select') { cancel(); tool = 'select'; render(); }
};
q('#op-kind').onclick = e => { const kind = e.target.closest('[data-kind]')?.dataset.kind; if (kind) arm(kind); };
q('#op-profile').onclick = e => {
  const next = e.target.closest('[data-profile]')?.dataset.profile;
  if (!next) return;
  profile = next;
  if (selected) propose('profile', next);
  else { if (tool === 'select') tool = lastKind; propose(); }
};
q('#op-view').onclick = e => {
  const next = e.target.closest('[data-view]')?.dataset.view;
  if (next) { cancel(); view = next; render(); }
};
q('#op-more').onclick = () => {
  const p = q('#op-secondary'); p.hidden = !p.hidden;
  q('#op-more').setAttribute('aria-expanded',String(!p.hidden));
};
q('#op-reset').onclick = reset;
reset();
