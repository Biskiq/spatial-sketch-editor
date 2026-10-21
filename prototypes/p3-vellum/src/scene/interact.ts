// The pen, the handles and the camera: one grammar.
// Drag anywhere to draw · click to select · drag a blue handle to shape · right-drag (or ⌥-drag) to turn the table.
import * as THREE from 'three';
import { store } from '../store';
import type { Stage, Hit } from './stage';
import type { Overlays } from './overlays';
import { handlesFor, zoneHandle, Handle } from './handles';
import { derive, elementName, wallTopAt } from '../model/derive';
import type { Project, SurfaceRef, Obj, Overhead } from '../model/types';
import { V2, dist, sub, dot, perp, norm, add, mul, pointInPoly, fmtM, closestOnSeg, angleOf, lerp2, round } from '../model/geom2d';
import { fitStroke } from '../model/strokes';
import { readStroke, findMagnet, Magnet, Reading } from '../model/readings';
import { snapPoint, SnapRes } from '../model/snap';
import type { StrokeFit } from '../model/strokes';
import { flattenSeg } from '../model/geom2d';
import { runGeom, closestOnRun } from '../model/runs';
import { opMoveObj, opAddObj, opRemove, opFix, opOverhead, Op, OBJ_NAMES, runTxn } from '../model/ops';
import { ohHasSurface } from '../model/overheadGeom';
import { roofZoneAt, affectedZoneGeometry, zoneTip, type RoofZone } from '../model/roofZones';
import { qualifyRidgeTurn, qualifyRoofEdit, withRoofProfiles } from '../model/roofEdits';
import { lvl } from '../model/settle';
import { holeOutline } from './build/walls';
import { routeHeights } from '../story/route';
import { opRoute, opAddMoment, opMoment } from '../story/storyOps';
import { wheelSource } from './wheel';

export interface WheelIn { t: number; dx: number; dy: number; mode: number; ctrl: boolean; shift: boolean; x: number; y: number; wdy?: number }
export interface TraceEv { kind: string; ev: any; read: string; cam: { az: number; pol: number; dist: number } }

type State = 'idle' | 'pending' | 'zonepending' | 'stroke' | 'handle' | 'camera' | 'objdrag';

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
  /** where a straight stroke (⇧, and every slice) starts, already snapped */
  a0: V2 | null;
  /** ⇧ held: the stroke is a straight rubber band from a0 to the snapped pen */
  line: { a: V2; b: V2; snap: SnapRes } | null;
  /** slice: the oriented, extended cut currently previewed */
  slice: { a: V2; b: V2 } | null;
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
  private handleStartProject: Project | null = null;
  private handleStartSelection: string | null = null;
  private handleChanged = false;
  private handleZone: RoofZone | null = null;
  private zonePending: { oh: Overhead; zone: RoofZone; plan: V2; y: number; startProject: Project } | null = null;
  private handleLabel: string | undefined;
  private queuedMove: PointerEvent | null = null;
  private moveRaf = 0;
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
    this.el.addEventListener('pointerleave', () => {
      if (this.state !== 'idle') return;
      this.ov.pointer = null;
      this.ov.hoverHandle = null;
      this.ov.setZone(null);
      this.el.style.cursor = '';
    });
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', () => this.cancelGesture());
    this.el.addEventListener('lostpointercapture', () => this.cancelGesture());
    window.addEventListener('blur', () => this.cancelGesture());
    this.el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    const gest = (type: 'start' | 'change' | 'end') => (e: any) => {
      e.preventDefault();
      this.handleGesture(type, { t: performance.now(), scale: e.scale, rotation: e.rotation, x: e.clientX, y: e.clientY });
    };
    this.el.addEventListener('gesturestart', gest('start') as any);
    this.el.addEventListener('gesturechange', gest('change') as any);
    this.el.addEventListener('gestureend', gest('end') as any);
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.el.addEventListener('dblclick', (e) => this.onDbl(e));
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    store.subscribe(() => {
      this.refreshHandles();
      this.cancelIfGestureContextChanged();
    });
    stage.onFrame.push(() => {
      if (this.state === 'idle' && store.ui.selection) this.refreshHandlesPositions();
    });
  }

  private lastHandleKey = '';
  refreshHandles() {
    if (this.state === 'handle') return;
    const p = store.shown;
    const key = `${store.version}|${store.ui.selection}|${store.ui.tool}`;
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

  private cancelIfGestureContextChanged() {
    const active = this.state === 'handle' || this.state === 'zonepending';
    if (!active) return;
    const startProject = this.state === 'handle' ? this.handleStartProject : this.zonePending?.startProject;
    const target = this.state === 'handle' ? this.handleStartSelection : this.zonePending?.oh.id;
    if (
      store.project !== startProject ||
      store.ui.mode !== 'make' ||
      store.ui.tool !== 'select' ||
      store.ui.selection !== target
    ) this.cancelGesture();
  }

  private zoneAt(hit: Hit | null): { oh: Overhead; zone: RoofZone } | null {
    if (!hit || hit.kind !== 'roof' || hit.id !== store.ui.selection || store.ui.mode !== 'make' || store.ui.tool !== 'select') return null;
    const oh = store.project.overheads.find((o) => o.id === hit.id);
    if (!oh || !ohHasSurface(oh)) return null;
    const q: V2 = [hit.point.x, hit.point.z];
    const mpp = this.stage.mpp(hit.point);
    const zone = roofZoneAt(oh, q, { ridge: 14 * mpp, end: 18 * mpp, eave: 12 * mpp });
    return zone ? { oh, zone } : null;
  }

  private beginHandle(h: Handle, zone: RoofZone | null = null, startProject = store.project) {
    this.state = 'handle';
    this.handle = h;
    this.handleOp = null;
    this.handleLabel = undefined;
    this.handleStartProject = startProject;
    this.handleStartSelection = store.ui.selection;
    this.handleChanged = false;
    this.handleZone = zone;
    this.ov.activeHandle = h.id;
    store.set({ dragging: true });
  }

  private beginZoneHandle(e: PointerEvent) {
    const pending = this.zonePending;
    if (!pending || store.project !== pending.startProject || store.ui.selection !== pending.oh.id) return this.cancelGesture();
    const h = zoneHandle(this.stage, pending.startProject, pending.oh, pending.zone, pending.plan, pending.y);
    this.zonePending = null;
    this.down = null;
    if (!h) {
      this.state = 'idle';
      this.ov.setZone(null);
      return;
    }
    this.beginHandle(h, pending.zone, pending.startProject);
    this.queuedMove = e;
    if (!this.moveRaf) this.moveRaf = requestAnimationFrame(() => this.flushHandleMove());
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
    // Explicit camera gestures always win. Alt is resolved after checking the selected roof's zones so it can mean
    // a free Hold edit there while remaining the familiar orbit shortcut everywhere else.
    const cameraBtn = e.button === 2 || e.button === 1 || (e.button === 0 && this.space);
    if (cameraBtn) {
      this.state = 'camera';
      this.camDrag = { x: e.clientX, y: e.clientY, pan: e.button === 1 || this.space || (e.button === 2 && e.shiftKey) };
      return;
    }
    if (e.button !== 0) return;
    store.set({ readingChip: null });
    const h = store.ui.mode === 'make' ? this.handleAt(e.clientX, e.clientY) : null;
    const hit = this.stage.pick(e.clientX, e.clientY);
    const overheadSelected = store.project.overheads.some((o) => o.id === store.ui.selection);
    const precise = !!h && (!overheadSelected || h.id.startsWith('pp:') || h.id.startsWith('n:'));
    if (precise && h) {
      this.down = null;
      this.beginHandle(h);
      return;
    }
    const target = this.zoneAt(hit);
    if (target && !(target.zone.kind === 'slope' && target.zone.locked)) {
      this.down = { x: e.clientX, y: e.clientY, button: e.button, hit, time: performance.now(), alt: e.altKey };
      this.zonePending = { oh: target.oh, zone: target.zone, plan: [hit!.point.x, hit!.point.z], y: hit!.point.y, startProject: store.project };
      this.state = 'zonepending';
      return;
    }
    if (e.altKey) {
      this.state = 'camera';
      this.camDrag = { x: e.clientX, y: e.clientY, pan: false };
      return;
    }
    this.down = { x: e.clientX, y: e.clientY, button: e.button, hit, time: performance.now(), alt: e.altKey };
    this.state = 'pending';
  }

  private onMove(e: PointerEvent) {
    if (this.state === 'camera' && this.camDrag) {
      const dx = e.clientX - this.camDrag.x, dy = e.clientY - this.camDrag.y;
      this.camDrag.x = e.clientX;
      this.camDrag.y = e.clientY;
      if (this.camDrag.pan) this.stage.ctl.panBy(dx, dy, this.stage.mpp());
      else this.stage.ctl.orbitBy(dx, dy);
      return;
    }
    if (this.state === 'handle' && this.handle) {
      // one reshape per frame: pointers can report far more often than the screen redraws, and each reshape
      // previews the whole building; only the latest position matters
      this.queuedMove = e;
      if (!this.moveRaf) this.moveRaf = requestAnimationFrame(() => this.flushHandleMove());
      return;
    }
    if (this.state === 'zonepending' && this.zonePending) {
      const start = this.down;
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 4) this.beginZoneHandle(e);
      return;
    }
    if (this.state === 'pending' && this.down) {
      if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) {
        const hit = this.down.hit;
        const tool = store.ui.tool;
        if (store.ui.mode === 'make' && hit?.kind === 'obj' && tool === 'select') {
          this.state = 'objdrag';
          const o = store.project.objs.find((x) => x.id === hit.id);
          this.objDrag = { id: hit.id, op: null, from: o ? surfaceName(store.project, o.on) : '', to: '' };
          store.select(hit.id);
          store.set({ dragging: true });
        } else if (store.ui.mode === 'make' && tool === 'select') {
          // Select never draws: a drag that isn't on a handle or an object turns the table (⇧ pans)
          this.state = 'camera';
          this.camDrag = { x: this.down.x, y: this.down.y, pan: e.shiftKey };
          this.el.style.cursor = 'grabbing';
          this.down = null;
          this.onMove(e);
        } else this.beginStroke(this.down.x, this.down.y, hit, e.shiftKey);
      }
      return;
    }
    if (this.state === 'objdrag' && this.objDrag) {
      this.dragObject(e);
      return;
    }
    if (this.state === 'stroke' && this.stroke) {
      this.addStrokePoint(e.clientX, e.clientY, e.shiftKey);
      return;
    }
    if (e.target === this.el) {
      const r = this.el.getBoundingClientRect();
      this.ov.pointer = [e.clientX - r.left, e.clientY - r.top];
    }
    if (this.state === 'idle' && e.target === this.el) {
      const h = store.ui.mode === 'make' ? this.handleAt(e.clientX, e.clientY) : null;
      const selectedOverhead = store.project.overheads.some((o) => o.id === store.ui.selection);
      const precise = !!h && (!selectedOverhead || h.id.startsWith('pp:') || h.id.startsWith('n:'));
      const id = precise ? h!.id : null;
      if (id !== this.ov.hoverHandle) this.ov.hoverHandle = id;
      const tool = store.ui.tool;
      const hit = this.stage.pick(e.clientX, e.clientY);
      const target = precise ? null : this.zoneAt(hit);
      if (target) {
        const lift = this.stage.liftOf(target.oh.id);
        this.ov.setZone(affectedZoneGeometry(target.oh, target.zone), zoneTip(target.oh, target.zone), [hit!.point.x, hit!.point.y + lift, hit!.point.z], target.oh.id);
        const z = target.zone;
        this.el.style.cursor = z.kind === 'slope' && z.locked ? 'default'
          : z.kind === 'ridge' || z.kind === 'apex' || z.kind === 'flatTop' ? 'ns-resize'
            : z.kind === 'ridgeEnd' || z.kind === 'endFace' ? 'ew-resize' : 'grab';
      } else {
        this.ov.setZone(null);
        this.el.style.cursor = precise ? 'grab' : tool === 'place' ? 'copy' : tool === 'select' && store.ui.mode === 'make' ? 'default' : 'crosshair';
      }
    }
  }

  // applies the latest queued handle move (called once per frame, and on release so the last position counts)
  private flushHandleMove() {
    if (this.moveRaf) cancelAnimationFrame(this.moveRaf);
    this.moveRaf = 0;
    const e = this.queuedMove;
    this.queuedMove = null;
    if (!e || !this.handle) return;
    const pt = this.dragPoint(this.handle, e);
    if (!pt) return;
    const res = this.handle.drag(pt, e);
    if (!res) return;
    const start = this.handleStartProject ?? store.project;
    let reason = res.reason;
    let after: Project | null = null;
    let candidateOp = res.op;
    if (res.op) {
      after = runTxn(start, res.op).after;
      if (!reason) {
        const qualified = qualifyRoofEdit(start, after);
        if (qualified.reason) reason = qualified.reason;
        else {
          candidateOp = withRoofProfiles(res.op, qualified.profiles);
          after = qualified.profiles.size ? runTxn(start, candidateOp).after : after;
        }
      }
    }
    const changed = !!after && JSON.stringify(after) !== JSON.stringify(start);
    if (reason) {
      const lift = this.stage.liftOf(this.handleStartSelection ?? '');
      this.ov.measure = { text: `Kept the last valid shape · ${reason}`, pos: new THREE.Vector3(pt.plan[0], pt.y + lift + 0.4, pt.plan[1]) };
    } else if (candidateOp && changed) {
      this.handleOp = candidateOp;
      this.handleChanged = true;
      this.handleLabel = res.commit;
      store.setPreview(candidateOp);
      this.ov.measure = res.measure ? { text: res.measure, pos: new THREE.Vector3(pt.plan[0], pt.y + this.stage.liftOf(this.handleStartSelection ?? '') + 0.4, pt.plan[1]) } : null;
    } else {
      this.handleOp = null;
      this.handleChanged = false;
      this.handleLabel = undefined;
      store.setPreview(null);
      this.ov.measure = res.measure ? { text: res.measure, pos: new THREE.Vector3(pt.plan[0], pt.y + this.stage.liftOf(this.handleStartSelection ?? '') + 0.4, pt.plan[1]) } : null;
    }
    const shownOh = store.shown.overheads.find((o) => o.id === this.handleStartSelection);
    if (this.handleZone && shownOh) {
      const lift = this.stage.liftOf(shownOh.id);
      const tip = reason ? `Kept the last valid roof · ${reason}` : res.measure || zoneTip(shownOh, this.handleZone);
      this.ov.setZone(affectedZoneGeometry(shownOh, this.handleZone), tip, [pt.plan[0], pt.y + lift, pt.plan[1]], shownOh.id);
    }
    const hy = this.handle.mode.type === 'plan' ? this.handle.mode.y : 0;
    if (this.handle.mode.type === 'plan') {
      const at = res.at ?? pt.plan;
      this.ov.moveActive(new THREE.Vector3(at[0], this.handle.pos.y, at[1]));
    } else if (this.handle.mode.type === 'vertical') this.ov.moveActive(new THREE.Vector3(this.handle.pos.x, pt.y + this.stage.liftOf(this.handleStartSelection ?? ''), this.handle.pos.z));
    this.ov.setKnot(res.knot ? [res.knot[0], hy, res.knot[1]] : null);
    this.ov.setGuides(res.guides ?? null, hy, res.snap ? { text: res.snap, at: pt.plan } : null);
    if (res.snap && !reason) this.ov.measure = null;
  }

  private onUp(e: PointerEvent) {
    if (this.state === 'handle') this.flushHandleMove();
    const st = this.state;
    this.state = 'idle';
    if (st === 'camera') {
      this.camDrag = null;
      this.el.style.cursor = '';
      return;
    }
    if (st === 'handle' && this.handle) {
      const op = this.handleOp;
      const h = this.handle;
      this.handle = null;
      this.handleOp = null;
      const changed = this.handleChanged;
      this.handleChanged = false;
      this.handleStartProject = null;
      this.handleStartSelection = null;
      this.handleZone = null;
      this.ov.activeHandle = null;
      this.ov.measure = null;
      this.ov.setKnot(null);
      this.ov.setGuides(null);
      this.ov.setZone(null);
      store.set({ dragging: false });
      if (op && changed) {
        const sel = store.ui.selection;
        const name = sel === 'building' ? 'the whole building' : elementName(store.project, sel ?? '');
        store.commit(this.handleLabel ?? (h.id === 'roof-bend' ? `Bent ${name}’s profile` : h.id.startsWith('pp:') ? `Moved a point on ${name}’s profile` : `Shaped ${name}`), op);
      } else store.setPreview(null);
      this.handleLabel = undefined;
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
    if ((st === 'pending' || st === 'zonepending') && this.down) {
      this.click(this.down.hit, e);
      this.down = null;
      this.zonePending = null;
      this.ov.setZone(null);
    }
  }

  private dragPoint(h: Handle, e: PointerEvent): { plan: V2; y: number } | null {
    const ray = this.stage.ray(e.clientX, e.clientY);
    const m = h.mode;
    if (m.type === 'plan') {
      // Handle positions are lifted with their part. Intersect the matching raised plane while keeping the returned
      // plan coordinate in model space, so a gesture during inspection lift starts without a parallax jump.
      const q = this.stage.planAt(e.clientX, e.clientY, m.y + this.stage.liftOf(this.handleStartSelection ?? store.ui.selection ?? ''));
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
  /** Stop whatever the pointer was doing, leaving the building and the view as they were. */
  cancelGesture() {
    const state = this.state;
    this.state = 'idle';
    if (state === 'stroke' && this.stroke) {
      if (this.stroke.purpose === 'slice') store.cancelPeek();
      this.stroke = null;
      this.ov.setTrail(null);
      this.ov.setKnot(null);
      this.ov.setGuides(null);
      this.ov.setReading(null);
      this.live.style.display = 'none';
    } else if (state === 'handle' || state === 'objdrag') {
      if (this.moveRaf) cancelAnimationFrame(this.moveRaf);
      this.moveRaf = 0;
      this.queuedMove = null;
      this.handle = null;
      this.handleOp = null;
      this.handleStartProject = null;
      this.handleStartSelection = null;
      this.handleChanged = false;
      this.handleZone = null;
      this.handleLabel = undefined;
      this.objDrag = null;
      this.ov.activeHandle = null;
      this.ov.measure = null;
      this.ov.setKnot(null);
      this.ov.setGuides(null);
      this.ov.setTrail(null);
      this.ov.setZone(null);
      store.set({ dragging: false });
      store.setPreview(null);
    }
    if (state === 'zonepending') {
      this.zonePending = null;
      this.ov.setZone(null);
    }
    this.camDrag = null;
    this.down = null;
  }

  private snapTol() {
    return Math.max(0.25, 14 * this.stage.mpp());
  }

  /** The slice plane for a line drawn from a to b: the side nearest the camera is cut away; drawn past the building. */
  private sliceOf(a: V2, b: V2): { a: V2; b: V2 } | null {
    if (dist(a, b) < 0.5) return null;
    const n = norm(perp(sub(b, a)));
    const cam = this.stage.camera.position;
    if (dot(n, sub([cam.x, cam.z], a)) > 0) [a, b] = [b, a];
    const dir = norm(sub(b, a));
    const bb = derive(store.project).bounds;
    const ext = bb.empty ? 6 : dist(bb.min, bb.max) * 0.6 + 3;
    return { a: sub(a, mul(dir, ext)), b: add(b, mul(dir, ext)) };
  }

  private beginStroke(x: number, y: number, hit: Hit | null, shift = false) {
    const p = store.project;
    const d = derive(p);
    const v = store.view;
    const tool = store.ui.tool;
    const mode = store.ui.mode;
    const purpose: Stroke['purpose'] = tool === 'slice' ? 'slice' : mode === 'tell' ? 'route' : 'draw';
    const s: Stroke = { wall: null, y: 0, onSheet: false, surface: { kind: 'ground', y: 0 }, surfaceName: 'the ground', onRoof: null, level: 0, pts: [], scr: [], hits: [], sy: [], trail: [], magA: null, lastRead: 0, purpose, a0: null, line: null, slice: null };
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
        s.a0 = m ? m.p : snapPoint(p, q, { level: s.level, tol: this.snapTol(), walls: false }).p;
      }
    }
    if (s.purpose === 'slice') {
      const q = this.stage.planAt(x, y, s.y);
      if (q) s.a0 = snapPoint(p, q, { level: 0, tol: this.snapTol(), anyLevel: true }).p;
      store.beginPeek('slice');
    }
    this.addStrokePoint(x, y, shift);
  }

  private addStrokePoint(x: number, y: number, shift = false) {
    const s = this.stroke!;
    if (s.purpose === 'slice') return this.sliceTo(x, y, shift);
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
    // ⇧: a straight line from where the stroke began to the snapped pen (the raw stroke is kept: let go of ⇧ to draw freely)
    s.line = null;
    if (shift && s.purpose === 'draw' && !s.wall && s.a0 && s.pts.length) {
      const sn = snapPoint(store.project, s.pts[s.pts.length - 1], { level: s.level, tol: this.snapTol(), anchors: [s.a0] });
      if (dist(s.a0, sn.p) > 0.2) s.line = { a: s.a0, b: sn.p, snap: sn };
    }
    if (s.line) {
      this.ov.setTrail([new THREE.Vector3(s.line.a[0], s.y, s.line.a[1]), new THREE.Vector3(s.line.b[0], s.y, s.line.b[1])], '#1f1c19');
      this.ov.setGuides(s.line.snap.guides, s.y, null);
      this.ov.setKnot(s.line.snap.touching ? [s.line.b[0], s.y, s.line.b[1]] : null, true, s.magA ? [s.magA.p[0], s.y, s.magA.p[1]] : null);
    } else {
      this.ov.setTrail(s.trail, s.purpose === 'route' ? '#2f4bd8' : '#1f1c19');
      this.ov.setGuides(null);
    }
    // knot at the end: a pencil suggestion until you let go on it
    if (!s.wall && !s.line && s.purpose === 'draw' && s.pts.length > 2) {
      const last = s.pts[s.pts.length - 1];
      const m = findMagnet(store.project, last, s.level, Math.max(0.3, 16 * this.stage.mpp()));
      const a = s.magA ? ([s.magA.p[0], s.y, s.magA.p[1]] as [number, number, number]) : null;
      this.ov.setKnot(m ? [m.p[0], s.y, m.p[1]] : null, true, a);
    }
    const now = performance.now();
    if (s.line || now - s.lastRead > 90) {
      s.lastRead = now;
      this.showLive(x, y);
    }
  }

  /** Slices are always straight: snapped from where you pressed to the pen, previewed live without history. */
  private sliceTo(x: number, y: number, fine: boolean) {
    const s = this.stroke!;
    const q = this.stage.planAt(x, y, s.y);
    if (!q || !s.a0) return;
    const sn = snapPoint(store.project, q, { level: 0, tol: this.snapTol(), anchors: [s.a0], anyLevel: true, fine });
    s.pts = [s.a0, sn.p];
    s.slice = this.sliceOf(s.a0, sn.p);
    if (s.slice) store.updatePeek({ slice: s.slice });
    this.ov.setTrail([new THREE.Vector3(s.a0[0], s.y, s.a0[1]), new THREE.Vector3(sn.p[0], s.y, sn.p[1])], '#d9472b');
    this.ov.setGuides(sn.guides, s.y, null);
    const r = this.el.getBoundingClientRect();
    this.live.innerHTML = s.slice ? `<b>Slice</b> · ${sn.label || `${dist(s.a0, sn.p).toFixed(2)} m`} <span class="alt">Esc cancels</span>` : 'drag across the building to slice it';
    this.live.style.display = 'block';
    this.live.style.transform = `translate(${x - r.left + 18}px, ${y - r.top + 14}px)`;
  }

  private buildReadings(s: Stroke, x: number, y: number): { readings: Reading[]; ctx: any; fit?: StrokeFit } | null {
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
    if (s.line) {
      // a ruled line: read exactly as drawn (already snapped), its ends touching what they landed on
      const { a, b } = s.line;
      const fit: StrokeFit = { kind: 'open', pts: [a, b], bulge: [0], closed: false, center: lerp2(a, b, 0.5), radius: 0, length: dist(a, b), curved: false, corners: 0 };
      const tol = 0.02;
      const magA = s.magA ?? findMagnet(p, a, s.level, tol);
      const magB = s.line.snap.touching ? findMagnet(p, b, s.level, tol) : null;
      const snap = s.onSheet ? d.snaps.find((sn) => Math.abs(sn.y - s.y) < 0.03) ?? null : null;
      const readings = readStroke({ p, d, plane: { y: s.y, onSheet: s.onSheet, surface: s.surface, surfaceName: s.surfaceName }, fit, rawFit: fit, plan: [a, b], magA, magB, wallFace: null, stairTo: null, onRoof: s.onRoof, sheetSnap: snap });
      return { readings, ctx: null, fit };
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
    return { readings, ctx: null, fit: stairTo ? undefined : fit };
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
      if (first) text = `<b>${first.label}</b> · ${s.line?.snap.label ? `${s.line.snap.label} · ` : ''}${first.detail}${res!.readings.length > 1 ? ` <span class="alt">+${res!.readings.length - 1} other reading${res!.readings.length > 2 ? 's' : ''}</span>` : ''}`;
      // what the stroke will become, in blue under the pen (so the snapping is visible before you let go)
      this.ov.setReading(!s.line && first && res?.fit ? fitPath(res.fit, s.y) : null);
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
    this.ov.setGuides(null);
    this.ov.setReading(null);
    if (s.purpose === 'slice') {
      store.set({ tool: store.ui.baseTool });
      if (!s.slice) return store.cancelPeek();
      // one "back" step for the whole gesture; it returns to the view (and camera) from before you pressed
      store.commitPeek();
      const { a, b } = s.slice;
      const nn = perp(norm(sub(b, a)));
      this.stage.ctl.glideTo(Math.atan2(-nn[0], -nn[1]), 1.18);
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

  // ------------------------------------------------------------------ wheel, pinch & keys
  // A wheel "stream" is a run of events with no gap over 150 ms. Its source (trackpad or mouse) is decided once,
  // at its start, so a fast trackpad flick in the middle of a stream can't suddenly read as mouse-wheel zoom.
  private wheel = { last: -1e9, src: 'trackpad' as 'trackpad' | 'mouse', pivot: null as THREE.Vector3 | null, pivotAt: [0, 0] as V2, gesture: false, scale: 1, rot: 0 };
  /** Dev evidence: raw input with what it was read as (see testkit `trace`). */
  trace: TraceEv[] | null = null;
  lastInput = '';

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    this.handleWheel({ t: performance.now(), dx: e.deltaX, dy: e.deltaY, mode: e.deltaMode, ctrl: e.ctrlKey, shift: e.shiftKey, x: e.clientX, y: e.clientY, wdy: (e as any).wheelDeltaY });
  }

  private pivotAt(x: number, y: number): THREE.Vector3 | null {
    const h = this.stage.pick(x, y);
    if (h) return h.point;
    const q = this.stage.planAt(x, y, this.stage.ctl.target.y);
    return q ? new THREE.Vector3(q[0], this.stage.ctl.target.y, q[1]) : null;
  }

  /** One wheel event, already read off the DOM (so recorded traces replay through exactly this code). */
  handleWheel(w: WheelIn) {
    if (store.ui.mode === 'visit') return;
    const ctl = this.stage.ctl;
    const st = this.wheel;
    const fresh = Math.abs(w.t - st.last) > 150;
    st.last = w.t;
    if (fresh) {
      st.pivot = null;
      st.src = wheelSource(w);
    } else if (st.src === 'mouse' && w.dx !== 0) st.src = 'trackpad'; // only a sideways scroll proves a trackpad mid-stream
    // the point under the cursor stays put while zooming; picked once per stream, again if the cursor wanders
    if (st.pivot && Math.hypot(w.x - st.pivotAt[0], w.y - st.pivotAt[1]) > 24) st.pivot = null;
    const pivot = () => {
      if (!st.pivot) {
        st.pivot = this.pivotAt(w.x, w.y);
        st.pivotAt = [w.x, w.y];
      }
      return st.pivot;
    };
    let read: string;
    if (w.ctrl) {
      // pinch (Chrome, Firefox) — Safari sends gesture events instead; never apply both
      if (st.gesture) read = 'pinch (ignored: gesture active)';
      else {
        const dy = THREE.MathUtils.clamp(w.dy * (w.mode === 1 ? 16 : 1), -60, 60);
        ctl.zoomAt(Math.exp(dy * 0.01), pivot(), true);
        read = 'pinch zoom';
      }
    } else if (st.src === 'mouse') {
      ctl.zoomAt(Math.exp(Math.sign(w.dy) * 0.14), pivot(), false);
      read = 'mouse wheel zoom';
    } else {
      const dx = THREE.MathUtils.clamp(w.dx, -80, 80), dy = THREE.MathUtils.clamp(w.dy, -80, 80);
      if (w.shift) {
        ctl.panBy(-dx, -dy, this.stage.mpp());
        read = 'trackpad pan';
      } else {
        ctl.orbitBy(-dx * 0.9, -dy * 0.6);
        read = 'trackpad orbit';
      }
    }
    this.noteInput('wheel', w, read);
  }

  /** Safari trackpad pinch/rotate. */
  handleGesture(type: 'start' | 'change' | 'end', g: { t: number; scale: number; rotation: number; x: number; y: number }) {
    if (store.ui.mode === 'visit') return;
    const st = this.wheel;
    const ctl = this.stage.ctl;
    if (type === 'start') {
      st.gesture = true;
      st.scale = 1;
      st.rot = 0;
      st.pivot = this.pivotAt(g.x, g.y);
    } else if (type === 'change') {
      if (g.scale > 0) ctl.zoomAt(st.scale / g.scale, st.pivot, true);
      ctl.rotateBy(-THREE.MathUtils.degToRad(g.rotation - st.rot));
      st.scale = g.scale;
      st.rot = g.rotation;
    } else st.gesture = false;
    this.noteInput('gesture', g, `gesture ${type}`);
  }

  private noteInput(kind: string, ev: any, read: string) {
    this.lastInput = read;
    if (!this.trace) return;
    const c = this.stage.ctl;
    this.trace.push({ kind, ev: { ...ev }, read, cam: { az: +c.az.toFixed(4), pol: +c.pol.toFixed(4), dist: +c.dist.toFixed(3) } });
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
    if (k === 'r' && !mod && this.state === 'idle' && store.ui.mode === 'make' && store.ui.tool === 'select') {
      const oh = store.project.overheads.find((o) => o.id === store.ui.selection);
      if (oh) {
        const turn = qualifyRidgeTurn(store.project, oh.id);
        if (turn.available && turn.reason) store.toast(turn.reason);
        else if (turn.available && turn.op) {
          e.preventDefault();
          store.commit(`Turned ${oh.name}’s ridge`, turn.op);
        }
      }
      return;
    }
    if (k === 'escape') {
      if (this.stroke || this.state === 'handle' || this.state === 'zonepending' || this.state === 'objdrag') return this.cancelGesture();
      if (store.ui.readingChip) return store.set({ readingChip: null });
      const base = store.ui.mode === 'make' ? store.ui.baseTool : 'pen';
      // a pen picked up for the sheet goes down with the sheet (store.back below), so Esc never strands it out
      if (store.ui.tool !== base && !store.ui.sheetPen) return store.set({ tool: base, placeType: null });
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
      if (next !== undefined) store.setView({ sheetOut: true, sheetY: next, ...(v.focusY !== null ? { focusY: next } : {}) }, v.sheetOut ? undefined : 'sheet');
      else if (k === '[') store.setView({ sheetOut: false, focusY: null });
      return;
    }
    if (k === '1') return this.view('model');
    if (k === '2') return this.view('plan');
    if (k === '3') return this.view('eye');
    if (k === 'f') return this.frameAll();
    if (k === 'q') return ctl.turn(Math.PI / 4);
    if (k === 'e') return ctl.turn(-Math.PI / 4);
    if (k === 'p') return store.set({ people: !store.ui.people });
    if (store.ui.mode === 'make' && !mod && (k === 'v' || k === 'd')) {
      const t = k === 'v' ? 'select' : 'pen';
      return store.set({ tool: t, baseTool: t, placeType: null });
    }
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

/** A fitted stroke as a polyline at height y. */
function fitPath(f: StrokeFit, y: number): THREE.Vector3[] {
  if (f.kind === 'circle') return Array.from({ length: 65 }, (_, i) => new THREE.Vector3(f.center[0] + f.radius * Math.cos((i / 64) * Math.PI * 2), y, f.center[1] + f.radius * Math.sin((i / 64) * Math.PI * 2)));
  if (f.pts.length < 2) return [];
  const out: V2[] = [f.pts[0]];
  const n = f.closed ? f.pts.length : f.pts.length - 1;
  for (let i = 0; i < n; i++) {
    const b = f.pts[(i + 1) % f.pts.length];
    out.push(...flattenSeg(f.pts[i], b, f.bulge[i] ?? 0).slice(1), b);
  }
  return out.map((q) => new THREE.Vector3(q[0], y, q[1]));
}
