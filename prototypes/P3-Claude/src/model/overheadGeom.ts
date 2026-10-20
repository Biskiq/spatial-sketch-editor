// Shared math for overheads: roofs, canopies, vaults — a drawn profile carried across a drawn outline.
import { V2, dot, fromAngle, polyCentroid, dist, clamp, pointInPoly, distToPolyEdge } from './geom2d';
import type { Overhead, ProfilePt } from './types';

export interface PSample { u: number; h: number }

/** Expand smooth profile points into a dense polyline; creases stay sharp, vertical steps stay vertical. */
export function sampleProfile(pts: ProfilePt[]): PSample[] {
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
      out.push({ u: clamp(Math.max(u, prevU), a.u, b.u), h: Math.max(0, h) });
    }
  }
  return out;
}

export interface OhFrame {
  d: V2; // span axis
  wmin: number;
  wmax: number;
  center: V2;
  R: number;
  samples: PSample[];
}

const frames = new WeakMap<Overhead, { key: string; f: OhFrame }>();

export function ohFrame(oh: Overhead): OhFrame {
  const key = `${oh.outline.join(';')}|${oh.dir}|${JSON.stringify(oh.profile)}|${oh.form}`;
  const c = frames.get(oh);
  if (c && c.key === key) return c.f;
  const d = fromAngle(oh.dir);
  let wmin = Infinity, wmax = -Infinity;
  for (const p of oh.outline) {
    const w = dot(p, d);
    wmin = Math.min(wmin, w);
    wmax = Math.max(wmax, w);
  }
  const center = polyCentroid(oh.outline);
  let R = 0;
  for (const p of oh.outline) R = Math.max(R, dist(p, center));
  const f = { d, wmin, wmax, center, R, samples: sampleProfile(oh.profile) };
  frames.set(oh, { key, f });
  return f;
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

export function ohU(oh: Overhead, p: V2): number {
  const f = ohFrame(oh);
  if (oh.form === 'revolve') {
    const r = dist(p, f.center) / Math.max(f.R, 1e-6);
    return clamp((1 - r) / 2, 0, 0.5);
  }
  return clamp((dot(p, f.d) - f.wmin) / Math.max(f.wmax - f.wmin, 1e-6), 0, 1);
}

/** The eave (baseY) is the underside where the overhead meets its walls; its thickness sits above. */
export function ohUndersideAt(oh: Overhead, p: V2): number {
  return oh.baseY + profileH(ohFrame(oh).samples, ohU(oh, p));
}

export function ohTopAt(oh: Overhead, p: V2): number {
  return ohUndersideAt(oh, p) + oh.thick;
}

export function ohCovers(oh: Overhead, p: V2, pad = 0): boolean {
  if (pointInPoly(p, oh.outline)) return true;
  return pad > 0 && distToPolyEdge(p, oh.outline) < pad;
}

export function ohRidge(oh: Overhead): number {
  return oh.baseY + oh.thick + Math.max(...ohFrame(oh).samples.map((s) => s.h));
}

export function ohSpan(oh: Overhead) {
  const f = ohFrame(oh);
  return oh.form === 'revolve' ? f.R * 2 : f.wmax - f.wmin;
}

// ---- Presets: a vocabulary of overheads expressed as profiles ----
export type ProfilePreset = 'flat' | 'raked' | 'gable' | 'clerestory' | 'vault' | 'fold' | 'sawtooth' | 'butterfly' | 'dome';

export function presetProfile(kind: ProfilePreset, span: number): ProfilePt[] {
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
