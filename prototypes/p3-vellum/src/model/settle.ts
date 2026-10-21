// After every edit the project "settles": ties are followed, rooms keep their identity, tied heights follow.
// Everything settle does is reported as notes, so nothing changes without the creator being told.
import { V2, interiorPoint, pointInPoly, pointInPolyHoles, bbox, bboxOverlap, polyArea, fmtM } from './geom2d';
import { overlapArea } from './clip';
import { arrange, Arrangement } from './arrangement';
import { resolveTies, runGeom } from './runs';
import type { Project, RoomSeed, Run, SurfaceRef } from './types';
import { newId } from './types';
import { withIds } from './overheadGeom';

export interface Note {
  kind: 'info' | 'warn' | 'good';
  text: string;
  ids: string[];
}

export const lvl = (y: number) => Math.round(y / 0.05) * 0.05;

/** A floor in the air carries what stands on it: walls (and so their rooms) whose base is on it. Returns room names moved. */
export function carryStanding(p: Project, outline: V2[], fromY: number, toY: number): string[] {
  const dy = toY - fromY;
  if (Math.abs(dy) < 1e-4) return [];
  const on = (q: V2) => pointInPoly(q, outline);
  const moved: string[] = [];
  for (const r of p.runs) {
    if (Math.abs(r.baseY - fromY) > 0.03) continue;
    const pts = r.shape === 'circle' ? [r.center] : r.pts;
    if (pts.filter(on).length < Math.ceil(pts.length / 2)) continue;
    r.baseY = toY;
  }
  for (const s of p.rooms) {
    if (Math.abs(s.level - fromY) > 0.03 || !on(s.at)) continue;
    s.level = toY;
    s.floorY += dy;
    if (!s.dormant) moved.push(s.name);
  }
  return moved;
}

export function levelsOf(p: Project): number[] {
  return [...new Set(p.runs.map((r) => lvl(r.baseY)))].sort((a, b) => a - b);
}

export const roomTop = (r: RoomSeed) => r.floorY + r.height;

const arrCache = new WeakMap<Project, { key: string; byLevel: Map<number, { arr: Arrangement; faceSeed: (string | null)[] }> }>();

function runsKey(runs: Run[]) {
  return runs.map((r) => `${r.id}:${r.shape}:${r.pts.join(';')}:${r.bulge.join(',')}:${r.closed}:${r.center}:${r.radius}:${lvl(r.baseY)}`).join('|');
}

/** Arrangements per level with each face mapped to the seed that owns it. */
export function levelArrangements(p: Project) {
  const key = runsKey(p.runs) + '#' + p.rooms.map((s) => `${s.id}:${s.dormant}:${s.at}:${s.level}`).join('|');
  const c = arrCache.get(p);
  if (c && c.key === key) return c.byLevel;
  const byLevel = new Map<number, { arr: Arrangement; faceSeed: (string | null)[] }>();
  for (const L of levelsOf(p)) {
    const arr = arrange(p.runs.filter((r) => lvl(r.baseY) === L));
    const seeds = p.rooms.filter((s) => !s.dormant && lvl(s.level) === L);
    const faceSeed = arr.faces.map((f) => seeds.find((s) => pointInPolyHoles(s.at, f.poly, f.holes))?.id ?? null);
    byLevel.set(L, { arr, faceSeed });
  }
  arrCache.set(p, { key, byLevel });
  return byLevel;
}

function roomName(p: Project) {
  const used = new Set(p.rooms.map((r) => r.name));
  for (let i = 1; ; i++) if (!used.has(`Room ${i}`)) return `Room ${i}`;
}

function childName(p: Project, parent: string) {
  const base = parent.replace(/ \(\d+\)$/, '');
  const used = new Set(p.rooms.map((r) => r.name));
  for (let i = 2; ; i++) if (!used.has(`${base} (${i})`)) return `${base} (${i})`;
}

export function surfaceY(p: Project, ref: SurfaceRef): number | null {
  switch (ref.kind) {
    case 'ground':
    case 'free':
      return ref.y;
    case 'room': {
      const r = p.rooms.find((x) => x.id === ref.id && !x.dormant);
      return r ? r.floorY : null;
    }
    case 'deck': {
      const d = p.decks.find((x) => x.id === ref.id);
      return d ? d.y : null;
    }
  }
}

export function settle(p: Project): Note[] {
  const notes: Note[] = [];
  const nameOf = (id: string) => p.rooms.find((r) => r.id === id)?.name ?? 'a room';

  // 0. every authored roof point has an identity
  for (const oh of p.overheads) oh.profile = withIds(oh.profile);

  // 1. ties
  const { dropped } = resolveTies(p);
  for (const d of dropped) notes.push({ kind: 'info', text: 'A wall end came loose — the wall it was joined to is gone. It stays where it was.', ids: [d.run] });

  // 2. rooms keep their identity through edits
  const levels = levelsOf(p);
  for (const s of p.rooms) if (!s.dormant && !levels.includes(lvl(s.level))) {
    s.dormant = true;
    notes.push({ kind: 'info', text: `${s.name} is no longer enclosed. Its settings are kept and come back if you close it again.`, ids: [s.id] });
  }
  for (const L of levels) {
    const arr = arrange(p.runs.filter((r) => lvl(r.baseY) === L));
    const faces = arr.faces;
    const active = p.rooms.filter((s) => !s.dormant && lvl(s.level) === L);
    const dormant = p.rooms.filter((s) => s.dormant && lvl(s.level) === L);
    const fb = faces.map((f) => bbox(f.poly));
    const ov = (fi: number, s: RoomSeed) => (s.poly.length < 3 || !bboxOverlap(fb[fi], bbox(s.poly)) ? 0 : overlapArea(faces[fi].poly, s.poly));
    const M: number[][] = faces.map((_, fi) => active.map((s) => ov(fi, s)));
    const succ = new Map<string, number>();
    active.forEach((s, si) => {
      let best = -1, bv = 0;
      const sArea = Math.abs(polyArea(s.poly));
      faces.forEach((_, fi) => {
        if (M[fi][si] > bv) {
          bv = M[fi][si];
          best = fi;
        }
      });
      if (best >= 0 && bv > Math.min(0.25, 0.1 * sArea)) succ.set(s.id, best);
    });
    faces.forEach((f, fi) => {
      const claim = active.filter((s) => succ.get(s.id) === fi).sort((a, b) => a.order - b.order);
      const at = interiorPoint(f.poly, f.holes);
      if (claim.length) {
        const [primary, ...others] = claim;
        primary.poly = f.poly;
        primary.holes = f.holes;
        primary.at = at;
        for (const o of others) {
          o.dormant = true;
          if (o.customized) {
            p.parked.push({ id: newId(p, 'k'), what: 'room', label: `${o.name}'s settings`, reason: `merged into ${primary.name}`, data: { seed: o.id }, at: Date.now() });
            notes.push({ kind: 'warn', text: `${o.name} joined ${primary.name}. ${primary.name}'s settings are kept; ${o.name}'s are set aside, not lost.`, ids: [primary.id] });
          } else notes.push({ kind: 'info', text: `${o.name} rejoined ${primary.name}.`, ids: [primary.id] });
        }
        return;
      }
      // a remembered room returns?
      let revive: RoomSeed | null = null, rv = 0;
      for (const d of dormant) {
        if (d.poly.length < 3) continue;
        const o = overlapArea(f.poly, d.poly);
        const m = Math.min(Math.abs(polyArea(d.poly)), f.area);
        if (o > 0.5 * m && o > rv) {
          rv = o;
          revive = d;
        }
      }
      if (revive) {
        revive.dormant = false;
        revive.poly = f.poly;
        revive.holes = f.holes;
        revive.at = at;
        p.parked = p.parked.filter((k) => !(k.what === 'room' && k.data?.seed === revive!.id));
        notes.push({ kind: 'good', text: `${revive.name} came back with its settings.`, ids: [revive.id] });
        return;
      }
      // carved out of an existing room → inherit (in pencil)
      let parent: RoomSeed | null = null, pv = 0.25;
      active.forEach((s, si) => {
        if (M[fi][si] > pv) {
          pv = M[fi][si];
          parent = s;
        }
      });
      const par = parent as RoomSeed | null;
      const seed: RoomSeed = {
        id: newId(p, 'm'), kind: 'room',
        name: par ? childName(p, par.name) : roomName(p),
        level: L, floorY: par ? par.floorY : L, height: par ? par.height : 3, ceiling: par ? par.ceiling : 'flat',
        dormant: false, customized: false, inheritedFrom: par ? par.id : null,
        poly: f.poly, holes: f.holes, at, order: p.nextId,
      };
      p.rooms.push(seed);
      if (par) notes.push({ kind: 'info', text: `${par.name} was divided. The new part, ${seed.name}, borrowed its height (${fmtM(seed.height)}) — shown in pencil until you change or confirm it.`, ids: [seed.id, par.id] });
      else notes.push({ kind: 'good', text: `A room emerged: ${seed.name}.`, ids: [seed.id] });
    });
    for (const s of active) {
      if (succ.has(s.id) || s.dormant) continue;
      s.dormant = true;
      notes.push({ kind: 'info', text: `${s.name} is open now. Its settings are kept and come back if you close it again.`, ids: [s.id] });
    }
  }

  // 3. tied heights follow
  const top = (id: string) => {
    const r = p.rooms.find((x) => x.id === id && !x.dormant);
    return r ? roomTop(r) : null;
  };
  for (const d of p.decks) {
    if (!d.restsOn) continue;
    const t = top(d.restsOn);
    if (t === null) {
      notes.push({ kind: 'info', text: `${d.name} no longer rests on a room; it stays at ${fmtM(d.y)}.`, ids: [d.id] });
      d.restsOn = null;
      continue;
    }
    if (Math.abs(t - d.y) > 1e-4) {
      notes.push({ kind: 'info', text: `${d.name} ${t > d.y ? 'rose' : 'came down'} ${fmtM(Math.abs(t - d.y), 2)} with ${nameOf(d.restsOn)}.`, ids: [d.id] });
      const carried = carryStanding(p, d.outline, d.y, t);
      if (carried.length) notes.push({ kind: 'info', text: `${carried.join(', ')} ${carried.length > 1 ? 'stand' : 'stands'} on it, so ${carried.length > 1 ? 'they' : 'it'} went too.`, ids: [d.id] });
      d.y = t;
    }
  }
  for (const oh of p.overheads) {
    if (!oh.restsOn) continue;
    const tops = oh.restsOn.map(top).filter((x): x is number => x !== null);
    if (!tops.length) {
      notes.push({ kind: 'info', text: `${oh.name} no longer rests on a room; it stays at ${fmtM(oh.baseY)}.`, ids: [oh.id] });
      oh.restsOn = null;
      continue;
    }
    const nb = Math.max(...tops) + oh.restOffset;
    if (Math.abs(nb - oh.baseY) > 1e-4) {
      notes.push({ kind: 'info', text: `${oh.name} ${nb > oh.baseY ? 'rose' : 'came down'} ${fmtM(Math.abs(nb - oh.baseY), 2)} with ${oh.restsOn.map(nameOf).join(', ')} (it rests on ${oh.restsOn.length > 1 ? 'them' : 'it'}).`, ids: [oh.id] });
      oh.baseY = nb;
    }
  }
  for (const st of p.stairs) {
    for (const end of ['from', 'to'] as const) {
      const ref = st[end];
      const y = surfaceY(p, ref);
      const key = end === 'from' ? 'fromY' : 'toY';
      if (y === null) {
        st[end] = { kind: 'free', y: st[key] };
        notes.push({ kind: 'info', text: `${st.name} lost the floor at its ${end === 'from' ? 'foot' : 'top'}; it keeps its shape.`, ids: [st.id] });
      } else if (Math.abs(y - st[key]) > 1e-4) {
        const before = stairSteps(st.fromY, st.toY);
        st[key] = y;
        const after = stairSteps(st.fromY, st.toY);
        if (after !== before) notes.push({ kind: 'info', text: `${st.name} followed: ${after > before ? 'gains' : 'loses'} ${Math.abs(after - before)} step${Math.abs(after - before) > 1 ? 's' : ''}.`, ids: [st.id] });
      }
    }
  }

  // 4. openings ride along their walls
  for (const o of [...p.openings]) {
    const r = p.runs.find((x) => x.id === o.run);
    if (!r) {
      p.openings = p.openings.filter((x) => x !== o);
      p.parked.push({ id: newId(p, 'k'), what: 'opening', label: o.name ?? openingLabel(o.shape, o.sill), reason: 'its wall was removed', data: o, at: Date.now() });
      notes.push({ kind: 'warn', text: `${o.name ?? 'The ' + openingLabel(o.shape, o.sill)} lost its wall — set aside, not deleted.`, ids: [] });
      continue;
    }
    const L = runGeom(r).L;
    const s = o.anchor === 'start' ? o.dist : o.anchor === 'end' ? L - o.dist : o.t * L;
    o.t = L > 0 ? s / L : 0;
  }

  // 5. things on surfaces stay on something
  for (const ob of p.objs) {
    const on = ob.on;
    if (on.kind === 'room') {
      const r = p.rooms.find((x) => x.id === on.id);
      if (!r || r.dormant) {
        const host = p.rooms.find((x) => !x.dormant && lvl(x.level) === lvl(r?.level ?? 0) && pointInPolyHoles(ob.at, x.poly, x.holes));
        ob.on = host ? { kind: 'room', id: host.id } : { kind: 'ground', y: 0 };
        notes.push({ kind: 'info', text: `${ob.name} now stands in ${host ? host.name : 'the open'} (its room changed).`, ids: [ob.id] });
      }
    } else if (on.kind === 'wall') {
      if (!p.runs.find((x) => x.id === on.run)) {
        p.objs = p.objs.filter((x) => x !== ob);
        p.parked.push({ id: newId(p, 'k'), what: 'obj', label: ob.name, reason: 'its wall was removed', data: ob, at: Date.now() });
        notes.push({ kind: 'warn', text: `${ob.name} came off its wall — set aside, not deleted.`, ids: [] });
      }
    } else if (on.kind === 'deck' && !p.decks.find((x) => x.id === on.id)) {
      ob.on = { kind: 'ground', y: 0 };
    }
  }
  return notes;
}

export function stairSteps(y0: number, y1: number) {
  return Math.max(1, Math.round(Math.abs(y1 - y0) / 0.175));
}

export function openingLabel(shape: string, sill: number) {
  if (shape === 'arch') return sill < 0.3 ? 'arched opening' : 'arched window';
  if (shape === 'round') return 'round window';
  if (shape === 'pointed') return 'pointed arch';
  return sill < 0.3 ? 'doorway' : 'window';
}

export function seedAt(p: Project, at: V2, level = 0): RoomSeed | undefined {
  return p.rooms.find((s) => !s.dormant && lvl(s.level) === lvl(level) && pointInPolyHoles(at, s.poly, s.holes));
}
