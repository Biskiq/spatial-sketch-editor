// Visit: the building told. The creator's own ways of seeing (lifting, cutting, slicing, light) become
// presentation-only reveals. Nothing here edits the building; the creator's view is restored on exit.
import * as THREE from 'three';
import { store } from '../store';
import type { Stage, Presentation } from '../scene/stage';
import type { Project, Moment } from '../model/types';
import { derive } from '../model/derive';
import { V2, dist, lerp2, norm, sub } from '../model/geom2d';
import { surfacesAt } from './route';

interface Sample {
  p: V2;
  s: number;
  y: number;
}

export function routeProfile(p: Project, route: V2[], startY: number): Sample[] {
  const out: Sample[] = [];
  if (route.length < 2) return out;
  let y = startY, s = 0;
  out.push({ p: route[0], s: 0, y });
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const n = Math.max(1, Math.ceil(dist(a, b) / 0.2));
    for (let k = 1; k <= n; k++) {
      const q = lerp2(a, b, k / n);
      s += dist(a, b) / n;
      const c = surfacesAt(p, q);
      let best = y, bd = Infinity;
      for (const h of c) {
        const dd = Math.abs(h - y);
        if (dd < 0.45 && dd < bd) {
          bd = dd;
          best = h;
        }
      }
      if (bd === Infinity) best = c.filter((h) => h <= y + 0.01).sort((u, v) => v - u)[0] ?? Math.min(...c);
      y = best;
      out.push({ p: q, s, y });
    }
  }
  return out;
}

function at(samples: Sample[], s: number): Sample {
  if (s <= 0) return samples[0];
  const L = samples[samples.length - 1].s;
  if (s >= L) return samples[samples.length - 1];
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (samples[m].s <= s) lo = m;
    else hi = m;
  }
  const a = samples[lo], b = samples[hi];
  const k = (s - a.s) / Math.max(b.s - a.s, 1e-9);
  return { p: lerp2(a.p, b.p, k), s, y: a.y + (b.y - a.y) * k };
}

type Phase =
  | { kind: 'intro'; dur: number }
  | { kind: 'walk'; s0: number; s1: number; dur: number }
  | { kind: 'hold'; m: Moment; idx: number; s: number; dur: number }
  | { kind: 'end'; dur: number };

export interface PlayerState {
  caption: string;
  index: number; // moment index, -1 for intro
  count: number;
  playing: boolean;
  progress: number;
  ended: boolean;
}

export class Player {
  stage: Stage;
  phases: Phase[] = [];
  samples: Sample[] = [];
  t = 0;
  total = 0;
  playing = false;
  active = false;
  state: PlayerState = { caption: '', index: -1, count: 0, playing: false, progress: 0, ended: false };
  private listeners = new Set<() => void>();
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private savedCam: any = null;
  private center = new THREE.Vector3();
  private radius = 20;
  private fromMode: 'make' | 'tell' = 'tell';

  constructor(stage: Stage) {
    this.stage = stage;
    stage.onFrame.push((dt) => this.update(dt));
  }

  on(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const f of this.listeners) f();
  }

  canPlay(p: Project) {
    return p.story.route.length > 1;
  }

  start(fromMoment?: number) {
    const p = store.project;
    if (!this.canPlay(p)) return;
    this.fromMode = store.ui.mode === 'make' ? 'make' : 'tell';
    this.savedCam = this.stage.ctl.snap();
    this.samples = routeProfile(p, p.story.route, p.story.routeStartY);
    const L = this.samples[this.samples.length - 1].s;
    const d = derive(p);
    const b = d.bounds;
    this.center.set((b.min[0] + b.max[0]) / 2, b.top * 0.35, (b.min[1] + b.max[1]) / 2);
    this.radius = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], 12);
    const speed = 1.35;
    const ms = [...p.story.moments].sort((a, c) => a.t - c.t);
    this.phases = [];
    if (p.story.intro) this.phases.push({ kind: 'intro', dur: 6.5 });
    let s = 0;
    ms.forEach((m, i) => {
      const ms_ = m.t * L;
      if (ms_ - s > 0.05) this.phases.push({ kind: 'walk', s0: s, s1: ms_, dur: (ms_ - s) / speed });
      s = Math.max(s, ms_);
      this.phases.push({ kind: 'hold', m, idx: i, s, dur: Math.max(1.5, m.dwell) });
    });
    if (L - s > 0.05) this.phases.push({ kind: 'walk', s0: s, s1: L, dur: (L - s) / speed });
    this.phases.push({ kind: 'end', dur: 1e9 });
    this.total = this.phases.reduce((a, ph) => a + (ph.kind === 'end' ? 0 : ph.dur), 0);
    this.t = 0;
    if (fromMoment !== undefined) {
      let acc = 0;
      for (const ph of this.phases) {
        if (ph.kind === 'hold' && ph.idx === fromMoment) break;
        acc += ph.kind === 'end' ? 0 : ph.dur;
      }
      this.t = acc;
    }
    this.active = true;
    this.playing = true;
    const s0 = this.samples[0];
    this.pos.set(this.center.x + this.radius * 1.4, this.radius * 1.1, this.center.z + this.radius * 1.4);
    if (!p.story.intro) this.pos.set(s0.p[0], s0.y + 1.55, s0.p[1]);
    this.look.copy(this.center);
    this.stage.ctl.external = { pos: this.pos.clone(), look: this.look.clone() };
    this.stage.presentation = { lift: p.story.intro ? 1 : 0, cutY: null, slice: null, spotlight: null };
    store.set({ mode: 'visit', readingChip: null });
    this.emit();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.playing = false;
    this.stage.ctl.external = null;
    this.stage.presentation = null;
    this.stage.setNoon(false);
    if (this.savedCam) this.stage.ctl.restore(this.savedCam);
    this.stage.ctl.cTarget.copy(this.stage.ctl.target);
    store.set({ mode: this.fromMode });
    this.emit();
  }

  toggle() {
    if (this.state.ended) {
      this.start();
      return;
    }
    this.playing = !this.playing;
    this.emit();
  }

  step(dir: 1 | -1) {
    // jump to the next / previous moment
    let acc = 0;
    const marks: number[] = [];
    for (const ph of this.phases) {
      if (ph.kind === 'hold' || ph.kind === 'intro') marks.push(acc);
      acc += ph.kind === 'end' ? 0 : ph.dur;
    }
    marks.push(this.total);
    const cur = this.t;
    const next = dir > 0 ? marks.find((m) => m > cur + 0.3) : [...marks].reverse().find((m) => m < cur - 0.6);
    this.t = next ?? (dir > 0 ? this.total : 0);
    this.playing = true;
  }

  private update(dt: number) {
    if (!this.active) return;
    if (this.playing) this.t += dt;
    let acc = 0;
    let ph: Phase = this.phases[this.phases.length - 1];
    let local = 0;
    for (const x of this.phases) {
      const dur = x.kind === 'end' ? 1e9 : x.dur;
      if (this.t < acc + dur) {
        ph = x;
        local = this.t - acc;
        break;
      }
      acc += dur;
    }
    const pres: Presentation = { lift: 0, cutY: null, slice: null, spotlight: null };
    const goalPos = new THREE.Vector3(), goalLook = new THREE.Vector3();
    let caption = '', index = -1, k = 4;
    let noon = false;
    const eye = (smp: Sample) => new THREE.Vector3(smp.p[0], smp.y + 1.55, smp.p[1]);
    const ahead = (s: number) => {
      const a = at(this.samples, s), b = at(this.samples, s + 2.6);
      const dirv = norm(sub(b.p, a.p));
      return new THREE.Vector3(a.p[0] + dirv[0] * 3, a.y + 1.35, a.p[1] + dirv[1] * 3);
    };
    if (ph.kind === 'intro') {
      const u = local / ph.dur;
      const ang = 0.9 - u * 0.9;
      const r = this.radius * (2.05 - 0.6 * u);
      goalPos.set(this.center.x + Math.sin(ang) * r, this.radius * (1.1 - 0.35 * u) + 2, this.center.z + Math.cos(ang) * r);
      goalLook.copy(this.center).add(new THREE.Vector3(0, 2.5 * (1 - u), 0));
      pres.lift = u < 0.3 ? 1 : Math.max(0, 1 - (u - 0.3) / 0.55);
      const first = store.project.story.moments[0];
      caption = first && first.t < 0.02 ? first.caption : '';
      k = 2.5;
    } else if (ph.kind === 'walk') {
      const u = local / ph.dur;
      const s = ph.s0 + (ph.s1 - ph.s0) * u;
      goalPos.copy(eye(at(this.samples, s)));
      goalLook.copy(ahead(s));
      // turn early towards the next moment's subject
      const nextHold = this.phases.find((x) => x.kind === 'hold' && x.s >= ph.s1 - 1e-6) as Extract<Phase, { kind: 'hold' }> | undefined;
      if (nextHold?.m.look && ph.s1 - s < 2.5) {
        const w = 1 - (ph.s1 - s) / 2.5;
        goalLook.lerp(new THREE.Vector3(...nextHold.m.look), w * 0.8);
      }
      k = 4;
    } else if (ph.kind === 'hold') {
      const m = ph.m;
      const smp = at(this.samples, ph.s);
      goalPos.copy(eye(smp));
      goalLook.copy(m.look ? new THREE.Vector3(...m.look) : ahead(ph.s));
      caption = m.caption;
      index = ph.idx;
      const u = local / ph.dur;
      const env = Math.min(1, u / 0.18, (1 - u) / 0.18);
      if (m.reveal === 'lift') {
        pres.lift = env;
        const back = new THREE.Vector3().subVectors(goalPos, goalLook).setY(0).normalize();
        goalPos.lerp(this.center.clone().add(back.multiplyScalar(this.radius * 1.2)).setY(this.radius * 0.8 + 2), env * 0.85);
        goalLook.lerp(this.center, env * 0.6);
      }
      if (m.reveal === 'cut') {
        pres.cutY = smp.y + 2.7 + (1 - env) * 30;
        goalPos.lerp(new THREE.Vector3(smp.p[0] + 3, smp.y + 14, smp.p[1] + 8), env * 0.85);
        goalLook.lerp(new THREE.Vector3(smp.p[0], smp.y, smp.p[1]), env * 0.7);
      }
      if (m.reveal === 'slice') {
        const target = m.look ? new THREE.Vector3(...m.look) : ahead(ph.s);
        const dirv = norm([target.x - smp.p[0], target.z - smp.p[1]]);
        // slice along the line of sight; keep the far side; step out sideways to see it
        const side: V2 = [-dirv[1], dirv[0]];
        const a: V2 = [smp.p[0] - dirv[0] * 30, smp.p[1] - dirv[1] * 30];
        const b2: V2 = [smp.p[0] + dirv[0] * 30, smp.p[1] + dirv[1] * 30];
        if (env > 0.05) pres.slice = { a: b2, b: a };
        const out = new THREE.Vector3(smp.p[0] - side[0] * this.radius * 0.9, smp.y + 3.5, smp.p[1] - side[1] * this.radius * 0.9);
        goalPos.lerp(out, env);
        goalLook.lerp(new THREE.Vector3(smp.p[0], smp.y + 2.5, smp.p[1]), env * 0.7);
      }
      if (m.reveal === 'light') noon = env > 0.2;
      k = 3;
    } else {
      // the end: rise gently and hold
      const last = this.samples[this.samples.length - 1];
      goalPos.copy(eye(last)).add(new THREE.Vector3(0, 0.4, 0));
      goalLook.copy(ahead(last.s));
      this.playing = false;
      k = 2;
    }
    this.stage.setNoon(noon);
    this.pos.lerp(goalPos, 1 - Math.exp(-k * dt));
    this.look.lerp(goalLook, 1 - Math.exp(-k * 1.2 * dt));
    this.stage.ctl.external = { pos: this.pos, look: this.look };
    this.stage.presentation = pres;
    const ended = ph.kind === 'end';
    const prog = Math.min(1, this.t / Math.max(this.total, 1e-6));
    const st = { caption, index, count: store.project.story.moments.length, playing: this.playing, progress: prog, ended };
    if (st.caption !== this.state.caption || st.index !== this.state.index || st.playing !== this.state.playing || st.ended !== this.state.ended || Math.abs(st.progress - this.state.progress) > 0.004) {
      this.state = st;
      this.emit();
    }
  }
}
