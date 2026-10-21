// The pen, the handles and the camera: one grammar.
// Drag anywhere to draw · click to select · drag a blue handle to shape · right-drag (or ⌥-drag) to turn the table.
import * as THREE from 'three';
import { store } from '../store';
import type { Stage, Hit } from './stage';
import type { Overlays } from './overlays';
import { handlesFor, Handle } from './handles';
import { derive, elementName, wallTopAt } from '../model/derive';
import type { Project, SurfaceRef, Obj } from '../model/types';
import { V2, dist, sub, dot, perp, norm, add, mul, pointInPoly, fmtM, closestOnSeg, angleOf } from '../model/geom2d';
import { fitStroke } from '../model/strokes';
import { readStroke, findMagnet, Magnet, Reading } from '../model/readings';
import { runGeom, closestOnRun } from '../model/runs';
import { opMoveObj, opAddObj, opRemove, opFix, Op, OBJ_NAMES } from '../model/ops';
import { lvl } from '../model/settle';
import { holeOutline } from './build/walls';
import { routeHeights } from '../story/route';
import { opRoute, opAddMoment, opMoment } from '../story/storyOps';

type State = 'idle' | 'pending' | 'stroke' | 'handle' | 'camera' | 'objdrag';

interface Stroke {
  wall: { run: string; origin: THREE.Vector3; n: THREE.Vector3 } | null;
  y: number;
  onSheet: boolean;
  surface: SurfaceRef | null;
  surfaceName: string;
  onRoof: string | null;
  level: number;
  pts: V2[];
  scr: V2[];
  hits: (V2 | null)[];
  sy: V2[];
  trail: THREE.Vector3[];
  magA: Magnet | null;
  lastRead: number;
  purpose: 'draw' | 'slice' | 'route';
}

export class Interact {
  stage: Stage;
  ov: Overlays;
  el: HTMLCanvasElement;
  state: State = 'idle';
  down: { x: number; y: number; button: number; hit: Hit | null; time: number; alt: boolean } | null = null;
  stroke: Stroke | null = null;
  handle: Handle | null = null;
  handleOp: Op | null = null;
  camDrag: { x: number; y: number; pan: boolean } | null = null;
  objDrag: { id: string; op: Op | null; from: string; to: string } | null = null;
  space = false;
  live: HTMLDivElement;
  private lastClick = 0;

  constructor(stage: Stage, ov: Overlays) {
    this.stage = stage;
    this.ov = ov;
    this.el = stage.renderer.domElement;
    this.live = document.createElement('div');
    this.live.className = 'live-reading';
    stage.el.appendChild(this.live);
    this.el.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    this.el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.el.addEventListener('dblclick', (e) => this.onDbl(e));
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    store.subscribe(() => this.refreshHandles());
    stage.onFrame.push(() => {
      if (this.state === 'idle' && store.ui.selection) this.refreshHandlesPositions();
    });
  }

  private lastHandleKey = '';
  refreshHandles() {
    if (this.state === 'handle') return;
    const p = store.shown;
    const key = `${store.version}|${store.ui.selection}`;
    if (key === this.lastHandleKey) return;
    this.lastHandleKey = key;
    this.ov.handles = handlesFor(this.stage, p, derive(p), store.ui.selection);
    this.ov.rebuild();
  }
  private lastLift = 0;
  refreshHandlesPositions() {
    const l = this.stage.lift;
    if (Math.abs(l - this.lastLift) > 0.01) {
      this.lastLift = l;
      this.lastHandleKey = '';
      this.refreshHandles();
    }
  }

  // ------------------------------------------------------------------ pointer
  private handleAt(x: number, y: number): Handle | null {
    const r = this.el.getBoundingClientRect();
    let best: Handle | null = null, bd = 13;
    for (const h of this.ov.handles) {
      const [sx, sy] = this.stage.screenOf(h.pos);
      const d = Math.hypot(sx + r.left - x, sy + r.top - y);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  private onDown(e: PointerEvent) {
    if (store.ui.mode === 'visit') return;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {}
    const cameraBtn = e.button === 2 || e.button === 1 || (e.button === 0 && (e.altKey || this.space));
    if (cameraBtn) {
      this.state = 'camera';
      this.camDrag = { x: e.clientX, y: e.clientY, pan: e.button === 1 || this.space || (e.button === 2 && e.shiftKey) };
      return;
    }
    if (e.button !== 0) return;
    store.set({ readingChip: null });
    const h = store.ui.mode === 'make' ? this.handleAt(e.clientX, e.clientY) : null;
    if (h) {
      this.state = 'handle';
      this.handle = h;
      this.ov.activeHandle = h.id;
      store.set({ dragging: true });
      return;
    }
    const hit = this.stage.pick(e.clientX, e.clientY);
    this.down = { x: e.clientX, y: e.clientY, button: e.button, hit, time: performance.now(), alt: e.altKey };
    this.state = 'pending';
  }

  private onMove(e: PointerEvent) {
    if (this.state === 'camera' && this.camDrag) {
      const dx = e.clientX - this.camDrag.x, dy = e.clientY - this.camDrag.y;
      this.camDrag.x = e.clientX;
      this.camDrag.y = e.clientY;
      if (this.camDrag.pan) this.stage.ctl.panBy(dx, dy);
      else this.stage.ctl.orbitBy(dx, dy);
      return;
    }
    if (this.state === 'handle' && this.handle) {
      const pt = this.dragPoint(this.handle, e);
      if (!pt) return;
      const res = this.handle.drag(pt, e);
      if (!res) return;
      this.handleOp = res.op;
      store.setPreview(res.op);
      this.ov.measure = res.measure ? { text: res.measure, pos: new THREE.Vector3(pt.plan[0], pt.y + 0.4, pt.plan[1]) } : null;
      this.ov.setKnot(res.knot ? [res.knot[0], this.handle.mode.type === 'plan' ? this.handle.mode.y : 0, res.knot[1]] : null);
      return;
    }
    if (this.state === 'pending' && this.down) {
      if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) {
        const hit = this.down.hit;
        if (store.ui.mode === 'make' && hit?.kind === 'obj' && store.ui.tool === 'pen') {
          this.state = 'objdrag';
          const o = store.project.objs.find((x) => x.id === hit.id);
          this.objDrag = { id: hit.id, op: null, from: o ? surfaceName(store.project, o.on) : '', to: '' };
          store.select(hit.id);
          store.set({ dragging: true });
        } else this.beginStroke(this.down.x, this.down.y, hit);
      }
      return;
    }
    if (this.state === 'objdrag' && this.objDrag) {
      this.dragObject(e);
      return;
    }
    if (this.state === 'stroke' && this.stroke) {
      this.addStrokePoint(e.clientX, e.clientY);
      return;
    }
    if (this.state === 'idle' && e.target === this.el) {
      const h = store.ui.mode === 'make' ? this.handleAt(e.clientX, e.clientY) : null;
      const id = h?.id ?? null;
      if (id !== this.ov.hoverHandle) this.ov.hoverHandle = id;
      this.el.style.cursor = h ? 'grab' : store.ui.tool === 'place' ? 'copy' : 'crosshair';
    }
  }

  private onUp(e: PointerEvent) {
    const st = this.state;
    this.state = 'idle';
    if (st === 'camera') {
      this.camDrag = null;
      return;
    }
    if (st === 'handle' && this.handle) {
      const op = this.handleOp;
      const h = this.handle;
      this.handle = null;
      this.handleOp = null;
      this.ov.activeHandle = null;
      this.ov.measure = null;
      this.ov.setKnot(null);
      store.set({ dragging: false });
      if (op) {
        const sel = store.ui.selection;
        store.commit(`Shaped ${sel === 'building' ? 'the whole building' : elementName(store.project, sel ?? '')}`, op);
      } else store.setPreview(null);
      return;
    }
    if (st === 'objdrag' && this.objDrag) {
      const op = this.objDrag.op;
      const o = this.objDrag;
      this.objDrag = null;
      store.set({ dragging: false });
      this.ov.setTrail(null);
      if (op) store.commit(`Moved ${elementName(store.project, o.id)}`, op);
      else store.setPreview(null);
      return;
    }
    if (st === 'stroke' && this.stroke) {
      this.endStroke(e.clientX, e.clientY);
      return;
    }
    if (st === 'pending' && this.down) {
      this.click(this.down.hit, e);
      this.down = null;
    }
  }

  private dragPoint(h: Handle, e: PointerEvent): { plan: V2; y: number } | null {
    const ray = this.stage.ray(e.clientX, e.clientY);
    const m = h.mode;
    if (m.type === 'plan') {
      const q = this.stage.planAt(e.clientX, e.clientY, m.y);
      return q ? { plan: q, y: m.y } : null;
    }
    if (m.type === 'vertical') {
      const cam = this.stage.camera.position;
      const n = new THREE.Vector3(cam.x - m.at[0], 0, cam.z - m.at[1]).normalize();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(m.at[0], 0, m.at[1]));
      const out = new THREE.Vector3();
      if (!ray.intersectPlane(plane, out)) return null;
      return { plan: m.at, y: out.y - this.stage.liftOf(store.ui.selection ?? '') };
    }
    const n = perp(m.tan);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(n[0], 0, n[1]), new THREE.Vector3(m.origin[0], 0, m.origin[1]));
    const out = new THREE.Vector3();
    if (!ray.intersectPlane(plane, out)) return null;
    return { plan: [out.x, out.z], y: out.y };
  }

  // ------------------------------------------------------------------ strokes
  private beginStroke(x: number, y: number, hit: Hit | null) {
    const p = store.project;
    const d = derive(p);
    const v = store.view;
    const tool = store.ui.tool;
    const mode = store.ui.mode;
    const purpose: Stroke['purpose'] = tool === 'slice' ? 'slice' : mode === 'tell' ? 'route' : 'draw';
    const s: Stroke = { wall: null, y: 0, onSheet: false, surface: { kind: 'ground', y: 0 }, surfaceName: 'the ground', onRoof: null, level: 0, pts: [], scr: [], hits: [], sy: [], trail: [], magA: null, lastRead: 0, purpose };
    if (purpose === 'draw' && !v.sheetOut && hit?.kind === 'wall' && hit.normal && Math.abs(hit.normal.y) < 0.3) {
      const n = hit.normal.clone().setY(0).normalize();
      s.wall = { run: hit.id, origin: hit.point.clone(), n };
      const run = p.runs.find((r) => r.id === hit.id);
      if (run) {
        s.y = run.baseY;
        s.level = run.baseY;
      }
    } else if (v.sheetOut && purpose !== 'route') {
      s.y = v.sheetY;
      s.onSheet = true;
      s.surface = null;
      s.surfaceName = `the sheet at ${fmtM(v.sheetY)}`;
      s.level = v.sheetY;
      const dk = p.decks.find((x) => Math.abs(x.y - v.sheetY) < 0.06);
      if (dk) s.surface = { kind: 'deck', id: dk.id };
      // a sheet lying on a floor draws on that floor (x-ray stays on)
      const q = this.stage.planAt(x, y, v.sheetY);
      const room = q && d.rooms.find((r) => Math.abs(r.floorY - v.sheetY) < 0.03 && pointInPoly(q, r.poly));
      if (Math.abs(v.sheetY) < 0.03 && !room) {
        s.onSheet = false;
        s.surface = { kind: 'ground', y: 0 };
        s.surfaceName = 'the ground';
        s.level = 0;
      } else if (room) {
        s.onSheet = false;
        s.surface = { kind: 'room', id: room.id };
        s.surfaceName = room.name;
        s.level = room.level;
      }
    } else if (hit && hit.kind !== 'wall') {
      const r = surfaceOfHit(p, hit);
      s.y = r.y;
      s.surface = r.ref;
      s.surfaceName = r.name;
      s.onRoof = hit.kind === 'roof' ? hit.id : null;
      s.level = r.level;
    }
    if (purpose === 'slice') {
      s.y = 0.02;
      s.onSheet = false;
      s.wall = null;
    }
    this.stroke = s;
    this.state = 'stroke';
    if (s.purpose === 'draw' && !s.wall) {
      const q = this.stage.planAt(x, y, s.y);
      if (q) {
        const m = findMagnet(p, q, s.level, Math.max(0.3, 16 * this.stage.mpp()));
        if (m) s.magA = m;
      }
    }
    this.addStrokePoint(x, y);
  }

  private addStrokePoint(x: number, y: number) {
    const s = this.stroke!;
    if (s.wall) {
      // on the wall's real surface where the pen is over it (curved walls stay curved), else on its tangent plane
      const onWall = this.stage.pick(x, y, { kinds: ['wall'] });
      const out = new THREE.Vector3();
      if (onWall && onWall.id === s.wall.run) out.copy(onWall.point);
      else {
        const ray = this.stage.ray(x, y);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(s.wall.n, s.wall.origin);
        if (!ray.intersectPlane(plane, out)) return;
      }
      const run = store.project.runs.find((r) => r.id === s.wall!.run);
      if (!run) return;
      const c = closestOnRun(run, [out.x, out.z]);
      s.sy.push([c.s, out.y]);
      s.trail.push(out.clone().addScaledVector(s.wall.n, 0.02));
      // keep the plan reading too: a stroke that leaves the face is a stroke on the ground
      const q = this.stage.planAt(x, y, run.baseY);
      if (q) {
        s.pts.push(q);
        s.scr.push([x, y]);
        s.hits.push(null);
      }
    } else {
      const q = this.stage.planAt(x, y, s.y);
      if (!q) return;
      s.pts.push(q);
      s.scr.push([x, y]);
      const h = s.purpose === 'draw' ? this.stage.pick(x, y, { kinds: ['floor', 'deck', 'ground', 'stair'] }) : null;
      s.hits.push(h ? [h.point.x, h.point.z] : null);
      s.trail.push(new THREE.Vector3(q[0], s.y, q[1]));
    }
    this.ov.setTrail(s.trail, s.purpose === 'slice' ? '#d9472b' : s.purpose === 'route' ? '#2f4bd8' : '#1f1c19');
    // knot at the end: a pencil suggestion until you let go on it
    if (!s.wall && s.purpose === 'draw' && s.pts.length > 2) {
      const last = s.pts[s.pts.length - 1];
      const m = findMagnet(store.project, last, s.level, Math.max(0.3, 16 * this.stage.mpp()));
      const a = s.magA ? ([s.magA.p[0], s.y, s.magA.p[1]] as [number, number, number]) : null;
      this.ov.setKnot(m ? [m.p[0], s.y, m.p[1]] : null, true, a);
    }
    const now = performance.now();
    if (now - s.lastRead > 90) {
      s.lastRead = now;
      this.showLive(x, y);
    }
  }

  private buildReadings(s: Stroke, x: number, y: number): { readings: Reading[]; ctx: any } | null {
    const p = store.project;
    const d = derive(p);
    const mpp = this.stage.mpp();
    if (s.purpose !== 'draw') return null;
    if (s.wall) {
      if (s.sy.length < 4) return null;
      const w = d.walls.get(s.wall.run);
      const off = w ? s.sy.filter(([sv, yv]) => sv < -0.3 || sv > w.L + 0.3 || yv < w.run.baseY - 0.3 || yv > w.maxTop + 0.6).length / s.sy.length : 0;
      if (off < 0.2) {
        const readings = readStroke({ p, d, plane: { y: 0, onSheet: false, surface: null, surfaceName: '' }, fit: fitStroke([], { mpp }), rawFit: fitStroke([], { mpp }), plan: [], magA: null, magB: null, wallFace: { run: s.wall.run, sy: s.sy }, stairTo: null, onRoof: null, sheetSnap: null });
        if (readings.length) return { readings, ctx: null };
      }
      // it left the face: read it in plan, starting from the wall
      if (!s.magA && s.pts.length) s.magA = findMagnet(p, s.pts[0], s.level, Math.max(0.3, 16 * mpp));
    }
    if (s.pts.length < 3) return null;
    const dirs = [...new Set(p.runs.filter((r) => r.shape === 'path').flatMap((r) => r.pts.slice(0, -1).map((q, i) => angleOf(sub(r.pts[i + 1], q)))))].slice(0, 24);
    const last = s.pts[s.pts.length - 1];
    let magB = findMagnet(p, last, s.level, Math.max(0.3, 16 * mpp));
    const fit = fitStroke(s.pts, { mpp, dirs, tidy: true, forceOpen: !!(s.magA && magB), screen: s.scr });
    const rawFit = fitStroke(s.pts, { mpp, tidy: false, forceOpen: !!(s.magA && magB) });
    if (fit.kind !== 'open') magB = null;
    let stairTo = null as any;
    if (fit.kind === 'open' && !s.onSheet && !s.onRoof) {
      const h = this.stage.pick(x, y, { kinds: ['floor', 'deck', 'ground', 'stair'] });
      if (h) {
        const r = surfaceOfHit(p, h);
        if (Math.abs(r.y - s.y) > 0.35) stairTo = { y: r.y, ref: r.ref, name: r.name, at: [h.point.x, h.point.z] as V2 };
      }
    }
    const snap = s.onSheet ? d.snaps.find((sn) => Math.abs(sn.y - s.y) < 0.03) ?? null : null;
    // stairs follow what is under the pointer, not the plane
    const plan = stairTo ? s.pts.map((q, i) => s.hits[i] ?? q) : s.pts;
    const fitS = stairTo ? fitStroke(plan, { mpp, tidy: false, forceOpen: true }) : fit;
    const readings = readStroke({
      p, d, plane: { y: s.y, onSheet: s.onSheet, surface: s.surface, surfaceName: s.surfaceName }, fit: stairTo ? fitS : fit, rawFit: stairTo ? fitS : rawFit, plan,
      magA: fit.kind === 'open' ? s.magA : null, magB, wallFace: null, stairTo, onRoof: s.onRoof, sheetSnap: snap,
    });
    return { readings, ctx: null };
  }

  private showLive(x: number, y: number) {
    const s = this.stroke!;
    const r = this.el.getBoundingClientRect();
    let text = '';
    if (s.purpose === 'slice') text = 'slice the view here';
    else if (s.purpose === 'route') text = 'the visitor’s walk';
    else {
      const res = this.buildReadings(s, x, y);
      const first = res?.readings[0];
      if (first) text = `<b>${first.label}</b> · ${first.detail}${res!.readings.length > 1 ? ` <span class="alt">+${res!.readings.length - 1} other reading${res!.readings.length > 2 ? 's' : ''}</span>` : ''}`;
    }
    this.live.innerHTML = text;
    this.live.style.display = text ? 'block' : 'none';
    this.live.style.transform = `translate(${x - r.left + 18}px, ${y - r.top + 14}px)`;
  }

  private endStroke(x: number, y: number) {
    const s = this.stroke!;
    this.stroke = null;
    this.live.style.display = 'none';
    this.ov.setTrail(null);
    this.ov.setKnot(null);
    if (s.purpose === 'slice') {
      if (s.pts.length < 2) return;
      let a = s.pts[0], b = s.pts[s.pts.length - 1];
      if (dist(a, b) < 0.5) return;
      const n = norm(perp(sub(b, a)));
      const cam = this.stage.camera.position;
      if (dot(n, sub([cam.x, cam.z], a)) > 0) [a, b] = [b, a];
      store.setView({ slice: { a, b } }, 'slice');
      store.set({ tool: 'pen' });
      // turn to face the cut
      const nn = perp(norm(sub(b, a)));
      this.stage.ctl.az = Math.atan2(-nn[0], -nn[1]);
      this.stage.ctl.pol = 1.18;
      return;
    }
    if (s.purpose === 'route') {
      if (s.pts.length < 3) return;
      const p = store.project;
      const route = p.story.route;
      const pts = simplify(s.pts, 0.25);
      const extend = route.length > 1 && dist(route[route.length - 1], pts[0]) < 1.2;
      const startY = extend ? p.story.routeStartY : s.y;
      store.commit(extend ? 'Extended the visitor’s walk' : 'Drew the visitor’s walk', opRoute(extend ? [...route, ...pts.slice(1)] : pts, startY, !extend));
      return;
    }
    const res = this.buildReadings(s, x, y);
    if (!res || !res.readings.length) return;
    const first = res.readings[0];
    store.commit(first.label, first.op, { readings: res.readings, readingIndex: 0 });
    const r = this.el.getBoundingClientRect();
    store.set({ readingChip: { at: [x - r.left, y - r.top] } });
  }

  // ------------------------------------------------------------------ click / select / place
  private openingHit(e: { clientX: number; clientY: number }): { id: string; t: number } | null {
    const p = store.project;
    const d = derive(p);
    const ray = this.stage.ray(e.clientX, e.clientY);
    let best: { id: string; t: number } | null = null;
    for (const w of d.walls.values()) {
      const g = runGeom(w.run);
      for (const o of w.openings) {
        const st = g.ps;
        const c = closestOnRun(w.run, [0, 0]);
        const mid = (() => {
          const q = pointAtSafe(st, o.s);
          return q;
        })();
        const n = perp(mid.tan);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(n[0], 0, n[1]), new THREE.Vector3(mid.p[0], 0, mid.p[1]));
        const out = new THREE.Vector3();
        if (!ray.intersectPlane(plane, out)) continue;
        if (!this.stage.visibleAt(out)) continue;
        const sLoc = o.s + dot(sub([out.x, out.z], mid.p), mid.tan);
        const ring = holeOutline({ ...o, s0: o.s0, s1: o.s1 });
        if (pointInPoly([sLoc, out.y], ring)) {
          const t = ray.origin.distanceTo(out);
          if (!best || t < best.t) best = { id: o.o.id, t };
        }
        void c;
      }
    }
    return best;
  }

  private click(hit: Hit | null, e: PointerEvent) {
    const p = store.project;
    const mode = store.ui.mode;
    const tool = store.ui.tool;
    // a pencil suggestion: clicking it inks it
    if (mode === 'make') {
      const ray = this.stage.ray(e.clientX, e.clientY);
      const rc = new THREE.Raycaster(ray.origin, ray.direction);
      const ph = rc.intersectObjects(this.ov.pencilGroup.children, false)[0];
      if (ph && (!hit || ph.distance < hit.point.distanceTo(ray.origin) + 0.5)) {
        const f = ph.object.userData.pencilFix;
        const iss = derive(p).issues.find((i) => i.key === f.key);
        store.commit(iss?.fixes[f.fix].label ?? 'Accepted a suggestion', opFix(f.key, f.fix));
        return;
      }
    }
    if (mode === 'tell') return this.tellClick(hit, e);
    if (tool === 'place' && store.ui.placeType && hit) {
      const type = store.ui.placeType;
      const on = objSurface(p, hit, type);
      if (on) store.commit(`Placed ${OBJ_NAMES[type].toLowerCase()}`, opAddObj(type, [hit.point.x, hit.point.z], on.on, on.rot));
      return;
    }
    const oh = this.openingHit(e);
    if (oh && (!hit || oh.t < hit.point.distanceTo(this.stage.ray(e.clientX, e.clientY).origin) + 0.05)) {
      store.select(oh.id);
      return;
    }
    if (!hit || hit.kind === 'ground') {
      store.select(null);
      return;
    }
    if (this.stage.ctl.mode === 'eye' && (hit.kind === 'floor' || hit.kind === 'deck')) {
      // in eye view, a click on the floor walks you there
    }
    store.select(hit.kind === 'import' ? 'import' : hit.id);
  }

  private onDbl(e: MouseEvent) {
    if (store.ui.mode !== 'make') return;
    const hit = this.stage.pick(e.clientX, e.clientY);
    if (this.stage.ctl.mode === 'eye' && hit && (hit.kind === 'floor' || hit.kind === 'deck' || hit.kind === 'ground' || hit.kind === 'stair')) {
      const c = this.stage.ctl;
      const dir = new THREE.Vector3().subVectors(hit.point, c.eyePos).setY(0);
      c.eyePos.set(hit.point.x, hit.point.y + 1.6, hit.point.z);
      void dir;
      return;
    }
    if (hit && hit.kind !== 'ground') {
      store.setView({ isolate: hit.id }, 'isolate');
      store.toast('Isolated — Esc to bring everything back');
    }
  }

  private tellClick(hit: Hit | null, e: PointerEvent) {
    const p = store.project;
    const tool = store.ui.tool;
    if (tool === 'aim' && store.ui.momentFocus && hit) {
      store.commit('Aimed a moment', opMoment(store.ui.momentFocus, { look: [hit.point.x, hit.point.y, hit.point.z] }));
      store.set({ tool: 'pen' });
      return;
    }
    const route = p.story.route;
    if (route.length > 1) {
      const r = this.el.getBoundingClientRect();
      const hs = routeHeights(p, route, p.story.routeStartY);
      let best = -1, bd = 16, bt = 0;
      const acc = [0];
      for (let i = 1; i < route.length; i++) acc.push(acc[i - 1] + dist(route[i - 1], route[i]));
      for (let i = 1; i < route.length; i++) {
        const a = this.stage.screenOf(new THREE.Vector3(route[i - 1][0], hs[i - 1], route[i - 1][1]));
        const b = this.stage.screenOf(new THREE.Vector3(route[i][0], hs[i], route[i][1]));
        const c = closestOnSeg([e.clientX - r.left, e.clientY - r.top], a, b);
        if (c.d < bd) {
          bd = c.d;
          best = i;
          bt = (acc[i - 1] + c.t * (acc[i] - acc[i - 1])) / Math.max(acc[acc.length - 1], 1e-6);
        }
      }
      if (best > 0) {
        store.commit('Added a moment', opAddMoment(bt));
        const m = store.project.story.moments.find((x) => Math.abs(x.t - bt) < 1e-6);
        store.set({ momentFocus: m?.id ?? null, panel: 'story' });
        return;
      }
    }
  }

  // ------------------------------------------------------------------ dragging things between floors
  private dragObject(e: PointerEvent) {
    const od = this.objDrag!;
    const p = store.project;
    const o = p.objs.find((x) => x.id === od.id);
    if (!o) return;
    const hit = this.stage.pick(e.clientX, e.clientY, { ignore: [o.id] });
    if (!hit) return;
    const on = objSurface(p, hit, o.type);
    if (!on) return;
    od.to = surfaceName(p, on.on);
    od.op = opMoveObj(o.id, [hit.point.x, hit.point.z], on.on, od.from, od.to);
    store.setPreview(od.op);
    const from = this.stage.partsOf(o.id)[0]?.group;
    const d = derive(p);
    const startY = o.on.kind === 'room' ? d.roomById.get(o.on.id)?.floorY ?? 0 : o.on.kind === 'deck' ? p.decks.find((x) => x.id === (o.on as any).id)?.y ?? 0 : (o.on as any).y ?? 0;
    const a = new THREE.Vector3(o.at[0], startY + 0.05, o.at[1]);
    const b = hit.point.clone().setY(hit.point.y + 0.05);
    const mid = a.clone().lerp(b, 0.5).setY(Math.max(a.y, b.y) + 1.2);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    this.ov.setTrail(curve.getPoints(24), '#2f4bd8');
    this.ov.measure = { text: `onto ${od.to}`, pos: b.clone().setY(b.y + 0.6) };
    void from;
  }

  // ------------------------------------------------------------------ wheel & keys
  private onWheel(e: WheelEvent) {
    e.preventDefault();
    if (store.ui.mode === 'visit') return;
    const ctl = this.stage.ctl;
    const towards = () => {
      const h = this.stage.pick(e.clientX, e.clientY);
      return h ? h.point : undefined;
    };
    if (e.ctrlKey) {
      ctl.zoomBy(Math.exp(e.deltaY * 0.012), towards());
      return;
    }
    const mouseWheel = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY));
    if (mouseWheel) {
      ctl.zoomBy(Math.exp(Math.sign(e.deltaY) * 0.14), towards());
      return;
    }
    if (e.shiftKey) ctl.panBy(-e.deltaX, -e.deltaY);
    else ctl.orbitBy(-e.deltaX * 0.9, -e.deltaY * 0.6);
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    const ctl = this.stage.ctl;
    if (ctl.mode === 'eye' && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) && !e.metaKey && !e.ctrlKey) {
      if (down) ctl.keys.add(k);
      else ctl.keys.delete(k);
      e.preventDefault();
      return;
    }
    if (k === ' ') {
      this.space = down;
      if (store.ui.mode !== 'visit') e.preventDefault();
      return;
    }
    if (store.ui.mode === 'visit') return;
    if (k === 'l' && !e.metaKey && !e.ctrlKey) {
      if (e.shiftKey && down) {
        store.setView({ liftPinned: !store.view.liftPinned }, store.view.liftPinned ? undefined : 'lift');
      } else if (!e.repeat && !e.shiftKey) store.setView({ liftHeld: down });
      return;
    }
    if (!down) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if (mod && k === 'y') {
      e.preventDefault();
      store.redo();
      return;
    }
    if (mod && k === 'a' && store.ui.mode === 'make') {
      e.preventDefault();
      store.select('building');
      return;
    }
    if (k === 'escape') {
      if (this.stroke) {
        this.stroke = null;
        this.state = 'idle';
        this.ov.setTrail(null);
        this.ov.setKnot(null);
        this.live.style.display = 'none';
        return;
      }
      if (store.ui.readingChip) return store.set({ readingChip: null });
      if (store.ui.tool !== 'pen') return store.set({ tool: 'pen', placeType: null });
      if (store.ui.panel !== 'none') return store.set({ panel: 'none' });
      if (store.back()) return;
      if (ctl.mode === 'eye') {
        ctl.mode = 'orbit';
        return;
      }
      if (store.ui.selection) return store.select(null);
      return;
    }
    if ((k === 'backspace' || k === 'delete') && store.ui.mode === 'make') {
      const s = store.ui.selection;
      if (s && s !== 'building' && s !== 'import') {
        e.preventDefault();
        store.commit(`Removed ${elementName(store.project, s)}`, opRemove([s]));
      }
      return;
    }
    if (k === 'tab') {
      const top = store.top;
      if (top?.readings && store.ui.readingChip) {
        e.preventDefault();
        store.amendReading(((top.readingIndex ?? 0) + (e.shiftKey ? top.readings.length - 1 : 1)) % top.readings.length);
      }
      return;
    }
    if (k === '[' || k === ']') {
      const d = derive(store.project);
      const snaps = d.snaps.map((s) => s.y);
      const v = store.view;
      const cur = v.sheetOut ? v.sheetY : -0.001;
      const next = k === ']' ? snaps.find((y) => y > cur + 0.01) : [...snaps].reverse().find((y) => y < cur - 0.01);
      if (next !== undefined) store.setView({ sheetOut: true, sheetY: next }, v.sheetOut ? undefined : 'sheet');
      else if (k === '[') store.setView({ sheetOut: false });
      return;
    }
    if (k === '1') return this.view('model');
    if (k === '2') return this.view('plan');
    if (k === '3') return this.view('eye');
    if (k === 'f') return this.frameAll();
    if (k === 'q') return ctl.turn(Math.PI / 4);
    if (k === 'e') return ctl.turn(-Math.PI / 4);
    if (k === 'p') return store.set({ people: !store.ui.people });
  }

  view(kind: 'model' | 'plan' | 'eye') {
    const ctl = this.stage.ctl;
    if (kind === 'model') ctl.setModel();
    if (kind === 'plan') ctl.setPlan();
    if (kind === 'eye') {
      const d = derive(store.project);
      const rooms = [...d.rooms].sort((a, b) => b.area - a.area);
      const r = rooms[0];
      if (r) {
        const b = d.bounds;
        const c: V2 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
        const from = r.at;
        const away = norm(sub(from, c));
        const look = add(from, mul(away[0] || away[1] ? mul(away, -1) : [1, 0], 4));
        ctl.standAt(from[0], r.floorY, from[1], look[0], look[1]);
        store.toast('Eye height · drag to look · W A S D to walk · double-click a floor to step there · Esc to leave');
      }
    }
    store.emit();
  }

  frameAll() {
    const d = derive(store.project);
    this.stage.ctl.frame(d.bounds.min, d.bounds.max, d.bounds.top);
  }
}

// ------------------------------------------------------------------ helpers
function pointAtSafe(ps: ReturnType<typeof runGeom>['ps'], s: number) {
  const L = ps.L;
  const sv = ps.closed ? ((s % L) + L) % L : Math.max(0, Math.min(L, s));
  let i = 0;
  while (i + 1 < ps.s.length - 1 && ps.s[i + 1] < sv) i++;
  const a = ps.pts[i], b = ps.pts[i + 1];
  const k = (sv - ps.s[i]) / Math.max(ps.s[i + 1] - ps.s[i], 1e-9);
  return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k] as V2, tan: norm(sub(b, a)) };
}

export function surfaceOfHit(p: Project, hit: Hit): { y: number; ref: SurfaceRef; name: string; level: number } {
  const d = derive(p);
  if (hit.kind === 'floor') {
    const r = d.roomById.get(hit.id);
    if (r) return { y: r.floorY, ref: { kind: 'room', id: r.id }, name: r.name, level: r.level };
  }
  if (hit.kind === 'deck') {
    const dk = p.decks.find((x) => x.id === hit.id);
    if (dk) return { y: dk.y, ref: { kind: 'deck', id: dk.id }, name: dk.name, level: dk.y };
  }
  if (hit.kind === 'ground') return { y: 0, ref: { kind: 'ground', y: 0 }, name: 'the ground', level: 0 };
  return { y: hit.point.y, ref: { kind: 'free', y: hit.point.y }, name: hit.kind === 'roof' ? 'the roof' : hit.kind, level: hit.point.y };
}

export function surfaceName(p: Project, on: Obj['on']): string {
  if (on.kind === 'room') return derive(p).roomById.get(on.id)?.name ?? 'a room';
  if (on.kind === 'deck') return p.decks.find((x) => x.id === on.id)?.name ?? 'a floor';
  if (on.kind === 'wall') return elementName(p, on.run);
  if (on.kind === 'ground') return 'the ground';
  return 'a surface';
}

function objSurface(p: Project, hit: Hit, type: Obj['type']): { on: Obj['on']; rot: number } | null {
  if (type === 'frame') {
    if (hit.kind !== 'wall' || !hit.normal) return null;
    const run = p.runs.find((r) => r.id === hit.id);
    if (!run) return null;
    const c = closestOnRun(run, [hit.point.x, hit.point.z]);
    const n = perp(c.tan);
    const side = dot(n, [hit.normal.x, hit.normal.z]) > 0 ? 1 : -1;
    return { on: { kind: 'wall', run: run.id, t: c.t, y: Math.max(1.0, hit.point.y), side }, rot: 0 };
  }
  if (hit.kind === 'wall' || hit.kind === 'post') return null;
  const s = surfaceOfHit(p, hit);
  return { on: s.ref, rot: 0 };
}

function simplify(pts: V2[], step: number): V2[] {
  const out: V2[] = [pts[0]];
  for (const q of pts) if (dist(out[out.length - 1], q) >= step) out.push(q);
  if (dist(out[out.length - 1], pts[pts.length - 1]) > 0.05) out.push(pts[pts.length - 1]);
  return out;
}
