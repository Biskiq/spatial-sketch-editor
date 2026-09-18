/**
 * `layout-wall-first-types.ts` — P23.0a wall-first Layout schema types.
 *
 * These types are the wall-first `LayoutDocument` shape ratified by
 * the P23 umbrella ([P23 umbrella §F0.1](../../../../docs/roadmap/p23-layout-depth/2026-09-07-P23-layout-depth-minimum-build.md))
 * and the P23.0 child plan. The Foundation Gate is closed; these records are
 * now consumed by the wall-first Save and P23.1 precise semantic operations.
 * Legacy Room-owned records remain available through the compatibility path.
 *
 * Identity rules (P23 umbrella F0.1, P23.0 "Identity rules"):
 * - Junction IDs are the only normal-authoring connectivity authority.
 * - Wall IDs are document-global and survive deformation; canonical Wall
 *   orientation (start → end) is stable and identity-bearing because opening
 *   offsets are measured from start.
 * - Opening IDs are document-global in the new schema.
 * - Room IDs remain product identities, never face-extractor IDs.
 * - IDs never derive from coordinates, traversal order, timestamps or random
 *   allocation (allocation happens in P23.8/P23.0b authoring operations, not
 *   in this codec).
 */
import type { LayoutObject, LayoutVec2 } from './layout-types';

/**
 * Explicit wall-first format discriminator value (current canonical format).
 *
 * Historical usage recheck (P23.0 requires this before freezing): the active
 * legacy Layout JSON carries no `formatVersion` key (the legacy codec rejects
 * it as `unknown_key`), so a missing version can only mean the Room-owned
 * legacy shape. Archived Museum terminology called the immediately preceding
 * Layout model "v3"; the least surprising wall-first number was therefore `4`
 * (H5 §10.1). Any other explicit value is rejected as unrecognized — a real
 * decoder must exist before a number becomes loadable.
 *
 * P23.6H bumped the canonical format to `5` and P23.6I made it the **final**
 * Wall-defined vertical model: `LayoutWall.height` is the only authored vertical
 * Wall authority (finite, strictly positive, no storey cap), the canonical Floor
 * carries `id`/`name`/`elevation` only, and a Room ceiling is derived from its
 * boundary Wall heights.
 *
 * **`5` is the only recognized version, and there is no `4` decoder.** P23.6I is a
 * pre-Compatibility-Baseline slice, so the wall-first `4` generation that reached
 * `main` before this branch is deliberately *not* migrated: having existed on
 * `main` does not by itself create a backward-compatibility obligation before the
 * Compatibility Baseline (`docs/reference/north-star.md` → *Development-stage schema
 * compatibility*). A payload declaring `4` therefore fails as
 * `unsupported_format_version` instead of being silently reinterpreted as `5`.
 * There is no `4`→`5` cutover, no historical document type, no `6`/`7`.
 */
export const LAYOUT_WALL_FIRST_FORMAT_VERSION = 5 as const;

/** All explicit `formatVersion` values the decoder recognizes. */
export const KNOWN_LAYOUT_FORMAT_VERSIONS = [LAYOUT_WALL_FIRST_FORMAT_VERSION] as const;

export type LayoutFormatVersion = (typeof KNOWN_LAYOUT_FORMAT_VERSIONS)[number];

/** Semantic Wall role: only `boundary` Walls participate in Room face extraction. */
export type LayoutWallRole = 'boundary' | 'partition';

/** First-class connectivity point. Junction ID equality *is* connectivity. */
export type LayoutJunction = {
  id: string;
  point: LayoutVec2;
};

/**
 * One persistent interior bend point of a curved Wall centerline (P23.11).
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
 * Control pair for exactly ONE cubic span of a curved Wall centerline (P23.11).
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
 * Canonical Wall centerline (P23.11). A Wall is either a straight line between
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
 * `height` is the **authoritative physical height** of this Wall (P23.6H),
 * measured upward from the Floor elevation:
 *
 * ```text
 * bottomY = floor.elevation
 * topY    = floor.elevation + wall.height
 * ```
 *
 * It is finite, strictly positive, per physical Wall, shared by both sides of the
 * Wall, and **has no global upper bound** (P23.6I): a Wall may be shorter or
 * taller than its neighbours, and a Room's derived ceiling is the maximum of its
 * boundary Wall heights. Wall height is consumed by the canonical compiler,
 * bounds, mesh inputs and Opening fit — and is deliberately **not** part of Plan
 * face extraction, so a height change alone never alters Room topology.
 *
 * `centerline` is the authoritative P23.11 curve state: `'line'` for straight
 * Walls, a `cubic-chain` of bend points and one control pair per cubic span for
 * curved ones. The field is required on every persisted Wall (fresh-authority
 * policy: no migration, no missing-field tolerance).
 */
export type LayoutWall = {
  id: string;
  startJunctionId: string;
  endJunctionId: string;
  role: LayoutWallRole;
  thickness: number;
  height: number;
  centerline: LayoutWallCenterline;
  /**
   * P23.12 — optional authored Wall name. Absence is the only representation of
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
 * doors (legacy meaning preserved on read); the stricter P23.8 new-schema
 * adjacency contract arrives with the topology child plan, not here.
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
   * P23.12 — optional authored Opening name, same policy as `LayoutWall.name`.
   * The reference, not the name, is display identity, and a kind flip
   * (door ↔ window) never changes either one.
   */
  name?: string;
};/**
 * Floor descriptor — **canonical current (format 5)** shape after P23.6I.
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
 * Persistent semantic Room over a derived candidate face. `boundary` holds
 * oriented Wall references (derived/reconciled by P23.8 — this codec only
 * validates the reference structure). Surface thicknesses stay Room metadata;
 * wall thickness belongs to Walls.
 */
export type LayoutWallFirstRoom = {
  id: string;
  name: string;
  boundary: OrientedWallRef[];
  floorThickness: number;
  ceilingThickness: number;
};

/**
 * P23.12 — the entity collections a reference can be allocated for. These are
 * the ledger keys, and they are the **only** families: a Junction is never
 * named, and Door/Window share the `openings` family because kind is mutable.
 */
export type LayoutIdentityFamily = 'rooms' | 'junctions' | 'walls' | 'openings';

/** Ledger key order for allocation and for canonical serialization. */
export const LAYOUT_IDENTITY_FAMILIES = [
	'rooms',
	'junctions',
	'walls',
	'openings'
] as const satisfies readonly LayoutIdentityFamily[];

/**
 * P23.12 — one compact reference per entity, keyed by **canonical ID**.
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
};

/**
 * Wall-first Layout document root. `objects` keeps the existing
 * `LayoutObject[]` record type: Layout objects remain document-level and
 * project/world-local; P23.0a does not move them under Floors and does not
 * change their transform ownership.
 *
 * `identity` is the P23.12 reference ledger. It is **optional on read**: every
 * already-saved project and every already-published release predates it, and the
 * visitor path re-validates released documents with the same codec, so absence
 * must stay acceptable. The canonical writers always emit it.
 */export type LayoutDocumentWallFirst = {
	units: 'meters';
	/**
	 * Canonical current format — narrowed to the constant's value (P23.6I), so no
	 * downstream consumer needs a `formatVersion` branch at all.
	 */
	formatVersion: typeof LAYOUT_WALL_FIRST_FORMAT_VERSION;
	/**
	 * Floor-level Y datum (P23.0b/P23.6I). Exactly one floor for the P23 minimum;
	 * multi-floor legacy payloads are compatibility-only (H5 excludes
	 * multi-floor topology). Carries no vertical extent — see
	 * {@link LayoutWallFirstFloor}.
	 */
  floor: LayoutWallFirstFloor;
  junctions: LayoutJunction[];
  walls: LayoutWall[];
  rooms: LayoutWallFirstRoom[];
  openings: LayoutWallOpening[];
  objects: LayoutObject[];
  identity?: LayoutIdentityLedger;
};
