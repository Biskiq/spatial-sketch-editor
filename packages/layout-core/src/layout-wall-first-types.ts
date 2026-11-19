/**
 * `layout-wall-first-types.ts` — wall-first Layout schema types.
 *
 * These types are the wall-first `LayoutDocument` shape. They are consumed by
 * the wall-first Save and the precise semantic operations. These records are
 * the only authored Layout shape, and there is no compatibility path.
 *
 * Identity rules:
 * - Junction IDs are the only normal-authoring connectivity authority.
 * - Wall IDs are document-global and survive deformation; canonical Wall
 *   orientation (start → end) is stable and identity-bearing because opening
 *   offsets are measured from start.
 * - Opening IDs are document-global in the new schema.
 * - Room IDs remain product identities, never face-extractor IDs.
 * - IDs never derive from coordinates, traversal order, timestamps or random
 *   allocation (allocation happens in authoring operations, not
 *   in this codec).
 */
import type { LayoutVec2 } from './layout-coordinates';
import type { DraftPath } from './layout-path';
import type { Vec3 } from './types';

/**
 * Document-level Layout object.
 *
 * Objects stay document-level and project/world-local: they are not owned by a
 * Floor, a Room or a Wall, and their transform is the authored world transform.
 * `roomId` is an optional **reference** to a persistent Room, never an
 * ownership fact, and the wall-first reader resolves it against the current
 * Rooms (an unknown reference is `missing_reference`). `profile` is an authored
 * closed plan path used by the `profile` kind — the only remaining `DraftPath`
 * consumer.
 */
export type LayoutObject = {
	id: string;
	kind: 'box' | 'plane' | 'cylinder' | 'sphere' | 'profile';
	position: Vec3;
	rotation: Vec3;
	dimensions: Vec3;
	profile?: DraftPath;
	roomId?: string;
};

/**
 * Explicit wall-first format discriminator value (current canonical format).
 *
 * Historical usage recheck: the active
 * legacy Layout JSON carries no `formatVersion` key (the legacy codec rejects
 * it as `unknown_key`), so a missing version can only mean the Room-owned
 * legacy shape. Archived Museum terminology called the immediately preceding
 * Layout model "v3"; the least surprising wall-first number was therefore `4`.
 * Any other explicit value is rejected as unrecognized — a real
 * decoder must exist before a number becomes loadable.
 *
 * Format `5` introduced the **final** Wall-defined vertical model:
 * `LayoutWall.height` is the only authored vertical Wall authority, the canonical Floor carries `id`/`name`/`elevation` only, and a
 * Room ceiling is derived from its boundary Wall heights. Heights have no
 * Floor-relative cap; the shared 1,000 m Layout geometry envelope is enforced by
 * the current reader and authoring planners.
 *
 * **Format `6` is format 5 without the authored
 * Wall `role`; format 7 adds the closed-Wall shape.** A Wall's role is derived from face membership instead
 * ({@link LayoutDerivedWallRole}): the compiler, the Room gates and the Card fact
 * all read the derived value, and nothing authors it. This settles the
 * "migrate existing `partition` Walls" question by removal — a Wall is bounding,
 * dividing or free-standing because of the topology it is part of, never because a
 * field says so.
 *
 * **`9` is the only recognized version.** Format 8 introduced open Spaces.
 * Format 9 keeps their Wall, virtual-edge and overhead fields, removes Room
 * padding, and adds independently authored Horizontal Regions and their names.
 * Other versions fail as `unsupported_format_version`.
 */
export const LAYOUT_WALL_FIRST_FORMAT_VERSION = 9 as const;

/**
 * The approved closed-Wall representation is exactly 16 symmetric cubic
 * spans with 15 interior bend points. The counts are structural: the codec
 * refuses a closed Wall in any other shape rather than admitting a second,
 * unbounded closed representation that the product cannot construct.
 */
export const CLOSED_WALL_CIRCLE_SPAN_COUNT = 16 as const;
export const CLOSED_WALL_CIRCLE_KNOT_COUNT = CLOSED_WALL_CIRCLE_SPAN_COUNT - 1;

/** All explicit `formatVersion` values the decoder recognizes. */
export const KNOWN_LAYOUT_FORMAT_VERSIONS = [LAYOUT_WALL_FIRST_FORMAT_VERSION] as const;

export type LayoutFormatVersion = (typeof KNOWN_LAYOUT_FORMAT_VERSIONS)[number];

/**
 * Derived Wall role, owned by face membership and never persisted.
 *
 * - `bounding` — referenced by exactly one Room boundary;
 * - `dividing` — referenced by two or more Room boundaries (it separates them);
 * - `free-standing` — referenced by no Room boundary.
 *
 * Room boundaries are the reconciled candidate faces, so this is the same
 * membership face extraction produced; nothing reads an authored field.
 */
export type LayoutDerivedWallRole = 'bounding' | 'dividing' | 'free-standing';

/** First-class connectivity point. Junction ID equality *is* connectivity. */
export type LayoutJunction = {
  id: string;
  point: LayoutVec2;
};

/**
 * One persistent interior bend point of a curved Wall centerline.
 *
 * Bend points carry identity and their `point` is the authored, user-facing
 * value. They are owned by their Wall — they are never Junctions and never
 * participate in connectivity (Junction IDs remain the only topology truth).
 * Order is persisted and deterministic.
 */
export type LayoutWallCurveKnot = {
	id: string;
	point: LayoutVec2;
};

/**
 * Control pair for exactly ONE cubic span of a curved Wall centerline.
 * `handleOut` leaves the span's first point and `handleIn` arrives at its
 * second point, so one span evaluates to exactly one cubic.
 *
 * Spans are derived geometry with no identity of their own: they are owned
 * positionally by their chain and are never addressed by ID. They exist so a
 * split can be an exact cubical subdivision instead of a re-interpolation.
 */
export type LayoutWallCubicSpan = {
	handleOut: LayoutVec2;
	handleIn: LayoutVec2;
};

/**
 * Canonical Wall centerline. A Wall is either a straight line between
 * its endpoint Junctions (`kind: 'line'`) or an explicit cubic chain through
 * its endpoint Junctions and its ordered interior bend points.
 *
 * With `P = [startJunction, ...knots, endJunction]`:
 *
 * ```text
 * spans.length === knots.length + 1
 * cubic i = (P[i], spans[i].handleOut, spans[i].handleIn, P[i + 1])
 * ```
 *
 * Rules:
 * - endpoint positions remain owned only by `startJunctionId` /
 *   `endJunctionId`; the chain stores no endpoint point, only per-span
 *   controls;
 * - `knots.length === 0` is legal and means one cubic between the two
 *   endpoint Junctions — it is not a flattened Wall;
 * - `spans.length === knots.length + 1` is a validated invariant, and every
 *   span is one cubic;
 * - bend points are never Junctions and never carry connectivity;
 * - spans carry no identity, no ordering field and no lookup by ID;
 * - the persisted controls are the only curve authority. Nothing re-derives
 *   them on the read path, so subdivision and translation are exact.
 */
export type LayoutWallCenterline =
	| { kind: 'line' }
	| {
			kind: 'cubic-chain';
			knots: LayoutWallCurveKnot[];
			spans: LayoutWallCubicSpan[];
	  };

/**
 * One physical Wall between two explicit Junctions. A Wall exists once even
 * when it bounds two Rooms; no Wall stores or infers Room ownership.
 *
 * `startJunctionId === endJunctionId` means one **closed** Wall. It is
 * still an ordinary Wall record: the single Junction is the canonical seam, and
 * the centerline must be the canonical 16-span `cubic-chain`. Closed Walls are
 * isolated; the topology gate refuses a second Wall at the seam and any
 * crossing or endpoint attachment.
 *
 * `height` is the **authoritative physical height** of this Wall,
 * measured upward from the Floor elevation:
 *
 * ```text
 * bottomY = floor.elevation
 * topY    = floor.elevation + wall.height
 * ```
 *
 * It is finite and strictly positive, per physical Wall, shared by both sides of
 * the Wall, and uses the shared 1,000 m Layout geometry envelope. It has no
 * Floor-relative cap: a Wall may be shorter or taller than its neighbours, and a
 * Room's derived ceiling is the maximum of its boundary Wall heights. Wall
 * height is consumed by the canonical compiler, bounds, mesh inputs and Opening
 * fit — and is deliberately **not** part of Plan
 * face extraction, so a height change alone never alters Room topology.
 *
 * `centerline` is the authoritative curve state: `'line'` for straight
 * Walls, a `cubic-chain` of bend points and one control pair per cubic span for
 * curved ones. The field is required on every persisted Wall (fresh-authority
 * policy: no migration, no missing-field tolerance).
 *
 * There is no authored `role` (format 6): bounding/dividing/free-standing is
 * derived from Room boundary membership by
 * {@link deriveLayoutWallRole}.
 */
export type LayoutWall = {
  id: string;
  startJunctionId: string;
  endJunctionId: string;
  thickness: number;
  height: number;
  centerline: LayoutWallCenterline;
  /**
   * Optional authored Wall name. Absence is the only representation of
   * "unnamed" (a present-but-blank name is `invalid_value`), duplicates are
   * legal, and a name is never display identity: the reference is. Wall naming
   * does not touch canonical IDs, connectivity or geometry.
   */
  name?: string;
};

/** Directed Wall reference used by persistent Room boundaries. */
export type OrientedWallRef = {
  wallId: string;
  direction: 'forward' | 'reverse';
};

/**
 * Wall-hosted opening. `offset` is physical meters from the canonical Wall
 * start (H1 meter-offset semantics, never normalized coordinates).
 *
 * `connectsRoomIds` stays an optional explicit semantic inter-Room relation on
 * doors (legacy meaning preserved on read); the stricter new-schema
 * adjacency contract is `validateWallFirstPortalRelations`, not this type.
 */
export type LayoutWallOpening = {
  id: string;
  wallId: string;
  kind: 'door' | 'window';
  offset: number;
  width: number;
  height: number;
  sillHeight: number;
  profile: 'rectangular' | 'rounded' | 'pointed';
  connectsRoomIds?: [string, string];
  /**
   * Optional authored Opening name, same policy as `LayoutWall.name`.
   * The reference, not the name, is display identity, and a kind flip
   * (door ↔ window) never changes either one.
   */
  name?: string;
};/**
 * Floor descriptor — **canonical current (format 6)** shape, the
 * Working-level owner threaded as a captured intent input.
 *
 * The Floor owns the horizontal *datum* only: `elevation` is authoritative for
 * Wall bottoms (`bottomY = floor.elevation`) and the Room floor plane. It carries
 * **no vertical extent**: `floor.height` was the legacy storey scalar, and the
 * enclosure is now defined by its Walls (`wall.height`) with Room ceilings derived
 * per Room. Nothing replaces it — a `max(Room envelopes)` Floor envelope is
 * explicitly rejected, because wall-first permits physical Walls without Rooms and
 * a room-only maximum would under-report real architecture.
 *
 * A `height` key on the current Floor is rejected by the codec as `unknown_key`:
 * there is no persisted Floor-level vertical extent, and no `{ height?: number }`
 * compatibility variant of this type.
 */
export type LayoutWallFirstFloor = {
	id: string;
	name: string;
	elevation: number;
};

/**
 * Persistent semantic Room over a derived candidate face, or an open Space whose
 * composed outline is a Wall chain plus stated virtual edges. `boundary` holds
 * oriented Wall references (derived/reconciled by Room reconciliation — this
 * codec only validates the reference structure).
 *
 * An "open Space" is still one Room record: the product word is Space, the
 * collection and type keep the name Room, and `virtualEdges` is the only
 * derived reading that separates the two states.
 */
export type LayoutWallFirstRoom = {
  id: string;
  name: string;
  /** Wall sides only, in cycle order. At least one. */
  boundary: OrientedWallRef[];
  /**
   * Stated straight segments that close the gaps between consecutive boundary
   * Walls, in cycle order. Empty exactly when the Space is enclosed by its
   * Walls. A virtual edge is a handle, not a subject: it has no id, no height,
   * no thickness and no Opening, and it never takes part in noding or
   * connectivity.
   */
  virtualEdges: LayoutSpaceVirtualEdge[];
  /** Authored overhead intent. Geometry never changes it. */
  overhead: LayoutSpaceOverhead;


};

/**
 * One stated straight segment between two Junctions, in a Space's boundary
 * cycle. Endpoints are Junctions only: there are no coordinates and no ids, so
 * a moved Wall end and its open side cannot drift apart.
 */
export type LayoutSpaceVirtualEdge = {
  startJunctionId: string;
  endJunctionId: string;
};

/**
 * Authored overhead intent.
 *
 * `closed` is the lid a Room has always had. `open-to-sky` removes the
 * generated lid and nothing else: Wall heights, the derived ceiling elevation,
 * the floor and every Wall record are unchanged.
 */
export type LayoutSpaceOverhead = 'closed' | 'open-to-sky';

/**
 * The entity collections a reference can be allocated for. These are
 * the ledger keys, and they are the **only** families: a Junction is never
 * named, and Door/Window share the `openings` family because kind is mutable.
 */
export type LayoutIdentityFamily = 'rooms' | 'junctions' | 'walls' | 'openings' | 'regions';

/** Ledger key order for allocation and for canonical serialization. */
export const LAYOUT_IDENTITY_FAMILIES = [
	'rooms',
	'junctions',
	'walls',
	'openings',
	'regions'
] as const satisfies readonly LayoutIdentityFamily[];

/**
 * One compact reference per entity, keyed by **canonical ID**.
 *
 * References are presentation identity only and live here rather than on the
 * entity records: a document-level ledger removes the spread-copy hazard
 * (`{...source, id}` would duplicate an entity-level reference), survives every
 * planner that copies a Wall or an Opening, and makes assignment a single
 * allocation site. Junctions stay unnamed and unreferenced by name.
 *
 * `cursor` is allocation bookkeeping, not authored content: it is persisted (so
 * Save/Load continues from it) but excluded from every authored-change
 * comparison. Assignments themselves **are** authored — Undo/Redo restore them
 * exactly, and a retired reference is never reassigned to another entity.
 */
export type LayoutIdentityLedger = {
	cursor: number;
	rooms: Record<string, string>;
	junctions: Record<string, string>;
	walls: Record<string, string>;
	openings: Record<string, string>;
	regions: Record<string, string>;
};

/**
 * Wall-first Layout document root. `objects` keeps the existing
 * `LayoutObject[]` record type: Layout objects remain document-level and
 * project/world-local; they are not owned by Floors and keep their
 * transform ownership.
 *
 * `identity` is the reference ledger. It is **optional on read**: every
 * already-saved project and every already-published release predates it, and the
 * visitor path re-validates released documents with the same codec, so absence
 * must stay acceptable. The canonical writers always emit it.
 */export type LayoutDocumentWallFirst = {
	units: 'meters';
	/**
	 * Canonical current format — narrowed to the constant's value, so no
	 * downstream consumer needs a `formatVersion` branch at all.
	 */
	formatVersion: typeof LAYOUT_WALL_FIRST_FORMAT_VERSION;
	/**
	 * Floor-level Y datum. Exactly one floor in the current scope;
	 * multi-floor legacy payloads are compatibility-only. Carries no vertical extent — see
	 * {@link LayoutWallFirstFloor}.
	 */
  floor: LayoutWallFirstFloor;
  junctions: LayoutJunction[];
  walls: LayoutWall[];
  rooms: LayoutWallFirstRoom[];
  openings: LayoutWallOpening[];
  objects: LayoutObject[];
  regions: LayoutRegion[];
  identity?: LayoutIdentityLedger;
};

/** Independent slab geometry on the project X/Z plane. */
export type LayoutRegion = {
  id: string;
  role: 'floor' | 'overhead';
  footprint: { kind: 'polygon'; points: LayoutVec2[] };
  /** Floor-relative top (floor role) or underside (overhead role), in metres. */
  elevation: number;
  thickness: number;
  form: { kind: 'flat' };
  intendedGaps: string[];
  name?: string;
};

export type LayoutRegionSurfaceRef = {
  regionId: string;
  surface: 'top' | 'underside' | 'edge';
};
