/**
 * `layout-wall-first-types.ts` — P23.0a wall-first Layout schema types.
 *
 * These types are the wall-first `LayoutDocument` shape ratified by
 * the P23 umbrella ([P23 umbrella §F0.1](../../../../docs/plans/2026-09-07-P23-layout-depth-minimum-build.md))
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
 * Compatibility Baseline (`docs/north-star.md` → *Development-stage schema
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
 * One persistent interior curve-control anchor of a curved Wall centerline
 * (P23.11). Anchors are owned by their Wall — they are never Junctions and
 * never participate in connectivity (Junction IDs remain the only topology
 * truth). Anchor order is persisted and deterministic.
 */
export type LayoutWallCurveAnchor = {
	id: string;
	point: LayoutVec2;
};

/**
 * Canonical Wall centerline (P23.11). A Wall is either a straight line
 * between its endpoint Junctions (`kind: 'line'`) or an auto-Bézier curve
 * through its endpoint Junctions and its ordered `interiorAnchors`.
 *
 * Rules:
 * - endpoints remain owned only by `startJunctionId` / `endJunctionId`;
 * - `auto-bezier` requires at least one interior anchor (deleting the last
 *   anchor converts the Wall back to `line`);
 * - curve anchors are never Junctions and never carry connectivity.
 */
export type LayoutWallCenterline =
	| { kind: 'line' }
	| {
			kind: 'auto-bezier';
			interiorAnchors: LayoutWallCurveAnchor[];
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
 * Walls, an `auto-bezier` anchor list for curved ones. The field is required on
 * every persisted Wall (fresh-authority policy: no migration, no missing-field
 * tolerance).
 */
export type LayoutWall = {
  id: string;
  startJunctionId: string;
  endJunctionId: string;
  role: LayoutWallRole;
  thickness: number;
  height: number;
  centerline: LayoutWallCenterline;
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
 * Wall-first Layout document root. `objects` keeps the existing
 * `LayoutObject[]` record type: Layout objects remain document-level and
 * project/world-local; P23.0a does not move them under Floors and does not
 * change their transform ownership.
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
};
