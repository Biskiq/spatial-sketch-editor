// Thin wrapper over polygon-clipping that speaks open rings of V2.
import pc from 'polygon-clipping';
import { V2, polyArea } from './geom2d';

export type Ring = V2[];
export type Poly = Ring[]; // [outer, ...holes]
export type MPoly = Poly[];

const toPC = (m: MPoly) => m.map((poly) => poly.map((r) => r.map((p) => [p[0], p[1]] as [number, number])));

function fromPC(m: any): MPoly {
  return (m as [number, number][][][]).map((poly) =>
    poly.map((ring) => {
      const r = ring.map((p) => [p[0], p[1]] as V2);
      if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
      return r;
    }),
  );
}

function safe(fn: () => any, fallback: MPoly): MPoly {
  try {
    return fromPC(fn());
  } catch (e) {
    return fallback;
  }
}

export const P = (outer: Ring, holes: Ring[] = []): MPoly => [[outer, ...holes]];

export function union(...ms: MPoly[]): MPoly {
  const valid = ms.filter((m) => m.length);
  if (!valid.length) return [];
  if (valid.length === 1) return valid[0];
  return safe(() => (pc.union as any)(...valid.map(toPC)), valid[0]);
}
export function intersection(a: MPoly, b: MPoly): MPoly {
  if (!a.length || !b.length) return [];
  return safe(() => pc.intersection(toPC(a) as any, toPC(b) as any), []);
}
export function difference(a: MPoly, ...b: MPoly[]): MPoly {
  const bs = b.filter((m) => m.length);
  if (!a.length) return [];
  if (!bs.length) return a;
  return safe(() => (pc.difference as any)(toPC(a), ...bs.map(toPC)), a);
}

export function mpolyArea(m: MPoly): number {
  let a = 0;
  for (const poly of m) {
    a += Math.abs(polyArea(poly[0]));
    for (let i = 1; i < poly.length; i++) a -= Math.abs(polyArea(poly[i]));
  }
  return a;
}

export function overlapArea(a: Ring, b: Ring): number {
  return mpolyArea(intersection(P(a), P(b)));
}
