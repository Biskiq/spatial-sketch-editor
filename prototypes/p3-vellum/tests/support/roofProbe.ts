// A renderer-free geometry oracle for roofs, and the footprint fixtures every roof change is checked against.
//
// The probe fires vertical rays at a roof's top mesh on a jittered grid and compares what it hits with the height
// evaluator (`ohH`): a miss inside the outline is a gap, two hits are a double surface (overlapping or folded
// geometry), and the largest difference is the mesh's error. It needs only triangle positions, so it ports unchanged
// to any production mesher. Kept from the round-4 audit (`roof-polish-review-temp.test.ts`), with assertions in
// place of a JSON dump.
import type { Overhead } from '../../src/model/types';
import { ohH, ohTopAt } from '../../src/model/overheadGeom';
import { buildOverhead } from '../../src/scene/build/overheads';
import { V2, bbox, pointInPoly, distToPolyEdge } from '../../src/model/geom2d';

export const rect = (x0: number, z0: number, x1: number, z1: number): V2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

/** The supported footprint families, as single room outlines (CCW, metres). Wings carry all of them. */
export const FOOTPRINTS: Record<string, V2[]> = {
  L: [[0, 0], [10, 0], [10, 14], [6, 14], [6, 6], [0, 6]],
  'unequal L': [[0, 0], [10, 0], [10, 14], [7, 14], [7, 6], [0, 6]],
  T: [[0, 0], [11, 0], [11, 5], [7.5, 5], [7.5, 12], [3.5, 12], [3.5, 5], [0, 5]],
  U: [[0, 0], [11, 0], [11, 11], [7, 11], [7, 5], [4, 5], [4, 11], [0, 11]],
  plus: [[4, 0], [9, 0], [9, 2], [12, 2], [12, 7], [9, 7], [9, 12], [4, 12], [4, 7], [0, 7], [0, 2], [4, 2]],
};

/** Every vertical hit on a triangle soup (positions as x,y,z triples), strictly inside a triangle. */
export function hitsAt(pos: ArrayLike<number>, x: number, z: number): number[] {
  const h: number[] = [];
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i], az = pos[i + 2], bx = pos[i + 3], bz = pos[i + 5], cx = pos[i + 6], cz = pos[i + 8];
    const d = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
    if (Math.abs(d) < 1e-9) continue;
    const a = ((bx - x) * (cz - z) - (cx - x) * (bz - z)) / d;
    const b = ((cx - x) * (az - z) - (ax - x) * (cz - z)) / d;
    const c = 1 - a - b;
    if (a > 1e-7 && b > 1e-7 && c > 1e-7) h.push(a * pos[i + 1] + b * pos[i + 4] + c * pos[i + 7]);
  }
  return h;
}

export interface ProbeResult {
  samples: number;
  gaps: number;
  double: number;
  /** largest |mesh − evaluator| over the samples, m */
  maxErr: number;
}

/** Probe one roof's top surface against its own evaluator. Samples within 5 cm of the outline are skipped. */
export function probeRoof(oh: Overhead, step = 0.43): ProbeResult {
  const pos = buildOverhead(oh, []).top.pos;
  const bb = bbox(oh.outline);
  const r: ProbeResult = { samples: 0, gaps: 0, double: 0, maxErr: 0 };
  for (let x = bb.min[0] + 0.137; x < bb.max[0]; x += step)
    for (let z = bb.min[1] + 0.211; z < bb.max[1]; z += step * 1.09) {
      const q: V2 = [x, z];
      if (!pointInPoly(q, oh.outline) || distToPolyEdge(q, oh.outline) < 0.05) continue;
      r.samples++;
      const ys = hitsAt(pos, x, z);
      if (!ys.length) { r.gaps++; continue; }
      if (ys.length > 1) r.double++;
      r.maxErr = Math.max(r.maxErr, Math.abs(Math.max(...ys) - ohTopAt(oh, q)));
    }
  return r;
}

/** The highest the roof stands above its eave anywhere on its outline's corners: 0 for a roof whose eaves are level. */
export function cornerRise(oh: Overhead): number {
  return Math.max(...oh.outline.map((q) => ohH(oh, q)));
}

/** Where two independently drawn roofs overlap in plan, how often (and by how much) their tops disagree. */
export function overlapDisagreement(a: Overhead, b: Overhead, step = 0.25) {
  const bb = bbox([...a.outline, ...b.outline]);
  let n = 0, disagree = 0, maxDiff = 0;
  for (let x = bb.min[0]; x < bb.max[0]; x += step)
    for (let z = bb.min[1]; z < bb.max[1]; z += step) {
      const q: V2 = [x, z];
      if (!pointInPoly(q, a.outline) || !pointInPoly(q, b.outline)) continue;
      n++;
      const d = Math.abs(ohTopAt(a, q) - ohTopAt(b, q));
      if (d > 0.05) disagree++;
      maxDiff = Math.max(maxDiff, d);
    }
  return { n, disagree, maxDiff };
}
