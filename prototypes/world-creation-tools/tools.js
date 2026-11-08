'use strict';
/*
 * World creation tools — tool behaviours.
 * Every creation tool moves through the same chain: Armed → Aiming → Drafting → Proposing →
 * Committed, with Cancelled and Refused as exits. A gesture commits on release as one undo
 * step; its consequence tokens stay on the Stage so the step can be amended, not repeated.
 */

const T = {
  tool: 'select', opts: {}, state: 'idle', stateAt: 0,
  draft: null, live: [], amend: null, ghosts: [], tag: null, flash: null,
  pointer: null, pressed: false, space: false, measure: null, lastIntent: null,
  objRot: 0, sel: null, shelf: SHELF_DEFAULT.slice(),
  famLast: {}, sunDrag: false,
  recentMat: ['limewash', 'brick', 'timber', 'slate', 'grass'],
};
const H_WALL = { low: 1.2, room: 3, tall: 4.5 };
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
const BRUSH_R = { s: 1.5, m: 3, l: 5 };
const r2 = (v) => Math.round(v * 100) / 100;
const pt2 = (p) => [r2(p.x), r2(p.y)];
const uiSync = () => { if (typeof UI !== 'undefined') UI.sync(); };
const toast = (m) => { if (typeof UI !== 'undefined') UI.toast(m); };

function opt(id, tool = T.tool) {
  const o = T.opts[tool] || {};
  if (o[id] != null) return o[id];
  const g = (TOOLS[tool].palette || []).find((x) => x.id === id);
  return g ? g.default : null;
}
function setOpt(id, v, tool = T.tool) {
  (T.opts[tool] = T.opts[tool] || {})[id] = v;
  // A building definition sets the footprint shape and storeys it is usually drawn with.
  if (tool === 'building' && id === 'def' && BUILDING_DEFS[v]) { T.opts.building.shape = BUILDING_DEFS[v].shape; T.opts.building.floors = BUILDING_DEFS[v].floors; }
  if (tool === T.tool && T.draft && (id === 'shape' || id === 'item' || id === 'brush' || id === 'mode' || id === 'def')) cancelDraft(true);
  if (id === 'item') T.artGhost = null;
  // Paint keeps the materials you used last within reach; the rest are in the Library.
  if (id === 'material') T.recentMat = [v, ...T.recentMat.filter((x) => x !== v)].slice(0, 5);
  VIEW.dirty = true; uiSync();
}
/* The palette groups that apply now: conditional groups follow the current options; the shelf comes from T.shelf. */
function groupsOf(tool = T.tool) {
  return (TOOLS[tool].palette || []).filter((g) => !g.when || g.when((id) => opt(id, tool)))
    .map((g) => g.shelf ? { ...g, options: T.shelf.map((v, i) => ({ v, icon: ITEMS[v].icon, label: ITEMS[v].label, key: String(i + 1) })) } : g);
}
/* A thing picked from the Library joins the shelf at the front; the oldest leaves. */
function shelfPut(v) { if (!T.shelf.includes(v)) T.shelf = [v, ...T.shelf].slice(0, SHELF_DEFAULT.length); }
const isStream = () => T.tool === 'water' && opt('mode') === 'stream';
/* Pointer input goes to the shared shape machinery (not to a tool's own move/down/up). */
function shapeInput() { return !(T.draft && T.draft.kind) && (DRAWING.has(T.tool) || isStream()); }
function setState(s) { if (T.state !== s) { T.state = s; T.stateAt = performance.now(); uiSync(); } }
function setTag(at, text, kind = 'live', sub = null) { T.tag = at ? { at, text, kind, sub } : null; }

// ── picking ───────────────────────────────────────────────────────────────────
function pickWall(sx, sy) {
  let best = null; const q = { x: sx, y: sy };
  if (_ce < 0.22) {
    const g = pickGround(sx, sy);
    for (const wl of world.walls) {
      const pts = wallPts(wl), r = G.distPoly(g, pts);
      if (r.d > wl.thick / 2 + Math.max(0.25, 7 / CAM.scale)) continue;
      let s = 0; for (let i = 0; i < r.i; i++) s += G.dist(pts[i], pts[i + 1]); s += G.dist(pts[r.i], r.p);
      const dir = G.norm(G.sub(pts[r.i + 1], pts[r.i])), side = G.dot(G.sub(g, r.p), G.left(dir)) >= 0 ? 1 : -1;
      const c = { kind: 'wall', item: wl, id: wl.id, s, z: null, side, d: -1000 + r.d, p: r.p };
      if (!best || c.d < best.d) best = c;
    }
    return best;
  }
  for (const wl of world.walls) {
    const pts = wallPts(wl), base = wallBase(wl), top = base + wl.height; let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = G.dist(a, b);
      const n = G.left(G.norm(G.sub(b, a))), side = facesViewer(n) ? 1 : -1, off = G.mul(n, side * wl.thick / 2);
      const A = G.add(a, off), B = G.add(b, off);
      const A0 = P(A.x, A.y, base), B0 = P(B.x, B.y, base), B1 = P(B.x, B.y, top), A1 = P(A.x, A.y, top);
      const At = P(a.x - off.x, a.y - off.y, top), Bt = P(b.x - off.x, b.y - off.y, top);
      if (G.inPoly(q, [A0, B0, B1, A1]) || G.inPoly(q, [A1, B1, Bt, At])) {
        const dx = B0.x - A0.x, u = Math.abs(dx) > 1 ? clamp((sx - A0.x) / dx, 0, 1) : 0.5;
        const yb = A0.y + (B0.y - A0.y) * u, z = clamp((yb - sy) / (CAM.scale * _ce), 0, wl.height);
        const p = G.lerp(a, b, u), d = depthOf(p.x, p.y, base + z);
        if (!best || d < best.d) best = { kind: 'wall', item: wl, id: wl.id, s: acc + u * L, z, side, d, p };
      }
      acc += L;
    }
  }
  return best;
}
function roofTopZ(b) { const f = roofFaces(footOf(b), b.base + bHeight(b), b.roof, b.pitch); let m = b.base + bHeight(b); for (const fc of f) for (const p of fc.pts) m = Math.max(m, p.z); return m; }
function pickBuilding(sx, sy) {
  let best = null; const q = { x: sx, y: sy };
  for (const b of world.buildings) {
    const z0 = b.base, H = bHeight(b);
    for (const f of roofFaces(footOf(b), z0 + H, b.roof, b.pitch)) {
      if (!G.inPoly(q, f.pts.map((p) => P(p.x, p.y, p.z)))) continue;
      const c = centroid3(f.pts), d = depthOf(c.x, c.y, c.z) - 0.3;
      if (!best || d < best.d) best = { kind: 'building', item: b, id: b.id, part: 'roof', d, p: c };
    }
    for (const e of bEdges(b)) {
      if (!facesViewer(e.out) && _ce > 0.22) continue;
      const A0 = P(e.a.x, e.a.y, z0), B0 = P(e.b.x, e.b.y, z0), B1 = P(e.b.x, e.b.y, z0 + H), A1 = P(e.a.x, e.a.y, z0 + H);
      if (!G.inPoly(q, [A0, B0, B1, A1])) continue;
      const dx = B0.x - A0.x, u = Math.abs(dx) > 1 ? clamp((sx - A0.x) / dx, 0, 1) : 0.5;
      const z = clamp((A0.y + (B0.y - A0.y) * u - sy) / (CAM.scale * Math.max(0.05, _ce)), 0, H - 0.01);
      const p = G.lerp(e.a, e.b, u), d = depthOf(p.x, p.y, z0 + z);
      if (!best || d < best.d) best = { kind: 'building', item: b, id: b.id, part: 'face', edge: e.i, s: u * e.len, z, floor: Math.floor(z / STOREY), d, p, e };
    }
    if (_ce < 0.22 && G.inPoly(pickGround(sx, sy), footOf(b))) {
      const c = G.centroid(footOf(b));
      if (!best) best = { kind: 'building', item: b, id: b.id, part: 'roof', d: -2000, p: c };
    }
  }
  return best;
}
function pickAny(sx, sy) {
  const q = { x: sx, y: sy }, cands = [];
  const w = pickWall(sx, sy); if (w) cands.push(w);
  const b = pickBuilding(sx, sy); if (b) cands.push(b);
  for (const o of world.openings) {
    let outline, d;
    if (o.hostKind === 'wall') {
      const wl = world.walls.find((x) => x.id === o.hostId); if (!wl) continue;
      const pts = wallPts(wl), at = G.atLen(pts, o.s), side = facesViewer(G.left(at.dir)) ? 1 : -1;
      outline = openingOutline(o).map(([u, v]) => wallUV(pts, wl, u, Math.min(v, wl.height), side));
    } else {
      const bd = world.buildings.find((x) => x.id === o.hostId); if (!bd) continue;
      const e = bEdges(bd)[o.edge]; if (!e || !facesViewer(e.out)) continue;
      outline = openingOutline({ ...o, sill: o.floor * STOREY + o.sill }).map(([u, v]) => ({ x: e.a.x + e.dir.x * u + e.out.x * 0.03, y: e.a.y + e.dir.y * u + e.out.y * 0.03, z: bd.base + v }));
    }
    if (G.inPoly(q, outline.map((p) => P(p.x, p.y, p.z)))) { const c = centroid3(outline); d = depthOf(c.x, c.y, c.z) - 0.08; cands.push({ kind: 'opening', item: o, id: o.id, d, p: c }); }
  }
  for (const a of world.art) {
    const wl = world.walls.find((x) => x.id === a.wallId); if (!wl) continue;
    const pts = wallPts(wl), at = G.atLen(pts, a.s); if (!facesViewer(G.mul(G.left(at.dir), a.side))) continue;
    const [aw, ah] = ART_SIZES[a.size];
    const cs = [[-aw / 2, -ah / 2], [aw / 2, -ah / 2], [aw / 2, ah / 2], [-aw / 2, ah / 2]].map(([u, v]) => wallUV(pts, wl, a.s + u, a.line + v, a.side, 0.05));
    if (G.inPoly(q, cs.map((p) => P(p.x, p.y, p.z)))) { const c = centroid3(cs); cands.push({ kind: 'art', item: a, id: a.id, d: depthOf(c.x, c.y, c.z) - 0.1, p: c }); }
  }
  for (const o of world.objects) {
    const def = OBJECTS[o.item], z = objBase(o.x, o.y), c = P(o.x, o.y, z + 0.45), r = Math.max(def.w, def.d) / 2 * CAM.scale * 0.85 + 5;
    if (Math.hypot(c.x - sx, c.y - sy) < r) cands.push({ kind: 'object', item: o, id: o.id, d: depthOf(o.x, o.y, z + 0.45), p: o });
  }
  for (const f of world.forms) {
    const z0 = f.base, z1 = f.base + f.h;
    let on = G.inPoly(q, f.pts.map((p) => P(p.x, p.y, z1)));
    for (let i = 0; i < f.pts.length && !on; i++) { const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length]; on = G.inPoly(q, [P(a.x, a.y, z0), P(b.x, b.y, z0), P(b.x, b.y, z1), P(a.x, a.y, z1)]); }
    if (on) { const c = G.centroid(f.pts); cands.push({ kind: 'form', item: f, id: f.id, d: depthOf(c.x, c.y, z1) + 0.2, p: { ...c, z: z1 } }); }
  }
  for (const l of world.lights) {
    const lp = lightPos(l); if (!lp) continue;
    const c = P(lp.x, lp.y, lp.z);
    if (Math.hypot(c.x - sx, c.y - sy) < 0.32 * CAM.scale + 6) cands.push({ kind: 'light', item: l, id: l.id, d: depthOf(lp.x, lp.y, lp.z) - 0.2, p: lp });
  }
  for (const st of world.stairs) {
    const d = G.norm(G.sub(st.b, st.a)), n = G.left(d), w = st.width / 2, zm = (st.z0 + st.z1) / 2;
    const cs = [G.add(st.a, G.mul(n, -w)), G.add(st.b, G.mul(n, -w)), G.add(st.b, G.mul(n, w)), G.add(st.a, G.mul(n, w))];
    if (G.inPoly(q, cs.map((p, i) => P(p.x, p.y, i === 1 || i === 2 ? st.z1 : st.z0)))) { const m = G.mid(st.a, st.b); cands.push({ kind: 'stair', item: st, id: st.id, d: depthOf(m.x, m.y, zm), p: m }); }
  }
  for (const r of world.roofs) {
    const room = world.rooms.find((x) => x.id === r.roomId); let poly = room && roomPoly(room); if (!poly) continue;
    if (G.area(poly) < 0) poly = poly.slice().reverse();
    for (const f of roofFaces(poly, roomTop(room), r.style, PITCH[r.pitch] || PITCH.mid)) {
      if (G.inPoly(q, f.pts.map((p) => P(p.x, p.y, p.z)))) { const c = centroid3(f.pts); cands.push({ kind: 'roof', item: r, id: r.id, d: depthOf(c.x, c.y, c.z) - 0.3, p: c }); break; }
    }
  }
  const g = pickGround(sx, sy);
  for (const pa of world.paths) if (G.distPoly(g, pa.pts).d < pa.width / 2) cands.push({ kind: 'path', item: pa, id: pa.id, d: depthOf(g.x, g.y, g.z) + 0.5, p: g });
  for (const r of world.rooms) { const poly = roomPoly(r); if (poly && G.inPoly(g, poly)) cands.push({ kind: 'room', item: r, id: r.id, d: depthOf(g.x, g.y, g.z) + 0.6, p: g }); }
  cands.sort((a, b) => a.d - b.d);
  return cands[0] || null;
}

// ── snapping and shape input ──────────────────────────────────────────────────
function clampWS(p) { return { x: clamp(p.x, -TER.HALF + 0.2, TER.HALF - 0.2), y: clamp(p.y, -TER.HALF + 0.2, TER.HALF - 0.2) }; }
function snapPoint(g, e, extra = []) {
  if (e && e.altKey) return { p: clampWS(g), kind: 'free' };
  const tol = Math.max(0.35, 10 / CAM.scale); let best = null;
  const consider = (q) => { const d = G.dist(q, g); if (d < tol && (!best || d < best.d)) best = { d, q }; };
  for (const wl of world.walls) { consider(wl.a); consider(wl.b); }
  for (const b of world.buildings) if (b.shape !== 'circle') b.pts.forEach(consider);
  extra.forEach(consider);
  if (best) return { p: { x: best.q.x, y: best.q.y }, kind: 'wall' };
  return { p: clampWS({ x: Math.round(g.x * 2) / 2, y: Math.round(g.y * 2) / 2 }), kind: 'grid' };
}
function boxPts(a, b, square) {
  let bx = b.x, by = b.y;
  if (square) { const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)); bx = a.x + Math.sign(b.x - a.x || 1) * s; by = a.y + Math.sign(b.y - a.y || 1) * s; }
  const pts = [{ x: a.x, y: a.y }, { x: bx, y: a.y }, { x: bx, y: by }, { x: a.x, y: by }];
  return G.area(pts) < 0 ? pts.reverse() : pts;
}
function circleGeom(c, r, rot = 0) {
  const pts = [0, 1, 2, 3].map((k) => ({ x: c.x + r * Math.cos(rot + k * Math.PI / 2), y: c.y + r * Math.sin(rot + k * Math.PI / 2) }));
  const s = -r * (1 - Math.SQRT1_2);
  return { pts, bulges: [s, s, s, s], closed: true, circle: { c, r } };
}
function newShape(shape) { return { shape, pts: [], bulges: [], phase: 'start', cursor: null, snap: 'grid', down: null, closed: false, closing: false }; }
function arcBulge(d, c) {
  const a = d.pts[d.pts.length - 2], b = d.pts[d.pts.length - 1]; if (!a || !b || !c) return 0;
  const ch = G.dist(a, b); if (ch < 0.1) return 0;
  const s = G.dot(G.sub(c, G.mid(a, b)), G.left(G.norm(G.sub(b, a))));
  return Math.abs(s) < 0.12 ? 0 : clamp(s, -ch * 0.5, ch * 0.5);
}
/* Returns 'finish' when the shape is complete. */
function shapeDown(d, p) {
  if (d.shape === 'line' || d.shape === 'outline') {
    if (d.pts.length >= 3 && G.dist(p, d.pts[0]) < 0.3) { d.closed = true; return 'finish'; }
    if (d.pts.length && G.dist(p, d.pts[d.pts.length - 1]) < 0.05) return null;
    d.pts.push(p); d.bulges.push(0); return null;
  }
  if (d.shape === 'arc') {
    if (!d.pts.length) { d.pts.push(p); d.phase = 'end'; return null; }
    if (d.phase === 'end') {
      if (G.dist(p, d.pts[d.pts.length - 1]) < 0.3) return null;
      if (d.pts.length >= 2 && G.dist(p, d.pts[0]) < 0.3) { d.closing = true; d.pts.push({ ...d.pts[0] }); } else d.pts.push(p);
      d.bulges.push(0); d.phase = 'bend'; return null;
    }
    d.bulges[d.bulges.length - 1] = arcBulge(d, d.cursor); d.phase = 'end';
    if (d.closing) { d.pts.pop(); d.closed = true; return 'finish'; }
    return null;
  }
  d.down = p; d.pts = [p]; return null;
}
function shapeMove(d, p, raw) {
  d.cursor = p;
  if (d.shape === 'free' && d.down) { const last = d.pts[d.pts.length - 1]; if (G.dist(raw, last) > 0.35) d.pts.push(clampWS(raw)); }
}
function shapeUp(d, p, e) {
  if (!d.down) return null;
  if (d.shape === 'box') { const c = boxPts(d.down, p, e.shiftKey); if (Math.abs(c[0].x - c[2].x) < 0.9 || Math.abs(c[0].y - c[2].y) < 0.9) { d.down = null; d.pts = []; return 'tiny'; } d.pts = c; d.closed = true; return 'finish'; }
  if (d.shape === 'circle') { if (G.dist(d.down, p) < 0.9) { d.down = null; d.pts = []; return 'tiny'; } d.r = G.dist(d.down, p); return 'finish'; }
  if (d.shape === 'free') { if (G.polyLen(d.pts) < 1.2) { d.down = null; d.pts = []; return 'tiny'; } return 'finish'; }
  return null;
}
/* The shape's geometry now: chain points, bulges, closed. */
function shapeGeom(d, final, e) {
  const cur = d.cursor;
  if (d.shape === 'line' || d.shape === 'outline') {
    const pts = d.pts.slice(); if (!final && cur && !d.closed && pts.length) pts.push(cur);
    return pts.length >= 2 ? { pts, bulges: pts.map(() => 0), closed: d.closed || (d.shape === 'outline' && final && pts.length >= 3) } : null;
  }
  if (d.shape === 'arc') {
    const pts = d.pts.slice(), bulges = d.bulges.slice();
    if (!final && cur && pts.length) {
      if (d.phase === 'end') { pts.push(cur); bulges.push(0); } else if (d.phase === 'bend') bulges[bulges.length - 1] = arcBulge(d, cur);
    }
    if (d.closing && !final) { pts.pop(); return pts.length >= 2 ? { pts, bulges, closed: true } : null; }
    return pts.length >= 2 ? { pts, bulges, closed: d.closed } : null;
  }
  if (!d.down) return null;
  if (d.shape === 'box') { const c = final ? d.pts : boxPts(d.down, cur || d.down, e && e.shiftKey); return { pts: c, bulges: [0, 0, 0, 0], closed: true }; }
  if (d.shape === 'circle') { const r = final ? d.r : G.dist(d.down, cur || d.down); return r > 0.2 ? circleGeom(d.down, r) : null; }
  if (d.shape === 'free') return d.pts.length >= 2 ? { pts: d.pts.slice(), bulges: [], closed: false } : null;
  return null;
}
function geomPoints(gm) {
  const out = [], n = gm.closed ? gm.pts.length : gm.pts.length - 1;
  for (let i = 0; i < n; i++) { const seg = G.arcPoints(gm.pts[i], gm.pts[(i + 1) % gm.pts.length], gm.bulges[i] || 0); out.push(...(i ? seg.slice(1) : seg)); }
  return out;
}

// ── shared gesture plumbing ───────────────────────────────────────────────────
function cancelDraft(silent) {
  const had = !!T.draft;
  if (T.draft && T.draft.live) liveCancel();
  T.draft = null; T.live = []; T.ghosts = []; T.tag = null;
  if (had && !silent) setState('cancel');
  VIEW.dirty = true; uiSync();
  return had;
}
function refuse(at, text) {
  T.flash = { ghosts: T.ghosts.map((g) => ({ ...g, hl: 'refuse' })), until: performance.now() + 1300 };
  T.draft = null; T.live = []; T.ghosts = [];
  setTag(at, text, 'refuse');
  setState('refuse');
  VIEW.dirty = true; uiSync();
}
function finishCommit(label, ids) {
  const now = performance.now();
  if (!REDUCED.matches) for (const id of ids || []) RISE.set(id, now);
  T.draft = null; T.live = []; T.ghosts = []; T.tag = null;
  setState('commit');
  VIEW.dirty = true; uiSync();
}
/** Commit a gesture with its consequences; keep the tokens to amend the same step. */
function commitAmendable(label, cons, mutate, intent) {
  let made = null;
  commit(label, (w) => { made = mutate(w, cons); return made; }, intent(cons));
  T.lastIntent = intent(cons);
  const amendable = cons.filter((c) => !c.info);
  T.amend = amendable.length || cons.length ? {
    cons, label,
    redo() { amendLast(label, (w) => mutate(w, cons), intent(cons)); T.lastIntent = intent(cons); VIEW.dirty = true; uiSync(); },
  } : null;
  return made;
}
function plainCommit(label, mutate, intent) {
  T.amend = null;
  const res = commit(label, mutate, intent);
  T.lastIntent = intent;
  return res;
}
function consIntent(cons) {
  return cons.filter((c) => !c.info && (c.accepted !== false)).map((c) => {
    if (c.type === 'opening' || c.type === 'wallOpening' || c.type === 'bdoor') return { intent: 'layout.opening.cut', kind: c.kind || 'door', host: c.hostId || 'new', at: r2(c.s ?? 0) };
    if (c.type === 'slope') return { intent: 'landscape.path.slope', as: c.choice };
    if (c.type === 'water') return { intent: 'landscape.path.crossing', as: c.choice };
    if (c.type === 'ground') return { intent: c.choice === 'plinth' ? 'layout.structure.plinth' : 'landscape.ground.level', height: r2(c.hi - c.lo) };
    if (c.type === 'clear') return { intent: 'landscape.plants.remove', count: c.count };
    if (c.type === 'aim') return c.choice === 'keep' ? { intent: 'scene.light.aimAt', target: c.target } : c.choice === 'once' ? { intent: 'scene.light.orient', toward: c.target } : null;
    if (c.type === 'style') return { intent: 'scene.material.scope', scope: c.choice };
    if (c.type === 'roof') return c.choice === 'none' ? null : { intent: 'layout.roof.set', style: c.choice, pitch: 'mid' };
    return { intent: c.type };
  }).filter(Boolean);
}

// ── removal (named consequences) ──────────────────────────────────────────────
function eraseSummary(hit) {
  const goes = [], stays = [], ids = [];
  const id = hit.id;
  if (hit.kind === 'room') return { refuse: `${hit.item.name} comes from its walls. Erase a wall to open it.` };
  if (hit.kind === 'wall') {
    for (const o of world.openings) if (o.hostId === id) { goes.push(o.name); ids.push(o.id); }
    for (const a of world.art) if (a.wallId === id) { goes.push(a.name); ids.push(a.id); }
    for (const l of world.lights) if (l.wallId === id) { goes.push(l.name); ids.push(l.id); }
    for (const r of roomsOfWall(id)) {
      stays.push(`${r.name} opens up`);
      for (const rf of world.roofs) if (rf.roomId === r.id) { goes.push(rf.name); ids.push(rf.id); }
      for (const l of world.lights) if (l.roomId === r.id && l.kind === 'pendant') { goes.push(l.name); ids.push(l.id); }
    }
  } else if (hit.kind === 'building') {
    for (const o of world.openings) if (o.hostId === id) { goes.push(o.name); ids.push(o.id); }
  } else if (hit.kind === 'path') {
    for (const o of world.openings) if (o.origin === hit.item.name) { stays.push(`${o.name} stays as an ordinary opening`); }
    if ((hit.item.crossings || []).some((c) => c.mode === 'bridge')) goes.push('its bridge');
  } else if (hit.kind === 'art') {
    for (const l of world.lights) if (l.aimAt === id) stays.push(`${l.name} stops aiming`);
  } else if (hit.kind === 'form') {
    const f = hit.item;
    for (const g of world.forms) if (g.on === id) stays.push(`${g.name} comes down`);
    for (const o of world.objects) if (G.inPoly(o, f.pts) && !formAt(o.x, o.y, id)) stays.push(`${o.name} comes down`);
  }
  return { goes, stays, ids };
}
function removeThing(w, kind, id) {
  const drop = (k, f) => { w[k] = w[k].filter((x) => !f(x)); };
  if (kind === 'wall') {
    const name = (w.walls.find((x) => x.id === id) || {}).name;
    const rooms = w.rooms.filter((r) => r.wallIds.includes(id)).map((r) => r.id);
    drop('openings', (o) => o.hostId === id); drop('art', (a) => a.wallId === id); drop('lights', (l) => l.wallId === id || (rooms.includes(l.roomId) && l.kind === 'pendant'));
    drop('roofs', (r) => rooms.includes(r.roomId)); drop('rooms', (r) => rooms.includes(r.id)); drop('walls', (x) => x.id === id);
    return name;
  }
  if (kind === 'building') { drop('openings', (o) => o.hostId === id); drop('buildings', (b) => b.id === id); return; }
  if (kind === 'path') { const pa = w.paths.find((x) => x.id === id); if (pa) for (const o of w.openings) if (o.origin === pa.name) o.origin = null; drop('paths', (x) => x.id === id); return; }
  if (kind === 'form') {
    const f = w.forms.find((x) => x.id === id);
    if (f) for (const g of formsAbove(w, id)) { g.base -= f.h; if (g.on === id) g.on = f.on || null; }
    drop('forms', (x) => x.id === id); return;
  }
  if (kind === 'art') { for (const l of w.lights) if (l.aimAt === id) { l.aimPoint = null; l.aimAt = null; } drop('art', (x) => x.id === id); return; }
  const map = { opening: 'openings', object: 'objects', light: 'lights', stair: 'stairs', roof: 'roofs' };
  if (map[kind]) drop(map[kind], (x) => x.id === id);
}
const OWNER_OF = { wall: 'layout', opening: 'layout', building: 'layout', roof: 'layout', stair: 'layout', room: 'layout', object: 'scene', form: 'scene', art: 'scene', light: 'scene', path: 'landscape' };
/* Forms stacked on a form, all the way up. */
function formsAbove(w, id) { const out = []; const walk = (pid) => { for (const g of w.forms) if (g.on === pid && !out.includes(g)) { out.push(g); walk(g.id); } }; walk(id); return out; }
/* What rides along when a form moves: forms stacked on it, and things standing on its top. */
function formRiders(id) {
  const f = world.forms.find((x) => x.id === id); if (!f) return [];
  const stack = [f, ...formsAbove(world, id)];
  const things = [...world.objects, ...world.lights.filter((l) => !l.wallId && l.kind !== 'pendant')].filter((o) => stack.some((g) => G.inPoly(o, g.pts)));
  return [...stack.slice(1), ...things];
}

// ── tool behaviours ───────────────────────────────────────────────────────────
const IMPL = {};

/* Select: pick, pull marks, orbit on empty Stage. */
IMPL.select = {
  move(ev) {
    if (T.drag) return this.drag(ev);
    const k = selectKnob(ev.sx, ev.sy);
    const hit = k ? null : pickAny(ev.sx, ev.sy);
    HL.hover = hit ? hit.id : null; HL.hoverMode = 'hover';
    VIEW.cv.style.cursor = k ? (k.type === 'bend' ? 'grab' : 'ns-resize') : hit ? 'pointer' : 'default';
    setTag(null);
    if (k) setTag(null);
  },
  down(ev) {
    const k = selectKnob(ev.sx, ev.sy);
    if (k) { const it = byId(world, k.id).item; T.drag = { type: k.type, id: k.id, sy: ev.sy, start: k.start, was: k.type === 'bend' ? it.bulge : k.type === 'fheight' ? it.h : it.floors }; liveBegin(); return true; }
    const hit = pickAny(ev.sx, ev.sy);
    if (!hit) { selectId(null); return false; }
    selectId(hit.id);
    if (hit.kind === 'object' || (hit.kind === 'light' && hit.item.kind !== 'wall')) T.drag = { type: 'move', id: hit.id, from: ev.g, moved: false, ox: hit.item.x - ev.g.x, oy: hit.item.y - ev.g.y, sx: ev.sx, sy: ev.sy };
    if (hit.kind === 'form') {
      const keep = (o) => ({ o, x: o.x, y: o.y, pts: o.pts ? o.pts.map((p) => ({ ...p })) : null });
      T.drag = { type: 'fmove', id: hit.id, from: clampWS(ev.g), moved: false, sx: ev.sx, sy: ev.sy, parts: [hit.item, ...formRiders(hit.id)].map(keep) };
    }
    return true;
  },
  drag(ev) {
    const d = T.drag; if (!d) return;
    const r = byId(world, d.id); if (!r) return;
    if (d.type === 'bend') {
      const wl = r.item, ch = G.dist(wl.a, wl.b), n = G.left(G.norm(G.sub(wl.b, wl.a)));
      let s = G.dot(G.sub(ev.g, G.mid(wl.a, wl.b)), n); s = Math.abs(s) < 0.15 ? 0 : clamp(s, -ch * 0.5, ch * 0.5);
      wl.bulge = s; setTag(ev.g, s ? `bend ${fmt(Math.abs(s), 2)} m` : 'straight');
    } else if (d.type === 'storey') {
      const b = r.item, f = clamp(Math.round(d.start + (d.sy - ev.sy) / (STOREY * CAM.scale * Math.max(0.3, _ce))), 1, 5);
      b.floors = f; setTag({ ...G.centroid(footOf(b)), z: b.base + bHeight(b) }, `${f} storey${f > 1 ? 's' : ''}`);
    } else if (d.type === 'move') {
      if (!d.moved && Math.hypot(ev.sx - d.sx, ev.sy - d.sy) < 4) return;
      if (!d.moved) { d.moved = true; liveBegin(); }
      const it = byId(world, d.id).item; it.x = clampWS(ev.g).x + d.ox; it.y = clampWS(ev.g).y + d.oy;
      setTag(it, `${fmt(it.x, 1)}, ${fmt(it.y, 1)}`);
    } else if (d.type === 'fheight') {
      const f = r.item, h = clamp(Math.round((d.was + (d.sy - ev.sy) / (CAM.scale * Math.max(0.35, _ce))) * 10) / 10, 0.1, 8), dh = h - f.h;
      if (dh) { f.h = h; for (const g of formsAbove(world, f.id)) g.base += dh; }
      setTag({ ...G.centroid(f.pts), z: f.base + f.h + 0.9 }, `${fmt(h, 1)} m`);
    } else if (d.type === 'fmove') {
      if (!d.moved && Math.hypot(ev.sx - d.sx, ev.sy - d.sy) < 4) return;
      if (!d.moved) { d.moved = true; liveBegin(); }
      const g = clampWS(ev.g), dx = Math.round((g.x - d.from.x) * 4) / 4, dy = Math.round((g.y - d.from.y) * 4) / 4;
      for (const k of d.parts) { if (k.pts) k.o.pts = k.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })); else { k.o.x = k.x + dx; k.o.y = k.y + dy; } }
      const n = d.parts.length - 1;
      setTag({ ...G.centroid(r.item.pts), z: r.item.base + r.item.h + 0.6 }, n ? `carries ${n} thing${n > 1 ? 's' : ''}` : `${fmt(dx, 2)}, ${fmt(dy, 2)} m`);
    }
    VIEW.dirty = true;
  },
  up() {
    const d = T.drag; T.drag = null; if (!d) return;
    const r = byId(world, d.id); setTag(null);
    if ((d.type === 'bend' && r.item.bulge === d.was) || (d.type === 'storey' && r.item.floors === d.was) || (d.type === 'fheight' && r.item.h === d.was)) { liveCancel(); VIEW.dirty = true; return; }
    if (d.type === 'bend') { liveEnd(`Bend ${r.item.name}`, { intent: 'layout.wall.bend', wall: d.id, sagitta: r2(r.item.bulge) }); T.lastIntent = HIST.undo[HIST.undo.length - 1].intent; }
    else if (d.type === 'storey') { liveEnd(`${r.item.name} to ${r.item.floors} storeys`, { intent: 'layout.structure.setStoreys', structure: d.id, storeys: r.item.floors }); T.lastIntent = HIST.undo[HIST.undo.length - 1].intent; }
    else if (d.type === 'fheight') { liveEnd(`${r.item.name} to ${fmt(r.item.h, 1)} m`, { intent: 'scene.form.setHeight', form: d.id, height: r.item.h, stacked: formsAbove(world, d.id).map((g) => g.id) }); T.lastIntent = HIST.undo[HIST.undo.length - 1].intent; }
    else if (d.type === 'fmove' && d.moved) { liveEnd(`Move ${r.item.name}`, { intent: 'scene.instance.move', id: d.id, by: pt2(G.sub(r.item.pts[0], d.parts[0].pts[0])), carries: d.parts.slice(1).map((k) => k.o.id) }); T.lastIntent = HIST.undo[HIST.undo.length - 1].intent; }
    else if (d.type === 'move' && d.moved) { liveEnd(`Move ${r.item.name}`, { intent: `${OWNER_OF[r.kind === 'lights' ? 'light' : 'object']}.instance.move`, id: d.id, to: pt2(r.item) }); T.lastIntent = HIST.undo[HIST.undo.length - 1].intent; }
    T.amend = null; VIEW.dirty = true; uiSync();
  },
};
function selectId(id) { T.sel = id; HL.sel = id; T.amend = null; VIEW.dirty = true; uiSync(); }
function selectKnob(sx, sy) {
  if (!T.sel || T.tool !== 'select') return null;
  const r = byId(world, T.sel); if (!r) return null;
  if (r.kind === 'walls') {
    const wl = r.item, pts = wallPts(wl), m = G.atLen(pts, G.polyLen(pts) / 2).p, s = P(m.x, m.y, wallBase(wl) + wl.height + 0.05);
    if (Math.hypot(s.x - sx, s.y - sy) < 11) return { type: 'bend', id: wl.id };
  }
  if (r.kind === 'buildings') {
    const b = r.item, c = G.centroid(footOf(b)), s = P(c.x, c.y, roofTopZ(b) + 0.9);
    if (Math.hypot(s.x - sx, s.y - sy) < 12) return { type: 'storey', id: b.id, start: b.floors };
  }
  if (r.kind === 'forms') {
    const f = r.item, c = G.centroid(f.pts), s = P(c.x, c.y, f.base + f.h + 0.55);
    if (Math.hypot(s.x - sx, s.y - sy) < 11) return { type: 'fheight', id: f.id };
  }
  return null;
}

/* Walls: any shape; closed runs enclose a room; crossings with paths propose doorways. */
IMPL.walls = {
  begin() { return newShape(opt('shape')); },
  plan(gm) { return planWalls(world, gm.pts, gm.bulges, gm.closed); },
  preview(gm, plan) {
    const n = gm.closed ? gm.pts.length : gm.pts.length - 1, h = H_WALL[opt('height')], base = chainBase(gm);
    T.ghosts = [];
    for (let i = 0; i < n; i++) {
      const refused = plan.refused.some((r) => r.i === i);
      T.ghosts.push({ kind: 'wall', obj: { id: 'ghost' + i, a: gm.pts[i], b: gm.pts[(i + 1) % gm.pts.length], bulge: gm.bulges[i] || 0, height: h, thick: 0.2, base, mat: ['limewash', 'limewash'] }, hl: refused ? 'refuse' : 'ghost' });
    }
  },
  finish(gm) {
    const plan = this.plan(gm);
    if (plan.refused.length) { const r = plan.refused[0]; const seg = G.arcPoints(gm.pts[r.i], gm.pts[(r.i + 1) % gm.pts.length], gm.bulges[r.i] || 0); const m = G.atLen(seg, G.polyLen(seg) / 2).p; return refuse({ ...m, z: hAt(m.x, m.y) + 1.5 }, `Refused · ${r.reason}`); }
    const h = H_WALL[opt('height')], base = chainBase(gm), shape = T.draft.shape;
    const n = gm.closed ? gm.pts.length : gm.pts.length - 1;
    const label = gm.closed && shape === 'circle' ? 'Draw a round room' : gm.closed ? `Enclose a room with ${n} walls` : `Draw ${n} wall${n > 1 ? 's' : ''}`;
    // Closing a run offers the new room a roof. Open is the default: the offer never covers the interior unasked.
    const cons = plan.cons.slice();
    if (gm.closed && opt('height') !== 'low') {
      const round = gm.bulges.slice(0, n).every((b) => b), boxy = n === 4 && gm.bulges.slice(0, n).every((b) => !b);
      const options = roofStyles(round, boxy), c = G.centroid(gm.pts);
      cons.push({ id: cid(), type: 'roof', at: { ...c, z: base + h + 1.2 }, options, choice: 'none', labels: Object.fromEntries(options.map((v) => [v, v === 'none' ? 'No roof · open to the sky' : ROOF_STYLES[v].label.split(' (')[0]])), icon: 'roof' });
    }
    let ids = [];
    commitAmendable(label, cons, (w, cons) => {
      const made = addWallChain(w, gm.pts, gm.bulges, gm.closed, { height: h, base });
      for (const c of cons) if (c.type === 'wallOpening' && c.accepted && made.walls[c.seg]) addOpening(w, { hostKind: 'wall', hostId: made.walls[c.seg].id, s: c.s, kind: h <= 1.5 ? 'gate' : 'doorway', width: c.width, origin: 'crossing path' });
      const rc = cons.find((c) => c.type === 'roof');
      if (rc && rc.choice !== 'none' && made.room) { const { id, name } = nid(w, 'roof'); w.roofs.push({ id, name, roomId: made.room.id, style: rc.choice, pitch: 'mid', mat: 'slate' }); }
      ids = made.walls.map((x) => x.id);
      return made;
    }, (cons) => ({ intent: 'layout.walls.draw', shape, points: gm.pts.map(pt2), bulges: gm.bulges.slice(0, n).map(r2), closed: gm.closed, height: h, datum: r2(base), consequences: consIntent(cons) }));
    finishCommit(label, ids);
  },
  tag(gm, d) {
    if (d.shape === 'circle' && gm && gm.circle) return `⌀ ${fmt(gm.circle.r * 2, 1)} m · ${fmt(Math.PI * gm.circle.r ** 2, 1)} m²`;
    if (d.shape === 'box' && gm) return `${fmt(Math.abs(gm.pts[0].x - gm.pts[2].x), 1)} × ${fmt(Math.abs(gm.pts[0].y - gm.pts[2].y), 1)} m`;
    if (!gm) return null;
    const i = gm.closed ? gm.pts.length - 1 : gm.pts.length - 2, seg = G.arcPoints(gm.pts[i], gm.pts[(i + 1) % gm.pts.length], gm.bulges[i] || 0);
    return `${fmt(G.polyLen(seg), 2)} m${gm.bulges[i] ? ' arc' : ''}`;
  },
};
/* Which roofs a room can take: a dome needs a round room, a gable four straight walls. */
function roofStyles(round, boxy) { return round ? ['none', 'dome', 'flat'] : boxy ? ['none', 'flat', 'hip', 'gable'] : ['none', 'flat', 'hip']; }
function roomRoofStyles(room) {
  const walls = room.wallIds.map((id) => world.walls.find((x) => x.id === id)).filter(Boolean);
  return roofStyles(walls.length > 1 && walls.every((x) => x.bulge), walls.length === 4 && walls.every((x) => !x.bulge));
}
/* Selection action: set, change or remove a room's roof, as one undo step through Layout. */
function setRoomRoof(roomId, style, pitch) {
  const room = world.rooms.find((r) => r.id === roomId); if (!room) return;
  const cur = world.roofs.find((r) => r.roomId === roomId);
  const p = pitch || (cur && cur.pitch) || 'mid';
  if ((cur ? cur.style : 'none') === style && (!cur || cur.pitch === p)) return;
  const label = style === 'none' ? `Open ${room.name} to the sky` : !cur ? `Roof ${room.name}` : cur.style === style ? `Pitch the roof on ${room.name}` : `Change the roof on ${room.name}`;
  plainCommit(label, (w) => {
    const keep = w.roofs.find((r) => r.roomId === roomId);
    w.roofs = w.roofs.filter((r) => r.roomId !== roomId);
    if (style !== 'none') { const { id, name } = keep || nid(w, 'roof'); w.roofs.push({ id, name, roomId, style, pitch: p, mat: (keep && keep.mat) || 'slate' }); }
  }, style === 'none' ? { intent: 'layout.roof.remove', room: roomId } : { intent: 'layout.roof.set', room: roomId, style, pitch: p });
  if (T.sel && !byId(world, T.sel)) selectId(room.id);
  setState('commit'); VIEW.dirty = true; uiSync();
}
function chainBase(gm) { let lo = Infinity; for (const p of geomPoints(gm)) lo = Math.min(lo, hAt(p.x, p.y)); return isFinite(lo) ? lo : 0; }

/* Building: footprint in, whole building out; still editable afterwards. */
IMPL.building = {
  begin() { return newShape(opt('shape')); },
  spec(gm) {
    const D = BUILDING_DEFS[opt('def')] || BUILDING_DEFS.cottage, floors = +opt('floors'), roof = D.roof, windows = D.windows, style = D.label;
    if (gm.circle) return { shape: 'circle', c: gm.circle.c, r: gm.circle.r, floors, roof: roof === 'flat' ? 'flat' : 'cone', windows, style };
    return { shape: 'poly', pts: gm.pts, floors, roof: roof === 'cone' ? 'hip' : gm.pts.length !== 4 && roof === 'gable' ? 'hip' : roof, windows, style };
  },
  foot(spec) { return spec.shape === 'circle' ? G.circlePoly(spec.c, spec.r, 28) : spec.pts; },
  plan(gm) { const spec = this.spec(gm); return { spec, ...planBuilding(world, this.foot(spec)) }; },
  preview(gm, plan) {
    const foot = this.foot(plan.spec), g = groundRange(foot);
    const b = { id: 'ghost', ...plan.spec, pts: plan.spec.pts ? (G.area(plan.spec.pts) < 0 ? plan.spec.pts.slice().reverse() : plan.spec.pts) : null, pitch: PITCH.mid, base: g.hi, mat: 'limewash', roofMat: 'slate', overrides: {} };
    T.ghosts = [{ kind: 'building', obj: b, hl: plan.refused ? 'refuse' : 'ghost', lo: g.lo }];
  },
  finish(gm) {
    if (!gm.closed || (gm.pts.length < 3 && !gm.circle)) return refuse(null, 'A footprint needs three corners');
    const plan = this.plan(gm);
    if (plan.refused) { const c = G.centroid(this.foot(plan.spec)); return refuse({ ...c, z: hAt(c.x, c.y) + 3 }, `Refused · ${plan.refused}`); }
    const spec = plan.spec, foot = this.foot(spec), label = `Raise a ${spec.style.toLowerCase()}${spec.floors > 1 ? `, ${spec.floors} storeys` : ''}`;
    let id = null;
    commitAmendable(label, plan.cons, (w, cons) => {
      const g = groundRange(foot, w); let base = g.hi;
      const gc = cons.find((c) => c.type === 'ground');
      if (gc && gc.choice === 'level') { base = (g.lo + g.hi) / 2; terraceTerrain(w, G.offsetPoly(G.area(foot) < 0 ? foot.slice().reverse() : foot, 1.0), base); }
      const b = addBuilding(w, { ...spec, base });
      for (const c of cons) if (c.type === 'bdoor' && c.accepted) addOpening(w, { hostKind: 'building', hostId: b.id, edge: c.edge, s: c.s, floor: 0, kind: 'door', origin: 'crossing path' });
      const cl = cons.find((c) => c.type === 'clear'); if (cl && cl.accepted) w.plants = w.plants.filter((p) => !(G.inPoly(p, foot) || G.distPoly(p, foot.concat([foot[0]])).d < 0.4));
      id = b.id; return b;
    }, (cons) => ({ intent: 'layout.structure.place', definition: spec.style, footprint: spec.shape === 'circle' ? { circle: pt2(spec.c), r: r2(spec.r) } : spec.pts.map(pt2), storeys: spec.floors, roof: spec.roof, windows: spec.windows, consequences: consIntent(cons) }));
    finishCommit(label, [id]);
  },
  tag(gm, d) {
    if (!gm) return null;
    const f = +opt('floors');
    if (gm.circle) return `⌀ ${fmt(gm.circle.r * 2, 1)} m · ${f} storey${f > 1 ? 's' : ''}`;
    if (d.shape === 'box') return `${fmt(Math.abs(gm.pts[0].x - gm.pts[2].x), 1)} × ${fmt(Math.abs(gm.pts[0].y - gm.pts[2].y), 1)} m · ${f} storey${f > 1 ? 's' : ''}`;
    return `${gm.pts.length} corners · ${fmt(Math.abs(G.area(gm.pts)), 1)} m²`;
  },
};

/* Path: lies on the ground and meets what it crosses. */
IMPL.path = {
  begin() { return newShape(opt('shape')); },
  plan(gm) { const pts = geomPoints(gm); return { pts, cons: pts.length > 1 ? planPath(world, G.resample(pts, 0.5).length > 1 ? pts : pts, +opt('width')) : [] }; },
  preview(gm, plan) { T.groundGhost = { kind: 'path', obj: { id: 'ghost', pts: plan.pts, width: +opt('width'), surface: opt('surface'), slope: 'steps', crossings: [] } }; },
  finish(gm) {
    const pts = geomPoints(gm); if (G.polyLen(pts) < 1) return cancelDraft();
    const plan = this.plan(gm), width = +opt('width'), surface = opt('surface');
    let id = null;
    commitAmendable('Lay a path', plan.cons, (w, cons) => { const pa = applyPath(w, { pts, width, surface }, cons); id = pa.id; return pa; },
      (cons) => ({ intent: 'landscape.path.lay', points: G.resample(pts, 1).map(pt2), width, surface, consequences: consIntent(cons) }));
    T.groundGhost = null;
    finishCommit('Lay a path', [id]);
  },
  tag(gm) { return gm ? `${fmt(G.polyLen(geomPoints(gm)), 1)} m` : null; },
};
/* Form: a footprint pulled up into a solid. It rests on the form, floor or ground beneath it. */
function formFoot(gm) { if (gm.circle) return G.circlePoly(gm.circle.c, gm.circle.r, 28); return G.area(gm.pts) < 0 ? gm.pts.slice().reverse() : gm.pts.slice(); }
/* A form is named by its proportions, so a composition reads in words: Stage, Drum, Pillar. */
function formName(pts, h, circle) {
  const a = Math.abs(G.area(pts)), span = Math.sqrt(a);
  if (circle) return h > span * 1.3 ? 'Column' : 'Drum';
  if (h <= 0.6 && a >= 4) return 'Stage';
  if (a < 2.5 && h <= 1.4) return 'Pedestal';
  if (h > span * 1.6) return 'Pillar';
  return 'Block';
}
IMPL.form = {
  begin() { return newShape(opt('shape')); },
  plan(gm) {
    const pts = formFoot(gm), c = G.centroid(pts), area = Math.abs(G.area(pts)), cons = [];
    if (area < 0.25) return { pts, base: hAt(c.x, c.y), cons, refused: 'Too small for a form' };
    const blk = world.buildings.find((b) => { const f = footOf(b); return pts.some((p) => G.inPoly(p, f)) || f.some((p) => G.inPoly(p, pts)); });
    const under = formAt(c.x, c.y);
    const room = !under && world.rooms.find((r) => { const p = roomPoly(r); return p && G.inPoly(c, p); });
    const g = groundRange(pts);
    const base = under ? under.base + under.h : room ? roomBase(room) + 0.03 : g.lo;
    const at = { ...c, z: base + 1.1 };
    if (blk) return { pts, base, cons, refused: `Overlaps ${blk.name}` };
    if (under) cons.push({ id: cid(), info: true, at, icon: 'datum', label: `Rests on ${under.name}` });
    else if (room) cons.push({ id: cid(), info: true, at, icon: 'datum', label: `Stands in ${room.name}` });
    else if (g.hi - g.lo > 0.15) cons.push({ id: cid(), info: true, at, icon: 'datum', label: `Grounded at its low corner · ${fmt(g.hi - g.lo, 1)} m into the slope` });
    const hit = under ? [] : world.plants.filter((p) => G.inPoly(p, pts));
    if (hit.length) cons.push({ id: cid(), type: 'clear', at: { ...c, z: base }, count: hit.length, accepted: true, label: `Clears ${hit.length} plant${hit.length > 1 ? 's' : ''}`, icon: 'clear' });
    return { pts, base, under, room, cons };
  },
  preview(gm, plan) { T.ghosts = [{ kind: 'form', obj: { id: 'ghost', pts: plan.pts, base: plan.base, h: 0.12, mat: opt('finish') }, hl: plan.refused ? 'refuse' : 'ghost' }]; },
  /* The footprint is done: enter the pull phase. Moving the pointer up raises it; a click sets it. */
  finish(gm) {
    const p0 = gm.pts[0];
    if (!gm.closed || (gm.pts.length < 3 && !gm.circle)) return refuse(p0 ? { ...p0, z: hAt(p0.x, p0.y) + 1 } : null, 'Refused · A footprint needs three corners');
    const plan = this.plan(gm);
    if (plan.refused) { const c = G.centroid(plan.pts); return refuse({ ...c, z: plan.base + 1 }, `Refused · ${plan.refused}`); }
    T.draft = { kind: 'formpull', shape: T.draft.shape, pts: plan.pts, base: plan.base, plan, sy: T.pointer ? T.pointer.sy : 0, h: 0.6, circle: !!gm.circle, r: gm.circle ? gm.circle.r : null };
    T.live = plan.cons.slice();
    this.pull(T.pointer);
  },
  pull(ev) {
    const d = T.draft; if (!ev || !d) return;
    d.h = clamp(Math.round((0.6 + (d.sy - ev.sy) / (CAM.scale * Math.max(0.35, _ce))) * 10) / 10, 0.1, 8);
    const c = G.centroid(d.pts);
    T.ghosts = [{ kind: 'form', obj: { id: 'ghost', pts: d.pts, base: d.base, h: d.h, mat: opt('finish') }, hl: 'ghost' }];
    setTag({ ...c, z: d.base + d.h + 0.6 }, `${formName(d.pts, d.h, d.circle)} · ${fmt(d.h, 1)} m · click to set`, 'live');
    setState('propose'); VIEW.dirty = true;
  },
  move(ev) { if (T.draft && T.draft.kind === 'formpull') this.pull(ev); },
  down() { if (T.draft && T.draft.kind === 'formpull') { this.set(); return true; } return false; },
  up() {},
  set() {
    const d = T.draft, h = d.h, mat = opt('finish'), nm = formName(d.pts, h, d.circle), label = `Make a ${nm.toLowerCase()}`, under = d.plan.under;
    let fid = null;
    commitAmendable(label, d.plan.cons, (w, cs) => {
      const { id, name } = nid(w, 'form', nm); fid = id;
      const f = { id, name, pts: d.pts.map((p) => ({ x: p.x, y: p.y })), base: d.base, h, mat, on: under ? under.id : null };
      w.forms.push(f);
      const cl = cs.find((c) => c.type === 'clear'); if (cl && cl.accepted) w.plants = w.plants.filter((p) => !G.inPoly(p, f.pts));
      return f;
    }, (cs) => ({ intent: 'scene.form.make', shape: d.shape, footprint: d.circle ? { circle: pt2(G.centroid(d.pts)), r: r2(d.r) } : d.pts.map(pt2), height: h, base: r2(d.base), finish: mat, restsOn: under ? under.id : d.plan.room ? d.plan.room.id : 'ground', consequences: consIntent(cs) }));
    finishCommit(label, [fid]);
  },
  tag(gm, d) {
    if (!gm) return null;
    const plan = planCache.plan, on = plan && plan.under ? ` · on ${plan.under.name}` : '';
    if (gm.circle) return `⌀ ${fmt(gm.circle.r * 2, 1)} m${on}`;
    if (d.shape === 'box') return `${fmt(Math.abs(gm.pts[0].x - gm.pts[2].x), 1)} × ${fmt(Math.abs(gm.pts[0].y - gm.pts[2].y), 1)} m${on}`;
    return `${gm.pts.length} corners · ${fmt(Math.abs(G.area(gm.pts)), 1)} m²${on}`;
  },
};
const DRAWING = new Set(['walls', 'building', 'path', 'form']);
const FOOTPRINT = new Set(['building', 'form']);

/* Opening: aim at a wall face, see the opening on it, click to cut. */
function openingAim(ev) {
  const kind = opt('kind', 'opening'), K = OPENING_KINDS[kind];
  const hw = pickWall(ev.sx, ev.sy), hb = pickBuilding(ev.sx, ev.sy);
  const hit = hw && (!hb || hw.d < hb.d) ? hw : hb && hb.part === 'face' ? hb : hb ? { roof: true, item: hb.item } : null;
  if (!hit) return { aim: 'Point at a wall' };
  if (hit.roof) return { refuse: 'Openings go in walls, not roofs', at: hb.p };
  if (hit.kind === 'wall') {
    const wl = hit.item, L = wallLen(wl), w = K.width, s = clamp(hit.s, w / 2, L - w / 2);
    const full = K.sill < 0.05 && (wl.height <= K.height + 0.05 || kind === 'wide');
    const o = { kind, width: w, height: full ? wl.height : K.height, sill: K.sill, s, hostKind: 'wall', hostId: wl.id };
    const at = { ...wallUV(wallPts(wl), wl, s, Math.min(wl.height, K.sill + K.height) + 0.4, hit.side) };
    if (L < w + 0.3) return { refuse: `${wl.name} is too short for a ${K.label.toLowerCase()}`, at, o, hit };
    if (hit.s - w / 2 < 0.12 || hit.s + w / 2 > L - 0.12) return { refuse: `Too close to the end of ${wl.name}`, at, o, hit };
    if (!full && K.sill + K.height > wl.height - 0.1) return { refuse: `${wl.name} is too low for a ${K.label.toLowerCase()}`, at, o, hit };
    const clash = world.openings.find((x) => x.hostId === wl.id && Math.abs(x.s - s) < (x.width + w) / 2 + 0.1);
    if (clash) return { refuse: `Overlaps ${clash.name}`, at, o, hit };
    const art = world.art.find((a) => a.wallId === wl.id && Math.abs(a.s - s) < (ART_SIZES[a.size][0] + w) / 2 + 0.05);
    if (art) return { refuse: `Overlaps ${art.name}`, at, o, hit };
    const rooms = roomsOfWall(wl.id);
    const info = K.blind ? 'Niche · not a passage' : rooms.length === 2 ? `Connects ${rooms[0].name} and ${rooms[1].name}` : rooms.length === 1 ? `Into ${rooms[0].name}` : full && wl.height <= 1.5 ? 'A gap in the garden wall' : null;
    return { ok: true, o, hit, at, info, label: `Cut ${/^[aeiou]/i.test(K.label) ? 'an' : 'a'} ${K.label.toLowerCase()} in ${wl.name}` };
  }
  const b = hit.item, e = hit.e, w = K.width, s = clamp(hit.s, w / 2 + 0.2, e.len - w / 2 - 0.2), floor = clamp(hit.floor, 0, b.floors - 1);
  const o = { kind, width: w, height: K.height, sill: K.sill, s, floor, edge: e.i, hostKind: 'building', hostId: b.id };
  const at = { x: e.a.x + e.dir.x * s + e.out.x * 0.3, y: e.a.y + e.dir.y * s + e.out.y * 0.3, z: b.base + floor * STOREY + K.sill + K.height + 0.4 };
  if (e.len < w + 0.5) return { refuse: `This face of ${b.name} is too narrow`, at, o, hit };
  if (floor > 0 && K.sill < 0.05) return { refuse: `${K.label}s go on the ground storey`, at, o, hit };
  const clash = world.openings.find((x) => x.hostId === b.id && x.edge === e.i && x.floor === floor && Math.abs(x.s - s) < (x.width + w) / 2 + 0.1);
  if (clash) return { refuse: `Overlaps ${clash.name}`, at, o, hit };
  return { ok: true, o, hit, at, info: `Into ${b.name}${b.floors > 1 ? ` · storey ${floor + 1}` : ''} · replaces generated windows`, label: `Cut a ${K.label.toLowerCase()} in ${b.name}` };
}
IMPL.opening = {
  move(ev) {
    const a = openingAim(ev); T.aimRes = a;
    HL.hover = a.hit ? a.hit.id : null; HL.hoverMode = a.ok ? 'hover' : 'hover';
    if (a.ok) { setTag(a.at, a.info || OPENING_KINDS[a.o.kind].label, 'live'); setState('aim'); }
    else if (a.refuse) { setTag(a.at, a.refuse, 'refuse'); setState('aim'); }
    else { setTag(null); setState('idle'); }
  },
  down(ev) {
    const a = openingAim(ev);
    if (!a.ok) { if (a.refuse) refuse(a.at, `Refused · ${a.refuse}`); return true; }
    let id = null;
    plainCommit(a.label, (w) => { const o = addOpening(w, a.o); id = o.id; return o; }, { intent: 'layout.opening.cut', host: a.o.hostId, edge: a.o.edge, storey: a.o.floor, at: r2(a.o.s), kind: a.o.kind, width: a.o.width });
    T.aimRes = null; finishCommit(a.label, []); setTag(a.at, a.info || 'Cut', 'live');
    return true;
  },
};

/* Stair: drag from the bottom to the top. */
IMPL.stair = {
  down(ev) { T.draft = { kind: 'stair', a: clampWS(ev.g), b: clampWS(ev.g) }; setState('draft'); return true; },
  move(ev) {
    if (!T.draft) { setTag(null); setState('aim'); return; }
    T.draft.b = clampWS(ev.g); const r = this.check(); T.ghosts = r.st ? [{ kind: 'stair', obj: r.st, hl: r.ok ? 'ghost' : 'refuse' }] : [];
    setTag({ ...T.draft.b, z: hAt(T.draft.b.x, T.draft.b.y) + 1.2 }, r.ok ? r.text : r.refuse, r.ok ? 'live' : 'refuse');
    VIEW.dirty = true;
  },
  check() {
    let { a, b } = T.draft; let z0 = hAt(a.x, a.y), z1 = hAt(b.x, b.y);
    if (z1 < z0) { [a, b] = [b, a]; [z0, z1] = [z1, z0]; }
    const L = G.dist(a, b), rise = z1 - z0, n = Math.max(2, Math.round(rise / 0.17));
    const st = L > 0.3 ? { id: 'ghost', a, b, z0, z1, width: +opt('width') } : null;
    if (L < 0.6) return { st, refuse: 'Drag from the bottom to the top' };
    if (rise < 0.35) return { st, refuse: 'Nothing to climb here' };
    if (L / n < 0.22) return { st, refuse: `Too steep: ${n} risers in ${fmt(L, 1)} m. Drag further` };
    return { ok: true, st, text: `${n} treads · rise ${fmt(rise, 2)} m` };
  },
  up() {
    if (!T.draft) return;
    const r = this.check();
    if (!r.ok) return refuse({ ...T.draft.b, z: hAt(T.draft.b.x, T.draft.b.y) + 1 }, `Refused · ${r.refuse}`);
    const st = r.st;
    plainCommit('Place a stair', (w) => { const { id, name } = nid(w, 'stair'); w.stairs.push({ ...st, id, name }); }, { intent: 'layout.stair.place', from: pt2(st.a), to: pt2(st.b), rise: r2(st.z1 - st.z0), width: st.width });
    finishCommit('Place a stair', []);
  },
};

/* Object: the shelf item at the pointer. Floor things back onto a nearby wall (placement only);
 * a drag lays an evenly spaced row. Wall things (frames) hang on a wall face; a drag along it hangs a row. */
function objectAim(ev, at0) {
  const item = opt('item', 'object'), def = OBJECTS[item], g = clampWS(at0 || ev.g);
  let x = g.x, y = g.y, r = T.objRot, backs = null;
  let best = null;
  if (!at0) for (const wl of world.walls) { const res = G.distPoly(g, wallPts(wl)); if (res.d < def.d / 2 + 0.7 && (!best || res.d < best.res.d)) best = { wl, res }; }
  if (best && best.wl.height > 0.9) {
    const pts = wallPts(best.wl), dir = G.norm(G.sub(pts[best.res.i + 1], pts[best.res.i])), n0 = G.left(dir);
    const side = G.dot(G.sub(g, best.res.p), n0) >= 0 ? 1 : -1, n = G.mul(n0, side), q = G.add(best.res.p, G.mul(n, best.wl.thick / 2 + def.d / 2 + 0.04));
    x = q.x; y = q.y; r = Math.atan2(-n.y, -n.x) - Math.PI / 2; backs = best.wl;
  }
  const o = { id: 'ghost', item, x, y, r };
  const at = { x, y, z: objBase(x, y) + 1.4 };
  const inB = footprintBlocked(world, { x, y }, 0.05);
  if (inB) return { o, at, refuse: `Inside ${inB.name}. Its interior isn’t open in this prototype` };
  if (!isNaN(waterAt(x, y))) return { o, at, refuse: 'That’s water' };
  const f = formAt(x, y);
  return { ok: true, o, at, backs, info: backs ? `Backs onto ${backs.name} · placement only` : f ? `On ${f.name}` : OBJ_LABEL[item] };
}
/* An evenly spaced row of floor things from where the drag began; each spot is checked on its own. */
function objectRow(d, to) {
  const def = OBJECTS[d.o.item], v = G.sub(to, d.start), L = G.len(v);
  const dir = L > 1e-6 ? G.mul(v, 1 / L) : { x: 1, y: 0 }, sp = def.w + 0.6, n = Math.floor(L / sp) + 1, r = Math.atan2(dir.y, dir.x) + T.objRot;
  const spots = [];
  for (let i = 0; i < n; i++) {
    const p = G.add(d.start, G.mul(dir, i * sp)), o = { id: 'ghost' + i, item: d.o.item, x: p.x, y: p.y, r };
    const a = objectAim(null, p);
    let why = a.ok ? null : a.refuse;
    if (!why) { const wl = world.walls.find((wl2) => G.distPoly(p, wallPts(wl2)).d < wl2.thick / 2 + def.d / 2); if (wl) why = `Crosses ${wl.name}`; }
    if (!why) { const hit = world.objects.find((o2) => G.dist(o2, p) < (Math.max(def.w, def.d) + Math.max(OBJECTS[o2.item].w, OBJECTS[o2.item].d)) * 0.42); if (hit) why = `${hit.name} is there`; }
    spots.push({ o, ok: !why, why });
  }
  return spots;
}
const plural = (n, word) => `${n} ${word.toLowerCase()}${n === 1 ? '' : word.endsWith('s') ? 'es' : 's'}`;
IMPL.object = {
  move(ev) {
    if (isWallItem(opt('item'))) return frameMove(ev);
    if (T.draft) {
      const d = T.draft, g = clampWS(ev.g);
      if (G.dist(g, d.start) < 0.6 && !d.row) { T.ghosts = [{ kind: 'object', obj: d.o, hl: 'ghost' }]; VIEW.dirty = true; return; }
      d.row = objectRow(d, g);
      const ok = d.row.filter((x) => x.ok).length, skip = d.row.length - ok;
      T.ghosts = d.row.map((x) => ({ kind: 'object', obj: x.o, hl: x.ok ? 'ghost' : 'refuse' }));
      setTag({ ...g, z: objBase(g.x, g.y) + 1.4 }, ok ? `${plural(ok, OBJ_LABEL[d.o.item])}${skip ? ` · skips ${skip}` : ''}` : 'Nothing fits along here', ok ? 'live' : 'refuse');
      setState(skip ? 'propose' : 'draft'); VIEW.dirty = true; return;
    }
    const a = objectAim(ev); T.aimRes = a;
    T.ghosts = [{ kind: 'object', obj: a.o, hl: a.ok ? 'ghost' : 'refuse' }];
    setTag(a.at, a.ok ? a.info : a.refuse, a.ok ? 'live' : 'refuse'); setState('aim'); VIEW.dirty = true;
  },
  down(ev) {
    if (isWallItem(opt('item'))) return frameDown(ev);
    const a = objectAim(ev);
    if (!a.ok) { refuse(a.at, `Refused · ${a.refuse}`); return true; }
    T.draft = { kind: 'object', o: { ...a.o }, at: a.at, backs: a.backs, start: clampWS(ev.g), row: null }; setState('draft'); return true;
  },
  up() {
    if (isWallItem(opt('item'))) return frameUp();
    const d = T.draft; if (!d) return;
    const word = OBJ_LABEL[d.o.item];
    if (d.row && d.row.length > 1) {
      const ok = d.row.filter((x) => x.ok), skipped = d.row.length - ok.length;
      if (!ok.length) return refuse(null, 'Refused · Nothing fits along there');
      const label = `Lay a row of ${plural(ok.length, word)}`;
      plainCommit(label, (w) => { for (const x of ok) { const { id, name } = nid(w, 'object', word); w.objects.push({ id, name, item: x.o.item, x: x.o.x, y: x.o.y, r: x.o.r }); } },
        { intent: 'scene.instance.placeRow', asset: d.o.item, from: pt2(ok[0].o), to: pt2(ok[ok.length - 1].o), count: ok.length, spacing: r2(OBJECTS[d.o.item].w + 0.6), skipped });
      T.ghosts = []; finishCommit(label, []); return;
    }
    const label = `Place ${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word.toLowerCase()}`;
    plainCommit(label, (w) => { const { id, name } = nid(w, 'object', word); w.objects.push({ id, name, item: d.o.item, x: d.o.x, y: d.o.y, r: d.o.r }); },
      { intent: 'scene.instance.place', asset: d.o.item, at: pt2(d.o), turn: Math.round(d.o.r * 180 / Math.PI), note: d.backs ? `placed against ${d.backs.id}; no attachment` : undefined });
    T.ghosts = []; finishCommit(label, []);
  },
};

/* Frames: the Object tool's wall item. Hang on a wall face; drag along it for an evenly spaced row. */
function artFrames(wl, side, s0, s1, size) {
  const [w] = ART_SIZES[size], L = wallLen(wl), gap = 0.6;
  const a = Math.min(s0, s1), b = Math.max(s0, s1);
  const n = Math.max(1, Math.floor((b - a) / (w + gap)) + 1);
  const out = [];
  for (let i = 0; i < n; i++) { const s = n === 1 ? s0 : a + ((b - a) * i) / (n - 1); out.push(clamp(s, w / 2 + 0.1, L - w / 2 - 0.1)); }
  return out;
}
function artBlocked(wl, side, s, size, line) {
  const [w, h] = ART_SIZES[size], L = wallLen(wl);
  if (s - w / 2 < 0.08 || s + w / 2 > L - 0.08) return 'Too close to the wall end';
  const o = world.openings.find((x) => x.hostId === wl.id && Math.abs(x.s - s) < (x.width + w) / 2 + 0.05 && x.sill < line + h / 2 && x.sill + x.height > line - h / 2);
  if (o) return `Overlaps ${o.name}`;
  const a = world.art.find((x) => x.wallId === wl.id && x.side === side && Math.abs(x.s - s) < (ART_SIZES[x.size][0] + w) / 2 + 0.05);
  if (a) return `Overlaps ${a.name}`;
  return null;
}
function frameMove(ev) {
  const size = opt('fsize'), line = +opt('line');
  T.ghosts = [];
  const hb = !T.draft && pickBuilding(ev.sx, ev.sy), hw = pickWall(ev.sx, ev.sy);
  if (hb && (!hw || hb.d < hw.d)) { T.artGhost = null; setTag(hb.p, `${hb.item.name}’s walls are generated. Hang frames on walls you drew`, 'refuse'); setState('aim'); VIEW.dirty = true; return; }
  if (T.draft) {
    const d = T.draft; let s1 = d.s0;
    if (hw && hw.id === d.wl.id && hw.side === d.side) s1 = hw.s;
    const all = artFrames(d.wl, d.side, d.s0, s1, size), ok = all.filter((s) => !artBlocked(d.wl, d.side, s, size, line));
    d.frames = ok; d.skipped = all.length - ok.length;
    T.artGhost = { wl: d.wl, side: d.side, frames: all.map((s) => ({ s, ok: ok.includes(s) })), size, line };
    setTag(wallUV(wallPts(d.wl), d.wl, s1, line + 1, d.side), ok.length > 1 ? `${ok.length} frames${d.skipped ? ` · skips ${d.skipped}` : ''}` : ok.length ? '1 frame' : 'Nothing fits here', ok.length ? 'live' : 'refuse');
    setState(d.skipped ? 'propose' : 'draft'); VIEW.dirty = true; return;
  }
  if (!hw) { T.artGhost = null; setTag(ev.g, 'Point at a wall face', 'live'); setState('idle'); VIEW.dirty = true; return; }
  const wl = hw.item, at = wallUV(wallPts(wl), wl, hw.s, line + 1, hw.side);
  if (wl.height < 2.2) { T.artGhost = { wl, side: hw.side, frames: [{ s: hw.s, ok: false }], size, line: Math.min(line, wl.height - 0.3) }; setTag(at, `${wl.name} is too low to hang a frame`, 'refuse'); setState('aim'); VIEW.dirty = true; return; }
  const blocked = artBlocked(wl, hw.side, hw.s, size, line);
  T.artGhost = { wl, side: hw.side, frames: [{ s: hw.s, ok: !blocked }], size, line };
  setTag(at, blocked || 'Click to hang · drag along for a row', blocked ? 'refuse' : 'live'); setState('aim'); VIEW.dirty = true;
}
function frameDown(ev) {
  const hw = pickWall(ev.sx, ev.sy); if (!hw) return true;
  if (hw.item.height < 2.2) { refuse(null, `Refused · ${hw.item.name} is too low to hang a frame`); return true; }
  T.draft = { kind: 'art', wl: hw.item, side: hw.side, s0: hw.s, frames: [hw.s] }; setState('draft'); frameMove(ev); return true;
}
function frameUp() {
  const d = T.draft; if (!d) return;
  const size = opt('fsize'), line = +opt('line'), frames = d.frames || [];
  T.artGhost = null;
  if (!frames.length) return refuse(null, 'Refused · Nothing fits there');
  const label = frames.length > 1 ? `Hang ${frames.length} frames` : 'Hang a frame';
  plainCommit(label, (w) => { for (const s of frames) { const { id, name } = nid(w, 'art'); w.art.push({ id, name, wallId: d.wl.id, side: d.side, s, size, line, hue: ART_HUES[(w.counters.id || 0) % ART_HUES.length] }); } },
    { intent: 'scene.instance.hang', asset: 'frame', wall: d.wl.id, face: d.side > 0 ? 'left' : 'right', at: frames.map(r2), size, hangLine: line, skipped: d.skipped || 0 });
  finishCommit(label, []);
}

/* Light: fixtures; and the sun on the sky arc (environment). */
function skyArc() {
  const cx = VIEW.w / 2, R = Math.min(VIEW.w * 0.3, 330), top = 70, ry = 44;
  const pos = (t) => { const a = Math.PI - ((t - 5) / 16) * Math.PI; return { x: cx + R * Math.cos(a), y: top + ry * (1 - Math.sin(a)) }; };
  const hourAt = (sx) => clamp(5 + (Math.acos(clamp((sx - cx) / R, -1, 1)) / Math.PI) * -16 + 16, 5, 21);
  return { cx, R, top, ry, pos, hourAt };
}
function onSkyArc(ev) {
  const sk = skyArc(), sp = sk.pos(world.sun);
  if (Math.hypot(ev.sx - sp.x, ev.sy - sp.y) < 18) return true;
  return Math.abs(ev.sx - sk.cx) <= sk.R + 6 && Math.abs(ev.sy - sk.pos(sk.hourAt(ev.sx)).y) < 12;
}
const hh = (t) => `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.round((t % 1) * 60 / 15) * 15 % 60).padStart(2, '0')}`;
function lightAim(ev) {
  const kind = opt('kind', 'light'), g = clampWS(ev.g);
  if (kind === 'wall') {
    const hw = pickWall(ev.sx, ev.sy); if (!hw) return { aim: 'Point at a wall' };
    const wl = hw.item, at = wallUV(wallPts(wl), wl, hw.s, 2.7, hw.side);
    if (wl.height < 2.4) return { refuse: `${wl.name} is too low for a wall light`, at };
    const l = { id: 'ghost', kind, wallId: wl.id, s: hw.s, side: hw.side, x: hw.p.x, y: hw.p.y };
    return { ok: true, l, at, info: `On ${wl.name}` };
  }
  const at = { ...g, z: objBase(g.x, g.y) + 2.6 };
  const inB = footprintBlocked(world, g, 0.05); if (inB) return { refuse: `Inside ${inB.name}`, at };
  if (!isNaN(waterAt(g.x, g.y))) return { refuse: 'That’s water', at };
  const room = world.rooms.find((r) => { const p = roomPoly(r); return p && G.inPoly(g, p); });
  if (kind === 'pendant' && !room) return { refuse: 'Nothing to hang from. Pendants go inside a room', at };
  const l = { id: 'ghost', kind, x: g.x, y: g.y, roomId: room ? room.id : null, r: 0 };
  const res = { ok: true, l, at, info: kind === 'pendant' ? `Hangs in ${room.name}` : TOOLS.light.palette[0].options.find((o) => o.v === kind).label };
  if (kind === 'spot') {
    let best = null;
    for (const a of world.art) {
      const c = artCentre(a), wl = world.walls.find((x) => x.id === a.wallId); if (!c || !wl) continue;
      const pts = wallPts(wl), n = G.mul(G.left(G.atLen(pts, a.s).dir), a.side), v = G.sub(g, c), d = G.len(v);
      if (d < 7 && d > 0.6 && G.dot(v, n) > 0.3 && (!best || d < best.d)) best = { a, d, c };
    }
    if (best) res.aimAt = best.a;
  }
  return res;
}
IMPL.light = {
  move(ev) {
    const a = lightAim(ev); T.ghosts = [];
    if (a.l) T.ghosts = [{ kind: 'light', obj: { ...a.l, aimAt: a.aimAt ? a.aimAt.id : null }, hl: a.ok ? 'ghost' : 'refuse' }];
    T.live = a.aimAt ? [{ id: 'aimlive', type: 'aim', at: artCentre(a.aimAt), options: ['once', 'keep', 'none'], choice: 'once', labels: { once: `Aim at ${a.aimAt.name} once`, keep: `Keep aimed at ${a.aimAt.name}`, none: 'Don’t aim' }, icon: 'aim', target: a.aimAt.id }] : [];
    if (a.ok) { setTag(a.at, a.info, 'live'); setState(T.live.length ? 'propose' : 'aim'); }
    else if (a.refuse) { setTag(a.at, a.refuse, 'refuse'); setState('aim'); }
    else { setTag(null); setState('idle'); }
    VIEW.dirty = true;
  },
  down(ev) {
    const a = lightAim(ev);
    if (!a.ok) { if (a.refuse) refuse(a.at, `Refused · ${a.refuse}`); return true; }
    const l = a.l, kind = l.kind, label = `Place a ${TOOLS.light.palette[0].options.find((o) => o.v === kind).label.split(' (')[0].toLowerCase()}`;
    const cons = a.aimAt ? [{ id: cid(), type: 'aim', at: artCentre(a.aimAt), options: ['once', 'keep', 'none'], choice: 'once', labels: { once: `Aimed at ${a.aimAt.name} once`, keep: `Keeps aiming at ${a.aimAt.name}`, none: 'Not aimed' }, icon: 'aim', target: a.aimAt.id }] : [];
    commitAmendable(label, cons, (w, cs) => {
      const { id, name } = nid(w, 'light', kind === 'spot' ? 'Spot' : kind === 'pendant' ? 'Pendant' : kind === 'lamp' ? 'Lamp' : 'Wall light');
      const nl = { ...l, id, name };
      const ac = cs.find((c) => c.type === 'aim');
      if (ac && ac.choice === 'keep') nl.aimAt = ac.target;
      else if (ac && ac.choice === 'once') { const art = w.art.find((x) => x.id === ac.target); const wl = art && w.walls.find((x) => x.id === art.wallId); if (wl) nl.aimPoint = wallUV(wallPts(wl), wl, art.s, art.line, art.side, 0.05); }
      w.lights.push(nl); return nl;
    }, (cs) => ({ intent: 'scene.light.place', kind, at: pt2(l), wall: l.wallId, room: l.roomId || undefined, consequences: consIntent(cs) }));
    finishCommit(label, []);
    return true;
  },
};
/* The sun: dragged on the sky arc while the Sky is open, whatever tool is armed. One undo step. */
function setHour(t, label) {
  liveBegin(); world.sun = clamp(t, 5, 21);
  liveEnd(label || `Set the hour to ${hh(world.sun)}`, { intent: 'scene.environment.setHour', hour: r2(world.sun) });
  T.lastIntent = HIST.undo[HIST.undo.length - 1].intent; VIEW.dirty = true; uiSync();
}

/* Brush tools: Ground, Water (pond), Plants, Paint on the ground, Erase scrub. */
function brushRadius(tool = T.tool) { return BRUSH_R[opt('size', tool)] || 3; }
const SPACING = { tree: 2.4, shrub: 1.3, flower: 0.5, grass: 0.6 };
let RNG = Math.random;
function brushTick() {
  const st = T.brush; if (!st || !T.pointer) return;
  const g = clampWS(T.pointer.g), R = brushRadius(), e = T.pointer.e || {};
  st.frames++;
  if (T.tool === 'water') {
    const kept = paintWater(world, g, R * 0.75, st.surface, opt('depth') === 'deep' ? 1.2 : 0.5);
    if (kept) st.kept.add(kept.name);
    const before = world.plants.length; world.plants = world.plants.filter((p) => isNaN(waterAt(p.x, p.y))); st.count += before - world.plants.length;
  } else if (T.tool === 'ground') {
    let mode = opt('brush'); if (e.shiftKey && mode === 'raise') mode = 'lower'; else if (e.shiftKey && mode === 'lower') mode = 'raise';
    brushTerrain(world, mode, g, R, 0.045, st.ref);
    st.touched.push(g);
  } else if (T.tool === 'plants') {
    if (e.shiftKey) { const before = world.plants.length; world.plants = world.plants.filter((p) => G.dist(p, g) > R); st.cleared += before - world.plants.length; }
    else if (st.frames % 3 === 0) {
      const kind = opt('kind'), sp = SPACING[kind] * (opt('density') === 'full' ? 0.65 : 1), tries = opt('density') === 'full' ? 7 : 3;
      for (let k = 0; k < tries; k++) {
        const a = RNG() * Math.PI * 2, r = Math.sqrt(RNG()) * R, p = { x: g.x + Math.cos(a) * r, y: g.y + Math.sin(a) * r };
        if (!plantAllowed(world, p)) continue;
        if (world.plants.some((q) => G.dist(q, p) < (q.kind === kind ? sp : Math.min(sp, SPACING[q.kind]) * 0.8))) continue;
        world.plants.push({ x: p.x, y: p.y, kind, s: kind === 'tree' ? 0.8 + RNG() * 0.45 : 0.75 + RNG() * 0.5, v: RNG() }); st.count++;
      }
    }
  } else if (T.tool === 'paint') {
    const mat = e.shiftKey ? null : opt('material');
    for (let j = 0; j < TER.N; j++) for (let i = 0; i < TER.N; i++) { const x = i - TER.HALF + 0.5, y = j - TER.HALF + 0.5; if (Math.hypot(x - g.x, y - g.y) <= R) world.terrain.paint[cIdx(i, j)] = mat; }
  } else if (T.tool === 'erase') {
    const before = world.plants.length; world.plants = world.plants.filter((p) => G.dist(p, g) > 1.2); st.count += before - world.plants.length;
  }
  VIEW.dirty = true;
}
function brushBegin(ev, extra = {}) {
  liveBegin();
  T.brush = { frames: 0, ref: hAt(ev.g.x, ev.g.y), surface: hAt(ev.g.x, ev.g.y) - 0.1, kept: new Set(), count: 0, cleared: 0, touched: [], start: { x: ev.sx, y: ev.sy }, ...extra };
  T.draft = { kind: 'brush', live: true }; setState('draft');
  brushTick();
}
function brushEnd() {
  const st = T.brush; T.brush = null; if (!st) return;
  const tool = T.tool, pond = tool === 'water'; let label = 'Brush', intent = {}, infos = [];
  if (pond) {
    label = 'Paint a pond'; intent = { intent: 'landscape.water.paint', surface: r2(st.surface), depth: opt('depth') };
    for (const n of st.kept) infos.push({ id: cid(), info: true, at: T.pointer.g, icon: 'keep', label: `Keeps clear of ${n}` });
    if (st.count) infos.push({ id: cid(), info: true, at: T.pointer.g, icon: 'plants', label: `Drowned ${st.count} plant${st.count > 1 ? 's' : ''}` });
  } else if (tool === 'ground') {
    let mode = opt('brush'); const shift = T.pointer && T.pointer.e && T.pointer.e.shiftKey; if (shift && mode === 'raise') mode = 'lower'; else if (shift && mode === 'lower') mode = 'raise';
    label = `${mode[0].toUpperCase() + mode.slice(1)} the ground`;
    intent = { intent: 'landscape.ground.brush', mode, radius: brushRadius(), stroke: G.resample(st.touched, 1).slice(0, 40).map(pt2) };
    const R = brushRadius();
    for (const b of world.buildings) { const f = footOf(b); if (st.touched.some((p) => G.distPoly(p, f.concat([f[0]])).d < R || G.inPoly(p, f))) { const g = groundRange(f); const c = G.centroid(f); infos.push({ id: cid(), info: true, at: { ...c, z: b.base + 0.4 }, icon: 'datum', label: `${b.name} keeps its datum${b.base - g.lo > 0.05 ? ` · plinth ${fmt(b.base - g.lo, 1)} m` : ''}` }); } }
    for (const pa of world.paths) if (st.touched.some((p) => G.distPoly(p, pa.pts).d < R)) { const m = G.atLen(pa.pts, G.polyLen(pa.pts) / 2).p; infos.push({ id: cid(), info: true, at: m, icon: 'path', label: `${pa.name} re-drapes` }); }
    for (const wl of world.walls) if (st.touched.some((p) => G.distPoly(p, wallPts(wl)).d < R)) { infos.push({ id: cid(), info: true, at: { ...G.mid(wl.a, wl.b), z: wallBase(wl) + wl.height + 0.5 }, icon: 'datum', label: `${wl.name} keeps its datum` }); break; }
  } else if (tool === 'plants') {
    if (st.cleared) { label = `Clear ${st.cleared} plant${st.cleared > 1 ? 's' : ''}`; intent = { intent: 'landscape.plants.remove', count: st.cleared }; }
    else {
      if (!st.count && Math.hypot(T.pointer.sx - st.start.x, T.pointer.sy - st.start.y) < 4 && st.frames < 12) {
        const p = clampWS(T.pointer.g), kind = opt('kind');
        if (plantAllowed(world, p)) { world.plants.push({ x: p.x, y: p.y, kind, s: 1, v: RNG() }); st.count = 1; }
      }
      const kn = opt('kind'), nm = { tree: 'tree', shrub: 'shrub', flower: 'flower clump', grass: 'grass tuft' }[kn];
      label = st.count === 1 ? `Plant a ${nm}` : `Scatter ${st.count} ${nm}s`; intent = { intent: 'landscape.plants.scatter', kind: kn, density: opt('density'), count: st.count, rule: 'skips paths, water, buildings, rooms (applied once)' };
    }
    if (!st.count && !st.cleared) { liveCancel(); T.draft = null; setTag(null); setState('refuse'); setTag(T.pointer.g, 'Nothing to plant here: paths, water and buildings are skipped', 'refuse'); VIEW.dirty = true; return; }
  } else if (tool === 'paint') {
    label = `Paint the ground ${MATERIALS[opt('material')].label.toLowerCase()}`; intent = { intent: 'scene.material.assign', target: 'ground', material: opt('material') };
  } else if (tool === 'erase') {
    if (!st.count) { liveCancel(); T.draft = null; setState('idle'); return; }
    label = `Erase ${st.count} plant${st.count > 1 ? 's' : ''}`; intent = { intent: 'landscape.plants.remove', count: st.count };
  }
  liveEnd(label, intent); T.lastIntent = intent;
  T.draft = null;
  T.amend = infos.length ? { cons: infos, label, redo() {} } : null;
  // water may now cross paths: propose bridges, amended in place inside the same step
  if (pond) proposeBridges();
  setState('commit'); VIEW.dirty = true; uiSync();
}
function proposeBridges() {
  const cons = T.amend ? T.amend.cons : [];
  for (const pa of world.paths) {
    const S = G.resample(pa.pts, 0.5); let run = null; const runs = [];
    S.forEach((p, i) => { const wet = !isNaN(waterAt(p.x, p.y)); if (wet && !run) run = { i0: i, i1: i }; else if (wet) run.i1 = i; else if (run) { runs.push(run); run = null; } });
    if (run) runs.push(run);
    for (const r of runs) {
      const m = G.mid(S[r.i0], S[r.i1]);
      if ((pa.crossings || []).some((c) => G.dist(G.mid(c.a, c.b), m) < 1.5)) continue;
      const cr = { a: S[Math.max(0, r.i0 - 1)], b: S[Math.min(S.length - 1, r.i1 + 1)], mode: 'bridge' };
      pa.crossings.push(cr);
      cons.push({ id: cid(), type: 'water', at: m, options: ['bridge', 'stones', 'none'], choice: 'bridge', labels: { bridge: `Bridge for ${pa.name}`, stones: 'Stepping stones', none: 'Wade through' }, icon: 'bridge', apply(c) { cr.mode = c.choice; } });
    }
  }
  if (cons.length) T.amend = { cons, label: 'Paint a pond', redo() { for (const c of cons) if (c.apply) c.apply(c); VIEW.dirty = true; uiSync(); } };
}

IMPL.ground = {
  begin() { return newShape('free'); },
  move(ev) {
    const mode = opt('brush');
    if (mode === 'terrace') return terraceMove(ev);
    const name = TOOLS.ground.palette[0].options.find((o) => o.v === mode).label.split(/ \(|:/)[0];
    const text = `${name} · ${brushRadius()} m`;
    setTag(T.brush ? null : ev.g, T.brush ? null : text, 'live'); setState(T.brush ? 'draft' : 'aim'); VIEW.dirty = true;
  },
  down(ev) { if (opt('brush') === 'terrace') return terraceDown(ev); brushBegin(ev); return true; },
  up(ev) { if (opt('brush') === 'terrace') return terraceUp(ev); brushEnd(); },
};
/* Water: Pond paints a level surface into lowered ground; Stream is a drawn stroke. */
IMPL.water = {
  begin() { return newShape('free'); },
  move(ev) {
    if (opt('mode') === 'stream') { setTag(null); return; }
    setTag(T.brush ? null : ev.g, T.brush ? null : `Pond · ${fmt(brushRadius() * 0.75, 1)} m`, 'live'); setState(T.brush ? 'draft' : 'aim'); VIEW.dirty = true;
  },
  down(ev) { brushBegin(ev); return true; },
  up() { brushEnd(); },
  /* Stream: a drawn stroke becomes lowered ground with a surface. */
  finishStream(gm) {
    const pts = G.resample(gm.pts, 0.5), R = brushRadius() * 0.45, depth = opt('depth') === 'deep' ? 1.2 : 0.5;
    const surf = pts.map((p) => hAt(p.x, p.y) - 0.08);
    liveBegin(); T.brush = null;
    const kept = new Set(); let drowned = 0;
    pts.forEach((p, i) => { const k = paintWater(world, p, R, surf[i], depth); if (k) kept.add(k.name); });
    const before = world.plants.length; world.plants = world.plants.filter((p) => isNaN(waterAt(p.x, p.y))); drowned = before - world.plants.length;
    const intent = { intent: 'landscape.water.stream', points: G.resample(pts, 1).map(pt2), depth: opt('depth') };
    liveEnd('Draw a stream', intent); T.lastIntent = intent;
    T.amend = { cons: [...kept].map((n) => ({ id: cid(), info: true, at: pts[pts.length >> 1], icon: 'keep', label: `Keeps clear of ${n}` })).concat(drowned ? [{ id: cid(), info: true, at: pts[0], icon: 'plants', label: `Drowned ${drowned} plants` }] : []), label: 'Draw a stream', redo() {} };
    proposeBridges();
    finishCommit('Draw a stream', []);
  },
};
function terraceMove(ev) {
  const d = T.draft;
  if (!d) { setTag(ev.g, 'Drag a terrace shape', 'live'); setState('aim'); VIEW.dirty = true; return; }
  if (d.phase === 'shape') { d.b = snapPoint(ev.g, ev.e).p; d.pts = boxPts(d.a, d.b); setTag({ ...d.b, z: hAt(d.b.x, d.b.y) }, `${fmt(Math.abs(d.a.x - d.b.x), 1)} × ${fmt(Math.abs(d.a.y - d.b.y), 1)} m`, 'live'); }
  else { d.h = Math.round((d.h0 + (d.sy - ev.sy) / (CAM.scale * Math.max(0.35, _ce))) * 4) / 4; const c = G.centroid(d.pts); const blk = world.buildings.find((b) => d.pts.some((p) => G.inPoly(p, footOf(b))) || footOf(b).some((p) => G.inPoly(p, d.pts))); d.refused = blk ? `${blk.name} stands here` : null; setTag({ ...c, z: d.h + 0.6 }, d.refused || `${d.h >= d.g0 ? '+' : ''}${fmt(d.h - d.g0, 2)} m · click to set`, d.refused ? 'refuse' : 'live'); }
  VIEW.dirty = true;
}
function terraceDown(ev) {
  const d = T.draft;
  if (!d) { const a = snapPoint(ev.g, ev.e).p; T.draft = { kind: 'terrace', phase: 'shape', a, b: a, pts: boxPts(a, a) }; setState('draft'); return true; }
  if (d.phase === 'pull') {
    if (d.refused) { refuse(null, `Refused · ${d.refused}`); return true; }
    const pts = d.pts, h = d.h, label = `Raise a terrace to ${fmt(h, 2)} m`;
    plainCommit(label, (w) => terraceTerrain(w, pts, h), { intent: 'landscape.ground.terrace', outline: pts.map(pt2), height: r2(h) });
    finishCommit(label, []);
  }
  return true;
}
function terraceUp(ev) {
  const d = T.draft; if (!d || d.phase !== 'shape') return;
  if (Math.abs(d.a.x - d.b.x) < 1 || Math.abs(d.a.y - d.b.y) < 1) { cancelDraft(); return; }
  const g = groundRange(d.pts); d.phase = 'pull'; d.sy = ev.sy; d.h0 = g.hi + 0.5; d.h = d.h0; d.g0 = g.lo; setState('propose');
  terraceMove(ev);
}

IMPL.plants = {
  move(ev) { const k = TOOLS.plants.palette[0].options.find((o) => o.v === opt('kind')).label; setTag(T.brush ? null : ev.g, T.brush ? null : `${k} · ${brushRadius()} m${ev.e.shiftKey ? ' · clear' : ''}`, 'live'); setState(T.brush ? 'draft' : 'aim'); VIEW.dirty = true; },
  down(ev) { brushBegin(ev); return true; },
  up() { brushEnd(); },
};

/* Paint: surfaces by reach; the ground as a brush; Alt samples. */
function insideSide(wl, room) {
  const poly = roomPoly(room); if (!poly) return 0;
  const pts = wallPts(wl), m = G.atLen(pts, G.polyLen(pts) / 2), n = G.left(m.dir);
  return G.inPoly(G.add(m.p, G.mul(n, 0.3)), poly) ? 0 : 1;
}
function paintAim(ev) {
  const hit = pickAny(ev.sx, ev.sy), scope = opt('scope'), mat = opt('material');
  if (!hit || hit.kind === 'path') return { ground: true };
  const t = [], name = hit.item.name;
  if (hit.kind === 'wall') {
    const wl = hit.item, sub = hit.side > 0 ? 0 : 1, cur = wl.mat[sub];
    if (scope === 'face') t.push({ id: wl.id, part: 'face', sub });
    else if (scope === 'wall') t.push({ id: wl.id, part: 'face' });
    else if (scope === 'room') { const rs = roomsOfWall(wl.id); if (!rs.length) t.push({ id: wl.id, part: 'face' }); for (const r of rs.slice(0, 1)) for (const id of r.wallIds) { const w2 = world.walls.find((x) => x.id === id); if (w2) t.push({ id, part: 'face', sub: insideSide(w2, r) }); } }
    else { for (const w2 of world.walls) w2.mat.forEach((m, i) => { if (m === cur) t.push({ id: w2.id, part: 'face', sub: i }); }); for (const b of world.buildings) if (b.mat === cur) t.push({ id: b.id, part: 'face' }); }
    const scopeName = { face: `this face of ${name}`, wall: name, room: roomsOfWall(wl.id)[0] ? `inside ${roomsOfWall(wl.id)[0].name}` : name, all: `everything in ${MATERIALS[cur].label.toLowerCase()}` }[scope];
    return { hit, t, cur, label: `Paint ${scopeName} ${MATERIALS[mat].label.toLowerCase()}`, n: t.length };
  }
  if (hit.kind === 'building' && hit.part === 'face') {
    const b = hit.item, cur = b.overrides[hit.edge] || b.mat;
    if (scope === 'face') t.push({ id: b.id, part: 'face', sub: hit.edge });
    else if (scope === 'all') { for (const b2 of world.buildings) if (b2.mat === cur) t.push({ id: b2.id, part: 'face' }); for (const w2 of world.walls) w2.mat.forEach((m, i) => { if (m === cur) t.push({ id: w2.id, part: 'face', sub: i }); }); }
    else t.push({ id: b.id, part: 'face' });
    const twins = world.buildings.filter((x) => x.style === b.style && x.id !== b.id);
    const ask = scope !== 'face' && scope !== 'all' && twins.length ? { id: cid(), type: 'style', at: { ...hit.p, z: b.base + bHeight(b) + 1 }, options: ['this', 'style'], choice: 'this', labels: { this: `Only ${b.name}`, style: `Every ${b.style} (${twins.length + 1})` }, icon: 'key', twins: twins.map((x) => x.id) } : null;
    return { hit, t, cur, ask, label: `Paint ${scope === 'face' ? `one face of ${name}` : scope === 'all' ? `everything in ${MATERIALS[cur].label.toLowerCase()}` : name} ${MATERIALS[mat].label.toLowerCase()}` };
  }
  if ((hit.kind === 'building' && hit.part === 'roof') || hit.kind === 'roof') {
    const cur = hit.kind === 'roof' ? hit.item.mat || 'slate' : hit.item.roofMat;
    if (scope === 'all') { for (const b of world.buildings) if (b.roofMat === cur) t.push({ id: b.id, part: 'roof' }); for (const r of world.roofs) if ((r.mat || 'slate') === cur) t.push({ id: r.id, part: 'roof' }); }
    else t.push({ id: hit.id, part: 'roof' });
    return { hit, t, cur, roof: true, label: `Paint the roof of ${hit.kind === 'roof' ? nameOf(hit.item.roomId) : name} ${MATERIALS[mat].label.toLowerCase()}` };
  }
  if (hit.kind === 'form') {
    const f = hit.item, cur = f.mat, stack = [f, ...formsAbove(world, f.id)];
    if (scope === 'all') for (const f2 of world.forms) { if (f2.mat === cur) t.push({ id: f2.id, part: 'face' }); }
    else if (scope === 'room') for (const f2 of stack) t.push({ id: f2.id, part: 'face' });
    else t.push({ id: f.id, part: 'face' });
    const what = scope === 'all' ? `every form in ${MATERIALS[cur].label.toLowerCase()}` : scope === 'room' && stack.length > 1 ? `${name} and what stands on it` : name;
    return { hit, t, cur, label: `Paint ${what} ${MATERIALS[mat].label.toLowerCase()}` };
  }
  if (hit.kind === 'room') { t.push({ id: hit.id, part: 'floor' }); return { hit, t, cur: hit.item.floor, label: `Paint the floor of ${name} ${MATERIALS[mat].label.toLowerCase()}` }; }
  return { ground: true };
}
function applyPaint(w, t, mat, ask) {
  for (const x of t) {
    const r = byId(w, x.id); if (!r) continue; const it = r.item;
    if (r.kind === 'walls') { if (x.sub == null) it.mat = [mat, mat]; else it.mat[x.sub] = mat; }
    else if (r.kind === 'buildings') {
      if (x.part === 'roof') it.roofMat = mat;
      else if (x.sub != null) it.overrides[x.sub] = mat;
      else { it.mat = mat; it.overrides = {}; if (ask && ask.choice === 'style') for (const id of ask.twins) { const b2 = w.buildings.find((b) => b.id === id); if (b2) { b2.mat = mat; b2.overrides = {}; } } }
    } else if (r.kind === 'roofs') it.mat = mat;
    else if (r.kind === 'rooms') it.floor = mat;
    else if (r.kind === 'forms') it.mat = mat;
  }
}
IMPL.paint = {
  move(ev) {
    if (T.brush) { setTag(null); return; }
    const a = paintAim(ev); T.aimRes = a;
    if (a.ground) { HL.paint = null; HL.hover = null; setTag(ev.g, `Ground · ${MATERIALS[opt('material')].label}${ev.e.shiftKey ? ' · unpaint' : ''}`, 'live'); setState('aim'); VIEW.dirty = true; return; }
    if (ev.e.altKey) { HL.paint = null; HL.hover = a.hit.id; HL.hoverMode = 'inspect'; setTag(a.hit.p, `Sample ${a.cur ? MATERIALS[a.cur].label : 'default'}`, 'live'); VIEW.dirty = true; return; }
    HL.hover = null; HL.paint = { mat: opt('material'), t: a.t };
    T.live = a.ask ? [a.ask] : [];
    setTag(a.hit.p, a.label + (a.t.length > 2 ? ` · ${a.t.length} surfaces` : ''), 'live'); setState(a.ask ? 'propose' : 'aim'); VIEW.dirty = true;
  },
  down(ev) {
    const a = paintAim(ev);
    if (a.ground) { brushBegin(ev); return true; }
    if (ev.e.altKey) { if (a.cur) { setOpt('material', a.cur); toast(`Sampled ${MATERIALS[a.cur].label}`); } return true; }
    const mat = opt('material'), t = a.t, cons = a.ask ? [{ ...a.ask }] : [];
    commitAmendable(a.label, cons, (w, cs) => applyPaint(w, t, mat, cs.find((c) => c.type === 'style')),
      (cs) => ({ intent: 'scene.material.assign', material: mat, targets: t.map((x) => ({ id: x.id, part: x.part, face: x.sub })), consequences: consIntent(cs) }));
    HL.paint = null; finishCommit(a.label, []);
    return true;
  },
  up() { if (T.brush) brushEnd(); },
};

IMPL.erase = {
  move(ev) {
    if (T.brush) { setTag(null); VIEW.dirty = true; return; }
    const hit = pickAny(ev.sx, ev.sy);
    HL.extra.clear();
    if (!hit) {
      const near = world.plants.filter((p) => G.dist(p, ev.g) < 1.2);
      HL.hover = null; near.forEach((p) => HL.extra.set(p, 'erase'));
      setTag(near.length ? ev.g : null, near.length ? `Hold to clear plants (${near.length})` : null, 'live'); setState(near.length ? 'aim' : 'idle'); VIEW.dirty = true; return;
    }
    const sm = eraseSummary(hit);
    HL.hover = hit.id; HL.hoverMode = sm.refuse ? 'inspect' : 'erase';
    if (sm.refuse) { setTag(hit.p, sm.refuse, 'refuse'); setState('aim'); VIEW.dirty = true; return; }
    for (const id of sm.ids) HL.extra.set(id, 'erase');
    const sub = [...sm.goes.map((n) => `${n} goes with it`), ...sm.stays];
    setTag(hit.p, `Erase ${hit.item.name}`, 'erase', sub.length ? sub : null); setState('aim'); VIEW.dirty = true;
  },
  down(ev) {
    const hit = pickAny(ev.sx, ev.sy);
    if (!hit) { brushBegin(ev); return true; }
    const sm = eraseSummary(hit);
    if (sm.refuse) { refuse(hit.p, `Refused · ${sm.refuse}`); return true; }
    const label = `Erase ${hit.item.name}`;
    plainCommit(label, (w) => removeThing(w, hit.kind, hit.id), { intent: `${OWNER_OF[hit.kind]}.remove`, id: hit.id, with: sm.ids, keeps: sm.stays });
    if (T.sel === hit.id) selectId(null);
    HL.extra.clear(); HL.hover = null; finishCommit(label, []);
    return true;
  },
  up() { if (T.brush) brushEnd(); },
};

IMPL.measure = {
  down(ev) { T.measure = { a: ev.g, b: ev.g }; T.draft = { kind: 'measure' }; setState('draft'); return true; },
  move(ev) { if (T.draft && T.measure) { T.measure.b = ev.g; const d = Math.hypot(T.measure.a.x - ev.g.x, T.measure.a.y - ev.g.y, T.measure.a.z - ev.g.z); setTag({ ...ev.g, z: ev.g.z + 0.4 }, `${fmt(d, 2)} m${Math.abs(T.measure.a.z - ev.g.z) > 0.05 ? ` · Δh ${fmt(ev.g.z - T.measure.a.z, 2)} m` : ''}`, 'inspect'); VIEW.dirty = true; } else { setState('aim'); } },
  up() { T.draft = null; setState('idle'); },
};

// ── draft lifecycle for the drawing tools ─────────────────────────────────────
let planCache = { key: '', plan: null };
function drawingUpdate(ev) {
  const impl = IMPL[T.tool], d = T.draft;
  if (!d) return;
  const gm = shapeGeom(d, false, ev.e);
  T.ghosts = []; T.groundGhost = null; T.live = [];
  if (!impl.plan) { if (gm) setTag({ ...gm.pts[gm.pts.length - 1], z: hAt(gm.pts[gm.pts.length - 1].x, gm.pts[gm.pts.length - 1].y) + 0.4 }, `Stream · ${fmt(G.polyLen(gm.pts), 1)} m`, 'live'); setState('draft'); return; }
  if (!gm || (FOOTPRINT.has(T.tool) && !gm.closed && d.shape !== 'outline')) { setTag(null); return; }
  if (FOOTPRINT.has(T.tool) && d.shape === 'outline' && gm.pts.length < 3) { setTag(null); return; }
  const gmc = FOOTPRINT.has(T.tool) && d.shape === 'outline' ? { ...gm, closed: true } : gm;
  const key = JSON.stringify(gmc.pts) + gmc.bulges.join(',') + gmc.closed + T.tool + JSON.stringify(T.opts[T.tool] || {});
  if (key !== planCache.key) planCache = { key, plan: impl.plan(gmc) };
  const plan = planCache.plan;
  impl.preview(gmc, plan);
  T.live = (plan.cons || []).slice();
  const last = gm.pts[gm.pts.length - 1], cur = d.cursor || last;
  const text = impl.tag(gmc, d);
  const refusedTxt = plan.refused ? (typeof plan.refused === 'string' ? plan.refused : plan.refused.length ? plan.refused[0].reason : null) : null;
  setTag(cur ? { ...cur, z: hAt(cur.x, cur.y) + 0.4 } : null, refusedTxt ? `Refused · ${refusedTxt}` : text, refusedTxt ? 'refuse' : 'live');
  setState(T.live.some((c) => !c.info) || refusedTxt ? 'propose' : 'draft');
}
function drawingFinish(e) {
  const d = T.draft, impl = IMPL[T.tool];
  const gm = shapeGeom(d, true, e);
  if (!gm) return cancelDraft();
  if (T.tool === 'water') return IMPL.water.finishStream(gm);
  impl.finish(gm);
}

// ── input ─────────────────────────────────────────────────────────────────────
function evAt(e) { const r = VIEW.cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; return { sx, sy, g: pickGround(sx, sy), e }; }
let CAMDRAG = null;
function bindStage(cv) {
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); escLadder(true); });
  cv.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return;
    cv.setPointerCapture(e.pointerId);
    const ev = evAt(e); T.pointer = ev; T.pressed = true;
    if (e.button === 1 || T.space || (e.shiftKey && T.tool === 'select')) { CAMDRAG = { x: e.clientX, y: e.clientY, pan: e.shiftKey || VIEW.plan }; return; }
    if (typeof UI !== 'undefined' && UI.sky && !T.draft && onSkyArc(ev)) { T.sunDrag = true; liveBegin(); world.sun = skyArc().hourAt(ev.sx); VIEW.dirty = true; uiSync(); return; }
    if (T.amend && !T.draft) { T.amend = null; uiSync(); }
    if (T.state === 'refuse' || T.state === 'commit' || T.state === 'cancel') setTag(null);
    const tool = T.tool, impl = IMPL[tool];
    if (shapeInput()) {
      if (!T.draft) T.draft = impl.begin ? impl.begin() : newShape('free');
      if (isStream()) T.draft.shape = 'free';
      const raw = clampWS(ev.g), sp = T.draft.shape === 'free' ? { p: raw, kind: 'free' } : snapPoint(ev.g, e);
      T.draft.snap = sp.kind; T.draft.cursor = sp.p;
      const r = shapeDown(T.draft, sp.p);
      setState('draft');
      if (r === 'finish') drawingFinish(e); else drawingUpdate(ev);
      VIEW.dirty = true; return;
    }
    const handled = impl && impl.down ? impl.down(ev) : false;
    if (!handled) CAMDRAG = { x: e.clientX, y: e.clientY, pan: VIEW.plan };
    VIEW.dirty = true;
  });
  cv.addEventListener('pointermove', (e) => {
    const ev = evAt(e); T.pointer = ev;
    if (CAMDRAG) {
      const dx = e.clientX - CAMDRAG.x, dy = e.clientY - CAMDRAG.y; CAMDRAG.x = e.clientX; CAMDRAG.y = e.clientY;
      if (CAMDRAG.pan) { const rx = -dx / CAM.scale, ry = dy / (CAM.scale * Math.max(0.3, _se)); const wx = rx * _ca + ry * _sa, wy = -rx * _sa + ry * _ca; CAM.tx = CAM_T.tx = clamp(CAM.tx + wx, -22, 22); CAM.ty = CAM_T.ty = clamp(CAM.ty + wy, -22, 22); }
      else { CAM.az = CAM_T.az = CAM.az - dx * 0.007; if (!VIEW.plan) CAM.el = CAM_T.el = clamp(CAM.el + dy * 0.005, 0.32, 1.5); }
      VIEW.dirty = true; return;
    }
    if (T.sunDrag) { world.sun = skyArc().hourAt(ev.sx); VIEW.dirty = true; uiSync(); return; }
    const skyHover = typeof UI !== 'undefined' && UI.sky && !T.draft && onSkyArc(ev);
    if (skyHover !== !!T.sunHover) { T.sunHover = skyHover; VIEW.cv.style.cursor = skyHover ? 'grab' : T.tool === 'select' ? 'default' : 'crosshair'; VIEW.dirty = true; }
    if (skyHover) return;
    const tool = T.tool, impl = IMPL[tool];
    if (shapeInput()) {
      const raw = clampWS(ev.g);
      const sp = (T.draft ? T.draft.shape : opt('shape')) === 'free' || isStream() ? { p: raw, kind: 'free' } : snapPoint(ev.g, e, T.draft ? T.draft.pts.slice(0, 1) : []);
      T.cursor = sp;
      if (T.draft) { T.draft.snap = sp.kind; shapeMove(T.draft, sp.p, raw); drawingUpdate(ev); }
      else { setTag(null); setState('aim'); }
      VIEW.dirty = true; return;
    }
    if (impl && impl.move) impl.move(ev);
    VIEW.dirty = true;
  });
  const end = (e) => {
    if (!T.pressed) return;
    T.pressed = false;
    if (CAMDRAG) { CAMDRAG = null; return; }
    const ev = evAt(e); T.pointer = ev;
    if (T.sunDrag) {
      T.sunDrag = false;
      liveEnd(`Set the hour to ${hh(world.sun)}`, { intent: 'scene.environment.setHour', hour: r2(world.sun) });
      T.lastIntent = HIST.undo[HIST.undo.length - 1].intent; uiSync(); VIEW.dirty = true; return;
    }
    const tool = T.tool, impl = IMPL[tool];
    if (T.draft && shapeInput()) {
      const sp = T.draft.shape === 'free' ? { p: clampWS(ev.g) } : snapPoint(ev.g, e);
      const r = shapeUp(T.draft, sp.p, e);
      if (r === 'finish') drawingFinish(e);
      else if (r === 'tiny') { T.draft = null; T.ghosts = []; T.live = []; setTag(ev.g, SHAPES[opt('shape')] ? SHAPES[opt('shape')].hint : 'Drag a stroke', 'live'); setState('cancel'); }
      VIEW.dirty = true; return;
    }
    if (impl && impl.up) impl.up(ev);
    VIEW.dirty = true;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { if (!T.pressed) { HL.hover = null; HL.paint = null; if (!T.draft) { T.ghosts = []; T.artGhost = null; setTag(null); if (T.state === 'aim') setState('idle'); } VIEW.dirty = true; } });
  cv.addEventListener('dblclick', (e) => {
    const d = T.draft; if (!d || d.kind) return;
    if (d.shape === 'line' || d.shape === 'outline') { if (d.shape === 'outline') d.closed = d.pts.length >= 3; drawingFinish(e); }
    else if (d.shape === 'arc') { if (d.phase === 'bend') { d.bulges[d.bulges.length - 1] = 0; d.phase = 'end'; } drawingFinish(e); }
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * 0.0016);
    CAM.scale = CAM_T.scale = clamp(CAM.scale * k, 8, 70); VIEW.dirty = true;
  }, { passive: false });
}

/* Esc ladder: draft → amend tokens → palette → Select. */
function escLadder(fromRightClick) {
  if (T.brush) { liveCancel(); T.brush = null; T.draft = null; setState('cancel'); VIEW.dirty = true; return 'draft'; }
  if (T.drag) { if (LIVE) liveCancel(); T.drag = null; setState('cancel'); VIEW.dirty = true; return 'draft'; }
  if (T.measure) { T.measure = null; T.draft = null; setTag(null); setState('cancel'); VIEW.dirty = true; return 'draft'; }
  if (T.draft) { cancelDraft(); return 'draft'; }
  if (fromRightClick) return null;
  if (typeof UI !== 'undefined' && (UI.lib || UI.sky)) { UI.lib = null; UI.sky = false; uiSync(); return 'library'; }
  if (T.amend) { T.amend = null; VIEW.dirty = true; uiSync(); return 'tokens'; }
  if (T.sel) { selectId(null); return 'selection'; }
  if (T.tool !== 'select') { armTool('select'); return 'tool'; }
  return null;
}
function armTool(id) {
  if (TOOLS[id].disabled) { toast(`${TOOLS[id].name} is unchanged from the approved sheet and not prototyped here`); return; }
  if (T.draft) cancelDraft(true);
  if (T.brush) { liveCancel(); T.brush = null; }
  const fam = familyOf(id); if (fam) T.famLast[fam.id] = id;
  T.tool = id; T.cursor = null; T.ghosts = []; T.live = []; T.artGhost = null; T.groundGhost = null; T.amend = null; T.measure = null; T.drag = null;
  HL.hover = null; HL.paint = null; HL.extra.clear();
  if (id !== 'select') { T.sel = null; HL.sel = null; }
  setTag(null);
  if (typeof UI !== 'undefined') UI.lib = null;
  VIEW.cv.style.cursor = id === 'select' ? 'default' : 'crosshair';
  setState('idle'); VIEW.dirty = true; uiSync();
}
function doUndo() { if (T.draft) cancelDraft(true); const e = undo(); T.amend = null; T.live = []; if (T.sel && !byId(world, T.sel)) selectId(null); if (e) toast(`Undid · ${e.label}`); VIEW.dirty = true; uiSync(); }
function doRedo() { const e = redo(); T.amend = null; if (e) toast(`Redid · ${e.label}`); VIEW.dirty = true; uiSync(); }
function eraseSelection() {
  if (!T.sel) return; const r = byId(world, T.sel); if (!r) return;
  const kind = { walls: 'wall', openings: 'opening', buildings: 'building', roofs: 'roof', stairs: 'stair', objects: 'object', forms: 'form', art: 'art', lights: 'light', paths: 'path', rooms: 'room' }[r.kind];
  const sm = eraseSummary({ kind, id: T.sel, item: r.item });
  if (sm.refuse) { toast(sm.refuse); return; }
  plainCommit(`Erase ${r.item.name}`, (w) => removeThing(w, kind, T.sel), { intent: `${OWNER_OF[kind]}.remove`, id: T.sel, with: sm.ids });
  selectId(null); setState('commit');
}
/** A Card edit: one undo step through the subject's owner. */
function editProp(id, label, fn, intent) {
  plainCommit(label, (w) => { const r = byId(w, id); if (r) fn(r.item, w); }, intent);
  VIEW.dirty = true; uiSync();
}

// ── preview and overlay hooks for the renderer ────────────────────────────────
function ghostDepth(g) {
  const o = g.obj;
  if (g.kind === 'wall') { const m = G.mid(o.a, o.b); return depthOf(m.x, m.y, (o.base || 0) + o.height / 2); }
  if (g.kind === 'building') { const c = G.centroid(footOf(o)); return depthOf(c.x, c.y, o.base + bHeight(o) / 2); }
  if (g.kind === 'stair') { const m = G.mid(o.a, o.b); return depthOf(m.x, m.y, (o.z0 + o.z1) / 2); }
  if (g.kind === 'form') { const c = G.centroid(o.pts); return depthOf(c.x, c.y, o.base + o.h / 2); }
  if (g.kind === 'roof') return -1e6;
  return depthOf(o.x, o.y, 0.4);
}
function drawGhost(ctx, g) {
  const opts = { ghost: true, hl: g.hl };
  if (g.kind === 'wall') drawWall(ctx, g.obj, opts);
  else if (g.kind === 'building') drawBuilding(ctx, g.obj, { ...opts, lo: g.lo });
  else if (g.kind === 'roof') drawRoomRoof(ctx, g.obj, opts);
  else if (g.kind === 'object') drawObject(ctx, g.obj, opts);
  else if (g.kind === 'stair') drawStair(ctx, g.obj, { hl: g.hl, refuse: g.hl === 'refuse' });
  else if (g.kind === 'light') drawLight(ctx, g.obj, opts);
  else if (g.kind === 'form') drawForm(ctx, g.obj, opts);
}
function previewItems(items) {
  const list = T.ghosts.slice();
  if (T.flash) { if (performance.now() < T.flash.until) { list.push(...T.flash.ghosts); VIEW.dirty = true; } else T.flash = null; }
  for (const g of list) items.push({ d: ghostDepth(g) - 0.01, alpha: g.hl === 'refuse' ? 0.6 : 0.55, draw: (ctx) => drawGhost(ctx, g) });
}
function previewGround(ctx) {
  if (T.groundGhost && T.groundGhost.kind === 'path') { drawPath(ctx, T.groundGhost.obj, { ghost: true }); }
  const d = T.draft;
  if (d && d.kind === 'terrace') {
    const z = d.phase === 'pull' ? d.h : hAt(d.a.x, d.a.y) + 0.05;
    const top = d.pts.map((p) => ({ ...p, z })), col2 = d.refused ? C.erase : C.cobalt;
    if (d.phase === 'pull') {
      for (let i = 0; i < 4; i++) { const a = d.pts[i], b = d.pts[(i + 1) % 4], dd = G.norm(G.sub(b, a)), out = { x: dd.y, y: -dd.x }; if (facesViewer(out)) fillPoly3(ctx, [{ ...a, z: hAt(a.x, a.y) }, { ...b, z: hAt(b.x, b.y) }, { ...b, z }, { ...a, z }], col(d.refused ? '#e8a497' : '#c7d4ef', lam(out), 0.55), col2, 1); }
      fillPoly3(ctx, top, col(d.refused ? '#f0b8ad' : '#d7e1f5', 1, 0.6), col2, 1.4);
    } else line3(ctx, drapeClosed(d.pts, 0.05).concat([drapeClosed(d.pts, 0.05)[0]]), C.ink, 2);
  }
}
function endMark(ctx, p, kind, color = C.ink) {
  const s = P(p.x, p.y, hAt(p.x, p.y) + 0.05);
  ctx.save(); ctx.lineWidth = 1.7; ctx.strokeStyle = color; ctx.fillStyle = color;
  if (kind === 'wall') { ctx.beginPath(); ctx.arc(s.x, s.y, 6.5, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
  else if (kind === 'grid') { ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x - 4.5, s.y - 4.5, 9, 9); ctx.strokeRect(s.x - 4.5, s.y - 4.5, 9, 9); }
  else { ctx.beginPath(); ctx.arc(s.x, s.y, 3.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function brushRing(ctx, g, R, color, fill) {
  const ring = drapeClosed(G.circlePoly(g, R, 40), 0.08);
  path3(ctx, ring);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = 1.6; ctx.strokeStyle = color; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
  const c = P(g.x, g.y, hAt(g.x, g.y) + 0.08); ctx.beginPath(); ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}
function drawOverlay(ctx) {
  const tool = T.tool, d = T.draft, ptr = T.pointer;
  // draft ink
  if (d && !d.kind && (DRAWING.has(tool) || isStream())) {
    const gm = shapeGeom(d, false, ptr && ptr.e);
    if (gm) {
      const pts = geomPoints(gm); if (gm.closed) pts.push(pts[0]);
      line3(ctx, drape(pts, 0.06, 0.4), C.ink, 2.2);
      for (const p of gm.pts) { const s = P(p.x, p.y, hAt(p.x, p.y) + 0.06); ctx.beginPath(); ctx.arc(s.x, s.y, 2.6, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill(); }
      if (d.shape === 'arc' && d.phase === 'bend' && d.pts.length >= 2) line3(ctx, drape([d.pts[d.pts.length - 2], d.pts[d.pts.length - 1]], 0.06), 'rgba(27,32,28,.35)', 1, [3, 4]);
    }
  }
  // snap end mark
  if (DRAWING.has(tool) && !(d && d.kind) && T.cursor && ptr) endMark(ctx, T.cursor.p, T.cursor.kind);
  // brushes
  if (ptr && !CAMDRAG) {
    const g = clampWS(ptr.g);
    if (tool === 'ground' && opt('brush') !== 'terrace') brushRing(ctx, g, brushRadius(), C.ink);
    if (tool === 'water' && opt('mode') === 'pond') brushRing(ctx, g, brushRadius() * 0.75, '#2f6f86', 'rgba(90,160,180,.18)');
    if (tool === 'plants') brushRing(ctx, g, brushRadius(), ptr.e.shiftKey ? C.erase : '#3f6e4a', ptr.e.shiftKey ? 'rgba(208,65,45,.08)' : 'rgba(80,140,90,.10)');
    if (tool === 'paint' && T.aimRes && T.aimRes.ground) brushRing(ctx, g, brushRadius(), C.ink, col(MATERIALS[opt('material')].color, 1, 0.45));
    if (tool === 'erase' && !HL.hover && (T.brush || world.plants.some((p) => G.dist(p, g) < 1.2))) brushRing(ctx, g, 1.2, C.erase, 'rgba(208,65,45,.08)');
  }
  // opening ghost
  if (tool === 'opening' && T.aimRes && T.aimRes.o && !d) {
    const a = T.aimRes, o = a.o, color = a.ok ? C.cobalt : C.erase;
    let outline;
    if (o.hostKind === 'wall') { const wl = a.hit.item, pts = wallPts(wl); outline = openingOutline(o).map(([u, v]) => wallUV(pts, wl, u, Math.min(v, wl.height), a.hit.side, 0.03)); }
    else { const e = a.hit.e, b = a.hit.item; outline = openingOutline({ ...o, sill: o.floor * STOREY + o.sill }).map(([u, v]) => ({ x: e.a.x + e.dir.x * u + e.out.x * 0.05, y: e.a.y + e.dir.y * u + e.out.y * 0.05, z: b.base + v })); }
    path3(ctx, outline); ctx.fillStyle = a.ok ? 'rgba(42,98,214,.16)' : 'rgba(208,65,45,.18)'; ctx.fill();
    ctx.setLineDash([5, 3]); ctx.lineWidth = 1.8; ctx.strokeStyle = color; ctx.stroke(); ctx.setLineDash([]);
  }
  // art ghost
  if (tool === 'object' && T.artGhost) {
    const { wl, side, frames, size, line } = T.artGhost, pts = wallPts(wl), [w, h] = ART_SIZES[size];
    for (const f of frames) {
      const cs = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => wallUV(pts, wl, f.s + u, line + v, side, 0.06));
      path3(ctx, cs); ctx.fillStyle = f.ok ? 'rgba(42,98,214,.14)' : 'rgba(208,65,45,.16)'; ctx.fill();
      ctx.setLineDash([5, 3]); ctx.lineWidth = 1.6; ctx.strokeStyle = f.ok ? C.cobalt : C.erase; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // measure
  if (T.measure) {
    const { a, b } = T.measure;
    line3(ctx, [{ ...a, z: a.z + 0.06 }, { ...b, z: b.z + 0.06 }], C.inspect, 2.4);
    for (const p of [a, b]) { const s = P(p.x, p.y, p.z + 0.06); ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fillStyle = C.inspect; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke(); }
  }
  // selection marks
  if (T.sel && tool === 'select') {
    const r = byId(world, T.sel);
    if (r && r.kind === 'walls') {
      const wl = r.item, pts = wallPts(wl), m = G.atLen(pts, G.polyLen(pts) / 2).p, s = P(m.x, m.y, wallBase(wl) + wl.height + 0.05);
      ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      const n = G.left(G.norm(G.sub(wl.b, wl.a))), s2 = P(m.x + n.x * 0.8, m.y + n.y * 0.8, wallBase(wl) + wl.height + 0.05), s3 = P(m.x - n.x * 0.8, m.y - n.y * 0.8, wallBase(wl) + wl.height + 0.05);
      ctx.beginPath(); ctx.moveTo(s2.x, s2.y); ctx.lineTo(s3.x, s3.y); ctx.strokeStyle = 'rgba(167,128,26,.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    }
    if (r && r.kind === 'buildings') {
      const b = r.item, c = G.centroid(footOf(b)), s = P(c.x, c.y, roofTopZ(b) + 0.9);
      ctx.fillStyle = C.gold; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.rect(s.x - 7, s.y - 7, 14, 14); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x, s.y - 14); ctx.lineTo(s.x - 4, s.y - 10); ctx.lineTo(s.x + 4, s.y - 10); ctx.closePath(); ctx.moveTo(s.x, s.y + 14); ctx.lineTo(s.x - 4, s.y + 10); ctx.lineTo(s.x + 4, s.y + 10); ctx.closePath(); ctx.fillStyle = C.goldDeep; ctx.fill();
    }
    if (r && r.kind === 'forms') {
      const f = r.item, c = G.centroid(f.pts), s0 = P(c.x, c.y, f.base + f.h), s = P(c.x, c.y, f.base + f.h + 0.55);
      ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s.x, s.y); ctx.strokeStyle = C.goldDeep; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = C.gold; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.rect(s.x - 6, s.y - 6, 12, 12); ctx.fill(); ctx.stroke();
    }
    if (r && r.kind === 'lights' && r.item.aimAt) { const a = world.art.find((x) => x.id === r.item.aimAt), lp = lightPos(r.item); if (a && lp) line3(ctx, [lp, artCentre(a)], C.goldDeep, 1.4, [4, 3]); }
  }
  // sky arc (while the Sky is open in the head)
  if (typeof UI !== 'undefined' && UI.sky) {
    const sk = skyArc();
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k <= 64; k++) { const p = sk.pos(5 + (16 * k) / 64); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.strokeStyle = SUN.night > 0.5 ? 'rgba(251,246,234,.5)' : 'rgba(19,38,27,.35)'; ctx.lineWidth = 1.4; ctx.setLineDash([2, 5]); ctx.stroke(); ctx.setLineDash([]);
    for (const t of [6, 12, 18]) { const p = sk.pos(t); ctx.beginPath(); ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x, p.y + 5); ctx.stroke(); ctx.font = '11px "DM Mono", ui-monospace, Menlo, monospace'; ctx.fillStyle = SUN.night > 0.5 ? 'rgba(251,246,234,.75)' : 'rgba(19,38,27,.6)'; ctx.textAlign = 'center'; ctx.fillText(t === 12 ? 'noon' : t === 6 ? 'sunrise' : 'sunset', p.x, p.y + 18); }
    const sp = sk.pos(world.sun), night = SUN.night > 0.5;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, T.sunHover || T.sunDrag ? 13 : 11, 0, Math.PI * 2);
    ctx.fillStyle = night ? '#e8e4d4' : '#f2c14e'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = night ? '#9aa3b8' : '#b07d12'; ctx.stroke();
    if (night) { ctx.beginPath(); ctx.arc(sp.x + 4, sp.y - 3, 9, 0, Math.PI * 2); ctx.fillStyle = '#3a4566'; ctx.fill(); }
    ctx.font = '600 11px "DM Mono", ui-monospace, Menlo, monospace'; ctx.fillStyle = night ? '#fbf6ea' : '#13261b'; ctx.textAlign = 'center'; ctx.fillText(hh(world.sun), sp.x, sp.y - 18);
    ctx.restore();
  }
}

// ── keyboard ──────────────────────────────────────────────────────────────────
function onKey(e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  const k = e.key, mod = e.metaKey || e.ctrlKey;
  if (k === ' ') { T.space = true; e.preventDefault(); return; }
  if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
  if (mod && (k === 'y')) { e.preventDefault(); doRedo(); return; }
  if (mod) return;
  if (k === 'Escape') { e.preventDefault(); escLadder(false); return; }
  if (k === 'Enter' && T.draft && T.draft.kind === 'formpull') { IMPL.form.set(); return; }
  if (k === 'Enter' && T.draft && !T.draft.kind && DRAWING.has(T.tool)) {
    const d = T.draft;
    if (d.shape === 'outline') d.closed = d.pts.length >= 3;
    if (d.shape === 'arc' && d.phase === 'bend') { d.bulges[d.bulges.length - 1] = arcBulge(d, d.cursor); d.phase = 'end'; }
    drawingFinish(e); return;
  }
  if ((k === 'Backspace' || k === 'Delete')) {
    if (T.draft && T.draft.pts && T.draft.pts.length > 1 && (T.draft.shape === 'line' || T.draft.shape === 'outline' || T.draft.shape === 'arc')) {
      const d = T.draft; d.pts.pop(); d.bulges.pop(); if (d.shape === 'arc') d.phase = 'end'; if (T.pointer) drawingUpdate(T.pointer); VIEW.dirty = true; e.preventDefault(); return;
    }
    if (T.sel && T.tool === 'select') { eraseSelection(); e.preventDefault(); return; }
    return;
  }
  if (k === 'Shift' || k === 'Alt') { if (T.pointer) { T.pointer.e = e; const impl = IMPL[T.tool]; if (impl && impl.move && !DRAWING.has(T.tool)) impl.move(T.pointer); } VIEW.dirty = true; return; }
  if ((k === 'r' || k === 'R') && T.tool === 'object') { T.objRot += Math.PI / 12; if (T.pointer) IMPL.object.move(T.pointer); return; }
  if (k === '[' || k === ']') {
    const g = groupsOf().find((x) => x.id === 'size'); if (!g) return;
    const vs = g.options.map((o) => o.v), i = vs.indexOf(opt('size')); setOpt('size', vs[clamp(i + (k === ']' ? 1 : -1), 0, vs.length - 1)]); return;
  }
  if (/^[1-9]$/.test(k)) {
    for (const g of groupsOf()) { const o = g.options && g.options.find((x) => x.key === k); if (o) { setOpt(g.id, o.v); return; } }
    return;
  }
  const up = k.toUpperCase();
  if (up === 'K' && typeof UI !== 'undefined') { UI.openLibrary(); return; }
  const tool = Object.keys(TOOLS).find((id) => TOOLS[id].key === up);
  if (tool) { armTool(tool); }
}
function onKeyUp(e) {
  if (e.key === ' ') T.space = false;
  if ((e.key === 'Shift' || e.key === 'Alt') && T.pointer) { T.pointer.e = e; const impl = IMPL[T.tool]; if (impl && impl.move && !DRAWING.has(T.tool) && !T.pressed) impl.move(T.pointer); VIEW.dirty = true; }
}

// ── loop ──────────────────────────────────────────────────────────────────────
function loop() {
  if (T.brush && T.pressed) brushTick();
  const moving = camStep();
  if (['commit', 'cancel', 'refuse'].includes(T.state) && performance.now() - T.stateAt > 1100) {
    if (T.tag && (T.tag.kind === 'refuse' || T.state !== 'commit')) setTag(null);
    setState(T.pointer ? 'aim' : 'idle');
    if (T.tool === 'opening' || T.tool === 'light') setTag(null);
  }
  if (moving || VIEW.dirty || RISE.size) { render(); if (typeof UI !== 'undefined') UI.layout(); }
  requestAnimationFrame(loop);
}

// ── scenarios ─────────────────────────────────────────────────────────────────
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hill(w, cx, cy, r, h) { for (let j = 0; j < TER.V; j++) for (let i = 0; i < TER.V; i++) { const x = i - TER.HALF, y = j - TER.HALF; w.terrain.h[vIdx(i, j)] += h * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (r * r)); } }
function scatter(w, rng, kind, n, test) {
  let placed = 0, tries = 0;
  while (placed < n && tries < n * 30) {
    tries++;
    const p = { x: (rng() - 0.5) * 38, y: (rng() - 0.5) * 38 };
    if (test && !test(p)) continue;
    if (!plantAllowed(w, p)) continue;
    if (w.plants.some((q) => G.dist(q, p) < SPACING[kind] * 1.1)) continue;
    w.plants.push({ x: p.x, y: p.y, kind, s: kind === 'tree' ? 0.8 + rng() * 0.45 : 0.75 + rng() * 0.5, v: rng() }); placed++;
  }
}
const SCENARIOS = {
  village: {
    name: 'Village by the pond', hour: 15.5,
    build(w) {
      const rng = mulberry(7);
      hill(w, 11, 11, 8, 3.4); hill(w, -15, -13, 6, 1.4); hill(w, 15, -14, 5, 0.9);
      paintWater(w, { x: -3.2, y: -3.6 }, 2.3, hAt(-3.2, -3.6, w) - 0.1, 0.6);
      const cot = addBuilding(w, { shape: 'poly', pts: [{ x: -9, y: 2 }, { x: -1, y: 2 }, { x: -1, y: 8 }, { x: -9, y: 8 }], floors: 2, roof: 'gable', windows: 'regular', base: groundRange([{ x: -9, y: 2 }, { x: -1, y: 2 }, { x: -1, y: 8 }, { x: -9, y: 8 }], w).hi });
      cot.name = 'Cottage';
      const tw = addBuilding(w, { shape: 'circle', c: { x: -12.6, y: 9.5 }, r: 2.3, floors: 3, roof: 'cone', windows: 'sparse', base: groundRange(G.circlePoly({ x: -12.6, y: 9.5 }, 2.3, 16), w).hi, mat: 'stone' });
      tw.name = 'Tower'; tw.style = 'Tower';
      const c2pts = [{ x: -18.5, y: -3.5 }, { x: -13, y: -3.5 }, { x: -13, y: 1 }, { x: -18.5, y: 1 }];
      const c2 = addBuilding(w, { shape: 'poly', pts: c2pts, floors: 1, roof: 'hip', windows: 'sparse', base: groundRange(c2pts, w).hi });
      c2.name = 'Small cottage';
      const gw = addWallChain(w, [{ x: 2, y: -9 }, { x: 11, y: -9 }, { x: 11, y: -2 }, { x: 2, y: -2 }], [0, 0, 0, 0], true, { height: 1.2, base: 0, mat: 'stone' });
      gw.room.name = 'Walled garden';
      for (const wl of gw.walls) wl.base = chainBase({ pts: [wl.a, wl.b], bulges: [0], closed: false });
      const pathPts = [{ x: -5, y: 3.2 }, { x: -5, y: -1.2 }, { x: -3.4, y: -3.6 }, { x: -1.2, y: -5.3 }, { x: 2.8, y: -5.5 }, { x: 7, y: -5.5 }];
      applyPath(w, { pts: pathPts, width: 1.6, surface: 'gravel' }, planPath(w, pathPts, 1.6));
      w.paths[0].name = 'Garden path';
      for (const o of w.openings) if (o.origin) o.origin = 'Garden path';
      const b1 = nid(w, 'object', 'Bench'); w.objects.push({ id: b1.id, name: b1.name, item: 'bench', x: 8.5, y: -8.45, r: 0 });
      const p1 = nid(w, 'object', 'Planter'); w.objects.push({ id: p1.id, name: p1.name, item: 'planter', x: 10.2, y: -3, r: 0 });
      const p2 = nid(w, 'object', 'Planter'); w.objects.push({ id: p2.id, name: p2.name, item: 'planter', x: 3, y: -8.1, r: 0 });
      scatter(w, rng, 'tree', 26, (p) => G.dist(p, { x: -5, y: -1 }) > 6);
      scatter(w, rng, 'shrub', 18);
      scatter(w, rng, 'flower', 16, (p) => p.x > 3 && p.x < 10.5 && p.y > -8.5 && p.y < -2.5 || G.dist(p, { x: -3.2, y: -3.6 }) < 4.5);
      w.terrain.paint.forEach((_, c) => { const i = c % TER.N, j = (c / TER.N) | 0, x = i - TER.HALF + 0.5, y = j - TER.HALF + 0.5; if (x > 2 && x < 11 && y > -9 && y < -2) w.terrain.paint[c] = 'grass'; });
    },
  },
  gallery: {
    name: 'Gallery at dusk', hour: 19.1,
    build(w) {
      const rng = mulberry(11);
      hill(w, -14, 13, 7, 1.2); hill(w, 14, 14, 6, 1.6);
      const box = addWallChain(w, [{ x: -8, y: -4 }, { x: 4, y: -4 }, { x: 4, y: 4 }, { x: -8, y: 4 }], [0, 0, 0, 0], true, { height: 3.6, base: 0 });
      box.room.name = 'Long gallery';
      const cg = circleGeom({ x: 7.5, y: 0 }, 3.5, Math.PI / 4);
      const rnd = addWallChain(w, cg.pts, cg.bulges, true, { height: 3.6, base: 0, mat: 'plaster' });
      rnd.room.name = 'Round room';
      const [south, east, north] = box.walls, west = rnd.walls[1];
      addOpening(w, { hostKind: 'wall', hostId: east.id, s: 4, kind: 'arch' });
      addOpening(w, { hostKind: 'wall', hostId: west.id, s: wallLen(west) / 2, kind: 'arch' });
      addOpening(w, { hostKind: 'wall', hostId: south.id, s: 6, kind: 'door' });
      addOpening(w, { hostKind: 'wall', hostId: north.id, s: 6, kind: 'window', width: 1.6 });
      const art = (wl, s, size, hue) => { const { id, name } = nid(w, 'art'); w.art.push({ id, name, wallId: wl.id, side: 1, s, size, line: 1.45, hue }); return id; };
      const a1 = art(north, 2.4, 'm', ART_HUES[0]), a2 = art(north, 9.6, 'l', ART_HUES[1]);
      art(south, 2.6, 'm', ART_HUES[2]); art(south, 9.4, 's', ART_HUES[3]);
      const a5 = art(rnd.walls[3], wallLen(rnd.walls[3]) / 2, 'l', ART_HUES[4]);
      art(box.walls[3], 4, 'l', ART_HUES[5]);
      const spot = (x, y, aimAt) => { const { id, name } = nid(w, 'light', 'Spot'); w.lights.push({ id, name, kind: 'spot', x, y, aimAt }); };
      spot(2.4, 1.6, a1); spot(-5.6, 1.6, a2); spot(7.6, -1.2, a5);
      const pd = nid(w, 'light', 'Pendant'); w.lights.push({ id: pd.id, name: pd.name, kind: 'pendant', x: 7.5, y: 0.6, roomId: rnd.room.id });
      const wl1 = nid(w, 'light', 'Wall light'); w.lights.push({ id: wl1.id, name: wl1.name, kind: 'wall', wallId: south.id, s: 4.6, side: -1, x: 0, y: 0 });
      const b1 = nid(w, 'object', 'Bench'); w.objects.push({ id: b1.id, name: b1.name, item: 'bench', x: -2, y: 0, r: 0 });
      const pl = nid(w, 'object', 'Plinth'); w.objects.push({ id: pl.id, name: pl.name, item: 'plinth', x: 8.6, y: -0.6, r: 0 });
      applyPath(w, { pts: [{ x: -2, y: -3.6 }, { x: -2, y: -8 }, { x: -6, y: -13 }, { x: -7, y: -19 }], width: 1.6, surface: 'stone' }, []);
      w.paths[0].name = 'Entrance path';
      scatter(w, rng, 'tree', 22, (p) => !(p.x > -10 && p.x < 12 && p.y > -6 && p.y < 6));
      scatter(w, rng, 'grass', 30);
    },
  },
  studio: {
    name: 'Studio composition', hour: 17.5,
    build(w) {
      const rng = mulberry(13);
      hill(w, 15, 15, 7, 1.1); hill(w, -16, 14, 6, 0.8);
      w.terrain.paint.forEach((_, c) => { const i = c % TER.N, j = (c / TER.N) | 0, x = i - TER.HALF + 0.5, y = j - TER.HALF + 0.5; if (Math.abs(x) < 11 && Math.abs(y) < 9) w.terrain.paint[c] = 'gravel'; });
      const box = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
      const form = (label, pts, base, h, mat, on) => { const { id, name } = nid(w, 'form', label); const f = { id, name, pts, base, h, mat, on: on || null }; w.forms.push(f); return f; };
      const stage = form('Stage', box(-7, -3.5, 1, 2.5), 0, 0.4, 'timber');
      form('Drum', G.circlePoly({ x: -4.4, y: -0.6 }, 1.1, 28), 0.4, 0.9, 'limewash', stage.id);
      form('Pillar', box(4, -4.6, 5.2, -3.4), 0, 3.2, 'ochre');
      form('Pedestal', box(6.4, -1.2, 7.2, -0.4), 0, 1.1, 'stone');
      const back = addWallChain(w, [{ x: 3, y: 5.5 }, { x: -8, y: 5.5 }], [0], false, { height: 3.2, base: 0, mat: 'plaster' });
      const bw = back.walls[0]; bw.name = 'Back wall';
      const frame = (s, size, hue) => { const { id, name } = nid(w, 'art'); w.art.push({ id, name, wallId: bw.id, side: 1, s, size, line: 1.45, hue }); return id; };
      const f1 = frame(3.2, 'l', ART_HUES[1]), f2 = frame(7.4, 'm', ART_HUES[4]);
      const spot = (x, y, aimAt) => { const { id, name } = nid(w, 'light', 'Spot'); w.lights.push({ id, name, kind: 'spot', x, y, aimAt }); };
      spot(-0.2, 3.4, f1); spot(-4.4, 3.4, f2);
      const obj = (label, item, x, y, r) => { const { id, name } = nid(w, 'object', label); w.objects.push({ id, name, item, x, y, r }); };
      obj('Plinth', 'plinth', -1.4, 0.9, 0); obj('Vitrine', 'vitrine', -1.6, -2.3, 0); obj('Screen', 'screen', 3.4, 1.4, 0.5);
      obj('Bench', 'bench', -3, -7, 0);
      scatter(w, rng, 'tree', 12, (p) => Math.abs(p.x) > 12 || Math.abs(p.y) > 10);
      scatter(w, rng, 'grass', 24, (p) => Math.abs(p.x) > 11.5 || Math.abs(p.y) > 9.5);
    },
  },
  slope: {
    name: 'Hillside to build on', hour: 11,
    build(w) {
      const rng = mulberry(3);
      hill(w, 4, 14, 12, 4.2); hill(w, -12, 8, 6, 1.3);
      terraceTerrain(w, [{ x: 3, y: 1 }, { x: 11, y: 1 }, { x: 11, y: 7 }, { x: 3, y: 7 }], 2.4);
      scatter(w, rng, 'tree', 18, (p) => p.y > 9 || p.x < -8);
      scatter(w, rng, 'shrub', 10);
    },
  },
  meadow: {
    name: 'Empty meadow', hour: 10,
    build(w) { const rng = mulberry(5); hill(w, 12, 12, 9, 2.2); hill(w, -13, -10, 7, 1); scatter(w, rng, 'tree', 10, (p) => Math.abs(p.x) > 12 || Math.abs(p.y) > 12); },
  },
};
function loadScenario(name) {
  const sc = SCENARIOS[name] || SCENARIOS.village;
  if (T.draft) cancelDraft(true);
  world = newWorld(); sc.build(world); world.sun = sc.hour; world.rev = 1;
  HIST.undo = []; HIST.redo = []; RISE.clear(); T.amend = null; T.live = []; T.lastIntent = null; T.measure = null;
  selectId(null); setTag(null);
  RNG = mulberry(42); frameStage();
  VIEW.dirty = true; uiSync();
}
