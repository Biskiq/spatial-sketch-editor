/* §9 · Fixtures and saved groups (D8s specimen).
   One compound placement with two entry points: a curated fixture (Lights › Fixtures, mount origin)
   and a saved group (My objects, support origin). Specimen state only: nothing persists, no
   production asset is loaded, and no Scene contract is modelled beyond what the D8 plan states.
   Reuses this sheet's globals: emitter(), label(), cardHTML(), syncBeam(), fillRange(), icon(),
   mkUI(), warmthColor(), hex(), and the ink constants. */
(() => {
  'use strict';
  const $id = (id) => document.getElementById(id);
  if (!$id('fixtures')) return;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r1 = (n) => (+n).toFixed(1), r2 = (n) => (+n).toFixed(2);
  const LEAF = '#4f8f6c', REDINK = '#8a3d25';
  const DEG = Math.PI / 180;

  /* ------------------------------------------------------------------ world */
  const S = 50, OX = 210, OY = 150, KX = S * 0.86, KZ = S * 0.36, KY = S * 0.86;
  const PJ = ([x, y, z]) => [OX + (x - z) * KX, OY + (x + z) * KZ - y * KY];
  const ROOM = { x0: 0, x1: 6, z0: 0, z1: 4, lid: 2.8 };
  const TERR = { x0: 6, x1: 8.4, z0: 0, z1: 4 };
  const DAIS = { x0: 2.7, x1: 4.3, z0: 1.7, z1: 2.9, h: 0.3, name: 'Dais' };
  const DOOR = { z0: 1.0, z1: 1.8, h: 2.1 };
  /* overhead regions: T1 publishes each underside; the lowest above the floor wins, a region beats the lid */
  const OVER = [
    { name: 'Soffit', x0: 0, x1: 2.2, z0: 0, z1: 4, y: 2.4, top: 2.8 },
    { name: 'Landing', x0: 4.4, x1: 6, z0: 0, z1: 1.4, y: 1.1, top: 1.3 },
  ];
  const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  function supportAt(x, z) {
    if (inR(DAIS, x, z)) return { y: DAIS.h, name: 'Dais' };
    if (inR(ROOM, x, z)) return { y: 0, name: 'the floor' };
    if (inR(TERR, x, z)) return { y: 0, name: 'the terrace' };
    return null;
  }
  function overheadAt(x, z) {
    if (!inR(ROOM, x, z)) return null; // the terrace is open sky
    const floor = supportAt(x, z).y;
    const c = OVER.filter((o) => inR(o, x, z) && o.y > floor).sort((a, b) => a.y - b.y)[0];
    return c ? { y: c.y, name: c.name } : { y: ROOM.lid, name: 'the ceiling' };
  }
  /* pointer → hit, in the order a ray meets them from this camera */
  function pick(sx, sy) {
    const onY = (h) => { const a = (sx - OX) / KX, b = (sy - OY + h * KY) / KZ; return [(a + b) / 2, h, (b - a) / 2]; };
    let p = onY(DAIS.h); if (inR(DAIS, p[0], p[2])) return { surf: 'support', x: p[0], y: DAIS.h, z: p[2], n: [0, 1, 0], name: 'Dais' };
    p = onY(0);
    if (inR(ROOM, p[0], p[2]) || inR(TERR, p[0], p[2])) return { surf: 'support', x: p[0], y: 0, z: p[2], n: [0, 1, 0], name: inR(ROOM, p[0], p[2]) ? 'the floor' : 'the terrace' };
    { const x = (sx - OX) / KX, y = (OY + x * KZ - sy) / KY; if (x >= 0 && x <= ROOM.x1 && y >= 0 && y <= ROOM.lid) return { surf: 'wall', x, y, z: 0, n: [0, 0, 1], name: 'Back wall' }; }
    { const z = -(sx - OX) / KX, y = (OY + z * KZ - sy) / KY;
      if (z >= 0 && z <= ROOM.z1 && y >= 0 && y <= ROOM.lid) { if (z >= DOOR.z0 && z <= DOOR.z1 && y < DOOR.h) return { surf: 'void', name: 'the doorway' }; return { surf: 'wall', x: 0, y, z, n: [1, 0, 0], name: 'Side wall' }; } }
    return { surf: 'void', name: 'nothing' };
  }

  /* ------------------------------------------------------------------ geometry */
  const ring = (cx, y, cz, r, n = 14) => Array.from({ length: n }, (_, i) => { const t = i / n * 2 * Math.PI; return [cx + Math.cos(t) * r, y, cz + Math.sin(t) * r]; });
  const box = (cx, y0, cz, w, h, d) => { const a = w / 2, c = d / 2; return [[cx - a, y0, cz - c], [cx + a, y0, cz - c], [cx + a, y0, cz + c], [cx - a, y0, cz + c], [cx - a, y0 + h, cz - c], [cx + a, y0 + h, cz - c], [cx + a, y0 + h, cz + c], [cx - a, y0 + h, cz + c]]; };
  const cyl = (cx, y0, cz, r0, r1, h, n) => ring(cx, y0, cz, r0, n).concat(ring(cx, y0 + h, cz, r1, n));
  function hull(ps) {
    const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
  const pathOf = (poly) => poly.map((q, i) => (i ? 'L' : 'M') + r1(q[0]) + ',' + r1(q[1])).join('') + 'Z';
  const rotY = ([x, y, z], a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c + z * s, y, -x * s + z * c]; };

  /* Member shapes, local to the member, metres. Each part: hull (filled solid) or line. */
  const SHAPES = {
    lamp: () => [{ t: 'hull', p: cyl(0, -0.035, 0, 0.07, 0.07, 0.035, 10), fill: '#2f3430' }, { t: 'line', a: [0, -0.035, 0], b: [0, -0.56, 0] }, { t: 'hull', p: cyl(0, -0.86, 0, 0.21, 0.055, 0.3, 16), fill: '#3a403b', rim: true }],
    lantern: () => [{ t: 'hull', p: cyl(0, -0.03, 0, 0.06, 0.06, 0.03, 10), fill: '#2f3430' }, { t: 'line', a: [0, -0.03, 0], b: [0, -0.55, 0], dash: '2 2' }, { t: 'hull', p: box(0, -0.63, 0, 0.18, 0.08, 0.18).concat([[0, -0.55, 0]]), fill: '#2f3430' }, { t: 'hull', p: box(0, -1.2, 0, 0.32, 0.57, 0.32), fill: '#6b6250', glass: true }, { t: 'hull', p: box(0, -1.3, 0, 0.12, 0.1, 0.12), fill: '#2f3430' }],
    sconce: () => [{ t: 'hull', p: box(0, -0.15, 0.015, 0.13, 0.3, 0.03), fill: '#2f3430' }, { t: 'line', a: [0, 0, 0.03], b: [0, 0.03, 0.2] }, { t: 'hull', p: cyl(0, -0.19, 0.23, 0.085, 0.06, 0.2, 12), fill: '#3a403b', rim: true }],
    chair: () => [{ t: 'hull', p: box(0, 0, 0, 0.78, 0.45, 0.8), fill: '#8a6f55' }, { t: 'hull', p: box(0, 0.45, -0.32, 0.78, 0.45, 0.16), fill: '#7d644c' }],
    table: () => [{ t: 'hull', p: cyl(0, 0, 0, 0.24, 0.24, 0.56, 14), fill: null }],
    plinth: () => [{ t: 'hull', p: box(0, 0, 0, 0.5, 1.0, 0.5), fill: '#d9d3c4' }],
    vase: () => [{ t: 'hull', p: cyl(0, 0, 0, 0.12, 0.08, 0.38, 12), fill: '#5b7c8c' }],
    bench: () => [{ t: 'hull', p: box(0, 0, 0, 1.4, 0.45, 0.45), fill: '#9a7b5c' }],
  };
  const FINISH = { walnut: { name: 'Oiled walnut', fill: '#6f4a31', project: true } };
  const BASE = { table: '#c9b89a' };

  /* ------------------------------------------------------------------ catalogue (mock) */
  const spotL = (o) => ({ kind: 'light', lk: 'spot', half: 25, pen: 0.5, I: Math.PI, warm: -60, range: 6, shadow: false, ...o });
  const pointL = (o) => ({ kind: 'light', lk: 'point', I: Math.PI, warm: -60, range: 4, shadow: false, ...o });
  const FIXTURES = [
    { id: 'fixture-hanging-industrial', label: 'Hanging Industrial Lamp', mount: 'ceiling', mountLine: 'Hangs from a ceiling', light: 'Spot · 50°', members: [{ name: 'Hanging Industrial Lamp', kind: 'model', shape: 'lamp', p: [0, 0, 0], contact: true }, spotL({ name: 'Lamp light', p: [0, -0.8, 0], aim: [0, -1, 0] })] },
    { id: 'fixture-lantern-chandelier', label: 'Lantern Chandelier', mount: 'ceiling', mountLine: 'Hangs from a ceiling', light: 'Point · 4 m', members: [{ name: 'Lantern Chandelier', kind: 'model', shape: 'lantern', p: [0, 0, 0], contact: true }, pointL({ name: 'Lantern light', p: [0, -0.92, 0] })] },
    { id: 'fixture-wall-sconce', label: 'Industrial Wall Sconce', mount: 'wall', mountLine: 'Mounts on a wall', light: 'Point · 3 m', members: [{ name: 'Industrial Wall Sconce', kind: 'model', shape: 'sconce', p: [0, 0, 0], contact: true }, pointL({ name: 'Sconce light', p: [0, -0.07, 0.23], range: 3 })] },
  ];
  /* My objects. A saved group stores no thumbnail (plan §4.4, E8); its tile is the group mark. */
  const MINE = [
    { id: 'lib-reading', kind: 'group', name: 'Reading corner', fmt: 1, note: 'Saved from Salon', members: [{ name: 'Salon chair', kind: 'model', shape: 'chair', p: [-0.35, 0, 0], contact: true }, { name: 'Side table', kind: 'prim', shape: 'table', p: [0.45, 0, 0.25] }, pointL({ name: 'Reading light', p: [0.45, 1.45, 0.25], range: 2.5 })], dropped: ['Side table · Oiled walnut'] },
    { id: 'lib-plinth', kind: 'group', name: 'Plinth and spot', fmt: 1, note: 'Saved from Gallery', members: [{ name: 'Plinth', kind: 'form', shape: 'plinth', p: [0, 0, 0] }, spotL({ name: 'Plinth spot', p: [0.9, 2.3, 0.9], aimAt: [0, 1.05, 0], half: 14, pen: 0.4 })] },
    { id: 'lib-niche', kind: 'form', name: 'Arched niche', fmt: 1, note: 'Form' },
    { id: 'lib-showcase', kind: 'group', name: 'Showcase', fmt: 0, note: 'Earlier development version', members: [] },
  ];

  /* ------------------------------------------------------------------ scene state (specimen only) */
  let uid = 0; const nid = (p) => p + (++uid);
  function memberFrom(m) {
    const o = JSON.parse(JSON.stringify(m)); o.id = nid('m');
    if (o.kind === 'light' && o.aimAt) { const d = [o.aimAt[0] - o.p[0], o.aimAt[1] - o.p[1], o.aimAt[2] - o.p[2]], l = Math.hypot(...d); o.aim = d.map((v) => v / l); delete o.aimAt; }
    return o;
  }
  function seed() {
    uid = 0;
    const lamp = { id: 'g-lamp', name: 'Hanging Industrial Lamp', from: 'fixture', piv: [3.5, ROOM.lid, 2.3], yaw: 0, members: FIXTURES[0].members.map(memberFrom) };
    const still = { id: 'g-still', name: 'Still life', from: 'scene', piv: [2.9, 0, 0.55], yaw: 0, members: [
      { id: nid('m'), name: 'Plinth', kind: 'form', shape: 'plinth', p: [0, 0, 0] },
      { id: nid('m'), name: 'Pears', kind: 'artwork', p: [0, 1.55, -0.55], w: 0.8, h: 0.6, art: '#c4a05a' },
      memberFrom(spotL({ name: 'Picture spot', p: [0.1, 2.35, 0.9], aimAt: [0, 1.55, -0.55], half: 12, pen: 0.35 })),
    ] };
    const read = { id: 'g-read', name: 'Reading corner', from: 'scene', piv: [1.1, 0, 3.1], yaw: 0, members: [
      { id: nid('m'), name: 'Salon chair', kind: 'model', shape: 'chair', p: [-0.35, 0, 0], contact: true },
      { id: nid('m'), name: 'Side table', kind: 'prim', shape: 'table', p: [0.45, 0, 0.25], finish: 'walnut' },
      memberFrom(pointL({ name: 'Reading light', p: [0.45, 1.45, 0.25], range: 2.5 })),
    ] };
    return { groups: [lamp, still, read] };
  }
  const ST = {
    sc: seed(), sel: null, hover: null, arm: null, ptr: null, cand: null, press: false, relRefused: false,
    lib: 'lights', ships: true, dupMode: 'g1', mine: MINE.map((x) => ({ ...x })), saved: {}, disc: null, menu: null, renaming: false,
    picked: null, flash: null, undo: [], redo: [], log: [],
  };
  const snap = () => JSON.stringify({ sc: ST.sc, uid });
  function commit(label, fn) {
    ST.undo.push({ s: snap(), sel: ST.sel, label }); ST.redo = [];
    fn(); log('w', `${label} · Undo ${ST.undo.length}`);
  }
  function undo() { const u = ST.undo.pop(); if (!u) return log('n', 'Undo · nothing to undo'); ST.redo.push({ s: snap(), sel: ST.sel, label: u.label }); const o = JSON.parse(u.s); ST.sc = o.sc; uid = o.uid; ST.sel = validSel(u.sel); log('u', `Undo · ${u.label}`); render(); }
  function redo() { const u = ST.redo.pop(); if (!u) return log('n', 'Redo · nothing to redo'); ST.undo.push({ s: snap(), sel: ST.sel, label: u.label }); const o = JSON.parse(u.s); ST.sc = o.sc; uid = o.uid; ST.sel = null; log('u', `Redo · ${u.label}`); render(); }
  function log(k, t) { ST.log.unshift({ k, t }); ST.log = ST.log.slice(0, 40); }
  const G = (id) => ST.sc.groups.find((g) => g.id === id);
  const memberOf = (mid) => { for (const g of ST.sc.groups) { const m = g.members.find((x) => x.id === mid); if (m) return { g, m }; } return null; };
  function validSel(s) { if (!s) return null; if (s.g && !G(s.g)) return null; if (s.m && !memberOf(s.m)) return s.g && G(s.g) ? { g: s.g } : null; return s; }
  const worldOf = (g, p) => { const q = rotY(p, g.yaw * DEG); return [g.piv[0] + q[0], g.piv[1] + q[1], g.piv[2] + q[2]]; };
  const nextName = (raw) => { const base = raw.replace(/ \d+$/, ''); const names = new Set(ST.sc.groups.map((g) => g.name)); if (!names.has(base)) return base; let n = 2; while (names.has(`${base} ${n}`)) n++; return `${base} ${n}`; };

  /* ------------------------------------------------------------------ candidate (the one placement session) */
  function source(arm) { return arm.src === 'fixture' ? FIXTURES.find((f) => f.id === arm.id) : ST.mine.find((x) => x.id === arm.id); }
  const lowest = (members) => Math.min(...members.map((m) => m.kind === 'light' ? m.p[1] : Math.min(...SHAPES[m.shape]().flatMap((pt) => pt.t === 'hull' ? pt.p.map((q) => q[1] + m.p[1]) : [pt.a[1] + m.p[1], pt.b[1] + m.p[1]])))) ;
  function candidate(arm, hit) {
    if (!arm || !hit) return null;
    const src = source(arm), mem = src.members;
    if (arm.src === 'fixture' && src.mount === 'ceiling') {
      if (hit.surf === 'void') return { ok: false, ghost: false, why: 'Point at the room to hang it', at: null };
      const oh = overheadAt(hit.x, hit.z), floorP = [hit.x, supportAt(hit.x, hit.z)?.y ?? 0, hit.z];
      if (!oh) return { ok: false, ghost: false, why: 'Nothing overhead to hang from here', at: floorP, code: 'no-overhead-support' };
      const piv = [hit.x, oh.y, hit.z], base = oh.y + lowest(mem), floor = supportAt(hit.x, hit.z).y;
      const c = { piv, yaw: 0, members: mem, origin: 'overhead', over: oh, floorP, tag: `Hangs from ${oh.name === 'the ceiling' ? 'the ceiling' : oh.name} · ${r2(oh.y)} m`, ok: true, ghost: true };
      if (base < floor - 1e-6) return { ...c, ok: false, why: `${src.label} would reach ${floor > 0 ? 'the ' + supportAt(hit.x, hit.z).name : 'the floor'} here`, code: 'no-support' };
      return c;
    }
    if (arm.src === 'fixture' && src.mount === 'wall') {
      if (hit.surf !== 'wall') return { ok: false, ghost: false, why: 'Point at a wall', at: hit.surf === 'void' ? null : [hit.x, hit.y, hit.z], code: 'not-a-wall' };
      const yaw = Math.atan2(hit.n[0], hit.n[2]) / DEG, piv = [hit.x, hit.y, hit.z], base = hit.y + lowest(mem);
      const c = { piv, yaw, members: mem, origin: 'wall', wall: hit.name, n: hit.n, tag: `On ${hit.name} · ${r2(hit.y)} m · faces out`, ok: true, ghost: true };
      if (base < 0) return { ...c, ok: false, why: `${src.label} would reach the floor here`, code: 'no-support' };
      return c;
    }
    // saved group: support origin, members keep their heights above the support
    if (hit.surf !== 'support') return { ok: false, ghost: false, why: 'Nothing below to stand on here', at: hit.surf === 'wall' ? [hit.x, hit.y, hit.z] : null, code: 'no-support' };
    const piv = [hit.x, hit.y, hit.z];
    const c = { piv, yaw: 0, members: mem, origin: 'support', tag: `On ${hit.name}${hit.y > 0 ? ' · ' + r2(hit.y) + ' m' : ''}`, ok: true, ghost: true };
    for (const m of mem) { if (m.kind === 'light') continue; const w = [piv[0] + m.p[0], 0, piv[2] + m.p[2]]; if (!supportAt(w[0], w[2])) return { ...c, ok: false, why: `Nothing below to stand on here · ${m.name}`, code: 'no-support' }; }
    const hi = Math.max(0, ...mem.filter((m) => m.kind !== 'light').map((m) => m.p[1]));
    if (hi > 1.5) c.tag += ` · keeps ${r2(hi)} m above it`;
    return c;
  }
  function accept() {
    const c = ST.cand, src = source(ST.arm);
    if (!c || !c.ok) { ST.relRefused = true; log('r', `Refused · ${c ? c.why : 'nothing to place on'} · no write`); return; }
    const g = { id: nid('g'), name: nextName(src.label || src.name), from: ST.arm.src, piv: c.piv.slice(), yaw: c.yaw, members: src.members.map(memberFrom) };
    commit(`place-group-copy · ${c.origin}${c.over ? ' · ' + c.over.name : c.wall ? ' · ' + c.wall : ''} → ${g.name}`, () => { ST.sc.groups.push(g); ST.sel = { g: g.id }; });
    ST.saved = {}; ST.disc = null;
  }

  /* ------------------------------------------------------------------ drawing */
  const stk = (d, col, w = 1.3, dash, op = 1) => `<path d="${d}" fill="none" stroke="${CASE}" stroke-opacity=".7" stroke-width="${w + 2.2}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const seg = (a, b) => { const p = PJ(a), q = PJ(b); return `M${r1(p[0])},${r1(p[1])}L${r1(q[0])},${r1(q[1])}`; };
  const poly3 = (ps) => pathOf(ps.map(PJ));
  function roomSVG(o = {}) {
    let s = `<defs><radialGradient id="fxPool${o.k || ''}"><stop offset="0" stop-color="#ffe0a6" stop-opacity=".75"/><stop offset=".6" stop-color="#ffd58a" stop-opacity=".28"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient></defs>`;
    s += `<path d="${poly3([[TERR.x0, 0, 0], [TERR.x1, 0, 0], [TERR.x1, 0, TERR.z1], [TERR.x0, 0, TERR.z1]])}" fill="#b9bcb0" stroke="#9fa397"/>`;
    for (let x = 6.6; x < 8.4; x += 0.6) s += `<path d="${seg([x, 0, 0], [x, 0, 4])}" stroke="#a7ab9f" stroke-width=".7"/>`;
    s += `<path d="${poly3([[0, 0, 0], [6, 0, 0], [6, 0, 4], [0, 0, 4]])}" fill="#d8cfbb" stroke="#b6ad98"/>`;
    for (let z = 0.5; z < 4; z += 0.5) s += `<path d="${seg([0, 0, z], [6, 0, z])}" stroke="#cbc1ab" stroke-width=".6"/>`;
    // walls
    s += `<path d="${poly3([[0, 0, 0], [6, 0, 0], [6, 2.8, 0], [0, 2.8, 0]])}" fill="#ece7da" stroke="#c9c2b0"/>`;
    s += `<path d="${poly3([[0, 0, 0], [0, 0, 4], [0, 2.8, 4], [0, 2.8, 0]])}" fill="#e1dacb" stroke="#c9c2b0"/>`;
    s += `<path d="${poly3([[0, 0, DOOR.z0], [0, 0, DOOR.z1], [0, DOOR.h, DOOR.z1], [0, DOOR.h, DOOR.z0]])}" fill="#5f645d"/>`;
    // dais
    const D = DAIS; s += `<path d="${poly3([[D.x0, 0, D.z1], [D.x1, 0, D.z1], [D.x1, D.h, D.z1], [D.x0, D.h, D.z1]])}" fill="#c4baa3"/><path d="${poly3([[D.x1, 0, D.z0], [D.x1, 0, D.z1], [D.x1, D.h, D.z1], [D.x1, D.h, D.z0]])}" fill="#b8ae97"/><path d="${poly3([[D.x0, D.h, D.z0], [D.x1, D.h, D.z0], [D.x1, D.h, D.z1], [D.x0, D.h, D.z1]])}" fill="#e2d9c5" stroke="#b6ad98"/>`;
    // the lid (cut away) and overhead regions, drawn as references
    s += stk(poly3([[0, 2.8, 4], [6, 2.8, 4], [6, 2.8, 0]]).replace('Z', ''), INK, 1, '4 4', 0.22);
    s += `<text x="${r1(PJ([6, 2.8, 0])[0] + 6)}" y="${r1(PJ([6, 2.8, 0])[1] + 4)}" font-size="10" font-family="ui-monospace,Menlo,monospace" fill="#3c463f">Ceiling 2.80</text>`;
    for (const r of OVER) {
      s += `<path d="${poly3([[r.x0, r.y, r.z1], [r.x1, r.y, r.z1], [r.x1, r.top, r.z1], [r.x0, r.top, r.z1]])}" fill="#efe9dc" fill-opacity=".6" stroke="#b9b09b" stroke-width=".8"/>`;
      s += `<path d="${poly3([[r.x1, r.y, r.z0], [r.x1, r.y, r.z1], [r.x1, r.top, r.z1], [r.x1, r.top, r.z0]])}" fill="#e3dccd" fill-opacity=".6" stroke="#b9b09b" stroke-width=".8"/>`;
      s += stk(poly3([[r.x0, r.y, r.z0], [r.x1, r.y, r.z0], [r.x1, r.y, r.z1], [r.x0, r.y, r.z1]]), INK, 0.9, '3 3', 0.35);
      const t = PJ([r.x1, r.y, r.z1]); s += `<text x="${r1(t[0] + 5)}" y="${r1(t[1] + 3)}" font-size="10" font-family="ui-monospace,Menlo,monospace" fill="#3c463f">${r.name} ${r2(r.y)}</text>`;
      if (r.name === 'Landing') [[r.x0 + 0.08, r.z1 - 0.08], [r.x1 - 0.08, r.z1 - 0.08]].forEach(([x, z]) => { s += `<path d="${seg([x, 0, z], [x, r.y, z])}" stroke="#a89f8a" stroke-width="2.2"/>`; });
    }
    const tt = PJ([7.2, 0, 3.6]); s += `<text x="${r1(tt[0])}" y="${r1(tt[1] + 14)}" text-anchor="middle" font-size="10" font-family="ui-monospace,Menlo,monospace" fill="#3c463f">Terrace · open sky</text>`;
    return s;
  }
  function memberSolids(g, m) {
    const out = [];
    if (m.kind === 'artwork') {
      const a = m.w / 2, b = m.h / 2, c = [m.p[0], m.p[1], m.p[2]];
      const q = [[c[0] - a, c[1] - b, c[2]], [c[0] + a, c[1] - b, c[2]], [c[0] + a, c[1] + b, c[2]], [c[0] - a, c[1] + b, c[2]]].map((p) => PJ(worldOf(g, p)));
      out.push({ t: 'hull', poly: q, fill: m.art, frame: true, depth: 0 });
      return out;
    }
    if (m.kind === 'light') return out;
    for (const pt of SHAPES[m.shape]()) {
      if (pt.t === 'hull') {
        const w = pt.p.map((q) => worldOf(g, [q[0] + m.p[0], q[1] + m.p[1], q[2] + m.p[2]]));
        const fill = pt.fill === null ? (m.finish ? FINISH[m.finish].fill : BASE[m.shape]) : pt.fill;
        out.push({ t: 'hull', poly: hull(w.map(PJ)), fill, glass: pt.glass, rim: pt.rim ? w.slice(0, w.length / 2) : null });
      } else out.push({ t: 'line', a: worldOf(g, [pt.a[0] + m.p[0], pt.a[1] + m.p[1], pt.a[2] + m.p[2]]), b: worldOf(g, [pt.b[0] + m.p[0], pt.b[1] + m.p[1], pt.b[2] + m.p[2]]), dash: pt.dash });
    }
    return out;
  }
  const depthOf = (g, m) => { const w = worldOf(g, m.p); return w[0] + w[2] + (m.kind === 'artwork' ? -9 : 0); };
  const lightW = (g, m) => worldOf(g, m.p);
  const aimW = (g, m) => rotY(m.aim || [0, -1, 0], g.yaw * DEG);
  function poolSVG(g, m, k, ghost) {
    const P0 = lightW(g, m), sup = supportAt(P0[0], P0[2]); if (!sup) return '';
    let c = [P0[0], sup.y, P0[2]], r;
    const h = Math.max(0.2, P0[1] - sup.y);
    if (m.lk === 'spot') {
      const a = aimW(g, m); if (a[1] > -0.2) return '';
      const t = h / -a[1]; c = [P0[0] + a[0] * t, sup.y, P0[2] + a[2] * t]; if (!supportAt(c[0], c[2])) return ''; r = Math.min(2.4, t * Math.tan(m.half * DEG)) * 1.15;
    } else r = Math.min(m.range, 2.6) * 0.7;
    const sc = PJ(c); return `<ellipse cx="${r1(sc[0])}" cy="${r1(sc[1])}" rx="${r1(r * S * 1.216)}" ry="${r1(r * S * 0.509)}" fill="url(#fxPool${k || ''})" opacity="${ghost ? 0.75 : 1}"/>`;
  }
  function solidSVG(sd, mode) {
    // mode: normal | ghost | refuse | ctx
    if (sd.t === 'line') { const col = mode === 'ghost' ? COBALT : mode === 'refuse' ? REFUSE : '#2a2f2b'; return stk(seg(sd.a, sd.b), col, mode === 'normal' ? 1.4 : 1.3, mode === 'normal' ? sd.dash : '4 3', mode === 'normal' ? 0.9 : 1); }
    const d = pathOf(sd.poly);
    if (mode === 'ghost') return `<path d="${d}" fill="${COBALT}" fill-opacity=".1" stroke="${COBALT}" stroke-width="1.4" stroke-dasharray="4 3" stroke-linejoin="round"/>`;
    if (mode === 'refuse') return `<path d="${d}" fill="${REFUSE}" fill-opacity=".08" stroke="${REFUSE}" stroke-width="1.4" stroke-dasharray="4 3" stroke-linejoin="round"/>`;
    let s = `<path d="${d}" fill="${sd.fill}" fill-opacity="${sd.glass ? 0.78 : 1}" stroke="rgba(31,42,36,.45)" stroke-width=".9" stroke-linejoin="round"/>`;
    if (sd.glass) { const b = sd.poly; s += `<path d="${d}" fill="#ffd98a" fill-opacity=".35"/>`; }
    if (sd.rim) s += `<path d="${pathOf(sd.rim.map(PJ))}" fill="#ffe7b0" fill-opacity=".9" stroke="rgba(31,42,36,.5)" stroke-width=".7"/>`;
    if (sd.frame) s += `<path d="${d}" fill="none" stroke="#4a3a22" stroke-width="2.2"/>`;
    return s;
  }
  const contour = (sd, col, w = 2) => sd.t === 'line' ? stk(seg(sd.a, sd.b), col, w) : `<path d="${pathOf(sd.poly)}" fill="none" stroke="${CASE}" stroke-opacity=".8" stroke-width="${w + 2.4}" stroke-linejoin="round"/><path d="${pathOf(sd.poly)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round"/>`;
  function moveTurnSVG(g) {
    const c = g.piv, a = 0.32, p = PJ(c);
    let s = stk(seg([c[0] - a, c[1], c[2]], [c[0] + a, c[1], c[2]]) + seg([c[0], c[1], c[2] - a], [c[0], c[1], c[2] + a]), FOREST, 1.6);
    const arc = []; for (let i = 0; i <= 12; i++) { const t = (-30 + i * 6) * DEG; arc.push([c[0] + Math.cos(t) * 0.55, c[1], c[2] + Math.sin(t) * 0.55]); }
    const ap = arc.map(PJ), e = ap[ap.length - 1], e2 = ap[ap.length - 2], ang = Math.atan2(e[1] - e2[1], e[0] - e2[0]);
    s += stk(ap.map((q, i) => (i ? 'L' : 'M') + r1(q[0]) + ',' + r1(q[1])).join(''), FOREST, 1.6);
    s += `<path d="M${r1(e[0])},${r1(e[1])} l${r1(Math.cos(ang + 2.6) * 7)},${r1(Math.sin(ang + 2.6) * 7)} M${r1(e[0])},${r1(e[1])} l${r1(Math.cos(ang - 2.6) * 7)},${r1(Math.sin(ang - 2.6) * 7)}" stroke="${FOREST}" stroke-width="1.6" stroke-linecap="round"/>`;
    s += `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="3" fill="#fff" stroke="${FOREST}" stroke-width="1.4"/>`;
    return s;
  }
  function spotRays(g, m, col, dash) {
    const P0 = lightW(g, m), a = aimW(g, m), sup = supportAt(P0[0], P0[2]); if (!sup || a[1] > -0.2) return '';
    const t = (P0[1] - sup.y) / -a[1], T = [P0[0] + a[0] * t, sup.y, P0[2] + a[2] * t], r = t * Math.tan(m.half * DEG);
    const rg = ring(T[0], T[1], T[2], r, 36).map(PJ), b = PJ(P0);
    let li = 0, ri = 0; rg.forEach((q, i) => { if (q[0] < rg[li][0]) li = i; if (q[0] > rg[ri][0]) ri = i; });
    return stk(`M${r1(rg[li][0])},${r1(rg[li][1])}L${r1(b[0])},${r1(b[1])}L${r1(rg[ri][0])},${r1(rg[ri][1])}`, col, 1.1, dash, 0.8) + stk(pathOf(rg), col, 1, dash || '4 4', 0.55);
  }
  const glyphDir = (g, m) => { const a = aimW(g, m), p = PJ(lightW(g, m)), q = PJ([lightW(g, m)[0] + a[0], lightW(g, m)[1] + a[1], lightW(g, m)[2] + a[2]]); return [q[0] - p[0], q[1] - p[1]]; };

  /* a tag that stays inside the 640-wide stage: flips left near the right edge */
  const tag = (p, text, o = {}) => { const w = text.length * 6.15 + 12; let dx = o.dx ?? 12; if (p[0] + dx + w > 632) dx = -w - Math.abs(dx); if (p[0] + dx < 6) dx = 6 - p[0]; const dy = Math.max(o.dy ?? -12, 16 - p[1]); return label(p, text, { ...o, dx, dy }); };
  /* draw the whole stage for a given view state; returns { svg, picks } */
  function stageSVG(V, k) {
    let s = roomSVG({ k });
    const picks = [];
    const items = [];
    V.sc.groups.forEach((g) => g.members.forEach((m) => items.push({ g, m, d: depthOf(g, m) })));
    items.sort((a, b) => a.d - b.d);
    // light pools first, under everything
    V.sc.groups.forEach((g) => g.members.forEach((m) => { if (m.kind === 'light') s += poolSVG(g, m, k); }));
    const ghostG = V.cand && V.cand.ghost ? { piv: V.cand.piv, yaw: V.cand.yaw, members: V.cand.members } : null;
    if (ghostG && V.cand.ok) ghostG.members.forEach((m) => { if (m.kind === 'light') s += poolSVG(ghostG, m, k, true); });
    const sel = V.sel, hov = V.hover;
    for (const it of items) {
      const sds = memberSolids(it.g, it.m);
      sds.forEach((sd) => { s += solidSVG(sd, 'normal'); });
      if (sds.length) picks.push({ g: it.g.id, m: it.m.id, polys: sds.filter((x) => x.t === 'hull').map((x) => x.poly) });
    }
    // selection and hover marks
    const markGroup = (gid, col) => { const g = V.sc.groups.find((x) => x.id === gid); if (!g) return ''; let o = ''; g.members.forEach((m) => memberSolids(g, m).forEach((sd) => { o += contour(sd, col, col === GOLD ? 2 : 1.6); })); return o; };
    if (hov && !V.arm) {
      if (hov.m && !(sel && sel.m === hov.m)) { const r = V.sc.groups.find((g) => g.id === hov.g), m = r && r.members.find((x) => x.id === hov.m); if (m) memberSolids(r, m).forEach((sd) => { s += contour(sd, LEAF, 1.6); }); }
      else if (!hov.m && !(sel && sel.g === hov.g && !sel.m)) s += markGroup(hov.g, LEAF);
    }
    if (sel && !sel.m) { s += markGroup(sel.g, GOLD); const g = V.sc.groups.find((x) => x.id === sel.g); if (g) s += moveTurnSVG(g); }
    if (sel && sel.m) {
      const g = V.sc.groups.find((x) => x.id === sel.g), m = g && g.members.find((x) => x.id === sel.m);
      if (m) {
        g.members.forEach((o) => { if (o.id !== m.id) memberSolids(g, o).forEach((sd) => { s += contour(sd, INK, 1).replace(/stroke="#1f2a24"/, 'stroke="#1f2a24" stroke-opacity=".35" stroke-dasharray="3 3"'); }); });
        memberSolids(g, m).forEach((sd) => { s += contour(sd, GOLD, 2); });
        if (m.kind === 'light' && m.lk === 'spot') s += spotRays(g, m, INK);
      }
    }
    // emitters: shown when Lights/placement is armed, the group is hovered or selected, or the light is selected
    for (const it of items) {
      if (it.m.kind !== 'light') continue;
      const gsel = sel && sel.g === it.g.id, msel = sel && sel.m === it.m.id, ghov = hov && hov.g === it.g.id;
      if (!(V.arm || gsel || ghov || V.showAll)) { picks.push({ g: it.g.id, m: it.m.id, pt: PJ(lightW(it.g, it.m)), r: 10, hidden: true }); continue; }
      const p = PJ(lightW(it.g, it.m));
      s += emitter(p[0], p[1], it.m.lk, { sel: msel, hover: hov && hov.m === it.m.id && !msel, lens: hex(warmthColor(it.m.warm)), dir: glyphDir(it.g, it.m), sc: msel ? 1 : 0.82 });
      picks.push({ g: it.g.id, m: it.m.id, pt: p, r: 12 });
    }
    // the ghost
    const C = V.cand;
    if (C) {
      const mode = C.ok ? 'ghost' : 'refuse', col = C.ok ? COBALT : REFUSE;
      if (C.ghost) {
        const gg = ghostG;
        if (C.origin === 'overhead') {
          s += stk(seg([C.piv[0], C.piv[1], C.piv[2]], C.floorP), col, 1, '2 4', 0.75);
          const cr = ring(C.piv[0], C.piv[1], C.piv[2], 0.16, 20).map(PJ); s += `<path d="${pathOf(cr)}" fill="${col}" fill-opacity=".12" stroke="${col}" stroke-width="1.2"/>`;
          const fp = PJ(C.floorP); s += `<path d="M${r1(fp[0] - 5)},${r1(fp[1])}h10M${r1(fp[0])},${r1(fp[1] - 3)}v6" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/>`;
        }
        if (C.origin === 'wall') {
          const n = C.n, b = C.piv, q = [b[0] + n[0] * 0.55, b[1], b[2] + n[2] * 0.55];
          s += stk(seg(b, q), col, 1, '3 3', 0.8);
          const t = n[0] ? [0, 0, 1] : [1, 0, 0]; s += stk(seg([b[0] - t[0] * 0.5, b[1], b[2] - t[2] * 0.5], [b[0] + t[0] * 0.5, b[1], b[2] + t[2] * 0.5]), col, 1, '2 3', 0.6);
        }
        if (C.origin === 'support') { const fp = PJ(C.piv); s += `<ellipse cx="${r1(fp[0])}" cy="${r1(fp[1])}" rx="9" ry="4" fill="${col}" fill-opacity=".16" stroke="${col}" stroke-width="1.2"/>`; }
        const ms = gg.members.slice().sort((a, b) => depthOf(gg, a) - depthOf(gg, b));
        ms.forEach((m) => memberSolids(gg, m).forEach((sd) => { s += solidSVG(sd, mode); }));
        ms.forEach((m) => { if (m.kind !== 'light') return; if (m.lk === 'spot' && C.ok) s += spotRays(gg, m, COBALT, '4 3'); const p = PJ(lightW(gg, m)); s += emitter(p[0], p[1], m.lk, { col, lens: hex(warmthColor(m.warm)), dir: glyphDir(gg, m), armed: true }); });
        const tp = PJ(C.piv);
        s += tag(tp, C.ok ? C.tag : C.why, { dx: 14, dy: C.origin === 'overhead' ? -8 : -16, bg: C.ok ? FOREST : REFUSE });
      } else {
        if (C.at) { const fp = PJ(C.at); s += `<path d="M${r1(fp[0] - 6)},${r1(fp[1] - 6)}l12,12M${r1(fp[0] + 6)},${r1(fp[1] - 6)}l-12,12" stroke="${REFUSE}" stroke-width="1.6" stroke-linecap="round"/>`; s += tag(fp, C.why, { dx: 12, dy: -12, bg: REFUSE }); }
        else if (V.ptr) s += tag(V.ptr, C.why, { dx: 12, dy: -12, bg: REFUSE });
      }
    }
    return { svg: s, picks };
  }
  function hitPick(picks, pt) {
    for (let i = picks.length - 1; i >= 0; i--) { const p = picks[i]; if (p.pt && Math.hypot(pt[0] - p.pt[0], pt[1] - p.pt[1]) <= p.r) return p; }
    for (let i = picks.length - 1; i >= 0; i--) { const p = picks[i]; if (p.polys && p.polys.some((q) => inPoly(pt, q))) return p; }
    return null;
  }

  /* ------------------------------------------------------------------ tiles */
  function fixtureThumb(f, k) {
    // A mock of the pre-rendered tile: derived at ingestion with a fixed camera and light, pinned in the record.
    const id = 'fxT' + k;
    let s = `<svg viewBox="0 0 120 72" aria-hidden="true"><defs><radialGradient id="${id}" cx=".5" cy=".7" r=".8"><stop offset="0" stop-color="#fbf1dc"/><stop offset="1" stop-color="#e4ddcf"/></radialGradient><radialGradient id="${id}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe3a3" stop-opacity=".95"/><stop offset="1" stop-color="#ffe3a3" stop-opacity="0"/></radialGradient></defs><rect width="120" height="72" fill="url(#${id})"/>`;
    if (f.mount === 'wall') s += `<rect x="0" y="0" width="120" height="72" fill="#e9e3d6"/><path d="M0 60H120" stroke="#d6cfbf"/>`;
    else s += `<path d="M0 6H120" stroke="#d1c9b8" stroke-width="2"/>`;
    if (f.members[0].shape === 'lamp') s += `<rect x="55" y="5" width="10" height="3" rx="1" fill="#2f3430"/><path d="M60 8V34" stroke="#2f3430" stroke-width="1.4"/><path d="M57 34h6l12 18H45Z" fill="#3a403b"/><ellipse cx="60" cy="52" rx="15" ry="3" fill="#ffe7b0" stroke="#2f3430" stroke-width=".8"/><ellipse cx="60" cy="62" rx="34" ry="8" fill="url(#${id}g)"/>`;
    if (f.members[0].shape === 'lantern') s += `<rect x="56" y="5" width="8" height="3" rx="1" fill="#2f3430"/><path d="M60 8V22" stroke="#2f3430" stroke-width="1.2" stroke-dasharray="2 1.5"/><path d="M54 22h12l3 5H51Z" fill="#2f3430"/><rect x="50" y="27" width="20" height="30" fill="#ffe3a3" fill-opacity=".9" stroke="#2f3430" stroke-width="1.4"/><path d="M60 27v30M50 42h20" stroke="#2f3430" stroke-width=".9"/><rect x="55" y="57" width="10" height="5" fill="#2f3430"/><circle cx="60" cy="42" r="22" fill="url(#${id}g)" opacity=".7"/>`;
    if (f.members[0].shape === 'sconce') s += `<rect x="54" y="20" width="12" height="26" rx="2" fill="#2f3430"/><path d="M60 33q8-2 14-8" stroke="#2f3430" stroke-width="2" fill="none"/><path d="M68 25h12l-2 16H70Z" fill="#3a403b"/><ellipse cx="74" cy="41" rx="4" ry="1.6" fill="#ffe7b0"/><circle cx="74" cy="48" r="20" fill="url(#${id}g)" opacity=".8"/>`;
    return s + '</svg>';
  }
  const GROUPMARK = (px = 26) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="7.5" y="3.5" width="12" height="12" rx="2"/><rect x="4.5" y="8.5" width="12" height="12" rx="2" fill="#fff"/></svg>`;
  const FORMMARK = (px = 26) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M5 20V10a7 7 0 0 1 14 0v10Z"/><path d="M3 20h18"/></svg>`;
  const mineLine = (x) => x.kind === 'form' ? 'Form · Ready to place' : x.fmt !== 1 ? 'Earlier version' : `Group · ${x.members.length} items`;
  function tileHTML(kind, x, i, pressed) {
    if (kind === 'fixture') return `<button class="fx-tile" data-arm="fixture:${x.id}" aria-pressed="${pressed}" title="${esc(x.label)} · ${x.mountLine} · ${x.light}"><span class="im">${fixtureThumb(x, i)}</span><span class="nm">${esc(x.label)}</span><span class="mt">${x.mountLine}</span></button>`;
    const old = x.fmt !== 1, isNew = ST.flash === x.id;
    return `<button class="fx-tile glyph${old ? ' old' : ''}${isNew ? ' flash' : ''}" data-arm="${x.kind === 'form' ? 'form' : old ? 'old' : 'saved'}:${x.id}" aria-pressed="${pressed}" title="${esc(x.name)}"><span class="im">${x.kind === 'form' ? FORMMARK() : GROUPMARK()}</span><span class="nm">${esc(x.name)}</span><span class="mt">${mineLine(x)}</span>${x.fresh ? '<span class="new">New</span>' : ''}</button>`;
  }
  const RAIL = [['objects', 'Objects', '<path d="M4 8l8-4 8 4-8 4Z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/>'], ['finishes', 'Finishes', '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5 17.5 6.5"/>'], ['lights', 'Lights', '<circle cx="12" cy="10" r="4"/><path d="M10 17h4M10.5 20h3M12 2v2M4.5 10H3M21 10h-1.5"/>'], ['mine', 'My objects', '<rect x="7.5" y="3.5" width="12" height="12" rx="2"/><rect x="4.5" y="8.5" width="12" height="12" rx="2"/>'], ['plants', 'Plants', '<path d="M12 21V11M12 11c0-4 3-7 7-7 0 4-3 7-7 7ZM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z"/>']];
  function libHTML() {
    const armK = ST.arm ? `${ST.arm.src}:${ST.arm.id}` : ST.picked;
    let h = `<div class="lh"><b>Library</b><span>World · Furnish</span></div><div class="lb"><div class="fx-rail" role="group" aria-label="Library kinds">`;
    h += RAIL.map(([k, l, d]) => `<button data-lib="${k}" aria-pressed="${ST.lib === k}"${k === 'objects' || k === 'finishes' || k === 'plants' ? ' disabled title="Not part of this study"' : ''}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>${l}</button>`).join('');
    h += `</div><div class="fx-shelf">`;
    if (ST.lib === 'lights') {
      h += `<h5>Lights</h5><div class="fx-tiles">${['point', 'spot'].map((k) => `<button class="fx-tile glyph" data-arm="light:${k}" aria-pressed="false" title="§5 places Point and Spot"><span class="im">${icon(k, 26)}</span><span class="nm">${k === 'point' ? 'Point' : 'Spot'}</span><span class="mt">Light only</span></button>`).join('')}</div>`;
      if (ST.ships) h += `<h5>Fixtures <i>${FIXTURES.length}</i></h5><div class="fx-tiles list">${FIXTURES.map((f, i) => tileHTML('fixture', f, i, armK === `fixture:${f.id}`)).join('')}</div>`;
      else h += `<div class="fx-absent">No Fixtures row: this build ships no qualified fixture (D18). Nothing is greyed or promised.</div>`;
    } else {
      h += `<h5>My objects <i>${ST.mine.length}</i></h5><div class="fx-tiles list">${ST.mine.map((x, i) => tileHTML('mine', x, i, armK === `saved:${x.id}` || armK === `old:${x.id}` || armK === `form:${x.id}`)).join('')}</div>`;
      const pk = ST.picked && ST.picked.split(':'), it = pk && ST.mine.find((x) => x.id === pk[1]);
      if (pk && pk[0] === 'old' && it) h += `<div class="fx-oldnote" role="status"><span>Made with an earlier development version; remove it or save it again.</span><div class="acts"><button data-act="lib-remove" data-id="${it.id}">Remove</button></div></div>`;
      if (pk && pk[0] === 'form' && it) h += `<div class="fx-oldnote" role="status"><span>${esc(it.name)} is a form: it places through the existing form flow, unchanged by D8.</span></div>`;
    }
    return h + '</div></div>';
  }

  /* ------------------------------------------------------------------ Cards */
  const kindIcon = (m) => m.kind === 'light' ? icon(m.lk, 16) : m.kind === 'artwork' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="16" height="13" rx="1"/><path d="m6 16 4-5 3 3 2-2 3 4"/></svg>' : m.kind === 'model' ? icon('fixture', 16) : FORMMARK(16);
  const KINDN = { light: 'Light', artwork: 'Artwork', model: 'Model', form: 'Form', prim: 'Primitive', plane: 'Plane', imported: 'Imported model' };
  /* eligibility in the order a creator reads it (§7.4): the first reason is shown */
  function eligibility(g) {
    if (g.members.length > 64) return { ok: false, why: 'Groups of more than 64 items cannot be saved.' };
    for (const m of g.members) {
      if (m.kind === 'artwork') return { ok: false, why: 'Artwork stays in this project', who: m.name };
      if (m.kind === 'imported') return { ok: false, why: 'Imported models stay in this project', who: m.name };
      if (m.kind === 'plane') return { ok: false, why: 'Planes cannot be saved in a group', who: m.name };
      if (m.kind === 'model' && !m.contact) return { ok: false, why: `${m.name} cannot be saved yet`, who: m.name };
    }
    const fin = g.members.filter((m) => m.finish && FINISH[m.finish].project);
    return { ok: true, finishes: fin.map((m) => `${m.name} · ${FINISH[m.finish].name}`) };
  }
  function saveRowHTML(g, ui) {
    const e = eligibility(g), st = ui.saved && ui.saved[g.id];
    if (st) return `<div class="fx-save"><div class="fx-ok">✓ Saved to My Objects as “${esc(st)}” <button class="linkb" data-act="show-mine">Show</button></div><div class="fx-hint">No Undo step and no unsaved change: the project did not change.</div></div>`;
    if (!e.ok) return `<div class="fx-save"><button class="fx-savebtn" disabled aria-describedby="fxwhy-${g.id}">${BOOK}Save to My Objects</button><div class="fx-why" id="fxwhy-${g.id}">${esc(e.why)}${e.who && !e.why.startsWith(e.who) ? ` · ${esc(e.who)}` : ''}</div></div>`;
    if (ui.disc === g.id) return `<div class="fx-save"><div class="fx-disc" role="group" aria-label="Save to My Objects?"><p>Finishes stay in this project; the copy uses each object's base material.</p><ul>${e.finishes.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><div class="acts"><button class="pri" data-act="save-go">Save</button><button data-act="save-cancel">Cancel</button></div></div></div>`;
    return `<div class="fx-save"><button class="fx-savebtn" data-act="save">${BOOK}Save to My Objects</button>${e.finishes.length ? `<div class="fx-hint">${e.finishes.length === 1 ? 'One Finish stays' : e.finishes.length + ' Finishes stay'} in this project</div>` : ''}</div>`;
  }
  const BOOK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4Z"/></svg>';
  const FRAME = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
  const DOTS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>';
  function dotsMenu() { return `<div class="fx-menu" role="menu"><div class="mh">View</div><button role="menuitem" disabled>Face this<span class="soon">Soon</span></button><hr><button role="menuitem" class="erase" data-act="erase">Erase <span class="soon">⌫</span></button></div>`; }
  function groupCardHTML(g, ui = {}) {
    const name = ui.renaming ? `<input data-act="name" value="${esc(g.name)}" aria-label="Group name" maxlength="80">` : esc(g.name);
    let h = `<div class="card" data-card="group"><div class="ch"><div class="kind">${GROUPMARK(20)}</div><div class="grow"><div class="k">Group · ${g.members.length} items</div><div class="t" data-act="rename" tabindex="0" role="button" title="Double-click to rename">${name}</div></div><button class="fx-ib" data-act="dots" aria-label="Functions" aria-haspopup="menu" aria-expanded="${ui.menu === 'dots'}">${DOTS}</button></div>`;
    h += `<div class="fx-mrows">${g.members.map((m) => { const bad = ['artwork', 'imported', 'plane'].includes(m.kind) || (m.kind === 'model' && !m.contact); return `<button class="fx-mrow${bad ? ' bad' : ''}" data-sel="${g.id}:${m.id}" title="Select ${esc(m.name)} in ${esc(g.name)}">${kindIcon(m)}<span class="nm">${esc(m.name)}</span><span class="kd">${m.kind === 'light' ? (m.lk === 'spot' ? 'Spot light' : 'Point light') : KINDN[m.kind]}</span><span class="go" aria-hidden="true">›</span></button>`; }).join('')}</div>`;
    h += saveRowHTML(g, ui);
    const lit = g.members.some((m) => m.kind !== 'light');
    h += `<div class="foot"><button class="ico" aria-label="Bring into view" title="Bring into view">${FRAME}</button>${lit ? '<span class="split"><button title="G1 Light it, unchanged">Light it</button><button aria-label="Light it options" aria-expanded="false">⌄</button></span>' : ''}<button data-act="dup">Duplicate</button><button data-act="ungroup">Ungroup</button></div></div>`;
    return `<div class="fx-cardwrap">${h}${ui.menu === 'dots' ? dotsMenu() : ''}</div>`;
  }
  function bodyCardHTML(g, m) {
    const dims = { lamp: '0.42 × 0.42 × 0.86 m', lantern: '0.32 × 0.32 × 1.30 m', sconce: '0.17 × 0.32 × 0.34 m', chair: '0.78 × 0.80 × 0.90 m', table: '0.48 × 0.48 × 0.56 m', plinth: '0.50 × 0.50 × 1.00 m' }[m.shape] || '';
    const look = m.kind === 'model' ? "Model's own" : m.finish ? FINISH[m.finish].name + ' · project Finish' : 'Base material';
    let h = `<div class="card" data-card="member"><div class="ch"><div class="kind">${m.kind === 'artwork' ? kindIcon(m) : m.kind === 'model' ? icon('fixture', 20) : FORMMARK(20)}</div><div class="grow"><div class="k">${KINDN[m.kind]} · in <button class="ctx" data-act="up">${esc(g.name)}</button></div><div class="t">${esc(m.name)}</div></div><button class="fx-ib" aria-label="Functions">${DOTS}</button></div>`;
    h += `<div class="fx-rows"><div class="cr"><div class="cr-top"><label>Look</label><span class="rv">${look}</span></div></div>${dims ? `<div class="cr"><div class="cr-top"><label>Size</label><span class="rv">${dims}</span></div></div>` : ''}${m.kind === 'model' ? '<div class="cr"><div class="cr-top"><label>Shadow</label><span class="rv">Off · a fixture body never shades its light</span></div></div>' : ''}</div>`;
    if (m.kind === 'model' && g.from === 'fixture') h += `<div class="fx-note">Re-aiming the light leaves this body where it is. Turn the group to turn both.</div>`;
    h += `<div class="foot"><button class="ico" aria-label="Bring into view">${FRAME}</button><span class="split"><button>Light it</button><button aria-label="Light it options">⌄</button></span><button>Duplicate</button><span class="push"></span><button>More ⌄</button></div></div>`;
    return `<div class="fx-cardwrap">${h}</div>`;
  }
  function lightFor(m) {
    const c = warmthColor(m.warm);
    return { kind: m.lk, name: m.name, I: m.I, color: c, half: m.half || 20, pen: m.pen ?? 0.4, range: m.lk === 'point' ? m.range : null, shadow: !!m.shadow, aim: m.aim || [0, -1, 0], ui: mkUI(c), commits: 0, last: '—', preview: false };
  }
  let lcN = 0;
  function mountLightCard(host, g, m) {
    const L = lightFor(m);
    const px = 'fx' + (++lcN) + '-';
    host.innerHTML = `<div class="fx-cardwrap"><div class="card" data-card="light">${cardHTML(L).replace(/(id|for|aria-labelledby)="(spot|point)-/g, `$1="${px}$2-`)}</div></div>`;
    const card = host.querySelector('.card');
    const k = card.querySelector('.ch .k'); if (k) k.innerHTML = `${m.lk === 'spot' ? 'Spot light' : 'Point light'} · in <button class="ctx" data-act="up">${esc(g.name)}</button>`;
    card.querySelectorAll('input[type=range]').forEach(fillRange);
    if (m.lk === 'spot') { try { syncBeam(card, L); } catch (e) { /* the beam diagram is optional here */ } }
    card.querySelectorAll('input,button.switch,[data-act=picker],.bs-th,.bs-n,.wbtn,.mseg button').forEach((el) => { el.setAttribute('tabindex', '-1'); el.setAttribute('aria-disabled', 'true'); el.style.pointerEvents = 'none'; });
    const note = document.createElement('div'); note.className = 'fx-note'; note.style.paddingTop = '6px';
    note.textContent = 'The ordinary Light Card from §3, unchanged. It is display-only in this specimen; edit it in §3.';
    card.insertBefore(note, card.querySelector('.foot'));
  }

  /* ------------------------------------------------------------------ live journey */
  const ui = () => ({ saved: ST.saved, disc: ST.disc, menu: ST.menu, renaming: ST.renaming });
  let picks = [];
  function render() {
    const stageEl = $id('fxStage'), svg = $id('fxSvg');
    const out = stageSVG({ sc: ST.sc, sel: ST.sel, hover: ST.hover, arm: ST.arm, cand: ST.cand, ptr: ST.ptr }, 'L');
    svg.innerHTML = out.svg; picks = out.picks;
    stageEl.classList.toggle('armed', !!ST.arm);
    const chip = $id('fxChip');
    if (ST.arm) { const s = source(ST.arm); chip.hidden = false; chip.innerHTML = `<b>Placing ${esc(s.label || s.name)}</b><span>${ST.arm.src === 'fixture' ? (s.mount === 'wall' ? 'Point at a wall' : 'Hangs from what is overhead') : 'Stands on what is below'} · Click to place · Esc cancels</span><button data-act="cancel-arm">Cancel</button>`; }
    else chip.hidden = true;
    $id('fxLib').innerHTML = libHTML();
    renderCard();
    $id('fxUndo').disabled = !ST.undo.length; $id('fxRedo').disabled = !ST.redo.length;
    $id('fxHist').textContent = `History ${ST.undo.length}`;
    $id('fxLog').innerHTML = ST.log.length ? ST.log.map((l) => `<div class="${l.k}">${l.k === 'w' ? '● write' : l.k === 'r' ? '× refused' : l.k === 'u' ? '↶ history' : '○ no write'} · ${esc(l.t)}</div>`).join('') : '<div class="n">Choose a fixture in Lights, or a group in My objects.</div>';
  }
  function renderCard() {
    const host = $id('fxCard'); const s = ST.sel;
    if (!s) { host.innerHTML = `<div class="fx-empty">${ST.arm ? 'Placement is armed. The Card shows the new group once it is placed.' : 'Nothing selected. Click a subject: the first click selects its group, a second click its member.'}</div>`; return; }
    const g = G(s.g); if (!g) { host.innerHTML = ''; return; }
    if (!s.m) { host.innerHTML = groupCardHTML(g, ui()); if (ST.renaming) { const i = host.querySelector('input[data-act=name]'); i.focus(); i.select(); } return; }
    const m = g.members.find((x) => x.id === s.m);
    if (m.kind === 'light') mountLightCard(host, g, m); else host.innerHTML = bodyCardHTML(g, m);
  }
  function svgPt(e) { const svg = $id('fxSvg'), r = svg.getBoundingClientRect(); const vb = svg.viewBox.baseVal; return [(e.clientX - r.left) / r.width * vb.width, (e.clientY - r.top) / r.height * vb.height]; }
  function arm(src, id) {
    if (src === 'light') { log('n', `${id === 'point' ? 'Point' : 'Spot'} places through §5 · not driven here`); render(); return; }
    if (src === 'old' || src === 'form') { ST.arm = null; ST.cand = null; ST.picked = `${src}:${id}`; if (src === 'old') log('r', 'Showcase · unsupported_format_version · Remove only'); render(); return; }
    ST.arm = { src, id }; ST.picked = null; ST.cand = null; ST.relRefused = false; ST.menu = null; ST.disc = null;
    const s = source(ST.arm); log('n', `Armed · ${s.label || s.name} · ${src === 'fixture' ? (s.mount === 'wall' ? 'wall' : 'overhead') : 'support'} origin`);
    render();
  }
  function escStep() {
    if (ST.renaming) { ST.renaming = false; return render(); }
    if (ST.menu || ST.disc) { ST.menu = null; ST.disc = null; return render(); }
    if (ST.arm) { ST.press = false; log('n', `Esc · placement cancelled · no write`); ST.arm = null; ST.cand = null; return render(); }
    if (ST.sel && ST.sel.m) { ST.sel = { g: ST.sel.g }; log('n', 'Esc · member → group'); return render(); }
    if (ST.sel) { ST.sel = null; log('n', 'Esc · selection cleared'); return render(); }
  }
  function select(p) {
    ST.menu = null; ST.disc = null; ST.renaming = false;
    if (!p) { if (ST.sel) log('n', 'Selection cleared'); ST.sel = null; return; }
    const s = ST.sel;
    if (s && s.g === p.g) { ST.sel = { g: p.g, m: p.m }; const mm = memberOf(p.m); log('n', `Drill · ${mm.m.name} in ${mm.g.name}`); }
    else { ST.sel = { g: p.g }; log('n', `Select group · ${G(p.g).name}`); }
  }
  function wireLive() {
    const svg = $id('fxSvg'), app = $id('fxApp');
    svg.addEventListener('pointermove', (e) => {
      const pt = svgPt(e); ST.ptr = pt;
      if (ST.arm) { ST.cand = candidate(ST.arm, pick(pt[0], pt[1])); ST.relRefused = false; }
      else { const h = hitPick(picks, pt); const s = ST.sel; ST.hover = h ? (s && s.g === h.g ? { g: h.g, m: h.m } : { g: h.g }) : null; }
      render();
    });
    svg.addEventListener('pointerleave', () => { ST.hover = null; if (ST.arm && !ST.press) ST.cand = null; ST.ptr = null; render(); });
    svg.addEventListener('pointerdown', (e) => {
      app.focus({ preventScroll: true });
      const pt = svgPt(e); ST.ptr = pt;
      if (ST.arm) { ST.press = true; svg.setPointerCapture(e.pointerId); ST.cand = candidate(ST.arm, pick(pt[0], pt[1])); render(); }
    });
    svg.addEventListener('pointerup', (e) => {
      const pt = svgPt(e);
      if (ST.arm && ST.press) { ST.press = false; ST.cand = candidate(ST.arm, pick(pt[0], pt[1])); accept(); render(); return; }
      if (!ST.arm) { select(hitPick(picks, pt)); render(); }
    });
    svg.addEventListener('pointercancel', () => { ST.press = false; });
    app.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); escStep(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.key === 'Backspace' || e.key === 'Delete') && ST.sel && !ST.renaming && e.target.tagName !== 'INPUT') { e.preventDefault(); erase(); }
    });
    app.addEventListener('click', (e) => {
      const b = e.target.closest('[data-arm],[data-lib],[data-act],[data-sel]'); if (!b || b.disabled) return;
      if (b.dataset.arm) { const [src, id] = b.dataset.arm.split(':'); if (ST.arm && ST.arm.src === src && ST.arm.id === id) { escStep(); return; } return arm(src, id); }
      if (b.dataset.lib) { ST.lib = b.dataset.lib; ST.picked = null; return render(); }
      if (b.dataset.sel) { const [g, m] = b.dataset.sel.split(':'); ST.sel = { g, m }; ST.menu = null; log('n', `Drill from the Card · ${memberOf(m).m.name}`); return render(); }
      const a = b.dataset.act;
      if (a === 'cancel-arm') return escStep();
      if (a === 'up') { ST.sel = { g: ST.sel.g }; log('n', 'Up to the group'); return render(); }
      if (a === 'dots') { ST.menu = ST.menu === 'dots' ? null : 'dots'; return render(); }
      if (a === 'erase') return erase();
      if (a === 'dup') return duplicate();
      if (a === 'ungroup') return ungroup();
      if (a === 'save') { const g = G(ST.sel.g), el = eligibility(g); if (el.finishes.length) { ST.disc = g.id; log('n', 'Save · Finish disclosure shown · nothing written yet'); return render(); } return doSave(g); }
      if (a === 'save-go') return doSave(G(ST.sel.g));
      if (a === 'save-cancel') { ST.disc = null; log('n', 'Save cancelled · no item'); return render(); }
      if (a === 'show-mine') { ST.lib = 'mine'; return render(); }
      if (a === 'lib-remove') { const id = b.dataset.id, it = ST.mine.find((x) => x.id === id); ST.mine = ST.mine.filter((x) => x.id !== id); ST.picked = null; log('n', `Removed ${it.name} from My objects · Library only, no project write`); return render(); }
      if (a === 'ships') return;
    });
    app.addEventListener('dblclick', (e) => { if (e.target.closest('[data-act=rename]')) { ST.renaming = true; render(); } });
    app.addEventListener('keydown', (e) => {
      const i = e.target.closest && e.target.closest('input[data-act=name]');
      if (i && e.key === 'Enter') { const g = G(ST.sel.g), v = i.value.trim() || g.name; if (v !== g.name) commit(`Rename group → ${v}`, () => { g.name = v; }); ST.renaming = false; render(); }
      if (!i && e.key === 'Enter' && e.target.closest && e.target.closest('[data-act=rename]')) { ST.renaming = true; render(); }
    });
    $id('fxUndo').addEventListener('click', undo); $id('fxRedo').addEventListener('click', redo);
    $id('fxEsc').addEventListener('click', () => { escStep(); });
    $id('fxReset').addEventListener('click', () => { ST.sc = seed(); ST.sel = null; ST.arm = null; ST.cand = null; ST.undo = []; ST.redo = []; ST.saved = {}; ST.disc = null; ST.mine = MINE.map((x) => ({ ...x })); ST.log = []; ST.picked = null; render(); });
    onSegFx('fxShips', (v) => { ST.ships = v === 'yes'; if (!ST.ships && ST.arm && ST.arm.src === 'fixture') { ST.arm = null; ST.cand = null; } render(); });
    onSegFx('fxDup', (v) => { ST.dupMode = v; render(); });
  }
  function onSegFx(id, fn) { const seg = $id(id); seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); fn(b.dataset.v); }); }
  function doSave(g) {
    const e = eligibility(g); if (!e.ok) return;
    const nm = g.name, item = { id: nid('lib'), kind: 'group', name: nm, fmt: 1, note: 'Saved just now', fresh: true, members: g.members.map((m) => { const o = JSON.parse(JSON.stringify(m)); delete o.id; delete o.finish; const w = rotY(o.p, g.yaw * DEG); const sup = supportAt(g.piv[0], g.piv[2]); o.p = [w[0], g.piv[1] - (sup ? sup.y : 0) + w[1], w[2]]; if (o.aim) o.aim = rotY(o.aim, g.yaw * DEG); return o; }) };
    ST.mine = [item, ...ST.mine.map((x) => ({ ...x, fresh: false }))]; ST.saved = { [g.id]: nm }; ST.disc = null; ST.flash = item.id;
    log('n', `Saved “${nm}” to My objects · no revision, no Undo step, no unsaved change${e.finishes.length ? ' · Finish dropped' : ''}`);
    render(); setTimeout(() => { ST.flash = null; }, 1300);
  }
  function duplicate() {
    const g = G(ST.sel.g); if (!g) return;
    const off = ST.dupMode === 'g1' ? [0.5, 0, 0.5] : rotY([0.5, 0, 0], g.yaw * DEG);
    const c = { id: nid('g'), name: nextName(g.name), from: g.from, piv: [g.piv[0] + off[0], g.piv[1], g.piv[2] + off[2]], yaw: g.yaw, members: g.members.map((m) => ({ ...JSON.parse(JSON.stringify(m)), id: nid('m') })) };
    commit(`Duplicate → ${c.name} (${ST.dupMode === 'g1' ? '+0.5 m X/Z' : '+0.5 m along its own X'})`, () => { ST.sc.groups.push(c); ST.sel = { g: c.id }; ST.saved = {}; });
    render();
  }
  function ungroup() {
    const g = G(ST.sel.g); if (!g) return;
    commit(`Ungroup ${g.name} → ${g.members.length} ordinary subjects`, () => {
      ST.sc.groups = ST.sc.groups.filter((x) => x.id !== g.id);
      g.members.forEach((m) => { ST.sc.groups.push({ id: nid('u'), name: m.name, from: 'loose', loose: true, piv: g.piv.slice(), yaw: g.yaw, members: [m] }); });
      ST.sel = null;
    });
    render();
  }
  function erase() {
    const s = ST.sel; if (!s) return; const g = G(s.g); if (!g) return;
    if (!s.m || g.members.length <= 1) commit(`Erase ${g.name} and its ${g.members.length} items`, () => { ST.sc.groups = ST.sc.groups.filter((x) => x.id !== g.id); ST.sel = null; });
    else { const m = g.members.find((x) => x.id === s.m); commit(`Erase ${m.name} from ${g.name}`, () => { g.members = g.members.filter((x) => x.id !== m.id); ST.sel = { g: g.id }; }); }
    ST.menu = null; render();
  }

  /* ------------------------------------------------------------------ static galleries */
  function galStage(host, V) { host.innerHTML = `<div class="fx-stage"><svg viewBox="0 0 640 400" role="img" aria-label="${esc(V.alt)}">${stageSVG(V, V.k).svg}</svg></div>`; }
  function buildGallery() {
    const base = seed(); const host = $id('fxGal'); if (!host) return;
    const lampArm = { src: 'fixture', id: FIXTURES[0].id }, lanArm = { src: 'fixture', id: FIXTURES[1].id }, scArm = { src: 'fixture', id: FIXTURES[2].id }, rdArm = { src: 'saved', id: 'lib-reading' }, plArm = { src: 'saved', id: 'lib-plinth' };
    const H = (surf, x, y, z, n, name) => ({ surf, x, y, z, n, name });
    const lampSaved = { id: 'lib-lamp', kind: 'group', name: 'Hanging Industrial Lamp', fmt: 1, members: FIXTURES[0].members.map((m) => ({ ...m, p: [m.p[0], m.p[1] + ROOM.lid, m.p[2]] })) };
    ST.mine.push(lampSaved);
    const cases = [
      ['Ceiling · under the lid', 'The canopy ring sits on the overhead the planner will use; a dashed plumb line drops to the pointer’s floor point.', lampArm, H('support', 4.9, 0, 3.1, [0, 1, 0], 'the floor')],
      ['Overhead region beats the lid', 'Under the Soffit the lowest overhead above the floor wins: 2.40, not 2.80. The ghost uses the planner’s query.', lanArm, H('support', 1.2, 0, 1.6, [0, 1, 0], 'the floor')],
      ['Too long to hang here', 'Under the Landing (1.10 m) the Lantern’s base would pass the floor. Red dashed ghost and the member’s name; nothing is written.', lanArm, H('support', 5.2, 0, 0.8, [0, 1, 0], 'the floor')],
      ['Nothing overhead', 'The terrace is open sky. No ghost; a red mark at the floor point says what is missing.', lampArm, H('support', 7.2, 0, 2.2, [0, 1, 0], 'the terrace')],
      ['Wall · yaw from the normal', 'The back-plate lies on the hit plane and faces out along the wall normal. The height is the pointer’s; there is no turning while placing.', scArm, H('wall', 0, 1.75, 2.9, [1, 0, 0], 'Side wall')],
      ['Point at a wall', 'Over the floor, the ceiling or the doorway the sconce has no candidate. The words replace the ghost.', scArm, H('support', 3.2, 0, 3.4, [0, 1, 0], 'the floor')],
      ['Saved group · on the floor', 'A My objects group uses the same ghost with a support origin. Members keep their heights above what they stand on.', rdArm, H('support', 4.6, 0, 3.2, [0, 1, 0], 'the floor')],
      ['Saved group · on a raised support', 'On the Dais the whole group rises with its support: heights above it are kept.', plArm, H('support', 3.5, 0.3, 2.3, [0, 1, 0], 'Dais')],
      ['Saved pendant keeps its height', 'A saved fixture is an ordinary group: it inserts floor-anchored and keeps 2.80 m above the floor. Under open sky it does not re-hang (O3).', { src: 'saved', id: 'lib-lamp' }, H('support', 7.4, 0, 2.6, [0, 1, 0], 'the terrace')],
    ];
    host.innerHTML = cases.map((c, i) => `<figure><div id="fxG${i}"></div><figcaption><b>${c[0]}</b>${c[1]}</figcaption></figure>`).join('');
    cases.forEach((c, i) => { const cand = candidate(c[2], c[3]); galStage($id('fxG' + i), { sc: base, sel: null, hover: null, arm: c[2], cand, alt: c[0], k: 'g' + i }); });
    ST.mine = ST.mine.filter((x) => x.id !== 'lib-lamp');
    // a selection strip: group first, then member
    const sel = $id('fxSelGal');
    if (sel) {
      const sc = seed(), g = sc.groups[0];
      const vs = [['First click · the group', 'Gold member contours, one move cross at the pivot on its overhead, one bent turn arrow. The emitter shows because its group is selected.', { g: g.id }], ['Second click · the body', 'The body is gold; the other member is a faint dashed reference. Its Card names the group it is in.', { g: g.id, m: g.members[0].id }], ['Second click · the emitter', 'The emitter is gold and draws its ordinary ray guide. Its Card is the ordinary Light Card.', { g: g.id, m: g.members[1].id }]];
      sel.innerHTML = vs.map((v, i) => `<figure><div id="fxS${i}"></div><figcaption><b>${v[0]}</b>${v[1]}</figcaption></figure>`).join('');
      vs.forEach((v, i) => galStage($id('fxS' + i), { sc, sel: v[2], hover: null, arm: null, cand: null, alt: v[0], k: 's' + i }));
    }
  }
  function buildCardGallery() {
    const host = $id('fxCardGal'); if (!host) return;
    const sc = seed(), lamp = sc.groups[0], still = sc.groups[1], read = sc.groups[2];
    const imported = { id: 'g-imp', name: 'Vase pair', members: [{ id: 'i1', name: 'Blue vase', kind: 'imported' }, { id: 'i2', name: 'Vase spot', kind: 'light', lk: 'spot' }] };
    const plane = { id: 'g-pl', name: 'Backdrop', members: [{ id: 'p1', name: 'Paper sweep', kind: 'plane' }, { id: 'p2', name: 'Key light', kind: 'light', lk: 'spot' }] };
    const nocontact = { id: 'g-nc', name: 'Bench and lamp', members: [{ id: 'n1', name: 'Gallery bench', kind: 'model', contact: false }, { id: 'n2', name: 'Bench light', kind: 'light', lk: 'point' }] };
    const big = { id: 'g-big', name: 'Pavilion lights', members: Array.from({ length: 65 }, (_, i) => ({ id: 'b' + i, name: `Spot ${i + 1}`, kind: 'light', lk: 'spot' })) };
    const fig = (title, cap, html) => `<figure>${html}<figcaption><b>${title}.</b> ${cap}</figcaption></figure>`;
    const trunc = (g) => ({ ...g, members: g.members.length > 4 ? g.members.slice(0, 3).concat([{ id: 'more', name: `… ${g.members.length - 3} more`, kind: 'light', lk: 'spot' }]) : g.members });
    host.innerHTML = [
      fig('Fixture group, eligible', 'Save is a plain action; there is nothing to disclose, so it saves on click.', groupCardHTML(lamp)),
      fig('Finish would drop', 'The hint warns before the click; the click opens the disclosure, and only Save writes the item.', groupCardHTML(read, { disc: read.id })),
      fig('Saved', 'Confirmation in place. No Undo step, no unsaved change: Save does not touch the project.', groupCardHTML(lamp, { saved: { [lamp.id]: lamp.name } })),
      fig('Artwork member', 'Present, disabled, and the first reason is visible beside it. The offending row is marked.', groupCardHTML(still)),
      fig('Imported model', 'Creator models stay with their project.', groupCardHTML(imported)),
      fig('Plane member', 'Planes cannot travel in a group.', groupCardHTML(plane)),
      fig('Catalogue model without contact', '“<name> cannot be saved yet”: the model has no admitted contact.', groupCardHTML(nocontact)),
      fig('More than 64 items', 'The size limit reads as a sentence.', groupCardHTML({ ...trunc(big), members: trunc(big).members, id: big.id }).replace('Group · 4 items', 'Group · 65 items').replace('<button class="fx-savebtn" data-act="save">' + BOOK + 'Save to My Objects</button>', `<button class="fx-savebtn" disabled>${BOOK}Save to My Objects</button><div class="fx-why">Groups of more than 64 items cannot be saved.</div>`)),
      fig('Drilled body', 'A member Card with its group as a link back up; Esc does the same.', bodyCardHTML(lamp, lamp.members[0])),
    ].join('');
    const lh = document.createElement('figure'); lh.innerHTML = '<div id="fxCardLight"></div><figcaption><b>Drilled emitter.</b> The ordinary Light Card; only its context line names the group.</figcaption>';
    host.appendChild(lh); mountLightCard($id('fxCardLight'), lamp, lamp.members[1]);
    host.querySelectorAll('button').forEach((b) => { if (!b.closest('#fxCardLight')) b.setAttribute('tabindex', '-1'); });
  }
  function buildTileGallery() {
    const host = $id('fxTileGal'); if (!host) return;
    host.innerHTML = FIXTURES.map((f, i) => tileHTML('fixture', f, 'gal' + i, false)).join('') + MINE.map((x, i) => tileHTML('mine', x, i, false)).join('');
    host.querySelectorAll('button').forEach((b) => { b.removeAttribute('data-arm'); b.setAttribute('tabindex', '-1'); });
  }

  /* deep link from the Appearance study: ?d8=place&item=<id> arms the saved-group placement */
  function deepLink() {
    const q = new URLSearchParams(location.search);
    if (q.get('d8') === 'place') { const id = q.get('item') || 'lib-reading'; if (ST.mine.some((x) => x.id === id && x.kind === 'group' && x.fmt === 1)) { ST.lib = 'mine'; arm('saved', id); log('n', 'Arrived from Appearance · Place copy in World'); } }
    else if (q.get('d8') === 'fixture') { const id = q.get('item') || FIXTURES[0].id; if (FIXTURES.some((f) => f.id === id)) arm('fixture', id); }
    if (q.get('d8')) { render(); setTimeout(() => $id('fxApp').scrollIntoView({ block: 'start' }), 120); }
  }

  buildGallery(); buildCardGallery(); buildTileGallery();
  wireLive(); render(); deepLink();
  window.__fx = { ST, candidate, pick, render, arm, escStep, undo, redo, eligibility };
})();
