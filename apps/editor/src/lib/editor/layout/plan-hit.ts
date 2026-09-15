import type { LayoutVec2 } from '$lib/layout/layout-types';
import type { CompiledLayoutQueryGeometry, CompiledQuerySpan } from '$lib/layout/layout-geometry-types';
import { findPolygonContaining, projectPointToSpans } from '$lib/layout/layout-geometry-queries';

/**
 * Pure Plan hit resolution. Resolves a world-space plan point against the
 * compiled query records (points, spans, polygons) using the locked priority:
 * vertex → interior anchor → opening → object → wall → room. No Svelte, DOM,
 * or view-transform imports; the caller supplies a world-space tolerance
 * (screen hit radius ÷ pixels-per-meter).
 */

export type PlanWallProjection = {
	point: LayoutVec2;
	offset: number;
	distance: number;
	t: number;
};

export type PlanHitResult =
	| { kind: 'vertex'; roomId: string; segmentId: string; vertexIndex: number }
	| { kind: 'interiorAnchor'; roomId: string; segmentId: string; anchorId: string }
	| { kind: 'opening'; roomId: string; segmentId: string; openingId: string; projection: PlanWallProjection }
	| { kind: 'object'; objectId: string }
	| { kind: 'wall'; roomId: string; segmentId: string; projection: PlanWallProjection }
	| { kind: 'room'; roomId: string }
	/**
	 * P23.3 — canonical wall-first hits keyed by document-global IDs only. Room
	 * context is derived on demand by the caller (never faked into the record),
	 * and these never carry a `roomId`/`segmentId` pair.
	 */
	| { kind: 'wallOpening'; wallId: string; openingId: string; projection: PlanWallProjection }
	| { kind: 'physicalWall'; wallId: string; projection: PlanWallProjection }
	/**
	 * P23.6 — canonical wall-first Wall endpoint (a real Junction). The caller
	 * resolves `junctionId` from the document (`start/endJunctionId` by
	 * `endpoint`); the record itself never carries Room context.
	 */
	| { kind: 'wallEndpoint'; wallId: string; endpoint: 0 | 1; point: LayoutVec2 }
	/**
	 * P23.11 — one interior control of a curved Wall. Transient editing state
	 * keyed by `{ wallId, anchorId }`: it is never a durable `LayoutSelection`
	 * variant and never a hierarchy row, so the Wall stays the selection and
	 * this hit carries no Room/segment context.
	 */
	| { kind: 'wallCurveControl'; wallId: string; anchorId: string; point: LayoutVec2 }
	| null;

/**
 * P23.11 — one candidate curve control for the hit query. Controls are
 * transient editing state owned by the caller (only a selected curved Wall
 * exposes them), so they are supplied per query rather than derived from
 * compiled query geometry.
 */
export type PlanCurveControlCandidate = {
	wallId: string;
	anchorId: string;
	point: LayoutVec2;
};

/** Canonical (non-room-derived) span groups keyed by document-global `wallId`. */
type PhysicalWallSpans = {
	wallSpans: CompiledQuerySpan[];
	openingSpans: CompiledQuerySpan[];
};

/**
 * Group canonical physical-Wall query spans by `wallKey` (= document-global
 * `wallId`). Room-derived records are skipped: this index is the wall-first
 * hit path, not a legacy alias.
 */
function physicalSpansByWall(
	queries: CompiledLayoutQueryGeometry
): Map<string, PhysicalWallSpans> {
	const byWall = new Map<string, PhysicalWallSpans>();
	for (const span of queries.spans) {
		if (span.roomId !== undefined) continue;
		if (span.kind !== 'wall' && span.kind !== 'opening') continue;
		const wallId = span.wallKey ?? span.segmentId;
		const group = byWall.get(wallId) ?? { wallSpans: [], openingSpans: [] };
		if (span.kind === 'wall') group.wallSpans.push(span);
		else group.openingSpans.push(span);
		byWall.set(wallId, group);
	}
	return byWall;
}

function wallSpansByRoomSegment(queries: CompiledLayoutQueryGeometry): Map<string, Map<string, CompiledQuerySpan[]>> {
	const byRoom = new Map<string, Map<string, CompiledQuerySpan[]>>();
	for (const span of queries.spans) {
		if (span.kind !== 'wall') continue;
		if (span.roomId === undefined) continue;
		let bySegment = byRoom.get(span.roomId);
		if (!bySegment) {
			bySegment = new Map();
			byRoom.set(span.roomId, bySegment);
		}
		const spans = bySegment.get(span.segmentId) ?? [];
		spans.push(span);
		bySegment.set(span.segmentId, spans);
	}
	return byRoom;
}

function openingSpansByRoom(queries: CompiledLayoutQueryGeometry): Map<string, CompiledQuerySpan[]> {
	const byRoom = new Map<string, CompiledQuerySpan[]>();
	for (const span of queries.spans) {
		if (span.kind !== 'opening') continue;
		if (span.roomId === undefined) continue;
		const spans = byRoom.get(span.roomId) ?? [];
		spans.push(span);
		byRoom.set(span.roomId, spans);
	}
	return byRoom;
}

/** Room IDs in document order, derived from compiled room-floor polygons. */
function orderedRoomIds(queries: CompiledLayoutQueryGeometry): string[] {
	const ids: string[] = [];
	for (const polygon of queries.polygons) {
		if (polygon.kind === 'room-floor' && polygon.roomId && !ids.includes(polygon.roomId)) {
			ids.push(polygon.roomId);
		}
	}
	return ids;
}

function nearestPointHit(
	queries: CompiledLayoutQueryGeometry,
	point: LayoutVec2,
	tolerance: number,
	kind: 'vertex' | 'interior-anchor'
): PlanHitResult {
	let best: PlanHitResult = null;
	let bestDistance = tolerance;
	for (const record of queries.points) {
		if (record.kind !== kind) continue;
		if (record.roomId === undefined) continue;
		const distance = Math.hypot(record.point[0] - point[0], record.point[1] - point[1]);
		if (distance <= bestDistance) {
			best =
				kind === 'vertex'
					? { kind: 'vertex', roomId: record.roomId, segmentId: record.segmentId, vertexIndex: record.sourceIndex }
					: { kind: 'interiorAnchor', roomId: record.roomId, segmentId: record.segmentId, anchorId: record.sourceId };
			bestDistance = distance;
		}
	}
	return best;
}

/** Canonical wall-first Wall endpoint hit: roomless `vertex` records only. */
function nearestCanonicalEndpointHit(
	queries: CompiledLayoutQueryGeometry,
	point: LayoutVec2,
	tolerance: number
): PlanHitResult {
	let best: { wallId: string; endpoint: 0 | 1; at: LayoutVec2 } | null = null;
	let bestDistance = tolerance;
	for (const record of queries.points) {
		if (record.kind !== 'vertex') continue;
		if (record.roomId !== undefined) continue;
		if (record.sourceIndex !== 0 && record.sourceIndex !== 1) continue;
		const distance = Math.hypot(record.point[0] - point[0], record.point[1] - point[1]);
		if (distance <= bestDistance) {
			best = {
				wallId: record.wallKey ?? record.segmentId,
				endpoint: record.sourceIndex,
				at: [...record.point] as LayoutVec2
			};
			bestDistance = distance;
		}
	}
	return best ? { kind: 'wallEndpoint', wallId: best.wallId, endpoint: best.endpoint, point: best.at } : null;
}

function nearestOpeningHit(
	queries: CompiledLayoutQueryGeometry,
	point: LayoutVec2,
	tolerance: number
): PlanHitResult {
	const wallSpans = wallSpansByRoomSegment(queries);
	const openingSpans = openingSpansByRoom(queries);
	for (const roomId of [...orderedRoomIds(queries)].reverse()) {
		for (const opening of [...(openingSpans.get(roomId) ?? [])].reverse()) {
			const spans = wallSpans.get(roomId)?.get(opening.segmentId) ?? [];
			const projection = projectPointToSpans(point, spans);
			if (!projection || projection.distance > tolerance) continue;
			if (
				projection.offset >= opening.startDistance - tolerance &&
				projection.offset <= opening.endDistance + tolerance
			) {
				return {
					kind: 'opening',
					roomId,
					segmentId: opening.segmentId,
					openingId: opening.openingId!,
					projection: { point: projection.point, offset: projection.offset, distance: projection.distance, t: projection.t }
				};
			}
		}
	}
	return null;
}

/** Canonical wall-first opening hit: `(wallId, openingId)`, no fake `roomId`. */
function canonicalOpeningHit(
	queries: CompiledLayoutQueryGeometry,
	point: LayoutVec2,
	tolerance: number
): PlanHitResult {
	for (const [wallId, group] of physicalSpansByWall(queries)) {
		const projection = projectPointToSpans(point, group.wallSpans);
		if (!projection || projection.distance > tolerance) continue;
		for (const opening of [...group.openingSpans].reverse()) {
			if (!opening.openingId) continue;
			if (
				projection.offset >= opening.startDistance - tolerance &&
				projection.offset <= opening.endDistance + tolerance
			) {
				return {
					kind: 'wallOpening',
					wallId,
					openingId: opening.openingId,
					projection: {
						point: projection.point,
						offset: projection.offset,
						distance: projection.distance,
						t: projection.t
					}
				};
			}
		}
	}
	return null;
}

/** Canonical wall-first Wall hit for authoring tools (never a selection target). */
function canonicalWallHit(
	queries: CompiledLayoutQueryGeometry,
	point: LayoutVec2,
	tolerance: number
): PlanHitResult {
	let best: { wallId: string; projection: PlanWallProjection } | null = null;
	for (const [wallId, group] of physicalSpansByWall(queries)) {
		const projection = projectPointToSpans(point, group.wallSpans);
		if (!projection || projection.distance > tolerance) continue;
		if (!best || projection.distance < best.projection.distance) {
			best = {
				wallId,
				projection: {
					point: projection.point,
					offset: projection.offset,
					distance: projection.distance,
					t: projection.t
				}
			};
		}
	}
	return best
		? { kind: 'physicalWall', wallId: best.wallId, projection: best.projection }
		: null;
}

/**
 * P23.11 — nearest curve control within tolerance, or `null`. Ties resolve to
 * the first candidate in caller order, so the caller's own ordering stays the
 * authority (never a distance tiebreak the document cannot express).
 */
function nearestCurveControlHit(
	controls: readonly PlanCurveControlCandidate[],
	point: LayoutVec2,
	tolerance: number
): PlanHitResult {
	let best: { control: PlanCurveControlCandidate; distance: number } | null = null;
	for (const control of controls) {
		const span = Math.hypot(control.point[0] - point[0], control.point[1] - point[1]);
		if (span > tolerance) continue;
		if (!best || span < best.distance) best = { control, distance: span };
	}
	return best
		? {
				kind: 'wallCurveControl',
				wallId: best.control.wallId,
				anchorId: best.control.anchorId,
				point: [best.control.point[0], best.control.point[1]]
			}
		: null;
}

function nearestWallHit(
	queries: CompiledLayoutQueryGeometry,
	point: LayoutVec2,
	tolerance: number
): PlanHitResult {
	const wallSpans = wallSpansByRoomSegment(queries);
	let best: { roomId: string; segmentId: string; projection: PlanWallProjection } | null = null;
	for (const roomId of [...orderedRoomIds(queries)].reverse()) {
		for (const [segmentId, spans] of wallSpans.get(roomId) ?? []) {
			const projection = projectPointToSpans(point, spans);
			if (!projection || projection.distance > tolerance) continue;
			if (!best || projection.distance < best.projection.distance) {
				best = {
					roomId,
					segmentId,
					projection: { point: projection.point, offset: projection.offset, distance: projection.distance, t: projection.t }
				};
			}
		}
	}
	return best
		? { kind: 'wall', roomId: best.roomId, segmentId: best.segmentId, projection: best.projection }
		: null;
}

/**
 * Resolve the locked-priority hit for a world-space plan point. `options.
 * allowedRoomIds` restricts room hits to authored room candidates (e.g. only
 * first-floor rooms during primitive placement); a contained room outside the
 * set yields no hit. `options.includeEndpoints` gates canonical endpoint
 * (Junction) hits — below the Junction-handle LOD the invisible endpoint
 * must not outrank its Wall, so callers pass false and the physical Wall
 * wins (default true preserves the full authority). `options.curveControls`
 * are the transient controls of the selected curved Wall (P23.11).
 */
export function resolvePlanHit(
	queries: CompiledLayoutQueryGeometry,
	point: LayoutVec2,
	tolerance: number,
	options?: {
		allowedRoomIds?: ReadonlySet<string>;
		includeEndpoints?: boolean;
		curveControls?: readonly PlanCurveControlCandidate[];
	}
): PlanHitResult {
	const vertex = nearestPointHit(queries, point, tolerance, 'vertex');
	if (vertex) return vertex;
	const endpoint =
		options?.includeEndpoints === false
			? null
			: nearestCanonicalEndpointHit(queries, point, tolerance);
	if (endpoint) return endpoint;
	const anchor = nearestPointHit(queries, point, tolerance, 'interior-anchor');
	if (anchor) return anchor;
	const opening = nearestOpeningHit(queries, point, tolerance);
	if (opening) return opening;
	const canonicalOpening = canonicalOpeningHit(queries, point, tolerance);
	if (canonicalOpening) return canonicalOpening;

	// P23.11 — locked priority: Junction / endpoint > Opening body/handle >
	// curve control > Wall body. A control outranks the Wall and object body it
	// sits on (otherwise dragging it would re-select what it belongs to) and
	// stays below Junction and Opening handles so an overlapping endpoint or
	// opening edge still wins.
	const curveControl = nearestCurveControlHit(options?.curveControls ?? [], point, tolerance);
	if (curveControl) return curveControl;

	const objectPolygon = findPolygonContaining(
		point,
		queries.polygons.filter((polygon) => polygon.kind === 'object-footprint')
	);
	if (objectPolygon?.objectId) {
		return { kind: 'object', objectId: objectPolygon.objectId };
	}

	const wall = nearestWallHit(queries, point, tolerance);
	if (wall) return wall;
	const canonicalWall = canonicalWallHit(queries, point, tolerance);
	if (canonicalWall) return canonicalWall;

	const room = findPlanHitRoom(queries, point, options);
	return room ? { kind: 'room', roomId: room.roomId } : null;
}

/**
 * Room containment only — no vertex/anchor/opening/object/wall priority. Used by
 * primitive placement so a point near a wall still resolves to the containing
 * room, unlike the full selection priority in `resolvePlanHit`.
 */
export function findPlanHitRoom(
	queries: CompiledLayoutQueryGeometry,
	point: LayoutVec2,
	options?: { allowedRoomIds?: ReadonlySet<string> }
): { roomId: string } | null {
	const roomPolygons = options?.allowedRoomIds
		? queries.polygons.filter(
				(polygon) => polygon.kind === 'room-floor' && polygon.roomId && options.allowedRoomIds!.has(polygon.roomId)
			)
		: queries.polygons.filter((polygon) => polygon.kind === 'room-floor');
	const roomPolygon = findPolygonContaining(point, roomPolygons);
	return roomPolygon?.roomId ? { roomId: roomPolygon.roomId } : null;
}

/** Project a point onto one wall segment's compiled spans (linear reference). */
export function projectPointToWall(
	queries: CompiledLayoutQueryGeometry,
	roomId: string,
	segmentId: string,
	point: LayoutVec2
): PlanWallProjection | null {
	const spans = wallSpansByRoomSegment(queries).get(roomId)?.get(segmentId) ?? [];
	const projection = projectPointToSpans(point, spans);
	return projection
		? { point: projection.point, offset: projection.offset, distance: projection.distance, t: projection.t }
		: null;
}

/**
 * Project a point onto one canonical physical Wall's compiled spans, keyed by
 * document-global `wallId` (no `roomId`). Returns the unclamped linear offset
 * — callers decide fit validity; this helper never clamps.
 */
export function projectPointToPhysicalWall(
	queries: CompiledLayoutQueryGeometry,
	wallId: string,
	point: LayoutVec2
): PlanWallProjection | null {
	const spans = physicalSpansByWall(queries).get(wallId)?.wallSpans ?? [];
	const projection = projectPointToSpans(point, spans);
	return projection
		? { point: projection.point, offset: projection.offset, distance: projection.distance, t: projection.t }
		: null;
}

/** Total compiled arc length of one canonical physical Wall. */
export function compiledPhysicalWallLength(
	queries: CompiledLayoutQueryGeometry,
	wallId: string
): number {
	return physicalSpansByWall(queries).get(wallId)?.wallSpans.at(-1)?.endDistance ?? 0;
}

/** Total compiled arc length of one wall segment. */
export function compiledWallLength(
	queries: CompiledLayoutQueryGeometry,
	roomId: string,
	segmentId: string
): number {
	return wallSpansByRoomSegment(queries).get(roomId)?.get(segmentId)?.at(-1)?.endDistance ?? 0;
}
