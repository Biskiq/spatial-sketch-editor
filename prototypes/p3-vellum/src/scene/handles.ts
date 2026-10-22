// Blue-pencil handles: what you can grab on the thing you selected, and what each one does.
import * as THREE from 'three';
import { store } from '../store';
import type { Stage } from './stage';
import { derive, Derived, wallTopAt, wallBottomAt } from '../model/derive';
import type { Overhead, Project, Run } from '../model/types';
import { findEl } from '../model/types';
import { V2, add, sub, mul, dist, norm, perp, dot, polyCentroid, bbox, fmtM, inPeople, round, arcInfo, bulgeFromSagitta, lerp2, pointAtS, clamp } from '../model/geom2d';
import { runGeom, pointAtT, closestOnRun } from '../model/runs';
import {
  Op, opMoveNode, opBend, opRadius, opMoveRun, opRunTop, opRoom, opOpening, opOverhead, opDeck, opVoid, opStair, opScaleAll, opObj,
} from '../model/ops';
import { snapPoint, Guide } from '../model/snap';
import type { Tie } from '../model/types';
import { ohTopAt, ohHasSurface, ohSection, ohFrame, ohSpan, maxRise, moveProfilePoint, profilePeak, movePeak, profileShoulder, ensureShoulder, pullShoulder, profileSymmetric, newProfileId } from '../model/overheadGeom';
import { lvl } from '../model/settle';
import type { RoofZone } from '../model/roofZones';
import { detent, gestureStartStop, hipStops, OVERHANG_STOPS, pitchStops, straighteningStop } from '../model/detents';
import { roofWingsState, type Wing } from '../model/wings';
import { moveJoint, moveStepEdge, readSection, validateGesture } from '../model/section';

export type DragMode = { type: 'plan'; y: number } | { type: 'vertical'; at: V2 } | { type: 'surface'; origin: V2; tan: V2; y0: number };

export interface Handle {
  id: string;
  pos: THREE.Vector3;
  shape: 'dot' | 'ring' | 'bead' | 'move';
  mode: DragMode;
  label: string;
  /** given the dragged point, the op to preview/commit and a measurement to show */
  drag: (pt: { plan: V2; y: number }, e: PointerEvent) => { op?: Op; measure: string; reason?: string; changed?: boolean; knot?: V2 | null; guides?: Guide[]; snap?: string; at?: V2; commit?: string } | null;
  title: string;
  /** 'detail' handles stay out of the way until the pointer comes near (or every point is asked for). */
  tier?: 'primary' | 'detail';
}

const snapY = (y: number) => round(y, 0.05);
const snapP = (p: V2, step = 0.05): V2 => [round(p[0], step), round(p[1], step)];

/** A short-lived roof control created from the zone under the pointer, never serialized or stored in the project. */
export function zoneHandle(stage: Stage, _project: Project, oh: Overhead, zone: RoofZone, startPlan: V2, startY: number): Handle | null {
  if (!ohHasSurface(oh) || (zone.kind === 'slope' && zone.locked)) return null;
  const fr = ohFrame(oh);
  const d = fr.d;
  const e: V2 = [-d[1], d[0]];
  const state = roofWingsState(oh);
  const wing = state.kind === 'compound' && 'wing' in zone ? state.wings.find((w) => w.index === zone.wing) : undefined;
  const scale = Math.max(wing?.scale ?? 1, 1e-6);
  const spanDir: V2 = wing?.span === 'v' ? e : d;
  const lift = stage.liftOf(oh.id);
  const mpp = Math.max(1e-4, stage.mpp(new THREE.Vector3(startPlan[0], startY + lift, startPlan[1])));
  const profile = oh.profile.map((q) => ({ ...q }));
  const peak = profilePeak(profile);
  const flat = levelProfile(profile);
  const flatLevel = flat ? (profile[0]?.h ?? 0) : 0;
  const fullness = zone.kind === 'slope' ? (() => {
    const localSpan = wing ? wing.span === 'w' ? wing.rect[1] - wing.rect[0] : wing.rect[3] - wing.rect[2] : ohSpan(oh);
    const eave = profile[zone.side === 'L' ? 0 : profile.length - 1];
    const run = Math.max(0.05, localSpan * Math.abs(peak.u - (eave?.u ?? (zone.side === 'L' ? 0 : 1))));
    const rise = Math.max(0.02, (peak.h - (eave?.h ?? 0)) * scale);
    const hyp = Math.hypot(run, rise);
    const straight = straighteningStop(profile.map((q) => ({ ...q, h: q.h * scale })), zone.side, localSpan);
    return {
      localSpan,
      run,
      rise,
      hyp,
      stops: straight.length ? [...straight, gestureStartStop(0)] : [],
    };
  })() : null;
  let active: number | undefined;
  let shoulderBase: typeof profile | null = null;
  const symmetric = profileSymmetric(profile);
  const ids = new Set(profile.map((q) => q.id).filter((id): id is string => !!id));
  // movePeak allocates the one point for a flat roof. Allocate it once per gesture and reuse its identity in every
  // preview, including a drag that reverses back to the start.
  let flatPeakId: string | undefined;
  if (flat) {
    const seed = movePeak(profile.map((q) => ({ ...q, h: q.h - flatLevel })), 0.5, 0.1, false);
    flatPeakId = seed.find((q) => q.id && !ids.has(q.id))?.id ?? newProfileId();
  }
  const peakProfile = (height: number) => {
    if (!flat) return movePeak(profile, peak.u, height, false);
    const relative = profile.map((q) => ({ ...q, h: q.h - flatLevel }));
    return movePeak(relative, 0.5, height - flatLevel, false).map((q) => ({
      ...q,
      h: q.h + flatLevel,
      ...(q.id && !ids.has(q.id) ? { id: flatPeakId } : {}),
    }));
  };
  const peakReadout = (height: number, stop?: string, limit?: string) => {
    const run = Math.max(peak.u * ohSpan(oh), (1 - peak.u) * ohSpan(oh));
    const pitch = Math.atan2(Math.max(0, height - flatLevel), Math.max(run, 1e-6)) * 180 / Math.PI;
    const pitchText = profile.every((q) => q.crease) && oh.form === 'extrude' && height > flatLevel + 0.05 ? ` · ${Math.round(pitch)}°` : '';
    return `ridge ${fmtM(height)}${pitchText}${stop ? ` · ${stop}` : ''}${limit ? ` · ${limit}` : ''}`;
  };

  const mode: DragMode = zone.kind === 'ridge' || zone.kind === 'apex' || zone.kind === 'flatTop'
    ? { type: 'vertical', at: startPlan }
    : zone.kind === 'slope'
      ? { type: 'surface', origin: startPlan, tan: spanDir, y0: 0 }
      : { type: 'plan', y: startY };
  const make = (patch: Partial<Overhead>, measure: string, commit: string) => ({ op: opOverhead(oh.id, patch), measure, commit });
  const handle: Handle = {
    id: `hold:${zone.kind}`,
    pos: new THREE.Vector3(startPlan[0], startY + lift + 0.04, startPlan[1]),
    shape: 'ring', mode, label: '', title: zoneTipFor(oh, zone),
    drag: (pt, ev) => {
      const free = ev.altKey;
      if (zone.kind === 'ridge' || zone.kind === 'apex' || zone.kind === 'flatTop') {
        const initial = flat ? 0 : peak.h * scale;
        const delta = pt.y - startY;
        const raw = initial + delta;
        const max = maxRise(oh) * scale;
        let local = clamp(raw, 0, max);
        const limit = raw < 0 ? 'at the eave' : raw > max ? 'height limit' : undefined;
        const stops = zone.kind === 'flatTop'
          ? [30, 45, 60].map((deg) => ({ at: ohSpan(oh) * 0.5 * Math.tan(deg * Math.PI / 180) * scale, label: `${deg}° pitch`, key: `pitch:${deg}` }))
          : oh.form === 'extrude' && profile.every((q) => q.crease) ? pitchStops(oh).map((s) => ({ ...s, at: s.at * scale })) : [];
        stops.push(gestureStartStop(initial));
        const snapped = detent(free ? local : round(local, 0.01), stops, Math.max(0.06, 8 * mpp), free, active);
        active = snapped.active;
        local = clamp(snapped.v, 0, max);
        const height = flat ? flatLevel + local / scale : local / scale;
        const next = peakProfile(height);
        const word = height > (flat ? flatLevel : peak.h) + 0.01 ? 'taller' : height < (flat ? flatLevel : peak.h) - 0.01 ? 'flatter' : 'as it was';
        return make({ profile: next }, peakReadout(height, snapped.label, limit), `Made ${oh.name} ${word}`);
      }

      if (zone.kind === 'ridgeEnd' || zone.kind === 'endFace') {
        const crossAxis: V2 = wing?.span === 'v' ? d : e;
        const inward = zone.end === 'A' ? 1 : -1;
        const displacement = dot(sub(pt.plan, startPlan), mul(crossAxis, inward));
        const maxHip = maximumHip(oh, state.kind === 'compound' ? state.wings : undefined);
        const candidate = clamp((oh.hip ?? 0) + displacement / scale, 0, maxHip);
        const stops = hipStops(oh).filter((s) => s.at <= maxHip + 1e-8);
        const snapped = detent(free ? candidate : round(candidate, 0.05), stops, Math.max(0.25, 10 * mpp) / scale, free, active);
        active = snapped.active;
        const hip = clamp(snapped.v, 0, maxHip);
        const word = hip < 0.01 ? 'gable ends' : Math.abs(hip - maxHip) < 0.02 ? 'ends meet' : `hip ${fmtM(hip)}`;
        return make({ hip }, `${state.kind === 'compound' ? 'All wings · linked ends · ' : ''}${word}${snapped.label ? ` · ${snapped.label}` : ''}`, `Hipped ${oh.name}’s ends`);
      }

      if (zone.kind === 'slope') {
        if (!fullness) return null;
        const along = dot(sub(pt.plan, startPlan), spanDir) * (zone.side === 'L' ? -1 : 1);
        const dy = pt.y - (startY + lift);
        // `along` points out toward the eave. The outward unit normal has components (rise, run) in
        // (plan-outward, up) coordinates; projecting on the slope tangent would invent fullness on a tangent drag.
        let displacement = along * (fullness.rise / fullness.hyp) + dy * (fullness.run / fullness.hyp);
        const snapped = detent(free ? displacement : round(displacement, 0.01), fullness.stops, Math.max(0.05, 6 * mpp), free, active);
        active = snapped.active;
        displacement = snapped.v;
        if (Math.abs(displacement) < 0.002) return make({ profile }, `${state.kind === 'compound' ? 'All wings · ' : ''}as it was`, `Made ${oh.name} fuller`);
        if (!shoulderBase) {
          shoulderBase = ensureShoulder(profile, zone.side);
          if (symmetric) shoulderBase = ensureShoulder(shoulderBase, zone.side === 'L' ? 'R' : 'L');
        }
        const du = (zone.side === 'L' ? -1 : 1) * displacement * (fullness.rise / fullness.hyp) / Math.max(fullness.localSpan, 0.1);
        const next = pullShoulder(shoulderBase, zone.side, free ? du : round(du, 0.005), symmetric);
        const word = displacement >= 0 ? 'fuller' : 'pointier';
        return make({ profile: next }, `${state.kind === 'compound' ? 'All wings · same section · ' : ''}${snapped.label ?? word}`, `Made ${oh.name} ${word}`);
      }

      if (zone.kind === 'eave') {
        const a = oh.outline[zone.edge], b = oh.outline[(zone.edge + 1) % oh.outline.length];
        if (!a || !b) return null;
        const outward = mul(perp(norm(sub(b, a))), -1); // outlines are CCW, so the right normal points out
        const displacement = dot(sub(pt.plan, startPlan), outward);
        if (oh.fit) {
          const start = oh.fit.overhang;
          const raw = start + displacement;
          const bounded = clamp(raw, 0, 1.5);
          const snapped = detent(free ? bounded : round(bounded, 0.05), OVERHANG_STOPS, 0.05, free, active);
          active = snapped.active;
          const overhang = clamp(snapped.v, 0, 1.5);
          const limit = raw < 0 ? 'no overhang is the limit' : raw > 1.5 ? 'overhang limit' : '';
          return make({ fit: { ...oh.fit, overhang } }, `all fitted edges · overhang ${Math.round(overhang * 100)} cm${snapped.label ? ` · ${snapped.label}` : ''}${limit ? ` · ${limit}` : ''}`, `Changed ${oh.name}’s overhang`);
        }
        const delta = free ? displacement : round(displacement, 0.05);
        const outline = oh.outline.slice();
        outline[zone.edge] = add(a, mul(outward, delta));
        outline[(zone.edge + 1) % outline.length] = add(b, mul(outward, delta));
        return make({ outline }, `${delta >= 0 ? 'out' : 'in'} ${fmtM(Math.abs(delta))}`, `Pushed ${oh.name}’s edge`);
      }
      return null;
    },
  };
  return handle;
}

const levelProfile = (pts: { h: number }[]) => pts.length > 0 && pts.every((q) => Math.abs(q.h - pts[0].h) < 0.05);

function maximumHip(oh: Overhead, wings?: Wing[]): number {
  if (!wings) {
    const f = ohFrame(oh);
    return Math.max(0, (f.emax - f.emin) / 2);
  }
  const limits = wings.flatMap((w) => {
    if (w.ends.lo !== 'exposed' && w.ends.hi !== 'exposed') return [];
    const ridgeLength = w.span === 'w' ? w.rect[3] - w.rect[2] : w.rect[1] - w.rect[0];
    return [ridgeLength / (2 * Math.max(w.scale, 1e-6))];
  });
  return limits.length ? Math.max(0, Math.min(...limits)) : 0;
}

function zoneTipFor(oh: Overhead, zone: RoofZone) {
  if (zone.kind === 'eave' && oh.fit) return 'Drag out for more overhang';
  if (zone.kind === 'slope' && zone.locked) return 'This slope needs detailed editing';
  if (zone.kind === 'ridge' || zone.kind === 'apex') return 'Drag up or down: taller or flatter';
  if (zone.kind === 'ridgeEnd' || zone.kind === 'endFace') return 'Drag inward: hip both ends';
  if (zone.kind === 'slope') return 'Drag out for fuller slopes, back for pointier';
  if (zone.kind === 'flatTop') return 'Pull up to give the roof a peak';
  return oh.fit ? 'Drag out for more overhang' : 'Push or pull this edge';
}

const changedIds = (start: { id?: string; u: number; h: number }[], cand: { id?: string; u: number; h: number }[]): string[] => {
  const before = new Map(start.map((q) => [q.id, q]));
  const out: string[] = [];
  for (const q of cand) {
    const s = before.get(q.id);
    if (!s || Math.abs(s.u - q.u) > 1e-9 || Math.abs(s.h - q.h) > 1e-9) if (q.id) out.push(q.id);
  }
  for (const q of start) if (q.id && !cand.some((c) => c.id === q.id)) out.push(q.id);
  return out;
};

/** Edit Shape's vocabulary: every joint, both edges of a step and its grip, the outline, and the eave. */
function shapingHandles(stage: Stage, oh: Overhead): Handle[] {
  const lift = stage.liftOf(oh.id);
  const sec = ohSection(oh);
  const prof = oh.profile;
  const span = ohSpan(oh);
  const maxR = maxRise(oh);
  const mpp = Math.max(1e-4, stage.mpp());
  const opts = {
    span, form: oh.form, maxRise: maxR,
    tolU: Math.max(1e-4, (8 * mpp) / Math.max(span, 1e-6)),
    tolH: Math.max(1e-4, 8 * mpp),
  };
  const out: Handle[] = [];
  const at = (u: number, h: number) => {
    const a = sec.at(u, h);
    return new THREE.Vector3(a.plan[0], a.y + lift + 0.04, a.plan[1]);
  };
  const result = (start: typeof prof, cand: typeof prof, measure: string, commit: string) => {
    const clean = validateGesture(start, cand, changedIds(start, cand), opts);
    if (!clean.valid) return { reason: clean.notes[0] ?? 'not possible here', measure };
    return { op: opOverhead(oh.id, { profile: clean.profile }), measure: clean.notes.length ? clean.notes.join(' · ') : measure, commit };
  };
  for (const j of readSection(prof).joints) {
    if (j.kind === 'step') continue;
    out.push({
      id: `j:${j.id}`, pos: at(j.u, j.h), shape: 'dot', tier: 'primary',
      mode: { type: 'surface', origin: sec.origin, tan: sec.tan, y0: 0 }, label: '',
      title: j.kind === 'ridge' ? 'Drag the ridge up or down' : j.kind === 'eave' ? 'Drag this eave up or down' : 'Drag this joint of the section',
      drag: (pt, ev) => {
        const r = sec.uh(pt.plan, pt.y - lift);
        const cand = moveJoint(prof, j.id, r.u, r.h, { ...opts, free: ev.altKey, solo: ev.shiftKey });
        const word = j.kind === 'ridge' ? `Moved ${oh.name}’s ridge` : j.kind === 'eave' ? `Moved ${oh.name}’s eave` : `Moved a joint on ${oh.name}’s section`;
        return result(prof, cand.profile, cand.label ?? `${fmtM(r.h)} above the eave`, word);
      },
    });
  }
  for (const j of readSection(prof).joints) {
    if (j.kind !== 'step') continue;
    const firstIsLow = j.h <= j.h2;
    for (const edge of ['lo', 'hi'] as const) {
      const isFirst = (edge === 'lo') === firstIsLow;
      out.push({
        id: `j${edge}:${j.id}`, pos: at(j.u, isFirst ? j.h : j.h2), shape: 'dot', tier: 'primary',
        mode: { type: 'surface', origin: sec.origin, tan: sec.tan, y0: 0 }, label: '',
        title: edge === 'lo' ? 'Drag the lower edge of the step (onto the upper edge to close it)' : 'Drag the upper edge of the step (onto the lower edge to close it)',
        drag: (pt) => {
          const r = sec.uh(pt.plan, pt.y - lift);
          const cand = moveStepEdge(prof, j.id, isFirst ? 'lo' : 'hi', r.h, opts);
          return result(prof, cand.profile, cand.label ?? `step ${fmtM(Math.abs(j.h2 - j.h))}`, `Changed ${oh.name}’s step`);
        },
      });
    }
    out.push({
      id: `j:${j.id}`, pos: at(j.u, (j.h + j.h2) / 2), shape: 'move', tier: 'primary',
      mode: { type: 'surface', origin: sec.origin, tan: sec.tan, y0: 0 }, label: '', title: 'Drag the step sideways',
      drag: (pt, ev) => {
        const r = sec.uh(pt.plan, pt.y - lift);
        const cand = moveJoint(prof, j.id, r.u, j.h, { ...opts, free: ev.altKey, solo: ev.shiftKey });
        return result(prof, cand.profile, `step at ${fmtM(r.u * span)}`, `Moved ${oh.name}’s step`);
      },
    });
  }
  out.push(...outlineControls(oh, lift, 'primary', store.project, Math.max(0.3, 16 * mpp)));
  const c = polyCentroid(oh.outline);
  const k0 = oh.outline.reduce((b, q, i) => (dist(q, c) > dist(oh.outline[b], c) ? i : b), 0);
  const ec = add(oh.outline[k0], mul(norm(sub(oh.outline[k0], c)), 0.6));
  out.push({
    id: 'eave', pos: new THREE.Vector3(ec[0], oh.baseY + lift, ec[1]), shape: 'bead', tier: 'primary',
    mode: { type: 'vertical', at: ec }, label: 'height', title: 'Drag to raise or lower the whole roof',
    drag: (pt) => {
      const yy = Math.max(1.0, snapY(pt.y));
      return { op: opOverhead(oh.id, { baseY: yy }), measure: `eave at ${fmtM(yy)}`, commit: `Moved ${oh.name}` };
    },
  });
  return out;
}

/** Corners and edges: the same outline controls in every depth of Edit Shape and in Select. */
function outlineControls(e: Overhead, lift: number, tier: 'primary' | 'detail', p: Project, magR: number): Handle[] {
  const out: Handle[] = [];
  const outline = e.outline;
  const y = e.baseY + e.thick;
  const yAt = (q: V2) => (ohHasSurface(e) ? ohTopAt(e, q) : y);
  const set = (ol: V2[]): Op => opOverhead(e.id, { outline: ol });
  outline.forEach((q, i) => {
    out.push({
      tier, id: `n:${i}`, pos: new THREE.Vector3(q[0], yAt(q) + 0.04 + lift, q[1]), shape: 'dot', mode: { type: 'plan', y }, label: '', title: 'Drag the corner',
      drag: (pt, ev) => {
        const ol = outline.slice();
        const n = ol.length;
        const s = snapPoint(p, pt.plan, { level: y, tol: magR, anchors: [ol[(i - 1 + n) % n], ol[(i + 1) % n]], own: ol.filter((_, k) => k !== i), free: ev.altKey, fine: ev.shiftKey, anyLevel: true });
        ol[i] = s.p;
        return { op: set(ol), measure: '', guides: s.guides, snap: s.label, at: s.p };
      },
    });
  });
  outline.forEach((q, i) => {
    const b = outline[(i + 1) % outline.length];
    if (dist(q, b) < 0.8 || outline.length > 24) return;
    const mid = lerp2(q, b, 0.5);
    const nn = perp(norm(sub(b, q)));
    out.push({
      tier, id: `e:${i}`, pos: new THREE.Vector3(mid[0], yAt(mid) + 0.04 + lift, mid[1]), shape: 'ring', mode: { type: 'plan', y }, label: '',
      title: e.fit ? 'Pull to give it its own outline (it stops following the walls)' : 'Push or pull this edge',
      drag: (pt) => {
        const dd = round(dot(sub(pt.plan, mid), nn), 0.05);
        const ol = outline.slice();
        ol[i] = add(q, mul(nn, dd));
        ol[(i + 1) % outline.length] = add(b, mul(nn, dd));
        return { op: set(ol), measure: `${dd >= 0 ? '+' : ''}${fmtM(-dd)}` };
      },
    });
  });
  return out;
}

export function handlesFor(stage: Stage, p: Project, d: Derived, sel: string | null): Handle[] {
  // handles belong to Select: in Draw a stroke that starts on a wall's middle or end must draw, never reshape
  if (!sel || store.ui.mode !== 'make' || store.ui.tool !== 'select') return [];
  if (sel === 'building') return buildingHandles(p, d);
  const e = findEl(p, sel);
  if (!e) return [];
  if (store.ui.shaping === sel && e.kind === 'overhead') return shapingHandles(stage, e);
  const lift = stage.liftOf(sel);
  const out: Handle[] = [];
  const mpp = stage.mpp();
  const magR = Math.max(0.3, 16 * mpp);
  switch (e.kind) {
    case 'run': {
      const r = e as Run;
      const w = d.walls.get(r.id);
      const g = runGeom(r);
      if (r.shape === 'circle') {
        out.push({
          id: 'center', pos: new THREE.Vector3(r.center[0], r.baseY + 0.05 + lift, r.center[1]), shape: 'move', mode: { type: 'plan', y: r.baseY },
          label: 'move', title: 'Drag to move the round room',
          drag: (pt) => ({ op: opMoveRun(r.id, sub(snapP(pt.plan), r.center)), measure: '' }),
        });
        out.push({
          id: 'radius', pos: new THREE.Vector3(r.center[0] + r.radius, r.baseY + 0.05 + lift, r.center[1]), shape: 'dot', mode: { type: 'plan', y: r.baseY },
          label: 'size', title: 'Drag to make it bigger or smaller — it stays round',
          drag: (pt) => {
            const rr = Math.max(0.6, round(dist(pt.plan, r.center), 0.05));
            return { op: opRadius(r.id, rr), measure: `${fmtM(rr * 2)} across` };
          },
        });
      } else {
        // a few handles that matter by default: ends (and every corner of a simple room); the rest near the pointer
        const simple = r.pts.length <= 4;
        r.pts.forEach((q, i) => {
          const isEnd = !r.closed && (i === 0 || i === r.pts.length - 1);
          out.push({
            tier: isEnd || simple ? 'primary' : 'detail',
            id: `node:${i}`, pos: new THREE.Vector3(q[0], r.baseY + 0.05 + lift, q[1]), shape: 'dot', mode: { type: 'plan', y: r.baseY },
            label: '', title: isEnd ? 'Drag the end — let go on another wall to join it' : 'Drag the corner',
            drag: (pt, ev) => {
              const n = r.pts.length;
              const nb = [r.closed || i > 0 ? r.pts[(i - 1 + n) % n] : null, r.closed || i < n - 1 ? r.pts[(i + 1) % n] : null].filter((q): q is V2 => !!q);
              // snapping moves the point; landing on another wall only offers a join (never ties by itself)
              const s = snapPoint(p, pt.plan, { level: r.baseY, tol: magR, anchors: nb, exclude: r.id, own: r.pts.filter((_, k) => k !== i), free: ev.altKey, fine: ev.shiftKey, walls: isEnd });
              let tie: Tie | null | 'keep' = 'keep';
              let touch: Tie | null = null;
              if (isEnd) {
                const had = i === 0 ? r.tieA : r.tieB;
                if (had && s.touching?.host === had.host) tie = s.touching;
                else if (had) tie = null;
                if (s.touching && s.touching.host !== had?.host) touch = s.touching;
              }
              const prev = nb[0];
              return { op: opMoveNode(r.id, i, s.p, tie, touch), measure: prev ? fmtM(dist(s.p, prev)) : '', knot: s.touching ? s.p : null, guides: s.guides, snap: s.label, at: s.p };
            },
          });
        });
        const nseg = r.closed ? r.pts.length : r.pts.length - 1;
        for (let i = 0; i < nseg; i++) {
          const a = r.pts[i], b = r.pts[(i + 1) % r.pts.length];
          const k = r.bulge[i] ?? 0;
          const mid = Math.abs(k) < 1e-4 ? lerp2(a, b, 0.5) : arcInfo(a, b, k).mid;
          out.push({
            tier: 'detail',
            id: `bend:${i}`, pos: new THREE.Vector3(mid[0], r.baseY + 0.05 + lift, mid[1]), shape: 'ring', mode: { type: 'plan', y: r.baseY },
            label: '', title: 'Drag to bend this stretch of wall (drag back to straighten)',
            drag: (pt) => {
              const c = lerp2(a, b, 0.5);
              const n = perp(norm(sub(b, a)));
              const sg = dot(sub(pt.plan, c), n);
              const kk = bulgeFromSagitta(a, b, sg);
              return { op: opBend(r.id, i, kk), measure: Math.abs(kk) < 0.025 ? 'straight' : `bow ${fmtM(Math.abs(sg))}` };
            },
          });
        }
        const bb = bbox(r.pts);
        const c: V2 = lerp2(bb.min, bb.max, 0.5);
        const near = closestOnRun(r, c).q;
        out.push({
          id: 'move', pos: new THREE.Vector3(near[0], r.baseY + 0.05 + lift, near[1]), shape: 'move', mode: { type: 'plan', y: r.baseY },
          label: 'move', title: 'Drag to move the whole wall',
          drag: (pt) => ({ op: opMoveRun(r.id, snapP(sub(pt.plan, near))), measure: '' }),
        });
      }
      if (w) {
        const s = g.L * (r.shape === 'circle' ? 0.125 : 0.5);
        const q = pointAtS(g.ps, s).p;
        const top = wallTopAt(w, s);
        out.push({
          id: 'top', pos: new THREE.Vector3(q[0], top + lift, q[1]), shape: 'bead', mode: { type: 'vertical', at: q },
          label: r.top === null ? 'height' : 'set height', title: 'Drag to set this wall’s own height (a low wall, a screen)',
          drag: (pt) => {
            const h = Math.max(0.2, snapY(pt.y - r.baseY));
            return { op: opRunTop(r.id, h), measure: `${fmtM(h)} · ${inPeople(h)}` };
          },
        });
      }
      break;
    }
    case 'room': {
      const r = d.roomById.get(e.id);
      if (!r) break;
      const at = r.at;
      out.push({
        id: 'floor', pos: new THREE.Vector3(at[0], r.floorY + 0.06 + lift, at[1]), shape: 'bead', mode: { type: 'vertical', at },
        label: 'floor', title: 'Drag up to raise the floor (a plinth); down to sink it (a court)',
        drag: (pt) => {
          const f = snapY(Math.max(r.level - 4, Math.min(r.level + 4, pt.y)));
          const rel = f - r.level;
          return { op: opRoom(r.id, { floorY: f }), measure: Math.abs(rel) < 0.01 ? 'floor at ground' : `${rel > 0 ? 'raised' : 'sunk'} ${fmtM(Math.abs(rel), 2)}` };
        },
      });
      out.push({
        id: 'ceiling', pos: new THREE.Vector3(at[0], r.topY + lift, at[1]), shape: 'bead', mode: { type: 'vertical', at },
        label: 'ceiling', title: 'Drag to make the room taller or lower',
        drag: (pt) => {
          const h = Math.max(1.9, snapY(pt.y - r.floorY));
          return { op: opRoom(r.id, { height: h }), measure: `${fmtM(h)} · ${inPeople(h)}` };
        },
      });
      break;
    }
    case 'opening': {
      const o = e;
      const w = d.walls.get(o.run);
      const dop = w?.openings.find((x) => x.o.id === o.id);
      if (!w || !dop) break;
      const g = runGeom(w.run);
      const st = pointAtS(g.ps, dop.s);
      const n = perp(st.tan);
      const off = mul(n, w.run.thick / 2 + 0.06);
      const base = add(st.p, off);
      const mode: DragMode = { type: 'surface', origin: st.p, tan: st.tan, y0: 0 };
      const sOf = (pt: { plan: V2 }) => dop.s + dot(sub(pt.plan, st.p), st.tan);
      const L = w.L;
      const P3 = (ds: number, y: number) => {
        const q = add(base, mul(st.tan, ds));
        return new THREE.Vector3(q[0], y + lift, q[1]);
      };
      out.push({
        id: 'slide', pos: P3(0, (dop.y0 + dop.y1) / 2), shape: 'move', mode, label: 'slide', title: 'Slide along the wall',
        drag: (pt) => {
          const s = Math.max(0, Math.min(L, sOf(pt)));
          return { op: opOpening(o.id, { t: s / L }), measure: `${fmtM(s - o.width / 2)} from the end` };
        },
      });
      for (const side of [-1, 1]) {
        out.push({
          tier: side < 0 ? 'detail' : 'primary',
          id: `w${side}`, pos: P3((side * o.width) / 2, (dop.y0 + dop.y1) / 2), shape: 'dot', mode, label: '', title: 'Drag to widen',
          drag: (pt) => {
            const wd = Math.max(0.4, round(Math.abs(sOf(pt) - dop.s) * 2, 0.05));
            return { op: opOpening(o.id, { width: wd }), measure: `${fmtM(wd)} wide` };
          },
        });
      }
      out.push({
        id: 'top', pos: P3(0, dop.y1), shape: 'dot', mode, label: '', title: 'Drag to make it taller',
        drag: (pt) => {
          const h = Math.max(o.sill + 0.4, snapY(pt.y - dop.floor));
          return { op: opOpening(o.id, { height: h }), measure: `${fmtM(h - o.sill)} tall` };
        },
      });
      if (o.shape !== 'round') {
        const rise = o.shape === 'rect' ? 0 : o.rise;
        out.push({
          tier: o.shape === 'rect' ? 'detail' : 'primary',
          id: 'rise', pos: P3(o.width * 0.32, dop.y1 - Math.max(rise, 0.12)), shape: 'ring', mode, label: '', title: 'Drag down to arch the head; back up to square it',
          drag: (pt) => {
            const rr = Math.max(0, Math.min(o.width / 2 + 0.4, dop.y1 - pt.y));
            if (rr < 0.12) return { op: opOpening(o.id, { shape: 'rect', rise: 0 }), measure: 'square head' };
            return { op: opOpening(o.id, { shape: o.shape === 'pointed' ? 'pointed' : 'arch', rise: round(rr, 0.05) }), measure: `arch rises ${fmtM(rr, 2)}` };
          },
        });
      }
      if (o.sill > 0.2 || o.shape === 'round') {
        out.push({
          tier: 'detail',
          id: 'sill', pos: P3(0, dop.y0), shape: 'dot', mode, label: '', title: 'Drag to raise or lower the sill',
          drag: (pt) => {
            const sill = Math.max(0, Math.min(o.height - 0.4, snapY(pt.y - dop.floor)));
            return { op: opOpening(o.id, { sill: sill < 0.2 ? 0 : sill }), measure: sill < 0.2 ? 'down to the floor' : `sill at ${fmtM(sill)}` };
          },
        });
      }
      break;
    }
    case 'overhead':
    case 'deck':
    case 'void': {
      const outline = e.outline;
      const y = e.kind === 'overhead' ? e.baseY + e.thick : e.kind === 'deck' ? e.y : Math.min(e.toY, d.bounds.top + 0.2);
      const set = (ol: V2[]): Op => (e.kind === 'overhead' ? opOverhead(e.id, { outline: ol }) : e.kind === 'deck' ? opDeck(e.id, { outline: ol }) : opVoid(e.id, { outline: ol }));
      // a roof with no surface has no top to grab: its outline handles stay at the eave
      const yAt = (q: V2) => (e.kind === 'overhead' && ohHasSurface(e) ? ohTopAt(e, q) : y);
      // edges push and pull by default; corners come out as the pointer nears them
      outline.forEach((q, i) => {
        out.push({
          tier: 'detail',
          id: `n:${i}`, pos: new THREE.Vector3(q[0], yAt(q) + 0.04 + lift, q[1]), shape: 'dot', mode: { type: 'plan', y }, label: '', title: 'Drag the corner',
          drag: (pt, ev) => {
            const ol = outline.slice();
            const n = ol.length;
            const s = snapPoint(p, pt.plan, { level: y, tol: magR, anchors: [ol[(i - 1 + n) % n], ol[(i + 1) % n]], own: ol.filter((_, k) => k !== i), free: ev.altKey, fine: ev.shiftKey, anyLevel: true });
            ol[i] = s.p;
            return { op: set(ol), measure: '', guides: s.guides, snap: s.label, at: s.p };
          },
        });
      });
      outline.forEach((q, i) => {
        const b = outline[(i + 1) % outline.length];
        if (dist(q, b) < 0.8 || outline.length > 24) return;
        const mid = lerp2(q, b, 0.5);
        const nn = perp(norm(sub(b, q)));
        out.push({
          tier: e.kind === 'overhead' ? 'detail' : 'primary',
          id: `e:${i}`, pos: new THREE.Vector3(mid[0], yAt(mid) + 0.04 + lift, mid[1]), shape: 'ring', mode: { type: 'plan', y }, label: '', title: 'Push or pull this edge',
          drag: (pt) => {
            const dd = round(dot(sub(pt.plan, mid), nn), 0.05);
            const ol = outline.slice();
            ol[i] = add(q, mul(nn, dd));
            ol[(i + 1) % outline.length] = add(b, mul(nn, dd));
            return { op: set(ol), measure: `${dd >= 0 ? '+' : ''}${fmtM(-dd)}` };
          },
        });
      });
      const c = polyCentroid(outline);
      if (e.kind === 'overhead') {
        // the eave sits out at a corner, at eave height: it reads as "the whole roof", apart from the peak above the middle
        const k0 = outline.reduce((b, q, i) => (dist(q, c) > dist(outline[b], c) ? i : b), 0);
        const ec = add(outline[k0], mul(norm(sub(outline[k0], c)), 0.6));
        if (!e.fit) out.push({
          id: 'eave', pos: new THREE.Vector3(ec[0], e.baseY + lift, ec[1]), shape: 'bead', mode: { type: 'vertical', at: ec }, label: 'height', title: 'Drag to raise or lower the whole roof',
          drag: (pt) => {
            const yy = Math.max(1.0, snapY(pt.y));
            return { op: opOverhead(e.id, { baseY: yy }), measure: `eave at ${fmtM(yy)}` };
          },
        });
        // A roof with no surface has no top to sculpt: its peak, hips, shoulders and section points would float over a
        // roof that is not drawn, and the issue already carries the two repairs. So the vocabulary is outline and eave
        // only, and the section can still be edited in the pad, which is where the way back is written down.
        if (!ohHasSurface(e)) break;
        // Sculpting: a peak (up = taller, sideways = lean) and a shoulder on each slope (out = broader, in = pointier).
        // With the eave and the edges (width), that's the whole default vocabulary; the profile's own points come out
        // as the pointer nears them, for precision.
        const sec = ohSection(e);
        const prof = e.profile;
        const pk = profilePeak(prof);
        const flat = pk.h < 0.05;
        const pkU = flat ? 0.5 : pk.u;
        const pkAt = sec.at(pkU, pk.h);
        const off = 0.3;
        out.push({
          tier: 'detail',
          id: 'peak', pos: new THREE.Vector3(pkAt.plan[0], pkAt.y + off + lift, pkAt.plan[1]), shape: 'bead',
          mode: { type: 'surface', origin: sec.origin, tan: sec.tan, y0: 0 }, label: flat ? 'pull up' : 'peak',
          title: flat ? 'Pull up to give the roof a peak' : sec.revolve ? 'Drag up or down: taller or flatter' : 'Drag up or down: taller or flatter · sideways: lean the peak',
          drag: (pt) => {
            const r = sec.uh(pt.plan, pt.y - lift);
            const h = Math.max(0, Math.min(maxRise(e), pk.h + snapY(r.h - pk.h - off)));
            const u = pkU + round(r.u - pkU, 0.01);
            const next = movePeak(prof, u, h, !sec.revolve);
            const np = profilePeak(next);
            const lean = !sec.revolve && Math.abs(np.u - pkU) > 0.004 ? ` · peak ${Math.round(np.u * 100)}% across` : '';
            const top = np.h >= maxRise(e) - 0.01 ? ' · as tall as it goes' : '';
            return { op: opOverhead(e.id, { profile: next }), measure: `rises ${fmtM(np.h)}${lean}${top}`, commit: `Reshaped ${e.name}’s peak` };
          },
        });
        // the ridge's ends: pull one in and both ends hip (the slopes come round the end); all the way in, a pyramid
        const fr = ohFrame(e);
        const canHip = !sec.revolve && !flat && pk.i0 > 0 && pk.i1 < prof.length - 1;
        if (canHip) {
          const ea: V2 = [-fr.d[1], fr.d[0]];
          const wr = fr.wmin + pk.u * (fr.wmax - fr.wmin);
          const half = (fr.emax - fr.emin) / 2;
          const ry = pkAt.y + 0.05;
          for (const end of ['A', 'B'] as const) {
            const v = end === 'A' ? fr.emin + fr.hip : fr.emax - fr.hip;
            const q = add(mul(fr.d, wr), mul(ea, v));
            out.push({
              tier: 'detail',
              id: `hip:${end}`, pos: new THREE.Vector3(q[0], ry + lift, q[1]), shape: 'ring', mode: { type: 'plan', y: ry }, label: '',
              title: 'Drag along the ridge: in to hip the ends (all the way for a pyramid), out for gable ends',
              drag: (pt) => {
                const along = dot(pt.plan, ea);
                const hip = Math.max(0, Math.min(half, round(end === 'A' ? along - fr.emin : fr.emax - along, 0.05)));
                const word = hip < 0.01 ? 'gable ends' : hip >= half - 0.01 ? 'a point (pyramid)' : `hipped ${fmtM(hip)}`;
                return { op: opOverhead(e.id, { hip }), measure: word, commit: hip < 0.01 ? `Gave ${e.name} gable ends` : `Hipped ${e.name}’s ends` };
              },
            });
          }
        }
        const sym = profileSymmetric(prof);
        const shoulders: { u: number; h: number }[] = [];
        for (const side of sec.revolve ? (['L'] as const) : (['L', 'R'] as const)) {
          const sh = profileShoulder(prof, side);
          if (!sh) continue;
          shoulders.push(sh);
          const a = sec.at(sh.u, sh.h);
          let base: typeof prof | null = null;
          out.push({
            tier: 'detail',
            id: `shoulder:${side}`, pos: new THREE.Vector3(a.plan[0], a.y + 0.05 + lift, a.plan[1]), shape: 'ring',
            mode: { type: 'surface', origin: sec.origin, tan: sec.tan, y0: 0 }, label: '',
            title: `Drag sideways: out for a broader roof, in for a pointier one${sym && !sec.revolve ? ' (both sides stay alike)' : ''}`,
            drag: (pt) => {
              // the first pull gives a straight slope its one shoulder point (both slopes, if they mirror)
              if (!base) {
                base = ensureShoulder(prof, side);
                if (sym) base = ensureShoulder(base, side === 'L' ? 'R' : 'L');
              }
              const r = sec.uh(pt.plan, pt.y - lift);
              const du = round(r.u - sh.u, 0.005);
              const outward = side === 'L' ? -du : du;
              const word = outward >= 0 ? 'broader' : 'pointier';
              return { op: opOverhead(e.id, { profile: pullShoulder(base, side, du, sym) }), measure: Math.abs(du) < 0.004 ? '' : word, commit: `Made ${e.name} ${word}` };
            },
          });
        }
        // the profile's own points, on the roof's section: the same points as in the pad (dragging either edits both)
        prof.forEach((q, i) => {
          if (!q.id || (sec.revolve && q.u > 0.5 + 1e-6)) return;
          // a single peak point and a slope's shoulder point already have their big handle
          if (!flat && pk.i0 === pk.i1 && i === pk.i0) return;
          if (shoulders.some((sh) => Math.abs(sh.u - q.u) < 0.03 && Math.abs(sh.h - q.h) < 0.12 * pk.h)) return;
          const a = sec.at(q.u, q.h);
          out.push({
            tier: 'detail', id: `pp:${q.id}`, pos: new THREE.Vector3(a.plan[0], a.y + 0.05 + lift, a.plan[1]), shape: 'dot',
            mode: { type: 'surface', origin: sec.origin, tan: sec.tan, y0: 0 }, label: '', title: 'Drag this point of the section (the same point as in the profile pad)',
            drag: (pt) => {
              const r = sec.uh(pt.plan, pt.y - lift);
              // steps from where it was: a sideways pull never nudges its height
              const h = Math.max(0, Math.min(maxRise(e), q.h + snapY(r.h - q.h)));
              const u = q.u + round(r.u - q.u, 0.005);
              return { op: opOverhead(e.id, { profile: moveProfilePoint(prof, q.id!, u, h) }), measure: `${fmtM(h)} above the eave` };
            },
          });
        });
      } else if (e.kind === 'deck') {
        out.push({
          id: 'height', pos: new THREE.Vector3(c[0], e.y + 0.05 + lift, c[1]), shape: 'bead', mode: { type: 'vertical', at: c }, label: 'level', title: 'Drag to raise or lower this floor',
          drag: (pt) => {
            const yy = Math.max(0.3, snapY(pt.y));
            return { op: opDeck(e.id, { y: yy }), measure: `${fmtM(yy)} up` };
          },
        });
      } else {
        const topY = Math.min(e.toY, d.bounds.top + 0.3);
        out.push({
          id: 'top', pos: new THREE.Vector3(c[0], topY + lift, c[1]), shape: 'bead', mode: { type: 'vertical', at: c }, label: e.toY > 50 ? 'to the sky' : 'top', title: 'Drag down to close the opening from above',
          drag: (pt) => {
            const yy = snapY(pt.y);
            const sky = yy > d.bounds.top - 0.2;
            return { op: opVoid(e.id, { toY: sky ? 999 : Math.max(e.fromY + 0.3, yy) }), measure: sky ? 'open to the sky' : `open up to ${fmtM(yy)}` };
          },
        });
        out.push({
          id: 'bottom', pos: new THREE.Vector3(c[0], e.fromY + 0.05 + lift, c[1]), shape: 'bead', mode: { type: 'vertical', at: c }, label: 'bottom', title: 'Drag up to close the opening from below',
          drag: (pt) => {
            const yy = snapY(pt.y);
            return { op: opVoid(e.id, { fromY: Math.min(yy, (e.toY > 50 ? d.bounds.top : e.toY) - 0.3) }), measure: `open down to ${fmtM(yy)}` };
          },
        });
      }
      break;
    }
    case 'stair': {
      e.path.forEach((q, i) => {
        const t = i / Math.max(1, e.path.length - 1);
        const yy = e.fromY + (e.toY - e.fromY) * t;
        if (e.path.length > 6 && i % Math.ceil(e.path.length / 6) !== 0 && i !== e.path.length - 1) return;
        out.push({
          tier: i === 0 || i === e.path.length - 1 ? 'primary' : 'detail',
          id: `p:${i}`, pos: new THREE.Vector3(q[0], yy + 0.1 + lift, q[1]), shape: 'dot', mode: { type: 'plan', y: yy }, label: '', title: 'Drag to reshape the stair',
          drag: (pt, ev) => {
            const path = e.path.slice();
            const s = snapPoint(p, pt.plan, { level: yy, tol: magR, anchors: [path[i - 1], path[i + 1]].filter((q): q is V2 => !!q), own: path.filter((_, k) => k !== i), free: ev.altKey, fine: ev.shiftKey, walls: false });
            path[i] = s.p;
            return { op: opStair(e.id, { path }), measure: '', guides: s.guides, snap: s.label, at: s.p };
          },
        });
      });
      break;
    }
    case 'post': {
      out.push({
        id: 'move', pos: new THREE.Vector3(e.at[0], 0.1 + lift, e.at[1]), shape: 'move', mode: { type: 'plan', y: 0 }, label: '', title: 'Drag to move the post',
        drag: (pt) => ({ op: ((pp) => { const q = pp.posts.find((x) => x.id === e.id); if (q) q.at = snapP(pt.plan); }) as Op, measure: '' }),
      });
      break;
    }
    case 'obj': {
      out.push({
        id: 'rot', pos: new THREE.Vector3(e.at[0] + 0.9, (d.roomById.get((e.on as any).id)?.floorY ?? (e.on as any).y ?? 0) + 0.05 + lift, e.at[1]), shape: 'ring', mode: { type: 'plan', y: 0 }, label: '', title: 'Drag around to turn it',
        drag: (pt) => {
          const a = Math.atan2(pt.plan[0] - e.at[0], pt.plan[1] - e.at[1]) - Math.PI / 2;
          return { op: opObj(e.id, { rot: round(a, Math.PI / 24) }), measure: `${Math.round(((round(a, Math.PI / 24) * 180) / Math.PI + 360) % 360)}°` };
        },
      });
      break;
    }
  }
  return out;
}

function buildingHandles(p: Project, d: Derived): Handle[] {
  const b = d.bounds;
  if (b.empty) return [];
  const c: V2 = lerp2(b.min, b.max, 0.5);
  const corner: V2 = [b.max[0] + 0.6, b.max[1] + 0.6];
  const r0 = dist(corner, c);
  return [
    {
      id: 'scale', pos: new THREE.Vector3(corner[0], 0.05, corner[1]), shape: 'dot', mode: { type: 'plan', y: 0 }, label: 'scale', title: 'Drag to make the whole building bigger or smaller',
      drag: (pt) => {
        const k = Math.max(0.4, Math.min(3, round(dist(pt.plan, c) / r0, 0.01)));
        return { op: opScaleAll(k, c, store.scaleHeights), measure: `${Math.round(k * 100)}%` };
      },
    },
  ];
}
