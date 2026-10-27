// Pure evaluator: the same function serves previews, acceptance and reopened files.
import { ARRIVAL, FLOOR_HALF } from './fixture';
import {
  MIN_SEGMENT, MITER_LIMIT, add, dot, leftNormal, len, norm, polygonSelfIntersection, polygonsOverlap,
  scale, segmentsIntersect, sub,
} from './geometry';
import type { Arrangement, E0Document, GuidePoint, Piece, Pose, Vec2 } from './types';

export type ErrorTarget = 'guide' | 'band' | 'arrangement' | 'document';

export interface EvalError {
  target: ErrorTarget;
  message: string;
}

export interface EvaluatedPiece {
  id: string;
  pose: Pose;
  following: boolean;
  footprint: Vec2[];
}

export interface Evaluation {
  errors: EvalError[];
  guideLength: number | null;
  /** Closed outline of the band on the floor (left side forward, right side back). */
  bandOutline: Vec2[] | null;
  /** Evaluated slot poses for the arrangement, in slot order. */
  slots: Pose[] | null;
  pieces: EvaluatedPiece[];
}

const pts = (points: GuidePoint[]): Vec2[] => points.map((p) => [p.x, p.z]);
const finite = (...values: number[]) => values.every((v) => Number.isFinite(v));
const fmt = (v: number) => v.toFixed(2);

export function guideError(points: GuidePoint[]): string | null {
  if (points.length < 2) return 'A guide needs at least two points.';
  if (!points.every((p) => finite(p.x, p.z))) return 'Guide points must have finite X/Z values.';
  const p = pts(points);
  for (let i = 0; i < p.length - 1; i++) {
    if (len(sub(p[i + 1], p[i])) < MIN_SEGMENT) {
      return `Points ${i + 1} and ${i + 2} coincide (segment shorter than ${MIN_SEGMENT * 100} cm). Move them apart or remove one.`;
    }
  }
  for (let i = 1; i < p.length - 1; i++) {
    const a = norm(sub(p[i], p[i - 1]));
    const b = norm(sub(p[i + 1], p[i]));
    if (dot(a, b) < -1 + 1e-9) return `The guide reverses on itself at point ${i + 1}. Widen the corner angle or remove the point.`;
  }
  for (let i = 0; i < p.length - 1; i++) {
    for (let j = i + 2; j < p.length - 1; j++) {
      if (segmentsIntersect(p[i], p[i + 1], p[j], p[j + 1])) {
        return `The guide crosses itself (segments ${i + 1} and ${j + 1}). Separate the segments.`;
      }
    }
  }
  return null;
}

export function guideLength(points: GuidePoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
  return total;
}

/** Point and unit tangent at arc length s. At an exact corner the outgoing tangent is used. */
export function sampleGuide(points: GuidePoint[], s: number): { at: Vec2; tangent: Vec2 } {
  const p = pts(points);
  let walked = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const seg = sub(p[i + 1], p[i]);
    const l = len(seg);
    const last = i === p.length - 2;
    // Strict "<" so a sample exactly on an interior corner belongs to the outgoing segment.
    if (s < walked + l || last) {
      const t = Math.min(Math.max((s - walked) / l, 0), 1);
      return { at: add(p[i], scale(seg, t)), tangent: norm(seg) };
    }
    walked += l;
  }
  return { at: p[0], tangent: [1, 0] };
}

/** Yaw that turns a piece's local +X onto the floor tangent (tx, tz). */
export const yawFromTangent = (t: Vec2) => Math.atan2(-t[1], t[0]);

export function bandOutline(points: GuidePoint[], width: number): { outline: Vec2[] } | { error: string } {
  if (!finite(width) || width <= 0) return { error: 'Band width must be a positive number.' };
  const p = pts(points);
  const h = width / 2;
  const dirs = p.slice(0, -1).map((a, i) => norm(sub(p[i + 1], a)));
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < p.length; i++) {
    let offset: Vec2;
    if (i === 0) offset = scale(leftNormal(dirs[0]), h);
    else if (i === p.length - 1) offset = scale(leftNormal(dirs[i - 1]), h);
    else {
      const n1 = leftNormal(dirs[i - 1]);
      const n2 = leftNormal(dirs[i]);
      const bisector = norm(add(n1, n2));
      const cosHalf = dot(bisector, n1);
      const ratio = cosHalf > 1e-9 ? 1 / cosHalf : Infinity;
      if (ratio > MITER_LIMIT + 1e-9) {
        return {
          error: `The corner at point ${i + 1} is too sharp for a ${fmt(width)} m band (its miter reaches ${
            Number.isFinite(ratio) ? ratio.toFixed(1) : '∞'
          }× the half-width; the limit is ${MITER_LIMIT}×). Widen the corner angle or narrow the band.`,
        };
      }
      offset = scale(bisector, h / cosHalf);
    }
    left.push(add(p[i], offset));
    right.push(sub(p[i], offset));
  }
  for (let i = 0; i < dirs.length; i++) {
    const lOk = dot(sub(left[i + 1], left[i]), dirs[i]) > 1e-9;
    const rOk = dot(sub(right[i + 1], right[i]), dirs[i]) > 1e-9;
    if (!lOk || !rOk) {
      return {
        error: `Segment ${i + 1} is too short for a ${fmt(width)} m band at its corners, so the band edges fold over. Lengthen or separate the segments, or narrow the band.`,
      };
    }
  }
  const outline = [...left, ...right.reverse()];
  const hit = polygonSelfIntersection(outline);
  if (hit) {
    return { error: `The band's sides overlap where different segments come close. Separate the segments or narrow the band.` };
  }
  return { outline };
}

export function slotDistances(length: number, a: number, b: number): [number, number, number] {
  return [a, (a + length - b) / 2, length - b];
}

export function arrangementSlots(points: GuidePoint[], arrangement: Pick<Arrangement, 'startMargin' | 'endMargin' | 'sideOffset'>): { slots: Pose[] } | { error: string } {
  const { startMargin: a, endMargin: b, sideOffset: d } = arrangement;
  if (!finite(a, b, d)) return { error: 'Margins and side offset must be finite numbers.' };
  if (a < 0 || b < 0) return { error: 'Margins cannot be negative.' };
  const L = guideLength(points);
  if (!(L > a + b)) {
    return { error: `The guide (${fmt(L)} m) must be longer than the two margins together (${fmt(a + b)} m). Shorten the margins or lengthen the guide.` };
  }
  const slots = slotDistances(L, a, b).map((s) => {
    const { at, tangent } = sampleGuide(points, s);
    const c = add(at, scale(leftNormal(tangent), d));
    return { x: c[0], z: c[1], yaw: yawFromTangent(tangent) };
  });
  return { slots };
}

export function footprint(piece: Pick<Piece, 'width' | 'depth'>, pose: Pose): Vec2[] {
  const ux: Vec2 = [Math.cos(pose.yaw), -Math.sin(pose.yaw)];
  const uz: Vec2 = [Math.sin(pose.yaw), Math.cos(pose.yaw)];
  const hw = piece.width / 2;
  const hd = piece.depth / 2;
  const c: Vec2 = [pose.x, pose.z];
  return [
    add(add(c, scale(ux, -hw)), scale(uz, -hd)),
    add(add(c, scale(ux, hw)), scale(uz, -hd)),
    add(add(c, scale(ux, hw)), scale(uz, hd)),
    add(add(c, scale(ux, -hw)), scale(uz, hd)),
  ];
}

export function evaluate(doc: E0Document): Evaluation {
  const errors: EvalError[] = [];
  let length: number | null = null;
  let outline: Vec2[] | null = null;
  let slots: Pose[] | null = null;
  const guideOk = doc.guide ? !guideError(doc.guide.points) : false;
  if (doc.guide) {
    const e = guideError(doc.guide.points);
    if (e) errors.push({ target: 'guide', message: e });
    else length = guideLength(doc.guide.points);
  }
  if (doc.band) {
    if (!doc.guide || doc.band.guideId !== doc.guide.id) errors.push({ target: 'band', message: 'The display edge refers to a guide that does not exist.' });
    else if (!finite(doc.band.height) || doc.band.height <= 0) errors.push({ target: 'band', message: 'Band height must be a positive number.' });
    else if (guideOk) {
      const r = bandOutline(doc.guide.points, doc.band.width);
      if ('error' in r) errors.push({ target: 'band', message: r.error });
      else outline = r.outline;
    }
  }
  if (doc.arrangement) {
    if (!doc.guide || doc.arrangement.guideId !== doc.guide.id) errors.push({ target: 'arrangement', message: 'The arrangement refers to a guide that does not exist.' });
    else if (guideOk) {
      const r = arrangementSlots(doc.guide.points, doc.arrangement);
      if ('error' in r) errors.push({ target: 'arrangement', message: r.error });
      else slots = r.slots;
    }
  }
  const pieces = doc.pieces.map((piece) => {
    const member = doc.arrangement?.members.find((m) => m.pieceId === piece.id);
    const following = !!member?.following && !!slots;
    const pose = following ? slots![member!.slot] : piece.pose;
    return { id: piece.id, pose, following: !!member?.following, footprint: footprint(piece, pose) };
  });
  for (const piece of doc.pieces) {
    if (!finite(piece.pose.x, piece.pose.z, piece.pose.yaw)) errors.push({ target: 'document', message: `${piece.name} has a non-finite pose.` });
  }
  return { errors, guideLength: length, bandOutline: outline, slots, pieces };
}

export const isAcceptable = (doc: E0Document) => evaluate(doc).errors.length === 0;

export interface BriefCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

const insideFloor = (poly: Vec2[]) => poly.every(([x, z]) => Math.abs(x) <= FLOOR_HALF + 1e-9 && Math.abs(z) <= FLOOR_HALF + 1e-9);

/** Checkable facts from the brief. Focus and coherence remain owner judgments. */
export function briefChecks(doc: E0Document, ev: Evaluation, mainReference: Pose | null): BriefCheck[] {
  const r = ARRIVAL[doc.entrance];
  const patch: Vec2[] = [[r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ]];
  const blockers = [
    ...ev.pieces.filter((p) => polygonsOverlap(p.footprint, patch)).map((p) => doc.pieces.find((q) => q.id === p.id)!.name),
    ...(ev.bandOutline && polygonsOverlap(ev.bandOutline, patch) ? ['display edge'] : []),
  ];
  const outside = [
    ...ev.pieces.filter((p) => !insideFloor(p.footprint)).map((p) => doc.pieces.find((q) => q.id === p.id)!.name),
    ...(ev.bandOutline && !insideFloor(ev.bandOutline) ? ['display edge'] : []),
  ];
  const checks: BriefCheck[] = [
    { label: 'Display edge exists', ok: !!ev.bandOutline },
    { label: 'Arrival area clear', ok: blockers.length === 0, detail: blockers.length ? `Blocked by ${blockers.join(', ')}` : undefined },
    { label: 'Within marked floor', ok: outside.length === 0, detail: outside.length ? `Outside: ${outside.join(', ')}` : undefined },
  ];
  if (mainReference) {
    const main = doc.pieces.find((p) => p.main)!;
    const pose = ev.pieces.find((p) => p.id === main.id)!.pose;
    const dYaw = Math.abs(Math.atan2(Math.sin(pose.yaw - mainReference.yaw), Math.cos(pose.yaw - mainReference.yaw)));
    const ok = Math.hypot(pose.x - mainReference.x, pose.z - mainReference.z) <= 1e-4 && dYaw <= 1e-4;
    checks.push({ label: 'Main piece pose unchanged since entrance switch', ok, detail: ok ? undefined : 'The main piece has moved or turned' });
  }
  return checks;
}
