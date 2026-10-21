// Dev-only: drive the pen from the console with synthetic pointer strokes (used for checking journeys).
import * as THREE from 'three';
import { store } from '../store';
import { SAMPLES } from '../samples/samples';
import { emptyProject } from '../model/types';
import { opAddOverhead, runTxn } from '../model/ops';
import { roofZoneAt } from '../model/roofZones';
import { ohTopAt, presetProfile } from '../model/overheadGeom';
import { pointInPoly } from '../model/geom2d';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ix = () => (window as any).__app.ix as import('../scene/interact').Interact;
let lastTrace: import('../scene/interact').TraceEv[] = [];

/**
 * Navigation evidence. On a real trackpad: `__t.trace.start()`, orbit / pinch / flick for a few seconds, then
 * `copy(__t.trace.dump())`. A dump replays through the same wheel code: `__t.trace.replay(json)` reports any event
 * now read differently and the largest single-event camera step (a jump shows up as a spike).
 */
const trace = {
  start() {
    ix().trace = [];
    return 'recording wheel and gesture input';
  },
  stop() {
    lastTrace = ix().trace ?? lastTrace;
    ix().trace = null;
    return `${lastTrace.length} events`;
  },
  dump() {
    if (ix().trace) this.stop();
    return JSON.stringify(lastTrace);
  },
  replay(json: string | import('../scene/interact').TraceEv[]) {
    const evs = typeof json === 'string' ? JSON.parse(json) : json;
    const i = ix();
    const c = (window as any).__app.stage.ctl;
    i.trace = [];
    for (const e of evs) {
      if (e.kind === 'wheel') i.handleWheel(e.ev);
      else i.handleGesture(e.read.split(' ')[1], e.ev);
    }
    const now = i.trace;
    i.trace = null;
    const changed = now.map((e, k) => (e.read !== evs[k].read ? { k, was: evs[k].read, now: e.read } : null)).filter(Boolean);
    let maxZoom = 0, maxOrbit = 0;
    for (let k = 1; k < now.length; k++) {
      maxZoom = Math.max(maxZoom, Math.abs(Math.log(now[k].cam.dist / now[k - 1].cam.dist)));
      maxOrbit = Math.max(maxOrbit, Math.abs(now[k].cam.az - now[k - 1].cam.az), Math.abs(now[k].cam.pol - now[k - 1].cam.pol));
    }
    void c;
    const reads: Record<string, number> = {};
    for (const e of now) reads[e.read] = (reads[e.read] ?? 0) + 1;
    return { events: now.length, reads, changed, maxZoomStepPct: Math.round((Math.exp(maxZoom) - 1) * 1000) / 10, maxOrbitStepRad: Math.round(maxOrbit * 1e4) / 1e4 };
  },
};

export const testkit = {
  trace,
  /** Minimal L-shaped roof for pointer-driven grouped-roof evidence. */
  async compoundFixture() {
    const p = runTxn(emptyProject('Hold · compound wings'), opAddOverhead(
      [[0, 0], [10, 0], [10, 6], [6, 6], [6, 14], [0, 14]], 3,
      { dir: 0, oneSpan: false, profile: presetProfile('gable', 6), name: 'L roof' },
    )).after;
    store.load(p);
    store.set({ start: false });
    await wait(50);
    this.tick(2);
    const roof = store.project.overheads[0];
    store.select(roof.id);
    (window as any).__app.ix.frameAll();
    await wait(200);
    return this.state();
  },
  zoneAt(x: number, y: number) {
    const st = (window as any).__app.stage as import('../scene/stage').Stage;
    const hit = st.pick(x, y);
    const oh = store.project.overheads.find((o) => o.id === store.ui.selection);
    if (!oh || hit?.kind !== 'roof' || hit.id !== oh.id) return null;
    const mpp = st.mpp(hit.point);
    const zone = roofZoneAt(oh, [hit.point.x, hit.point.z], { ridge: 14 * mpp, end: 18 * mpp, eave: 12 * mpp });
    return zone ? { roofId: oh.id, hit: [hit.point.x, hit.point.y, hit.point.z] as [number, number, number], ...zone } : null;
  },
  roofPoint(roofId: string, x: number, z: number) {
    const st = (window as any).__app.stage as import('../scene/stage').Stage;
    const c = document.querySelector('.stage-canvas') as HTMLCanvasElement;
    const roof = store.project.overheads.find((o) => o.id === roofId);
    if (!roof) return null;
    const lift = st.liftOf(roofId);
    const [sx, sy] = st.screenOf(new THREE.Vector3(x, ohTopAt(roof, [x, z]) + lift + 0.02, z));
    const r = c.getBoundingClientRect();
    return { x: r.left + sx, y: r.top + sy, hit: st.pick(r.left + sx, r.top + sy)?.id === roofId };
  },
  /** Find a visible point in the requested zone, then drive Interact with real pointer events. */
  async dragZone(roofId: string, kind: string, dx: number, dy: number, opts: { alt?: boolean; altOnMove?: boolean; cancel?: boolean } = {}) {
    const st = (window as any).__app.stage as import('../scene/stage').Stage;
    const c = document.querySelector('.stage-canvas') as HTMLCanvasElement;
    const roof = store.project.overheads.find((o) => o.id === roofId);
    if (!roof) return { error: 'roof not found', ...this.state() };
    const xs = roof.outline.map((q) => q[0]), zs = roof.outline.map((q) => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const step = Math.max(0.25, Math.max(maxX - minX, maxZ - minZ) / 40);
    const rect = c.getBoundingClientRect();
    let start: [number, number] | null = null;
    for (let x = minX + step / 2; x < maxX; x += step) {
      for (let z = minZ + step / 2; z < maxZ; z += step) {
        if (!pointInPoly([x, z], roof.outline)) continue;
        const lift = st.liftOf(roofId);
        const [sx, sy] = st.screenOf(new THREE.Vector3(x, ohTopAt(roof, [x, z]) + lift + 0.02, z));
        const px = rect.left + sx, py = rect.top + sy;
        const hit = st.pick(px, py);
        if (!hit || hit.kind !== 'roof' || hit.id !== roofId) continue;
        const mpp = st.mpp(hit.point);
        const zone = roofZoneAt(roof, [hit.point.x, hit.point.z], { ridge: 14 * mpp, end: 18 * mpp, eave: 12 * mpp });
        if (zone?.kind === kind) { start = [px, py]; break; }
      }
      if (start) break;
    }
    if (!start) return { error: `no visible ${kind} zone found`, ...this.state() };
    const ev = (type: string, x: number, y: number, target: EventTarget, alt = !!opts.alt) => target.dispatchEvent(new PointerEvent(type, {
      clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      pointerId: 17, bubbles: true, altKey: alt,
    }));
    this.tick(2);
    ev('pointerdown', start[0], start[1], c);
    ev('pointermove', start[0] + dx * 0.45, start[1] + dy * 0.45, window, opts.altOnMove ?? !!opts.alt);
    await wait(16);
    ev('pointermove', start[0] + dx, start[1] + dy, window, opts.altOnMove ?? !!opts.alt);
    await wait(16);
    const feedback = (window as any).__app.ov.zoneTip?.text ?? (window as any).__app.ov.measure?.text ?? null;
    if (opts.cancel) ev('pointercancel', start[0] + dx, start[1] + dy, window);
    else ev('pointerup', start[0] + dx, start[1] + dy, window);
    await wait(60);
    this.tick(3);
    return { start, feedback, zone: this.zoneAt(start[0], start[1]), ...this.state() };
  },
  /** Drive an existing handle through the same captured canvas pointer path. */
  async dragHandle(id: string, dx: number, dy: number, opts: { alt?: boolean; cancel?: boolean } = {}) {
    const st = (window as any).__app.stage as import('../scene/stage').Stage;
    const c = document.querySelector('.stage-canvas') as HTMLCanvasElement;
    const h = (window as any).__app.ov.handles.find((item: import('../scene/handles').Handle) => item.id === id) as import('../scene/handles').Handle | undefined;
    if (!h) return { error: `handle ${id} not found`, ...this.state() };
    const r = c.getBoundingClientRect();
    const [sx, sy] = st.screenOf(h.pos);
    const start: [number, number] = [r.left + sx, r.top + sy];
    const ev = (type: string, x: number, y: number, target: EventTarget) => target.dispatchEvent(new PointerEvent(type, {
      clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      pointerId: 19, bubbles: true, altKey: !!opts.alt,
    }));
    this.tick(2);
    ev('pointerdown', start[0], start[1], c);
    ev('pointermove', start[0] + dx * 0.45, start[1] + dy * 0.45, window);
    await wait(16);
    ev('pointermove', start[0] + dx, start[1] + dy, window);
    await wait(16);
    const feedback = (window as any).__app.ov.measure?.text ?? null;
    if (opts.cancel) ev('pointercancel', start[0] + dx, start[1] + dy, window);
    else ev('pointerup', start[0] + dx, start[1] + dy, window);
    await wait(60);
    this.tick(3);
    return { start, feedback, ...this.state() };
  },
  async stroke(pts: [number, number][], opts: { alt?: boolean; shift?: boolean; button?: number } = {}) {
    const c = document.querySelector('.stage-canvas')!;
    const ev = (t: string, x: number, y: number, tgt: EventTarget) =>
      tgt.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, button: opts.button ?? 0, buttons: t === 'pointerup' ? 0 : 1, pointerId: 7, bubbles: true, altKey: !!opts.alt, shiftKey: !!opts.shift }));
    this.tick(2);
    ev('pointerdown', pts[0][0], pts[0][1], c);
    for (const p of pts.slice(1)) {
      ev('pointermove', p[0], p[1], window);
      await wait(6);
    }
    ev('pointerup', pts[pts.length - 1][0], pts[pts.length - 1][1], window);
    await wait(60);
    this.tick(3);
    return this.state();
  },
  async click(x: number, y: number) {
    return this.stroke([[x, y]]);
  },
  arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 40): [number, number][] {
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  },
  line(a: [number, number], b: [number, number], n = 20): [number, number][] {
    return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  },
  path(pts: [number, number][], per = 10): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i + 1 < pts.length; i++) out.push(...this.line(pts[i], pts[i + 1], per).slice(i ? 1 : 0));
    return out;
  },
  async sample(id: string) {
    const smp = SAMPLES.find((x) => x.id === id)!;
    store.load(smp.make());
    store.set({ start: false });
    await wait(50);
    this.tick(2);
    (window as any).__app.ix.frameAll();
    const c = (window as any).__app.stage.ctl;
    c.cTarget.copy(c.target);
    c.cDist = c.dist;
    await wait(200);
    return this.state();
  },
  /** Step the render loop by hand (a hidden browser pane pauses requestAnimationFrame). */
  tick(n = 20) {
    const st = (window as any).__app.stage;
    for (let i = 0; i < n; i++) st.frame();
  },
  /** Point the camera (instantly) at a model point. */
  async look(x: number, y: number, z: number, dist: number, az?: number, pol?: number) {
    const c = (window as any).__app.stage.ctl;
    c.mode = 'orbit';
    c.target.set(x, y, z);
    c.cTarget.set(x, y, z);
    c.dist = c.cDist = dist;
    if (az !== undefined) c.az = c.cAz = az;
    if (pol !== undefined) c.pol = c.cPol = pol;
    store.emit();
    this.tick(4);
    await wait(30);
  },
  /** Screen position of a model point. */
  scr(x: number, y: number, z: number): [number, number] {
    const st = (window as any).__app.stage;
    const v = st.camera.position.clone().set(x, y, z);
    return st.screenOf(v);
  },
  state() {
    const s = store;
    return {
      top: s.top?.label,
      history: { undo: s.past.length, redo: s.future.length },
      readings: s.top?.readings?.map((r) => r.label),
      sel: s.ui.selection,
      preview: !!s.preview,
      camera: { az: +((window as any).__app.stage.ctl.az).toFixed(4), pol: +((window as any).__app.stage.ctl.pol).toFixed(4), dist: +((window as any).__app.stage.ctl.dist).toFixed(3) },
      roofs: s.project.overheads.map((o) => ({ id: o.id, name: o.name, oneSpan: o.oneSpan, form: o.form, dir: o.dir, hip: o.hip, baseY: o.baseY, fit: o.fit, profile: o.profile, outline: o.outline })),
      runs: s.project.runs.length,
      rooms: s.project.rooms.filter((r) => !r.dormant).map((r) => r.name),
      issues: s.issues().map((i) => i.text),
      notes: s.top?.result.notes.map((n) => n.text),
      parked: s.project.parked.map((k) => k.label),
    };
  },
};
