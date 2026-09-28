// Pure derivations over one accepted project snapshot: order, visits, reuse,
// Stop timing (beats → schedule), authoring evaluation of a Stop at a time, and
// the revision diagnostics. Nothing here mutates the project.

import { BAY, PX2, casingChannel } from './fixture.js';
import { clamp, easeInOut, metres } from './util.js';
import { prepare, findRoute, routePoints, polyLength, travelDuration, travelPose, coverage, toWorld } from './camera.js';

export const instName = (P, id) => P.scene.inst[id]?.name || id;
export const viewName = (P, id) => P.camera.views[id]?.name || 'missing view';
export const expName = (P, id) => P.exp.list[id]?.name || id;

export function stopsOf(P, expId) {
  return (P.exp.list[expId]?.stops || []).map((id) => P.occ[id]).filter(Boolean);
}

export function position(P, occ) {
  const list = P.exp.list[occ.exp].stops;
  return { i: list.indexOf(occ.id), n: list.length };
}

export function prevStop(P, occ) {
  const list = P.exp.list[occ.exp].stops;
  const i = list.indexOf(occ.id);
  return i > 0 ? P.occ[list[i - 1]] : null;
}

export const shotsOf = (occ) => occ.beats.filter((b) => b.kind === 'shot');
export const firstShot = (occ) => occ.beats.find((b) => b.kind === 'shot');
export const lastShotView = (occ) => { const s = shotsOf(occ); return s.length ? s[s.length - 1].view : null; };
export const sayOf = (occ) => occ.beats.find((b) => b.kind === 'say');
export const usesIn = (occ) => occ.beats.filter((b) => b.kind === 'use');

// A Stop is "timed" once it has more than a still view + words.
export const isTimed = (occ) => occ.beats.some((b) => b.kind === 'use' || b.kind === 'hold') || shotsOf(occ).length > 1;

// Every subject a Stop shows: its own subject, subjects of its shots and uses.
export function subjectsOf(P, occ) {
  const s = new Set();
  if (occ.subject) s.add(occ.subject);
  for (const b of occ.beats) {
    if (b.kind === 'shot' && P.camera.views[b.view]?.subject) s.add(P.camera.views[b.view].subject);
    if (b.kind === 'use') s.add(b.subject);
  }
  for (const st of occ.states) if (st.ch.endsWith('.casing')) s.add(st.ch.split('.')[0]);
  return [...s].filter((id) => P.scene.inst[id]);
}

// Visits: the same subject reached by several occurrences of one Experience.
export function visitInfo(P, occ) {
  if (!occ.subject) return null;
  const all = stopsOf(P, occ.exp).filter((o) => o.subject === occ.subject);
  return { n: all.indexOf(occ) + 1, of: all.length, others: all.filter((o) => o !== occ) };
}

export function subjectVisits(P, instId) {
  const out = [];
  for (const expId of P.exp.order) for (const o of stopsOf(P, expId)) if (subjectsOf(P, o).includes(instId)) out.push(o);
  return out;
}

export function usesOf(P, perfId) {
  const out = [];
  for (const expId of P.exp.order) for (const o of stopsOf(P, expId)) for (const b of o.beats) if (b.kind === 'use' && b.perf === perfId) out.push({ occ: o, beat: b });
  return out;
}

export function viewUsers(P, viewId) {
  const out = [];
  for (const expId of P.exp.order) for (const o of stopsOf(P, expId)) for (const b of o.beats) if (b.kind === 'shot' && b.view === viewId) out.push({ occ: o, beat: b });
  return out;
}

export function findBeat(P, beatId) {
  for (const o of Object.values(P.occ)) { const b = o.beats.find((x) => x.id === beatId); if (b) return { occ: o, beat: b }; }
  return null;
}

// A use's invocation, resolved against its definition.
export function useInfo(P, beat) {
  const def = P.res.perfs[beat.perf];
  const speed = beat.speed ?? 1;
  const hasSep = beat.over && beat.over.separation !== undefined;
  const sep = hasSep ? beat.over.separation : def?.params.separation ?? 0;
  return { def, speed, sep, dur: (def?.duration ?? 0) / speed, localSpeed: Math.abs(speed - 1) > 1e-6, localSep: hasSep, defSep: def?.params.separation };
}

// Largest separation each subject shows in this Stop — the extent Camera prepares against.
export function extentOf(P, occ) {
  const ext = {};
  for (const st of occ.states) if (st.ch.endsWith('.casing')) { const i = st.ch.split('.')[0]; ext[i] = Math.max(ext[i] || 0, st.v); }
  for (const b of usesIn(occ)) { const u = useInfo(P, b); ext[b.subject] = Math.max(ext[b.subject] || 0, u.sep); }
  return ext;
}

// Beats → Stop-local schedule. Relations: start · then (after previous) · with (with previous) · cue.
export function schedule(P, occ) {
  const items = [];
  const prevOcc = prevStop(P, occ);
  let curView = prevOcc ? lastShotView(prevOcc) : null;
  const ctx = { extent: extentOf(P, occ) };
  let prev = null;
  for (const b of occ.beats) {
    let start = 0;
    if (prev && b.rel !== 'start') {
      if (b.rel === 'with') start = prev.start;
      else if (b.rel === 'cue') {
        const ref = items.find((x) => x.beat.id === b.cue?.beat);
        const cue = ref?.beat.cues?.find((c) => c.name === b.cue.name);
        start = ref && cue ? ref.start + cue.t : prev.end;
      } else start = prev.end;
    }
    const it = { beat: b, start, dur: 0, end: start };
    if (b.kind === 'shot') {
      it.from = curView;
      if (b.move === 'travel' && curView && curView !== b.view) {
        const r = findRoute(P, curView, b.view);
        if (r.ok) { it.route = r; it.points = routePoints(P, r, ctx); it.dur = travelDuration(polyLength(it.points)); }
        else it.gap = { from: curView, to: b.view };
      } else if (b.move === 'travel' && !curView) it.noOrigin = true;
      curView = b.view;
    } else if (b.kind === 'use') { it.use = useInfo(P, b); it.dur = it.use.dur; }
    else if (b.kind === 'say' || b.kind === 'hold') it.dur = b.dur;
    it.end = start + it.dur;
    items.push(it);
    prev = it;
  }
  const shots = items.filter((i) => i.beat.kind === 'shot');
  for (const it of items) {
    if (it.beat.kind !== 'say') continue;
    it.crossings = shots.filter((s) => s !== shots[0] && s.start > it.start + 0.01 && s.start < it.end - 0.01);
    if (it.beat.crossCut === 'end' && it.crossings.length) { it.cutShort = it.end; it.end = it.crossings[0].start; it.dur = it.end - it.start; }
  }
  const length = items.reduce((m, i) => Math.max(m, i.end), 0);
  return { items, shots, length, ctx };
}

export function shotAt(sch, t) {
  let cur = sch.shots[0] || null;
  for (const s of sch.shots) if (s.start <= t + 1e-6) cur = s;
  return cur;
}

// ---- one Experience end to end (the drawer's Whole lens) ----
// Every Stop's content laid on a single ruler, with each shot transition named, so the
// big picture can be read and scrubbed in one motion. Pure and seekable, exactly like
// schedule()/evalStop(): the Whole lens, the Clock lens and the visitor preview all read
// the same derivation — the ruler adds no second authority.

const r2 = (v) => Math.round(v * 100) / 100;

export function timeline(P, expId) {
  const items = [];
  let start = 0;
  for (const occ of stopsOf(P, expId)) {
    const sch = schedule(P, occ);
    const trans = [];
    sch.shots.forEach((s, i) => {
      if (!i) return;
      trans.push({
        view: s.beat.view,
        move: s.beat.move === 'travel' ? 'travel' : 'cut',
        at: r2(s.start),
        gap: !!s.gap,
        cue: s.beat.rel === 'cue' ? s.beat.cue?.name ?? null : null,
      });
    });
    items.push({ occ, sch, start: r2(start), len: r2(sch.length), waits: (occ.cont ?? 'hold') === 'hold', trans });
    start += sch.length;
  }
  return { exp: P.exp.list[expId] ?? null, items, total: r2(start) };
}

export function timelineAt(tl, g) {
  if (!tl.items.length) return null;
  const c = clamp(g, 0, tl.total);
  let item = tl.items[0];
  for (const it of tl.items) if (it.start <= c + 1e-6) item = it;
  return { item, t: Math.max(0, c - item.start), g: c };
}

// Pose of a Stop's first shot as the tour arrives, and during any travel into it.
export function shotPose(P, occ, sch, shot, t) {
  if (!shot) return null;
  const to = prepare(P, shot.beat.view, sch.ctx);
  if (shot.route && t < shot.end && shot.dur > 0) {
    const fromView = shot.from;
    const prevOcc = prevStop(P, occ);
    const fromCtx = shot === sch.shots[0] && prevOcc ? { extent: extentOf(P, prevOcc) } : sch.ctx;
    const from = prepare(P, fromView, fromCtx);
    return { ...travelPose(shot.points, from, to, (t - shot.start) / shot.dur), travelling: true };
  }
  return to;
}

// Authoring evaluation of one Stop at Stop-local time t, entered fresh. Pure and seekable.
export function evalStop(P, occ, t, { reduced = false } = {}) {
  const sch = schedule(P, occ);
  const ch = { 'pumpA.casing': 0, 'pumpB.casing': 0, 'bay.cutaway': 0 };
  const owners = {};
  for (const st of occ.states) { ch[st.ch] = st.v; owners[st.ch] = { kind: 'state', id: st.id, label: st.label }; }
  for (const it of sch.items) {
    if (it.beat.kind !== 'use' || t < it.start - 1e-6) continue;
    const c = casingChannel(it.beat.subject);
    const p = it.dur > 0 ? clamp((t - it.start) / it.dur) : 1;
    ch[c] = reduced ? it.use.sep : it.use.sep * easeInOut(p);
    owners[c] = { kind: 'use', id: it.beat.id, p };
  }
  const shot = shotAt(sch, t);
  const pose = shotPose(P, occ, sch, shot, t);
  const say = sch.items.find((i) => i.beat.kind === 'say' && t >= i.start - 1e-6 && t <= i.end + 1e-6) || null;
  return { ch, owners, pose, shot, say, sch, t };
}

// ---- revision diagnostics ----

export function coverWorldBox(P, instId, sep) {
  const inst = P.scene.inst[instId];
  const [a, b] = PX2.coverSpan;
  const pts = [];
  for (const x of [a + sep, b + sep]) for (const z of [-0.37, 0.37]) pts.push(toWorld(inst, [x, 0.44, z]));
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[2]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

export function wallHit(P, instId, sep) {
  const b = coverWorldBox(P, instId, sep);
  if (b.x1 > BAY.x1) return { wall: 'W-E', by: b.x1 - BAY.x1 };
  if (b.x0 < BAY.x0) return { wall: 'W-W', by: BAY.x0 - b.x0 };
  if (b.z1 > BAY.z1) return { wall: 'W-S', by: b.z1 - BAY.z1 };
  if (b.z0 < BAY.z0) return { wall: 'W-N', by: BAY.z0 - b.z0 };
  return null;
}

export function maxClearSep(P, instId) {
  for (let s = 1; s >= 0; s -= 0.05) if (!wallHit(P, instId, s)) return Math.round(s * 100) / 100;
  return 0;
}

// What a Stop's words were written against (refreshed on content edits and review).
export function basisOf(P, occ) {
  const params = {};
  for (const b of usesIn(occ)) params[b.id] = Math.round(useInfo(P, b).sep * 100) / 100;
  for (const st of occ.states) params[st.id] = st.v;
  const pos = {};
  for (const i of subjectsOf(P, occ)) pos[i] = [...P.scene.inst[i].pos];
  return { params, pos };
}

const samePos = (a, b) => a && b && Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3;

export function diagnostics(P) {
  const out = [];
  for (const expId of P.exp.order) {
    for (const occ of stopsOf(P, expId)) {
      const sch = schedule(P, occ);
      const where = { exp: expId, occ: occ.id };
      for (const s of sch.shots) {
        const v = P.camera.views[s.beat.view];
        if (!v) { out.push({ id: 'missing:' + s.beat.id, sev: 'error', kind: 'missing', ...where, beat: s.beat.id, title: 'Shot refers to a view that no longer exists' }); continue; }
        if (s.gap) out.push({ id: 'gap:' + s.beat.id, sev: 'error', kind: 'gap', ...where, beat: s.beat.id, title: 'Travel has no Camera route', detail: 'No route from “' + viewName(P, s.gap.from) + '” to “' + v.name + '”. A cut needs no route; travel does.' });
        if (v.subject && P.scene.inst[v.subject]) {
          const sep = sch.ctx.extent[v.subject] || 0;
          const pose = prepare(P, v.id, sch.ctx);
          const cov = coverage(pose, P, v.subject, v.framing === 'locked' ? 'whole' : v.focus, sep);
          const key = 'frame:' + s.beat.id;
          if (v.framing === 'locked' && cov < 0.8) {
            if (occ.ack[key]) out.push({ id: key, sev: 'kept', kind: 'frame', ...where, beat: s.beat.id, view: v.id, title: 'Locked shot kept as authored', detail: Math.round((1 - cov) * 100) + '% of ' + instName(P, v.subject) + ' stays outside it — deliberately.' });
            else out.push({ id: key, sev: 'error', kind: 'frame', ...where, beat: s.beat.id, view: v.id, coverage: cov, title: 'Locked shot no longer contains ' + instName(P, v.subject), detail: Math.round((1 - cov) * 100) + '% of ' + instName(P, v.subject) + ' is outside “' + v.name + '”. The reference still resolves; the composition does not.' });
          } else if (v.framing === 'assisted' && occ.basis.pos[v.subject] && !samePos(occ.basis.pos[v.subject], P.scene.inst[v.subject].pos)) {
            out.push({ id: 'reframed:' + s.beat.id, sev: 'ok', kind: 'reframed', ...where, beat: s.beat.id, view: v.id, title: '“' + v.name + '” followed ' + instName(P, v.subject), detail: 'Subject-assisted framing re-prepared the shot for the new position.' + (pose.guarded ? ' Camera kept it inside the bay.' : '') });
          }
        }
      }
      for (const it of sch.items) {
        const b = it.beat;
        if (b.kind === 'use') {
          const hit = wallHit(P, b.subject, it.use.sep);
          if (hit) out.push({ id: 'hit:' + b.id, sev: 'error', kind: 'hit', ...where, beat: b.id, wall: hit.wall, title: 'Opening on ' + instName(P, b.subject) + ' passes through the ' + P.layout.bay.walls[hit.wall].name.toLowerCase(), detail: 'At ' + metres(it.use.sep) + ' the cover ends ' + Math.round(hit.by * 100) + ' cm inside ' + hit.wall + ' (Layout). The shared definition is valid elsewhere; this use is not.' });
        }
        if (b.kind === 'say' && it.crossings?.length && !b.crossCut) out.push({ id: 'cross:' + b.id, sev: 'decide', kind: 'cross', ...where, beat: b.id, title: 'Narration runs across a cut', detail: 'Decide whether the words keep playing when the camera cuts to “' + viewName(P, it.crossings[0].beat.view) + '”.' });
      }
      const now = basisOf(P, occ);
      const changed = Object.keys(occ.basis.params || {}).filter((k) => k in now.params && Math.abs(now.params[k] - occ.basis.params[k]) > 1e-3);
      if (changed.length) {
        const k = changed[0];
        out.push({ id: 'review:' + occ.id, sev: 'warn', kind: 'review', ...where, title: 'Words may no longer match what the Stop shows', detail: 'Written against a ' + Math.round(occ.basis.params[k] * 100) + ' cm opening; it now shows ' + Math.round(now.params[k] * 100) + ' cm. Every reference still resolves — this needs an editor, not a repair.' });
      }
    }
  }
  const rank = { error: 0, decide: 1, warn: 2, ok: 3, kept: 4 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
}

export function diagFor(diags, occId) { return diags.filter((d) => d.occ === occId); }
export const needsWork = (d) => d.sev === 'error' || d.sev === 'decide' || d.sev === 'warn';
