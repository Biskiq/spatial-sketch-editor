// Dev-only: drive the pen from the console with synthetic pointer strokes (used for checking journeys).
import { store } from '../store';
import { SAMPLES } from '../samples/samples';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const testkit = {
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
      readings: s.top?.readings?.map((r) => r.label),
      sel: s.ui.selection,
      runs: s.project.runs.length,
      rooms: s.project.rooms.filter((r) => !r.dormant).map((r) => r.name),
      issues: s.issues().map((i) => i.text),
      notes: s.top?.result.notes.map((n) => n.text),
      parked: s.project.parked.map((k) => k.label),
    };
  },
};
