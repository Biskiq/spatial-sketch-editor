// Experience lens: Index of Presentations, Card, Guide instrument, Stage markers, Preview takeover.
import { icon } from './icons.js';
import * as SC from './scene.js';
import { $, S, M, H, R, UI, esc, f2, clamp, ent, view, pres, guide, focal, wpx, toPx, commit, toast, uid } from './core.js';

export function expEnt(id) {
  if (!id) return null;
  const v = view(id); if (v) return { ...v, kind: 'view', icon: 'camera' };
  const p = pres(id); if (p) return { ...p, kind: 'presentation', icon: 'layers' };
  const lv = M.levels.find((l) => l.id === id); if (lv) return { ...lv, kind: 'level', icon: 'layers' };
  const g = guide(); const si = g.stops.findIndex((s) => s.id === id);
  if (si >= 0) return { ...g.stops[si], kind: 'stop', idx: si, name: `Stop ${si + 1} · ${pres(g.stops[si].pres)?.name}`, icon: 'guide' };
  if (id.startsWith('edge-')) { const i = +id.slice(5); return { ...g.edges[i], kind: 'edge', idx: i, name: `Stop ${i + 1} → ${i + 2}`, icon: 'travel' }; }
  return null;
}

export function expIndex() {
  const g = guide(); const q = (S.exSearch || '').toLowerCase();
  let h = `<div class="ilist"><div class="igroup"><span>Presentations</span><span>${M.presentations.length}</span></div>`;
  for (const p of M.presentations.filter((p) => !q || p.name.toLowerCase().includes(q))) {
    const open = S.sel === p.id || p.views.includes(S.sel);
    h += `<div class="irow${S.sel === p.id ? ' sel' : ''}"><button class="nmb" data-act="sel" data-id="${p.id}"><span class="thumb">${thumbSvg(p.def, 48, 30)}</span><span class="nm">${esc(p.name)}<span class="mt2">${p.views.length} view${p.views.length > 1 ? 's' : ''}</span></span></button></div>`;
    if (open) for (const vid of p.views) h += `<div class="irow${S.sel === vid ? ' sel' : ''}" style="--d:1"><button class="nmb" data-act="sel" data-id="${vid}">${icon('camera', 14)}<span class="nm">${esc(view(vid)?.name || '')}</span><span class="mt">${p.def === vid ? '◆' : ''}</span></button></div>`;
  }
  h += `<button class="iaction" data-act="newpres">${icon('plus', 14)} New Presentation</button>`;
  h += `<div class="igroup"><span>Guides</span></div><div class="irow${S.guideOpen ? ' sel' : ''}"><button class="nmb" data-act="guide">${icon('guide', 15)}<span class="nm">${esc(g.name)}</span><span class="mt">${g.stops.length} stops</span></button></div>`;
  return h + '</div>';
}

export function expCard(e) {
  let h = ''; const g = guide();
  const head = (k, n) => `<div class="ch"><span class="kick">${k}</span><button class="iconbtn sm" data-act="deselect" title="Deselect">${icon('close', 15)}</button></div><h2 data-act="rename" title="Rename">${esc(n)}</h2>`;
  if (e.kind === 'presentation') {
    h += head(`Presentation${e.subject ? ` · about <a data-act="sel" data-id="${e.subject}">${esc(ent(e.subject)?.name || 'a missing subject')}</a>` : ''}`, e.name);
    h += `<div class="sec"><div class="thumbs">${e.views.map((vid) => `<div class="thumb${S.sel === vid ? ' sel' : ''}" data-act="sel" data-id="${vid}" title="Select; double-click to look through">${thumbSvg(vid, 140, 88)}<span class="lbl"><span>${esc(view(vid)?.name || '')}</span>${e.def === vid ? '<span class="def">◆</span>' : ''}</span></div>`).join('')}<button class="thumb add" data-act="capture">${icon('capture', 16)}Capture</button></div></div>`;
    if (e.def) h += `<div class="cfoot"><button class="tbtn pri" data-act="lookthrough" data-id="${e.def}">${icon('camera', 14)} Look through ◆</button></div>`;
  } else if (e.kind === 'view') {
    const p = M.presentations.find((p) => p.views.includes(e.id));
    h += head(`View in <a data-act="sel" data-id="${p.id}">${esc(p.name)}</a>`, e.name);
    h += `<div class="sec"><div class="bigthumb">${thumbSvg(e.id, 280, 175)}</div><div class="dims" style="padding:8px 0 0"><label class="df"><span>Lens mm</span><input readonly value="${e.lens}"></label><label class="df"><span>Eye</span><input readonly value="${f2(e.pos[2])}"></label></div></div>`;
    h += `<div class="cfoot"><button class="tbtn pri" data-act="lookthrough" data-id="${e.id}">${icon('camera', 14)} Look through</button>${p.def !== e.id ? `<button class="tbtn" data-act="makedef" data-id="${e.id}">◆ Default</button>` : ''}</div>`;
  } else if (e.kind === 'stop') {
    const p = pres(e.pres);
    h += head(`Stop ${e.idx + 1} of ${g.stops.length}`, p.name);
    h += `<div class="sec">${p.views.map((vid) => { const inc = e.views.includes(vid); return `<div class="rel"><span>${inc ? '✓' : '—'} ${esc(view(vid).name)}</span>${inc ? `<span class="stepper"><button data-act="hold" data-v="-1">−</button><span>${e.hold}s</span><button data-act="hold" data-v="1">+</button></span>` : `<button data-act="include" data-id="${vid}">Include</button>`}</div>`; }).join('')}</div>`;
  } else if (e.kind === 'edge') {
    h += head(`Transition · ${esc(g.name)}`, e.name);
    h += `<div class="sec"><div class="presets">${['cut', 'travel'].map((m) => `<button data-act="edgemode" data-v="${m}" aria-pressed="${e.mode === m}">${m === 'cut' ? 'Cut' : 'Travel'}</button>`).join('')}</div>${e.mode === 'travel' ? `<div class="rel"><span>Duration</span><span class="stepper"><button data-act="edgedur" data-v="-1">−</button><span>${e.dur}s</span><button data-act="edgedur" data-v="1">+</button></span></div>` : ''}</div>`;
  }
  return h;
}

const thumbCache = new Map();
export function thumbSvg(vid, w, hgt) {
  const v = view(vid); if (!v) return '';
  const key = `${vid}|${H.i}|${S.scenario}|${v.pos}|${v.target}`;
  if (!thumbCache.has(key)) { const cam = SC.camera('persp', { pos: v.pos, target: v.target, F: focal(v.lens) }); thumbCache.set(key, SC.renderSolid(M, cam, { pal: SC.PAL.mat, finishes: M.finishes, stories: [...new Set(M.levels.map((l) => l.z))] }).svg); }
  return `<svg viewBox="-16 -10 32 20" preserveAspectRatio="xMidYMid slice" width="${w}" height="${hgt}"><rect x="-20" y="-14" width="40" height="28" fill="#1D3A33"/>${thumbCache.get(key)}</svg>`;
}

// ---------------- Guide ----------------
export function guideTimeline() {
  const g = guide(); const segs = []; let t = 0;
  g.stops.forEach((s, i) => { segs.push({ kind: 'hold', i, t0: t, t1: t + s.hold }); t += s.hold; const e = g.edges[i]; if (e && g.stops[i + 1]) { const d = e.mode === 'cut' ? 0 : e.dur; segs.push({ kind: 'move', i, t0: t, t1: t + d }); t += d; } });
  return { segs, total: t };
}
export function evalGuide(t) {
  const g = guide(); const { segs, total } = guideTimeline(); t = clamp(t, 0, total);
  const seg = segs.find((s) => t >= s.t0 && t <= s.t1 && s.t1 > s.t0) || segs[segs.length - 1];
  if (seg.kind === 'hold') { const v = view(g.stops[seg.i].views[0]); return { pose: { pos: v.pos, target: v.target }, stop: seg.i, total }; }
  const A = view(g.stops[seg.i].views.at(-1)), B = view(g.stops[seg.i + 1].views[0]);
  const pts = [A.pos, ...(g.edges[seg.i].pts || []).map((p) => [p[0], p[1], 1.6]), B.pos];
  const u = (t - seg.t0) / (seg.t1 - seg.t0); const lens = []; let L = 0;
  for (let k = 0; k < pts.length - 1; k++) { const l = SC.len(SC.sub(pts[k + 1], pts[k])); lens.push(l); L += l; }
  let d = u * L, k = 0; while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
  const pos = SC.add(pts[k], SC.mul(SC.sub(pts[k + 1], pts[k]), d / (lens[k] || 1)));
  return { pose: { pos, target: SC.add(A.target, SC.mul(SC.sub(B.target, A.target), u)) }, stop: seg.i, moving: true, total };
}
export function guideHtml() {
  const g = guide(); const { segs, total } = guideTimeline(); const cur = evalGuide(S.t);
  let stops = '';
  g.stops.forEach((s, i) => {
    const p = pres(s.pres);
    stops += `<button class="stopc${S.sel === s.id ? ' sel' : ''}${S.playing && cur.stop === i && !cur.moving ? ' play' : ''}" data-act="sel" data-id="${s.id}"><span class="th">${thumbSvg(s.views[0], 110, 50)}<span class="no">${i + 1}</span></span><span class="n">${esc(p?.name || '')}</span><span class="m">${s.hold}s</span></button>`;
    const e = g.edges[i]; if (e && g.stops[i + 1]) stops += `<span class="conn"><button class="${e.mode === 'cut' ? 'cut' : ''}${S.sel === 'edge-' + i ? ' sel' : ''}" data-act="sel" data-id="edge-${i}">${e.mode === 'cut' ? 'cut' : e.dur + 's'}</button></span>`;
  });
  const bar = segs.map((s) => `<i class="${s.kind === 'hold' ? 'hold' : ''}" style="left:${(s.t0 / total) * 100}%;width:${((s.t1 - s.t0) / total) * 100}%"></i>`).join('');
  const mm = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  return `<div class="inst guide"><div class="ih"><span class="k">Guide</span><span class="nm">${esc(g.name)}</span><span class="sp"></span><button class="ibtn" data-act="follow" aria-pressed="${S.follow}">${icon('camera', 13)} Follow</button><button class="ibtn" data-act="addstop">${icon('plus', 13)} Stop</button><button class="x" data-act="guide" title="Close">${icon('close', 15)}</button></div><div class="stops">${stops}</div><div class="scrub"><button class="ibtn gold" data-act="play" title="Play / pause (Space)">${icon(S.playing ? 'pause' : 'play', 13)}</button><div class="bar" id="scrubbar">${bar}<b style="left:${(S.t / total) * 100}%"></b></div><span class="t">${mm(S.t)} / ${mm(total)}</span></div></div>`;
}
let lastT = 0;
export function tick(ts) {
  if (!S.playing) return;
  const dt = lastT ? (ts - lastT) / 1000 : 0; lastT = ts;
  S.t += dt; const { total } = guideTimeline(); if (S.t >= total) { S.t = total; S.playing = false; }
  UI.renderStage(); UI.renderLower(); requestAnimationFrame(tick);
}
export function play() { S.playing = !S.playing; if (S.playing) { if (S.t >= guideTimeline().total) S.t = 0; lastT = 0; requestAnimationFrame(tick); } }

export function expOverlay() {
  let s = ''; const g = guide();
  const selPres = pres(S.sel) || M.presentations.find((p) => p.views.includes(S.sel));
  if (S.guideOpen) {
    g.edges.forEach((ed, i) => {
      if (!g.stops[i + 1]) return;
      const A = view(g.stops[i].views.at(-1)), B = view(g.stops[i + 1].views[0]);
      const pts = [A.pos, ...(ed.pts || []).map((p) => [p[0], p[1], 1.6]), B.pos].map(wpx).filter(Boolean);
      s += `<polyline class="route${ed.mode === 'cut' ? ' cut' : ''}${S.sel === 'edge-' + i ? ' sel' : ''}" points="${pts.map((p) => p.join(',')).join(' ')}"/>`;
      if (S.sel === 'edge-' + i) (ed.pts || []).forEach((p, j) => { const q = wpx([p[0], p[1], 1.6]); if (q) s += `<circle class="pathpt" cx="${q[0]}" cy="${q[1]}" r="6" data-h="pp-${i}-${j}"/>`; });
    });
    const q = wpx(evalGuide(S.t).pose.pos); if (q) s += `<circle class="puck" cx="${q[0]}" cy="${q[1]}" r="7"/>`;
  }
  for (const v of M.views) {
    const p = wpx(v.pos), t = wpx(v.target); if (!p || !t) continue;
    const ang = Math.atan2(t[1] - p[1], t[0] - p[0]); const L = 30, sp = 0.42;
    const a1 = [p[0] + Math.cos(ang - sp) * L, p[1] + Math.sin(ang - sp) * L], a2 = [p[0] + Math.cos(ang + sp) * L, p[1] + Math.sin(ang + sp) * L];
    const sel = S.sel === v.id || (selPres && selPres.def === v.id && S.sel === selPres.id);
    if (!(sel || !selPres || selPres.views.includes(v.id) || S.guideOpen)) continue;
    s += `<g class="vm${sel ? ' sel' : ''}" data-v="${v.id}"><polygon class="fr" points="${p.join(',')} ${a1.join(',')} ${a2.join(',')}"/><circle class="body" cx="${p[0]}" cy="${p[1]}" r="${sel ? 8 : 6}"/><text x="${p[0] + 10}" y="${p[1] - 8}">${esc(v.name)}</text></g>`;
  }
  const D = R.D; if (D && D.kind === 'newview' && D.cur) { const a = toPx(D.aPx), b = toPx(D.cur); s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#d4ad45" stroke-width="2" stroke-dasharray="4 3"/><circle cx="${a[0]}" cy="${a[1]}" r="7" class="puck"/>`; }
  return s;
}

// ---------------- Preview takeover (visitor view; accommodates phones) ----------------
const CAPTIONS = { 'p-arrival': 'A boathouse turned gallery: one long room, a studio beyond.', 'p-north': 'Three harbour paintings hang where the boats once came in.', 'p-torso': 'A torso, carved from driftwood, stands alone in the light.', 'p-studio': 'The Pleyel piano waits in the studio.', 'p-entry': 'The museum opens onto the harbour.', 'p-pav': 'A garden pavilion for summer shows.' };
export function renderPreview() {
  const el = $('#previewhost');
  if (!S.preview) { el.innerHTML = ''; return; }
  const g = guide(); const i = S.preview.i; const s = g.stops[i]; const v = view(s.views[0]);
  const cam = SC.camera('persp', { pos: v.pos, target: v.target, F: focal(v.lens) });
  const r = SC.renderSolid(M, cam, { pal: SC.PAL.mat, finishes: M.finishes, stories: [...new Set(M.levels.map((l) => l.z))] });
  const phone = S.preview.device === 'phone';
  const scene = `<svg viewBox="${phone ? '-7 -14 14 28' : '-16 -10 32 20'}" preserveAspectRatio="xMidYMid slice"><rect x="-40" y="-30" width="80" height="60" fill="#1D3A33"/>${r.svg}</svg>`;
  const ctl = `${S.preview.mode === 'guided' ? `<div class="cap">${esc(CAPTIONS[s.pres] || pres(s.pres)?.name || '')}</div>` : ''}<div class="vctl">${S.preview.mode === 'guided' ? `<button data-act="pvnav" data-v="-1">‹</button><span class="dots">${g.stops.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span><button data-act="pvnav" data-v="1">›</button>` : '<span class="muted">Drag to look (mock)</span>'}</div>`;
  el.innerHTML = `<div class="preview${phone ? ' phone' : ''}"><div class="pvbar"><span class="ttl">Preview · Opening night</span><span class="seg dark"><button aria-pressed="${S.preview.mode === 'guided'}" data-act="pvmode" data-v="guided">Guided</button><button aria-pressed="${S.preview.mode === 'explore'}" data-act="pvmode" data-v="explore">Explore</button></span><span class="seg dark"><button aria-pressed="${!phone}" data-act="pvdev" data-v="desktop">Desktop</button><button aria-pressed="${phone}" data-act="pvdev" data-v="phone">Phone</button></span><span class="sp"></span><button class="exit" data-act="pvexit">Exit Preview <span class="kbd">Esc</span></button></div><div class="pvstage">${phone ? `<div class="device"><div class="screen">${scene}${ctl}</div></div>` : `<div class="screen">${scene}${ctl}</div>`}</div></div>`;
}

export function lookThrough(id) { const v = view(id); S.lookThrough = { id, pos: [...v.pos], target: [...v.target] }; S.sel = id; UI.render(true); }
export function capture() {
  if (S.lens !== 'experience') return;
  const pose = S.lookThrough ? { pos: S.lookThrough.pos, target: S.lookThrough.target } : S.reading === 'eye' ? S.eye : null;
  if (!pose) { S.reading = 'eye'; toast('Compose at eye level (drag to look), then Capture.'); return UI.render(true); }
  const id = uid('v'); M.views.push({ id, name: `View ${id.slice(2)}`, pos: [...pose.pos], target: [...pose.target], lens: 40 });
  let p = pres(S.sel) || M.presentations.find((pp) => pp.views.includes(S.sel));
  if (!p) { p = { id: uid('p'), name: 'Untitled presentation', views: [], def: id, subject: null }; M.presentations.push(p); }
  p.views.push(id); if (!p.def) p.def = id; commit('Capture View'); S.sel = id; toast(`Captured into ${p.name}`); UI.render();
}
export function presentThis() { const e = ent(S.sel); if (!e) return; const p = { id: uid('p'), name: e.name, views: [], def: null, subject: e.id }; M.presentations.push(p); commit(`Present ${e.name}`); UI.parkWorld(); S.lens = 'experience'; S.sel = p.id; S.tool = 'select'; toast('Presentation created — capture a View of it'); UI.render(); }
