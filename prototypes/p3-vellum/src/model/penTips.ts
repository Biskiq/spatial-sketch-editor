// Pen tips: what a drag means when the hand is not sketching freely. Pure: the pointer code owns the frame, the
// snap and the pointer modifiers, and this module turns two plan points into the shape the stroke will be read as.
import { V2, add, dist, polyArea, polyCentroid, ensureCCW, round } from './geom2d';
import type { StrokeFit } from './strokes';

export type PenTip = 'sketch' | 'box' | 'round';

export const BOX_MIN_SIDE = 0.6;
export const ROUND_MIN_RADIUS = 0.4;

export interface BoxShape {
  kind: 'box';
  /** corner, then the two sides, then the opposite corner, counter-clockwise */
  corners: V2[];
  /** the box in its own frame, metres (unsigned) */
  w: number;
  d: number;
}

export interface RoundShape {
  kind: 'round';
  center: V2;
  radius: number;
}

export type TipShape = BoxShape | RoundShape;

const STEP = 0.05;
/** 0.05 m steps unless the hand asked for fine (⌥). */
const tidy = (v: number, fine: boolean) => (fine ? v : round(v, STEP));

/**
 * A box from its first corner to the pointer, in a frozen frame (`frame` is the plan angle of the frame's first
 * axis). ⇧ makes it square, measured on the longer side so the hand's direction survives.
 */
export function boxShape(a0: V2, q: V2, o: { frame: number; square?: boolean; fine?: boolean }): BoxShape | null {
  const c = Math.cos(o.frame), s = Math.sin(o.frame);
  const dx = q[0] - a0[0], dz = q[1] - a0[1];
  const rawW = dx * c + dz * s;
  const rawD = -dx * s + dz * c;
  // the hand's own distance decides whether there is a shape yet; rounding only tidies a real one
  if (o.square ? Math.max(Math.abs(rawW), Math.abs(rawD)) < BOX_MIN_SIDE - 1e-9 : Math.abs(rawW) < BOX_MIN_SIDE - 1e-9 || Math.abs(rawD) < BOX_MIN_SIDE - 1e-9) return null;
  let w = tidy(rawW, !!o.fine);
  let d = tidy(rawD, !!o.fine);
  if (o.square) {
    const m = Math.max(Math.abs(w), Math.abs(d));
    w = (w < 0 ? -1 : 1) * m;
    d = (d < 0 ? -1 : 1) * m;
  }
  const uw: V2 = [c * w, s * w];
  const ud: V2 = [-s * d, c * d];
  const corners = ensureCCW([a0, add(a0, uw), add(a0, add(uw, ud)), add(a0, ud)]);
  return { kind: 'box', corners, w: Math.abs(w), d: Math.abs(d) };
}

/** A circle centred on the first press, out to the pointer. */
export function roundShape(a0: V2, q: V2, o: { fine?: boolean } = {}): RoundShape | null {
  const raw = dist(a0, q);
  if (raw < ROUND_MIN_RADIUS - 1e-9) return null;
  return { kind: 'round', center: a0, radius: tidy(raw, !!o.fine) };
}

/** The stroke fit a tip's shape is read as. `readStroke` sees exactly this, so the preview and the commit agree. */
export function tipFit(shape: TipShape): StrokeFit {
  if (shape.kind === 'round') {
    return {
      kind: 'circle', pts: [], bulge: [], closed: true, center: shape.center,
      radius: shape.radius, length: 2 * Math.PI * shape.radius, curved: true, corners: 0,
    };
  }
  const pts = shape.corners;
  let length = 0;
  for (let i = 0; i < pts.length; i++) length += dist(pts[i], pts[(i + 1) % pts.length]);
  return {
    kind: 'closed', pts, bulge: pts.map(() => 0), closed: true,
    center: polyCentroid(pts), radius: Math.sqrt(Math.abs(polyArea(pts)) / Math.PI),
    length, curved: false, corners: 4,
  };
}

/** A circle as a plan polyline, for the trail under the hand. */
export function circleTrail(center: V2, radius: number, n = 48): V2[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius] as V2;
  });
}
