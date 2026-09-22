import type { Vec3 } from './types';
import type { LayoutOpening, LayoutVec2 } from './layout-types';
import type { SampleableSegment } from './layout-geometry-curve';

/**
 * P23.11 — the compiler's room-boundary segment list. Identical to `DraftPath`
 * for the legacy path, but wide enough to carry the canonical Wall adapter's
 * `cubic-chain` output, which is derived geometry rather than an authored
 * `DraftSegment`.
 */
export type CompilerBoundarySource = {
	closed: true;
	segments: SampleableSegment[];
};

/**
 * Structured geometry issue. This is the single shared contract between the
 * compiler, geometry validation, and every consumer (editor + visitor).
 */
export type LayoutGeometryIssue = {
	path: string;
	code: string;
	message: string;
	targetId?: string;
	severity?: 'warning' | 'error';
};

export type LayoutBounds2 = { min: LayoutVec2; max: LayoutVec2 };
export type LayoutBounds3 = { min: Vec3; max: Vec3 };

/** Deterministic relevant-input identity shared by compiled entities and query records. */
export type CompiledIdentity = {
	/** Qualified semantic identity (stable, collision-safe). */
	id: string;
	/** Deterministic identity of the authored inputs that produced this record. */
	cacheKey: string;
};

export type CompiledCurveSample = {
	point: LayoutVec2;
	distance: number;
	t: number;
	tangent: LayoutVec2;
	normal: LayoutVec2;
};

export type ArchProfileKind = LayoutOpening['profile'];

/** Compiled elevation profile of an opening's top boundary. */
export type CompiledArchProfile = {
	kind: ArchProfileKind;
	width: number;
	height: number;
	rise: number;
	/** Ordered x/y points describing the opening's top boundary in local elevation space. */
	topBoundary: LayoutVec2[];
};

/** Renderer-neutral solid region along a wall: side wall, opening sill, or lintel. */
export type CompiledWallSection = {
	kind: 'side' | 'lintel';
	startDistance: number;
	endDistance: number;
	bottomY: number;
	topY: number;
	openingId?: string;
	profile?: CompiledArchProfile;
	profileBaseY?: number;
};

/** Clipped chord span ready for the existing chord-box adapters. */
export type CompiledSolidSpan = {
	sectionIndex: number;
	startDistance: number;
	endDistance: number;
	start: LayoutVec2;
	end: LayoutVec2;
	bottomY: number;
	topY: number;
};

export type CompiledOpeningCenter = {
	openingId: string;
	point: LayoutVec2;
	distance: number;
	tangent: LayoutVec2;
	normal: LayoutVec2;
	/** Three.js positive-Y yaw derived from the tangent (world `-atan2(dz, dx)`). */
	yaw: number;
};

export type CompiledOpening = CompiledIdentity & {
	openingId: string;
	segmentId: string;
	kind: LayoutOpening['kind'];
	/** Offset in meters along the compiled sampled arc. */
	offset: number;
	width: number;
	height: number;
	sillHeight: number;
	profile: ArchProfileKind;
	profileShape?: CompiledArchProfile;
	center: CompiledOpeningCenter;
	/** Sampled opening centerline along the wall arc (precomputed for Plan overlay). */
	centerPolyline: LayoutVec2[];
	bounds2: LayoutBounds2;
	connectsRoomIds?: [string, string];
};

export type CompiledWall = CompiledIdentity & {
	segmentId: string;
	thickness: number;
	length: number;
	samples: CompiledCurveSample[];
	sections: CompiledWallSection[];
	solidSpans: CompiledSolidSpan[];
	openings: CompiledOpening[];
	/** Opening-free centerline polylines for the Plan wall strokes. */
	solidCenterlinePolylines: LayoutVec2[][];
	bounds2: LayoutBounds2;
	bounds3: LayoutBounds3;
};

export type CompiledRoom = CompiledIdentity & {
	roomId: string;
	floorElevation: number;
	ceilingElevation: number;
	floorThickness: number;
	ceilingThickness: number;
	wallThickness: number;
	floorPolygon: LayoutVec2[];
	ceilingPolygon: LayoutVec2[];
	walls: CompiledWall[];
	openings: CompiledOpening[];
	bounds2: LayoutBounds2;
	bounds3: LayoutBounds3;
};

/**
 * Compiled Floor.
 *
 * P23.6I — carries **no vertical extent**. `height` was a copy of the legacy
 * storey scalar, and the wall-first model defines the enclosure by its Walls
 * (`CompiledPhysicalWall.height`) with Room ceilings derived per Room
 * (`CompiledRoom.ceilingElevation`). It is deliberately not replaced by another
 * Floor scalar: `floor.elevation` is the datum, `bounds3` is the aggregate spatial
 * extent (which includes physical Walls no Room references), and a
 * `max(Room envelopes)` envelope would under-report real architecture because
 * wall-first permits Walls without Rooms.
 */
export type CompiledFloor = CompiledIdentity & {
	floorId: string;
	elevation: number;
	roomIds: string[];
	bounds3: LayoutBounds3 | null;
};

export type CompiledLayoutObject = CompiledIdentity & {
	objectId: string;
	kind: LayoutObjectKind;
	position: Vec3;
	rotation: Vec3;
	dimensions: Vec3;
	roomId?: string;
	readonly: boolean;
	worldAabb: { min: Vec3; max: Vec3 };
	planFootprint: LayoutVec2[];
};

export type LayoutObjectKind = 'box' | 'plane' | 'cylinder' | 'sphere' | 'profile';

export type CompiledQueryPoint = CompiledIdentity & {
	kind: 'vertex' | 'interior-anchor';
	point: LayoutVec2;
	aabb: LayoutBounds2;
	sourceId: string;
	floorId: string;
	/** Owning Room for room-derived records; absent for roomless physical Walls (never faked). */
	roomId?: string;
	segmentId: string;
	sourceIndex: number;
	/**
	 * Collision-safe wall identity of the owning segment — same contract as
	 * `CompiledQuerySpan.wallKey` (document-global for wall-first, length-
	 * prefixed floor+room+segment for legacy). Used for moving-target
	 * ownership of junction candidates.
	 */
	wallKey?: string;
};
export type CompiledQuerySpan = CompiledIdentity & {
	kind: 'wall' | 'opening' | 'solid';
	start: LayoutVec2;
	end: LayoutVec2;
	startDistance: number;
	endDistance: number;
	startT?: number;
	endT?: number;
	aabb: LayoutBounds2;
	sourceId: string;
	floorId: string;
	/** Owning Room for room-derived records; absent for roomless physical Walls (never faked). */
	roomId?: string;
	segmentId: string;
	openingId?: string;
	/**
	 * Collision-safe wall identity for wall-bound spans. Wall-first segment
	 * ids are document-global, so `wallKey` is the bare `segmentId`; legacy
	 * segment ids are only unique inside their room, so `wallKey` is the
	 * length-prefixed `geometryId([floorId, roomId, segmentId])` — plain
	 * delimiter joining would collide because `:` is legal inside ids.
	 * Snap/align consumers must group and match walls by `wallKey` (falling
	 * back to `segmentId` for hand-built records), never by `segmentId`
	 * alone.
	 */
	wallKey?: string;
};
export type CompiledQueryPolygon = CompiledIdentity & {
	kind: 'room-floor' | 'object-footprint';
	polygon: LayoutVec2[];
	aabb: LayoutBounds2;
	sourceId: string;
	floorId?: string;
	roomId?: string;
	objectId?: string;
};
export type CompiledQueryAabb = CompiledIdentity & {
	kind: 'room' | 'wall' | 'opening' | 'object' | 'floor' | 'document';
	aabb: LayoutBounds2;
	sourceId: string;
};

export type CompiledLayoutQueryGeometry = {
	points: CompiledQueryPoint[];
	spans: CompiledQuerySpan[];
	polygons: CompiledQueryPolygon[];
	aabbs: CompiledQueryAabb[];
};

export type CompiledPhysicalWall = CompiledIdentity & {
	wallId: string;
	/** Document-global Wall role (`boundary` participates in face extraction; `partition` does not). */
	role: 'boundary' | 'partition';
	floorId: string;
	thickness: number;
	/**
	 * P23.6H — the Wall's authoritative physical height in meters, carried into
	 * compiled output so downstream consumers (mesh builders, Inspector, Plan)
	 * never have to re-read `LayoutDocument`. Vertical extent is
	 * `[floor.elevation, floor.elevation + height]`.
	 */
	height: number;
	length: number;
	samples: CompiledCurveSample[];
	sections: CompiledWallSection[];
	solidSpans: CompiledSolidSpan[];
	openings: CompiledOpening[];
	/** Opening-free centerline polylines for the Plan wall strokes. */
	solidCenterlinePolylines: LayoutVec2[][];
	bounds2: LayoutBounds2;
	bounds3: LayoutBounds3;
	/**
	 * P23.15 — the canonical Junction at each Wall end, carried into compiled
	 * output so renderers and visitors can see a Wall's neighbours without ever
	 * receiving `LayoutDocument`. Optional so hand-built/legacy compiled Walls
	 * (and test fixtures) stay valid; wall-first compilation always sets them.
	 */
	startJunctionId?: string;
	endJunctionId?: string;
};

/**
 * P23.15 — one vertical band of a Wall endpoint's cross-section. `solid` is
 * true where the Wall body exists at that band; an Opening reaching the
 * endpoint makes the band `solid: false` and names the Opening. Compiled, not
 * re-read from the document (Decision 10).
 */
export type CompiledEndpointBand = {
	bottomY: number;
	topY: number;
	solid: boolean;
	openingId?: string;
};

/**
 * P23.15 — one canonical incident Wall leg at a Junction, with the facts a
 * Junction-local solve needs. `tangentOut`/`normalOut` point **outward from the
 * Junction into the Wall** (the Junction-local frame that removes the canonical
 * orientation ambiguity). `outwardAngle` exists only for deterministic cyclic
 * adjacency; it must never decide physical ownership.
 */
export type CompiledJunctionLeg = {
	wallId: string;
	end: 'start' | 'end';
	tangentOut: LayoutVec2;
	normalOut: LayoutVec2;
	/** CCW angle of `tangentOut` from +X — cyclic ordering only. */
	outwardAngle: number;
	thickness: number;
	halfThickness: number;
	bottomY: number;
	topY: number;
	role: 'boundary' | 'partition';
	/** True when a hosted Opening reaches this exact Wall endpoint. */
	endpointOpen: boolean;
	endpointSolidBands: CompiledEndpointBand[];
};

/** One side of a resolved Junction corner (renderer-neutral miter/bevel fact). */
export type CompiledCornerSide =
	| { kind: 'miter'; apex: LayoutVec2 }
	| { kind: 'bevel'; a0: LayoutVec2; b0: LayoutVec2 };

export type CompiledEndCorner = { front: CompiledCornerSide; back: CompiledCornerSide };

/** How an incident leg's Junction end is resolved. */
export type CompiledLegJoinKind = 'terminal' | 'suppressed' | 'miter' | 'bevel' | 'trim';

/**
 * P23.15 — one vertical band of a resolved Junction surface/interface.
 * Per-band resolution is what makes exposure Opening-aware: a branch that
 * covers a difference step in plan below its own top does not cover it above.
 */
export type CompiledJunctionBand = { bottomY: number; topY: number };

/**
 * P23.15 — one resolved, Wall-attributed physical surface at a Junction.
 *
 * `layout-core` decides **what physical surface exists and who owns it**; a
 * builder only turns this into vertices/indices. No builder decides thickness
 * order, band exposure, step existence or difference ownership.
 *
 * The surface is a vertical planar quad: the plan segment `from` → `to`
 * extruded over each vertical band, wound so its geometric normal points along
 * `normal` (away from the owning Wall's material).
 */
export type CompiledJunctionSurface = {
	ownerWallId: string;
	end: 'start' | 'end';
	kind: 'continuation-thickness-step' | 'continuation-height-step' | 'branch-trim' | 'junction-keel';
	from: LayoutVec2;
	to: LayoutVec2;
	/** Outward plan normal (unit) pointing away from the owning Wall's material. */
	normal: LayoutVec2;
	bands: CompiledJunctionBand[];
};

/**
 * P23.15 — an internal interface: another incident Wall's material rests on
 * this Wall's own offset face here, so that region of the face is interior to
 * the resolved Junction material and must not be painted.
 *
 * `normal` is the outward plan normal of the Wall's own face the interface
 * lies on (a builder matches its face normal against it, never a `front`/`back`
 * convention). `fromDistance`/`toDistance` are signed along-axis distances from
 * this Junction end (+ = into the Wall).
 */
export type CompiledJunctionInterface = {
	wallId: string;
	end: 'start' | 'end';
	normal: LayoutVec2;
	fromDistance: number;
	toDistance: number;
	bands: CompiledJunctionBand[];
};

/** Counterparty leg facts a Wall end needs to close a seam without its neighbour's mesh. */
export type CompiledJunctionNeighbor = {
	wallId: string;
	tangentOut: LayoutVec2;
	normalOut: LayoutVec2;
	halfThickness: number;
	endpointOpen: boolean;
	endpointSolidBands: CompiledEndpointBand[];
};

export type CompiledLegJoin = {
	wallId: string;
	end: 'start' | 'end';
	kind: CompiledLegJoinKind;
	/** Resolved footprint boundary for this leg end, in plan XZ. */
	endBoundary: LayoutVec2[];
	/** Internal interface suppressed (tangent continuation / buried T / X through). */
	interfaceSuppressed: boolean;
	/**
	 * The sector this leg owns when a wedge is emitted, or `null` when the leg
	 * owns none. Ownership is branch-cut-independent (Decision 4).
	 */
	ownedSeam: { sector: number; polygon: LayoutVec2[] } | null;
	/** Resolved vertical bands this end spans (union of incident tops + Opening sill/spring). */
	bands: Array<{ bottomY: number; topY: number }>;
	/** Resolved start/end corner geometry, or `null` when terminal/suppressed. */
	corner: CompiledEndCorner | null;
	/** The leg's canonical `prev`/`cur` role in the shared corner (present when `corner` is set). */
	canonicalRole?: 'prev' | 'cur';
	/** The shared corner in canonical `(a0 = prev, b0 = cur)` orientation (for bridges). */
	canonicalCorner?: CompiledEndCorner | null;
	/** The counterparty leg, so a beam/step can be closed without the neighbour's mesh. */
	neighbor?: CompiledJunctionNeighbor;
	/**
	 * Set when this join is a fold: two incident legs point the same way, so
	 * their offset regions overlap. Carried on the join so a Wall-level builder
	 * can refuse the same configuration (same code) without the Junction.
	 */
	fold?: true;
	/**
	 * P23.15 — the resolved, Wall-attributed surfaces this end owns: tangent
	 * continuation difference steps and exposed branch trims. Emitted by
	 * `layout-core`; a builder only triangulates them.
	 */
	surfaces?: CompiledJunctionSurface[];
	/**
	 * P23.15 — internal interfaces resting on **this** Wall's own faces: the
	 * region of the face that is interior to the resolved Junction material.
	 */
	interfaces?: CompiledJunctionInterface[];
	/**
	 * P23.15 — along-distance from this Junction end where the Wall's material
	 * begins (0 = the Junction plane). A trimmed branch carries the distance at
	 * which it leaves the resolved Junction material; its sections/reveals are
	 * clipped there and its end cross-section is **not** painted, because that
	 * interface belongs to the resolved Junction material instead.
	 */
	clipDistance?: number;
	/**
	 * P23.15 — the resolved Junction-local **keel** of a degree >= 3 sector
	 * partition: the plan region of Junction material this Wall owns between its
	 * own cap line and the two partition beams that bound its sector.
	 *
	 * It is the piece of the local partition a Wall-owned strip cannot express on
	 * its own (a strip is a swept band; a sector narrows toward the Junction), so
	 * `layout-core` publishes it as resolved solid regions instead of leaving it
	 * to interpenetration. Every region is convex and wound CCW in plan (so the
	 * normal of its top face is `+Y`); `bands` are the vertical bands this Wall
	 * actually has material in. A builder only extrudes them (top/bottom faces per
	 * band); the vertical sides they expose are carried as `surfaces` of kind
	 * `junction-keel`, so no builder decides which side of a keel is interior.
	 */
	keel?: { regions: LayoutVec2[][]; bands: CompiledJunctionBand[] };
};

/** P23.15 — the local, renderer-neutral solve result for one Junction. */
export type CompiledJunctionResolution = {
	junctionId: string;
	legOrder: Array<{ wallId: string; end: 'start' | 'end' }>;
	joins: CompiledLegJoin[];
	bounds2: LayoutBounds2;
};

/** P23.15 — compiled Junction topology: canonical identity + incident legs + local solve. */
export type CompiledJunction = CompiledIdentity & {
	junctionId: string;
	point: LayoutVec2;
	legs: CompiledJunctionLeg[];
	resolution: CompiledJunctionResolution;
	bounds3: LayoutBounds3;
};

export type CompiledLayoutGeometry = {
	floors: CompiledFloor[];
	rooms: CompiledRoom[];
	/**
	 * Canonical physical Walls independent of Room ownership (wall-first
	 * only; empty for legacy). Each document-global Wall appears exactly
	 * once, keyed by `wallId` — including Walls referenced by Rooms.
	 * Wall-first Rooms keep identity + floor/ceiling semantics + floor
	 * polygons with empty `walls`/`openings`; Plan/3D/query consumers read
	 * physical Walls here, never per-Room duplicates. Never invent fake
	 * `roomId` ownership for these records — query spans/points for
	 * physical Walls carry no `roomId`.
	 */
	walls: CompiledPhysicalWall[];
	/**
	 * P23.15 — compiled Junction topology (wall-first only; empty/absent for
	 * legacy). Each canonical Junction with at least one incident Wall appears
	 * once, carrying its incident legs and Junction-local resolution. The
	 * renderer consumes these facts and never solves topology. Optional so
	 * hand-built/legacy geometry literals stay valid.
	 */
	junctions?: CompiledJunction[];
	objects: CompiledLayoutObject[];
	queries: CompiledLayoutQueryGeometry;
	bounds: LayoutBounds3 | null;
};

export type CompiledLayoutGeometryResult = {
	geometry: CompiledLayoutGeometry;
	issues: LayoutGeometryIssue[];
};

/**
 * Collision-safe tuple serialization for identity keys. Unlike delimiter
 * parsing, every tuple element is length-prefixed so values cannot collide.
 */
export function geometryId(parts: readonly string[]): string {
	let length = 0;
	for (const part of parts) length += part.length;
	let output = `${parts.length}:`;
	for (const part of parts) output += `${part.length}:${part}`;
	return output;
}
