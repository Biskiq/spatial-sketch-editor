// Contextual manipulation language (round 2). Gold outlines say what is selected; thin white
// dashed guides say what can be changed; small white arrowheads say which way to drag; small
// white points mark the anchors that need one. Everything is drawn in screen pixels so it stays
// readable at any zoom: guides grow out of the subject to a minimum on-screen size instead of
// shrinking with it. Domain subjects get their own anchors (wall ends, ridge, eave, a track along
// the host wall) rather than one universal gizmo.
import * as SC from './scene.js';
import { S, M, R, esc, f2, wpx } from './core.js';

// ---------------- screen-space vector helpers ----------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a, fb = [1, 0]) => { const l = len(a); return l < 1e-6 ? fb : [a[0] / l, a[1] / l]; };
const perp = (a) => [-a[1], a[0]];
const P = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

// ---------------- the vocabulary ----------------
/** A dashed guide with a halo underneath so it reads on light walls and on the dark mat. */
function guide(a, b, cls = '') { return `<line class="gd-h ${cls}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><line class="gd ${cls}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }
/** An open arrowhead whose tip is at `tip`, pointing along `dir`. */
function head(tip, dir, s = 6.5) {
  const d = unit(dir), n = perp(d), b = sub(tip, mul(d, s));
  const d1 = `M${P(add(b, mul(n, s * 0.62)))} L${P(tip)} L${P(sub(b, mul(n, s * 0.62)))}`;
  return `<path class="ah-h" d="${d1}"/><path class="ah" d="${d1}"/>`;
}
function point(p, r = 4.2, cls = '') { return `<circle class="ap-h" cx="${p[0]}" cy="${p[1]}" r="${r + 1.6}"/><circle class="ap ${cls}" cx="${p[0]}" cy="${p[1]}" r="${r}"/>`; }
/** One interactive group: visuals plus a generous invisible hit area (a disc and/or a fat stroke). */
function grip(h, title, body, hit, label, at) {
  const cls = `hit mh${S.hh === h ? ' hov' : ''}${R.D && R.D.kind === 'h-' + h ? ' act' : ''}`;
  let hz = '';
  for (const x of hit) hz += typeof x[1] === 'number' ? `<circle class="hz" cx="${x[0][0]}" cy="${x[0][1]}" r="${x[1]}"/>` : `<line class="hzl" x1="${x[0][0]}" y1="${x[0][1]}" x2="${x[1][0]}" y2="${x[1][1]}"/>`;
  const tagOn = label && at && S.hh === h && !R.D;
  return `<g class="${cls}" data-h="${h}"><title>${esc(title)}</title>${body}${hz}</g>${tagOn ? hoverTag(at[0] + 12, at[1] - 10, label) : ''}`;
}
function hoverTag(x, y, text) { const w = String(text).length * 6.4 + 14; return `<g transform="translate(${x},${y})" class="tagg"><rect class="tagbox lite" x="0" y="-15" width="${w}" height="20" rx="5"/><text class="tagtxt" x="7" y="-1">${esc(text)}</text></g>`; }
/** A ray: a dashed guide leaving `from` along `dir`, ending in an arrowhead `L` px later. */
function ray(h, from, dir, L, title, label) {
  const d = unit(dir), a = add(from, mul(d, 3)), b = add(from, mul(d, L));
  return grip(h, title, guide(a, b) + head(b, d), [[b, 12], [a, b]], label, b);
}
/** A two-way arrow across a point (move parallel, thickness). */
function twoWay(h, c, dir, L, title, label) {
  const d = unit(dir), a = sub(c, mul(d, L)), b = add(c, mul(d, L));
  return grip(h, title, guide(a, b) + head(a, mul(d, -1), 5.5) + head(b, d, 5.5), [[c, 12], [a, b]], label, b);
}
/** On-screen pixels per metre along a world direction at a world point. */
function ppm(p, dir) { const a = wpx(p), b = wpx([p[0] + dir[0], p[1] + dir[1], p[2] + (dir[2] || 0)]); return a && b ? Math.max(1, len(sub(b, a))) : 30; }
function screenDir(p, dir) { const a = wpx(p), b = wpx([p[0] + dir[0] * 0.5, p[1] + dir[1] * 0.5, p[2] + (dir[2] || 0) * 0.5]); return a && b ? unit(sub(b, a), [0, -1]) : [0, -1]; }
function ringPts(cx, cy, z, r, n = 48) { const out = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const p = wpx([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]); if (p) out.push(p); } return out; }

// ---------------- objects ----------------
/** Local frame of an object: u along its width, v along its depth (after turn). */
export function objFrame(o) { const a = ((o.rot || 0) * Math.PI) / 180; return { u: [Math.cos(a), Math.sin(a)], v: [-Math.sin(a), Math.cos(a)] }; }
const verbW = (e) => (e.fit === 'extend' ? 'extends · parts keep their size' : 'stretches');
function objectCommon(e, style) {
  const z0 = e.z || 0, z1 = z0 + e.h, { u, v } = objFrame(e);
  const at = (du, dv, z) => wpx([e.x + u[0] * du + v[0] * dv, e.y + u[1] * du + v[1] * dv, z]);
  const c0 = at(0, 0, z0), ct = at(0, 0, z1); if (!c0 || !ct) return null;
  // the ring keeps a minimum on-screen radius, so a small object at overview zoom still has room for its guides
  const k = Math.min(ppm([e.x, e.y, z0], [1, 0]), ppm([e.x, e.y, z0], [0, 1]));
  const rW = Math.max(Math.max(e.w, e.d) / 2 + 0.3, 30 / k);
  const ring = ringPts(e.x, e.y, z0 + 0.01, rW);
  let s = '';
  // turn: the dashed floor ring itself is the handle; two small arrowheads say it turns
  const rp = ring.map(P).join(' ');
  const ah = [Math.round(ring.length * 0.14), Math.round(ring.length * 0.64)].map((i) => { const p = ring[i], q = ring[Math.min(ring.length - 1, i + 1)]; return p && q ? head(p, sub(q, p), 5.5) : ''; }).join('');
  s += `<g class="hit mh ring${S.hh === 'rotate' ? ' hov' : ''}${R.D?.kind === 'h-rotate' ? ' act' : ''}" data-h="rotate"><title>Turn about its vertical axis (15° detents, ⌥ free)</title><polyline class="gd-h" points="${rp}"/><polyline class="gd ring" points="${rp}"/>${ah}<polyline class="hzl" points="${rp}"/></g>`;
  if (S.hh === 'rotate' && !R.D) s += hoverTag(ring[Math.round(ring.length * 0.14)][0] + 10, ring[Math.round(ring.length * 0.14)][1], `${Math.round(e.rot || 0)}° · turn`);
  // move: a white cross on the floor at the base (style B puts it on a disc)
  const du = screenDir([e.x, e.y, z0], [...u, 0]), dv = screenDir([e.x, e.y, z0], [...v, 0]);
  let mv = '';
  if (style === 'dims') mv = `<circle class="mdisc" cx="${c0[0]}" cy="${c0[1]}" r="10"/>${[du, dv, mul(du, -1), mul(dv, -1)].map((d) => `<path class="mx" d="M${P(add(c0, mul(d, 2)))} L${P(add(c0, mul(d, 7)))}"/>`).join('')}`;
  else mv = [du, dv, mul(du, -1), mul(dv, -1)].map((d) => guide(add(c0, mul(d, 2)), add(c0, mul(d, 9)), 'solid') + head(add(c0, mul(d, 11)), d, 4)).join('');
  s += grip('move', 'Drag to slide; it settles on the surface beneath', mv, [[c0, 13]], null);
  return { z0, z1, u, v, at, c0, ct, rW, k, du, dv, s };
}
function scaleGrip(e, f, open) {
  const corner = f.at(e.w / 2, e.d / 2, f.z1); if (!corner) return '';
  const d = unit(sub(corner, f.ct), [0.7, -0.7]); const p = add(corner, mul(d, Math.max(10, 22 - len(sub(corner, f.ct)))));
  const body = point(p, 4, 'scale') + guide(add(p, mul(d, 5)), add(p, mul(d, 12))) + head(add(p, mul(d, 14)), d, 4.5);
  const title = open ? 'Scale in proportion (base stays put) · click to hide width, depth and height' : 'Scale in proportion · click for width, depth and height';
  return grip('size', title, body, [[p, 12]], `${f2(e.w)} × ${f2(e.d)} × ${f2(e.h)} · ${open ? 'drag to scale' : 'click for W · D · H'}`, p);
}
/** Concept A (Reference B): axis rays grow out of the subject to just past the turn ring. */
export function objectRays(e) {
  const f = objectCommon(e, 'rays'); if (!f) return '';
  let s = f.s; const open = S.cmp.handles === 'immediate' || S.sizeOpen === e.id;
  s += scaleGrip(e, f, open);
  if (open) {
    for (const [key, ax, half, sd, nm] of [['w', f.u, e.w / 2, f.du, e.fit === 'extend' ? 'Length' : 'Width'], ['d', f.v, e.d / 2, f.dv, 'Depth']]) {
      for (const sg of [1, -1]) {
        const face = f.at(ax === f.u ? sg * half : 0, ax === f.v ? sg * half : 0, f.z0); if (!face) continue;
        const dir = mul(sd, sg); const ringEdge = f.at(ax === f.u ? sg * f.rW : 0, ax === f.v ? sg * f.rW : 0, f.z0);
        const start = add(face, mul(dir, 2)), reach = Math.max(len(sub(ringEdge || face, face)) + 16, 26);
        s += ray(key + (sg < 0 ? '-' : ''), start, dir, reach, `${nm}: drag this face · the opposite face stays`, `${nm} ${f2(key === 'w' ? e.w : e.d)} · ${key === 'w' ? verbW(e) : 'stretches'}`);
      }
    }
    // height: a dashed axis rises through the subject and leaves its top as a ray
    const up = screenDir([e.x, e.y, f.z1], [0, 0, 1]);
    s += `<line class="gd faint" x1="${f.c0[0]}" y1="${f.c0[1]}" x2="${f.ct[0]}" y2="${f.ct[1]}"/>`;
    s += ray('h', f.ct, up, 40, 'Height: drag up or down · the base stays on its support', `Height ${f2(e.h)} · base stays`);
  }
  return s;
}
/** Concept B (Reference A): dimension lines offset from the edges they measure, with a grip in the middle. */
export function objectDims(e) {
  const f = objectCommon(e, 'dims'); if (!f) return '';
  let s = f.s; const open = S.cmp.handles === 'immediate' || S.sizeOpen === e.id;
  s += scaleGrip(e, f, open);
  if (!open) return s;
  // pick the edges nearest the viewer (largest screen y) so the lines don't hide behind the subject
  const fy = (du, dv) => (f.at(du, dv, f.z0) || [0, -1e9])[1];
  const sv = fy(0, e.d / 2) > fy(0, -e.d / 2) ? 1 : -1, su = fy(e.w / 2, 0) > fy(-e.w / 2, 0) ? 1 : -1;
  const dimLine = (h, a, b, outward, title, label) => {
    const o = mul(unit(outward), 16), A = add(a, o), B = add(b, o), m = mul(add(A, B), 0.5), d = unit(sub(B, A));
    const ext = `<line class="gd solid thin" x1="${a[0] + o[0] * 0.25}" y1="${a[1] + o[1] * 0.25}" x2="${A[0] + o[0] * 0.3}" y2="${A[1] + o[1] * 0.3}"/><line class="gd solid thin" x1="${b[0] + o[0] * 0.25}" y1="${b[1] + o[1] * 0.25}" x2="${B[0] + o[0] * 0.3}" y2="${B[1] + o[1] * 0.3}"/>`;
    return grip(h, title, ext + guide(A, B) + head(A, mul(d, -1), 5) + head(B, d, 5) + point(m, 3.6), [[m, 12], [A, B]], label, m);
  };
  const wa = f.at(-e.w / 2, sv * e.d / 2, f.z0), wb = f.at(e.w / 2, sv * e.d / 2, f.z0), wo = f.at(0, sv * (e.d / 2 + 1), f.z0), wm = f.at(0, sv * e.d / 2, f.z0);
  if (wa && wb && wo && wm) s += dimLine('w', wa, wb, sub(wo, wm), 'Width: drag along the line', `${e.fit === 'extend' ? 'Length' : 'Width'} ${f2(e.w)} · ${verbW(e)}`);
  const da = f.at(su * e.w / 2, -e.d / 2, f.z0), db = f.at(su * e.w / 2, e.d / 2, f.z0), dO = f.at(su * (e.w / 2 + 1), 0, f.z0), dm = f.at(su * e.w / 2, 0, f.z0);
  if (da && db && dO && dm) s += dimLine('d', da, db, sub(dO, dm), 'Depth: drag along the line', `Depth ${f2(e.d)} · stretches`);
  const ca = f.at(su * e.w / 2, sv * e.d / 2, f.z0), cb = f.at(su * e.w / 2, sv * e.d / 2, f.z1);
  if (ca && cb) { const out = [sub(ca, f.c0)[0] >= 0 ? 1 : -1, 0]; s += dimLine('h', ca, cb, out, 'Height: drag up or down · the base stays on its support', `Height ${f2(e.h)} · base stays`); }
  return s;
}

// ---------------- architecture ----------------
const wallDir = (w) => { const L = SC.wallLen(w); return [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L]; };
export function wallHandles(w) {
  const plan = R.mode === 'plan', L = SC.wallLen(w), d = wallDir(w), n = [-d[1], d[0]];
  const a0 = wpx([...w.a, w.base]), b0 = wpx([...w.b, w.base]); if (!a0 || !b0) return '';
  const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  const mb = wpx([...mid, w.base]), mt = plan ? null : wpx([...mid, w.top]);
  const at = plan ? null : wpx([...w.a, w.top]), bt = plan ? null : wpx([...w.b, w.top]);
  const nd = screenDir([...mid, w.base], [...n, 0]), up = screenDir([...mid, w.top], [0, 0, 1]);
  const th = w.th ?? 0.24; let s = '';
  // thickness belongs to the wall's cap: a short two-way arrow across it
  const q = [w.a[0] + d[0] * L * 0.25, w.a[1] + d[1] * L * 0.25]; const qp = wpx([...q, plan ? w.base : w.top]);
  const thGrip = qp ? twoWay('th', qp, nd, 9, 'Thickness: drag across the wall', `Thick ${f2(th)}`) : '';
  if (S.cmp.arch === 'grips' && !plan) {
    // concept B: the geometry is the handle (top edge, end edges, base line); arrows appear on hover
    const edge = (h, A, B, dir, title, label) => { const m = mul(add(A, B), 0.5); const hov = S.hh === h || R.D?.kind === 'h-' + h; return grip(h, title, `<line class="grip-h" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/><line class="grip" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/>${hov ? head(add(m, mul(dir, 16)), dir, 5.5) + (h === 'push' ? head(sub(m, mul(dir, 16)), mul(dir, -1), 5.5) : '') : ''}`, [[A, B]], label, m); };
    if (at && bt) s += edge('top', at, bt, up, 'Drag the top edge; snaps to heights on the Sheet', `${f2(w.top - w.base)} high`);
    if (at) s += edge('end-a', a0, at, unit(sub(a0, b0)), 'Drag this end', `${f2(L)} long`);
    if (bt) s += edge('end-b', b0, bt, unit(sub(b0, a0)), 'Drag this end', `${f2(L)} long`);
    s += edge('push', a0, b0, nd, 'Drag the base line to move the wall parallel', 'move parallel');
    return s + thGrip;
  }
  // concept A: the same rays and points as objects
  s += grip('end-a', 'Drag the end', point(a0, 4.6), [[a0, 12]], `${f2(L)} long`, a0);
  s += grip('end-b', 'Drag the end', point(b0, 4.6), [[b0, 12]], `${f2(L)} long`, b0);
  if (mt) s += ray('top', mt, up, 38, 'Drag the top; snaps to heights on the Sheet', `${f2(w.top - w.base)} high`);
  if (mb) s += twoWay('push', mb, nd, plan ? 18 : 15, 'Drag to move the wall parallel', 'move parallel');
  return s + thGrip;
}
export function roofHandles(r) {
  if (R.mode === 'plan') return '';
  const L = S.lift ? 2.6 : 0;
  if (r.poly) {
    const c = SC.centroid2(r.poly), p = wpx([...c, r.eave + L]); if (!p) return '';
    return ray('eave', p, screenDir([...c, r.eave], [0, 0, 1]), 36, 'Drag the canopy height; snaps to the Sheet', `at ${f2(r.eave)}`);
  }
  const pr = SC.roofProf(r), top = SC.roofTop(r), k = pr.findIndex((q) => q[1] === top), xm = (r.x0 + r.x1) / 2;
  const ridge = wpx([xm, r.y0 + pr[k][0], top + L]);
  // the eave nearer the viewer carries the eave handle
  const e0 = wpx([xm, r.y0 + pr[0][0], pr[0][1] + L]), e1 = wpx([xm, r.y0 + pr.at(-1)[0], pr.at(-1)[1] + L]);
  const eave = e0 && e1 ? (e0[1] > e1[1] ? e0 : e1) : e0 || e1;
  const up = screenDir([xm, r.y0, top], [0, 0, 1]); let s = '';
  if (S.cmp.arch === 'grips') {
    const line = (h, s0, z, title, label, dir) => { const A = wpx([r.x0, r.y0 + s0, z + L]), B = wpx([r.x1, r.y0 + s0, z + L]); if (!A || !B) return ''; const m = mul(add(A, B), 0.5); const hov = S.hh === h || R.D?.kind === 'h-' + h; return grip(h, title, `<line class="grip-h" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/><line class="grip" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/>${hov ? head(add(m, mul(dir, 16)), dir, 5.5) : ''}`, [[A, B]], label, m); };
    if (!SC.roofFlat(r)) s += line('ridge', pr[k][0], top, 'Drag the ridge · Enter edits its section', `ridge ${f2(top)}`, up);
    const ei = eave === e0 ? 0 : pr.length - 1; s += line('eave', pr[ei][0], pr[ei][1], 'Drag the eave line', `eave ${f2(SC.roofEave(r))}`, mul(up, -1));
    if (SC.roofFlat(r)) s += line('ridge', pr[0][0], top, 'Drag the roof height', `at ${f2(top)}`, up);
    return s;
  }
  if (ridge) s += ray('ridge', ridge, up, 34, SC.roofFlat(r) ? 'Drag the roof height · Enter edits its section' : 'Drag the ridge · Enter edits its section', `${SC.roofFlat(r) ? 'at' : 'ridge'} ${f2(top)}`);
  if (eave && !SC.roofFlat(r)) s += ray('eave', eave, mul(up, -1), 30, 'Drag the eaves; the ridge stays', `eave ${f2(SC.roofEave(r))}`);
  if (ridge) s += point(ridge, 3.4, 'quiet');
  return s;
}
/** Platforms and decks: a height ray from the middle, white points at the outline corners. */
export function platformHandles(r) {
  const c = SC.centroid2(r.poly); let s = '';
  r.poly.forEach((p, i) => { const q = wpx([...p, r.z]); if (q) s += grip(`pv-${i}`, 'Drag the corner', point(q, 4), [[q, 11]], null); });
  if (R.mode !== 'plan') { const p = wpx([...c, r.z]); if (p) s += ray('pz', p, screenDir([...c, r.z], [0, 0, 1]), 38, 'Drag the surface height; snaps to the Sheet', `at ${f2(r.z)}`); }
  return s;
}
/** Hosted things move in relation to their wall: a faint track along the host shows where they can go. */
export function hostedHandles(e) {
  const w = SC.wallById(M, e.host); if (!w) return '';
  const plan = R.mode === 'plan', L = SC.wallLen(w), art = e.kind === 'artwork';
  const zc = plan ? w.base : art ? e.c : e.sill + e.h / 2;
  const T = (t, z = zc) => wpx([...SC.wallPoint(w, Math.max(0, Math.min(L, t))), z]);
  const A = T(0), B = T(L), c = T(e.at); if (!A || !B || !c) return '';
  const d = unit(sub(B, A)); let s = `<line class="gd track" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/><path class="gd track solid" d="M${P(add(A, mul(perp(d), 5)))} L${P(sub(A, mul(perp(d), 5)))} M${P(add(B, mul(perp(d), 5)))} L${P(sub(B, mul(perp(d), 5)))}"/>`;
  s += grip('slide', `Slide along ${w.name}`, point(c, 4.4) + head(add(c, mul(d, 14)), d, 4.5) + head(sub(c, mul(d, 14)), mul(d, -1), 4.5), [[c, 13]], `${f2(e.at)} m along ${w.name}`, c);
  const la = T(e.at - e.w / 2), lb = T(e.at + e.w / 2);
  if (la) s += ray('ow-a', la, mul(d, -1), 18, 'Drag this side', `Width ${f2(e.w)}`);
  if (lb) s += ray('ow-b', lb, d, 18, 'Drag this side', `Width ${f2(e.w)}`);
  if (!plan) {
    const up = screenDir([...SC.wallPoint(w, e.at), zc], [0, 0, 1]);
    const top = T(e.at, art ? e.c + e.h / 2 : e.sill + e.h);
    if (top) s += ray('oh', top, up, 22, art ? 'Drag to resize from the centre' : 'Drag the head of the opening', `Height ${f2(e.h)}`);
    if (!art && e.sill - w.base > 0.05) { const bot = T(e.at, e.sill); if (bot) s += ray('os', bot, mul(up, -1), 20, 'Drag the sill; the head stays', `Sill ${f2(e.sill - w.base)}`); }
  }
  return s;
}
