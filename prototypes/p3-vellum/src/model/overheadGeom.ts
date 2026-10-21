// Shared math for overheads: roofs, canopies, vaults — a drawn profile carried across a drawn outline.
import { V2, dot, fromAngle, polyCentroid, dist, clamp, pointInPoly, distToPolyEdge } from './geom2d';
import type { Overhead, ProfilePt } from './types';
import { PSample, sampleProfile, sampleRaw, profileH, profilePeak } from './profileCurve';
import { roofWingsState, wingHeight } from './wings';

export type { PSample };
export { sampleProfile, profileH, profilePeak };

export interface OhFrame {
  d: V2; // span axis
  wmin: number;
  wmax: number;
  /** along the ridge (perpendicular to the span): the outline's extent */
  emin: number;
  emax: number;
  /** hipped ends: the effective hip length (m) and the end slope, as profile fractions from eave (0) to peak (1) */
  hip: number;
  hipU: number;
  center: V2;
  R: number;
  samples: PSample[];
}

const frames = new WeakMap<Overhead, { key: string; f: OhFrame }>();

export function ohFrame(oh: Overhead): OhFrame {
  const key = `${oh.outline.join(';')}|${oh.dir}|${JSON.stringify(oh.profile)}|${oh.form}|${oh.hip ?? 0}`;
  const c = frames.get(oh);
  if (c && c.key === key) return c.f;
  const d = fromAngle(oh.dir);
  const e: V2 = [-d[1], d[0]];
  let wmin = Infinity, wmax = -Infinity, emin = Infinity, emax = -Infinity;
  for (const p of oh.outline) {
    const w = dot(p, d), v = dot(p, e);
    wmin = Math.min(wmin, w);
    wmax = Math.max(wmax, w);
    emin = Math.min(emin, v);
    emax = Math.max(emax, v);
  }
  const center = polyCentroid(oh.outline);
  let R = 0;
  for (const p of oh.outline) R = Math.max(R, dist(p, center));
  const pk = profilePeak(oh.profile);
  // a hip needs a ridge with slopes on both sides (not a raked or flat roof, not a dome)
  const canHip = oh.form === 'extrude' && pk.h > 0.05 && pk.i0 > 0 && pk.i1 < oh.profile.length - 1;
  const hip = canHip ? Math.min(Math.max(0, oh.hip ?? 0), (emax - emin) / 2) : 0;
  const f = { d, wmin, wmax, emin, emax, hip, hipU: oh.profile[pk.i0]?.u ?? 0.5, center, R, samples: sampleProfile(oh.profile) };
  frames.set(oh, { key, f });
  return f;
}

export function ohU(oh: Overhead, p: V2): number {
  const f = ohFrame(oh);
  if (oh.form === 'revolve') {
    const r = dist(p, f.center) / Math.max(f.R, 1e-6);
    return clamp((1 - r) / 2, 0, 0.5);
  }
  return clamp((dot(p, f.d) - f.wmin) / Math.max(f.wmax - f.wmin, 1e-6), 0, 1);
}

/**
 * A hipped end: within `hip` of either end of the ridge the roof slopes down to the end edge too, with the cross
 * slope's own shape. The height there is the lower of the two, so the hip lines come out where the slopes meet.
 */
export function hipH(f: OhFrame, v: number): number {
  if (f.hip <= 1e-6) return Infinity;
  const t = clamp(Math.min(v - f.emin, f.emax - v) / f.hip, 0, 1);
  return profileH(f.samples, t * f.hipU);
}

/**
 * Height above the eave at a plan point. A compound roof is the upper envelope of its wings' supports; otherwise it is
 * the one cross profile, cut down by hipped ends.
 */
export function ohH(oh: Overhead, p: V2): number {
  const f = ohFrame(oh);
  const st = roofWingsState(oh);
  if (st.kind === 'compound') {
    const ext = { d: f.d, e: [-f.d[1], f.d[0]] as V2 };
    let best = 0;
    for (const wg of st.wings) best = Math.max(best, wingHeight(wg, f.samples, st.peakU, ext, p));
    return best;
  }
  const h = profileH(f.samples, ohU(oh, p));
  return f.hip > 0 ? Math.min(h, hipH(f, dot(p, [-f.d[1], f.d[0]]))) : h;
}

/** The eave (baseY) is the underside where the overhead meets its walls; its thickness sits above. */
export function ohUndersideAt(oh: Overhead, p: V2): number {
  return oh.baseY + ohH(oh, p);
}

export function ohTopAt(oh: Overhead, p: V2): number {
  return ohUndersideAt(oh, p) + oh.thick;
}

export function ohCovers(oh: Overhead, p: V2, pad = 0): boolean {
  if (pointInPoly(p, oh.outline)) return true;
  return pad > 0 && distToPolyEdge(p, oh.outline) < pad;
}

export function ohRidge(oh: Overhead): number {
  const st = roofWingsState(oh);
  if (st.kind === 'compound') {
    const peak = Math.max(...sampleProfile(oh.profile).map((s) => s.h));
    return oh.baseY + oh.thick + peak * Math.max(...st.wings.map((w) => w.scale));
  }
  return oh.baseY + oh.thick + Math.max(...ohFrame(oh).samples.map((s) => s.h));
}

export function ohSpan(oh: Overhead) {
  const st = roofWingsState(oh);
  if (st.kind === 'compound') return st.primarySpan;
  const f = ohFrame(oh);
  return oh.form === 'revolve' ? f.R * 2 : f.wmax - f.wmin;
}

// Sculpting stops short of the extremes: a roof never rises past one and a half times its span (a spire, not a stick), a peak
// never leans so far that a slope stands vertical, and a shoulder keeps each slope at least a quarter of its width
// either side, so it bows but never folds flat against the peak or the eave.
export const MAX_RISE = 1.5;
export const PEAK_MARGIN = 0.12;
export const SHOULDER_MARGIN = 0.25;
export const maxRise = (oh: Overhead) => Math.max(1, MAX_RISE * ohSpan(oh));

/**
 * Where the profile shows on the roof itself: a section across the span through the middle (through the centre
 * for a dome). `at(u, h)` is a plan point and height on the top surface; `uh(plan, y)` reads one back.
 */
export function ohSection(oh: Overhead) {
  const f = ohFrame(oh);
  const e: V2 = [-f.d[1], f.d[0]];
  const top = oh.baseY + oh.thick;
  if (oh.form === 'revolve') {
    const at = (u: number, h: number) => ({ plan: [f.center[0] + f.d[0] * (u - 0.5) * 2 * f.R, f.center[1] + f.d[1] * (u - 0.5) * 2 * f.R] as V2, y: top + h });
    const uh = (q: V2, y: number) => ({ u: clamp((1 - Math.abs(dot([q[0] - f.center[0], q[1] - f.center[1]], f.d)) / Math.max(f.R, 1e-6)) / 2, 0, 0.5), h: y - top });
    return { origin: f.center, tan: f.d, at, uh, revolve: true };
  }
  const k = dot(f.center, e);
  const at = (u: number, h: number) => {
    const w = f.wmin + u * (f.wmax - f.wmin);
    return { plan: [f.d[0] * w + e[0] * k, f.d[1] * w + e[1] * k] as V2, y: top + h };
  };
  const uh = (q: V2, y: number) => ({ u: clamp((dot(q, f.d) - f.wmin) / Math.max(f.wmax - f.wmin, 1e-6), 0, 1), h: y - top });
  return { origin: at(0, 0).plan, tan: f.d, at, uh, revolve: false };
}

// ---- Editing the one authored profile (the pad and the roof in 3D both call these) ----
// Points are authored; the dense samples above are generated from them and never written back.

let pidN = 0;
export const newProfileId = () => `pp${(++pidN).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Give points without an identity one (older saves, hand-written profiles). Points that have one keep it. */
export function withIds(pts: ProfilePt[]): ProfilePt[] {
  return pts.every((q) => q.id) ? pts : pts.map((q) => (q.id ? q : { ...q, id: newProfileId() }));
}

const sameU = (a: number, b: number) => Math.abs(a - b) < 1e-6;
/** the other half of a vertical step at this point, if any */
function stepPartner(pts: ProfilePt[], i: number): number {
  if (i > 0 && sameU(pts[i - 1].u, pts[i].u)) return i - 1;
  if (i + 1 < pts.length && sameU(pts[i + 1].u, pts[i].u)) return i + 1;
  return -1;
}

/** Move one point. Ends stay at the eave edges; a step's two points move together so it stays vertical. */
export function moveProfilePoint(pts: ProfilePt[], id: string, u: number, h: number): ProfilePt[] {
  const i = pts.findIndex((q) => q.id === id);
  if (i < 0) return pts;
  const out = pts.map((q) => ({ ...q }));
  const n = out.length;
  const k = stepPartner(out, i);
  const group = k < 0 ? [i] : [Math.min(i, k), Math.max(i, k)];
  const pinned = group.some((g) => g === 0 || g === n - 1);
  if (!pinned) {
    const lo = group[0] > 0 ? out[group[0] - 1].u : 0;
    const hi = group[group.length - 1] < n - 1 ? out[group[group.length - 1] + 1].u : 1;
    const uu = clamp(u, lo, hi);
    for (const g of group) out[g].u = uu;
  }
  out[i].h = Math.max(0, h);
  return out;
}

/**
 * Drag the curve itself at fraction uGrab by dh metres, without adding points. Only heights change, so steps stay
 * vertical and creases stay sharp. The pull fades out across the smooth stretch around the pen and stops at the
 * nearest crease or step on each side (that point may still move); the eave ends never move. The weights are
 * scaled so the curve under the pen follows it exactly.
 */
export function bendProfile(pts: ProfilePt[], uGrab: number, dh: number): ProfilePt[] {
  const n = pts.length;
  if (n < 2 || Math.abs(dh) < 1e-9) return pts;
  let j = 0;
  while (j + 2 < n && pts[j + 1].u <= uGrab) j++;
  const barrier = (k: number) => k === 0 || k === n - 1 || pts[k].crease || stepPartner(pts, k) >= 0;
  let L = j, R = j + 1;
  while (!barrier(L)) L--;
  while (!barrier(R)) R++;
  const width = Math.max(uGrab - pts[L].u, pts[R].u - uGrab, 1e-3) * 1.35;
  const w = pts.map((q, k) => {
    if (k < L || k > R || k === 0 || k === n - 1) return 0;
    const t = Math.min(1, Math.abs(q.u - uGrab) / width);
    return (1 - t * t) * (1 - t * t);
  });
  // how much a unit lift of each point raises the curve at the pen (the unclamped curve is linear in heights)
  let c = 0;
  for (let k = L; k <= R; k++) {
    if (!w[k]) continue;
    const unit = pts.map((q, m) => ({ ...q, h: m === k ? 1 : 0 }));
    c += w[k] * profileH(sampleRaw(unit, false), uGrab);
  }
  if (c < 0.05) return pts;
  return pts.map((q, k) => (w[k] ? { ...q, h: Math.max(0, q.h + (w[k] * dh) / c) } : q));
}

/** Add a smooth point on the curve at fraction u (more detail, on purpose). Returns the profile and the new id. */
export function insertProfilePoint(pts: ProfilePt[], u: number): { profile: ProfilePt[]; id: string } {
  const uu = clamp(u, 1e-3, 1 - 1e-3);
  let j = 0;
  while (j + 2 < pts.length && pts[j + 1].u <= uu) j++;
  const id = newProfileId();
  const h = profileH(sampleProfile(pts), uu);
  const out = pts.slice();
  out.splice(j + 1, 0, { u: uu, h, crease: false, id });
  return { profile: out, id };
}

/** Remove a point; the eave ends stay. */
export function removeProfilePoint(pts: ProfilePt[], id: string): ProfilePt[] {
  const i = pts.findIndex((q) => q.id === id);
  if (i <= 0 || i >= pts.length - 1 || pts.length <= 2) return pts;
  return pts.filter((_, k) => k !== i);
}

export function setCrease(pts: ProfilePt[], id: string, crease: boolean): ProfilePt[] {
  return pts.map((q) => (q.id === id ? { ...q, crease } : q));
}

// ---- Sculpting: a few big moves on the same authored points (the roof's primary handles in 3D) ----

/** Mirror-symmetric about the middle (then a pull on one shoulder pulls both). */
export function profileSymmetric(pts: ProfilePt[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[n - 1 - i];
    if (Math.abs(a.u - (1 - b.u)) > 2e-3 || Math.abs(a.h - b.h) > 2e-3) return false;
  }
  return true;
}

/**
 * Drag the peak to (u, h): up and down scales every height (the shape keeps its character); sideways leans the
 * peak, carrying each slope's points along proportionally, so creases, curves and steps keep their places on their
 * slope. A flat roof grows a sharp peak where it is pulled — the one new point, made on purpose by pulling up.
 */
export function movePeak(pts: ProfilePt[], u: number, h: number, lean = true): ProfilePt[] {
  const n = pts.length;
  const pk = profilePeak(pts);
  const hh = Math.max(0, h);
  if (pk.h < 0.05) {
    if (hh < 0.05) return pts;
    const uu = lean ? clamp(u, PEAK_MARGIN, 1 - PEAK_MARGIN) : 0.5;
    let j = 0;
    while (j + 2 < n && pts[j + 1].u <= uu) j++;
    const out = pts.map((q) => ({ ...q, h: 0 }));
    out.splice(j + 1, 0, { u: uu, h: hh, crease: true, id: newProfileId() });
    return out;
  }
  const k = hh / pk.h;
  let out = pts.map((q) => ({ ...q, h: q.h * k }));
  // a peak on an eave edge (a raked or butterfly roof) has nowhere to lean
  if (!lean || pk.i0 === 0 || pk.i1 === n - 1) return out;
  const half = (pts[pk.i1].u - pts[pk.i0].u) / 2;
  const c = clamp(u, half + PEAK_MARGIN, 1 - half - PEAK_MARGIN);
  const a0 = pts[pk.i0].u, a1 = pts[pk.i1].u;
  const b0 = c - half, b1 = c + half;
  out = out.map((q, i) => {
    if (i <= pk.i0) return { ...q, u: a0 > 0 ? (q.u / a0) * b0 : q.u };
    if (i >= pk.i1) return { ...q, u: a1 < 1 ? b1 + ((q.u - a1) / (1 - a1)) * (1 - b1) : q.u };
    return { ...q, u: b0 + (q.u - a0) };
  });
  return out;
}

/** Where a slope's shoulder sits: on the curve at half the peak's height, between the eave and the peak. */
export function profileShoulder(pts: ProfilePt[], side: 'L' | 'R'): { u: number; h: number } | null {
  const pk = profilePeak(pts);
  if (pk.h < 0.05) return null;
  if (side === 'L' ? pk.i0 === 0 : pk.i1 === pts.length - 1) return null;
  const s = sampleProfile(pts);
  const target = pk.h / 2;
  const uA = side === 'L' ? 0 : pts[pk.i1].u, uB = side === 'L' ? pts[pk.i0].u : 1;
  // walk from the eave towards the peak to the first crossing of half height
  const seq = side === 'L' ? s : [...s].reverse();
  for (let i = 0; i + 1 < seq.length; i++) {
    const a = seq[i], b = seq[i + 1];
    if (a.u < uA - 1e-9 || a.u > uB + 1e-9) continue;
    if ((a.h - target) * (b.h - target) <= 0 && Math.abs(b.h - a.h) > 1e-9) {
      const t = (target - a.h) / (b.h - a.h);
      return { u: a.u + t * (b.u - a.u), h: target };
    }
  }
  return null;
}

/** A slope's interior points (between its eave end and the peak), and the slope's ends. */
function slopeOf(pts: ProfilePt[], side: 'L' | 'R') {
  const pk = profilePeak(pts);
  const lo = side === 'L' ? 0 : pk.i1, hi = side === 'L' ? pk.i0 : pts.length - 1;
  const idx: number[] = [];
  for (let i = lo + 1; i < hi; i++) idx.push(i);
  return { idx, uA: pts[lo].u, uB: pts[hi].u };
}

/**
 * Give a slope its shoulder point if it has none yet: one smooth point on the curve at half height, so a straight
 * slope can start to bow. This is the only point a shoulder pull ever adds; the curve doesn't change shape.
 */
export function ensureShoulder(pts: ProfilePt[], side: 'L' | 'R'): ProfilePt[] {
  if (slopeOf(pts, side).idx.length) return pts;
  const sh = profileShoulder(pts, side);
  return sh ? insertProfilePoint(pts, sh.u).profile : pts;
}

/**
 * Pull a slope's shoulder sideways by du (towards the eave = broader and fuller; towards the peak = pointier).
 * Only the slope's interior points move, and only sideways: the most near the middle of the slope, fading to
 * nothing at the eave and at the peak, scaled so the shoulder follows the pen. Heights, creases and steps keep.
 * A symmetric profile stays symmetric unless `mirror` is false.
 */
export function pullShoulder(pts: ProfilePt[], side: 'L' | 'R', du: number, mirror = profileSymmetric(pts)): ProfilePt[] {
  const sh = profileShoulder(pts, side);
  if (!sh || Math.abs(du) < 1e-9) return pts;
  const out = pts.map((q) => ({ ...q }));
  const apply = (sd: 'L' | 'R', d: number, at: number) => {
    const { idx, uA, uB } = slopeOf(pts, sd);
    if (!idx.length || uB - uA < 1e-6) return;
    const bump = (u: number) => Math.sin(Math.PI * clamp((u - uA) / (uB - uA), 0, 1));
    const w0 = Math.max(bump(at), 0.2);
    const gap = Math.max(0.01, SHOULDER_MARGIN * (uB - uA));
    // points already inside the margin (drawn there) keep their place rather than jump out
    let prev = uA;
    for (const i of idx) {
      const lo = Math.max(prev, Math.min(uA + gap, pts[i].u)), hi = Math.max(uB - gap, pts[i].u);
      const uu = clamp(pts[i].u + (d * bump(pts[i].u)) / w0, lo, Math.max(lo, hi));
      // a vertical step's two points share a u, so they get the same pull and stay vertical
      out[i].u = i > idx[0] && Math.abs(pts[i].u - pts[i - 1].u) < 1e-6 ? out[i - 1].u : uu;
      prev = out[i].u;
    }
  };
  apply(side, du, sh.u);
  if (mirror) {
    const other = side === 'L' ? 'R' : 'L';
    const sh2 = profileShoulder(pts, other);
    if (sh2) apply(other, -du, sh2.u);
  }
  return out;
}

// ---- Presets: a vocabulary of overheads expressed as profiles ----
export type ProfilePreset = 'flat' | 'raked' | 'gable' | 'clerestory' | 'vault' | 'fold' | 'sawtooth' | 'butterfly' | 'dome';

export function presetProfile(kind: ProfilePreset, span: number): ProfilePt[] {
  return withIds(presetPoints(kind, span));
}

function presetPoints(kind: ProfilePreset, span: number): ProfilePt[] {
  const H = clamp(span * 0.28, 0.8, 4);
  switch (kind) {
    case 'flat':
      return [{ u: 0, h: 0, crease: true }, { u: 1, h: 0, crease: true }];
    case 'raked':
      return [{ u: 0, h: 0, crease: true }, { u: 1, h: H, crease: true }];
    case 'gable':
      return [{ u: 0, h: 0, crease: true }, { u: 0.5, h: H, crease: true }, { u: 1, h: 0, crease: true }];
    case 'clerestory':
      return [
        { u: 0, h: 0, crease: true },
        { u: 0.55, h: H * 0.45, crease: true },
        { u: 0.55, h: H * 1.05, crease: true },
        { u: 1, h: H * 1.25, crease: true },
      ];
    case 'vault':
      return [
        { u: 0, h: 0, crease: true },
        { u: 0.15, h: H * 0.62, crease: false },
        { u: 0.5, h: H, crease: false },
        { u: 0.85, h: H * 0.62, crease: false },
        { u: 1, h: 0, crease: true },
      ];
    case 'dome':
      return [
        { u: 0, h: 0, crease: true },
        { u: 0.08, h: H * 0.62, crease: false },
        { u: 0.25, h: H * 0.93, crease: false },
        { u: 0.5, h: H, crease: false },
        { u: 0.75, h: H * 0.93, crease: false },
        { u: 0.92, h: H * 0.62, crease: false },
        { u: 1, h: 0, crease: true },
      ];
    case 'fold': {
      const n = Math.max(3, Math.round(span / 3)) * 2;
      return Array.from({ length: n + 1 }, (_, i) => ({ u: i / n, h: i % 2 ? H * 0.5 : 0, crease: true }));
    }
    case 'sawtooth': {
      const n = Math.max(2, Math.round(span / 4));
      const out: ProfilePt[] = [];
      for (let i = 0; i < n; i++) {
        out.push({ u: i / n, h: 0, crease: true });
        out.push({ u: (i + 1) / n, h: H * 0.55, crease: true });
      }
      out.push({ u: 1, h: 0, crease: true });
      return out;
    }
    case 'butterfly':
      return [{ u: 0, h: H * 0.6, crease: true }, { u: 0.5, h: 0, crease: true }, { u: 1, h: H * 0.6, crease: true }];
  }
}

export function describeProfile(oh: Overhead): string {
  const p = oh.profile;
  const hs = p.map((x) => x.h);
  const maxH = Math.max(...hs), minH = Math.min(...hs);
  if (maxH - minH < 0.05) return 'flat';
  const steps = p.some((x, i) => i > 0 && Math.abs(x.u - p[i - 1].u) < 1e-6 && Math.abs(x.h - p[i - 1].h) > 0.2);
  const smooth = p.some((x) => !x.crease);
  if (oh.form === 'revolve') return smooth ? 'dome' : 'cone';
  if (steps) return 'clerestory';
  if (smooth) return 'vault';
  let turns = 0;
  for (let i = 1; i + 1 < p.length; i++) {
    const a = p[i].h - p[i - 1].h, b = p[i + 1].h - p[i].h;
    if (Math.sign(a) !== Math.sign(b) && Math.abs(a) > 0.05 && Math.abs(b) > 0.05) turns++;
  }
  if (turns >= 3) return 'folded';
  if (turns === 1) return p[0].h > p[Math.floor(p.length / 2)].h ? 'butterfly' : 'gable';
  return 'raked';
}

// ---- Turning the ridge ----
// `oh.dir` is the SPAN direction; the displayed ridge is perpendicular to it. These helpers therefore return span
// directions implied by the outline's edges (edge angle + 90°), so committing `dir = nextRidgeDir(oh)` lays the ridge
// along that edge. Profile heights are preserved; a turn never rescales them.

const modPi = (a: number) => ((a % Math.PI) + Math.PI) % Math.PI;
const angleApart = (a: number, b: number) => {
  const d = modPi(a - b);
  return Math.min(d, Math.PI - d);
};

/** Distinct span directions the outline can carry, by total edge length, at most four. */
export function ridgeDirections(oh: Overhead): number[] {
  const groups: { a: number; len: number }[] = [];
  const n = oh.outline.length;
  for (let i = 0; i < n; i++) {
    const a = oh.outline[i], b = oh.outline[(i + 1) % n];
    const len = dist(a, b);
    if (len < 0.2) continue;
    const span = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
    const hit = groups.find((g) => angleApart(g.a, span) < (2 * Math.PI) / 180);
    if (hit) hit.len += len;
    else groups.push({ a: modPi(span), len });
  }
  return groups.sort((x, y) => y.len - x.len || x.a - y.a).slice(0, 4).map((g) => g.a);
}

/**
 * The next span direction, or null when turning would do nothing: a round or flat roof, or an outline with fewer than
 * two distinct edge directions. A direction already matching within 2° is skipped, so a turn always visibly turns.
 */
export function nextRidgeDir(oh: Overhead): number | null {
  if (oh.form === 'revolve') return null;
  if (Math.max(...oh.profile.map((p) => p.h)) < 0.05) return null;
  const dirs = ridgeDirections(oh);
  if (dirs.length < 2) return null;
  const cur = modPi(oh.dir);
  const i = dirs.findIndex((d) => angleApart(d, cur) < (2 * Math.PI) / 180);
  const after = dirs.filter((d) => angleApart(d, cur) >= (2 * Math.PI) / 180);
  if (!after.length) return null;
  if (i < 0) return after[0];
  for (let k = 1; k <= dirs.length; k++) {
    const cand = dirs[(i + k) % dirs.length];
    if (angleApart(cand, cur) >= (2 * Math.PI) / 180) return cand;
  }
  return null;
}
