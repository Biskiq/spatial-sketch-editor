// Per-frame UI: 3D-anchored tags, the Paper chip, the Camera map and playheads.
// Cheap, targeted DOM writes only — panels re-render elsewhere on state changes.

import { S, app } from './state.js';
import * as D from './derive.js';
import { prepare, toWorld } from './camera.js';
import { BAY } from './fixture.js';
import { esc, secs, metres } from './util.js';
import { P, animValue } from './actions.js';
import { frameRunPanel, frameVisitor } from './ui-preview.js';

const $ = (id) => document.getElementById(id);

// ---- tags ----

const pool = new Map();
function tagEl(key) {
  let el = pool.get(key);
  if (!el) { el = document.createElement('div'); el.className = 'tag3'; $('tags').appendChild(el); pool.set(key, el); }
  el.dataset.used = '1';
  return el;
}

function place(key, p3, html, cls) {
  const s = app.stage.project(p3);
  const el = tagEl(key);
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
  el.className = 'tag3 ' + cls;
  el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
  el.hidden = !s.on;
}

export function frameTags(out) {
  for (const el of pool.values()) el.dataset.used = '';
  const p = P();
  if (S.mode === 'preview') {
    const R = app.R;
    if (R?.status === 'looking') for (const inst of Object.values(R.P.scene.inst)) place('v:' + inst.id, toWorld(inst, [0, 1.3, 0]), esc(inst.name), 'visitor-tag');
  } else if (S.inspect) {
    const I = S.inspect;
    const inst = p.scene.inst[I.inst];
    const sep = animValue(I.sepA);
    if (sep > 0.03) place('insp', toWorld(inst, [0.9 + sep, 0.95, 0]), `<span class="life l-session">View only</span> casing ${metres(sep)}`, 'session');
    const cut = animValue(I.cutA);
    if (cut > 0.05) place('cut', [0, 3.3 + 3.4 * cut, 0], '<span class="life l-session">View only</span> bay cutaway', 'session');
  } else if (out?.occ) {
    const occ = out.occ;
    const pos = D.position(p, occ);
    for (const [c, o] of Object.entries(out.owners || {})) {
      if (!c.endsWith('.casing') || out.ch[c] < 0.03) continue;
      const inst = p.scene.inst[c.split('.')[0]];
      const label = o.kind === 'use' ? '“' + (p.res.perfs[occ.beats.find((b) => b.id === o.id)?.perf]?.name || 'use') + '”' : 'state';
      place('auth:' + c, toWorld(inst, [0.9 + out.ch[c], 0.95, 0]), `<span class="life l-authored">Stop ${pos.i + 1}</span> ${esc(label)} ${metres(out.ch[c])}`, 'authored');
      const hit = D.wallHit(p, inst.id, out.ch[c]);
      if (hit) place('hit:' + c, toWorld(inst, [1.0 + out.ch[c], 0.5, 0]), `✕ passes through ${hit.wall}`, 'refusal');
    }
    if (out.ch['bay.cutaway'] > 0.05) place('auth:cut', [0, 3.4 + 3.4 * out.ch['bay.cutaway'], 0], `<span class="life l-authored">Stop ${pos.i + 1}</span> bay cutaway`, 'authored');
  }
  if (S.pendingMove && S.mode === 'author') place('move', [S.pendingMove.pos[0], 1.4, S.pendingMove.pos[1]], 'Proposed position — not applied', 'ghost');
  for (const el of pool.values()) if (!el.dataset.used) el.hidden = true;
}

// ---- paper chip ----

let chipKey = '';
export function frameChip(out) {
  const el = $('paperChip');
  let html = '';
  const p = P();
  if (S.mode === 'preview') html = '';
  else if (S.inspect) html = `<span class="life l-session">Session</span> Inspecting ${esc(p.scene.inst[S.inspect.inst].name)} — temporary. Nothing is saved until you capture.`;
  else if (S.look === 'shot' && out?.occ) {
    const occ = out.occ;
    const pos = D.position(p, occ);
    const v = p.camera.views[out.shot?.beat.view];
    html = `<span class="life l-authored">Stop ${pos.i + 1}</span> Through the shot “${esc(v?.name)}” · ${v?.framing === 'locked' ? 'locked' : 'follows ' + esc(D.instName(p, v?.subject))} · ${S.scrub === null ? 'the waiting moment' : 'at ' + secs(S.scrub)}${S.scrub !== null ? ' <button class="chip-btn" data-act="moment">Waiting moment</button>' : ''}`;
  } else if (out?.occ) html = `<span class="life l-session">Session</span> Free look — your camera, not part of any Stop · showing Stop ${D.position(p, out.occ).i + 1}’s presentation <button class="chip-btn" data-act="look" data-v="shot">Back to the shot <kbd>1</kbd></button>`;
  else html = '<span class="life l-session">Session</span> Free look — your camera. Select a Stop to look through its shot.';
  if (html !== chipKey) { chipKey = html; el.innerHTML = html; el.hidden = !html; }
}

// ---- camera map ----

const MW = 216, MH = 170, PAD = 8;
const sx = (x) => PAD + ((x - (BAY.x0 - 0.4)) / (BAY.x1 - BAY.x0 + 0.8)) * (MW - 2 * PAD);
const sz = (z) => PAD + ((z - (BAY.z0 - 0.4)) / (BAY.z1 - BAY.z0 + 0.8)) * (MH - 2 * PAD - 14);

function camGlyph(eye, target, cls, label = '') {
  const a = Math.atan2(target[2] - eye[2], target[0] - eye[0]);
  const x = sx(eye[0]), y = sz(eye[2]);
  const r = 13, w = 0.42;
  const p1 = [x + r * Math.cos(a - w), y + r * Math.sin(a - w)], p2 = [x + r * Math.cos(a + w), y + r * Math.sin(a + w)];
  return `<g class="cg ${cls}"><path d="M${x.toFixed(1)},${y.toFixed(1)} L${p1[0].toFixed(1)},${p1[1].toFixed(1)} L${p2[0].toFixed(1)},${p2[1].toFixed(1)} Z"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6"/>${label ? `<text x="${(x + 4).toFixed(1)}" y="${(y - 5).toFixed(1)}">${label}</text>` : ''}</g>`;
}

let mapKey = '';
export function renderMap() {
  const svg = $('cammap');
  const show = app.showMap;
  svg.style.display = show ? '' : 'none';
  if (!show) return;
  const p = S.mode === 'preview' && app.R ? app.R.P : P();
  const occ = S.mode === 'preview' && app.R ? p.occ[app.R.stops[app.R.i]] : S.stop ? p.occ[S.stop] : null;
  const key = p.rev + '|' + (occ?.id || '') + '|' + S.mode + '|' + (app.R?.i ?? '');
  if (key === mapKey) return;
  mapKey = key;
  const sch = occ ? D.schedule(p, occ) : null;
  const ext = sch?.ctx || { extent: {} };
  const eyes = {};
  for (const v of Object.values(p.camera.views)) eyes[v.id] = prepare(p, v.id, ext);
  const pumps = Object.values(p.scene.inst).map((inst) => {
    const pts = [[-0.86, -0.36], [0.87, -0.36], [0.87, 0.36], [-0.86, 0.36]].map(([x, z]) => toWorld(inst, [x, 0, z]));
    return `<polygon class="pm" points="${pts.map((q) => sx(q[0]).toFixed(1) + ',' + sz(q[2]).toFixed(1)).join(' ')}"/><text class="pl" x="${sx(inst.pos[0]).toFixed(1)}" y="${(sz(inst.pos[1]) + 3).toFixed(1)}">${inst.name.slice(-1)}</text>`;
  }).join('');
  const routes = Object.values(p.camera.routes).map((r) => {
    const pts = [eyes[r.a].eye, ...r.via, eyes[r.b].eye];
    return `<polyline class="rt" points="${pts.map((q) => sx(q[0]).toFixed(1) + ',' + sz(q[2]).toFixed(1)).join(' ')}"/>`;
  }).join('');
  const inStop = new Set(sch ? sch.shots.map((s) => s.beat.view) : []);
  const used = sch ? sch.shots.filter((s) => s.route).map((s) => { const pts = s.points; return `<polyline class="rt used" points="${pts.map((q) => sx(q[0]).toFixed(1) + ',' + sz(q[2]).toFixed(1)).join(' ')}"/>`; }).join('') : '';
  const gaps = sch ? sch.shots.filter((s) => s.gap).map((s) => { const a = eyes[s.gap.from]?.eye, b = eyes[s.gap.to]?.eye; if (!a || !b) return ''; return `<line class="gap" x1="${sx(a[0])}" y1="${sz(a[2])}" x2="${sx(b[0])}" y2="${sz(b[2])}"/><text class="gapl" x="${((sx(a[0]) + sx(b[0])) / 2).toFixed(1)}" y="${((sz(a[2]) + sz(b[2])) / 2 - 3).toFixed(1)}">no route</text>`; }).join('') : '';
  const views = Object.values(p.camera.views).map((v) => camGlyph(eyes[v.id].eye, eyes[v.id].target, inStop.has(v.id) ? 'in' : '', v.id.replace('V-', ''))).join('');
  svg.innerHTML = `<rect class="bay" x="${sx(BAY.x0)}" y="${sz(BAY.z0)}" width="${sx(BAY.x1) - sx(BAY.x0)}" height="${sz(BAY.z1) - sz(BAY.z0)}"/>
    ${pumps}${routes}${used}${gaps}${views}<g id="mapLive"></g>
    <text class="mk" x="${PAD}" y="${MH - 5}">Camera map · views, routes${gaps ? ', gaps' : ''} · plan</text>`;
}

export function frameMap(pose) {
  if (!app.showMap) return;
  const g = $('mapLive');
  if (!g || !pose) return;
  const cls = S.mode === 'preview' ? (app.R?.status === 'looking' ? 'live visitor' : 'live tour') : S.look === 'shot' && !S.inspect ? 'live shot' : 'live session';
  g.innerHTML = camGlyph(pose.eye, pose.target, cls);
}

// ---- playheads ----

export function framePlayhead(out) {
  if (S.mode === 'preview' && app.R && out?.sch) {
    const t = app.R.t;
    const live = new Set();
    if (out.shot) live.add(out.shot.beat.id);
    for (const it of out.sch.items) if (it.beat.kind !== 'shot' && t >= it.start - 1e-3 && t < it.end && app.R.status !== 'ready') live.add(it.beat.id);
    document.querySelectorAll('.beat[data-beat]').forEach((row) => row.classList.toggle('live', live.has(row.dataset.beat)));
  }
  const el = $('cPlay');
  if (!el || !out?.sch) return;
  const L = Number(el.parentElement.dataset.len) || 1;
  const t = S.mode === 'preview' ? app.R.t : S.scrub ?? out.sch.length;
  el.style.left = `calc(84px + (100% - 84px) * ${(t / L).toFixed(4)})`;
  const tt = $('cPlayT');
  if (tt) tt.textContent = secs(t);
}

// The whole-Experience ruler's playhead (only present while the Whole lens is open).
function frameTrack() {
  const head = $('tlHead');
  if (!head) return;
  const tl = D.timeline(P(), S.exp);
  if (!(tl.total > 0)) return;
  const at = D.timelineAt(tl, S.track.g);
  if (!at) return;
  head.style.left = ((S.track.g / tl.total) * 100).toFixed(3) + '%';
  const tt = $('tlTime');
  if (tt) tt.textContent = secs(S.track.g) + ' / ' + secs(tl.total);
  const now = $('tlNow');
  if (now) now.textContent = 'Stop ' + (tl.items.indexOf(at.item) + 1) + ' · ' + at.item.occ.title;
  document.querySelectorAll('.tl-row').forEach((row) => row.classList.toggle('on', row.dataset.fk === 'tlrow:' + at.item.occ.id));
  document.querySelectorAll('.tl-seg').forEach((seg) => seg.classList.toggle('on', Number(seg.dataset.g) === at.item.start));
}

export function frameUI(out, pose) {
  frameTags(out);
  frameChip(out);
  frameMap(pose);
  framePlayhead(out);
  frameTrack();
  frameVisitor(out);
  frameRunPanel(out);
}
