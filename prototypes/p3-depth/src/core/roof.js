// Roofs as one field.
//
// A roof volume is a plan region plus eaves. Each eave carries a profile inwards: u = distance / run.
// The surface of one volume is the LOWER envelope of its eave profiles, so the eave is exact and the
// hips, valleys and ridges are where two profiles meet. Volumes are combined with an UPPER envelope:
// a dormer, a cross-gable or a second roof is a volume that wins where it is higher, and its cheeks are
// the vertical steps at its plan boundary.
//
// The authored section is applied AFTER the plan field: z = eaveZ + rise * section(u / uMax).
// The plan decides where planes meet; the section decides what the slope looks like.

import {
  add, ccw, centroid, dist2, dot, isReflex, lerp2, mul, norm, polyArea,
  pointInPoly, pointInRegion, splitConvex, sub, triangulate, clipConvex,
} from './plan.js';

export const SECTIONS = {
  straight: [{ u: 0, h: 0 }, { u: 1, h: 1 }],
  gambrel: [{ u: 0, h: 0 }, { u: 0.34, h: 0.62, crease: true }, { u: 1, h: 1 }],
  mansard: [
    { u: 0, h: 0 }, { u: 0.3, h: 0.72, crease: true },
    { u: 0.36, h: 0.72, crease: true }, { u: 1, h: 1 },
  ],
  vault: (() => {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18;
      pts.push({ u, h: Math.sqrt(Math.max(0, 1 - (1 - u) ** 2)) });
    }
    return pts;
  })(),
  dome: (() => {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18;
      pts.push({ u, h: 1 - (1 - u) ** 2.2 });
    }
    return pts;
  })(),
};

export function sectionOf(spec) {
  if (!spec) return SECTIONS.straight;
  if (Array.isArray(spec)) return spec;
  return SECTIONS[spec] || SECTIONS.straight;
}

export function sectionValue(sec, u) {
  const t = Math.max(0, Math.min(1, u));
  for (let i = 1; i < sec.length; i++) {
    const a = sec[i - 1], b = sec[i];
    if (t <= b.u + 1e-9) {
      const span = b.u - a.u;
      const k = span < 1e-9 ? 0 : (t - a.u) / span;
      return a.h + (b.h - a.h) * k;
    }
  }
  return sec[sec.length - 1].h;
}

export function sectionMonotone(sec) {
  for (let i = 1; i < sec.length; i++) {
    if (sec[i].u < sec[i - 1].u - 1e-9) return false;
    if (sec[i].h < sec[i - 1].h - 1e-9) return false;
  }
  return Math.abs(sec[0].u) < 1e-9 && Math.abs(sec[sec.length - 1].u - 1) < 1e-9;
}

export function sectionIsStraight(sec) { return sec.length === 2; }
export function sectionCreasePoints(sec) {
  return sec.filter((p) => p.crease && p.u > 0.02 && p.u < 0.98);
}

export function rectRegion(cx, cy, w, d, angle = 0) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  return ccw(pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]));
}

// ------------------------------------------------------------------ normalization

function normVolume(spec, isFeature) {
  const outline = ccw(spec.outline);
  const holes = (spec.holes || []).map((h) => h.slice());
  const edges = spec.edges || [];
  const eave = (i, poly, holeIndex = -1, override = null) => {
    const e = override || (holeIndex >= 0 ? { run: edges[i]?.run } : edges[i]) || {};
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const t = norm(sub(b, a));
    const mid = lerp2(a, b, 0.5);
    let n = [-t[1], t[0]];
    const probeInside = pointInPoly(add(mid, mul(n, 0.05)), poly);
    if (holeIndex >= 0) {
      if (probeInside) n = mul(n, -1); // material is outside the hole
    } else if (!probeInside) {
      n = mul(n, -1);
    }
    return {
      id: `${spec.id}:e${holeIndex >= 0 ? `h${holeIndex}:` : ''}${i}`,
      a, b, mid, n, length: dist2(a, b),
      kind: e.kind || 'eave',
      run: e.run ?? 3.5,
      edgeIndex: i,
      holeIndex,
    };
  };
  const eaves = outline.map((_, i) => eave(i, outline));
  // A hole's edges are indexed by the hole, not by the outline: inheriting the
  // outline's per-edge kinds would put a gable on the inside of a courtyard.
  const holeEaves = holes.flatMap((h, hi) => h.map((_, i) => eave(i, h, hi, spec.holeEdges?.[hi]?.[i])));
  return {
    id: spec.id,
    name: spec.name || spec.id,
    isFeature: !!isFeature,
    host: spec.host || null,
    outline,
    holes,
    eaveZ: spec.eaveZ ?? 3,
    rise: spec.rise ?? 2.6,
    section: sectionOf(spec.section),
    edges,
    eaves,
    holeEaves,
    allEaves: [...eaves, ...holeEaves],
    kind: spec.kind || (isFeature ? 'feature' : 'roof'),
    storeys: spec.storeys ?? 2,
  };
}

export function makeRoof(spec) {
  const roof = normVolume(spec, false);
  roof.features = (spec.features || []).map((f, i) => {
    const v = normVolume({ ...f, id: f.id || `${spec.id}:f${i}` }, true);
    v.host = roof.id;
    return v;
  });
  return roof;
}

// ------------------------------------------------------------------ field internals

function partOf(vol) {
  return {
    vol,
    planes: vol.allEaves
      .filter((e) => e.kind === 'eave' && e.run > 0.15)
      .map((e) => {
        const t = norm(sub(e.b, e.a));
        // An eave's plane holds only over the slab in front of its own segment.
        // Letting it run past the end would let the notch wall of an L cut a
        // false valley straight through the bar, at eave height.
        const inSlab = (p) => {
          const s = dot(sub(p, e.a), t);
          return s > -1e-6 && s < e.length + 1e-6;
        };
        return {
          id: e.id,
          eave: e,
          u: (p) => dot(e.n, sub(p, e.a)) / e.run,
          applies: (p) => dot(e.n, sub(p, e.a)) > -1e-7 && inSlab(p),
          segU: (p) => pointSegDist(p, e.a, e.b) / e.run,
        };
      }),
  };
}

function inside(vol, p) { return pointInRegion(p, vol.outline, vol.holes); }

function uAt(part, p) {
  let u = Infinity;
  let any = false;
  for (const pl of part.planes) {
    if (!pl.applies(p)) continue;
    any = true;
    const v = pl.u(p);
    if (v < u) u = v;
  }
  // a sharp corner can put a point outside every slab; fall back to the
  // distance to the nearest eave so the corner still has a surface
  if (!any) for (const pl of part.planes) u = Math.min(u, pl.segU(p));
  return u;
}

// u is distance/run, so u = 1 is one full run in from the eave. A plane that
// reaches the ridge early keeps climbing: the run sets the pitch, and the peak
// follows from the plan. Normalising here would make `run` a no-op.
function sectionAt(sec, u) {
  if (u > 1 && sec.length === 2) {
    const k = (sec[1].h - sec[0].h) / Math.max(1e-9, sec[1].u - sec[0].u);
    return sec[1].h + (u - 1) * k;
  }
  return sectionValue(sec, u);
}

function zOf(vol, u) {
  return vol.eaveZ + vol.rise * sectionAt(vol.section, Math.max(0, u));
}

function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

function splitAll(polys, lines) {
  let cur = polys;
  for (const line of lines) {
    const next = [];
    for (const poly of cur) {
      // cheap rejection: a line that misses the polygon's box cannot split it
      let lo = Infinity, hi = -Infinity;
      for (const p of poly) {
        const v = line.n[0] * p[0] + line.n[1] * p[1];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (lo > line.c - 1e-9 || hi < line.c + 1e-9) { next.push(poly); continue; }
      const [a, b] = splitConvex(poly, line.n, line.c);
      if (a.length >= 3 && polyArea(a) > 1e-7) next.push(a);
      if (b.length >= 3 && polyArea(b) > 1e-7) next.push(b);
    }
    cur = next;
  }
  return cur;
}

function uEqLine(pa, pb) {
  const ax = pa.eave.n[0] / pa.eave.run - pb.eave.n[0] / pb.eave.run;
  const ay = pa.eave.n[1] / pa.eave.run - pb.eave.n[1] / pb.eave.run;
  const c0 = -(dot(pa.eave.n, pa.eave.a) / pa.eave.run - dot(pb.eave.n, pb.eave.a) / pb.eave.run);
  const gl = Math.hypot(ax, ay);
  if (gl < 1e-12) return null;
  return { n: [ax / gl, ay / gl], c: -c0 / gl };
}

function zEqLine(volA, pa, volB, pb) {
  const f = (p) => zOf(volA, pa.u(p)) - zOf(volB, pb.u(p));
  const g0 = f([0, 0]), gx = f([1, 0]) - g0, gy = f([0, 1]) - g0;
  const gl = Math.hypot(gx, gy);
  if (gl < 1e-9) return null;
  return { n: [gx / gl, gy / gl], c: -g0 / gl };
}

function pointSegDist(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return dist2(p, add(a, mul(ab, t)));
}

const edgeKey = (a, b) => {
  const ka = `${a[0].toFixed(6)},${a[1].toFixed(6)}`;
  const kb = `${b[0].toFixed(6)},${b[1].toFixed(6)}`;
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

// ------------------------------------------------------------------ build

export function buildRoofs(roofSpecs, opts = {}) {
  const t0 = now();
  const roofs = roofSpecs.map(makeRoof);
  const parts = [];
  for (const r of roofs) {
    parts.push(partOf(r));
    for (const f of r.features) parts.push(partOf(f));
  }

  const domain = [];
  for (const r of roofs) domain.push(...triangulate(r.outline, r.holes));

  const intrinsic = [];
  for (const part of parts) {
    for (const pl of part.planes) intrinsic.push({ n: pl.eave.n, c: dot(pl.eave.n, pl.eave.a) });
    for (let i = 0; i < part.planes.length; i++) {
      for (let j = i + 1; j < part.planes.length; j++) {
        const line = uEqLine(part.planes[i], part.planes[j]);
        if (line) intrinsic.push(line);
      }
    }
    if (part.vol.isFeature) {
      for (const e of part.vol.eaves) intrinsic.push({ n: e.n, c: dot(e.n, e.a) });
    }
  }

  let raw = splitAll(domain, intrinsic);

  const straightOnly = parts.every((p) => sectionIsStraight(p.vol.section));
  const seamLines = [];
  let curvedMeet = false;
  if (!straightOnly && parts.length > 1) curvedMeet = true;
  if (!curvedMeet) {
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        for (const pa of parts[i].planes) {
          for (const pb of parts[j].planes) {
            const line = zEqLine(parts[i].vol, pa, parts[j].vol, pb);
            if (line) seamLines.push(line);
          }
        }
      }
    }
    raw = splitAll(raw, seamLines);
  }

  // ---- cells
  const cells = [];
  for (const poly of raw) {
    const c = centroid(poly);
    let best = null;
    for (const part of parts) {
      if (!inside(part.vol, c)) continue;
      const u = uAt(part, c);
      if (!isFinite(u)) continue;
      const z = zOf(part.vol, u);
      if (!best || z > best.z + 1e-9) best = { part, z };
    }
    if (!best) continue;
    const { part } = best;
    const vol = part.vol;
    const zAt = (p) => zOf(vol, Math.max(0, uAt(part, p) || 0));
    const uOf = (p) => Math.max(0, uAt(part, p) || 0);
    // section bands need the cell's own u range, not the volume's
    const uTop = Math.max(0, ...poly.map((p) => uOf(p)));
    let active = null, bestU = Infinity;
    for (const pl of part.planes) {
      if (!pl.applies(c)) continue;
      const v = pl.u(c);
      if (v < bestU) { bestU = v; active = pl; }
    }
    cells.push({
      poly, centroid: c, volume: vol, part, plane: active ? active.id : null,
      uMin: bestU, uMax: uTop, zAt, uOf,
    });
  }

  // ---- shared cell edges: creases, steps, and the seams of raised volumes
  const edgeMap = new Map();
  for (const cell of cells) {
    for (let i = 0; i < cell.poly.length; i++) {
      const a = cell.poly[i], b = cell.poly[(i + 1) % cell.poly.length];
      if (dist2(a, b) < 1e-5) continue;
      const k = edgeKey(a, b);
      if (!edgeMap.has(k)) edgeMap.set(k, { a, b, cells: [] });
      edgeMap.get(k).cells.push(cell);
    }
  }

  const creases = [];
  const verticals = [];
  // A gable end may only close a slope that still has run left in it. If the
  // nearest eave has already passed its run, the "gable" would be a wall under
  // a runaway plane: refuse it and say what it would have become.
  const issues = [];
  const gableSeen = new Set();
  for (const [, e] of edgeMap) {
    if (e.cells.length > 1) {
      const [ca, cb] = e.cells;
      const mid = lerp2(e.a, e.b, 0.5);
      // Heights are sampled at the ends, never at the midpoint: a hip or a valley
      // climbs along its length, and a midpoint height would draw it level.
      const zaA = ca.zAt(e.a), zbA = cb.zAt(e.a);
      const zaB = ca.zAt(e.b), zbB = cb.zAt(e.b);
      const hiA = Math.max(zaA, zbA), hiB = Math.max(zaB, zbB);
      const loA = Math.min(zaA, zbA), loB = Math.min(zaB, zbB);
      if (Math.abs((zaA + zaB) - (zbA + zbB)) > 0.02) {
        const higher = zaA + zaB > zbA + zbB ? ca : cb;
        const lower = zaA + zaB > zbA + zbB ? cb : ca;
        const kind = stepKind(higher, lower, mid);
        verticals.push({
          quad: [[e.a[0], loA, e.a[1]], [e.b[0], loB, e.b[1]], [e.b[0], hiB, e.b[1]], [e.a[0], hiA, e.a[1]]],
          kind: kind === 'abutment' ? 'step' : 'cheek',
          volume: higher.volume,
        });
        // the foot of a raised volume is where it meets the roof: a valley; at a gable, an abutment
        creases.push({
          kind: kind === 'abutment' ? 'abutment' : 'valley',
          a3: [e.a[0], loA, e.a[1]], b3: [e.b[0], loB, e.b[1]],
          length: dist2(e.a, e.b),
          at: [mid[0], (loA + loB) / 2, mid[1]],
          volumes: [ca.volume.id, cb.volume.id],
          foot: true,
        });
        continue;
      }
      if (!ca.plane || !cb.plane) continue;
      if (ca.plane === cb.plane && ca.volume.id === cb.volume.id) continue;
      const kind = classifySeam(ca, cb, e.a, e.b, roofs);
      if (!kind) continue;
      creases.push({
        kind,
        a3: [e.a[0], hiA, e.a[1]], b3: [e.b[0], hiB, e.b[1]],
        length: dist2(e.a, e.b),
        at: [mid[0], (hiA + hiB) / 2, mid[1]],
        volumes: [ca.volume.id, cb.volume.id],
      });
      continue;
    }
    const cell = e.cells[0];
    const mid = lerp2(e.a, e.b, 0.5);
    const za = cell.zAt(e.a), zb = cell.zAt(e.b);
    const edge = boundaryEave(cell.volume, mid);
    const kind = edge ? (edge.kind === 'open' ? 'open' : edge.kind) : (cell.volume.isFeature ? 'valley' : 'eave');
    if (kind === 'gable') {
      const uTop = Math.max(cell.uOf(e.a), cell.uOf(e.b));
      // `run` is the distance from the eave to where the slope is meant to stop,
      // so a gable end may only stand where that line is: within 2% of one run.
      // Past it the wall would close a slope that never reached a ridge.
      const wallTop = zOf(cell.volume, uTop);
      if (uTop > 1.02) {
        const plane = cell.part.planes.find((p) => p.id === cell.plane);
        // one refusal per gable end, not one per cell that happens to see it
        const key = `${cell.volume.id}:${edge ? edge.id : 'none'}`;
        if (!gableSeen.has(key)) {
          gableSeen.add(key);
          const run = plane ? plane.eave.run : null;
          issues.push({
            kind: 'gable-unbounded',
            volume: cell.volume.id,
            edge: edge ? edge.id : null,
            u: uTop,
            peak: wallTop,
            text: `This end cannot be a gable: it has no eave opposite, so the slope runs ${uTop.toFixed(1)}× its ${run === null ? 'own' : `${run.toFixed(1)} m`} run and reaches ${wallTop.toFixed(1)} m at this wall.`,
            fix: run === null
              ? 'Give the opposite side an eave.'
              : `Give the opposite side an eave, or lengthen that run to ${(uTop * run).toFixed(1)} m so this end closes in one rise.`,
          });
        }
      }
      verticals.push({
        quad: [[e.a[0], cell.volume.eaveZ, e.a[1]], [e.b[0], cell.volume.eaveZ, e.b[1]], [e.b[0], zb, e.b[1]], [e.a[0], za, e.a[1]]],
        kind: 'gable',
        volume: cell.volume,
      });
    } else if (kind === 'eave') {
      const d = 0.16;
      verticals.push({
        quad: [[e.a[0], za - d, e.a[1]], [e.b[0], zb - d, e.b[1]], [e.b[0], zb, e.b[1]], [e.a[0], za, e.a[1]]],
        kind: 'fascia',
        volume: cell.volume,
      });
    }
  }

  // ---- render patches: straight cells as they are, curved sections banded in u
  const patches = [];
  for (const cell of cells) {
    const vol = cell.volume;
    if (sectionIsStraight(vol.section)) {
      patches.push({ ...cell, poly3: cell.poly.map((p) => [p[0], cell.zAt(p), p[1]]) });
      continue;
    }
    const plane = vol.allEaves.find((x) => x.id === cell.plane);
    if (!plane) { patches.push({ ...cell, poly3: cell.poly.map((p) => [p[0], cell.zAt(p), p[1]]) }); continue; }
    const bands = 9;
    const c0 = dot(plane.n, plane.a);
    const levels = [0];
    for (const bp of sectionCreasePoints(vol.section)) levels.push(bp.u);
    levels.push(Math.max(cell.uMax, 0.001));
    levels.sort((a, b) => a - b);
    for (let li = 1; li < levels.length; li++) {
      const uLo = levels[li - 1], uHi = levels[li];
      for (let b = 0; b < bands; b++) {
        const a0 = uLo + ((uHi - uLo) * b) / bands;
        const a1 = uLo + ((uHi - uLo) * (b + 1)) / bands;
        let poly = clipConvex(cell.poly, plane.n, c0 + a1 * plane.run);
        if (poly.length < 3) continue;
        poly = clipConvex(poly, mul(plane.n, -1), -(c0 + a0 * plane.run));
        if (poly.length < 3) continue;
        patches.push({ ...cell, poly, poly3: poly.map((p) => [p[0], cell.zAt(p), p[1]]), band: true });
      }
    }
  }

  // ---- section creases: a gambrel break is a real line, whatever the plan field does
  for (const cell of cells) {
    const breaks = sectionCreasePoints(cell.volume.section);
    if (!breaks.length) continue;
    const plane = cell.volume.allEaves.find((x) => x.id === cell.plane);
    if (!plane) continue;
    for (const bp of breaks) {
      const c = dot(plane.n, plane.a) + bp.u * plane.run;
      const seg = isoLine(cell.poly, plane.n, c);
      if (!seg) continue;
      const z = zOf(cell.volume, bp.u);
      creases.push({
        kind: 'crease',
        a3: [seg[0][0], z, seg[0][1]], b3: [seg[1][0], z, seg[1][1]],
        length: dist2(seg[0], seg[1]), at: [seg[0][0], z, seg[0][1]],
        volumes: [cell.volume.id],
      });
    }
  }

  // ---- wall skirts
  const skirts = [];
  for (const r of roofs) {
    for (const poly of [r.outline, ...r.holes]) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if (dist2(a, b) < 1e-4) continue;
        skirts.push({
          quad: [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], r.eaveZ, b[1]], [a[0], r.eaveZ, a[1]]],
          kind: 'wall',
        });
      }
    }
  }

  const counts = { ridge: 0, hip: 0, valley: 0, crease: 0, abutment: 0 };
  for (const c of creases) counts[c.kind] = (counts[c.kind] || 0) + 1;
  const lengthBy = (kind) => creases.filter((c) => c.kind === kind).reduce((n, c) => n + c.length, 0);

  const stats = {
    ms: now() - t0,
    cells: cells.length,
    patches: patches.length,
    lines: intrinsic.length + seamLines.length,
    eaves: parts.reduce((n, p) => n + p.planes.length, 0),
    counts,
    lengths: { ridge: lengthBy('ridge'), hip: lengthBy('hip'), valley: lengthBy('valley') },
    peak: cells.reduce((m, c) => Math.max(m, ...c.poly.map((p) => c.zAt(p))), 0),
    curvedMeet,
  };

  return { roofs, cells, patches, creases, verticals, skirts, issues, stats };

  // ------------------------------------------------------------------ helpers

  function stepKind(higher, lower, p) {
    const kind = boundaryKind(higher.volume, p);
    if (kind === 'gable') return 'abutment';
    if (higher.volume.isFeature) return 'valley';
    return 'abutment';
  }

  function boundaryEave(vol, p) {
    let best = null, bestD = Infinity;
    for (const e of vol.allEaves) {
      const d = pointSegDist(p, e.a, e.b);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best && bestD < 0.02 ? best : null;
  }

  function boundaryKind(vol, p) {
    const e = boundaryEave(vol, p);
    if (!e) return vol.isFeature ? 'valley' : 'eave';
    return e.kind === 'open' ? 'open' : e.kind;
  }
}

// A gable end is legal only where a slope reaches it inside its authored run.
// Rather than draw a wall under a plane that has run past its pitch, drop the
// gable and say so. The rule lives with the field that refutes it, and it is one
// call for both users: the chip asks before committing, the scene asks on every
// state the UI can reach (a plan switch, a dropped run, a stale gable).
// `specFor(gables)` rebuilds a spec with the surviving ends.
export function settleGables(specFor, gables) {
  let kept = { ...gables };
  let built = buildRoofs([specFor(kept)]);
  const revoked = [];
  const unbounded = (b) => b.issues.filter((i) => i.kind === 'gable-unbounded');
  while (unbounded(built).length) {
    let fix = null;
    for (const k of Object.keys(kept)) {
      const trial = { ...kept };
      delete trial[k];
      const b = buildRoofs([specFor(trial)]);
      if (unbounded(b).length < unbounded(built).length) { fix = { k, b }; break; }
    }
    if (!fix) break;
    revoked.push({ edgeIndex: Number(fix.k), issue: unbounded(built)[0] });
    delete kept[fix.k];
    built = fix.b;
  }
  return { built, revoked };
}

// A refusal has two tenses: the cause the field reports, and what is drawn in its
// place. Both are the rule's words, so a scene cannot re-word half of it.
export function asDrawn(issue) {
  return `${issue.text} It is drawn as an eave instead.`;
}

function isoLine(poly, n, c) {
  const pts = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = dot(n, a) - c, db = dot(n, b) - c;
    if (Math.abs(da) < 1e-9) pts.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) pts.push(lerp2(a, b, da / (da - db)));
  }
  if (pts.length < 2) return null;
  let best = null, bestD = -1;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = dist2(pts[i], pts[j]);
    if (d > bestD) { bestD = d; best = [pts[i], pts[j]]; }
  }
  return bestD > 1e-4 ? best : null;
}

function classifySeam(ca, cb, a, b, roofs) {
  const mid = lerp2(a, b, 0.5);
  const dir = norm(sub(b, a));
  const per = [-dir[1], dir[0]];
  const eps = 0.07;
  const zm = (ca.zAt(mid) + cb.zAt(mid)) / 2;
  const za = ca.zAt(add(mid, mul(per, eps)));
  const zb = cb.zAt(add(mid, mul(per, -eps)));
  const fold = (za - zm) + (zb - zm);
  const level = Math.abs(ca.zAt(a) - ca.zAt(b)) < 0.02;
  if (ca.volume.id === cb.volume.id && reflexPair(ca, cb, roofs)) return 'valley';
  if (fold > 0.002) return 'valley';
  return level ? 'ridge' : 'hip';
}

const reflexCache = new WeakMap();

function reflexPair(ca, cb, roofs) {
  const roof = roofs.find((r) => r.id === ca.volume.id);
  if (!roof) return false;
  let set = reflexCache.get(roof);
  if (!set) {
    set = new Set();
    const es = roof.eaves;
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const A = es[i], B = es[j];
        let shared = -1;
        if (dist2(A.b, B.a) < 1e-6) shared = (A.edgeIndex + 1) % roof.outline.length;
        else if (dist2(A.a, B.b) < 1e-6) shared = A.edgeIndex;
        if (shared < 0) continue;
        if (isReflex(roof.outline, shared)) set.add([A.id, B.id].sort().join('~'));
      }
    }
    reflexCache.set(roof, set);
  }
  return set.has([ca.plane, cb.plane].sort().join('~'));
}
