// Blue-pencil handles: what you can grab on the thing you selected, and what each one does.
import * as THREE from 'three';
import { store } from '../store';
import type { Stage } from './stage';
import { derive, Derived, wallTopAt, wallBottomAt } from '../model/derive';
import type { Project, Run } from '../model/types';
import { findEl } from '../model/types';
import { V2, add, sub, mul, dist, norm, perp, dot, polyCentroid, bbox, fmtM, inPeople, round, arcInfo, bulgeFromSagitta, lerp2, pointAtS } from '../model/geom2d';
import { runGeom, pointAtT, closestOnRun } from '../model/runs';
import {
  Op, opMoveNode, opBend, opRadius, opMoveRun, opRunTop, opRoom, opOpening, opOverhead, opDeck, opVoid, opStair, opScaleAll, opObj,
} from '../model/ops';
import { snapPoint, Guide } from '../model/snap';
import type { Tie } from '../model/types';
import { ohTopAt, ohSection, ohFrame, maxRise, moveProfilePoint, profilePeak, movePeak, profileShoulder, ensureShoulder, pullShoulder, profileSymmetric } from '../model/overheadGeom';
import { lvl } from '../model/settle';

export type DragMode = { type: 'plan'; y: number } | { type: 'vertical'; at: V2 } | { type: 'surface'; origin: V2; tan: V2; y0: number };

export interface Handle {
  id: string;
  pos: THREE.Vector3;
  shape: 'dot' | 'ring' | 'bead' | 'move';
  mode: DragMode;
  label: string;
  /** given the dragged point, the op to preview/commit and a measurement to show */
  drag: (pt: { plan: V2; y: number }, e: PointerEvent) => { op: Op; measure: string; knot?: V2 | null; guides?: Guide[]; snap?: string; at?: V2; commit?: string } | null;
  title: string;
  /** 'detail' handles stay out of the way until the pointer comes near (or every point is asked for). */
  tier?: 'primary' | 'detail';
}

const snapY = (y: number) => round(y, 0.05);
const snapP = (p: V2, step = 0.05): V2 => [round(p[0], step), round(p[1], step)];

export function handlesFor(stage: Stage, p: Project, d: Derived, sel: string | null): Handle[] {
  // handles belong to Select: in Draw a stroke that starts on a wall's middle or end must draw, never reshape
  if (!sel || store.ui.mode !== 'make' || store.ui.tool !== 'select') return [];
  if (sel === 'building') return buildingHandles(p, d);
  const e = findEl(p, sel);
  if (!e) return [];
  const lift = stage.liftOf(sel);
  const out: Handle[] = [];
  const mpp = stage.mpp();
  const magR = Math.max(0.3, 16 * mpp);
  switch (e.kind) {
    case 'run': {
      const r = e as Run;
      const w = d.walls.get(r.id);
      const g = runGeom(r);
      if (r.shape === 'circle') {
        out.push({
          id: 'center', pos: new THREE.Vector3(r.center[0], r.baseY + 0.05 + lift, r.center[1]), shape: 'move', mode: { type: 'plan', y: r.baseY },
          label: 'move', title: 'Drag to move the round room',
          drag: (pt) => ({ op: opMoveRun(r.id, sub(snapP(pt.plan), r.center)), measure: '' }),
        });
        out.push({
          id: 'radius', pos: new THREE.Vector3(r.center[0] + r.radius, r.baseY + 0.05 + lift, r.center[1]), shape: 'dot', mode: { type: 'plan', y: r.baseY },
          label: 'size', title: 'Drag to make it bigger or smaller — it stays round',
          drag: (pt) => {
            const rr = Math.max(0.6, round(dist(pt.plan, r.center), 0.05));
            return { op: opRadius(r.id, rr), measure: `${fmtM(rr * 2)} across` };
          },
        });
      } else {
        // a few handles that matter by default: ends (and every corner of a simple room); the rest near the pointer
        const simple = r.pts.length <= 4;
        r.pts.forEach((q, i) => {
          const isEnd = !r.closed && (i === 0 || i === r.pts.length - 1);
          out.push({
            tier: isEnd || simple ? 'primary' : 'detail',
            id: `node:${i}`, pos: new THREE.Vector3(q[0], r.baseY + 0.05 + lift, q[1]), shape: 'dot', mode: { type: 'plan', y: r.baseY },
            label: '', title: isEnd ? 'Drag the end — let go on another wall to join it' : 'Drag the corner',
            drag: (pt, ev) => {
              const n = r.pts.length;
              const nb = [r.closed || i > 0 ? r.pts[(i - 1 + n) % n] : null, r.closed || i < n - 1 ? r.pts[(i + 1) % n] : null].filter((q): q is V2 => !!q);
              // snapping moves the point; landing on another wall only offers a join (never ties by itself)
              const s = snapPoint(p, pt.plan, { level: r.baseY, tol: magR, anchors: nb, exclude: r.id, own: r.pts.filter((_, k) => k !== i), free: ev.altKey, fine: ev.shiftKey, walls: isEnd });
              let tie: Tie | null | 'keep' = 'keep';
              let touch: Tie | null = null;
              if (isEnd) {
                const had = i === 0 ? r.tieA : r.tieB;
                if (had && s.touching?.host === had.host) tie = s.touching;
                else if (had) tie = null;
                if (s.touching && s.touching.host !== had?.host) touch = s.touching;
              }
              const prev = nb[0];
              return { op: opMoveNode(r.id, i, s.p, tie, touch), measure: prev ? fmtM(dist(s.p, prev)) : '', knot: s.touching ? s.p : null, guides: s.guides, snap: s.label, at: s.p };
            },
          });
        });
        const nseg = r.closed ? r.pts.length : r.pts.length - 1;
        for (let i = 0; i < nseg; i++) {
          const a = r.pts[i], b = r.pts[(i + 1) % r.pts.length];
          const k = r.bulge[i] ?? 0;
          const mid = Math.abs(k) < 1e-4 ? lerp2(a, b, 0.5) : arcInfo(a, b, k).mid;
          out.push({
            tier: 'detail',
            id: `bend:${i}`, pos: new THREE.Vector3(mid[0], r.baseY + 0.05 + lift, mid[1]), shape: 'ring', mode: { type: 'plan', y: r.baseY },
            label: '', title: 'Drag to bend this stretch of wall (drag back to straighten)',
            drag: (pt) => {
              const c = lerp2(a, b, 0.5);
              const n = perp(norm(sub(b, a)));
              const sg = dot(sub(pt.plan, c), n);
              const kk = bulgeFromSagitta(a, b, sg);
              return { op: opBend(r.id, i, kk), measure: Math.abs(kk) < 0.025 ? 'straight' : `bow ${fmtM(Math.abs(sg))}` };
            },
          });
        }
        const bb = bbox(r.pts);
        const c: V2 = lerp2(bb.min, bb.max, 0.5);
        const near = closestOnRun(r, c).q;
        out.push({
          id: 'move', pos: new THREE.Vector3(near[0], r.baseY + 0.05 + lift, near[1]), shape: 'move', mode: { type: 'plan', y: r.baseY },
          label: 'move', title: 'Drag to move the whole wall',
          drag: (pt) => ({ op: opMoveRun(r.id, snapP(sub(pt.plan, near))), measure: '' }),
        });
      }
      if (w) {
        const s = g.L * (r.shape === 'circle' ? 0.125 : 0.5);
        const q = pointAtS(g.ps, s).p;
        const top = wallTopAt(w, s);
        out.push({
          id: 'top', pos: new THREE.Vector3(q[0], top + lift, q[1]), shape: 'bead', mode: { type: 'vertical', at: q },
          label: r.top === null ? 'height' : 'set height', title: 'Drag to set this wall’s own height (a low wall, a screen)',
          drag: (pt) => {
            const h = Math.max(0.2, snapY(pt.y - r.baseY));
            return { op: opRunTop(r.id, h), measure: `${fmtM(h)} · ${inPeople(h)}` };
          },
        });
      }
      break;
    }
    case 'room': {
      const r = d.roomById.get(e.id);
      if (!r) break;
      const at = r.at;
      out.push({
        id: 'floor', pos: new THREE.Vector3(at[0], r.floorY + 0.06 + lift, at[1]), shape: 'bead', mode: { type: 'vertical', at },
        label: 'floor', title: 'Drag up to raise the floor (a plinth); down to sink it (a court)',
        drag: (pt) => {
          const f = snapY(Math.max(r.level - 4, Math.min(r.level + 4, pt.y)));
          const rel = f - r.level;
          return { op: opRoom(r.id, { floorY: f }), measure: Math.abs(rel) < 0.01 ? 'floor at ground' : `${rel > 0 ? 'raised' : 'sunk'} ${fmtM(Math.abs(rel), 2)}` };
        },
      });
      out.push({
        id: 'ceiling', pos: new THREE.Vector3(at[0], r.topY + lift, at[1]), shape: 'bead', mode: { type: 'vertical', at },
        label: 'ceiling', title: 'Drag to make the room taller or lower',
        drag: (pt) => {
          const h = Math.max(1.9, snapY(pt.y - r.floorY));
          return { op: opRoom(r.id, { height: h }), measure: `${fmtM(h)} · ${inPeople(h)}` };
        },
      });
      break;
    }
    case 'opening': {
      const o = e;
      const w = d.walls.get(o.run);
      const dop = w?.openings.find((x) => x.o.id === o.id);
      if (!w || !dop) break;
      const g = runGeom(w.run);
      const st = pointAtS(g.ps, dop.s);
      const n = perp(st.tan);
      const off = mul(n, w.run.thick / 2 + 0.06);
      const base = add(st.p, off);
      const mode: DragMode = { type: 'surface', origin: st.p, tan: st.tan, y0: 0 };
      const sOf = (pt: { plan: V2 }) => dop.s + dot(sub(pt.plan, st.p), st.tan);
      const L = w.L;
      const P3 = (ds: number, y: number) => {
        const q = add(base, mul(st.tan, ds));
        return new THREE.Vector3(q[0], y + lift, q[1]);
      };
      out.push({
        id: 'slide', pos: P3(0, (dop.y0 + dop.y1) / 2), shape: 'move', mode, label: 'slide', title: 'Slide along the wall',
        drag: (pt) => {
          const s = Math.max(0, Math.min(L, sOf(pt)));
          return { op: opOpening(o.id, { t: s / L }), measure: `${fmtM(s - o.width / 2)} from the end` };
        },
      });
      for (const side of [-1, 1]) {
        out.push({
          tier: side < 0 ? 'detail' : 'primary',
          id: `w${side}`, pos: P3((side * o.width) / 2, (dop.y0 + dop.y1) / 2), shape: 'dot', mode, label: '', title: 'Drag to widen',
          drag: (pt) => {
            const wd = Math.max(0.4, round(Math.abs(sOf(pt) - dop.s) * 2, 0.05));
            return { op: opOpening(o.id, { width: wd }), measure: `${fmtM(wd)} wide` };
          },
        });
      }
      out.push({
        id: 'top', pos: P3(0, dop.y1), shape: 'dot', mode, label: '', title: 'Drag to make it taller',
        drag: (pt) => {
          const h = Math.max(o.sill + 0.4, snapY(pt.y - dop.floor));
          return { op: opOpening(o.id, { height: h }), measure: `${fmtM(h - o.sill)} tall` };
        },
      });
      if (o.shape !== 'round') {
        const rise = o.shape === 'rect' ? 0 : o.rise;
        out.push({
          tier: o.shape === 'rect' ? 'detail' : 'primary',
          id: 'rise', pos: P3(o.width * 0.32, dop.y1 - Math.max(rise, 0.12)), shape: 'ring', mode, label: '', title: 'Drag down to arch the head; back up to square it',
          drag: (pt) => {
            const rr = Math.max(0, Math.min(o.width / 2 + 0.4, dop.y1 - pt.y));
            if (rr < 0.12) return { op: opOpening(o.id, { shape: 'rect', rise: 0 }), measure: 'square head' };
            return { op: opOpening(o.id, { shape: o.shape === 'pointed' ? 'pointed' : 'arch', rise: round(rr, 0.05) }), measure: `arch rises ${fmtM(rr, 2)}` };
          },
        });
      }
      if (o.sill > 0.2 || o.shape === 'round') {
        out.push({
          tier: 'detail',
          id: 'sill', pos: P3(0, dop.y0), shape: 'dot', mode, label: '', title: 'Drag to raise or lower the sill',
          drag: (pt) => {
            const sill = Math.max(0, Math.min(o.height - 0.4, snapY(pt.y - dop.floor)));
            return { op: opOpening(o.id, { sill: sill < 0.2 ? 0 : sill }), measure: sill < 0.2 ? 'down to the floor' : `sill at ${fmtM(sill)}` };
          },
        });
      }
      break;
    }
    case 'overhead':
    case 'deck':
    case 'void': {
      const outline = e.outline;
      const y = e.kind === 'overhead' ? e.baseY : e.kind === 'deck' ? e.y : Math.min(e.toY, d.bounds.top + 0.2);
      const set = (ol: V2[]): Op => (e.kind === 'overhead' ? opOverhead(e.id, { outline: ol }) : e.kind === 'deck' ? opDeck(e.id, { outline: ol }) : opVoid(e.id, { outline: ol }));
      const yAt = (q: V2) => (e.kind === 'overhead' ? ohTopAt(e, q) : y);
      // edges push and pull by default; corners come out as the pointer nears them
      outline.forEach((q, i) => {
        out.push({
          tier: 'detail',
          id: `n:${i}`, pos: new THREE.Vector3(q[0], yAt(q) + 0.04 + lift, q[1]), shape: 'dot', mode: { type: 'plan', y }, label: '', title: 'Drag the corner',
          drag: (pt, ev) => {
            const ol = outline.slice();
            const n = ol.length;
            const s = snapPoint(p, pt.plan, { level: y, tol: magR, anchors: [ol[(i - 1 + n) % n], ol[(i + 1) % n]], own: ol.filter((_, k) => k !== i), free: ev.altKey, fine: ev.shiftKey, anyLevel: true });
            ol[i] = s.p;
            return { op: set(ol), measure: '', guides: s.guides, snap: s.label, at: s.p };
          },
        });
      });
      outline.forEach((q, i) => {
        const b = outline[(i + 1) % outline.length];
        if (dist(q, b) < 0.8 || outline.length > 24) return;
        const mid = lerp2(q, b, 0.5);
        const nn = perp(norm(sub(b, q)));
        out.push({
          id: `e:${i}`, pos: new THREE.Vector3(mid[0], yAt(mid) + 0.04 + lift, mid[1]), shape: 'ring', mode: { type: 'plan', y }, label: '', title: 'Push or pull this edge',
          drag: (pt) => {
            const dd = round(dot(sub(pt.plan, mid), nn), 0.05);
            const ol = outline.slice();
            ol[i] = add(q, mul(nn, dd));
            ol[(i + 1) % outline.length] = add(b, mul(nn, dd));
            return { op: set(ol), measure: `${dd >= 0 ? '+' : ''}${fmtM(-dd)}` };
          },
        });
      });
      const c = polyCentroid(outline);
      if (e.kind === 'overhead') {
        // the eave sits out at a corner, at eave height: it reads as "the whole roof", apart from the peak above the middle
        const k0 = outline.reduce((b, q, i) => (dist(q, c) > dist(outline[b], c) ? i : b), 0);
        const ec = add(outline[k0], mul(norm(sub(outline[k0], c)), 0.6));
        out.push({
          id: 'eave', pos: new THREE.Vector3(ec[0], e.baseY + lift, ec[1]), shape: 'bead', mode: { type: 'vertical', at: ec }, label: 'eave', title: 'Drag to raise or lower the whole roof',
          drag: (pt) => {
            const yy = Math.max(1.0, snapY(pt.y));
            return { op: opOverhead(e.id, { baseY: yy }), measure: `eave at ${fmtM(yy)}` };
          },
        });
        // Sculpting: a peak (up = taller, sideways = lean) and a shoulder on each slope (out = broader, in = pointier).
        // With the eave and the edges (width), that's the whole default vocabulary; the profile's own points come out
        // as the pointer nears them, for precision.
        const sec = ohSection(e);
        const prof = e.profile;
        const pk = profilePeak(prof);
        const flat = pk.h < 0.05;
        const pkU = flat ? 0.5 : pk.u;
        const pkAt = sec.at(pkU, pk.h);
        const off = 0.3;
        out.push({
          id: 'peak', pos: new THREE.Vector3(pkAt.plan[0], pkAt.y + off + lift, pkAt.plan[1]), shape: 'bead',
          mode: { type: 'surface', origin: sec.origin, tan: sec.tan, y0: 0 }, label: flat ? 'pull up' : 'peak',
          title: flat ? 'Pull up to give the roof a peak' : sec.revolve ? 'Drag up or down: taller or flatter' : 'Drag up or down: taller or flatter · sideways: lean the peak',
          drag: (pt) => {
            const r = sec.uh(pt.plan, pt.y - lift);
            const h = Math.max(0, Math.min(maxRise(e), pk.h + snapY(r.h - pk.h - off)));
            const u = pkU + round(r.u - pkU, 0.01);
            const next = movePeak(prof, u, h, !sec.revolve);
            const np = profilePeak(next);
            const lean = !sec.revolve && Math.abs(np.u - pkU) > 0.004 ? ` · peak ${Math.round(np.u * 100)}% across` : '';
            const top = np.h >= maxRise(e) - 0.01 ? ' · as tall as it goes' : '';
            return { op: opOverhead(e.id, { profile: next }), measure: `rises ${fmtM(np.h)}${lean}${top}`, commit: `Reshaped ${e.name}’s peak` };
          },
        });
        // the ridge's ends: pull one in and both ends hip (the slopes come round the end); all the way in, a pyramid
        const fr = ohFrame(e);
        const canHip = !sec.revolve && !flat && pk.i0 > 0 && pk.i1 < prof.length - 1;
        if (canHip) {
          const ea: V2 = [-fr.d[1], fr.d[0]];
          const wr = fr.wmin + pk.u * (fr.wmax - fr.wmin);
          const half = (fr.emax - fr.emin) / 2;
          const ry = pkAt.y + 0.05;
          for (const end of ['A', 'B'] as const) {
            const v = end === 'A' ? fr.emin + fr.hip : fr.emax - fr.hip;
            const q = add(mul(fr.d, wr), mul(ea, v));
            out.push({
              id: `hip:${end}`, pos: new THREE.Vector3(q[0], ry + lift, q[1]), shape: 'ring', mode: { type: 'plan', y: ry }, label: '',
              title: 'Drag along the ridge: in to hip the ends (all the way for a pyramid), out for gable ends',
              drag: (pt) => {
                const along = dot(pt.plan, ea);
                const hip = Math.max(0, Math.min(half, round(end === 'A' ? along - fr.emin : fr.emax - along, 0.05)));
                const word = hip < 0.01 ? 'gable ends' : hip >= half - 0.01 ? 'a point (pyramid)' : `hipped ${fmtM(hip)}`;
                return { op: opOverhead(e.id, { hip }), measure: word, commit: hip < 0.01 ? `Gave ${e.name} gable ends` : `Hipped ${e.name}’s ends` };
              },
            });
          }
        }
        const sym = profileSymmetric(prof);
        const shoulders: { u: number; h: number }[] = [];
        for (const side of sec.revolve ? (['L'] as const) : (['L', 'R'] as const)) {
          const sh = profileShoulder(prof, side);
          if (!sh) continue;
          shoulders.push(sh);
          const a = sec.at(sh.u, sh.h);
          let base: typeof prof | null = null;
          out.push({
            id: `shoulder:${side}`, pos: new THREE.Vector3(a.plan[0], a.y + 0.05 + lift, a.plan[1]), shape: 'ring',
            mode: { type: 'surface', origin: sec.origin, tan: sec.tan, y0: 0 }, label: '',
            title: `Drag sideways: out for a broader roof, in for a pointier one${sym && !sec.revolve ? ' (both sides stay alike)' : ''}`,
            drag: (pt) => {
              // the first pull gives a straight slope its one shoulder point (both slopes, if they mirror)
              if (!base) {
                base = ensureShoulder(prof, side);
                if (sym) base = ensureShoulder(base, side === 'L' ? 'R' : 'L');
              }
              const r = sec.uh(pt.plan, pt.y - lift);
              const du = round(r.u - sh.u, 0.005);
              const outward = side === 'L' ? -du : du;
              const word = outward >= 0 ? 'broader' : 'pointier';
              return { op: opOverhead(e.id, { profile: pullShoulder(base, side, du, sym) }), measure: Math.abs(du) < 0.004 ? '' : word, commit: `Made ${e.name} ${word}` };
            },
          });
        }
        // the profile's own points, on the roof's section: the same points as in the pad (dragging either edits both)
        prof.forEach((q, i) => {
          if (!q.id || (sec.revolve && q.u > 0.5 + 1e-6)) return;
          // a single peak point and a slope's shoulder point already have their big handle
          if (!flat && pk.i0 === pk.i1 && i === pk.i0) return;
          if (shoulders.some((sh) => Math.abs(sh.u - q.u) < 0.03 && Math.abs(sh.h - q.h) < 0.12 * pk.h)) return;
          const a = sec.at(q.u, q.h);
          out.push({
            tier: 'detail', id: `pp:${q.id}`, pos: new THREE.Vector3(a.plan[0], a.y + 0.05 + lift, a.plan[1]), shape: 'dot',
            mode: { type: 'surface', origin: sec.origin, tan: sec.tan, y0: 0 }, label: '', title: 'Drag this point of the section (the same point as in the profile pad)',
            drag: (pt) => {
              const r = sec.uh(pt.plan, pt.y - lift);
              // steps from where it was: a sideways pull never nudges its height
              const h = Math.max(0, Math.min(maxRise(e), q.h + snapY(r.h - q.h)));
              const u = q.u + round(r.u - q.u, 0.005);
              return { op: opOverhead(e.id, { profile: moveProfilePoint(prof, q.id!, u, h) }), measure: `${fmtM(h)} above the eave` };
            },
          });
        });
      } else if (e.kind === 'deck') {
        out.push({
          id: 'height', pos: new THREE.Vector3(c[0], e.y + 0.05 + lift, c[1]), shape: 'bead', mode: { type: 'vertical', at: c }, label: 'level', title: 'Drag to raise or lower this floor',
          drag: (pt) => {
            const yy = Math.max(0.3, snapY(pt.y));
            return { op: opDeck(e.id, { y: yy }), measure: `${fmtM(yy)} up` };
          },
        });
      } else {
        const topY = Math.min(e.toY, d.bounds.top + 0.3);
        out.push({
          id: 'top', pos: new THREE.Vector3(c[0], topY + lift, c[1]), shape: 'bead', mode: { type: 'vertical', at: c }, label: e.toY > 50 ? 'to the sky' : 'top', title: 'Drag down to close the opening from above',
          drag: (pt) => {
            const yy = snapY(pt.y);
            const sky = yy > d.bounds.top - 0.2;
            return { op: opVoid(e.id, { toY: sky ? 999 : Math.max(e.fromY + 0.3, yy) }), measure: sky ? 'open to the sky' : `open up to ${fmtM(yy)}` };
          },
        });
        out.push({
          id: 'bottom', pos: new THREE.Vector3(c[0], e.fromY + 0.05 + lift, c[1]), shape: 'bead', mode: { type: 'vertical', at: c }, label: 'bottom', title: 'Drag up to close the opening from below',
          drag: (pt) => {
            const yy = snapY(pt.y);
            return { op: opVoid(e.id, { fromY: Math.min(yy, (e.toY > 50 ? d.bounds.top : e.toY) - 0.3) }), measure: `open down to ${fmtM(yy)}` };
          },
        });
      }
      break;
    }
    case 'stair': {
      e.path.forEach((q, i) => {
        const t = i / Math.max(1, e.path.length - 1);
        const yy = e.fromY + (e.toY - e.fromY) * t;
        if (e.path.length > 6 && i % Math.ceil(e.path.length / 6) !== 0 && i !== e.path.length - 1) return;
        out.push({
          tier: i === 0 || i === e.path.length - 1 ? 'primary' : 'detail',
          id: `p:${i}`, pos: new THREE.Vector3(q[0], yy + 0.1 + lift, q[1]), shape: 'dot', mode: { type: 'plan', y: yy }, label: '', title: 'Drag to reshape the stair',
          drag: (pt, ev) => {
            const path = e.path.slice();
            const s = snapPoint(p, pt.plan, { level: yy, tol: magR, anchors: [path[i - 1], path[i + 1]].filter((q): q is V2 => !!q), own: path.filter((_, k) => k !== i), free: ev.altKey, fine: ev.shiftKey, walls: false });
            path[i] = s.p;
            return { op: opStair(e.id, { path }), measure: '', guides: s.guides, snap: s.label, at: s.p };
          },
        });
      });
      break;
    }
    case 'post': {
      out.push({
        id: 'move', pos: new THREE.Vector3(e.at[0], 0.1 + lift, e.at[1]), shape: 'move', mode: { type: 'plan', y: 0 }, label: '', title: 'Drag to move the post',
        drag: (pt) => ({ op: ((pp) => { const q = pp.posts.find((x) => x.id === e.id); if (q) q.at = snapP(pt.plan); }) as Op, measure: '' }),
      });
      break;
    }
    case 'obj': {
      out.push({
        id: 'rot', pos: new THREE.Vector3(e.at[0] + 0.9, (d.roomById.get((e.on as any).id)?.floorY ?? (e.on as any).y ?? 0) + 0.05 + lift, e.at[1]), shape: 'ring', mode: { type: 'plan', y: 0 }, label: '', title: 'Drag around to turn it',
        drag: (pt) => {
          const a = Math.atan2(pt.plan[0] - e.at[0], pt.plan[1] - e.at[1]) - Math.PI / 2;
          return { op: opObj(e.id, { rot: round(a, Math.PI / 24) }), measure: `${Math.round(((round(a, Math.PI / 24) * 180) / Math.PI + 360) % 360)}°` };
        },
      });
      break;
    }
  }
  return out;
}

function buildingHandles(p: Project, d: Derived): Handle[] {
  const b = d.bounds;
  if (b.empty) return [];
  const c: V2 = lerp2(b.min, b.max, 0.5);
  const corner: V2 = [b.max[0] + 0.6, b.max[1] + 0.6];
  const r0 = dist(corner, c);
  return [
    {
      id: 'scale', pos: new THREE.Vector3(corner[0], 0.05, corner[1]), shape: 'dot', mode: { type: 'plan', y: 0 }, label: 'scale', title: 'Drag to make the whole building bigger or smaller',
      drag: (pt) => {
        const k = Math.max(0.4, Math.min(3, round(dist(pt.plan, c) / r0, 0.01)));
        return { op: opScaleAll(k, c, store.scaleHeights), measure: `${Math.round(k * 100)}%` };
      },
    },
  ];
}
