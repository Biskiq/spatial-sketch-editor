import type { LayoutVec2 } from './layout-coordinates';
import type {
	CompiledLayoutGeometry,
	CompiledQueryAabb,
	CompiledQueryPoint,
	CompiledQueryPolygon,
	CompiledQuerySpan,
	CompiledRegion,
	CompiledRoom,
	LayoutBounds2
} from './layout-geometry-types';
import { polygonsShareInteriorArea } from './layout-face-extraction';
import { pointInPolygon } from './layout-geometry-objects';

export type { CompiledQueryPoint, CompiledQuerySpan, CompiledQueryPolygon, CompiledQueryAabb };

export type QueryGeometryBuilder = {
	points: CompiledQueryPoint[];
	spans: CompiledQuerySpan[];
	polygons: CompiledQueryPolygon[];
	aabbs: CompiledQueryAabb[];
};

export function createQueryGeometryBuilder(): QueryGeometryBuilder {
	return { points: [], spans: [], polygons: [], aabbs: [] };
}

export function bounds2(minX: number, minZ: number, maxX: number, maxZ: number): LayoutBounds2 {
	return { min: [minX, minZ], max: [maxX, maxZ] };
}

export function polygonBounds2(polygon: readonly LayoutVec2[]): LayoutBounds2 | null {
	if (polygon.length === 0) return null;
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of polygon) {
		minX = Math.min(minX, x);
		minZ = Math.min(minZ, z);
		maxX = Math.max(maxX, x);
		maxZ = Math.max(maxZ, z);
	}
	return bounds2(minX, minZ, maxX, maxZ);
}

export type QueryProjection = {
	span: CompiledQuerySpan;
	point: LayoutVec2;
	offset: number;
	distance: number;
	t: number;
};

/** Nearest-span projection over compiled query spans (linear reference). */
export function projectPointToSpans(point: LayoutVec2, spans: readonly CompiledQuerySpan[]): QueryProjection | null {
	let best: QueryProjection | null = null;
	for (const span of spans) {
		const dx = span.end[0] - span.start[0];
		const dz = span.end[1] - span.start[1];
		const squared = dx * dx + dz * dz;
		const rawT = squared > 0 ? ((point[0] - span.start[0]) * dx + (point[1] - span.start[1]) * dz) / squared : 0;
		const amount = Math.min(1, Math.max(0, rawT));
		const projected: LayoutVec2 = [span.start[0] + dx * amount, span.start[1] + dz * amount];
		const distanceToPath = Math.hypot(point[0] - projected[0], point[1] - projected[1]);
		const offset = span.startDistance + (span.endDistance - span.startDistance) * amount;
		const t = (span.startT ?? 0) + ((span.endT ?? span.startT ?? 0) - (span.startT ?? 0)) * amount;
		if (!best || distanceToPath < best.distance) {
			best = { span, point: projected, offset, distance: distanceToPath, t };
		}
	}
	return best;
}

export function findPolygonContaining(point: LayoutVec2, polygons: readonly CompiledQueryPolygon[]): CompiledQueryPolygon | null {
	for (const polygon of [...polygons].reverse()) {
		if (pointInPolygon(point, polygon.polygon)) return polygon;
	}
	return null;
}

/**
 * Resolve the compiled Space that owns a plan point.
 *
 * The compiled `floorPolygon` is the geometry authority: this query never
 * recomposes an authored boundary and never reads the query-record copy as a
 * second source of truth. Among every Space containing the point, the smallest
 * floor area wins. Equal areas break by authored Room id, so array order is
 * never authority. Enclosed and open Spaces participate identically.
 *
 * `findPolygonContaining` remains the reverse-order query for consumers that
 * have not migrated to Space identity.
 */
export function spaceAtPoint(point: LayoutVec2, spaces: readonly CompiledRoom[]): CompiledRoom | null {
	let best: CompiledRoom | null = null;
	let bestArea = Infinity;
	for (const space of spaces) {
		if (space.floorPolygon.length < 3) continue;
		if (!pointInPolygon(point, space.floorPolygon)) continue;
		const area = Math.abs(signedPolygonArea(space.floorPolygon));
		if (
			area < bestArea ||
			(area === bestArea && best !== null && space.roomId < best.roomId)
		) {
			best = space;
			bestArea = area;
		}
	}
	return best;
}

/** Signed shoelace area in world X/Z. */
function signedPolygonArea(polygon: readonly LayoutVec2[]): number {
	let twiceArea = 0;
	const origin = polygon[0]!;
	const shift = Math.abs(origin[0]) > 1e6 || Math.abs(origin[1]) > 1e6;
	const ox = shift ? origin[0] : 0;
	const oz = shift ? origin[1] : 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		twiceArea += (current[0] - ox) * (next[1] - oz) - (next[0] - ox) * (current[1] - oz);
	}
	return twiceArea / 2;
}

/** Flat compiled query records exposed for consumers + a future spatial index. */
export function compiledQueryGeometry(geometry: CompiledLayoutGeometry) {
	return geometry.queries;
}

/** Which overheads a session reading lifts: one Space's, or every Space's. */
export type OverheadScope =
	| { readonly kind: 'all' }
	| { readonly kind: 'space'; readonly roomId: string };

/**
 * The stable identity of one overhead source.
 *
 * `room-lid` is today's only kind: the generated ceiling a closed Room derives
 * from its boundary Walls. V1b adds an authored-region kind beside it; nothing
 * that reads a source's subject, outline or elevation changes then, because all
 * three are stated here rather than by the reader.
 */
export type OverheadSourceKey =
	| { readonly kind: 'room-lid'; readonly roomId: string }
	| { readonly kind: 'region'; readonly regionId: string };

export type OverheadSource = {
	readonly key: OverheadSourceKey;
	/** The selectable subject that owns this overhead. */
	readonly subject:
		| { readonly kind: 'room'; readonly id: string }
		| { readonly kind: 'region'; readonly id: string };
	/** Closed plan loop, world XZ, no repeated last point. */
	readonly outline: readonly LayoutVec2[];
	/** World Y of the overhead's underside. */
	readonly elevation: number;
};

/**
 * The overheads a session reading may lift, for one scope.
 *
 * **One authority.** A lifted overhead is whatever this function names, never
 * whatever a consumer decides by reading `CompiledRoom.ceilingElevation` itself,
 * so V1's authored regions and SP1's open-to-sky Rooms join here — and only
 * here. Layout owns the geometry and this representation of it; the shell owns
 * only the temporary reading that asks for a scope.
 *
 * Pure: no caching, no Three objects, and the outline is a copy, so a caller
 * that transforms it cannot write the compiled geometry.
 */
export function overheadSourcesOf(
	compiled: CompiledLayoutGeometry,
	scope: OverheadScope
): readonly OverheadSource[] {
	const rooms =
		scope.kind === 'space'
			? compiled.rooms.filter((room) => room.roomId === scope.roomId)
			: compiled.rooms;
	const lidSources: OverheadSource[] = [];
	for (const room of rooms) {
		const source = roomLidSource(room);
		if (source !== null) lidSources.push(source);
	}
	// Deterministic order: callers and tests address lifts by position, and a
	// compile that reorders its Room list must not reorder the lifted set. Lid
	// order is unchanged; authored overhead regions follow, by region id.
	lidSources.sort((left, right) =>
		left.key.kind !== 'room-lid' || right.key.kind !== 'room-lid'
			? 0
			: left.key.roomId < right.key.roomId
				? -1
				: left.key.roomId > right.key.roomId
					? 1
					: 0
	);
	const regions = (
		scope.kind === 'space'
			? regionsOverSpace(compiled, scope.roomId)
			: compiled.regions
	)
		.filter((region) => region.role === 'overhead')
		.filter(regionFootprintUsable)
		.sort((left, right) =>
			left.regionId < right.regionId ? -1 : left.regionId > right.regionId ? 1 : 0
		);
	const regionSources = regions.flatMap((region): OverheadSource[] => {
		const source = regionUndersideSource(region);
		return source === null ? [] : [source];
	});
	return [...lidSources, ...regionSources];
}

/**
 * Authored regions whose footprint shares positive interior area with a
 * compiled Space, ordered by region id. Both roles participate: this is the
 * association query, not a lift list.
 *
 * A Room that is not part of the compile (or has no usable floor polygon) has no
 * regions over it. Overlap is the only rule: containment, shared edges and
 * coincident projections do not count as positive interior area.
 */
export function regionsOverSpace(
	compiled: CompiledLayoutGeometry,
	roomId: string
): readonly CompiledRegion[] {
	const room = compiled.rooms.find((candidate) => candidate.roomId === roomId);
	if (room === undefined || room.floorPolygon.length < 3) return [];
	const bounds = polygonBounds2(room.floorPolygon);
	if (bounds === null) return [];
	return compiled.regions
		.filter((region) => regionFootprintUsable(region))
		.filter((region) => {
			const regionBounds = region.bounds2;
			if (
				regionBounds.max[0] <= bounds.min[0] || bounds.max[0] <= regionBounds.min[0] ||
				regionBounds.max[1] <= bounds.min[1] || bounds.max[1] <= regionBounds.min[1]
			) return false;
			return polygonsShareInteriorArea(region.footprint, room.floorPolygon);
		})
		.sort((left, right) =>
			left.regionId < right.regionId ? -1 : left.regionId > right.regionId ? 1 : 0
		);
}

/** One compiled Room's generated lid, or `null` when it has no overhead to lift. */
function roomLidSource(room: CompiledRoom): OverheadSource | null {
	// `open-to-sky` has no generated lid to lift, and a Room with a degenerately
	// small ceiling ring encloses no plan area; an elevation the compiler could
	// not resolve is not a place to draw an outline.
	if (room.overhead === 'open-to-sky') return null;
	if (room.ceilingPolygon.length < 3) return null;
	if (!Number.isFinite(room.ceilingElevation)) return null;
	return {
		key: { kind: 'room-lid', roomId: room.roomId },
		subject: { kind: 'room', id: room.roomId },
		outline: room.ceilingPolygon.map((point): LayoutVec2 => [point[0], point[1]]),
		elevation: room.ceilingElevation
	};
}

function regionFootprintUsable(region: CompiledRegion): boolean {
	return region.footprint.length >= 3 && Number.isFinite(region.bottomY);
}

/** One compiled overhead region's authored underside, or `null` when unusable. */
function regionUndersideSource(region: CompiledRegion): OverheadSource | null {
	if (!regionFootprintUsable(region)) return null;
	return {
		key: { kind: 'region', regionId: region.regionId },
		subject: { kind: 'region', id: region.regionId },
		outline: region.footprint.map((point): LayoutVec2 => [point[0], point[1]]),
		elevation: region.bottomY
	};
}
