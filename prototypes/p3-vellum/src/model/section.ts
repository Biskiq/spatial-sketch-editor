// The section model: reading one authored profile into joints and parts, naming the shape, and the edits shared by
// the sheet and the 3D joint handles. Pure: no state, no rendering.
//
// Validation semantics (decided in Phase 0; normative for every edit route):
//   · an edit takes the gesture-start profile and returns a candidate; the caller previews that candidate through
//     cleanSection() on every move, never from the last preview;
//   · a candidate that fails is not committed: the caller keeps the last valid preview and names the limit;
//   · release commits exactly the last previewed profile — no post-release cleanup, no extra simplification;
//   · cleanSection is idempotent, so preview and commit run the same function on the same input;
//   · untouched parts are never rewritten to make room for an edit: clamp or reject the edit, not its neighbours.
import { clamp, dist } from './geom2d';
import type { Overhead, ProfilePt } from './types';
import { sampleProfile, profileH, profilePeak, type PSample } from './profileCurve';
import { newProfileId, MAX_RISE, profileSymmetric, presetProfile, type ProfilePreset } from './overheadGeom';
import { fitProfile } from './strokes';

export const EPS_U = 1e-6;
export const MIN_STEP = 0.3;
export const MAX_SLOPE_DEG = 75;
export const STRAIGHT_TOL = 0.01;
export const MIN_JOINT_H = 0.05;
const RIDGE_DELTA = 0.02;
const MAX_SLOPE = Math.tan((MAX_SLOPE_DEG * Math.PI) / 180);

export type JointKind = 'eave' | 'ridge' | 'valley' | 'crease' | 'step';

export interface Joint {
  id: string; // the profile point's id (a step: its first point's id)
  kind: JointKind;
  i: number;
  j: number; // = i, or i + 1 for a step / an end that forms a vertical pair
  u: number;
  h: number; // pts[i].h
  h2: number; // pts[j].h (= h unless a step)
}

export type PartKind = 'flat' | 'straight' | 'bowed' | 'curve';

export interface Part {
  id: string; // `${joints[a].id}>${joints[b].id}`
  kind: PartKind;
  a: number;
  b: number;
  interior: number[]; // profile indices strictly between joints[a].j and joints[b].i
  dir: -1 | 0 | 1;
}

export interface Section {
  pts: ProfilePt[];
  joints: Joint[];
  parts: Part[];
}

const sameU = (a: number, b: number) => Math.abs(a - b) < EPS_U;

/**
 * Reading never invents a random id: a profile from the document always carries its own, and a bare array gets
 * stable positional ones, so two reads of the same points agree (a gesture can address a joint by id either way).
 */
function ensureIds(pts: ProfilePt[]): ProfilePt[] {
  if (pts.every((q) => q.id)) return pts;
  const taken = new Set(pts.map((q) => q.id).filter(Boolean) as string[]);
  return pts.map((q, i) => {
    if (q.id) return q;
    let id = `p${i}`;
    while (taken.has(id)) id += '_';
    taken.add(id);
    return { ...q, id };
  });
}

/** Read a profile as joints and the parts between them. Smooth points are never joints. */
export function readSection(pts0: ProfilePt[]): Section {
  const pts = ensureIds(pts0);
  const n = pts.length;
  const joints: Joint[] = [];
  const used = new Set<number>();
  if (n >= 2) {
    const paired = sameU(pts[0].u, pts[1].u);
    joints.push({ id: pts[0].id!, kind: 'eave', i: 0, j: paired ? 1 : 0, u: pts[0].u, h: pts[0].h, h2: paired ? pts[1].h : pts[0].h });
    used.add(paired ? 1 : 0);
    const endPaired = sameU(pts[n - 2].u, pts[n - 1].u);
    const endI = endPaired ? n - 2 : n - 1;
    joints.push({ id: pts[n - 1].id!, kind: 'eave', i: endI, j: endI, u: pts[n - 1].u, h: pts[endI].h, h2: pts[n - 1].h });
    used.add(endPaired ? n - 2 : n - 1);
  }
  for (let i = 1; i + 1 < n; i++) {
    if (used.has(i)) continue;
    if (sameU(pts[i].u, pts[i + 1].u)) {
      // a vertical pair inside the span: a step, or a near-duplicate that reads as a crease until R2 merges it
      if (Math.abs(pts[i + 1].h - pts[i].h) >= MIN_JOINT_H)
        joints.push({ id: pts[i].id!, kind: 'step', i, j: i + 1, u: pts[i].u, h: pts[i].h, h2: pts[i + 1].h });
      else if (pts[i].crease) joints.push({ id: pts[i].id!, kind: 'crease', i, j: i, u: pts[i].u, h: pts[i].h, h2: pts[i].h });
      used.add(i + 1);
      continue;
    }
    if (sameU(pts[i].u, pts[i - 1].u)) continue;
    if (!pts[i].crease) continue;
    const prev = pts[i - 1].h, next = pts[i + 1].h, h = pts[i].h;
    const kind: JointKind =
      h - prev >= RIDGE_DELTA && h - next >= RIDGE_DELTA ? 'ridge'
        : prev - h >= RIDGE_DELTA && next - h >= RIDGE_DELTA ? 'valley'
          : 'crease';
    joints.push({ id: pts[i].id!, kind, i, j: i, u: pts[i].u, h, h2: h });
  }
  joints.sort((a, b) => a.i - b.i);
  const samples = sampleProfile(pts);
  const parts: Part[] = [];
  for (let k = 0; k + 1 < joints.length; k++) {
    const A = joints[k], B = joints[k + 1];
    const interior: number[] = [];
    for (let i = A.j + 1; i < B.i; i++) interior.push(i);
    const slice = samples.filter((s) => s.u >= A.u - 1e-9 && s.u <= B.u + 1e-9);
    let kind: PartKind;
    if (!interior.length) kind = Math.abs(B.h - A.h2) < MIN_JOINT_H ? 'flat' : 'straight';
    else if (!monotone(slice)) kind = 'curve';
    else kind = interior.every((i) => Math.abs(pts[i].h - chordAt(A, B, pts[i].u)) <= STRAIGHT_TOL) ? 'straight' : 'bowed';
    const dh = B.h - A.h2;
    parts.push({
      id: `${A.id}>${B.id}`, kind, a: k, b: k + 1, interior,
      dir: kind === 'curve' ? 0 : Math.abs(dh) < MIN_JOINT_H ? 0 : dh > 0 ? 1 : -1,
    });
  }
  return { pts, joints, parts };
}

const chordAt = (A: Joint, B: Joint, u: number) =>
  Math.abs(B.u - A.u) < 1e-9 ? A.h2 : A.h2 + ((B.h - A.h2) * (u - A.u)) / (B.u - A.u);

function monotone(s: PSample[]): boolean {
  let sign = 0;
  for (let i = 1; i < s.length; i++) {
    const d = s[i].h - s[i - 1].h;
    if (Math.abs(d) < 1e-9) continue;
    const k = d > 0 ? 1 : -1;
    if (sign === 0) sign = k;
    else if (k !== sign) return false;
  }
  return true;
}

// ------------------------------------------------------------------ families: names describe the shape
export type Family = 'flat' | 'shed' | 'gable' | 'saltbox' | 'gambrel' | 'vault' | 'pointed-vault'
  | 'clerestory' | 'sawtooth' | 'butterfly' | 'folded' | 'dome' | 'cone' | 'free';

export const FAMILY_NAMES: Record<Family, string> = {
  flat: 'Flat roof',
  shed: 'Shed roof',
  gable: 'Gable',
  saltbox: 'Saltbox',
  gambrel: 'Gambrel',
  vault: 'Vault',
  'pointed-vault': 'Pointed vault',
  clerestory: 'Clerestory',
  sawtooth: 'Sawtooth',
  butterfly: 'Butterfly',
  folded: 'Folded plate',
  dome: 'Dome',
  cone: 'Cone',
  free: 'As drawn',
};

export function sectionFamily(sec: Section, form: Overhead['form']): Family {
  const parts = sec.parts;
  const steps = sec.joints.filter((j) => j.kind === 'step');
  const samples = sampleProfile(sec.pts);
  const endPair = sec.joints.some((j) => j.kind === 'eave' && j.j !== j.i);
  if (!steps.length && !endPair && samples.every((s) => Math.abs(s.h - samples[0].h) < 0.05)) return 'flat';
  if (form === 'revolve') return parts.some((p) => p.kind === 'bowed' || p.kind === 'curve') ? 'dome' : 'cone';
  // a falling step is a tooth (the roof drops and starts again); a rising one is a clerestory
  if (steps.some((j) => j.h - j.h2 >= MIN_JOINT_H)) return 'sawtooth';
  if (steps.length) return 'clerestory';
  if (parts.length === 1) return parts[0].kind === 'curve' ? 'vault' : 'shed';
  if (parts.length === 2) {
    const [a, b] = parts;
    const shared = sec.joints[a.b];
    if (shared?.kind === 'ridge') {
      if (a.kind === 'bowed' && b.kind === 'bowed' && bowedAboveChord(sec, a) && bowedAboveChord(sec, b)) return 'pointed-vault';
      const eaveL = sec.joints[0], eaveR = sec.joints[sec.joints.length - 1];
      if (Math.abs(shared.u - 0.5) <= 0.03 && Math.abs(eaveL.h - eaveR.h) <= 0.05) return 'gable';
      return 'saltbox';
    }
  }
  // a gambrel: four slopes over crease, ridge, crease, steep at the eaves and shallow above
  if (parts.length === 4 && parts.map((p) => p.dir).join(',') === '1,1,-1,-1' && sec.joints[parts[1].b]?.kind === 'ridge') {
    const kinds = [sec.joints[parts[0].b].kind, sec.joints[parts[1].b].kind, sec.joints[parts[2].b].kind].join(',');
    if (kinds === 'crease,ridge,crease' && steepness(sec, parts[0]) > steepness(sec, parts[1]) + 1e-6 && steepness(sec, parts[3]) > steepness(sec, parts[2]) + 1e-6)
      return 'gambrel';
  }
  if (parts.length === 2 && sec.joints[parts[0].b]?.kind === 'valley') return 'butterfly';
  const folds = sec.joints.filter((j) => j.kind === 'ridge' || j.kind === 'valley').length;
  if (folds >= 3) return 'folded';
  return 'free';
}

function steepness(sec: Section, p: Part) {
  const A = sec.joints[p.a], B = sec.joints[p.b];
  return Math.abs(B.h - A.h2) / Math.max(Math.abs(B.u - A.u), 1e-6);
}

function bowedAboveChord(sec: Section, p: Part) {
  const A = sec.joints[p.a], B = sec.joints[p.b];
  return p.interior.some((i) => sec.pts[i].h > chordAt(A, B, sec.pts[i].u) + 0.01);
}

// ------------------------------------------------------------------ clean rules
export interface CleanOpts {
  span: number;
  form: Overhead['form'];
  protect?: string[];
  before?: ProfilePt[];
  edited?: string[];
  allowMerge?: string[];
  maxRise?: number;
}

export interface CleanResult {
  profile: ProfilePt[];
  notes: string[];
  valid: boolean;
}

export const maxRiseM = (span: number, given?: number) => given ?? Math.max(1, MAX_RISE * Math.max(span, 1e-6));

/**
 * The gesture validator. Called on every move from the gesture-start snapshot (or with `before` for the start),
 * with `edited` naming the points/ids this gesture may change. Idempotent: clean(clean(x)) === clean(x).
 */
export function cleanSection(pts: ProfilePt[], o: CleanOpts): CleanResult {
  const notes: string[] = [];
  const maxR = maxRiseM(o.span, o.maxRise);
  if (!Number.isFinite(o.span) || o.span <= 0) return { profile: pts, notes: ['the span is not a length'], valid: false };
  if (pts.length < 2) return { profile: pts, notes: ['the section needs two ends'], valid: false };
  if (pts.some((p) => !Number.isFinite(p.u) || !Number.isFinite(p.h))) return { profile: pts, notes: ['the section has a point without a position'], valid: false };
  const before = readSection(o.before ?? pts);
  const edited = new Set(o.edited ?? pts.map((p) => p.id ?? p.u.toFixed(9)));
  let out = ensureIds(pts.map((p) => ({ ...p })));

  // R1 heights: clamp what this gesture changed; an untouched point out of range is a caller bug, not a new shape
  for (const p of out) {
    if (p.h < -1e-9 || p.h > maxR + 1e-9) {
      if (!edited.has(p.id!)) return { profile: pts, notes: ['a point outside the edit left its range'], valid: false };
      p.h = clamp(p.h, 0, maxR);
    }
  }
  // R2 order: never sort crossing joints into another topology; collapse exact duplicates only in the edit
  for (let i = 1; i < out.length; i++) {
    if (out[i].u < out[i - 1].u - 1e-9) return { profile: pts, notes: ['the section would fold over itself'], valid: false };
    if (sameU(out[i].u, out[i - 1].u) && Math.abs(out[i].h - out[i - 1].h) < 1e-9) {
      if (!(edited.has(out[i].id!) || edited.has(out[i - 1].id!))) continue;
      out.splice(i, 1);
      notes.push('points meet here');
      i--;
    }
  }
  // R3 short steps: a step this gesture shortened closes to one crease at the higher height, keeping the first id
  for (let i = 0; i + 1 < out.length; i++) {
    if (!sameU(out[i + 1].u, out[i].u)) continue;
    const gap = Math.abs(out[i + 1].h - out[i].h);
    if (gap >= MIN_STEP || gap < 1e-9) continue;
    if (!(edited.has(out[i].id!) || edited.has(out[i + 1].id!))) continue;
    const hi = out[i + 1].h > out[i].h ? out[i + 1] : out[i];
    out[i] = { ...hi, id: out[i].id, crease: true };
    out.splice(i + 1, 1);
    notes.push('close step (under 30 cm)');
    i--;
  }
  // R4 slivers: a joint this gesture *created* may not leave a piece narrower than minPartU
  const minP = minPartU(o.span);
  const fresh = readSection(out);
  for (let k = 0; k < fresh.joints.length; k++) {
    const J = fresh.joints[k];
    if (J.kind === 'eave' || J.kind === 'step') continue;
    const known = before.joints.some((b) => b.id === J.id);
    if (known || !edited.has(J.id)) continue;
    if (o.allowMerge?.includes(J.id)) continue;
    const prev = fresh.joints[k - 1], next = fresh.joints[k + 1];
    if ((prev && J.u - prev.u < minP - 1e-9 && J.u > prev.u + 1e-9) || (next && next.u - J.u < minP - 1e-9 && next.u > J.u + 1e-9))
      return { profile: pts, notes: ['piece needs more room'], valid: false };
  }
  // R5 steepness: a changed straight non-step part cannot stand steeper than 75°
  for (const p of fresh.parts) {
    if (p.kind !== 'straight') continue;
    const A = fresh.joints[p.a], B = fresh.joints[p.b];
    const touched = edited.has(A.id) || edited.has(B.id) || p.interior.some((i) => edited.has(fresh.pts[i].id!));
    if (!touched) continue;
    const du = Math.abs(B.u - A.u) * o.span;
    if (du > 1e-6 && Math.abs(B.h - A.h2) / du > MAX_SLOPE + 1e-9) return { profile: pts, notes: ['straight slope limit · 75°'], valid: false };
  }
  // R6 tidy: a bow this gesture made may drop an interior point whose removal moves the curve under 1 cm — never a
  // joint, never a part the gesture did not touch. Dropping a point is only ever a simplification of a shape the hand
  // already drew near-flat, so the committed profile is still the previewed one.
  for (;;) {
    const sec = readSection(out);
    let dropped = false;
    for (const p of sec.parts) {
      if (!p.interior.length) continue;
      if ((o.protect ?? []).some((id) => id === sec.joints[p.a].id || id === sec.joints[p.b].id)) continue;
      if (!p.interior.every((i) => edited.has(sec.pts[i].id!))) continue;
      for (const drop of p.interior) {
        const tryPts = sec.pts.filter((_, i) => i !== drop);
        if (readSection(tryPts).joints.length !== sec.joints.length) continue;
        const beforeCurve = sampleProfile(sec.pts), afterCurve = sampleProfile(tryPts);
        let worst = 0;
        for (const s of beforeCurve) worst = Math.max(worst, Math.abs(profileH(afterCurve, s.u) - s.h));
        if (worst > STRAIGHT_TOL) continue;
        out = tryPts;
        dropped = true;
        break;
      }
      if (dropped) break;
    }
    if (!dropped) break;
    if (!notes.includes('straight')) notes.push('straight');
  }
  // R7 ids and a final read of the sampled curve
  out = ensureIds(out);
  const curve = sampleProfile(out);
  if (!curve.every((s) => Number.isFinite(s.u) && Number.isFinite(s.h) && s.h >= -1e-9 && s.h <= maxR + 1e-9))
    return { profile: pts, notes: [...notes, 'the curve leaves its range'], valid: false };
  for (let i = 1; i < curve.length; i++) if (curve[i].u < curve[i - 1].u - 1e-9) return { profile: pts, notes: [...notes, 'the curve folds back'], valid: false };
  return { profile: out, notes, valid: true };
}

/**
 * One validator for every gesture: clean a candidate from the gesture-start profile. `edited` names the ids the
 * gesture is allowed to change, and the caller previews and commits the returned profile itself, so a preview and
 * its commit are the same function on the same input (including ids).
 */
export function validateGesture(start: ProfilePt[], candidate: ProfilePt[], edited: string[], o: EditOpts): CleanResult {
  return cleanSection(candidate, { span: o.span, form: o.form, before: start, edited, maxRise: o.maxRise });
}

export function sameProfile(a: ProfilePt[], b: ProfilePt[], tol = 1e-9): boolean {
  return a.length === b.length && a.every((p, i) => p.id === b[i].id && Math.abs(p.u - b[i].u) < tol && Math.abs(p.h - b[i].h) < tol);
}

// ------------------------------------------------------------------ editing joints and parts
export interface EditOpts {
  span: number;
  form: Overhead['form'];
  free?: boolean;
  solo?: boolean;
  tolU?: number;
  tolH?: number;
  maxRise?: number;
}

export const minPartU = (span: number) => Math.min(0.2, 0.4 / Math.max(span, 1e-6));

export interface JointEdit {
  profile: ProfilePt[];
  label?: string;
  merged?: boolean;
}

const maxR = (o: EditOpts) => maxRiseM(o.span, o.maxRise);

const pitchHeight = (span: number, run: number, deg: number) => Math.abs(run) * span * Math.tan((deg * Math.PI) / 180);

function detent(v: number, stops: { at: number; label: string }[], radius: number): { v: number; label?: string } {
  let best: { at: number; label: string } | null = null;
  for (const s of stops) {
    if (!Number.isFinite(s.at)) continue;
    if (Math.abs(v - s.at) <= radius && (!best || Math.abs(v - s.at) < Math.abs(v - best.at))) best = s;
  }
  return best ? { v: best.at, label: best.label } : { v };
}

/** Move one joint. The caller passes the gesture-start profile every time. */
export function moveJoint(pts0: ProfilePt[], jointId: string, u: number, h: number, o: EditOpts): JointEdit {
  const sec = readSection(pts0);
  const pts = sec.pts;
  const idx = sec.joints.findIndex((j) => j.id === jointId);
  if (idx < 0) return { profile: pts };
  const J = sec.joints[idx];
  const minP = minPartU(o.span);
  if (J.kind === 'eave') {
    const hh = clamp(h, 0, maxR(o));
    return { profile: ensureIds(pts.map((q, i) => (i === J.i || i === J.j ? { ...q, h: hh } : q))), label: hh <= 1e-6 ? 'at the eave' : undefined };
  }
  if (J.kind === 'step') {
    const prev = sec.joints[idx - 1], next = sec.joints[idx + 1];
    const lo = prev ? prev.u + Math.min(minP, Math.max(0, J.u - prev.u)) : 0;
    const hi = next ? next.u - Math.min(minP, Math.max(0, next.u - J.u)) : 1;
    const uu = clamp(u, Math.min(lo, hi), Math.max(lo, hi));
    return { profile: ensureIds(pts.map((q, i) => (i === J.i || i === J.j ? { ...q, u: uu } : q))) };
  }
  const prev = sec.joints[idx - 1], next = sec.joints[idx + 1];
  if (!prev || !next) return { profile: pts };
  const lo = prev.u + Math.min(minP, Math.max(0, J.u - prev.u));
  const hi = next.u - Math.min(minP, Math.max(0, next.u - J.u));
  if (u < lo - minP / 2 || u > hi + minP / 2) {
    const merged = removeJoint(pts, jointId, o);
    if (merged) return { profile: merged, label: 'Merge with its neighbour', merged: true };
  }
  let uu = clamp(u, Math.min(lo, hi), Math.max(lo, hi));
  let hh = clamp(h, 0, maxR(o));
  let label: string | undefined;
  if (!o.free) {
    // structural stops outrank pitch suggestions: centring or levelling is what the hand meant when both are near
    const stopsU: { at: number; label: string }[] = [];
    const structural: { at: number; label: string }[] = [];
    const pitches: { at: number; label: string }[] = [];
    if (J.kind === 'ridge' && sec.joints.filter((j) => j.kind === 'ridge').length === 1) stopsU.push({ at: 0.5, label: 'centred' });
    for (const j of sec.joints) if (j !== J && j.kind !== 'step' && j.kind !== 'eave') structural.push({ at: j.h, label: 'level with the other side' });
    // a solo gesture on a symmetric section can still land exactly on the partner's mirror
    const mirror = o.solo && profileSymmetric(pts) ? mirrorOf(sec, J) : null;
    if (mirror) {
      stopsU.push({ at: 1 - mirror.u, label: 'mirrored' });
      structural.push({ at: mirror.h, label: 'mirrored' });
    }
    const runToEave = Math.max(prev.kind === 'eave' ? J.u - prev.u : 0, next.kind === 'eave' ? next.u - J.u : 0);
    if (runToEave > 0.02)
      for (const deg of [30, 45, 60]) pitches.push({ at: pitchHeight(o.span, runToEave, deg), label: `${deg}° pitch` });
    const du = detent(uu, stopsU, o.tolU ?? 0.02);
    uu = du.v;
    const ds = detent(hh, structural, o.tolH ?? 0.04);
    const dp = ds.label ? { v: ds.v, label: ds.label } : detent(hh, pitches, o.tolH ?? 0.04);
    hh = clamp(dp.v, 0, maxR(o));
    label = du.label ?? dp.label;
  }
  for (const nb of [prev, next]) {
    if (nb.kind === 'eave') continue;
    const du = Math.abs(uu - nb.u) * o.span;
    const cap = MAX_SLOPE * du;
    if (Math.abs(hh - nb.h) > cap) hh = Math.max(0, nb.h + Math.sign(hh - nb.h) * cap);
  }
  return remapAround(pts, sec, idx, uu, Math.max(0, hh), label, o);
}

/** The joint a symmetric section mirrors this one onto, if it is not on the centre line. */
function mirrorOf(sec: Section, J: Joint): Joint | null {
  if (Math.abs(J.u - 0.5) < 2e-3) return null;
  return sec.joints.find((j) => j !== J && j.kind !== 'eave' && Math.abs(j.u - (1 - J.u)) < 2e-3 && Math.abs(j.h - J.h) < 2e-3) ?? null;
}

function remapAround(pts: ProfilePt[], sec: Section, idx: number, uu: number, hh: number, label: string | undefined, o: EditOpts): JointEdit {
  const J = sec.joints[idx];
  const out = pts.map((q) => ({ ...q }));
  out[J.i] = { ...out[J.i], u: uu, h: hh };
  if (J.kind === 'step') out[J.j] = { ...out[J.j], u: uu };
  const moved = { ...J, u: uu, h: hh };
  // interior points of the touching parts keep their place across the part and their offset from its chord
  for (const p of sec.parts) {
    const A = sec.joints[p.a], B = sec.joints[p.b];
    if (A !== J && B !== J) continue;
    const nA = A === J ? moved : A, nB = B === J ? moved : B;
    for (const i of p.interior) {
      const t = (pts[i].u - A.u) / Math.max(B.u - A.u, 1e-9);
      const off = pts[i].h - chordAt(A, B, pts[i].u);
      const nu = nA.u + t * (nB.u - nA.u);
      out[i] = { ...out[i], u: nu, h: clamp(chordAt(nA, nB, nu) + off, 0, maxR(o)) };
    }
  }
  for (let i = 1; i < out.length; i++) out[i].u = Math.max(out[i].u, out[i - 1].u);
  // a symmetric section moves its mirror partner too, unless the gesture asked to break symmetry
  if (!o.solo && o.form !== 'revolve' && profileSymmetric(pts)) {
    const partner = mirrorOf(sec, J);
    if (partner) {
      const k = out.findIndex((q) => q.id === partner.id);
      if (k >= 0) out[k] = { ...out[k], u: clamp(1 - uu, 0, 1), h: hh };
      for (const p of sec.parts) {
        const A = sec.joints[p.a], B = sec.joints[p.b];
        if (A !== partner && B !== partner) continue;
        const pA = A === partner ? { ...A, u: 1 - uu, h: hh } : A;
        const pB = B === partner ? { ...B, u: 1 - uu, h: hh } : B;
        for (const i of p.interior) {
          const t = (pts[i].u - A.u) / Math.max(B.u - A.u, 1e-9);
          const off = pts[i].h - chordAt(A, B, pts[i].u);
          const nu = pA.u + t * (pB.u - pA.u);
          out[i] = { ...out[i], u: nu, h: clamp(chordAt(pA, pB, nu) + off, 0, maxR(o)) };
        }
      }
      for (let i = 1; i < out.length; i++) out[i].u = Math.max(out[i].u, out[i - 1].u);
    }
  }
  return { profile: ensureIds(out), label };
}

/** Raise or lower one edge of a step. */
export function moveStepEdge(pts0: ProfilePt[], jointId: string, edge: 'lo' | 'hi', h: number, o: EditOpts): JointEdit {
  const sec = readSection(pts0);
  const J = sec.joints.find((j) => j.id === jointId && j.kind === 'step');
  if (!J) return { profile: sec.pts };
  const out = sec.pts.map((q) => ({ ...q }));
  out[edge === 'lo' ? J.i : J.j].h = clamp(h, 0, maxR(o));
  const gap = Math.abs(out[J.i].h - out[J.j].h);
  if (gap < MIN_STEP) {
    const hi = out[J.i].h > out[J.j].h ? out[J.i] : out[J.j];
    // the first point keeps its id, exactly as cleanSection's R3 does: preview and commit must agree on identity
    out[J.i] = { ...hi, u: J.u, crease: true, id: out[J.i].id };
    out.splice(J.j, 1);
    return { profile: ensureIds(out), label: 'Close this step' };
  }
  return { profile: ensureIds(out) };
}

/**
 * Drag a part along its outward normal by `s` metres. The envelope is normalised at the grabbed point on the
 * sampled curve, so the part under the hand follows it exactly before any hard limit.
 */
export function pullPart(pts0: ProfilePt[], partId: string, s: number, o: EditOpts & { uGrab: number }): ProfilePt[] {
  let sec = readSection(pts0);
  let p = sec.parts.find((q) => q.id === partId);
  if (!p) return sec.pts;
  let pts = sec.pts;
  if (!p.interior.length) {
    const A = sec.joints[p.a], B = sec.joints[p.b];
    const ins = insertPoint(pts, (A.u + B.u) / 2);
    pts = ins.profile;
    sec = readSection(pts);
    p = sec.parts.find((q) => q.id === partId);
    if (!p) return pts;
  }
  const A = sec.joints[p.a], B = sec.joints[p.b];
  const W = (B.u - A.u) * o.span;
  if (W < 2e-3) return pts;
  const dx = W, dy = B.h - A.h2;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L; // above the chord for a rising part
  const grabT = clamp(((o.uGrab - A.u) * o.span) / dx, 0.05, 0.95);
  const env = (t: number) => Math.sin(Math.PI * clamp(t, 0, 1));
  const w0 = Math.max(env(grabT), 0.08);
  const out = pts.map((q) => ({ ...q }));
  for (const i of p.interior) {
    const t = ((pts[i].u - A.u) * o.span) / dx;
    const sHere = (s * env(t)) / w0;
    let x = (pts[i].u - A.u) * o.span + sHere * nx;
    let y = pts[i].h + sHere * ny;
    x = clamp(x, 0.02 * o.span, W - 0.02 * o.span);
    y = clamp(y, 0, maxR(o));
    out[i] = { ...out[i], u: A.u + x / o.span, h: y };
  }
  for (let i = 1; i < out.length; i++) out[i].u = Math.max(out[i].u, out[i - 1].u);
  if (!o.solo && o.form !== 'revolve' && profileSymmetric(pts)) {
    const other = sec.parts.find((q) => q !== p && Math.abs(sec.joints[q.a].u - (1 - B.u)) < 2e-3 && Math.abs(sec.joints[q.b].u - (1 - A.u)) < 2e-3);
    if (other) {
      const oA = sec.joints[other.a], oB = sec.joints[other.b];
      const odx = (oB.u - oA.u) * o.span, ody = oB.h - oA.h2;
      const oL = Math.hypot(odx, ody) || 1;
      const onx = -ody / oL, ony = odx / oL;
      const ograbT = 1 - grabT;
      const ow0 = Math.max(env(ograbT), 0.08);
      for (const i of other.interior) {
        const t = ((pts[i].u - oA.u) * o.span) / odx;
        const sHere = (s * env(t)) / ow0;
        const x = clamp((pts[i].u - oA.u) * o.span + sHere * onx, 0.02 * o.span, oL - 0.02 * o.span);
        const y = clamp(pts[i].h + sHere * ony, 0, maxR(o));
        out[i] = { ...out[i], u: oA.u + x / o.span, h: y };
      }
      for (let i = 1; i < out.length; i++) out[i].u = Math.max(out[i].u, out[i - 1].u);
    }
  }
  return ensureIds(out);
}

function insertPoint(pts: ProfilePt[], u: number): { profile: ProfilePt[]; id: string } {
  const id = newProfileId();
  const h = profileH(sampleProfile(pts), u);
  let k = 0;
  while (k < pts.length && pts[k].u < u) k++;
  const out = pts.slice();
  out.splice(k, 0, { u, h, crease: false, id });
  return { profile: out, id };
}

/** Crease or step a part at u. */
export function splitPart(pts0: ProfilePt[], partId: string, u: number, kind: 'crease' | 'step', o: EditOpts): { profile: ProfilePt[]; jointId: string } | null {
  const sec = readSection(pts0);
  const p = sec.parts.find((q) => q.id === partId);
  if (!p) return null;
  const A = sec.joints[p.a], B = sec.joints[p.b];
  const minP = minPartU(o.span);
  if (u - A.u < minP || B.u - u < minP) return null;
  const ins = insertPoint(sec.pts, u);
  let out = ins.profile;
  if (kind === 'crease') {
    out = out.map((q) => (q.id === ins.id ? { ...q, crease: true } : q));
    return { profile: ensureIds(out), jointId: ins.id };
  }
  const hc = profileH(sampleProfile(out), u);
  const hiId = newProfileId();
  const k = out.findIndex((q) => q.id === ins.id);
  out[k] = { ...out[k], u, h: hc, crease: true };
  out.splice(k + 1, 0, { u, h: hc + 0.6, crease: true, id: hiId });
  // raise the far side back to its joint, so the ridge and the far eave stay where they were
  const farU = B.u;
  for (let i = k + 2; i < out.length && out[i].u < farU - 1e-9; i++) {
    const f = 1 - (out[i].u - u) / Math.max(farU - u, 1e-9);
    out[i] = { ...out[i], h: out[i].h + 0.6 * f };
  }
  return { profile: ensureIds(out), jointId: ins.id };
}

/** Remove a joint. Eaves, and the only joint above the eave, are refused (the Flat preset flattens a roof). */
export function removeJoint(pts0: ProfilePt[], jointId: string, o: EditOpts): ProfilePt[] | null {
  const sec = readSection(pts0);
  const J = sec.joints.find((j) => j.id === jointId);
  if (!J || J.kind === 'eave') return null;
  const above = sec.joints.filter((j) => j.kind !== 'eave' && Math.max(j.h, j.h2) > MIN_JOINT_H);
  if (above.length === 1) return null;
  const drop = J.kind === 'step' ? [J.i, J.j] : [J.i];
  const out = sec.pts.filter((_, i) => !drop.includes(i));
  if (out.length < 2) return null;
  const cleaned = cleanSection(out, { span: o.span, form: o.form, edited: out.map((q) => q.id!), allowMerge: [jointId] });
  return cleaned.valid ? cleaned.profile : null;
}

export function setJointSharp(pts0: ProfilePt[], jointId: string, sharp: boolean): ProfilePt[] {
  return ensureIds(pts0.map((q) => (q.id === jointId ? { ...q, crease: sharp } : q)));
}

// ------------------------------------------------------------------ freehand readings
export interface SectionReading {
  id: string;
  label: string;
  detail: string;
  profile: ProfilePt[];
}

/**
 * Read a drawn section: a tidy reading first when it preserves the drawing's joints within a declared tolerance,
 * then the stroke as drawn. Degenerate scribbles return nothing (the old roof stays).
 */
/**
 * Nearest-preset tolerance: the largest physical height error a preset may have and still be offered. Declared and
 * tested, not tuned to a stroke: 12 cm or 3.5% of the span, whichever is larger. A preset is a *reading*, so an offer
 * that is off by more than a hand's width across the roof is not honest.
 */
export const PRESET_TOL = (span: number) => Math.max(0.12, 0.035 * Math.max(span, 1e-6));

const PRESET_KEYS: Record<Overhead['form'], ProfilePreset[]> = {
  extrude: ['flat', 'raked', 'gable', 'clerestory', 'vault', 'butterfly', 'sawtooth', 'fold'],
  revolve: ['dome', 'raked'],
};

/** Error of a preset against a profile, sampled in metres over 50 stations. Shape only: ids and creases ignored. */
export function presetError(profile: ProfilePt[], preset: ProfilePt[]): number {
  const a = sampleProfile(profile), b = sampleProfile(preset);
  let worst = 0;
  for (let i = 0; i < 50; i++) {
    const u = i / 49;
    worst = Math.max(worst, Math.abs(profileH(a, u) - profileH(b, u)));
  }
  return worst;
}

/** The closest form-compatible preset within `PRESET_TOL`, if any; steps must not be silently flattened away. */
export function nearestPreset(profile: ProfilePt[], o: { span: number; form: Overhead['form'] }): { preset: ProfilePreset; profile: ProfilePt[]; error: number } | null {
  const sec = readSection(profile);
  const hasStep = sec.joints.some((j) => j.kind === 'step');
  let best: { preset: ProfilePreset; profile: ProfilePt[]; error: number } | null = null;
  for (const k of PRESET_KEYS[o.form] ?? PRESET_KEYS.extrude) {
    const cand = presetProfile(k, o.span);
    if (readSection(cand).joints.some((j) => j.kind === 'step') !== hasStep) continue;
    const error = presetError(profile, cand);
    if (error > PRESET_TOL(o.span)) continue;
    if (!best || error < best.error) best = { preset: k, profile: cand, error };
  }
  return best;
}

export function readSectionStroke(raw: { u: number; h: number }[], o: { span: number; form: Overhead['form'] }): SectionReading[] {
  // a tap or a scribble with no width across the span is not a section: the roof keeps the one it has
  const us = raw.map((p) => p.u);
  if (!raw.length || Math.max(...us) - Math.min(...us) < 0.05) return [];
  const fitted = fitProfile(raw.map((p) => [p.u, p.h] as [number, number]), o.span);
  const base = cleanSection(fitted, { span: o.span, form: o.form });
  if (!base.valid) return [];
  const drawn = readSection(base.profile);
  const tidy = tidyProfile(base.profile, drawn, o);
  const drawnReading: SectionReading = { id: 'drawn', label: 'As drawn', detail: 'the stroke as it was', profile: base.profile };
  const named: SectionReading[] = [];
  const same = (a: ProfilePt[], b: ProfilePt[]) => {
    if (a.length !== b.length) return false;
    const sa = sampleProfile(a), sb = sampleProfile(b);
    return sa.every((q, i) => Math.abs(q.h - sb[i].h) < 1e-4 && Math.abs(q.u - sb[i].u) < 1e-4);
  };
  const add = (r: SectionReading) => {
    if (same(drawnReading.profile, r.profile)) return;
    if (named.some((k) => same(k.profile, r.profile))) return;
    named.push(r);
  };
  if (tidy) {
    const t = readSection(tidy);
    const kinds = (s: Section) => s.joints.map((j) => j.kind).join(',');
    if (kinds(t) === kinds(drawn)) {
      const fam = sectionFamily(t, o.form);
      add({ id: 'tidy', label: FAMILY_NAMES[fam], detail: `tidy · ${FAMILY_NAMES[fam].toLowerCase()}`, profile: tidy });
    }
  }
  // a preset is offered only inside the declared tolerance, and never when it repeats the tidy reading
  const near = nearestPreset(base.profile, o);
  if (near) {
    const fam = sectionFamily(readSection(near.profile), o.form);
    add({ id: 'preset', label: FAMILY_NAMES[fam], detail: `preset · ${FAMILY_NAMES[fam].toLowerCase()}`, profile: near.profile });
  }
  return [...named, drawnReading];
}

function tidyProfile(profile: ProfilePt[], sec: Section, o: { span: number; form: Overhead['form'] }): ProfilePt[] | null {
  let pts = profile.map((q) => ({ ...q }));
  const family = sectionFamily(sec, o.form);
  const ridge = sec.joints.find((j) => j.kind === 'ridge');
  // only a gable or saltbox has a centre line worth snapping a ridge to
  if (ridge && (family === 'gable' || family === 'saltbox')) {
    const i = pts.findIndex((q) => q.id === ridge.id);
    if (i < 0) return null;
    if (Math.abs(ridge.u - 0.5) <= 0.06) pts[i] = { ...pts[i], u: 0.5 };
  }
  for (const q of [pts[0], pts[pts.length - 1]]) {
    q.u = q === pts[0] ? 0 : 1;
    if (q.h < 0.15) q.h = 0;
  }
  for (const p of sec.parts) {
    if (p.kind !== 'straight') continue;
    const A = sec.joints[p.a], B = sec.joints[p.b];
    const du = Math.abs(B.u - A.u) * o.span;
    const deg = Math.round((Math.atan2(Math.abs(B.h - A.h2), Math.max(du, 1e-9)) * 180) / Math.PI / 5) * 5;
    if (deg <= 0 || deg >= 90) continue;
    const target = du * Math.tan((deg * Math.PI) / 180);
    const k = pts.findIndex((q) => q.id === B.id);
    if (k >= 0) pts[k] = { ...pts[k], h: Math.max(0, A.h2 + Math.sign(B.h - A.h2) * target) };
  }
  // a hand-drawn near-symmetric section is mirrored exactly, so its two sides stay one gesture
  const interior = sec.joints.filter((j) => j.kind !== 'eave');
  if (interior.length && interior.every((j) => interior.some((k) => k !== j && Math.abs(k.u - (1 - j.u)) <= 0.04 && Math.abs(k.h - j.h) <= 0.1))) {
    for (const j of interior) {
      const k = interior.find((q) => q !== j && Math.abs(q.u - (1 - j.u)) <= 0.04 && Math.abs(q.h - j.h) <= 0.1);
      if (!k) continue;
      const u = (j.u + (1 - k.u)) / 2, h = (j.h + k.h) / 2;
      const i = pts.findIndex((q) => q.id === j.id);
      if (i < 0) return null;
      pts[i] = { ...pts[i], u, h };
    }
  }
  const c = cleanSection(pts, { span: o.span, form: o.form });
  if (!c.valid) return null;
  let worst = 0;
  for (const q of c.profile) {
    const near = profile.reduce((best, b) => (Math.abs(b.u - q.u) < Math.abs(best.u - q.u) ? b : best), profile[0]);
    worst = Math.max(worst, dist([q.u * o.span, q.h], [near.u * o.span, near.h]));
  }
  return worst <= Math.max(0.05, 0.02 * o.span) ? c.profile : null;
}
