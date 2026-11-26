import type { LayoutVec2 } from '../../geometry/coordinates';
import type { CompiledLayoutGeometry } from '../../geometry/types';
import { geometryId } from '../../geometry/types';

/** Centralized default Plan grid step in meters. */
export const LAYOUT_PLAN_GRID_STEP = 0.25;

/** Centralized pointer acquisition radius in CSS pixels. */
export const LAYOUT_PLAN_SNAP_RADIUS_CSS_PX = 8;

/** Semantic rank per candidate family — lower wins. */
export type SnapFeatureKind =
	| 'junction'
	| 'wall-midpoint'
	| 'wall-intersection'
	| 'opening-edge'
	| 'wall-span'
	| 'object-bounds-edge'
	| 'object-bounds-center'
	| 'grid'
	| 'orthogonal-guide'
	| 'extension-guide';

export const SEMANTIC_RANK: Record<SnapFeatureKind, number> = {
	junction: 0,
	'wall-intersection': 1,
	'wall-midpoint': 2,
	'opening-edge': 3,
	'wall-span': 4,
	'object-bounds-edge': 5,
	'object-bounds-center': 6,
	'orthogonal-guide': 7,
	'extension-guide': 8,
	grid: 9,
};

export type SnapOwnerKind = 'object' | 'wall' | 'opening';

/**
 * Typed owner of a snap candidate, used for moving-target exclusion.
 * Collision-safe across entity kinds AND across scopes: an object `foo`, a
 * wall `foo`, and an opening `foo` are all legal and never suppress each
 * other, and legacy wall owners carry their room-qualified `wallKey`, so
 * moving room A's `wall-1` never suppresses room B's independent `wall-1`.
 */
export type SnapOwner = {
	kind: SnapOwnerKind;
	/** Object/opening id, or the qualified wall identity (`wallKey`). */
	id: string;
};

/**
 * Collision-safe serialized owner identity (length-prefixed tuple). All
 * exclusion sets and candidate `ownerId`s use this encoding — plain
 * delimiter joining would collide because ids may contain the delimiter.
 */
export function snapOwnerKey(owner: SnapOwner): string {
	return geometryId([owner.kind, owner.id]);
}

/**
 * Resolve the owner key of one wall segment from the compiled geometry.
 * Wall-first wall ids are document-global (`wallKey === segmentId`); legacy
 * segment ids are only unique inside their room, so the moving wall must be
 * qualified by its room. Falls back to the bare segment id for empty or
 * hand-built geometry.
 */
export function wallOwnerKey(
	geometry: CompiledLayoutGeometry,
	roomId: string,
	segmentId: string,
): string {
	for (const span of geometry.queries.spans) {
		if (span.kind !== 'wall' || span.segmentId !== segmentId) continue;
		const roomScoped = span.wallKey !== undefined && span.wallKey !== span.segmentId;
		if (roomScoped && span.roomId !== roomId) continue;
		return snapOwnerKey({ kind: 'wall', id: span.wallKey ?? span.segmentId });
	}
	return snapOwnerKey({ kind: 'wall', id: segmentId });
}

/** Identity of a resolved snap candidate — stable across frames. */
export type SnapCandidate = {
	/** Snapped world point. */
	point: LayoutVec2;
	/** Semantic family. */
	kind: SnapFeatureKind;
	/** Canonical source identity for the winning candidate. */
	sourceId: string;
	/**
	 * Canonical typed owner identity for moving-target exclusion — the
	 * `snapOwnerKey({ kind, id })` of the object, wall, or opening that owns
	 * this candidate. `sourceId` is a composite key
	 * (`${ownerId}#start`, `${ownerId}#0:mid`, ...) so it must never be used
	 * for exclusion; exclusion matches this field exactly. Hand-built
	 * candidates may predate the field and fall back to `sourceId`.
	 */
	ownerId?: string;
	/**
	 * Canonical Wall identity for a `wall-span` candidate. This is carried
	 * through authoring so a snapped endpoint can establish a host relationship
	 * without asking topology to infer one from sampler proximity.
	 */
	wallId?: string;
	/** Distance from the raw pointer, in world units. */
	distance: number;
};

export type SnapInputContext = {
	/**
	 * Exclude candidates owned by these serialized owner keys
	 * (`snapOwnerKey(...)`) — the moving targets.
	 */
	excludeOwners?: ReadonlySet<string>;
	/** Exclude candidates at these exact world points (self-snapping loops). */
	excludePoints?: readonly LayoutVec2[];
	/** Only candidates from these families (tool/context validity filter). */
	allowedKinds?: readonly SnapFeatureKind[];
};

export type SnapQueryContext = {
	/** Plan scale in pixels per world unit (CSS px per meter). */
	pixelsPerMeter: number;
	/** Acquisition radius override in CSS pixels (default 8). */
	snapRadiusCssPx?: number;
	/**
	 * Grid step override in meters (default 0.25). One step value for the whole
	 * resolution: the grid fallback steps with it *and* the orthogonal guide
	 * quantizes its free coordinate to it, so grid and guide can never disagree
	 * about where the lattice is.
	 */
	gridStep?: number;
	/**
	 * The live draft anchor, when the caller has one.
	 *
	 * The `orthogonal-guide` family is **anchor-relative**: it says "hold this
	 * coordinate equal to the anchor's", which is a statement about a draft, not
	 * about the document. So the family exists exactly when a caller names its
	 * anchor, and every caller that does not (selection, hover, object
	 * placement, the Opening drag) resolves the candidate set it resolved before
	 * this field existed. That is the whole difference between waking a dormant
	 * family and changing snapping everywhere.
	 *
	 * Only a draft whose *direction* is at stake should pass one: for the Wall
	 * draw, locking the axis is the point. A Rect Room corner is already
	 * axis-aligned by construction, so an axis lock would add nothing there while
	 * outranking the geometry snaps (rank 7 beats wall spans and object bounds)
	 * that are the useful targets for a rectangle corner.
	 */
	anchor?: LayoutVec2;
};

export type SnapResolution =
	| {
			kind: 'snap';
			candidate: SnapCandidate;
			/** Guides to render for the winning candidate (transient, session-only). */
			guides: SnapGuide[];
	  }
	| { kind: 'none' };

/**
 * One transient guide line. Session state only — never written to the
 * document, cleared by the editor on cancel/tool/authority changes.
 */
export type SnapGuide = {
	kind: 'orthogonal-x' | 'orthogonal-z' | 'extension' | 'segment';
	/** Guide segment endpoints in world space. */
	start: LayoutVec2;
	end: LayoutVec2;
};
