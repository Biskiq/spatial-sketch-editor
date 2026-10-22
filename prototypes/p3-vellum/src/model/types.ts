import type { V2 } from './geom2d';

/** An end of a wall tied to a point along another wall (fraction of its length). Ties exist only because the creator aimed there. */
export interface Tie {
  host: string;
  t: number;
}

/** A wall: one continuous run of straight and curved segments, or a round wall. */
export interface Run {
  id: string;
  kind: 'run';
  shape: 'path' | 'circle';
  pts: V2[];
  bulge: number[]; // one per segment (closed paths have pts.length segments)
  closed: boolean;
  center: V2; // circle only
  radius: number; // circle only
  baseY: number; // level the wall stands on
  thick: number;
  /** Explicit height above base (a low wall, a retaining edge). null = rises to the rooms it bounds. */
  top: number | null;
  tieA: Tie | null;
  tieB: Tie | null;
  name?: string;
  order: number;
}

export type OpeningShape = 'rect' | 'arch' | 'round' | 'pointed';

export interface Opening {
  id: string;
  kind: 'opening';
  run: string;
  /** Centre position as a fraction of the wall length (kept in sync when committed). */
  t: number;
  /** How it rides when the wall changes length. */
  anchor: 'ratio' | 'start' | 'end';
  dist: number; // for start/end anchors: metres from that end to the centre
  width: number;
  height: number; // top of opening above the floor at that point
  sill: number; // bottom above the floor at that point
  shape: OpeningShape;
  rise: number; // for arch / pointed: how tall the curved head is
  /** Person-sized openings keep their size when the building is scaled. */
  keepSize: boolean;
  name?: string;
}

export type CeilingMode = 'flat' | 'follow';

/** A room's remembered character. Rooms themselves emerge from walls; seeds carry their identity through edits. */
export interface RoomSeed {
  id: string;
  kind: 'room';
  name: string;
  level: number; // base height of the walls that make it
  floorY: number; // absolute
  height: number; // ceiling above floor
  ceiling: CeilingMode;
  dormant: boolean;
  customized: boolean; // creator changed something about it
  inheritedFrom: string | null; // pencil: settings copied from a parent room, not yet confirmed
  poly: V2[]; // last known outline (identity tracking)
  holes: V2[][];
  at: V2; // a point inside it
  order: number;
}

export interface ProfilePt {
  u: number; // 0..1 across the span
  h: number; // metres above base
  crease: boolean; // sharp corner (true) or smooth (false)
  /** stable identity: editing a point (in the pad or on the roof) keeps it; only a fresh drawing replaces points */
  id?: string;
}

export interface Overhead {
  id: string;
  kind: 'overhead';
  name: string;
  outline: V2[];
  baseY: number; // the eave
  profile: ProfilePt[];
  dir: number; // span direction in plan (radians)
  form: 'extrude' | 'revolve';
  thick: number;
  /** Tied: base follows the top of these rooms (+ offset). */
  restsOn: string[] | null;
  restOffset: number;
  /** Fitted: the outline is these rooms' outline grown by the walls and the overhang, and follows them (see fit.ts). */
  fit?: { rooms: string[]; overhang: number } | null;
  /** Hipped ends: how far (m) the slopes come in from each end of the ridge; 0 is a gable. */
  hip?: number;
  /**
   * Coverage over a compound plan. Absent means the original single span (old saves keep their geometry).
   * `false` opts this roof into wings, once the plan and section qualify (see wings.ts).
   */
  oneSpan?: boolean;
  order: number;
}

export interface Deck {
  id: string;
  kind: 'deck';
  name: string;
  outline: V2[];
  y: number; // walking surface
  thick: number;
  /** Tied: this floor rests on the top of a room. */
  restsOn: string | null;
  bridge: boolean;
  order: number;
}

/** An opening through horizontal things: an atrium, a lightwell, a skylight. */
export interface Void {
  id: string;
  kind: 'void';
  name: string;
  outline: V2[];
  fromY: number;
  toY: number; // >= roof → open to the sky
  order: number;
}

export type SurfaceRef = { kind: 'ground'; y: number } | { kind: 'room'; id: string } | { kind: 'deck'; id: string } | { kind: 'free'; y: number };

export interface Stair {
  id: string;
  kind: 'stair';
  name: string;
  path: V2[];
  from: SurfaceRef;
  to: SurfaceRef;
  fromY: number;
  toY: number;
  width: number;
  mode: 'auto' | 'stair' | 'ramp';
  order: number;
}

export interface Post {
  id: string;
  kind: 'post';
  at: V2;
  size: number;
  order: number;
}

export type ObjType = 'sculpture' | 'plinth' | 'bench' | 'frame' | 'tree' | 'person' | 'screen';

export interface Obj {
  id: string;
  kind: 'obj';
  type: ObjType;
  name: string;
  at: V2;
  rot: number;
  on: SurfaceRef | { kind: 'wall'; run: string; t: number; y: number; side: 1 | -1 };
  order: number;
}

export interface Parked {
  id: string;
  what: 'opening' | 'room' | 'obj';
  label: string;
  reason: string;
  data: any;
  at: number; // time
}

export type Reveal = 'none' | 'lift' | 'cut' | 'slice' | 'light';

export interface Moment {
  id: string;
  t: number; // 0..1 along the route
  caption: string;
  look: [number, number, number] | null;
  reveal: Reveal;
  dwell: number;
}

export interface Story {
  route: V2[];
  routeStartY: number;
  moments: Moment[];
  intro: boolean; // open with the exploded establishing shot
}

export interface Imported {
  name: string;
  source: 'file' | 'prepared';
  /** prepared imports are regenerated from code; file imports live in memory only */
  key: string;
  scale: number;
  offset: V2;
  display: 'solid' | 'underlay';
}

export type Palette = 'card' | 'basswood' | 'concrete' | 'terracotta';

export interface Project {
  v: 1;
  id: string;
  name: string;
  palette: Palette;
  runs: Run[];
  openings: Opening[];
  rooms: RoomSeed[];
  overheads: Overhead[];
  decks: Deck[];
  voids: Void[];
  stairs: Stair[];
  posts: Post[];
  objs: Obj[];
  parked: Parked[];
  acknowledged: string[];
  story: Story;
  imported: Imported | null;
  nextId: number;
}

export type Element = Run | Opening | RoomSeed | Overhead | Deck | Void | Stair | Post | Obj;
export type ElementKind = Element['kind'];

export function emptyProject(name = 'Untitled pavilion'): Project {
  return {
    v: 1,
    id: 'p' + Math.random().toString(36).slice(2, 9),
    name,
    palette: 'card',
    runs: [],
    openings: [],
    rooms: [],
    overheads: [],
    decks: [],
    voids: [],
    stairs: [],
    posts: [],
    objs: [],
    parked: [],
    acknowledged: [],
    story: { route: [], routeStartY: 0, moments: [], intro: true },
    imported: null,
    nextId: 1,
  };
}

export function newId(p: Project, prefix: string) {
  return `${prefix}${p.nextId++}`;
}

export const COLLECTIONS = ['runs', 'openings', 'rooms', 'overheads', 'decks', 'voids', 'stairs', 'posts', 'objs'] as const;
export type CollectionKey = (typeof COLLECTIONS)[number];

export function findEl(p: Project, id: string): Element | undefined {
  for (const k of COLLECTIONS) {
    const e = (p[k] as Element[]).find((x) => x.id === id);
    if (e) return e;
  }
  return undefined;
}

export function collectionOf(kind: ElementKind): CollectionKey {
  switch (kind) {
    case 'run': return 'runs';
    case 'opening': return 'openings';
    case 'room': return 'rooms';
    case 'overhead': return 'overheads';
    case 'deck': return 'decks';
    case 'void': return 'voids';
    case 'stair': return 'stairs';
    case 'post': return 'posts';
    case 'obj': return 'objs';
  }
}

export const clone = <T>(x: T): T => structuredClone(x);
