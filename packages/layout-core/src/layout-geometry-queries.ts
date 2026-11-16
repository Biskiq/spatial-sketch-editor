import type { LayoutVec2 } from './layout-coordinates';
import type {
	CompiledLayoutGeometry,
	CompiledQueryAabb,
	CompiledQueryPoint,
	CompiledQueryPolygon,
	CompiledQuerySpan,
	CompiledRoom,
	LayoutBounds2
} from './layout-geometry-types';
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
export type OverheadSourceKey = { readonly kind: 'room-lid'; readonly roomId: string };

export type OverheadSource = {
	readonly key: OverheadSourceKey;
	/** The selectable subject that owns this overhead. */
	readonly subject: { readonly kind: 'room'; readonly id: string };
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
	const sources: OverheadSource[] = [];
	for (const room of rooms) {
		const source = roomLidSource(room);
		if (source !== null) sources.push(source);
	}
	// Deterministic order: callers and tests address sources by position, and a
	// compile that reorders its Room list must not reorder the lifted set.
	return sources.sort((left, right) =>
		left.key.roomId < right.key.roomId ? -1 : left.key.roomId > right.key.roomId ? 1 : 0
	);
}

/** One compiled Room's generated lid, or `null` when it has no overhead to lift. */
function roomLidSource(room: CompiledRoom): OverheadSource | null {
	// A Room with a degenerately small ceiling ring encloses no plan area, and an
	// elevation the compiler could not resolve is not a place to draw an outline.
	if (room.ceilingPolygon.length < 3) return null;
	if (!Number.isFinite(room.ceilingElevation)) return null;
	return {
		key: { kind: 'room-lid', roomId: room.roomId },
		subject: { kind: 'room', id: room.roomId },
		outline: room.ceilingPolygon.map((point): LayoutVec2 => [point[0], point[1]]),
		elevation: room.ceilingElevation
	};
}
