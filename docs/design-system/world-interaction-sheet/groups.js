/* World interaction sheet · Groups (G1).
 * A plain script loaded after the sheet's inline script. It reuses that script's drawing vocabulary
 * (makeIso, isoGrid, prism, prismEdges, selOutline, glyph, G, tag, ICON, svgPt, screenDir, ppm, STAGES)
 * and ports the Light & Sky spot emitter. Local state and schematic SVG only: production code and tests
 * own behaviour; implementation-plan.md §2 owns the rules this page illustrates. */
(function groupsSpecimen() {
  'use strict';
  const svg = document.getElementById('sv-grp');
  if (!svg) return;
  const root = document.getElementById('s-groups');
  const cardEl = document.getElementById('grp-card');
  const indexEl = document.getElementById('grp-index');
  const pillEl = document.getElementById('grp-pill');
  const statusEl = document.getElementById('grp-status');
  const escEl = document.getElementById('grp-esc');
  const VW = 600;
  const iso = makeIso(46, 256, 300);
  const COBALT = '#2a62d6', RED = '#7e2718', ERASE = '#d0412d';
  const PLAT = { x0: -3.6, x1: -0.6, y0: -2.4, y1: 0.4, h: 0.3 };
  const WALLD = { x0: -3.8, x1: 3.2, y: -3, t: 0.2, h: 2.6 };
  const FACE = WALLD.y + WALLD.t / 2 + 0.02;
  const FILL = {
    stone: { t: '#e4dfd4', l: '#cdc6b7', r: '#bbb4a5' },
    clay: { t: '#cf9a7b', l: '#b57d61', r: '#a06c53' },
    wood: { t: '#b99572', l: '#9f7c5a', r: '#8a6b4c' },
  };
  const PFILL = { t: '#e7e2d3', l: '#d3ccba', r: '#c4bdaa' };
  const KIND = { object: 'Object', artwork: 'Artwork', light: 'Light' };
  const NONE = { k: 'none' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const listNames = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

  // ---------- scene ----------
  const SC0 = () => ({
    ents: {
      plinth: { id: 'plinth', name: 'Plinth', kind: 'object', x: -2, y: -1.6, z: 0.3, w: 0.5, d: 0.5, h: 1.0, rot: 0, fill: 'stone', group: 'still' },
      pears: { id: 'pears', name: 'Pears', kind: 'artwork', x: -2, y: FACE, z: 1.5, w: 0.9, h: 0.7, rot: 0, art: '#c4a05a', group: 'still' },
      spot: { id: 'spot', name: 'Picture spot', kind: 'light', recipe: 'Picture spot', x: -2, y: -1.5, z: 2.45, aim: [-2, FACE, 1.5], target: 'pears', group: 'still' },
      harbour: { id: 'harbour', name: 'Harbour', kind: 'artwork', x: 1.3, y: FACE, z: 1.5, w: 1.1, h: 0.75, rot: 0, art: '#7d98a8' },
      vase: { id: 'vase', name: 'Vase', kind: 'object', x: 0.9, y: -0.6, z: 0, w: 0.3, d: 0.3, h: 0.45, rot: 0, fill: 'clay' },
      stool: { id: 'stool', name: 'Stool', kind: 'object', x: 2.5, y: 0.7, z: 0, w: 0.42, d: 0.42, h: 0.46, rot: 0, fill: 'wood', group: 'pair' },
      stool2: { id: 'stool2', name: 'Stool 2', kind: 'object', x: 3.25, y: 0.7, z: 0, w: 0.42, d: 0.42, h: 0.46, rot: 0, fill: 'wood', group: 'pair' },
    },
    groups: {
      still: { id: 'still', name: 'Still life', members: ['plinth', 'pears', 'spot'], rot: 0 },
      pair: { id: 'pair', name: 'Pair', members: ['stool', 'stool2'], rot: 0 },
    },
  });
  const coarseDefault = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const UI0 = (pointer) => ({
    sel: NONE, hov: null, hovH: null, at: null, shift: false, over: false, engaged: false,
    tool: 'select', pointer, more: false, drag: null, cand: null, arm: null, press: null,
    confirm: false, menu: null, cardMore: false, renaming: false, err: '', offer: null, flash: null,
    status: 'Click the painting on the left: its group, Still life, is selected. Click it again to drill in.', undo: [],
  });
  let SC = SC0(), UI = UI0(coarseDefault ? 'coarse' : 'fine'), seq = 1, HND = [], flashT = 0;
  const nid = (p) => `${p}${seq++}`;
  const coarse = () => UI.pointer === 'coarse';
  const ent = (id) => SC.ents[id];
  const grp = (id) => SC.groups[id];

  // ---------- selection: normalized top-level keys ('g:id' | 'e:id') ----------
  const topKey = (e) => (e.group ? `g:${e.group}` : `e:${e.id}`);
  const keyEnts = (k) => (k[0] === 'g' ? grp(k.slice(2)).members : [k.slice(2)]);
  const keyName = (k) => (k[0] === 'g' ? grp(k.slice(2)).name : ent(k.slice(2)).name);
  const keyOf = (s) => (s.k === 'group' ? `g:${s.id}` : s.k === 'ent' ? `e:${s.id}` : null);
  const sameSel = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function selKeys(s = UI.sel) {
    if (s.k === 'set') return s.items.slice();
    if (s.k === 'group') return [`g:${s.id}`];
    if (s.k === 'ent') return [topKey(ent(s.id))]; // a drilled member normalizes to its group
    return [];
  }
  function fromKeys(keys) {
    if (!keys.length) return NONE;
    if (keys.length > 1) return { k: 'set', items: keys };
    return keys[0][0] === 'g' ? { k: 'group', id: keys[0].slice(2) } : { k: 'ent', id: keys[0].slice(2) };
  }
  function selEnts(s = UI.sel) { return s.k === 'ent' ? [s.id] : selKeys(s).flatMap(keyEnts); }
  /** selectionTargetForHit: group first; a member of the selected (or drilled) group drills. */
  function targetForHit(id) {
    const e = ent(id), s = UI.sel;
    if (!e.group) return { k: 'ent', id };
    const inG = (s.k === 'group' && s.id === e.group) || (s.k === 'ent' && ent(s.id) && ent(s.id).group === e.group);
    return inG ? { k: 'ent', id } : { k: 'group', id: e.group };
  }
  function valid(s) {
    if (s.k === 'ent') return ent(s.id) ? s : NONE;
    if (s.k === 'group') return grp(s.id) ? s : NONE;
    if (s.k === 'set') return fromKeys(s.items.filter((k) => (k[0] === 'g' ? grp(k.slice(2)) : ent(k.slice(2)))));
    return s;
  }
  /** The status line's guide for a selection the person just made (actions write their own result). */
  function guide(s) {
    if (s.k === 'group') { const g = grp(s.id); return `${g.name} selected · drag any member or the cross to move all ${g.members.length}; click a member again to drill in.`; }
    if (s.k === 'ent') { const e = ent(s.id), g = e.group && grp(e.group); return g ? `${e.name} drilled in ${g.name} · its own handles; Esc selects ${g.name}.` : `${e.name} selected.`; }
    if (s.k === 'set') return `${s.items.length} selected · a set has no primary: Group, Light it or Clear.`;
    if (s.k === 'layout') return `${LAYOUT[s.id].name} selected · Layout never joins a group or a set.`;
    return 'Nothing selected.';
  }
  function pick(s) { s = valid(s); UI.status = guide(s); setSel(s); }
  function setSel(s, keep = {}) {
    UI.sel = valid(s); UI.confirm = false; UI.menu = null; UI.renaming = false; UI.err = ''; UI.arm = null; UI.cardMore = false;
    if (!keep.offer) UI.offer = null;
    if (UI.sel.k === 'layout') UI.more = false;
    render();
  }
  function flash(at, text, bad = false) {
    UI.flash = { at, text, bad }; clearTimeout(flashT);
    flashT = setTimeout(() => { UI.flash = null; renderStage(); }, 1700);
  }
  function toggle(key, at) {
    const keys = selKeys(), i = keys.indexOf(key), adding = i < 0;
    if (adding) keys.push(key); else keys.splice(i, 1);
    if (at) flash(at, `${adding ? '+' : '−'} ${keyName(key)}`);
    pick(fromKeys(keys));
  }

  // ---------- geometry ----------
  const onPlat = (x, y) => x >= PLAT.x0 && x <= PLAT.x1 && y >= PLAT.y0 && y <= PLAT.y1;
  const supportAt = (x, y) => (onPlat(x, y) ? PLAT.h : 0);
  const frame = (rot) => { const r = rot * Math.PI / 180; return { u: [Math.cos(r), Math.sin(r)], v: [-Math.sin(r), Math.cos(r)] }; };
  const corners = (e) => { const { u, v } = frame(e.rot); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [e.x + u[0] * a * e.w / 2 + v[0] * b * e.d / 2, e.y + u[1] * a * e.w / 2 + v[1] * b * e.d / 2]); };
  const artQuad = (e, grow = 0) => { const { u } = frame(e.rot), hw = e.w / 2 + grow, hh = e.h / 2 + grow; return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([a, b]) => iso(e.x + u[0] * a, e.y + u[1] * a, e.z + b)); };
  const lp = (e) => iso(e.x, e.y, e.z);
  const ldir = (e) => sub(iso(...e.aim), lp(e));
  const boxPts = (c, z0, z1) => [...c.map((p) => iso(...p, z0)), ...c.map((p) => iso(...p, z1))];
  function hull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function inPoly(p, q) {
    let c = false;
    for (let a = 0, b = q.length - 1; a < q.length; b = a++) if ((q[a][1] > p[1]) !== (q[b][1] > p[1]) && p[0] < (q[b][0] - q[a][0]) * (p[1] - q[a][1]) / (q[b][1] - q[a][1]) + q[a][0]) c = !c;
    return c;
  }
  const nearPoly = (p, q, r) => inPoly(p, q) || q.some((a, i) => proj(p, a, q[(i + 1) % q.length]).d < r);
  const shapeOf = (e) => (e.kind === 'object' ? hull(boxPts(corners(e), e.z, e.z + e.h)) : artQuad(e, 0.04));
  const wallC = [[WALLD.x0, WALLD.y - WALLD.t / 2], [WALLD.x1, WALLD.y - WALLD.t / 2], [WALLD.x1, WALLD.y + WALLD.t / 2], [WALLD.x0, WALLD.y + WALLD.t / 2]];
  const platC = [[PLAT.x0, PLAT.y0], [PLAT.x1, PLAT.y0], [PLAT.x1, PLAT.y1], [PLAT.x0, PLAT.y1]];
  const LAYOUT = { wall: { name: 'Wall 1', c: wallC, z0: 0, z1: WALLD.h }, platform: { name: 'Platform', c: platC, z0: 0, z1: PLAT.h } };
  const centreZ = (e) => (e.kind === 'object' ? e.z + e.h / 2 : e.z);
  /** Screen point to plan point on the plane at height z (the pivot's support for a turn). */
  const invAt = (p, z) => iso.inv([p[0], p[1] + z * iso.s]);

  function hitAt(p) {
    const es = Object.values(SC.ents), R = coarse() ? 22 : 11, pad = coarse() ? 10 : 0;
    for (const e of es) if (e.kind === 'light' && d2(p, lp(e)) < R) return { id: e.id };
    const bodies = es.filter((e) => e.kind !== 'light').sort((a, b) => b.x + b.y - (a.x + a.y));
    for (const e of bodies) if (inPoly(p, shapeOf(e))) return { id: e.id };
    if (pad) for (const e of bodies) if (nearPoly(p, shapeOf(e), pad)) return { id: e.id };
    for (const k of ['platform', 'wall']) { const L = LAYOUT[k]; if (inPoly(p, hull(boxPts(L.c, L.z0, L.z1)))) return { layout: k }; }
    return null;
  }

  // ---------- drawing ----------
  let EU = 0;
  /** The Light & Sky spot emitter (§2), ported: white barrel, ink keyline, lens in the light's colour. */
  function emitter(p, dir, o = {}) {
    const id = `gx${++EU}`, sel = !!o.sel, ghost = !!o.col, red = o.col === RED || o.col === ERASE;
    const sc = o.armed ? 0.82 : 1, line = sel ? '#6b4f08' : ghost ? o.col : '#1f2a24';
    const body = sel ? ['#fff6d8', '#f6dc8a', '#d9b24a'] : red ? ['#ffffff', '#fbefec', '#efc6bd'] : ghost ? ['#ffffff', '#eef3ff', '#c4d2f0'] : ['#ffffff', '#eef0ea', '#c3cbbf'];
    const a = Math.atan2(dir[1], dir[0]) * 180 / Math.PI, d = 'M-10,-5.6L4,-7.4A3.2,7.4 0 0 1 4,7.4L-10,5.6A2.3,5.6 0 0 1 -10,-5.6Z';
    let s = `<g transform="translate(${P(p)})">`;
    if (o.hover) s += '<circle r="15" fill="#edf1df" fill-opacity=".9" stroke="#6f8a3e" stroke-opacity=".55" stroke-width="1"/>';
    s += `<g transform="rotate(${a.toFixed(1)}) scale(${sc})"><defs><linearGradient id="${id}B" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${body[0]}"/><stop offset=".5" stop-color="${body[1]}"/><stop offset="1" stop-color="${body[2]}"/></linearGradient><radialGradient id="${id}L" cx=".45" cy=".4"><stop offset="0" stop-color="#fffdf2"/><stop offset="1" stop-color="#ffd98a"/></radialGradient></defs>` +
      `<g style="filter:drop-shadow(0 1.2px 1.3px rgba(20,24,20,.34))"><path d="${d}" fill="url(#${id}B)" stroke="${line}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M-8.6,-3.2L2.6,-5.3" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".9"/><circle cx="-3" cy="0" r="1.3" fill="${line}" opacity=".55"/>` +
      `<ellipse cx="4" cy="0" rx="3.2" ry="7.4" fill="${ghost ? o.col : '#12261d'}" stroke="${line}" stroke-width="1.3"/></g>` +
      `<ellipse cx="4.3" cy="0" rx="2.2" ry="5.6" fill="url(#${id}L)"/><ellipse cx="3.7" cy="-2.6" rx=".7" ry="1.5" fill="#fff" opacity=".9"/></g>`;
    return `${s}</g>`;
  }
  function body(e) {
    if (e.kind === 'object') return prism(iso, corners(e), e.z, e.z + e.h, FILL[e.fill]);
    if (e.kind !== 'artwork') return '';
    const n = frame(e.rot).v, facing = n[0] + n[1] > 0;
    return `<polygon points="${artQuad(e, 0.04).map(P).join(' ')}" fill="#3a3530"/>` + (facing ? `<polygon points="${artQuad(e, -0.03).map(P).join(' ')}" fill="${e.art}"/>` : '');
  }
  const pool = (e) => { const t = iso(...e.aim); return `<circle cx="${t[0].toFixed(1)}" cy="${t[1].toFixed(1)}" r="${e.recipe === 'Wash' ? 46 : 30}" fill="url(#grp-pool)"/>`; };
  function beam(e) {
    const a = lp(e), t = iso(...e.aim), dd = unit(sub(t, a)), n = [-dd[1], dd[0]], r = e.recipe === 'Wash' ? 40 : 22;
    const path = `M${P(a)}L${P(add(t, mul(n, r)))}M${P(a)}L${P(add(t, mul(n, -r)))}`;
    return `<path class="g-case" d="${path}"/><path class="g-ray" d="${path}"/>`;
  }
  function boxContour(c, z0, z1, cls) {
    let s = `<polygon class="${cls}" points="${c.map((p) => P(iso(...p, z1))).join(' ')}"/>`;
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length], n = [b[1] - a[1], -(b[0] - a[0])];
      if (n[0] + n[1] > 1e-6) s += `<polygon class="${cls}" points="${[iso(...a, z0), iso(...b, z0), iso(...b, z1), iso(...a, z1)].map(P).join(' ')}"/>`;
    }
    return s;
  }
  function contour(e, cls) {
    if (e.kind === 'light') return '';
    if (e.kind === 'artwork') return `<polygon class="${cls}" points="${artQuad(e, 0.07).map(P).join(' ')}"/>`;
    return cls === 'sel-edge' ? selOutline(iso, corners(e), e.z, e.z + e.h) : boxContour(corners(e), e.z, e.z + e.h, cls);
  }
  function ghostOf(c, bad) {
    const cls = bad ? 'refused' : 'ghost';
    if (c.kind === 'object') return prismEdges(iso, corners(c), c.z, c.z + c.h, cls);
    if (c.kind === 'artwork') return `<polygon class="${cls}" points="${artQuad(c, 0.04).map(P).join(' ')}"/>`;
    return emitter(lp(c), ldir(c), { col: bad ? RED : COBALT });
  }

  // ---------- transform subject and handles ----------
  const pivotOf = (es) => { const xs = es.map((e) => e.x), ys = es.map((e) => e.y); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };
  const reachOf = (e) => (e.kind === 'object' ? Math.hypot(e.w, e.d) / 2 : e.kind === 'artwork' ? e.w / 2 : 0.15);
  function subjectNow() {
    if (UI.tool !== 'select' || UI.more) return null;
    const s = UI.sel;
    if (s.k === 'group') { const g = grp(s.id), pv = pivotOf(g.members.map(ent)); return { kind: 'group', gid: g.id, ids: g.members.slice(), pv, zr: supportAt(...pv), rot: g.rot, name: g.name }; }
    if (s.k === 'ent') { const e = ent(s.id); if (e.kind === 'light') return null; return { kind: e.kind, ids: [e.id], pv: [e.x, e.y], zr: e.z, rot: e.rot, name: e.name }; }
    return null;
  }
  function handles(subj) {
    const H = [], R = coarse() ? 22 : 16, C = UI.cand, hv = (k) => UI.hovH === k || (UI.drag && UI.drag.k === k);
    const view = (id) => (C && C.list.find((c) => c.id === id)) || ent(id);
    const pv = [subj.pv[0] + (C ? C.dx : 0), subj.pv[1] + (C ? C.dy : 0)], rot = subj.rot + (C ? C.da : 0);
    let s = '';
    if (subj.kind === 'artwork') {
      const e = view(subj.ids[0]), { u } = frame(e.rot), at = [e.x, e.y, e.z - e.h / 2 - 0.2], p = iso(...at), du = screenDir(iso, at, [...u, 0]);
      s += glyph(G.two, p, deg(du), hv('slide')); H.push({ k: 'slide', p, r: R });
      return { s, H };
    }
    const first = view(subj.ids[0]), group = subj.kind === 'group';
    const zr = subj.zr;
    const rr = Math.max(...subj.ids.map((id) => { const e = view(id); return Math.hypot(e.x - pv[0], e.y - pv[1]) + reachOf(e); })) + 0.35;
    const ga = (rot + 90) * Math.PI / 180, gw = [pv[0] + rr * Math.cos(ga), pv[1] + rr * Math.sin(ga), zr], gp = iso(...gw);
    const tan = screenDir(iso, gw, [-Math.sin(ga), Math.cos(ga)]), toC = sub(iso(pv[0], pv[1], zr), gp);
    s += glyph(G.curved, gp, deg(tan), hv('turn'), dot([-tan[1], tan[0]], toC) < 0 ? ' scale(1,-1)' : '');
    H.push({ k: 'turn', p: gp, r: R });
    // the group's cross sits on its pivot, on the support; a single object keeps the Object gizmo's top-centre cross
    const zm = group ? zr : first.z + first.h, mc = iso(pv[0], pv[1], zm);
    const du = screenDir(iso, [pv[0], pv[1], zm], [Math.cos(rot * Math.PI / 180), Math.sin(rot * Math.PI / 180)]);
    s += glyph(G.move, mc, deg(du), hv('move'));
    H.push({ k: 'move', p: mc, r: R });
    return { s, H };
  }

  // ---------- candidates and the support check ----------
  const moved = (ids, dx, dy) => ids.map((id) => { const e = ent(id); return { ...e, x: e.x + dx, y: e.y + dy, aim: e.aim && [e.aim[0] + dx, e.aim[1] + dy, e.aim[2]] }; });
  function turned(ids, pv, da) {
    const r = da * Math.PI / 180, co = Math.cos(r), si = Math.sin(r);
    const rp = (x, y) => [pv[0] + (x - pv[0]) * co - (y - pv[1]) * si, pv[1] + (x - pv[0]) * si + (y - pv[1]) * co];
    return ids.map((id) => {
      const e = ent(id), [x, y] = rp(e.x, e.y), c = { ...e, x, y };
      if (e.rot !== undefined) c.rot = e.rot + da;
      if (e.aim) { const [ax, ay] = rp(e.aim[0], e.aim[1]); c.aim = [ax, ay, e.aim[2]]; }
      return c;
    });
  }
  /** Floor members only: a resting member needs a coplanar support at its new place. Lights and Artwork have no check. */
  function supportRefusal(list) {
    for (const c of list) {
      if (c.kind !== 'object') continue;
      const e = ent(c.id), s0 = supportAt(e.x, e.y), s1 = supportAt(c.x, c.y);
      if (Math.abs(e.z - s0) < 1e-6 && Math.abs(s1 - c.z) > 1e-6) return `${e.name} · no support at ${c.z.toFixed(2)} m (${s1 ? 'platform' : 'floor'} ${s1.toFixed(2)} m)`;
    }
    return null;
  }
  function computeCand(D, alt) {
    const subj = D.subj; let list, dx = 0, dy = 0, da = 0;
    if (D.k === 'move') {
      const w0 = iso.inv(D.p0), w1 = iso.inv(D.at);
      dx = Math.round((w1[0] - w0[0]) * 10) / 10; dy = Math.round((w1[1] - w0[1]) * 10) / 10;
      list = moved(subj.ids, dx, dy);
    } else if (D.k === 'slide') {
      const e = ent(subj.ids[0]), u = frame(e.rot).u, at = [e.x, e.y, e.z], du = screenDir(iso, at, [...u, 0]);
      const m = Math.round(dot(sub(D.at, D.p0), du) / ppm(iso, at, [...u, 0]) * 20) / 20;
      dx = u[0] * m; dy = u[1] * m; D.m = m; list = moved(subj.ids, dx, dy);
    } else {
      da = deg(sub(invAt(D.at, subj.zr), subj.pv)) - D.a0; da = ((da % 360) + 540) % 360 - 180;
      if (!alt) da = Math.round(da / 15) * 15;
      list = turned(subj.ids, subj.pv, da);
    }
    UI.cand = { list, dx, dy, da, refusal: supportRefusal(list) };
  }

  // ---------- writes: each is one Undo ----------
  function snapshot() { UI.undo.push(JSON.stringify({ SC, sel: UI.sel })); if (UI.undo.length > 60) UI.undo.shift(); }
  function undo() {
    const s = UI.undo.pop();
    if (!s) { UI.status = 'Nothing to undo.'; render(); return; }
    const o = JSON.parse(s); SC = o.SC; UI.status = 'Undone: one step.'; UI.more = false; setSel(o.sel);
  }
  function nextName(base) {
    base = base.replace(/ \d+$/, '');
    const used = new Set([...Object.values(SC.ents).map((e) => e.name), ...Object.values(SC.groups).map((g) => g.name)]);
    if (!used.has(base)) return base;
    for (let n = 2; ; n++) if (!used.has(`${base} ${n}`)) return `${base} ${n}`;
  }
  function commit(D) {
    const C = UI.cand, subj = D.subj; UI.cand = null;
    if (!C || (!C.dx && !C.dy && !C.da)) { render(); return; }
    if (C.refusal) { UI.status = `Refused: ${C.refusal}. Nothing was written.`; render(); return; }
    snapshot();
    for (const c of C.list) SC.ents[c.id] = c;
    if (subj.kind === 'group' && C.da) grp(subj.gid).rot += C.da;
    const all = subj.kind === 'group' ? `, all ${subj.ids.length} items, Y unchanged` : '';
    UI.status = C.da ? `Turned ${subj.name} ${sgn(C.da, 0)}° about its pivot${all}. One Undo.`
      : D.k === 'slide' ? `Slid ${subj.name} ${sgn(D.m)} m along its Wall. One Undo.`
        : `Moved ${subj.name} Δx ${sgn(C.dx)} · Δz ${sgn(C.dy)} m${all}. One Undo.`;
    render();
  }
  /** Group copies take the rigid +0.5 m X/Z offset; a member copy keeps its kind's own offset
   *  (Artwork: 0.15 m along the image's horizontal axis, as artwork-duplicate does). */
  const dupOffset = (e, member) => (member && e.kind === 'artwork' ? mul(frame(e.rot).u, 0.15) : [0.5, 0.5]);
  /** Floor members only: a copy that would rest without a coplanar support refuses the whole duplicate. */
  function dupRefusal(ids, member) {
    const why = supportRefusal(ids.map((id) => { const e = ent(id), [dx, dy] = dupOffset(e, member); return { ...e, x: e.x + dx, y: e.y + dy }; }));
    if (!why) return false;
    const e = ent(ids.find((id) => why.startsWith(`${ent(id).name} ·`))) || ent(ids[0]);
    UI.status = `Refused: Duplicate · ${why}. Nothing was written.`;
    flash(e.kind === 'object' ? iso(e.x, e.y, e.z + e.h) : lp(e), `Duplicate · ${why}`, true); render();
    return true;
  }
  function copyOf(e, gid, member = false) {
    const c = JSON.parse(JSON.stringify(e)), [dx, dy] = dupOffset(e, member);
    c.id = nid(e.kind[0]); c.name = nextName(e.name); c.x += dx; c.y += dy;
    if (c.aim) { c.aim[0] += dx; c.aim[1] += dy; }
    if (gid) c.group = gid; else delete c.group;
    return c;
  }
  function duplicateGroup(gid) {
    const g = grp(gid); if (dupRefusal(g.members, false)) return; snapshot();
    const ng = { id: nid('g'), name: nextName(g.name), members: [], rot: g.rot }, map = {};
    SC.groups[ng.id] = ng;
    for (const id of g.members) { const c = copyOf(ent(id), ng.id); SC.ents[c.id] = c; ng.members.push(c.id); map[id] = c.id; }
    for (const id of ng.members) { const c = ent(id); if (c.target && map[c.target]) c.target = map[c.target]; }
    UI.status = `Duplicated ${g.name} as ${ng.name}: ${ng.members.length} copies and a new group, +0.5 m X/Z. One Undo.`;
    setSel({ k: 'group', id: ng.id });
  }
  function duplicateEnt(id) {
    const e = ent(id); if (dupRefusal([id], true)) return; snapshot();
    const c = copyOf(e, null, true); SC.ents[c.id] = c;
    UI.status = `Duplicated ${e.name} as ${c.name}: an independent copy, ${e.kind === 'artwork' ? '0.15 m along the image' : '+0.5 m X/Z'}${e.group ? `; ${grp(e.group).name} is unchanged` : ''}. One Undo.`;
    setSel({ k: 'ent', id: c.id });
  }
  function eraseGroup(gid) {
    const g = grp(gid); snapshot();
    g.members.forEach((id) => delete SC.ents[id]); delete SC.groups[gid];
    UI.status = `Erased ${g.name} · ${g.members.length} items. One Undo restores them.`;
    setSel(NONE);
  }
  function eraseEnt(id) {
    const e = ent(id); snapshot(); delete SC.ents[id];
    let msg = `Erased ${e.name}.`;
    if (e.group) {
      const g = grp(e.group); g.members = g.members.filter((m) => m !== id);
      if (g.members.length < 2) {
        const rest = g.members.map((m) => ent(m).name);
        g.members.forEach((m) => delete ent(m).group); delete SC.groups[g.id];
        msg = `Erased ${e.name}; ${g.name} dissolved and ${listNames(rest)} is ungrouped.`;
      }
    }
    UI.status = `${msg} One Undo restores it.`;
    setSel(NONE);
  }
  function makeGroup(ids, name) {
    const g = { id: nid('g'), name: name || nextName('Group'), members: ids.slice(), rot: 0 };
    SC.groups[g.id] = g; ids.forEach((id) => { ent(id).group = g.id; });
    return g;
  }
  function groupSet() {
    const keys = selKeys();
    if (keys.length < 2 || keys.some((k) => k[0] === 'g')) return;
    snapshot();
    const g = makeGroup(keys.map((k) => k.slice(2)));
    UI.status = `Grouped ${listNames(g.members.map((id) => ent(id).name))} as ${g.name}. One Undo.`;
    UI.more = false; setSel({ k: 'group', id: g.id });
  }
  function ungroup(gid) {
    const g = grp(gid); snapshot();
    g.members.forEach((id) => delete ent(id).group); delete SC.groups[gid];
    UI.status = `Ungrouped ${g.name}: its ${g.members.length} items stay selected as a set. One Undo.`;
    setSel(fromKeys(g.members.map((id) => `e:${id}`)));
  }
  function groupWith() {
    const o = UI.offer; if (!o || !ent(o.light) || !ent(o.subject) || ent(o.light).group || ent(o.subject).group) return;
    snapshot();
    const g = makeGroup([o.subject, o.light]);
    UI.status = `Grouped ${ent(o.subject).name} and ${ent(o.light).name} as ${g.name}. One Undo.`;
    setSel({ k: 'group', id: g.id });
  }
  function lightInfo(keys) {
    const es = keys.flatMap(keyEnts).map(ent).filter((e) => e.kind !== 'light');
    const names = listNames(es.map((e) => e.name)), pic = es.length === 1 && es[0].kind === 'artwork';
    return {
      es, names, defName: pic ? 'Picture spot' : 'Wash',
      def: pic ? 'Places a Picture spot 1.4 m in front and 30° above, fitted to the Artwork. It is not grouped. One undo.' : `Places one Wash over ${names}. It is not grouped. One undo.`,
      show: `Places Key, Fill and Rim spots around ${names} as a new group, Showcase. ${es.length === 1 ? 'The subject stays' : 'The subjects stay'} out of it. One undo.`,
    };
  }
  function lightIt(keys, recipe) {
    const info = lightInfo(keys), es = info.es; if (!es.length) return;
    const cx = es.reduce((a, e) => a + e.x, 0) / es.length, cy = es.reduce((a, e) => a + e.y, 0) / es.length, cz = es.reduce((a, e) => a + centreZ(e), 0) / es.length;
    const n = es.every((e) => e.kind === 'artwork') ? frame(es[0].rot).v : unit([0.55, 0.85]), u = [n[1], -n[0]];
    snapshot();
    const mk = (name, rec, off, z, target) => { const L = { id: nid('l'), name: nextName(name), kind: 'light', recipe: rec, x: cx + off[0], y: cy + off[1], z, aim: [cx, cy, cz], target }; SC.ents[L.id] = L; return L; };
    if (recipe === 'showcase') {
      const rig = [mk('Key', 'Spot', add(mul(n, 1.5), mul(u, 1.0)), cz + 1.0), mk('Fill', 'Spot', add(mul(n, 1.7), mul(u, -1.2)), cz + 0.4), mk('Rim', 'Spot', add(mul(n, 0.35), mul(u, -0.9)), cz + 1.3)];
      const g = makeGroup(rig.map((L) => L.id), nextName('Showcase'));
      UI.status = `Showcase placed Key, Fill and Rim as the group ${g.name}; ${info.names} ${es.length === 1 ? 'is' : 'are'} not in it. One Undo.`;
      setSel({ k: 'group', id: g.id }); return;
    }
    const one = es.length === 1 ? es[0] : null;
    const L = one && one.kind === 'artwork' ? mk('Picture spot', 'Picture spot', mul(n, 1.21), cz + 0.7, one.id)
      : mk('Wash', 'Wash', mul(n, 1.8), Math.max(...es.map((e) => (e.kind === 'object' ? e.z + e.h : e.z + e.h / 2))) + 1.2, one ? one.id : undefined);
    const offer = keys.length === 1 && one && !one.group;
    UI.status = `Placed ${L.name} over ${info.names}. It is not grouped. One Undo.${offer ? ` The Card offers Group with “${one.name}”.` : ''}`;
    UI.offer = offer ? { light: L.id, subject: one.id } : null;
    setSel({ k: 'ent', id: L.id }, { offer: true });
  }

  // ---------- Escape ladder ----------
  function escRung() {
    if (UI.drag && UI.drag.moved) return ['cancels the drag', () => { UI.drag = null; UI.cand = null; render(); }];
    if (UI.press) return ['cancels the press', () => { UI.press = null; render(); }];
    if (UI.arm || UI.confirm || UI.menu) return [UI.arm ? 'withdraws the Erase disclosure' : UI.confirm ? 'closes the Erase disclosure' : 'closes the menu', () => { UI.arm = null; UI.confirm = false; UI.menu = null; render(); }];
    if (UI.more) return ['leaves Select more', () => { UI.more = false; render(); }];
    if (UI.tool !== 'select') return ['returns to Select', () => setTool('select')];
    const s = UI.sel;
    if (s.k === 'ent' && ent(s.id).group) { const g = grp(ent(s.id).group); return [`selects ${g.name}`, () => pick({ k: 'group', id: g.id })]; }
    if (s.k !== 'none') return ['clears the selection', () => pick(NONE)];
    return ['does nothing', () => {}];
  }

  // ---------- render ----------
  function hoverMarks() {
    const out = { ids: [], layout: null, tag: null };
    if (UI.tool !== 'select' || coarse() || UI.drag || UI.more || UI.hovH) return out;
    const h = UI.hov; if (!h) return out;
    if (h.layout) { if (!UI.shift && !(UI.sel.k === 'layout' && UI.sel.id === h.layout)) out.layout = h.layout; return out; }
    const e = ent(h.id);
    if (UI.shift) { const k = topKey(e), on = selKeys().includes(k); out.ids = keyEnts(k); out.tag = `${on ? '−' : '+'} ${keyName(k)}`; return out; }
    const t = targetForHit(h.id);
    if (!sameSel(t, UI.sel)) out.ids = t.k === 'group' ? grp(t.id).members : [t.id];
    return out;
  }
  function eraseKey() {
    if (UI.tool !== 'erase') return null;
    if (UI.arm) return UI.arm;
    if (UI.press) return UI.press;
    return !coarse() && UI.hov && UI.hov.id ? topKey(ent(UI.hov.id)) : null;
  }
  function renderStage() {
    EU = 0;
    if (UI.hov && UI.hov.id && !ent(UI.hov.id)) UI.hov = null; // an erase or undo removed what the pointer was over
    if (UI.press && !(UI.press[0] === 'g' ? grp(UI.press.slice(2)) : ent(UI.press.slice(2)))) UI.press = null;
    if (UI.arm && !grp(UI.arm.slice(2))) UI.arm = null;
    const es = Object.values(SC.ents), s0 = UI.sel, D = UI.drag, C = UI.cand;
    let s = '<defs><radialGradient id="grp-pool"><stop offset="0" stop-color="#fff4cf" stop-opacity=".85"/><stop offset=".55" stop-color="#fff4cf" stop-opacity=".35"/><stop offset="1" stop-color="#fff4cf" stop-opacity="0"/></radialGradient></defs>';
    s += isoGrid(iso, VW, 430, 9);
    s += prism(iso, wallC, 0, WALLD.h, WFILL) + prism(iso, platC, 0, PLAT.h, PFILL);
    for (const e of es.slice().sort((a, b) => a.x + a.y - (b.x + b.y))) s += body(e);
    for (const e of es) if (e.kind === 'light') s += pool(e);
    // marks
    const selIds = new Set(s0.k === 'layout' || s0.k === 'none' ? [] : selEnts());
    const drilled = s0.k === 'ent' && ent(s0.id).group ? grp(ent(s0.id).group) : null;
    const refIds = new Set(drilled ? drilled.members.filter((id) => id !== s0.id) : []);
    const hov = hoverMarks(), hovIds = new Set(hov.ids);
    const ek = eraseKey(), ersIds = new Set(ek ? keyEnts(ek) : []);
    for (const id of refIds) s += contour(ent(id), 'g-ref');
    for (const id of selIds) s += contour(ent(id), 'sel-edge');
    if (s0.k === 'layout') { const L = LAYOUT[s0.id]; s += selOutline(iso, L.c, L.z0, L.z1); }
    for (const id of hovIds) s += contour(ent(id), 'g-hov');
    if (hov.layout) { const L = LAYOUT[hov.layout]; s += boxContour(L.c, L.z0, L.z1, 'g-hov'); }
    for (const id of ersIds) s += contour(ent(id), 'g-ers');
    // lights: idle draws nothing; the beam guide shows with selection (a selected group keeps its members' guides)
    const guided = s0.k === 'group' || (s0.k === 'ent' && ent(s0.id).kind === 'light') ? selIds : new Set();
    for (const id of guided) if (ent(id).kind === 'light') s += beam(ent(id));
    for (const e of es) {
      if (e.kind !== 'light') continue;
      const p = lp(e), dir = ldir(e);
      if (ersIds.has(e.id)) s += emitter(p, dir, { col: ERASE });
      else if (selIds.has(e.id)) s += emitter(p, dir, { sel: true, hover: hovIds.has(e.id) });
      else if (hovIds.has(e.id)) s += emitter(p, dir, { hover: true });
      else if (refIds.has(e.id)) s += emitter(p, dir, { armed: true });
    }
    // proposal: the source stays put; every moving member shows its own dashed candidate
    if (C && D && D.moved) for (const c of C.list) s += ghostOf(c, !!C.refusal);
    // handles travel with the proposal
    const subj = D && D.subj ? D.subj : subjectNow();
    HND = [];
    if (subj && UI.tool === 'select' && !UI.more && !(D && D.k === 'setdrag')) { const h = handles(subj); s += h.s; HND = h.H; }
    // tags
    if (D && D.moved && D.at) {
      let t = null, bad = false;
      if (D.k === 'setdrag') { t = 'Select one subject or a group'; bad = true; }
      else if (C && C.refusal) { t = C.refusal; bad = true; }
      else if (C && D.k === 'turn') t = `Δθ ${sgn(C.da, 0)}°`;
      else if (C && D.k === 'slide') t = `Δ ${sgn(D.m || 0)} m along Wall 1`;
      else if (C && D.k === 'move') t = `Δx ${sgn(C.dx)} · Δz ${sgn(C.dy)} m${D.subj.kind === 'group' ? ` · ${D.subj.ids.length} items` : ''}`;
      if (t) s += tag(D.at[0] + 16, D.at[1] - 32, t, bad, VW);
    }
    if (hov.tag && UI.at) s += tag(UI.at[0] + 16, UI.at[1] - 30, hov.tag, false, VW);
    if (UI.arm) {
      const g = grp(UI.arm.slice(2)), pts = g.members.map((id) => { const e = ent(id); return e.kind === 'light' ? lp(e) : iso(e.x, e.y, e.z + (e.h || 0)); });
      const top = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
      const text = `Erase group · ${g.members.length} items. Click again to erase.`;
      s += tag(top[0] - text.length * 3.5, top[1] - 34, text, false, VW);
    }
    if (UI.flash) s += tag(UI.flash.at[0] + 16, UI.flash.at[1] - 30, UI.flash.text, UI.flash.bad, VW);
    svg.innerHTML = s;
    escEl.textContent = `Esc now ${escRung()[0]}.`;
  }

  // ---------- Index (mock of EditorIndexWorld) ----------
  const IC = {
    object: '<rect x="4" y="3.5" width="16" height="4" rx="1"/><path d="M7 7.5 V18 M17 7.5 V18"/><rect x="4" y="18" width="16" height="2.5" rx="1"/>',
    light: '<path d="M9 17 V15 C6.5 13.5 5.5 11.5 5.5 9.5 A6.5 6.5 0 0 1 18.5 9.5 C18.5 11.5 17.5 13.5 15 15 V17 Z"/><path d="M9.5 20.5 H14.5"/>',
    group: '<rect x="3.5" y="8.5" width="11" height="11" rx="2"/><path d="M8.5 8.5V6A1.5 1.5 0 0 1 10 4.5h8.5A1.5 1.5 0 0 1 20 6v8.5a1.5 1.5 0 0 1-1.5 1.5h-4"/>',
  };
  const icon = (k) => `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
  const kindIcon = (e) => (e.kind === 'light' ? 'light' : 'object');
  function indexHtml() {
    const on = new Set(UI.sel.k === 'set' ? UI.sel.items : [keyOf(UI.sel)]);
    const gs = Object.values(SC.groups), es = Object.values(SC.ents), objs = es.filter((e) => e.kind !== 'light'), lights = es.filter((e) => e.kind === 'light');
    const row = (key, ic, name, extra, label) => `<li class="${on.has(key) ? 'on' : ''}"><button type="button" data-key="${key}" aria-current="${on.has(key) ? 'true' : 'false'}" aria-label="${esc(label)}">${icon(ic)}<span class="nm">${esc(name)}</span>${extra}</button></li>`;
    const of = (e) => (e.group ? `<span class="of">· ${esc(grp(e.group).name)}</span>` : '');
    const lab = (e) => `${KIND[e.kind]} ${e.name}${e.group ? `, in ${grp(e.group).name}` : ''}`;
    return '<p class="ix-cap">Index</p>' +
      `<h3><span>Objects</span><span>${gs.length + objs.length}</span></h3><ul>` +
      gs.map((g) => row(`g:${g.id}`, 'group', g.name, `<span class="badge">${g.members.length} items</span>`, `Group ${g.name}, ${g.members.length} items`)).join('') +
      objs.map((e) => row(`e:${e.id}`, 'object', e.name, of(e), lab(e))).join('') +
      `</ul><h3><span>Lights</span><span>${lights.length}</span></h3><ul>` +
      lights.map((e) => row(`e:${e.id}`, 'light', e.name, of(e), lab(e))).join('') + '</ul>';
  }

  // ---------- Cards ----------
  function head(kind, name, renamable, dots = true) {
    const nm = UI.renaming && renamable ? `<input id="grp-name-in" value="${esc(name)}" aria-label="Name" maxlength="80">` : esc(name);
    return `<div class="c-head"><div class="grow"><div class="c-kind">${kind}</div><div class="c-name"${renamable ? ` id="grp-name" tabindex="0" role="button" aria-label="${esc(name)}, double-click to rename"` : ''}>${nm}</div>${UI.err ? `<div class="c-err">${UI.err}</div>` : ''}</div>` +
      (dots ? `<button class="ib" data-act="dots" aria-label="Functions" aria-haspopup="menu" aria-expanded="${UI.menu === 'dots'}">${ICON.dots}</button>` : '') +
      `<button class="ib" data-act="close" aria-label="Close">${ICON.close}</button></div>`;
  }
  const FIT = `<button class="cbtn" data-act="fit" aria-label="Bring into view" title="Bring into view">${ICON.frame}</button>`;
  function lightSplit(keys) {
    const d = lightInfo(keys);
    return `<span class="split"><button class="cbtn" data-act="light" data-recipe="default" title="${esc(d.def)}">Light it</button><button class="cbtn chev" data-act="lightmenu" aria-label="Light it options" aria-haspopup="menu" aria-expanded="${UI.menu === 'light'}">${ICON.chev(UI.menu === 'light')}</button></span>`;
  }
  function menus(keys) {
    if (UI.menu === 'dots') return '<div class="menu" role="menu"><div class="mh">View</div><button role="menuitem" disabled aria-disabled="true">Face this<span class="soon">Soon</span></button><div class="mh">Story</div><button role="menuitem" disabled aria-disabled="true">Present this in Experience<span class="soon">Soon</span></button><hr><button role="menuitem" class="erase" data-act="erase">Erase <span style="font-size:12px;color:var(--mute)">⌫</span></button></div>';
    if (UI.menu === 'light') {
      const d = lightInfo(keys);
      return `<div class="menu" role="menu" id="grp-lmenu"><div class="mh">Light it</div><button role="menuitem" data-act="light" data-recipe="default"><span><b>${d.defName}</b><span class="det">${esc(d.def)}</span></span></button><button role="menuitem" data-act="light" data-recipe="showcase"><span><b>Showcase</b><span class="det">${esc(d.show)}</span></span></button></div>`;
    }
    return '';
  }
  function moreRow() {
    if (!coarse()) return '';
    return `<div class="c-acts"><button class="cbtn${UI.more ? ' on' : ''}" data-act="more" aria-pressed="${UI.more}">${UI.more ? 'Done' : '＋ Select more'}</button><span class="sp"></span><span class="c-hint">${UI.more ? 'Tap a subject to add or remove it' : 'Tap subjects to build a set'}</span></div>`;
  }
  function consequence() {
    if (!UI.confirm) return '';
    const s = UI.sel; let lines;
    if (s.k === 'group') { const g = grp(s.id); lines = [`Erases ${g.name} and its ${g.members.length} items: ${listNames(g.members.map((id) => ent(id).name))}.`, 'One Undo restores them.']; }
    else {
      const e = ent(s.id), g = e.group && grp(e.group), rest = g ? g.members.filter((m) => m !== e.id).map((m) => ent(m).name) : [];
      if (g && rest.length < 2) lines = [`Erases ${e.name}. ${g.name} would hold one item, so it dissolves: ${rest[0]} stays, ungrouped.`, 'One Undo restores both.'];
      else if (g) lines = [`Erases ${e.name}. ${g.name} keeps ${listNames(rest)}.`, 'One Undo restores it.'];
      else lines = [`Erases ${e.name}.`, 'One Undo restores it.'];
    }
    return `<section class="consequence" role="group" aria-label="Erase?">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}<div class="acts"><button class="remove" data-act="remove">Remove</button><button data-act="cancel">Cancel</button></div></section>`;
  }
  function groupCard(g) {
    const ms = g.members.map(ent), lit = ms.some((e) => e.kind !== 'light');
    let h = `<div class="card">${head(`Group · ${ms.length} items`, g.name, true)}${consequence()}`;
    h += `<div class="c-list">${ms.map((e) => `<button class="mrow" data-sel="e:${e.id}" title="Select ${esc(e.name)} in ${esc(g.name)}">${icon(kindIcon(e))}<span class="nm">${esc(e.name)}</span><span class="k">${KIND[e.kind]}</span><span class="go" aria-hidden="true">›</span></button>`).join('')}</div>`;
    h += `<div class="c-acts">${FIT}${lit ? lightSplit([`g:${g.id}`]) : ''}<button class="cbtn" data-act="dup">Duplicate</button><button class="cbtn" data-act="ungroup">Ungroup</button><span class="sp"></span></div>`;
    return `${h}${moreRow()}</div>${menus([`g:${g.id}`])}`;
  }
  const fld = (label, v, u) => field([label, v, u]);
  function entCard(e) {
    const g = e.group && grp(e.group);
    const kind = g ? `${KIND[e.kind]} · in <a data-sel="g:${g.id}" title="Select ${esc(g.name)}">${esc(g.name)}</a>`
      : e.kind === 'object' ? `Object · on ${supportAt(e.x, e.y) ? 'Platform' : 'the floor'}`
        : e.kind === 'artwork' ? 'Artwork · on Wall 1' : `Light · ${e.recipe === 'Wash' ? 'Wash' : 'Spot'}`;
    const fields = e.kind === 'object' ? `<div class="c-fields three">${fld('Width', e.w.toFixed(2), 'm')}${fld('Depth', e.d.toFixed(2), 'm')}${fld('Height', e.h.toFixed(2), 'm')}</div>`
      : e.kind === 'artwork' ? `<div class="c-fields two">${fld('Width', e.w.toFixed(2), 'm')}${fld('Height', e.h.toFixed(2), 'm')}</div>`
        : `<div class="c-fields two">${fld('Brightness', '1.00', '×')}${fld('Beam', e.recipe === 'Wash' ? '60' : '24', '°')}</div>`;
    let h = `<div class="card">${head(kind, e.name, true)}${consequence()}${fields}`;
    if (UI.offer && UI.offer.light === e.id && ent(UI.offer.subject)) {
      const sn = ent(UI.offer.subject).name;
      h += `<div class="offer"><span>Lights ${esc(sn)}</span><button class="cbtn" data-act="groupwith" title="Groups ${esc(sn)} and ${esc(e.name)} and selects the group. One undo.">Group with “${esc(sn)}”</button></div>`;
    }
    h += `<div class="c-acts">${FIT}${e.kind !== 'light' ? lightSplit([`e:${e.id}`]) : ''}<button class="cbtn" data-act="dup">Duplicate</button><span class="sp"></span><button class="cbtn" data-act="cardmore" aria-expanded="${UI.cardMore}">More ${ICON.chev(UI.cardMore)}</button></div>`;
    if (UI.cardMore) {
      const rel = [];
      if (g) rel.push(['In', `<a data-sel="g:${g.id}">${esc(g.name)}</a> · ${g.members.length} items`]);
      if (e.kind === 'object') rel.push(['On', supportAt(e.x, e.y) ? 'Platform' : 'the floor']);
      if (e.kind === 'artwork') { const by = Object.values(SC.ents).filter((l) => l.kind === 'light' && l.target === e.id); rel.push(['Lit by', by.length ? by.map((l) => `<a data-sel="e:${l.id}">${esc(l.name)}</a>`).join(' · ') : '—']); }
      if (e.kind === 'light') rel.push(['Lights', e.target && ent(e.target) ? `<a data-sel="e:${e.target}">${esc(ent(e.target).name)}</a>` : '—']);
      h += `<div class="c-more"><div class="c-sub">Relations</div><div class="rel">${rel.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('')}</div></div>`;
    }
    return `${h}${moreRow()}</div>${menus([`e:${e.id}`])}`;
  }
  function setCard() {
    const keys = UI.sel.items, groups = keys.filter((k) => k[0] === 'g'), lightKey = keys.some((k) => k[0] === 'e' && ent(k.slice(2)).kind === 'light');
    let h = `<div class="card">${head('Selection', `${keys.length} selected`, false, false)}`;
    h += `<div class="c-list">${keys.map((k) => { const isG = k[0] === 'g', e = !isG && ent(k.slice(2)); return `<div class="mrow static">${icon(isG ? 'group' : kindIcon(e))}<span class="nm">${esc(keyName(k))}</span><span class="k">${isG ? `Group · ${grp(k.slice(2)).members.length} items` : KIND[e.kind]}</span></div>`; }).join('')}</div>`;
    const why = [];
    if (groups.length) why.push(`Group: a group can’t hold another group. Ungroup ${listNames(groups.map(keyName))} first.`);
    if (lightKey) why.push('Light it: a light cannot be lit; select Artwork or an object.');
    if (why.length) h += `<div class="c-why">${why.map(esc).join('<br>')}</div>`;
    h += `<div class="c-acts"><button class="cbtn" data-act="group"${groups.length ? ' disabled' : ''}>Group</button>${lightKey ? '<button class="cbtn" disabled>Light it</button>' : lightSplit(keys)}<button class="cbtn" data-act="clear">Clear</button><span class="sp"></span></div>`;
    return `${h}${moreRow()}</div>${menus(keys)}`;
  }
  function cardHtml() {
    const s = UI.sel;
    if (s.k === 'group') return groupCard(grp(s.id));
    if (s.k === 'ent') return entCard(ent(s.id));
    if (s.k === 'set') return setCard();
    if (s.k === 'layout') return `<div class="card">${head('Layout', LAYOUT[s.id].name, false, false)}<p class="c-why" style="padding-top:2px">Layout Cards are unchanged (Card section). Layout subjects never join a set or a group.</p></div>`;
    return `<p class="note">No Card while nothing is selected.${coarse() ? ' Select one subject, then <b>Select more</b> on its Card.' : ''}</p>`;
  }
  function renderPanels() {
    root.classList.toggle('coarse', coarse());
    indexEl.innerHTML = indexHtml();
    cardEl.innerHTML = cardHtml();
    const lm = cardEl.querySelector('#grp-lmenu'), sp = cardEl.querySelector('.split');
    if (lm && sp) { lm.style.top = `${sp.offsetTop + sp.offsetHeight + 4}px`; lm.style.left = `${Math.max(6, sp.offsetLeft - 6)}px`; lm.style.right = 'auto'; lm.style.width = '300px'; }
    if (UI.renaming) { const i = cardEl.querySelector('#grp-name-in'); if (i) { i.focus(); i.select(); } }
    pillEl.hidden = !UI.more;
    pillEl.innerHTML = UI.more ? '<span>Select more · tap to add or remove</span><button type="button" class="pill-primary" data-act="more">Done</button>' : '';
    root.querySelectorAll('#grp-tool button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === UI.tool)));
    root.querySelectorAll('#grp-ptr button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === UI.pointer)));
    statusEl.textContent = UI.status;
  }
  function render() { UI.sel = valid(UI.sel); renderStage(); renderPanels(); }

  // ---------- actions ----------
  function setTool(t) { UI.tool = t; UI.arm = null; UI.press = null; UI.more = false; UI.status = t === 'erase' ? (coarse() ? 'Erase: press shows what it would erase; release erases. A group asks first.' : 'Erase: hover shows what a click erases. A group asks first.') : ''; render(); }
  function act(a, data) {
    const s = UI.sel, keys = s.k === 'set' ? s.items : s.k === 'group' ? [`g:${s.id}`] : s.k === 'ent' ? [`e:${s.id}`] : [];
    switch (a) {
      case 'dots': UI.menu = UI.menu === 'dots' ? null : 'dots'; break;
      case 'lightmenu': UI.menu = UI.menu === 'light' ? null : 'light'; break;
      case 'close': UI.more = false; pick(NONE); return;
      case 'clear': UI.more = false; pick(NONE); return;
      case 'erase': UI.menu = null; UI.confirm = true; break;
      case 'cancel': UI.confirm = false; break;
      case 'remove': UI.confirm = false; if (s.k === 'group') eraseGroup(s.id); else if (s.k === 'ent') eraseEnt(s.id); return;
      case 'dup': if (s.k === 'group') duplicateGroup(s.id); else if (s.k === 'ent') duplicateEnt(s.id); return;
      case 'ungroup': if (s.k === 'group') ungroup(s.id); return;
      case 'group': groupSet(); return;
      case 'groupwith': groupWith(); return;
      case 'light': UI.menu = null; lightIt(keys, data.recipe === 'showcase' ? 'showcase' : 'default'); return;
      case 'cardmore': UI.cardMore = !UI.cardMore; break;
      case 'fit': UI.status = 'Bring into view frames the whole group (unchanged behaviour).'; break;
      case 'more':
        if (UI.more) { UI.more = false; break; }
        UI.more = true; UI.tool = 'select'; setSel(fromKeys(selKeys())); UI.status = 'Select more · tap subjects to add or remove them; a member adds its whole group.'; render(); return; // a drilled member first normalizes to its group
      default: return;
    }
    render();
  }
  cardEl.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act],[data-sel]');
    if (!t || t.disabled) { if (UI.menu && !e.target.closest('.menu')) { UI.menu = null; render(); } return; }
    if (t.dataset.sel) { const k = t.dataset.sel; UI.more = false; pick(k[0] === 'g' ? { k: 'group', id: k.slice(2) } : { k: 'ent', id: k.slice(2) }); return; }
    act(t.dataset.act, t.dataset);
  });
  pillEl.addEventListener('click', (e) => { if (e.target.closest('[data-act="more"]')) { UI.more = false; render(); } });
  cardEl.addEventListener('dblclick', (e) => { if (e.target.closest('#grp-name') && !UI.renaming) { UI.renaming = true; UI.menu = null; UI.err = ''; render(); } });
  function commitName(v) {
    v = v.trim(); const s = UI.sel, obj = s.k === 'group' ? grp(s.id) : ent(s.id);
    if (!v) { UI.err = 'A name can’t be empty'; UI.renaming = false; render(); return; }
    if (v !== obj.name) { snapshot(); obj.name = v; UI.status = `Renamed to ${v}. One Undo.`; }
    UI.err = ''; UI.renaming = false; render();
  }
  cardEl.addEventListener('keydown', (e) => {
    if (e.target.id === 'grp-name-in') {
      if (e.key === 'Enter') commitName(e.target.value);
      if (e.key === 'Escape') { e.stopPropagation(); UI.renaming = false; render(); }
      return;
    }
    if (e.target.id === 'grp-name' && (e.key === 'Enter' || e.key === 'F2')) { e.preventDefault(); UI.renaming = true; render(); }
  });
  cardEl.addEventListener('focusout', (e) => { if (e.target.id === 'grp-name-in' && UI.renaming) setTimeout(() => { if (UI.renaming) { UI.renaming = false; render(); } }, 0); });
  indexEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]'); if (!b) return;
    const k = b.dataset.key, norm = k[0] === 'g' ? k : topKey(ent(k.slice(2)));
    if (UI.more || e.shiftKey) { toggle(norm); return; }
    pick(k[0] === 'g' ? { k: 'group', id: k.slice(2) } : { k: 'ent', id: k.slice(2) });
  });
  root.querySelectorAll('#grp-tool button').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.v)));
  root.querySelectorAll('#grp-ptr button').forEach((b) => b.addEventListener('click', () => { UI.pointer = b.dataset.v; UI.more = false; UI.hov = null; UI.hovH = null; setTool('select'); }));
  document.getElementById('grp-undo').addEventListener('click', undo);
  document.getElementById('grp-reset').addEventListener('click', () => { SC = SC0(); UI = UI0(UI.pointer); seq = 1; render(); });

  // ---------- Stage pointer ----------
  function cursorFor(p) {
    if (UI.tool === 'erase') return UI.hov && UI.hov.id ? 'pointer' : 'default';
    if (UI.hovH) return 'grab';
    const h = UI.hov; if (!h) return 'default';
    const subj = subjectNow();
    return h.id && subj && subj.ids.includes(h.id) && ent(h.id).kind !== 'light' ? 'grab' : 'pointer';
  }
  function updateHover(p) {
    const H = HND.find((x) => d2(p, x.p) < x.r), hk = H ? H.k : null, h = H ? null : hitAt(p);
    const key = h ? (h.id ? `e:${h.id}` : `l:${h.layout}`) : null, prev = UI.hov ? (UI.hov.id ? `e:${UI.hov.id}` : `l:${UI.hov.layout}`) : null;
    const changed = hk !== UI.hovH || key !== prev;
    UI.hovH = hk; UI.hov = h; svg.style.cursor = cursorFor(p);
    if (changed || (UI.shift && h)) renderStage();
  }
  svg.addEventListener('pointerenter', () => { UI.over = true; });
  svg.addEventListener('pointerleave', () => { UI.over = false; if (!UI.drag) { UI.hov = null; UI.hovH = null; UI.at = null; renderStage(); } });
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    svg.focus({ preventScroll: true });
    const p = svgPt(svg, e); UI.at = p; UI.shift = e.shiftKey;
    if (UI.menu) { UI.menu = null; renderPanels(); }
    try { svg.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer has nothing to capture */ }
    if (UI.tool === 'erase') { const h = hitAt(p); UI.press = h && h.id ? topKey(ent(h.id)) : null; if (UI.arm && UI.press !== UI.arm) UI.arm = null; renderStage(); return; }
    const subj = subjectNow(), hh = HND.find((x) => d2(p, x.p) < x.r);
    if (hh && subj) {
      UI.drag = { k: hh.k, subj, p0: p, at: p, moved: false, a0: deg(sub(invAt(p, subj.zr), subj.pv)) };
      return;
    }
    UI.drag = { k: 'press', subj, p0: p, at: p, moved: false, hit: hitAt(p) };
  });
  svg.addEventListener('pointermove', (e) => {
    const p = svgPt(svg, e); UI.at = p; UI.shift = e.shiftKey;
    const D = UI.drag;
    if (!D) { if (!UI.press) updateHover(p); return; }
    D.at = p;
    if (!D.moved && d2(p, D.p0) < 4) return;
    if (!D.moved && D.k === 'press') {
      const h = D.hit, subj = D.subj;
      if (UI.more || !h || !h.id || e.shiftKey) D.k = 'none';
      else if (UI.sel.k === 'set' && selEnts().includes(h.id)) D.k = 'setdrag';
      else if (subj && subj.ids.includes(h.id) && ent(h.id).kind !== 'light') D.k = subj.kind === 'artwork' ? 'slide' : 'move';
      else D.k = 'none';
    }
    D.moved = true;
    if (D.k === 'move' || D.k === 'turn' || D.k === 'slide') computeCand(D, e.altKey);
    if (D.k !== 'none') renderStage();
  });
  svg.addEventListener('pointerup', (e) => {
    const p = svgPt(svg, e);
    if (UI.tool === 'erase') { eraseRelease(p); return; }
    const D = UI.drag; if (!D) return;
    UI.drag = null;
    if (D.moved) { if (D.k === 'move' || D.k === 'turn' || D.k === 'slide') commit(D); else { UI.cand = null; render(); } return; }
    UI.cand = null;
    if (D.k === 'press') click(D.hit, p, e.shiftKey); else render();
  });
  svg.addEventListener('pointercancel', () => { UI.drag = null; UI.cand = null; UI.press = null; render(); });
  function click(h, p, shift) {
    if (UI.more) { // coarse Select more: a tap toggles the normalized target; an empty tap does nothing
      if (!h) { render(); return; }
      if (h.layout) { flash(p, 'Only Scene subjects join a set', true); render(); return; }
      toggle(topKey(ent(h.id)), p); return;
    }
    if (shift) {
      if (!h) { render(); return; }
      if (h.layout) { flash(p, 'Only Scene subjects join a set', true); render(); return; }
      toggle(topKey(ent(h.id)), p); return;
    }
    if (!h) { pick(NONE); return; }
    if (h.layout) { pick({ k: 'layout', id: h.layout }); return; }
    pick(targetForHit(h.id));
  }
  function eraseRelease(p) {
    const key = UI.press; UI.press = null;
    const h = hitAt(p), at = h && h.id ? topKey(ent(h.id)) : null;
    if (!key || key !== at) { render(); return; } // releasing elsewhere erases nothing
    if (key[0] === 'g') {
      if (UI.arm === key) { UI.arm = null; eraseGroup(key.slice(2)); return; }
      UI.arm = key; const g = grp(key.slice(2));
      UI.status = `Erase group · ${g.members.length} items. Click again to erase.`; render(); return;
    }
    UI.arm = null; eraseEnt(key.slice(2));
  }

  // ---------- keys: scoped to this section ----------
  document.addEventListener('pointerdown', (e) => { UI.engaged = root.contains(e.target); }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift' && UI.over) { UI.shift = true; renderStage(); }
    if (!UI.engaged && !UI.over) return;
    if (e.target && e.target.id === 'grp-name-in') return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') { e.preventDefault(); escRung()[1](); return; }
    if (mod && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      if (e.shiftKey && UI.sel.k === 'group') ungroup(UI.sel.id);
      else if (!e.shiftKey && UI.sel.k === 'set') groupSet();
    }
  });
  document.addEventListener('keyup', (e) => { if (e.key === 'Shift' && UI.shift) { UI.shift = false; if (UI.over) renderStage(); } });

  // Paper follows the gear's 3D board choice, as every other 3D stage does.
  STAGES.p3.push('#sv-grp'); applyTones();
  render();
})();
