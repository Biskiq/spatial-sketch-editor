import { SplineControlPoint, WallLandmark, WallPresetId, WallSample } from './types';

export const WALL_HEIGHT = 3.25; // meters
export const WALL_THICKNESS = 0.24; // meters
export const DEFAULT_EYE_LEVEL = 1.52; // standard museum center-hang height in meters

export const WALL_PRESETS: Record<
  WallPresetId,
  { name: string; subtitle: string; points: SplineControlPoint[] }
> = {
  'gentle-arc': {
    name: 'Gentle Gallery Arc',
    subtitle: 'Embracing concave sweep',
    points: [
      { id: 'cp-0', x: -4.2, z: 0.85 },
      { id: 'cp-1', x: -1.45, z: -0.35 },
      { id: 'cp-2', x: 1.45, z: -0.35 },
      { id: 'cp-3', x: 4.2, z: 0.85 },
    ],
  },
  'serpentine-s': {
    name: 'Serpentine S-Curve',
    subtitle: 'Flowing convex-to-concave inflection',
    points: [
      { id: 'cp-0', x: -4.4, z: 0.4 },
      { id: 'cp-1', x: -1.5, z: -0.95 },
      { id: 'cp-2', x: 1.5, z: 0.75 },
      { id: 'cp-3', x: 4.4, z: -0.35 },
    ],
  },
  'concave-rotunda': {
    name: 'Intimate Rotunda',
    subtitle: 'Deep architectural alcove',
    points: [
      { id: 'cp-0', x: -3.6, z: 1.65 },
      { id: 'cp-1', x: -1.35, z: -0.65 },
      { id: 'cp-2', x: 1.35, z: -0.65 },
      { id: 'cp-3', x: 3.6, z: 1.65 },
    ],
  },
  'asymmetric-wing': {
    name: 'Asymmetric Wing',
    subtitle: 'Long gallery run with corner bend',
    points: [
      { id: 'cp-0', x: -4.8, z: -0.15 },
      { id: 'cp-1', x: -1.4, z: -0.2 },
      { id: 'cp-2', x: 1.7, z: -0.05 },
      { id: 'cp-3', x: 4.1, z: 1.45 },
    ],
  },
  'flat-gallery': {
    name: 'Classic Flat Wall',
    subtitle: 'Orthogonal museum plane',
    points: [
      { id: 'cp-0', x: -4.4, z: 0.0 },
      { id: 'cp-1', x: -1.46, z: 0.0 },
      { id: 'cp-2', x: 1.46, z: 0.0 },
      { id: 'cp-3', x: 4.4, z: 0.0 },
    ],
  },
};

/**
 * Evaluates a Catmull-Rom spline segment between p1 and p2 given neighbors p0, p3 and t in [0, 1].
 */
function evalCatmullRom(
  p0: { x: number; z: number },
  p1: { x: number; z: number },
  p2: { x: number; z: number },
  p3: { x: number; z: number },
  t: number
): { x: number; z: number; dx: number; dz: number; ddx: number; ddz: number } {
  const t2 = t * t;
  const t3 = t2 * t;

  // Standard tension 0.5 Catmull-Rom polynomial coefficients
  const b0 = -0.5 * t3 + t2 - 0.5 * t;
  const b1 = 1.5 * t3 - 2.5 * t2 + 1.0;
  const b2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
  const b3 = 0.5 * t3 - 0.5 * t2;

  const db0 = -1.5 * t2 + 2.0 * t - 0.5;
  const db1 = 4.5 * t2 - 5.0 * t;
  const db2 = -4.5 * t2 + 4.0 * t + 0.5;
  const db3 = 1.5 * t2 - t;

  const ddb0 = -3.0 * t + 2.0;
  const ddb1 = 9.0 * t - 5.0;
  const ddb2 = -9.0 * t + 4.0;
  const ddb3 = 3.0 * t - 1.0;

  const x = b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x;
  const z = b0 * p0.z + b1 * p1.z + b2 * p2.z + b3 * p3.z;

  const dx = db0 * p0.x + db1 * p1.x + db2 * p2.x + db3 * p3.x;
  const dz = db0 * p0.z + db1 * p1.z + db2 * p2.z + db3 * p3.z;

  const ddx = ddb0 * p0.x + ddb1 * p1.x + ddb2 * p2.x + ddb3 * p3.x;
  const ddz = ddb0 * p0.z + ddb1 * p1.z + ddb2 * p2.z + ddb3 * p3.z;

  return { x, z, dx, dz, ddx, ddz };
}

export class WallSplineEngine {
  public readonly controlPoints: SplineControlPoint[];
  public readonly samples: WallSample[];
  public readonly totalLength: number;
  public readonly landmarks: WallLandmark[];

  constructor(controlPoints: SplineControlPoint[], numSamples = 600) {
    this.controlPoints = controlPoints.map((cp) => ({ ...cp }));
    this.samples = [];

    const n = this.controlPoints.length;
    if (n < 2) {
      this.totalLength = 1;
      this.landmarks = [];
      return;
    }

    // Extrapolate phantom endpoints so the curve passes cleanly through cp[0] and cp[n-1]
    const pts = this.controlPoints;
    const pStart = {
      x: 2 * pts[0].x - pts[1].x,
      z: 2 * pts[0].z - pts[1].z,
    };
    const pEnd = {
      x: 2 * pts[n - 1].x - pts[n - 2].x,
      z: 2 * pts[n - 1].z - pts[n - 2].z,
    };
    const extPts = [pStart, ...pts, pEnd];
    const numSegments = n - 1;

    let cumulativeLength = 0;
    let prevX = pts[0].x;
    let prevZ = pts[0].z;

    for (let i = 0; i <= numSamples; i++) {
      const globalT = (i / numSamples) * numSegments;
      const segIdx = Math.min(Math.floor(globalT), numSegments - 1);
      const localT = globalT - segIdx;

      const p0 = extPts[segIdx];
      const p1 = extPts[segIdx + 1];
      const p2 = extPts[segIdx + 2];
      const p3 = extPts[segIdx + 3];

      const { x, z, dx, dz, ddx, ddz } = evalCatmullRom(p0, p1, p2, p3, localT);

      if (i > 0) {
        cumulativeLength += Math.hypot(x - prevX, z - prevZ);
      }
      prevX = x;
      prevZ = z;

      const speed = Math.hypot(dx, dz) || 1e-6;
      const tx = dx / speed;
      const tz = dz / speed;

      // Front-facing normal points toward +Z gallery viewer when wall runs -X to +X
      const nx = -tz;
      const nz = tx;

      // Signed curvature kappa = (dT/ds) . N = (-dx * ddz + dz * ddx) / speed^3
      // Wait: let's verify sign:
      // T = (tx, tz), N = (-tz, tx).
      // dT/dt parallel to N component is (ddx * nx + ddz * nz) / speed^2
      const curvature = (ddx * nx + ddz * nz) / (speed * speed);

      this.samples.push({
        u: cumulativeLength,
        uNorm: 0, // filled after loop
        x,
        z,
        tx,
        tz,
        nx,
        nz,
        curvature,
      });
    }

    this.totalLength = Math.max(0.1, cumulativeLength);
    for (const s of this.samples) {
      s.uNorm = s.u / this.totalLength;
    }

    this.landmarks = this.computeLandmarks();
  }

  private computeLandmarks(): WallLandmark[] {
    const list: WallLandmark[] = [];
    if (this.samples.length === 0) return list;

    const first = this.samples[0];
    const mid = this.sampleAtU(this.totalLength * 0.5);
    const last = this.samples[this.samples.length - 1];

    list.push({
      id: 'lm-left',
      label: 'Left Edge',
      u: 0,
      uNorm: 0,
      kind: 'left-edge',
      curvature: first.curvature,
    });

    // Detect prominent curvature extrema (bend apexes) and inflection points
    // Smooth curvature slightly to avoid numerical jitter
    const step = 12;
    for (let i = step; i < this.samples.length - step; i++) {
      const sPrev = this.samples[i - step];
      const sCurr = this.samples[i];
      const sNext = this.samples[i + step];

      // Inflection point: zero-crossing of significant curvature
      if (
        ((sPrev.curvature > 0.04 && sNext.curvature < -0.04) ||
          (sPrev.curvature < -0.04 && sNext.curvature > 0.04)) &&
        Math.abs(sCurr.curvature) < Math.abs(sPrev.curvature) &&
        Math.abs(sCurr.curvature) <= Math.abs(sNext.curvature)
      ) {
        if (!list.some((l) => Math.abs(l.u - sCurr.u) < 0.8)) {
          list.push({
            id: `lm-infl-${list.length}`,
            label: 'Curve Inflection',
            u: sCurr.u,
            uNorm: sCurr.uNorm,
            kind: 'inflection',
            curvature: sCurr.curvature,
          });
        }
      }

      // Local curvature peak (apex of a bend)
      const absC = Math.abs(sCurr.curvature);
      if (
        absC > 0.12 &&
        absC >= Math.abs(sPrev.curvature) &&
        absC > Math.abs(sNext.curvature)
      ) {
        if (!list.some((l) => Math.abs(l.u - sCurr.u) < 1.1)) {
          list.push({
            id: `lm-apex-${list.length}`,
            label: sCurr.curvature > 0 ? 'Concave Apex' : 'Convex Apex',
            u: sCurr.u,
            uNorm: sCurr.uNorm,
            kind: 'apex',
            curvature: sCurr.curvature,
          });
        }
      }
    }

    // Add Center landmark if not right on top of an existing apex/inflection
    if (!list.some((l) => Math.abs(l.u - mid.u) < 0.45)) {
      list.push({
        id: 'lm-center',
        label: 'Wall Center',
        u: mid.u,
        uNorm: 0.5,
        kind: 'center',
        curvature: mid.curvature,
      });
    } else {
      // If an apex/inflection is at the center, ensure 'lm-center' exists or alias
      const near = list.find((l) => Math.abs(l.u - mid.u) < 0.45);
      if (near && near.kind === 'apex') {
        near.label = 'Center Apex';
      }
    }

    list.push({
      id: 'lm-right',
      label: 'Right Edge',
      u: this.totalLength,
      uNorm: 1,
      kind: 'right-edge',
      curvature: last.curvature,
    });

    return list.sort((a, b) => a.u - b.u);
  }

  /**
   * Binary search + linear interpolation to evaluate the wall at exact arc length u in [0, totalLength].
   */
  public sampleAtU(u: number): WallSample {
    const clampedU = Math.max(0, Math.min(this.totalLength, u));
    const samples = this.samples;
    if (samples.length === 0) {
      return {
        u: 0,
        uNorm: 0,
        x: 0,
        z: 0,
        tx: 1,
        tz: 0,
        nx: 0,
        nz: 1,
        curvature: 0,
      };
    }

    let low = 0;
    let high = samples.length - 1;
    while (low < high - 1) {
      const mid = (low + high) >> 1;
      if (samples[mid].u <= clampedU) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const s0 = samples[low];
    const s1 = samples[high];
    const span = s1.u - s0.u;
    const t = span > 1e-6 ? (clampedU - s0.u) / span : 0;

    const txRaw = s0.tx + (s1.tx - s0.tx) * t;
    const tzRaw = s0.tz + (s1.tz - s0.tz) * t;
    const tLen = Math.hypot(txRaw, tzRaw) || 1;
    const tx = txRaw / tLen;
    const tz = tzRaw / tLen;

    return {
      u: clampedU,
      uNorm: clampedU / this.totalLength,
      x: s0.x + (s1.x - s0.x) * t,
      z: s0.z + (s1.z - s0.z) * t,
      tx,
      tz,
      nx: -tz,
      nz: tx,
      curvature: s0.curvature + (s1.curvature - s0.curvature) * t,
    };
  }

  /**
   * Evaluates 3D world position and yaw angle for an element at intrinsic coordinates (u, h, standoff).
   */
  public intrinsicToWorld(
    u: number,
    h: number,
    standoff = 0
  ): {
    x: number;
    y: number;
    z: number;
    yawRad: number;
    sample: WallSample;
  } {
    const sample = this.sampleAtU(u);
    const x = sample.x + sample.nx * standoff;
    const y = h;
    const z = sample.z + sample.nz * standoff;
    // Yaw rotation so local +Z points along normal (nx, nz) and local +X points along tangent (tx, tz)
    const yawRad = Math.atan2(sample.nx, sample.nz);

    return { x, y, z, yawRad, sample };
  }

  /**
   * Projects an arbitrary 3D world point (wx, wy, wz) onto the closest intrinsic wall coordinate (u, h, signedDistance).
   */
  public worldToIntrinsic(
    wx: number,
    wy: number,
    wz: number
  ): {
    u: number;
    uNorm: number;
    h: number;
    normalDistance: number;
    sample: WallSample;
  } {
    let bestIdx = 0;
    let bestDistSq = Infinity;

    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      const dx = wx - s.x;
      const dz = wz - s.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }

    // Refine locally along tangent
    const base = this.samples[bestIdx];
    const dx = wx - base.x;
    const dz = wz - base.z;
    const tangentOffset = dx * base.tx + dz * base.tz;
    const refinedU = Math.max(0, Math.min(this.totalLength, base.u + tangentOffset));
    const sample = this.sampleAtU(refinedU);

    const rdx = wx - sample.x;
    const rdz = wz - sample.z;
    const normalDistance = rdx * sample.nx + rdz * sample.nz;

    return {
      u: refinedU,
      uNorm: refinedU / this.totalLength,
      h: Math.max(0.35, Math.min(WALL_HEIGHT - 0.35, wy)),
      normalDistance,
      sample,
    };
  }

  /**
   * Computes the exact minimum extra clearance required so a rigid flat frame of width `width`
   * centered at `u` does not intersect a concave wall segment.
   */
  public computeConcaveClearance(u: number, width: number): number {
    const center = this.sampleAtU(u);
    const halfW = width * 0.5;
    let maxProtrusion = 0;

    const steps = 10;
    for (let i = -steps; i <= steps; i++) {
      if (i === 0) continue;
      const testU = Math.max(0, Math.min(this.totalLength, u + (i / steps) * halfW));
      const pt = this.sampleAtU(testU);
      const dx = pt.x - center.x;
      const dz = pt.z - center.z;
      // How far the curved wall surface protrudes in front of the center tangent plane along center.N
      const protrusion = dx * center.nx + dz * center.nz;
      if (protrusion > maxProtrusion) {
        maxProtrusion = protrusion;
      }
    }

    return maxProtrusion;
  }
}
