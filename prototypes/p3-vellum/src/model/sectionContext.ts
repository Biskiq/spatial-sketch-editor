// What the section line passes through: the pencil drawing behind the section sheet.
// Pure: it samples the building analytically and never edits it. The sheet draws these lines, and the same
// clearance queries are the ones placement offers use, so the two cannot disagree about headroom.
import type { Derived } from './derive';
import { wallTopAt } from './derive';
import type { Overhead, Project } from './types';
import { V2, pointInPoly, pointInPolyHoles } from './geom2d';
import { runGeom } from './runs';
import { ohCovers, ohFrame, ohSection, ohSpan, ohTopAt, ohUndersideAt, sampleProfile } from './overheadGeom';

export interface SectionContext {
  x0: number; // section metres
  x1: number;
  lines: { kind: 'wall' | 'floor' | 'ceiling' | 'deck' | 'neighbour'; pts: [number, number][]; faint: boolean }[];
  people: { x: number; y: number }[];
  headroom: { x0: number; x1: number; y: number; clear: number }[];
}

/** The headroom a person is promised; runs below it are hatched in red pencil. */
export const MIN_HEADROOM = 2.0;

const SAMPLE = 0.05;

/** The plan point where the section line sits at x section-metres. */
export function sectionPoint(oh: Overhead, x: number): V2 {
  const span = oh.form === 'revolve' ? ohFrame(oh).R * 2 : ohSpan(oh);
  const sec = ohSection(oh);
  return sec.at(Math.max(0, Math.min(1, x / Math.max(span, 1e-6))), 0).plan;
}

function segCross(a: V2, b: V2, c: V2, d: V2): { t: number; q: V2 } | null {
  const rx = b[0] - a[0], rz = b[1] - a[1];
  const sx = d[0] - c[0], sz = d[1] - c[1];
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null; // parallel (or collinear): no single crossing to draw
  const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den;
  const u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { t, q: [a[0] + rx * t, a[1] + rz * t] };
}

/** Contiguous stretches of x where `inside` holds, as [start, end] intervals. */
function stretches(xs: number[], inside: (x: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  for (const x of xs) {
    if (inside(x)) {
      if (start === null) start = x;
    } else if (start !== null) {
      out.push([start, x]);
      start = null;
    }
  }
  if (start !== null) out.push([start, xs[xs.length - 1]]);
  return out;
}

export function sectionContext(p: Project, d: Derived, oh: Overhead): SectionContext {
  const span = oh.form === 'revolve' ? ohFrame(oh).R * 2 : ohSpan(oh);
  const x0 = 0, x1 = Math.max(0.1, span);
  const n = Math.max(4, Math.ceil((x1 - x0) / SAMPLE));
  const xs = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
  const qAt = (x: number) => sectionPoint(oh, x);
  const covered = (x: number) => ohCovers(oh, qAt(x));
  const lines: SectionContext['lines'] = [];
  const people: { x: number; y: number }[] = [];
  const headroom: { x0: number; x1: number; y: number; clear: number }[] = [];

  const personAt = (a: number, b: number, y: number) => {
    if (b - a < 1.2) return;
    const x = (a + b) / 2;
    if (covered(x)) people.push({ x, y });
  };

  // ---- floors and their flat ceilings
  for (const r of d.rooms) {
    for (const [a, b] of stretches(xs, (x) => pointInPolyHoles(qAt(x), r.poly, r.holes))) {
      const faint = !covered((a + b) / 2);
      lines.push({ kind: 'floor', pts: [[a, r.floorY], [b, r.floorY]], faint });
      if (r.seed.ceiling === 'flat') lines.push({ kind: 'ceiling', pts: [[a, r.topY], [b, r.topY]], faint });
      personAt(a, b, r.floorY);
    }
  }

  // ---- decks: the walking surface and the slab under it
  for (const dk of p.decks) {
    for (const [a, b] of stretches(xs, (x) => pointInPoly(qAt(x), dk.outline))) {
      const faint = !covered((a + b) / 2);
      lines.push({ kind: 'deck', pts: [[a, dk.y], [b, dk.y]], faint });
      lines.push({ kind: 'deck', pts: [[a, dk.y - dk.thick], [b, dk.y - dk.thick]], faint });
      personAt(a, b, dk.y);
    }
  }

  // ---- walls: where the section crosses a wall's centreline, draw that wall from its base to its top
  const a0 = qAt(x0), a1 = qAt(x1);
  for (const w of d.walls.values()) {
    const ps = runGeom(w.run).ps;
    const segs = w.run.shape === 'circle' || w.run.closed ? ps.pts.length : ps.pts.length - 1;
    for (let i = 0; i < segs; i++) {
      const c = ps.pts[i], e = ps.pts[(i + 1) % ps.pts.length];
      const cross = segCross(a0, a1, c, e);
      if (!cross) continue;
      const x = x0 + (x1 - x0) * cross.t;
      const s = ps.s[i] + (ps.s[(i + 1) % ps.s.length] - ps.s[i]) * cross.t;
      const top = wallTopAt(w, s);
      lines.push({ kind: 'wall', pts: [[x, w.run.baseY], [x, top]], faint: !covered(x) });
    }
  }

  // ---- neighbouring roofs, drawn as their top profile
  for (const other of p.overheads) {
    if (other.id === oh.id || !sampleProfile(other.profile).length) continue;
    let run: [number, number][] = [];
    const flush = () => {
      if (run.length > 1) lines.push({ kind: 'neighbour', pts: run, faint: true });
      run = [];
    };
    for (const x of xs) {
      const q = qAt(x);
      if (ohCovers(other, q)) run.push([x, ohTopAt(other, q)]);
      else flush();
    }
    flush();
  }

  // ---- headroom: the lowest thing actually over each walking surface
  const obstruction = (q: V2, y: number): number | null => {
    let low = Infinity;
    for (const r of d.rooms) {
      if (r.seed.ceiling === 'flat' && r.topY > y + 0.1 && pointInPolyHoles(q, r.poly, r.holes)) low = Math.min(low, r.topY);
    }
    for (const dk of p.decks) {
      const under = dk.y - dk.thick;
      if (under > y + 0.1 && pointInPoly(q, dk.outline)) low = Math.min(low, under);
    }
    for (const roof of p.overheads) {
      if (!ohCovers(roof, q)) continue;
      const u = ohUndersideAt(roof, q);
      if (u > y + 0.1) low = Math.min(low, u);
    }
    return low === Infinity ? null : low;
  };
  const surfaces: { a: number; b: number; y: number }[] = [];
  for (const r of d.rooms) for (const [a, b] of stretches(xs, (x) => pointInPolyHoles(qAt(x), r.poly, r.holes))) surfaces.push({ a, b, y: r.floorY });
  for (const dk of p.decks) for (const [a, b] of stretches(xs, (x) => pointInPoly(qAt(x), dk.outline))) surfaces.push({ a, b, y: dk.y });
  for (const s of surfaces) {
    let band: { x0: number; x1: number; clear: number } | null = null;
    const flush = () => {
      if (band && band.x1 - band.x0 > 0.05) headroom.push({ x0: band.x0, x1: band.x1, y: s.y, clear: band.clear });
      band = null;
    };
    for (const x of xs) {
      if (x < s.a - 1e-9 || x > s.b + 1e-9) {
        flush();
        continue;
      }
      const top = obstruction(qAt(x), s.y);
      const clear = top === null ? Infinity : top - s.y;
      if (clear < MIN_HEADROOM) {
        band = band ? { x0: band.x0, x1: x, clear: Math.min(band.clear, Math.max(0, clear)) } : { x0: x, x1: x, clear: Math.max(0, clear) };
      } else flush();
    }
    flush();
  }

  return { x0, x1, lines, people, headroom };
}
