// The one authored section curve, sampled. These primitives sit below both the roof surface (overheadGeom) and the
// section model (section.ts), so neither has to import the other.
import { clamp } from './geom2d';
import type { ProfilePt } from './types';

export interface PSample { u: number; h: number }

/** Expand smooth profile points into a dense polyline; creases stay sharp, vertical steps stay vertical. */
export function sampleProfile(pts: ProfilePt[]): PSample[] {
  return sampleRaw(pts, true);
}

/** Same curve; unclamped it is linear in the points' heights (used to bend the curve exactly under the pen). */
export function sampleRaw(pts: ProfilePt[], clampH: boolean): PSample[] {
  if (pts.length < 2) return [{ u: 0, h: pts[0]?.h ?? 0 }, { u: 1, h: pts[0]?.h ?? 0 }];
  const out: PSample[] = [{ u: pts[0].u, h: pts[0].h }];
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const step = Math.abs(b.u - a.u) < 1e-6;
    if (step || (a.crease && b.crease)) {
      out.push({ u: b.u, h: b.h });
      continue;
    }
    const p0 = a.crease || i === 0 ? a : pts[i - 1];
    const p3 = b.crease || i + 2 >= pts.length ? b : pts[i + 2];
    const N = 10;
    for (let k = 1; k <= N; k++) {
      const t = k / N;
      const u = cr(p0.u, a.u, b.u, p3.u, t);
      const h = cr(p0.h, a.h, b.h, p3.h, t);
      const prevU = out[out.length - 1].u;
      out.push({ u: clamp(Math.max(u, prevU), a.u, b.u), h: clampH ? Math.max(0, h) : h });
    }
  }
  return out;
}

/** Height of the profile at fraction u (takes the higher side at a vertical step). */
export function profileH(samples: PSample[], u: number): number {
  if (u <= samples[0].u) return samples[0].h;
  for (let i = 0; i + 1 < samples.length; i++) {
    const a = samples[i], b = samples[i + 1];
    if (u >= a.u && u <= b.u) {
      if (b.u - a.u < 1e-9) return Math.max(a.h, b.h);
      return a.h + ((b.h - a.h) * (u - a.u)) / (b.u - a.u);
    }
  }
  return samples[samples.length - 1].h;
}

const TOP_EPS = 1e-3;

/** The peak: the run of points at the profile's greatest height (one point for a gable, two for a flat-topped ridge). */
export function profilePeak(pts: ProfilePt[]) {
  if (!pts.length) return { i0: 0, i1: 0, u: 0.5, h: 0 };
  const H = Math.max(...pts.map((q) => q.h));
  let i0 = pts.findIndex((q) => q.h > H - TOP_EPS);
  let i1 = i0;
  while (i1 + 1 < pts.length && pts[i1 + 1].h > H - TOP_EPS) i1++;
  return { i0, i1, u: (pts[i0].u + pts[i1].u) / 2, h: H };
}
