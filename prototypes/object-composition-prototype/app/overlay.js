// Per-frame Paper overlays: identity, reach, lifetimes and relationships drawn where they
// happen. A keyed element pool keeps DOM churn low; a priority pass hides colliding labels.
import * as THREE from 'three';
import { S, D } from './state.js';
import * as A from './actions.js';
import { defOf, iface, partAt, featureAt, valueOf, overridesOf, compileLayout, wallById, poseOf, nearWalls, fmt, deg, showValue, PLINTH } from './model.js';
import { esc } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const V3 = THREE.Vector3;

export class Overlay {
  constructor(svg, html) {
    this.svg = svg;
    this.html = html;
    this.map = new Map();
    this.used = new Set();
    this.tags = [];
  }
  begin() { this.used.clear(); this.tags = []; }
  get(key, make) {
    let el = this.map.get(key);
    if (!el) { el = make(); this.map.set(key, el); }
    this.used.add(key);
    return el;
  }
  path(key, d, cls) {
    const el = this.get(key, () => { const e = document.createElementNS(NS, 'path'); this.svg.appendChild(e); return e; });
    if (el._d !== d) { el.setAttribute('d', d); el._d = d; }
    if (el._c !== cls) { el.setAttribute('class', cls); el._c = cls; }
    return el;
  }
  circle(key, x, y, r, cls) {
    const el = this.get(key, () => { const e = document.createElementNS(NS, 'circle'); this.svg.appendChild(e); return e; });
    el.setAttribute('cx', x.toFixed(1)); el.setAttribute('cy', y.toFixed(1)); el.setAttribute('r', r);
    if (el._c !== cls) { el.setAttribute('class', cls); el._c = cls; }
  }
  tag(key, html, x, y, cls, prio = 50, opts = {}) {
    const el = this.get(key, () => { const e = document.createElement(opts.button ? 'button' : 'div'); this.html.appendChild(e); return e; });
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    const c = `ovt ${cls}`;
    if (el._c !== c) { el.className = c; el._c = c; }
    if (opts.data) for (const [k, v] of Object.entries(opts.data)) if (el.dataset[k] !== String(v)) el.dataset[k] = v;
    if (opts.label && el.getAttribute('aria-label') !== opts.label) el.setAttribute('aria-label', opts.label);
    el.style.left = `${x.toFixed(1)}px`;
    el.style.top = `${y.toFixed(1)}px`;
    el.style.visibility = '';
    this.tags.push({ el, prio });
    return el;
  }
  end() {
    for (const [k, el] of this.map) if (!this.used.has(k)) { el.remove(); this.map.delete(k); }
    // declutter: read all rects, then hide lower-priority labels that collide
    const rects = this.tags.map((t) => ({ ...t, r: t.el.getBoundingClientRect() })).sort((a, b) => b.prio - a.prio);
    const placed = [];
    for (const t of rects) {
      const hit = t.prio < 95 && placed.some((p) => t.r.left < p.right - 2 && t.r.right > p.left + 2 && t.r.top < p.bottom - 2 && t.r.bottom > p.top + 2);
      if (hit) t.el.style.visibility = 'hidden'; else placed.push(t.r);
    }
  }
}

const bracket = (r, pad = 6, len = 10) => {
  const x0 = r.x0 - pad; const y0 = r.y0 - pad; const x1 = r.x1 + pad; const y1 = r.y1 + pad;
  const l = Math.min(len, (x1 - x0) / 3, (y1 - y0) / 3);
  return `M${x0},${y0 + l}V${y0}H${x0 + l}M${x1 - l},${y0}H${x1}V${y0 + l}M${x1},${y1 - l}V${y1}H${x1 - l}M${x0 + l},${y1}H${x0}V${y1 - l}`;
};
const box = (r, pad = 8, rad = 5) => {
  const x0 = r.x0 - pad; const y0 = r.y0 - pad; const x1 = r.x1 + pad; const y1 = r.y1 + pad;
  return `M${x0 + rad},${y0}H${x1 - rad}Q${x1},${y0} ${x1},${y0 + rad}V${y1 - rad}Q${x1},${y1} ${x1 - rad},${y1}H${x0 + rad}Q${x0},${y1} ${x0},${y1 - rad}V${y0 + rad}Q${x0},${y0} ${x0 + rad},${y0}Z`;
};
const union = (rs) => {
  const v = rs.filter(Boolean);
  if (!v.length) return null;
  return { x0: Math.min(...v.map((r) => r.x0)), y0: Math.min(...v.map((r) => r.y0)), x1: Math.max(...v.map((r) => r.x1)), y1: Math.max(...v.map((r) => r.y1)) };
};

// view: what main.js rendered this frame (doc, C, bench, review candidate…)
export function drawOverlay(ov, stage, view) {
  ov.begin();
  const doc = view.doc;
  const C = view.C;
  const I = S.instr;
  const bench = !!view.bench;
  const W = stage.canvas.clientWidth;
  const H = stage.canvas.clientHeight;
  const on = (r) => r && r.x1 > 0 && r.y1 > 0 && r.x0 < W && r.y0 < H;

  if (bench) drawBench(ov, stage, view);
  else {
    // --- origin (only while the world has no architecture)
    if (!C && !I) {
      const o = stage.toScreen(new V3(0, 0, 0));
      if (!o.behind) ov.tag('origin', 'world origin', o.x + 8, o.y + 6, 'quiet', 10);
    }

    // --- hover (at the level a click would select)
    const hv = view.hover;
    if (hv && !(hv.kind === 'use' && S.sel?.kind === 'use' && hv.id === S.sel.id && (hv.path ?? []).join('/') === (S.sel.path ?? []).join('/'))) {
      if (hv.kind === 'use') {
        const r = stage.rectOfUse(hv.id, hv.path ?? []);
        if (on(r)) ov.path('hover', bracket(r, 5, 8), 'ov-hover');
      } else if (hv.kind === 'group') {
        const r = union(doc.groups[hv.id]?.members.map((m) => stage.rectOfUse(m)) ?? []);
        if (on(r)) ov.path('hover', box(r, 12, 7), 'ov-hover group');
      } else if (hv.kind === 'wall') {
        const r = stage.rectOfWall(hv.id);
        if (on(r)) ov.path('hover', bracket(r, 3, 14), 'ov-hover');
      }
    }

    // --- group bracket
    const gid = S.sel?.kind === 'group' ? S.sel.id : S.ctx?.group ?? (hv?.kind === 'group' ? hv.id : null);
    if (gid && doc.groups[gid]) {
      const r = union(doc.groups[gid].members.map((m) => stage.rectOfUse(m)));
      if (on(r)) {
        ov.path('grp', box(r, 14, 8), `ov-group ${S.sel?.kind === 'group' ? 'sel' : ''}`);
        ov.tag('grp-t', `<b>${esc(doc.groups[gid].name)}</b> · organizes only`, r.x0 - 14, r.y0 - 18, 'group left', 80);
      }
    }

    // --- selection
    const sel = S.sel;
    const selIds = [...S.multi, ...(sel?.kind === 'use' && !sel.path?.length ? [sel.id] : [])];
    if (S.multi.length) selIds.forEach((id, i) => { const r = stage.rectOfUse(id); if (on(r)) ov.path(`msel${i}`, bracket(r), 'ov-sel'); });
    if (sel?.kind === 'use' && doc.uses[sel.id] && !S.multi.length) {
      const u = doc.uses[sel.id];
      const r = stage.rectOfUse(sel.id, sel.path ?? []);
      const p = sel.path?.length ? partAt(doc, u.def, sel.path) : null;
      const enclosed = p?.enclosedBy && !(I?.kind === 'inspect' && I.use === sel.id);
      if (on(r)) {
        ov.path('sel', bracket(r, sel.path?.length ? 4 : 6), `ov-sel ${enclosed ? 'enclosed' : ''}`);
        const label = p ? `<b>${esc(p.name)}</b> · ${esc(u.name)} <span class="ref">${esc(sel.id)}</span>${enclosed ? ' <i>enclosed — Inspect to see it</i>' : ''}` : `<b>${esc(u.name)}</b> <span class="ref">${esc(sel.id)}</span>`;
        ov.tag('sel-t', label, r.x0 - 6, r.y0 - 10, 'sel above-left', 96);
      } else if (r) edgeBeacon(ov, r, W, H, u.name);
    } else if (sel?.kind === 'wall' || sel?.kind === 'opening') {
      const r = sel.kind === 'wall' ? stage.rectOfWall(sel.id) : null;
      if (on(r)) ov.path('sel', bracket(r, 3, 16), 'ov-sel');
    }

    // --- reach: what an edit will touch, before it happens
    if (S.reach && doc.uses[S.reach.uid]) {
      const scope = S.reach.scope ?? (S.approach === 'contextual' ? S.reachScope : 'use');
      const R = A.reachOf(doc, S.reach.uid, S.reach.key, scope);
      const f = featureAt(doc, doc.uses[S.reach.uid].def, S.reach.key);
      R.changes.forEach((id, i) => {
        const r = stage.rectOfUse(id);
        if (!on(r)) return;
        ov.path(`rc${i}`, box(r, 10, 6), 'ov-reach');
        ov.tag(`rct${i}`, `→ changes${S.reach.value !== undefined ? `: <b>${esc(showValue(S.reach.key, S.reach.value))}</b>` : ''}`, (r.x0 + r.x1) / 2, r.y1 + 16, 'reach', 92);
      });
      R.keeps.forEach((id, i) => {
        const r = stage.rectOfUse(id);
        if (!on(r)) return;
        ov.tag(`rk${i}`, `◆ keeps its own ${esc(showValue(S.reach.key, doc.uses[id].sets[S.reach.key]))}`, (r.x0 + r.x1) / 2, r.y1 + 16, 'keeps', 91);
      });
      R.others.forEach((id, i) => {
        const r = stage.rectOfUse(id);
        if (!on(r)) return;
        ov.tag(`ro${i}`, 'unchanged', (r.x0 + r.x1) / 2, r.y1 + 16, 'quiet', 60);
      });
      if (f && scope === 'def') ov.tag('reach-k', `Reach: every use of <b>${esc(defOf(doc, doc.uses[S.reach.uid].def).name)}</b> — ${R.changes.length} change${R.changes.length === 1 ? 's' : ''}, ${R.keeps.length} keep${R.keeps.length === 1 ? 's' : ''} its own`, 60, H - 34, 'reach legend left', 99);
      else if (f) ov.tag('reach-k', `Reach: <b>this use only</b> — ${R.others.length} other use${R.others.length === 1 ? '' : 's'} unchanged`, 60, H - 34, 'reach legend left', 99);
    }

    // --- relationships: attachments, proximity, repair states
    const selWall = sel?.kind === 'wall' ? sel.id : I?.kind === 'wallmove' ? I.wall : null;
    for (const uid of Object.keys(doc.uses)) {
      const u = doc.uses[uid];
      const showRel = (sel?.kind === 'use' && sel.id === uid) || (u.attach && selWall === u.attach.host) || (hv?.kind === 'use' && hv.id === uid);
      if (u.attach?.broken) {
        const r = stage.rectOfUse(uid);
        if (on(r)) { ov.path(`brk${uid}`, box(r, 6, 4), 'ov-gone'); ov.tag(`brk-t${uid}`, `✕ host removed — ${esc(u.attach.host)}`, (r.x0 + r.x1) / 2, r.y0 - 8, 'gone above', 94); }
        continue;
      }
      if (u.attach && showRel && C) {
        const w = wallById(C, u.attach.host);
        if (!w) continue;
        const p = poseOf(doc, C, uid);
        const back = new V3(p.x - w.n[0] * (PLINTH[2] / 2), p.y + PLINTH[1] - 0.09, p.z - w.n[1] * (PLINTH[2] / 2));
        const s = stage.toScreen(back);
        if (!s.behind) {
          ov.circle(`pin${uid}`, s.x, s.y, 4, 'ov-pin');
          ov.tag(`pin-t${uid}`, `⊢ hung on <b>${esc(w.name)}</b> <span class="ref">${esc(w.id)}</span> · cleat · ${fmt(u.attach.s)} m along, ${fmt(u.attach.h)} m up`, s.x + 10, s.y, 'rel right-of', 85);
        }
      }
      // issues on the use (visible without selecting)
      if (!(sel?.kind === 'use' && sel.id === uid) && !I) {
        const ovr = overridesOf(doc, uid);
        const nG = ovr.filter((o) => o.status === 'unresolved').length;
        const nB = ovr.filter((o) => o.status === 'incompatible').length;
        if (nG || nB) {
          const r = stage.rectOfUse(uid);
          if (on(r)) ov.tag(`iss${uid}`, `${nG ? `✕${nG} unresolved` : ''}${nG && nB ? ' · ' : ''}${nB ? `!${nB} not allowed` : ''}`, (r.x0 + r.x1) / 2, r.y0 - 8, `${nG ? 'gone' : 'bad'} above`, 70);
        }
      }
    }
    if (selWall && C) {
      for (const uid of Object.keys(doc.uses)) {
        for (const n of nearWalls(doc, C, uid)) {
          if (n.wall.id !== selWall) continue;
          const r = stage.rectOfUse(uid);
          if (on(r)) ov.tag(`near${uid}`, n.through ? '! wall passes through — not attached, it stays' : `near · <b>not attached</b> (${fmt(Math.max(0, n.gap))} m)`, (r.x0 + r.x1) / 2, r.y1 + 14, n.through ? 'bad' : 'quiet', n.through ? 93 : 75);
        }
      }
    }

    // --- inspection: view-only separation leaders
    if (I?.kind === 'inspect') {
      stage.leaders.forEach((l, i) => {
        const a = stage.toScreen(l.from);
        const b = stage.toScreen(l.to);
        if (a.behind || b.behind) return;
        ov.path(`ld${i}`, `M${a.x},${a.y}L${b.x},${b.y}`, 'ov-view');
        ov.circle(`lda${i}`, a.x, a.y, 2.2, 'ov-view-dot');
      });
      const r = stage.rectOfUse(I.use);
      if (on(r) && I.sep > 0.02) ov.tag('view-t', '⬚ separated for looking · <b>view only</b>', (r.x0 + r.x1) / 2, r.y0 - 12, 'view above', 88);
    }

    // --- articulation preview arc
    if (I?.kind === 'preview' && doc.uses[I.use]) drawArc(ov, stage, doc, I);

    // --- hang tool
    if (I?.kind === 'hang' && I.cand && C) {
      const c = I.cand;
      const w = wallById(C, c.wall);
      if (c.back) {
        const r = stage.rectOfWall(c.wall);
        if (r) ov.tag('hang-n', '✕ That is the outside of the bay — point at the room side.', (r.x0 + r.x1) / 2, r.y0 + 20, 'refuse', 97);
      } else if (w) {
        const p = A.hangPoseFor(w, c.s, c.h);
        const top = stage.toScreen(new V3(p.x, p.y + PLINTH[1] + 0.06, p.z));
        const foot = stage.toScreen(new V3(p.x, 0.02, p.z));
        const mid = stage.toScreen(new V3(p.x, p.y + PLINTH[1] / 2, p.z));
        if (!foot.behind) {
          ov.path('hang-h', `M${foot.x},${foot.y}L${mid.x},${mid.y}`, c.chk.ok ? 'ov-tape-line' : 'ov-refuse-line');
          ov.tag('hang-ht', `<span class="k">up</span>${fmt(c.h)} m`, (foot.x + mid.x) / 2 + 8, (foot.y + mid.y) / 2, 'tape left', 90);
        }
        if (!top.behind) {
          ov.tag('hang-st', `<span class="k">along</span>${fmt(c.s)} m`, top.x, top.y - 4, 'tape above', 90);
          if (!c.chk.ok) ov.tag('hang-n', `<b>✕ ${esc(c.chk.reason)}</b> ${esc(c.chk.fix)}`, top.x, top.y - 32, 'refuse above', 98);
          else ov.tag('hang-n', 'Click to hang here', top.x, top.y - 32, 'guide above', 90);
        }
      }
    }
    // dragging a hung object along its wall
    if (S.drag?.kind === 'along' && S.drag.cand && C) {
      const c = S.drag.cand;
      const w = wallById(C, S.drag.host);
      const p = A.hangPoseFor(w, c.s, c.h);
      const top = stage.toScreen(new V3(p.x, p.y + PLINTH[1] + 0.06, p.z));
      if (!top.behind) {
        ov.tag('drag-st', `<span class="k">along</span>${fmt(c.s)} m <span class="k">up</span>${fmt(c.h)} m`, top.x, top.y - 4, 'tape above', 90);
        if (!c.chk.ok) ov.tag('drag-n', `<b>✕ ${esc(c.chk.reason)}</b> Release cancels — nothing changes.`, top.x, top.y - 32, 'refuse above', 98);
      }
    }

    // --- Layout: wall move handle
    const wm = I?.kind === 'wallmove' ? I : S.mode === 'layout' && sel?.kind === 'wall' && sel.id === 'W-FJSK' ? { wall: 'W-FJSK', off: 0, idle: true } : null;
    if (wm && C) {
      const w = wallById(C, wm.wall);
      if (w) {
        const mid = new V3((w.a[0] + w.b[0]) / 2 - 0.9, 1.6, (w.a[1] + w.b[1]) / 2 + w.n[1] * (w.t / 2 + 0.02));
        const s = stage.toScreen(mid);
        const s2 = stage.toScreen(mid.clone().add(new V3(w.n[0] * 0.5, 0, w.n[1] * 0.5)));
        if (!s.behind) {
          const ang = (Math.atan2(s2.y - s.y, s2.x - s.x) * 180) / Math.PI;
          ov.tag('wm-h', `<span class="arr" style="transform:rotate(${ang.toFixed(1)}deg)">⟷</span>`, s.x, s.y, 'wall-handle', 99, { button: true, data: { drag: 'wall' }, label: 'Drag to move the back wall along its normal' });
          if (!wm.idle) ov.tag('wm-t', `<span class="k">offset</span>${wm.off >= 0 ? '+' : '−'}${fmt(Math.abs(wm.off))} m`, s.x, s.y - 30, 'tape above', 95);
          else ov.tag('wm-t', 'Drag to move · Layout', s.x, s.y - 26, 'quiet above', 60);
        }
      }
    }

    // --- review legend
    if (I?.kind === 'review') {
      ov.tag('rv-leg', I.show === 'both' ? '<b>solid</b> = rev 2 candidate with your choices · <b>dashed</b> = rev 1, as it is now' : I.show === 'rev1' ? 'Showing rev 1 — the accepted revision' : 'Showing the rev 2 candidate — not applied', 60, H - 34, 'legend left', 99);
      for (const uid of Object.keys(doc.uses)) {
        const r = stage.rectOfUse(uid);
        if (!on(r)) continue;
        const ovr = overridesOf(view.review ?? doc, uid);
        const nG = ovr.filter((o) => o.status === 'unresolved').length;
        const nB = ovr.filter((o) => o.status === 'incompatible').length;
        if (nG || nB) ov.tag(`rvu${uid}`, `${nG ? `✕${nG} unresolved` : ''}${nG && nB ? ' · ' : ''}${nB ? `!${nB} not allowed` : ''}`, (r.x0 + r.x1) / 2, r.y0 - 8, `${nG ? 'gone' : 'bad'} above`, 70);
      }
    }
  }
  ov.end();
}

function edgeBeacon(ov, r, W, H, name) {
  const cx = Math.min(W - 30, Math.max(60, (r.x0 + r.x1) / 2));
  const cy = Math.min(H - 30, Math.max(20, (r.y0 + r.y1) / 2));
  ov.tag('beacon', `${esc(name)} is out of view — <b>F</b> to frame`, cx, cy, 'sel', 97);
}

function drawArc(ov, stage, doc, I) {
  const u = doc.uses[I.use];
  const f = featureAt(doc, u.def, I.key);
  const comp = I.key.includes('/') ? I.key.split('/').slice(0, -1) : [];
  const piv = stage.armPivotWorld(I.use, comp);
  if (!piv || !f) return;
  const R = 0.36;
  const at = (deg) => {
    const t = (deg * Math.PI) / 180;
    return piv.o.clone().add(piv.up.clone().multiplyScalar(Math.cos(t) * R)).add(piv.fw.clone().multiplyScalar(Math.sin(t) * R));
  };
  let d = '';
  for (let a = f.min; a <= f.max + 0.01; a += 2.5) {
    const s = stage.toScreen(at(a));
    d += `${d ? 'L' : 'M'}${s.x.toFixed(1)},${s.y.toFixed(1)}`;
  }
  ov.path('arc', d, 'ov-run-arc');
  const base = valueOf(doc, I.use, I.key).value;
  const bS = stage.toScreen(at(base));
  const o = stage.toScreen(piv.o);
  ov.path('arc-b', `M${o.x},${o.y}L${bS.x},${bS.y}`, 'ov-base-line');
  ov.tag('arc-bt', `baseline ${deg(base)}`, bS.x + 8, bS.y, 'quiet right-of', 80);
  const cS = stage.toScreen(at(I.value));
  ov.circle('arc-c', cS.x, cS.y, 5, 'ov-run-dot');
  ov.tag('arc-ct', `▶ ${deg(I.value)} · <b>preview, not saved</b>`, cS.x + 10, cS.y - 14, 'run right-of', 95);
  const mn = stage.toScreen(at(f.min));
  const mx = stage.toScreen(at(f.max));
  ov.tag('arc-min', `${f.min}°`, mn.x, mn.y, 'quiet', 40);
  ov.tag('arc-max', `${f.max}° limit`, mx.x, mx.y, 'quiet', 40);
}

function drawBench(ov, stage, view) {
  const doc = view.bench.doc;
  const d = doc.defs[view.bench.defId];
  const Iface = iface(doc, d.id);
  const W = stage.canvas.clientWidth;
  const H = stage.canvas.clientHeight;
  for (const p of Iface.parts.filter((x) => x.comp)) {
    const r = stage.benchRect([p.id]);
    if (!r) continue;
    ov.path(`bc${p.id}`, bracket(r, 4, 8), 'ov-comp');
    ov.tag(`bct${p.id}`, `<b>${esc(p.name)}</b> <span class="ref">${esc(p.id)}</span>`, r.x1 + 10, (r.y0 + r.y1) / 2, 'comp right-of', 80);
  }
  const o = stage.toScreen(new V3(0, 0, 0));
  if (!o.behind) ov.tag('b-origin', 'definition origin', o.x + 8, o.y + 8, 'quiet', 30);
  // uses band: who follows the draft, who keeps their own
  const I = S.instr;
  const draftKeys = Object.keys(I?.draft ?? {});
  const users = Object.values(D().uses).filter((u) => u.def === d.id);
  const cards = users.map((u) => {
    const keep = draftKeys.filter((k) => u.sets?.[k] !== undefined);
    const st = !draftKeys.length ? 'inherits from here' : keep.length === draftKeys.length ? `◆ keeps its own ${keep.map((k) => esc(showValue(k, u.sets[k]))).join(', ')}` : keep.length ? `changes · keeps its own ${keep.map((k) => esc(showValue(k, u.sets[k]))).join(', ')}` : '→ follows the draft';
    return `<div class="use-card ${!draftKeys.length ? '' : keep.length === draftKeys.length ? 'keeps' : 'follows'}"><b>${esc(u.name)}</b> <span class="ref">${esc(u.id)}</span><span>${st}</span></div>`;
  }).join('');
  ov.tag('b-uses', `<div class="use-k">Used by ${users.length}</div>${cards}`, W / 2, H - 14, 'uses-band', 99);
}
