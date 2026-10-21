// "One pen, read aloud": the same stroke means different things depending on where it was drawn.
// Every reading is an op; the first is applied, the rest are one tap away and amend the same undo step.
import { V2, dist, polyArea, ensureCCW, interiorPoint, pointInPoly, pointInPolyHoles, circlePoly, polyCentroid, fmtM, lerp2 } from './geom2d';
import { overlapArea, P, intersection, mpolyArea } from './clip';
import type { Project, Tie, SurfaceRef, RoomSeed } from './types';
import { newId } from './types';
import type { StrokeFit } from './strokes';
import { readOpeningStroke } from './strokes';
import type { Derived, Snap } from './derive';
import { floorUnder, stairMode, wallTopAt, elementName } from './derive';
import {
  Op, opAddRun, opAddRunTouching, opExtendRun, opAddOverhead, opAddDeck, opAddVoid, opAddStair, opAddOpening, bridgeOutline, makeRun, nextName,
} from './ops';
import { runGeom, pointAtT } from './runs';
import { lvl, stairSteps, roomTop, surfaceY } from './settle';
import { ohCovers } from './overheadGeom';

export interface Magnet {
  run: string;
  t: number;
  p: V2;
  node: 'A' | 'B' | null; // an open end of that wall
}

export interface Reading {
  id: string;
  label: string;
  detail: string;
  op: Op;
}

export interface ReadCtx {
  p: Project;
  d: Derived;
  plane: { y: number; onSheet: boolean; surface: SurfaceRef | null; surfaceName: string };
  fit: StrokeFit;
  rawFit: StrokeFit;
  plan: V2[];
  magA: Magnet | null;
  magB: Magnet | null;
  wallFace: { run: string; sy: V2[] } | null;
  stairTo: { y: number; ref: SurfaceRef; name: string; at: V2 } | null;
  onRoof: string | null;
  sheetSnap: Snap | null;
}

const tieOf = (m: Magnet | null): Tie | null => (m ? { host: m.run, t: m.t } : null);
/** Snapped ends only touch; joining is offered after, in the same step. */
const touchTxt = (p: Project, c: ReadCtx) => {
  const hosts = [...new Set([c.magA, c.magB].filter((m): m is Magnet => !!m).map((m) => elementName(p, m.run)))];
  return hosts.length ? ` · touching ${hosts.join(' and ')}` : '';
};

/** Create a room seed ahead of settle so a reading can give the new room its character in the same step. */
function preseed(p: Project, poly: V2[], level: number, props: Partial<RoomSeed>) {
  const pl = ensureCCW(poly);
  p.rooms.push({
    id: newId(p, 'm'), kind: 'room', name: props.name ?? nextName(p, 'Room'), level, floorY: level, height: 3, ceiling: 'flat',
    dormant: false, customized: true, inheritedFrom: null, poly: pl, holes: [], at: interiorPoint(pl), order: 0, ...props,
  });
}

function fitPoly(f: StrokeFit): V2[] {
  if (f.kind === 'circle') return circlePoly(f.center, f.radius, 64);
  const out: V2[] = [];
  const n = f.closed ? f.pts.length : f.pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length];
    const k = f.bulge[i] ?? 0;
    if (Math.abs(k) < 1e-4) out.push(a);
    else {
      // reuse run flattening
      const tmp = { shape: 'path', pts: [a, b], bulge: [k], closed: false } as any;
      const g = runGeom({ ...tmp, id: 'tmp', kind: 'run', center: [0, 0], radius: 0, baseY: 0, thick: 0, top: null, tieA: null, tieB: null, order: 0 });
      out.push(...g.ps.pts.slice(0, -1));
    }
  }
  if (!f.closed) out.push(f.pts[f.pts.length - 1]);
  return out;
}

export function fitOutline(f: StrokeFit) {
  return ensureCCW(fitPoly(f));
}

function withMagnets(f: StrokeFit, a: Magnet | null, b: Magnet | null): StrokeFit {
  if (f.kind !== 'open') return f;
  const pts = f.pts.slice();
  if (a) pts[0] = a.p;
  if (b) pts[pts.length - 1] = b.p;
  return { ...f, pts };
}

function roomsUnder(d: Derived, outline: V2[], level?: number) {
  return d.rooms.filter((r) => (level === undefined || Math.abs(r.level - level) < 0.05) && overlapArea(r.poly, outline) > 0.25 * Math.min(r.area, Math.abs(polyArea(outline))));
}

export function readStroke(c: ReadCtx): Reading[] {
  const { p, d, fit } = c;
  const out: Reading[] = [];

  // ---- drawn on a wall face: an opening
  if (c.wallFace) {
    const ro = readOpeningStroke(c.wallFace.sy);
    const run = p.runs.find((r) => r.id === c.wallFace!.run);
    if (!ro || !run) return out;
    const w = d.walls.get(run.id)!;
    const s = ro.s;
    const pc = w.pieces.find((x) => s >= x.s0 && s <= x.s1);
    const floors = pc ? [pc.left, pc.right].map((id) => (id ? d.roomById.get(id)?.floorY : undefined)).filter((x): x is number => x !== undefined) : [];
    const floor = floors.length ? Math.max(...floors) : run.baseY;
    // an open ∩ whose feet come down near the floor is a doorway, even if the hand stopped short
    const sy = c.wallFace.sy;
    const feetLow = sy.length > 3 && dist(sy[0], sy[sy.length - 1]) > 0.3 && Math.max(sy[0][1], sy[sy.length - 1][1]) - floor < 0.9;
    let sill = Math.max(0, ro.sill - floor);
    if (sill < 0.35 || (feetLow && ro.shape !== 'round')) sill = 0;
    const wallTop = wallTopAt(w, s) - floor;
    let height = Math.max(sill + 0.5, ro.top - floor);
    const capped = height > wallTop - 0.2;
    if (capped) height = Math.max(sill + 0.5, wallTop - 0.25);
    const wallName = run.name ?? (pc?.left ? `${d.roomById.get(pc.left)?.name ?? ''} wall` : 'the wall');
    const base = { width: Math.max(0.5, ro.width), sill, height };
    const mk = (shape: 'rect' | 'arch' | 'round' | 'pointed', label: string): Reading => ({
      id: `opening-${shape}`, label, detail: `${base.width.toFixed(1)} × ${(height - sill).toFixed(1)} m in ${wallName}${capped ? ' · kept below the wall top' : ''}`,
      op: opAddOpening(run.id, s, { ...base, shape, rise: shape === 'round' ? base.width / 2 : ro.rise || base.width / 2 }),
    });
    const door = sill === 0;
    const order: ('rect' | 'arch' | 'round' | 'pointed')[] = [ro.shape, ...(['arch', 'rect', 'round', 'pointed'] as const).filter((x) => x !== ro.shape)];
    for (const sh of order) {
      const label = sh === 'arch' ? (door ? 'Arched opening' : 'Arched window') : sh === 'rect' ? (door ? 'Doorway' : 'Window') : sh === 'round' ? 'Round window' : 'Pointed arch';
      out.push(mk(sh, label));
    }
    return out;
  }

  if (fit.kind === 'tap') return out;
  const y = c.plane.y;
  const level = c.plane.surface?.kind === 'room' ? (p.rooms.find((r) => r.id === (c.plane.surface as any).id)?.level ?? 0) : c.plane.surface?.kind === 'deck' ? y : c.plane.onSheet ? y : 0;

  // ---- drawn from one floor to another: a stair or ramp
  if (c.stairTo && fit.kind === 'open' && Math.abs(c.stairTo.y - y) > 0.35) {
    const from = c.plane.surface ?? { kind: 'ground', y: 0 };
    const path = fitPoly(c.rawFit.kind === 'open' ? c.rawFit : fit);
    path[path.length - 1] = c.stairTo.at;
    let L = 0;
    for (let i = 1; i < path.length; i++) L += dist(path[i - 1], path[i]);
    const rise = Math.abs(c.stairTo.y - y);
    const n = stairSteps(y, c.stairTo.y);
    const steep = L / n < 0.24;
    const curved = c.rawFit.curved;
    const desc = `${c.plane.surfaceName} → ${c.stairTo.name}`;
    const stair: Reading = {
      id: 'stair', label: curved ? 'Curving stair' : 'Stair',
      detail: `${desc} · ${n} steps${steep ? ` · steep — needs ${fmtM(n * 0.28 - L)} more` : ''}`,
      op: opAddStair(path, from, c.stairTo.ref, y, c.stairTo.y, 'stair'),
    };
    const ramp: Reading = { id: 'ramp', label: 'Ramp', detail: `${desc} · 1:${(L / rise).toFixed(0)}`, op: opAddStair(path, from, c.stairTo.ref, y, c.stairTo.y, 'ramp') };
    if (rise < 0.9 && L / rise >= 8) out.push(ramp, stair);
    else out.push(stair, ramp);
  }

  // ---- drawn on a roof: skylights and lightwells
  if (c.onRoof && fit.kind !== 'open') {
    const oh = p.overheads.find((x) => x.id === c.onRoof)!;
    const outline = fitOutline(fit);
    const ctr = polyCentroid(outline);
    const room = d.rooms.find((r) => pointInPolyHoles(ctr, r.poly, r.holes) && r.floorY < oh.baseY);
    const below = floorUnder(p, d, ctr, oh.baseY - 0.2);
    out.push({
      id: 'skylight', label: 'Skylight', detail: room ? `light into ${room.name}` : `through ${oh.name}`,
      op: opAddVoid(outline, room ? room.topY - 0.06 : oh.baseY - 0.3, 999, nextName(p, 'Skylight')),
    });
    out.push({
      id: 'lightwell', label: 'Lightwell', detail: `from the sky down to ${below.name}`,
      op: opAddVoid(outline, below.y + 0.01, 999, nextName(p, 'Lightwell')),
    });
  }

  const outline = fit.kind === 'open' ? null : fitOutline(fit);
  const areaTxt = outline ? `${Math.abs(polyArea(outline)).toFixed(0)} m²` : '';
  const LTxt = fmtM(fit.length);

  if (!c.plane.onSheet) {
    // ---- on the ground (or a floor)
    const baseY = c.plane.surface?.kind === 'deck' ? y : level;
    if (fit.kind === 'circle') {
      const poly = circlePoly(fit.center, fit.radius, 64);
      out.push({ id: 'round-room', label: 'Round room', detail: `one round wall · ${fmtM(fit.radius * 2)} across`, op: opAddRun(fit, { baseY }) });
      out.push({
        id: 'round-plinth', label: 'Round platform', detail: 'a raised floor, 0.6 m',
        op: (q) => {
          makeRun(q, fit, { baseY, top: 0.6, thick: 0.3 });
          preseed(q, poly, baseY, { name: nextName(q, 'Platform'), floorY: baseY + 0.6, height: 3 });
        },
      });
      out.push({ id: 'round-canopy', label: 'Round canopy', detail: 'shade above, drawn by its shadow', op: opAddOverhead(poly, baseY + 3, { form: 'revolve', name: nextName(p, 'Canopy') }) });
    } else if (fit.kind === 'closed' && outline) {
      const enclosing = d.rooms.find((r) => Math.abs(r.level - baseY) < 0.05 && overlapArea(r.poly, outline) > 0.85 * Math.abs(polyArea(outline)));
      out.push({ id: 'room', label: enclosing ? `Room inside ${enclosing.name}` : 'Room', detail: `walls around · ${areaTxt}`, op: opAddRun(fit, { baseY }) });
      out.push({
        id: 'plinth', label: 'Raised floor', detail: 'a plinth, 0.6 m up',
        op: (q) => {
          makeRun(q, fit, { baseY, top: 0.6, thick: 0.3 });
          preseed(q, outline, baseY, { name: nextName(q, 'Platform'), floorY: baseY + 0.6, height: 3 });
        },
      });
      out.push({
        id: 'sunken', label: 'Sunken court', detail: 'dropped 1.2 m into the ground',
        op: (q) => {
          makeRun(q, fit, { baseY, top: 0, thick: 0.3 });
          preseed(q, outline, baseY, { name: nextName(q, 'Court'), floorY: baseY - 1.2, height: 4.2 });
        },
      });
      out.push({ id: 'canopy', label: 'Canopy', detail: 'shade 3 m above, drawn by its shadow', op: opAddOverhead(outline, baseY + 3, { name: nextName(p, 'Canopy') }) });
      out.push({ id: 'freehand', label: 'Room, as drawn', detail: 'keep the wobble', op: opAddRun(c.rawFit, { baseY }) });
    } else if (fit.kind === 'open') {
      const f = withMagnets(fit, c.magA, c.magB);
      const raw = withMagnets(c.rawFit, c.magA, c.magB);
      const cont = c.magA?.node && !c.magB ? c.magA : null;
      const contB = !cont && c.magB?.node && !c.magA ? c.magB : null;
      // divider?
      let divides: string | null = null;
      if (c.magA && c.magB) {
        const mid = fitPoly(f)[Math.floor(fitPoly(f).length / 2)];
        const mm = lerp2(f.pts[0], f.pts[f.pts.length - 1], 0.5);
        const r = d.rooms.find((x) => pointInPolyHoles(mid, x.poly, x.holes) || pointInPolyHoles(mm, x.poly, x.holes));
        if (r) divides = r.name;
      }
      if (cont) {
        out.push({ id: 'continue', label: 'Continue the wall', detail: `one continuous wall · +${LTxt}`, op: opExtendRun(cont.run, cont.node!, f, null) });
      } else if (contB) {
        const rev = { ...f, pts: f.pts.slice().reverse(), bulge: f.bulge.slice().reverse().map((b) => -b) };
        out.push({ id: 'continue', label: 'Continue the wall', detail: `one continuous wall · +${LTxt}`, op: opExtendRun(contB.run, contB.node!, rev, null) });
      }
      const label = divides ? `Wall dividing ${divides}` : fit.curved ? 'Curved wall' : 'Wall';
      out.push({ id: 'wall', label, detail: `${LTxt}${touchTxt(p, c)}`, op: opAddRunTouching(f, { baseY }, tieOf(c.magA), tieOf(c.magB)) });
      out.push({ id: 'low-wall', label: 'Low wall', detail: `${LTxt} · 1.1 m tall`, op: opAddRunTouching(f, { baseY, top: 1.1 }, tieOf(c.magA), tieOf(c.magB)) });
      out.push({ id: 'freehand', label: 'Wall, as drawn', detail: 'keep the wobble', op: opAddRunTouching(raw, { baseY }, tieOf(c.magA), tieOf(c.magB)) });
    }
    return out;
  }

  // ---- on the sheet, in the air
  const snapRooms = c.sheetSnap?.kind === 'top' ? c.sheetSnap.ids.filter((id) => d.roomById.has(id)) : [];
  if (fit.kind === 'open') {
    const pathPts = fitPoly(fit);
    const deckHere = p.decks.find((dk) => Math.abs(dk.y - y) < 0.06 && pathPts.filter((q) => pointInPoly(q, dk.outline)).length > pathPts.length * 0.6);
    const f = withMagnets(fit, c.magA, c.magB);
    if (deckHere) out.push({ id: 'deck-wall', label: `Wall on ${deckHere.name}`, detail: LTxt, op: opAddRunTouching(f, { baseY: y }, tieOf(c.magA), tieOf(c.magB)) });
    out.push({ id: 'bridge', label: 'Bridge', detail: `a 2 m walkway at ${fmtM(y)} · ${LTxt}`, op: opAddDeck(bridgeOutline(pathPts, 2), y, { bridge: true }) });
    if (!deckHere) out.push({ id: 'air-wall', label: 'Wall at this height', detail: `standing at ${fmtM(y)}`, op: opAddRunTouching(f, { baseY: y }, tieOf(c.magA), tieOf(c.magB)) });
    return out;
  }
  if (!outline) return out;
  const A = Math.abs(polyArea(outline));
  const under = roomsUnder(d, outline);
  const insideRooms = under.filter((r) => r.topY > y + 0.3 && r.floorY < y - 1.0);
  const deckHere = p.decks.find((dk) => Math.abs(dk.y - y) < 0.06 && overlapArea(dk.outline, outline) > 0.6 * A);
  const overThings = p.decks.some((dk) => dk.y <= y + 0.05 && overlapArea(dk.outline, outline) > 0.2 * A) || p.overheads.some((oh) => oh.baseY >= y - 0.5 && overlapArea(oh.outline, outline) > 0.2 * A) || under.some((r) => r.coveredBy);
  const tiedRooms = snapRooms.filter((id) => under.some((r) => r.id === id));
  // name a roof after the top storey it covers, not every room stacked beneath it
  const topY = Math.max(...under.map((r) => (r.topY <= y + 0.3 ? r.topY : -Infinity)));
  const named = under.filter((r) => r.topY <= y + 0.3 && r.topY > topY - 0.3);
  const nameRooms = named.length ? named : under;
  const roofName = under.length ? `Roof over ${nameRooms.slice(0, 2).map((r) => r.name).join(' & ')}${nameRooms.length > 2 ? '…' : ''}` : 'Canopy';
  const roof: Reading = {
    id: 'roof', label: roofName,
    detail: `${tiedRooms.length ? 'resting on ' + tiedRooms.map((id) => d.roomById.get(id)!.name).join(', ') + ' (tied)' : under.length ? 'free above the rooms' : 'shade, drawn by its shadow'} · ${areaTxt}`,
    op: opAddOverhead(outline, y, { restsOn: tiedRooms.length ? tiedRooms : null, name: under.length ? undefined : nextName(p, 'Canopy') }),
  };
  const deckRest = snapRooms.find((id) => {
    const r = d.roomById.get(id);
    return r && overlapArea(r.poly, outline) > 0.5 * A;
  });
  const deck: Reading = {
    id: 'deck', label: insideRooms.length ? `Mezzanine in ${insideRooms[0].name}` : 'Floor in the air',
    detail: `${fmtM(y)} up${deckRest ? ' · resting on ' + d.roomById.get(deckRest)!.name + ' (tied)' : ''} · ${areaTxt}`,
    op: opAddDeck(outline, y, { restsOn: deckRest ?? null }),
  };
  const below = floorUnder(p, d, polyCentroid(outline), y - 0.3);
  const atrium: Reading = { id: 'atrium', label: 'Opening through floors', detail: `an atrium from ${below.name} up to ${fmtM(y)}`, op: opAddVoid(outline, below.y + 0.01, y + 0.06, nextName(p, 'Atrium')) };
  const lightwell: Reading = { id: 'lightwell', label: 'Lightwell', detail: `open to the sky, down to ${below.name}`, op: opAddVoid(outline, below.y + 0.01, 999, nextName(p, 'Lightwell')) };
  if (deckHere) {
    out.push({ id: 'upper-room', label: `Room on ${deckHere.name}`, detail: `walls around · ${areaTxt}`, op: opAddRun(fit, { baseY: y }) });
    out.push(atrium, lightwell, roof);
  } else if (insideRooms.length) {
    out.push(deck, roof);
    if (overThings) out.push(lightwell, atrium);
  } else {
    out.push(roof, deck);
    if (overThings) out.push(lightwell, atrium);
  }
  return out;
}

/** Find a magnet near a plan point: open wall ends first (to continue or join them), then the nearest wall. */
export function findMagnet(p: Project, at: V2, level: number, radius: number, exclude?: string): Magnet | null {
  const runs = p.runs.filter((r) => r.id !== exclude && Math.abs(lvl(r.baseY) - lvl(level)) < 0.04);
  let end: Magnet | null = null, ed = radius * 1.3;
  for (const r of runs) {
    if (r.shape !== 'path' || r.closed) continue;
    for (const k of ['A', 'B'] as const) {
      const q = k === 'A' ? r.pts[0] : r.pts[r.pts.length - 1];
      const dd = dist(q, at);
      if (dd < ed) {
        ed = dd;
        const tie = k === 'A' ? r.tieA : r.tieB;
        end = { run: r.id, t: k === 'A' ? 0 : 1, p: q, node: tie ? null : k };
      }
    }
  }
  if (end) return end;
  let best: Magnet | null = null, bd = radius;
  for (const r of runs) {
    const g = runGeom(r);
    for (let i = 0; i + 1 < g.ps.pts.length; i++) {
      const a = g.ps.pts[i], b = g.ps.pts[i + 1];
      const ab: V2 = [b[0] - a[0], b[1] - a[1]];
      const l2 = ab[0] * ab[0] + ab[1] * ab[1];
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((at[0] - a[0]) * ab[0] + (at[1] - a[1]) * ab[1]) / l2)) : 0;
      const q: V2 = [a[0] + ab[0] * t, a[1] + ab[1] * t];
      const dd = dist(q, at);
      if (dd < bd) {
        bd = dd;
        const s = g.ps.s[i] + t * (g.ps.s[i + 1] - g.ps.s[i]);
        best = { run: r.id, t: g.L > 0 ? s / g.L : 0, p: q, node: null };
      }
    }
  }
  return best;
}
