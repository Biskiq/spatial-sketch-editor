// Edits as pure transactions on a cloned project. Every edit runs through runTxn, so one action is one undo step,
// and settle() reports what else moved.
import {
  V2, add, sub, mul, dist, norm, angleOf, polyArea, ensureCCW, offsetPoly, polyCentroid, closestOnSeg, fmtM, polyPerimeter,
  interiorPoint, pointInPolyHoles, bbox, rot, rdpIdx, pointInPoly,
} from './geom2d';
import { P, union, mpolyArea, difference } from './clip';
import type { Project, Run, Tie, Opening, OpeningShape, Overhead, ProfilePt, Deck, Void, Stair, SurfaceRef, Obj, ObjType, RoomSeed, CeilingMode } from './types';
import { clone, newId, findEl } from './types';
import { settle, Note, lvl, roomTop, seedAt, carryStanding } from './settle';
import { runGeom, closestOnRun, translateRun, scaleRun, pointAtT } from './runs';
import { derive, DRoom, openingKind, elementName, floorUnder } from './derive';
import { presetProfile, ProfilePreset, ohSpan, ohUndersideAt } from './overheadGeom';
import type { StrokeFit } from './strokes';
import { isRoundish, fittedOutline } from './fit';

export interface Decision {
  key: string;
  text: string;
  options: { id: string; label: string }[];
  chosen: string;
}
export interface OpResult {
  notes?: Note[];
  decisions?: Decision[];
  select?: string | null;
}
export type Choices = Record<string, string>;
export type Op = (p: Project, ch: Choices) => OpResult | void;

export interface TxnResult {
  after: Project;
  notes: Note[];
  decisions: Decision[];
  select: string | null | undefined;
}

export function runTxn(before: Project, op: Op, choices: Choices = {}, fixes: { key: string; fix: number }[] = []): TxnResult {
  const p = clone(before);
  const r = op(p, choices) || {};
  const notes = [...(r.notes ?? []), ...settle(p)];
  const left = leftBehind(before, p, choices);
  notes.push(...left.notes);
  r.decisions = [...(r.decisions ?? []), ...left.decisions];
  let cur = clone(p);
  for (const f of fixes) {
    const iss = derive(cur).issues.find((i) => i.key === f.key);
    const fix = iss?.fixes[f.fix];
    if (!fix) continue;
    const q = clone(cur);
    fix.apply(q);
    notes.push(...settle(q));
    cur = clone(q);
  }
  const decisions = (r.decisions ?? []).map((d) => ({ ...d, chosen: choices[d.key] ?? d.chosen }));
  return { after: cur, notes, decisions, select: r.select };
}

const decide = (ch: Choices, d: Decision) => ch[d.key] ?? d.chosen;

// ------------------------------------------------------------------ walls
export function makeRun(p: Project, fit: StrokeFit, o: { baseY: number; tieA?: Tie | null; tieB?: Tie | null; top?: number | null; thick?: number; name?: string }): Run {
  const r: Run = {
    id: newId(p, 'w'), kind: 'run', shape: fit.kind === 'circle' ? 'circle' : 'path',
    pts: fit.kind === 'circle' ? [] : fit.pts.map((q) => [q[0], q[1]] as V2), bulge: fit.kind === 'circle' ? [] : fit.bulge.slice(),
    closed: fit.kind === 'circle' ? true : fit.closed, center: fit.center, radius: fit.radius, baseY: o.baseY,
    thick: o.thick ?? 0.24, top: o.top ?? null, tieA: o.tieA ?? null, tieB: o.tieB ?? null, name: o.name, order: p.nextId,
  };
  p.runs.push(r);
  return r;
}

// ------------------------------------------------------------------ touching vs. joined
// Landing a wall end on another wall is a position. Whether it then *follows* that wall (a Tie) is the creator's
// explicit choice, offered in the same step and defaulting to "just touching".

const END_ON = 0.03;

function endTouches(host: Run, e: V2) {
  const g = runGeom(host);
  for (let i = 0; i + 1 < g.ps.pts.length; i++) if (closestOnSeg(e, g.ps.pts[i], g.ps.pts[i + 1]).d < END_ON) return true;
  return false;
}

/** Offer to join the ends of r that touch a wall (as given). The tie is written only if the creator chooses it. */
export function offerJoin(p: Project, r: Run, touch: { A?: Tie | null; B?: Tie | null }, ch: Choices): { decisions: Decision[]; notes: Note[] } {
  const ends = (['A', 'B'] as const).filter((k) => touch[k] && touch[k]!.host !== r.id && p.runs.some((x) => x.id === touch[k]!.host));
  if (!ends.length) return { decisions: [], notes: [] };
  const names = [...new Set(ends.map((k) => elementName(p, touch[k]!.host)))];
  const dec: Decision = {
    key: 'join',
    text: `${ends.length === 2 ? 'Both ends touch' : ends[0] === 'A' ? 'Its start touches' : 'Its end touches'} ${names.join(' and ')}. Join, so it follows when ${names.length > 1 ? 'they move' : 'that wall moves'}?`,
    options: [{ id: 'touch', label: 'Just touching' }, { id: 'join', label: 'Join' }],
    chosen: 'touch',
  };
  const notes: Note[] = [];
  if (decide(ch, dec) === 'join') {
    for (const k of ends) r[k === 'A' ? 'tieA' : 'tieB'] = touch[k]!;
    notes.push({ kind: 'good', text: `Joined to ${names.join(' and ')}.`, ids: [r.id] });
  }
  return { decisions: [dec], notes };
}

/** A wall whose end touched another (without a join) and no longer does because that other wall moved. */
function leftBehind(before: Project, after: Project, ch: Choices): { decisions: Decision[]; notes: Note[] } {
  const out = { decisions: [] as Decision[], notes: [] as Note[] };
  const byB = new Map(before.runs.map((r) => [r.id, r]));
  const strays: { run: Run; end: 'A' | 'B'; host: Run }[] = [];
  for (const r of after.runs) {
    const rb = byB.get(r.id);
    if (!rb || r.shape !== 'path' || r.closed || rb.shape !== 'path' || rb.closed) continue;
    for (const end of ['A', 'B'] as const) {
      if (r[end === 'A' ? 'tieA' : 'tieB']) continue;
      const e = end === 'A' ? r.pts[0] : r.pts[r.pts.length - 1];
      const eb = end === 'A' ? rb.pts[0] : rb.pts[rb.pts.length - 1];
      if (!e || !eb || dist(e, eb) > 1e-6) continue; // this end was moved on purpose
      for (const hb of before.runs) {
        if (hb.id === r.id || lvl(hb.baseY) !== lvl(r.baseY) || !endTouches(hb, eb)) continue;
        const ha = after.runs.find((x) => x.id === hb.id);
        if (ha && !endTouches(ha, e)) strays.push({ run: r, end, host: ha });
      }
    }
  }
  if (!strays.length) return out;
  const dec: Decision = {
    key: 'bring',
    text: `${strays.length === 1 ? `${elementName(after, strays[0].run.id)} no longer meets ${elementName(after, strays[0].host.id)}` : `${strays.length} walls no longer meet the wall that moved`} — they were touching, not joined.`,
    options: [{ id: 'leave', label: 'Leave it' }, { id: 'bring', label: 'Bring it along and join' }],
    chosen: 'leave',
  };
  out.decisions.push(dec);
  if (decide(ch, dec) === 'bring') {
    for (const s of strays) {
      const i = s.end === 'A' ? 0 : s.run.pts.length - 1;
      const c = closestOnRun(s.host, s.run.pts[i]);
      s.run.pts[i] = c.q;
      s.run[s.end === 'A' ? 'tieA' : 'tieB'] = { host: s.host.id, t: c.t };
    }
    out.notes.push(...settle(after));
  }
  return out;
}

/** A new wall whose ends may touch other walls — touching only, unless the creator joins them in the same step. */
export const opAddRunTouching = (fit: StrokeFit, o: Parameters<typeof makeRun>[2], touchA: Tie | null, touchB: Tie | null): Op => (p, ch) => {
  const r = makeRun(p, fit, { ...o, tieA: null, tieB: null });
  return { select: r.id, ...offerJoin(p, r, { A: touchA, B: touchB }, ch) };
};

export const opAddRun = (fit: StrokeFit, o: Parameters<typeof makeRun>[2]): Op => (p) => {
  const r = makeRun(p, fit, o);
  return { select: r.id };
};

/** Continue an existing wall from one of its free ends. */
export const opExtendRun = (runId: string, end: 'A' | 'B', fit: StrokeFit, tieEnd: Tie | null): Op => (p) => {
  const r = p.runs.find((x) => x.id === runId);
  if (!r || r.shape !== 'path' || r.closed) return;
  const pts = fit.pts.slice(1);
  const bul = fit.bulge.slice();
  if (end === 'B') {
    r.pts.push(...pts);
    r.bulge.push(...bul);
    r.tieB = tieEnd;
  } else {
    const rp = fit.pts.slice().reverse().slice(0, -1);
    const rb = bul.slice().reverse().map((b) => -b);
    r.pts = [...rp, ...r.pts];
    r.bulge = [...rb, ...r.bulge];
    r.tieA = tieEnd;
  }
  // closing a loop onto its own start makes one continuous wall
  if (r.pts.length > 3 && dist(r.pts[0], r.pts[r.pts.length - 1]) < 0.05 && !r.tieA && !r.tieB) {
    r.pts.pop();
    r.closed = true;
  }
  return { select: r.id };
};

function retieEnd(p: Project, r: Run, end: 'A' | 'B', notes: Note[]) {
  const key = end === 'A' ? 'tieA' : 'tieB';
  const tie = r[key];
  if (!tie) return;
  const host = p.runs.find((x) => x.id === tie.host);
  const idx = end === 'A' ? 0 : r.pts.length - 1;
  if (!host) return;
  const c = closestOnRun(host, r.pts[idx]);
  if (c.d < 0.5) {
    r[key] = { host: host.id, t: c.t };
    r.pts[idx] = c.q;
  } else {
    r[key] = null;
    notes.push({ kind: 'info', text: `The wall end came off ${elementName(p, host.id)} (you pulled it away).`, ids: [r.id] });
  }
}

/**
 * Move a wall corner or end. `tie` updates an existing join ('keep' = re-seat it, null = the end came off).
 * `touch`: the end now lands on this wall — offered as a join, never applied silently.
 */
export const opMoveNode = (runId: string, i: number, pt: V2, tie: Tie | null | 'keep', touch: Tie | null = null): Op => (p, ch) => {
  const r = p.runs.find((x) => x.id === runId);
  if (!r) return;
  const notes: Note[] = [];
  r.pts[i] = pt;
  const isA = !r.closed && i === 0, isB = !r.closed && i === r.pts.length - 1;
  if (tie !== 'keep' && (isA || isB)) {
    const key = isA ? 'tieA' : 'tieB';
    const had = r[key];
    r[key] = tie;
    if (tie) {
      const host = p.runs.find((x) => x.id === tie.host);
      if (host) r.pts[i] = pointAtT(host, tie.t);
      if (!had || had.host !== tie.host) notes.push({ kind: 'good', text: `Joined to ${elementName(p, tie.host)}.`, ids: [r.id] });
    } else if (had) notes.push({ kind: 'info', text: `Came off ${elementName(p, had.host)}.`, ids: [r.id] });
  } else if (isA || isB) retieEnd(p, r, isA ? 'A' : 'B', notes);
  if (touch && (isA || isB) && !r[isA ? 'tieA' : 'tieB']) {
    const j = offerJoin(p, r, isA ? { A: touch } : { B: touch }, ch);
    return { notes: [...notes, ...j.notes], decisions: j.decisions };
  }
  return { notes };
};

export const opBend = (runId: string, seg: number, bulge: number): Op => (p) => {
  const r = p.runs.find((x) => x.id === runId);
  if (!r) return;
  r.bulge[seg] = Math.abs(bulge) < 0.025 ? 0 : Math.max(-2.2, Math.min(2.2, bulge));
};

export const opRadius = (runId: string, radius: number): Op => (p) => {
  const r = p.runs.find((x) => x.id === runId);
  if (r) r.radius = Math.max(0.6, radius);
};

export const opMoveRun = (runId: string, d: V2): Op => (p) => {
  const r = p.runs.find((x) => x.id === runId);
  if (!r) return;
  translateRun(r, d);
  const notes: Note[] = [];
  retieEnd(p, r, 'A', notes);
  retieEnd(p, r, 'B', notes);
  return { notes };
};

export const opRunTop = (runId: string, top: number | null): Op => (p) => {
  const r = p.runs.find((x) => x.id === runId);
  if (r) r.top = top;
};

export const opRunPatch = (runId: string, patch: Partial<Run>): Op => (p) => {
  const r = p.runs.find((x) => x.id === runId);
  if (r) Object.assign(r, patch);
};

/** Straighten or tidy: insert a node in a segment (splits one segment into two). */
export const opSplitSeg = (runId: string, seg: number, at: V2): Op => (p) => {
  const r = p.runs.find((x) => x.id === runId);
  if (!r || r.shape !== 'path') return;
  r.pts.splice(seg + 1, 0, at);
  r.bulge.splice(seg, 1, 0, 0);
};

// ------------------------------------------------------------------ openings
export function openingDefaults(kind: 'door' | 'arch' | 'window' | 'round' | 'pointed'): Omit<Opening, 'id' | 'kind' | 'run' | 't'> {
  switch (kind) {
    case 'door': return { anchor: 'ratio', dist: 0, width: 1.0, height: 2.2, sill: 0, shape: 'rect', rise: 0, keepSize: true };
    case 'arch': return { anchor: 'ratio', dist: 0, width: 1.6, height: 2.9, sill: 0, shape: 'arch', rise: 0.8, keepSize: false };
    case 'window': return { anchor: 'ratio', dist: 0, width: 1.4, height: 2.2, sill: 0.9, shape: 'rect', rise: 0, keepSize: false };
    case 'round': return { anchor: 'ratio', dist: 0, width: 1.0, height: 2.4, sill: 1.4, shape: 'round', rise: 0.5, keepSize: false };
    case 'pointed': return { anchor: 'ratio', dist: 0, width: 1.4, height: 3.0, sill: 0, shape: 'pointed', rise: 1.0, keepSize: false };
  }
}

export const opAddOpening = (runId: string, s: number, spec: Partial<Opening>): Op => (p) => {
  const r = p.runs.find((x) => x.id === runId);
  if (!r) return;
  const L = runGeom(r).L;
  const o: Opening = {
    id: newId(p, 'o'), kind: 'opening', run: runId, t: L > 0 ? s / L : 0.5, ...openingDefaults('door'), ...spec,
  } as Opening;
  if (o.shape === 'arch' || o.shape === 'pointed') o.rise = Math.min(o.rise || o.width / 2, o.height - o.sill - 0.2);
  if (o.shape === 'round') o.rise = o.width / 2;
  o.keepSize = o.sill < 0.3 && o.width <= 1.3 && o.shape === 'rect';
  p.openings.push(o);
  return { select: o.id };
};

export const opOpening = (id: string, patch: Partial<Opening>): Op => (p) => {
  const o = p.openings.find((x) => x.id === id);
  if (!o) return;
  Object.assign(o, patch);
  const r = p.runs.find((x) => x.id === o.run);
  if (r && (patch.t !== undefined || patch.anchor)) {
    const L = runGeom(r).L;
    if (o.anchor === 'start') o.dist = o.t * L;
    if (o.anchor === 'end') o.dist = (1 - o.t) * L;
  }
  if (o.shape === 'round') {
    o.rise = o.width / 2;
    o.height = o.sill + o.width;
  }
  if (o.shape === 'arch' || o.shape === 'pointed') o.rise = Math.max(0.1, Math.min(o.rise, o.height - o.sill - 0.1, o.shape === 'arch' ? o.width / 2 : o.width));
};

// ------------------------------------------------------------------ rooms
export const opRoom = (id: string, patch: Partial<Pick<RoomSeed, 'name' | 'floorY' | 'height' | 'ceiling'>>): Op => (p, ch) => {
  const s = p.rooms.find((x) => x.id === id);
  if (!s) return;
  const beforeTop = roomTop(s);
  Object.assign(s, patch);
  s.customized = true;
  s.inheritedFrom = null;
  const decisions: Decision[] = [];
  const notes: Note[] = [];
  const dt = roomTop(s) - beforeTop;
  if (Math.abs(dt) > 1e-4) {
    for (const d of p.decks.filter((x) => x.restsOn === id)) {
      const dec: Decision = {
        key: `carry:${d.id}`, text: `${d.name} rests on ${s.name}.`, chosen: 'carry',
        options: [{ id: 'carry', label: `Carry it ${dt > 0 ? 'up' : 'down'} with the ceiling` }, { id: 'keep', label: dt > 0 ? `Keep it at ${fmtM(d.y)} — a mezzanine inside ${s.name}` : `Keep it at ${fmtM(d.y)}` }],
      };
      decisions.push(dec);
      if (decide(ch, dec) === 'keep') d.restsOn = null;
    }
    for (const oh of p.overheads.filter((x) => x.restsOn?.includes(id))) {
      const dec: Decision = {
        key: `carry:${oh.id}`, text: `${oh.name} rests on ${s.name}.`, chosen: 'carry',
        options: [{ id: 'carry', label: `Carry it ${dt > 0 ? 'up' : 'down'}` }, { id: 'keep', label: `Keep it at ${fmtM(oh.baseY)}` }],
      };
      decisions.push(dec);
      if (decide(ch, dec) === 'keep') oh.restsOn = null;
    }
  }
  if (patch.floorY !== undefined) {
    const dts = p.openings.filter((o) => {
      const r = p.runs.find((x) => x.id === o.run);
      return r && lvl(r.baseY) === lvl(s.level);
    });
    if (dts.length) notes.push({ kind: 'info', text: `Doors and windows in ${s.name} stay on its floor.`, ids: [s.id] });
  }
  return { decisions, notes };
};

/** Confirm pencil (inherited) settings: they become the room's own. */
export const opConfirmRoom = (id: string): Op => (p) => {
  const s = p.rooms.find((x) => x.id === id);
  if (s) {
    s.inheritedFrom = null;
    s.customized = true;
  }
};

// ------------------------------------------------------------------ overheads
export function spanDir(outline: V2[]): number {
  let best = 0, bl = -1;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const l = dist(a, b);
    if (l > bl) {
      bl = l;
      best = angleOf(sub(b, a));
    }
  }
  return best + Math.PI / 2;
}

export { isRoundish };

export const opAddOverhead = (outline: V2[], baseY: number, o: { profile?: ProfilePt[]; preset?: ProfilePreset; dir?: number; restsOn?: string[] | null; name?: string; form?: 'extrude' | 'revolve'; fit?: Overhead['fit']; oneSpan?: boolean } = {}): Op => (p) => {
  const ol = ensureCCW(outline);
  const round = o.form ?? (isRoundish(ol) ? 'revolve' : 'extrude');
  const oh: Overhead = {
    id: newId(p, 'h'), kind: 'overhead', name: o.name ?? nextName(p, round === 'revolve' ? 'Dome' : 'Roof'),
    outline: ol, baseY, profile: [], dir: o.dir ?? spanDir(ol), form: round, thick: 0.25,
    restsOn: o.restsOn ?? null, restOffset: 0, fit: o.fit ?? null, hip: 0, order: p.nextId,
    ...(o.oneSpan === undefined ? {} : { oneSpan: o.oneSpan }),
  };
  oh.profile = o.profile ?? presetProfile(o.preset ?? 'flat', ohSpan(oh));
  p.overheads.push(oh);
  return { select: oh.id };
};

export const opOverhead = (id: string, patch: Partial<Overhead>): Op => (p) => {
  const oh = p.overheads.find((x) => x.id === id);
  if (!oh) return;
  if (patch.baseY !== undefined && oh.restsOn && patch.restsOn === undefined) {
    // dragging the eave of a tied roof: keep it tied, remember the offset
    const tops = oh.restsOn.map((rid) => p.rooms.find((r) => r.id === rid)).filter(Boolean).map((r) => roomTop(r!));
    if (tops.length) oh.restOffset = patch.baseY - Math.max(...tops);
  }
  // an outline of its own (an edge or corner pulled) ends the fit: from now on the roof keeps exactly this outline
  const unfit = patch.outline !== undefined && patch.fit === undefined && !!oh.fit;
  const names = unfit ? oh.fit!.rooms.map((id) => p.rooms.find((r) => r.id === id)?.name).filter(Boolean).join(', ') : '';
  Object.assign(oh, patch);
  if (patch.outline) oh.outline = ensureCCW(patch.outline);
  if (unfit) {
    oh.fit = null;
    return { notes: [{ kind: 'info', text: `${oh.name} has its own outline now; it no longer follows ${names}'s walls.`, ids: [oh.id] }] };
  }
};

export function coverOutline(rooms: DRoom[], thick = 0.24, overhang = 0.45): V2[] {
  const grown = union(...rooms.map((r) => P(offsetPoly(ensureCCW(r.poly), thick / 2 + overhang).pts)));
  const biggest = grown.sort((a, b) => mpolyArea([b]) - mpolyArea([a]))[0];
  return biggest ? biggest[0] : rooms[0].poly;
}

export const opCoverRooms = (roomIds: string[], preset: ProfilePreset, o: { wings?: boolean } = {}): Op => (p) => {
  const d = derive(p);
  const rooms = roomIds.map((id) => d.roomById.get(id)).filter((x): x is DRoom => !!x);
  if (!rooms.length) return;
  const round = rooms.length === 1 && isRoundish(rooms[0].poly);
  const base = Math.max(...rooms.map((r) => r.topY));
  // stop short of taller rooms next door, so their walls rise past the eave
  const taller = d.rooms.filter((r) => !roomIds.includes(r.id) && r.topY > base + 0.05 && r.floorY < base);
  const overhang = round ? 0.35 : 0.45;
  const outline = fittedOutline(rooms.map((r) => r.poly), overhang, taller.map((r) => r.poly)) ?? coverOutline(rooms);
  const res = opAddOverhead(outline, base, {
    fit: { rooms: rooms.map((r) => r.id), overhang },
    preset: round && preset === 'flat' ? 'flat' : preset, restsOn: roomIds, form: round ? 'revolve' : 'extrude',
    name: rooms.length === 1 ? `${rooms[0].name} roof` : undefined,
    // one step, one cover: the second tap is not a second Undo. Set at creation so the profile's span is the
    // primary wing's, not the whole outline's.
    oneSpan: o.wings ? false : undefined,
  })(p, {}) as OpResult;
  return { ...res, notes: [{ kind: 'good', text: `Covered ${rooms.map((r) => r.name).join(', ')}. The roof rests on ${rooms.length > 1 ? 'them' : 'it'} and follows ${rooms.length > 1 ? 'their' : 'its'} walls, taller or wider.`, ids: [] }] };
};

// ------------------------------------------------------------------ decks, voids, stairs, posts, objects
export const opAddDeck = (outline: V2[], y: number, o: { restsOn?: string | null; bridge?: boolean; name?: string } = {}): Op => (p) => {
  const d: Deck = {
    id: newId(p, 'd'), kind: 'deck', name: o.name ?? nextName(p, o.bridge ? 'Bridge' : 'Mezzanine'), outline: ensureCCW(outline),
    y, thick: 0.3, restsOn: o.restsOn ?? null, bridge: !!o.bridge, order: p.nextId,
  };
  p.decks.push(d);
  return { select: d.id };
};

/**
 * Another storey over a room, made of the usual parts: a floor slab at the room's top, walls standing on it along
 * the room's outline, and the room they enclose (same height as the one below). Nothing is tied: the floor and
 * walls stand at a height, as if drawn on the sheet. A roof over the room is never moved by itself; when it is in
 * the way, lifting it onto the new storey is offered in the same step.
 */
export const opAddFloorAbove = (roomId: string): Op => (p, ch) => {
  const d = derive(p);
  const r = d.roomById.get(roomId);
  const below = p.rooms.find((x) => x.id === roomId);
  if (!r || !below) return;
  const y = Math.round(r.topY * 1000) / 1000;
  // the same wall when one closed wall makes the room (curves and circles stay), else the room's outline, simplified
  const own = p.runs.find((w) => {
    if (lvl(w.baseY) !== lvl(r.level) || !w.closed || w.top !== null) return false;
    const ring = runGeom(w).ps.pts;
    return pointInPoly(r.at, ring) && Math.abs(Math.abs(polyArea(ring)) - r.area) < 0.2 * r.area + 2;
  });
  let fit: StrokeFit, slab: V2[];
  if (own) {
    fit = { kind: own.shape === 'circle' ? 'circle' : 'closed', pts: own.pts.map((q) => [q[0], q[1]] as V2), bulge: own.bulge.slice(), closed: true, center: own.center, radius: own.radius, length: 0, curved: false, corners: 0 };
    slab = runGeom(own).ps.pts.slice(0, -1);
  } else {
    const ring = [...r.poly, r.poly[0]];
    const keep = rdpIdx(ring, 0.05).filter((k) => k < r.poly.length);
    const pts = keep.map((k) => r.poly[k]);
    fit = { kind: 'closed', pts, bulge: pts.map(() => 0), closed: true, center: [0, 0], radius: 0, length: 0, curved: false, corners: pts.length };
    slab = pts;
  }
  const deck: Deck = { id: newId(p, 'd'), kind: 'deck', name: `${r.name} upper floor`, outline: ensureCCW(slab), y, thick: 0.3, restsOn: null, bridge: false, order: p.nextId };
  p.decks.push(deck);
  const walls = makeRun(p, fit, { baseY: y, thick: own?.thick });
  // the room upstairs keeps the storey height of the one below; settle finds it again in the walls just made
  const up: RoomSeed = {
    id: newId(p, 'm'), kind: 'room', name: `${r.name} upstairs`, level: y, floorY: y, height: below.height, ceiling: below.ceiling,
    dormant: false, customized: false, inheritedFrom: null, poly: r.poly.map((q) => [q[0], q[1]] as V2), holes: [], at: r.at, order: p.nextId,
  };
  p.rooms.push(up);
  const notes: Note[] = [{ kind: 'good', text: `${up.name}: a floor and walls at ${fmtM(y)}, ${fmtM(below.height)} tall like ${r.name}. Nothing is tied to the room below.`, ids: [walls.id, deck.id] }];
  const decisions: Decision[] = [];
  const oh = r.coveredBy ? p.overheads.find((o) => o.id === r.coveredBy) : null;
  if (oh && ohUndersideAt(oh, r.at) < y + below.height) {
    const others = d.rooms.filter((x) => x.id !== roomId && x.coveredBy === oh.id).map((x) => x.name);
    const dec: Decision = {
      key: 'roof',
      text: `${oh.name} is in the way of the new storey${others.length ? ` (it also covers ${others.join(', ')})` : ''}.`,
      options: [{ id: 'leave', label: 'Leave it where it is' }, { id: 'lift', label: 'Lift it onto the new storey' }],
      chosen: 'leave',
    };
    decisions.push(dec);
    if (decide(ch, dec) === 'lift') {
      oh.baseY = Math.round((oh.baseY + below.height) * 1000) / 1000;
      // it rested on the room below; now it rests on the walls under it
      if (oh.restsOn?.includes(roomId)) oh.restsOn = oh.restsOn.map((id) => (id === roomId ? up.id : id));
      if (oh.fit?.rooms.includes(roomId)) oh.fit = { ...oh.fit, rooms: oh.fit.rooms.map((id) => (id === roomId ? up.id : id)) };
      notes.push({ kind: 'info', text: `${oh.name} was lifted ${fmtM(below.height)} onto ${up.name}.`, ids: [oh.id] });
    }
  } else if (!oh) {
    // nothing over it: the new storey can get its own roof in the same step (it fits the walls and follows them)
    const round = isRoundish(r.poly);
    const dec: Decision = {
      key: 'cover',
      text: `${up.name} is open to the sky.`,
      options: [{ id: 'open', label: 'Leave it open' }, { id: 'flat', label: 'Flat roof' }, { id: 'gable', label: round ? 'Cone roof' : 'Pitched roof' }],
      chosen: 'open',
    };
    decisions.push(dec);
    const k = decide(ch, dec);
    if (k === 'flat' || k === 'gable') {
      // built from the new room directly (it only becomes a derived room once this step settles)
      const overhang = round ? 0.35 : 0.45;
      const outline = fittedOutline([up.poly], overhang);
      if (outline) {
        opAddOverhead(outline, y + below.height, { preset: k, restsOn: [up.id], form: round ? 'revolve' : 'extrude', name: `${up.name} roof`, fit: { rooms: [up.id], overhang } })(p, {});
        notes.push({ kind: 'good', text: `Covered ${up.name}. The roof rests on it and follows its walls.`, ids: [] });
      }
    }
  }
  return { select: walls.id, notes, decisions };
};

export const opDeck = (id: string, patch: Partial<Deck>): Op => (p) => {
  const d = p.decks.find((x) => x.id === id);
  if (!d) return;
  const notes: Note[] = [];
  if (patch.y !== undefined) {
    const carried = carryStanding(p, d.outline, d.y, patch.y);
    if (carried.length) notes.push({ kind: 'info', text: `${carried.join(', ')} ${carried.length > 1 ? 'stand' : 'stands'} on ${d.name}, so ${carried.length > 1 ? 'they' : 'it'} moved with it.`, ids: [d.id] });
  }
  if (patch.y !== undefined && d.restsOn && patch.restsOn === undefined) {
    d.restsOn = null;
    Object.assign(d, patch);
    notes.push({ kind: 'info', text: `${d.name} no longer rests on a ceiling — you moved it on its own.`, ids: [d.id] });
    return { notes };
  }
  Object.assign(d, patch);
  if (notes.length) return { notes };
  if (patch.outline) d.outline = ensureCCW(patch.outline);
};

/** A strip-shaped walkway along an open stroke. */
export function bridgeOutline(path: V2[], width = 2): V2[] {
  const left: V2[] = [], right: V2[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const n = norm([-(b[1] - a[1]), b[0] - a[0]]);
    left.push(add(path[i], mul(n, width / 2)));
    right.push(add(path[i], mul(n, -width / 2)));
  }
  return [...left, ...right.reverse()];
}

export const opAddVoid = (outline: V2[], fromY: number, toY: number, name?: string): Op => (p) => {
  const v: Void = { id: newId(p, 'v'), kind: 'void', name: name ?? nextName(p, toY > 50 ? 'Lightwell' : 'Atrium'), outline: ensureCCW(outline), fromY, toY, order: p.nextId };
  p.voids.push(v);
  return { select: v.id };
};

export const opVoid = (id: string, patch: Partial<Void>): Op => (p) => {
  const v = p.voids.find((x) => x.id === id);
  if (v) Object.assign(v, patch);
};

export const opAddStair = (path: V2[], from: SurfaceRef, to: SurfaceRef, fromY: number, toY: number, mode: Stair['mode'] = 'auto'): Op => (p) => {
  const st: Stair = { id: newId(p, 's'), kind: 'stair', name: nextName(p, mode === 'ramp' ? 'Ramp' : 'Stair'), path, from, to, fromY, toY, width: 1.3, mode, order: p.nextId };
  p.stairs.push(st);
  return { select: st.id };
};

export const opStair = (id: string, patch: Partial<Stair>): Op => (p) => {
  const s = p.stairs.find((x) => x.id === id);
  if (s) Object.assign(s, patch);
};

export const opAddPost = (at: V2): Op => (p) => {
  const q = { id: newId(p, 'q'), kind: 'post' as const, at, size: 0.22, order: p.nextId };
  p.posts.push(q);
  return { select: q.id };
};

export const OBJ_NAMES: Record<ObjType, string> = {
  sculpture: 'Sculpture', plinth: 'Vessel on a plinth', bench: 'Bench', frame: 'Photograph', tree: 'Tree', person: 'Visitor figure', screen: 'Display',
};

export const opAddObj = (type: ObjType, at: V2, on: Obj['on'], rotA = 0): Op => (p) => {
  const o: Obj = { id: newId(p, 'b'), kind: 'obj', type, name: nextName(p, OBJ_NAMES[type]), at, rot: rotA, on, order: p.nextId };
  p.objs.push(o);
  return { select: o.id };
};

export const opMoveObj = (id: string, at: V2, on: Obj['on'], fromLabel?: string, toLabel?: string): Op => (p) => {
  const o = p.objs.find((x) => x.id === id);
  if (!o) return;
  o.at = at;
  o.on = on;
  if (fromLabel && toLabel && fromLabel !== toLabel) return { notes: [{ kind: 'good', text: `${o.name} moved from ${fromLabel} to ${toLabel}.`, ids: [o.id] }] };
};

export const opObj = (id: string, patch: Partial<Obj>): Op => (p) => {
  const o = p.objs.find((x) => x.id === id);
  if (o) Object.assign(o, patch);
};

// ------------------------------------------------------------------ removing things
/** What a removal would touch — used both for the hover preview and the ripple. */
export function removalReach(p: Project, ids: string[]): string[] {
  const out = new Set<string>();
  const d = derive(p);
  for (const id of ids) {
    const e = findEl(p, id);
    if (!e) continue;
    if (e.kind === 'run') {
      p.openings.filter((o) => o.run === id).forEach((o) => out.add(o.id));
      p.runs.filter((r) => r.tieA?.host === id || r.tieB?.host === id).forEach((r) => out.add(r.id));
      const w = d.walls.get(id);
      w?.pieces.forEach((pc) => {
        if (pc.left) out.add(pc.left);
        if (pc.right) out.add(pc.right);
      });
      p.objs.filter((o) => o.on.kind === 'wall' && o.on.run === id).forEach((o) => out.add(o.id));
      for (const oh of p.overheads) if (oh.restsOn?.some((rid) => out.has(rid))) out.add(oh.id);
    }
    if (e.kind === 'deck') {
      p.objs.filter((o) => o.on.kind === 'deck' && o.on.id === id).forEach((o) => out.add(o.id));
      p.stairs.filter((s) => (s.from.kind === 'deck' && s.from.id === id) || (s.to.kind === 'deck' && s.to.id === id)).forEach((s) => out.add(s.id));
    }
    if (e.kind === 'room') {
      for (const r of wallsOnlyBounding(p, id)) out.add(r);
    }
  }
  ids.forEach((i) => out.delete(i));
  return [...out];
}

function wallsOnlyBounding(p: Project, roomId: string): string[] {
  const d = derive(p);
  const out: string[] = [];
  for (const w of d.walls.values()) {
    const touches = w.pieces.some((pc) => pc.left === roomId || pc.right === roomId);
    const others = w.pieces.some((pc) => (pc.left && pc.left !== roomId) || (pc.right && pc.right !== roomId));
    if (touches && !others) out.push(w.run.id);
  }
  return out;
}

export const opRemove = (ids: string[]): Op => (p, ch) => {
  const notes: Note[] = [];
  const decisions: Decision[] = [];
  const del = new Set(ids);
  for (const id of ids) {
    const e = findEl(p, id);
    if (e?.kind === 'room') {
      const ws = wallsOnlyBounding(p, id);
      ws.forEach((w) => del.add(w));
      del.delete(id);
      if (!ws.length) notes.push({ kind: 'info', text: `${e.name} shares all its walls with other rooms, so nothing was removed. Remove a wall instead.`, ids: [id] });
    }
  }
  for (const id of del) {
    const e = findEl(p, id);
    if (!e) continue;
    if (e.kind === 'deck') {
      const on = p.objs.filter((o) => o.on.kind === 'deck' && o.on.id === id);
      if (on.length) {
        const dec: Decision = {
          key: `objs:${id}`, text: `${on.length} thing${on.length > 1 ? 's' : ''} stood on ${e.name}.`, chosen: 'drop',
          options: [{ id: 'drop', label: 'Lower to the floor beneath' }, { id: 'aside', label: 'Set aside' }],
        };
        decisions.push(dec);
        const dv = derive(p);
        for (const o of on) {
          if (decide(ch, dec) === 'aside') {
            p.objs = p.objs.filter((x) => x !== o);
            p.parked.push({ id: newId(p, 'k'), what: 'obj', label: o.name, reason: `${e.name} was removed`, data: o, at: Date.now() });
          } else {
            const f = floorUnder(p, dv, o.at, e.y - 0.5);
            o.on = f.ref;
          }
        }
      }
    }
    const k = (e.kind === 'run' ? 'runs' : e.kind === 'opening' ? 'openings' : e.kind === 'overhead' ? 'overheads' : e.kind === 'deck' ? 'decks' : e.kind === 'void' ? 'voids' : e.kind === 'stair' ? 'stairs' : e.kind === 'post' ? 'posts' : e.kind === 'obj' ? 'objs' : null) as keyof Project | null;
    if (!k) continue;
    (p as any)[k] = ((p as any)[k] as any[]).filter((x) => x.id !== id);
  }
  return { notes, decisions, select: null };
};

// ------------------------------------------------------------------ the whole building
export const opScaleAll = (k: number, o: V2, withHeights: boolean): Op => (p) => {
  const f = (q: V2) => add(o, mul(sub(q, o), k));
  const hk = withHeights ? k : 1;
  let doors = 0, scaled = 0, rounds = 0;
  for (const r of p.runs) {
    scaleRun(r, k, o);
    r.baseY *= hk;
    if (r.top !== null) r.top *= hk;
    if (r.shape === 'circle') rounds++;
  }
  for (const op of p.openings) {
    if (op.keepSize) {
      doors++;
      continue;
    }
    scaled++;
    op.width *= k;
    op.rise *= Math.min(k, hk);
    if (withHeights) {
      op.height *= hk;
      op.sill *= hk;
    }
    if (op.anchor !== 'ratio') op.dist *= k;
  }
  for (const s of p.rooms) {
    s.poly = s.poly.map(f);
    s.holes = s.holes.map((h) => h.map(f));
    s.at = f(s.at);
    s.level *= hk;
    s.floorY *= hk;
    s.height *= hk;
  }
  for (const oh of p.overheads) {
    oh.outline = oh.outline.map(f);
    oh.baseY *= hk;
    oh.profile = oh.profile.map((q) => ({ ...q, h: q.h * hk }));
  }
  for (const d of p.decks) {
    d.outline = d.outline.map(f);
    d.y *= hk;
  }
  for (const v of p.voids) {
    v.outline = v.outline.map(f);
    v.fromY *= hk;
    if (v.toY < 50) v.toY *= hk;
  }
  for (const s of p.stairs) {
    s.path = s.path.map(f);
    s.fromY *= hk;
    s.toY *= hk;
    if (s.from.kind === 'free' || s.from.kind === 'ground') s.from = { ...s.from, y: s.from.y * hk };
    if (s.to.kind === 'free' || s.to.kind === 'ground') s.to = { ...s.to, y: s.to.y * hk };
  }
  for (const q of p.posts) q.at = f(q.at);
  for (const b of p.objs) {
    b.at = f(b.at);
    if (b.on.kind === 'wall') b.on = { ...b.on, y: b.on.y * hk };
  }
  p.story.route = p.story.route.map(f);
  const pct = Math.round((k - 1) * 100);
  const notes: Note[] = [{ kind: 'good', text: `The plan is ${pct >= 0 ? pct + '% bigger' : -pct + '% smaller'}${withHeights ? ', heights too' : '; heights kept'}.`, ids: [] }];
  if (doors) notes.push({ kind: 'info', text: `${doors} door${doors > 1 ? 's' : ''} kept person-sized.`, ids: [] });
  if (scaled) notes.push({ kind: 'info', text: `${scaled} arch${scaled > 1 ? 'es and windows' : ' or window'} grew with ${scaled > 1 ? 'their walls' : 'its wall'}, staying in place along ${scaled > 1 ? 'them' : 'it'}.`, ids: [] });
  if (rounds) notes.push({ kind: 'info', text: `Round rooms stay round; curves keep their bend.`, ids: [] });
  notes.push({ kind: 'info', text: `Things in the rooms keep their own size.`, ids: [] });
  return { notes };
};

// ------------------------------------------------------------------ set aside / loose ends
export const opAck = (key: string): Op => (p) => {
  if (!p.acknowledged.includes(key)) p.acknowledged.push(key);
};

export const opUnack = (key: string): Op => (p) => {
  p.acknowledged = p.acknowledged.filter((k) => k !== key);
};

export const opFix = (key: string, fix: number): Op => (p) => {
  const iss = derive(p).issues.find((i) => i.key === key);
  iss?.fixes[fix]?.apply(p);
};

export const opRestoreOpening = (parkId: string, runId: string, s: number): Op => (p) => {
  const k = p.parked.find((x) => x.id === parkId);
  const r = p.runs.find((x) => x.id === runId);
  if (!k || !r) return;
  const o = { ...(k.data as Opening), run: runId, t: s / runGeom(r).L, anchor: 'ratio' as const };
  p.openings.push(o);
  p.parked = p.parked.filter((x) => x !== k);
  return { select: o.id, notes: [{ kind: 'good', text: `The ${o.name ?? openingKind(o)} is back, on ${elementName(p, runId)}.`, ids: [o.id] }] };
};

export const opRestoreObj = (parkId: string, at: V2, on: Obj['on']): Op => (p) => {
  const k = p.parked.find((x) => x.id === parkId);
  if (!k) return;
  const o = { ...(k.data as Obj), at, on };
  p.objs.push(o);
  p.parked = p.parked.filter((x) => x !== k);
  return { select: o.id, notes: [{ kind: 'good', text: `${o.name} is back.`, ids: [o.id] }] };
};

export const opRestoreRoomSettings = (parkId: string, targetRoom: string): Op => (p) => {
  const k = p.parked.find((x) => x.id === parkId);
  if (!k) return;
  const src = p.rooms.find((r) => r.id === k.data.seed);
  const dst = p.rooms.find((r) => r.id === targetRoom);
  if (!src || !dst) return;
  dst.height = src.height;
  dst.floorY = src.floorY;
  dst.ceiling = src.ceiling;
  dst.customized = true;
  p.parked = p.parked.filter((x) => x !== k);
  return { notes: [{ kind: 'good', text: `${dst.name} now uses ${src.name}'s settings (${fmtM(src.height)} tall).`, ids: [dst.id] }] };
};

export const opForgetParked = (parkId: string): Op => (p) => {
  const k = p.parked.find((x) => x.id === parkId);
  if (!k) return;
  p.parked = p.parked.filter((x) => x !== k);
  if (k.what === 'room') p.rooms = p.rooms.filter((r) => r.id !== k.data.seed);
};

export const opProject = (patch: Partial<Pick<Project, 'name' | 'palette'>>): Op => (p) => {
  Object.assign(p, patch);
};

// ------------------------------------------------------------------ helpers
export function nextName(p: Project, base: string) {
  const all = new Set<string>([
    ...p.overheads.map((x) => x.name), ...p.decks.map((x) => x.name), ...p.voids.map((x) => x.name),
    ...p.stairs.map((x) => x.name), ...p.objs.map((x) => x.name), ...p.rooms.map((x) => x.name),
  ]);
  if (!all.has(base)) return base;
  for (let i = 2; ; i++) if (!all.has(`${base} ${i}`)) return `${base} ${i}`;
}

export function isInherited(p: Project, roomId: string) {
  return !!p.rooms.find((r) => r.id === roomId)?.inheritedFrom;
}
