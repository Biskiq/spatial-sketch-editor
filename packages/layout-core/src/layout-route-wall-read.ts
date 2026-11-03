/**
 * R217.S29 (E12) — the route-versus-Wall advisory read.
 *
 * A pure, runtime-safe reading of an evaluated Camera route against the
 * **already compiled** Layout: each route segment is tested against the plan
 * footprint of a Wall's opening-free solid spans, including the Wall's
 * thickness and the span's vertical extent. A segment that passes through a
 * doorway therefore clears the advisory, because the compiler has already
 * removed the Opening from `solidSpans`; a centreline or AABB approximation is
 * never used, so a path that merely touches a Wall's bounds does not report a
 * crossing.
 *
 * The read is advisory. It never blocks, moves a point, mutated the document,
 * recompiled the Layout, or became a Camera guard.
 */
import type { CompiledLayoutGeometry, CompiledPhysicalWall } from './layout-geometry-types';

export type RouteWallReadInput = {
	/** Evaluated route samples in project-world meters, ordered along travel. */
	readonly samples: readonly (readonly [number, number, number])[];
	/** The one canonical compiled Layout representation. */
	readonly geometry: CompiledLayoutGeometry;
};

export type RouteWallRead = {
	readonly crosses: boolean;
	/** Distinct Wall ids the route passes through, in compiled order. */
	readonly wallIds: readonly string[];
	/** Number of consecutive route segments that pass through a solid span. */
	readonly crossingCount: number;
};

type PlanPoint = readonly [number, number];

function finitePoint(point: readonly [number, number]): PlanPoint | null {
	const [x, z] = point;
	return Number.isFinite(x) && Number.isFinite(z) ? [x, z] : null;
}

/** The Wall's floor datum in project-world meters; a missing Floor is datum 0. */
function wallDatum(geometry: CompiledLayoutGeometry, wall: CompiledPhysicalWall): number {
	const floor = geometry.floors.find((candidate) => candidate.floorId === wall.floorId);
	return floor === undefined || !Number.isFinite(floor.elevation) ? 0 : floor.elevation;
}

type Interval = readonly [number, number];

/** Clip one coordinate's [0,1] interval to the strict open range (min,max). */
function clipRange(start: number, end: number, min: number, max: number): Interval | null {
	const delta = end - start;
	if (Math.abs(delta) <= 1e-12) {
		return start > min && start < max ? [0, 1] : null;
	}
	let enter = (min - start) / delta;
	let leave = (max - start) / delta;
	if (enter > leave) [enter, leave] = [leave, enter];
	const clipped: Interval = [Math.max(0, enter), Math.min(1, leave)];
	return clipped[0] < clipped[1] - 1e-12 ? clipped : null;
}

function intersectIntervals(a: Interval, b: Interval): Interval | null {
	const start = Math.max(a[0], b[0]);
	const end = Math.min(a[1], b[1]);
	return start < end - 1e-12 ? [start, end] : null;
}

/**
 * A segment is through the solid when its parameter interval inside the
 * span's plan footprint and vertical extent has positive length. This is a
 * clip, not a boundary-edge test: a whole segment inside is caught, vertical
 * entry is caught, and touching one face without entering is not.
 */
function segmentCrossesWall(
	from: readonly [number, number, number],
	to: readonly [number, number, number],
	wall: CompiledPhysicalWall,
	datum: number
): boolean {
	// The compiler emits one span per sample segment. Merge touching spans with
	// the same section and vertical extent first, so a route crossing exactly at
	// a span boundary (or lying wholly inside) is not mistaken for a miss.
	for (let index = 0; index < wall.solidSpans.length; index += 1) {
		const first = wall.solidSpans[index]!;
		let last = first;
		while (index + 1 < wall.solidSpans.length) {
			const next = wall.solidSpans[index + 1]!;
			if (
				next.sectionIndex !== last.sectionIndex ||
				next.bottomY !== last.bottomY ||
				next.topY !== last.topY ||
				Math.abs(next.startDistance - last.endDistance) > 1e-9
			) {
				break;
			}
			last = next;
			index += 1;
		}
		const bottom = datum + first.bottomY;
		const top = datum + first.topY;
		if (!(top > bottom)) continue;
		const start = finitePoint(first.start);
		const end = finitePoint(last.end);
		if (start === null || end === null) continue;
		const dx = end[0] - start[0];
		const dz = end[1] - start[1];
		const length = Math.hypot(dx, dz);
		if (!Number.isFinite(length) || length <= Number.EPSILON) continue;
		const ux = dx / length;
		const uz = dz / length;
		const half = Math.max(
			(Number.isFinite(wall.thickness) ? Math.max(wall.thickness, 0) : 0) / 2,
			1e-6
		);
		const u0 = (from[0] - start[0]) * ux + (from[2] - start[1]) * uz;
		const u1 = (to[0] - start[0]) * ux + (to[2] - start[1]) * uz;
		const v0 = (from[0] - start[0]) * -uz + (from[2] - start[1]) * ux;
		const v1 = (to[0] - start[0]) * -uz + (to[2] - start[1]) * ux;
		const u = clipRange(u0, u1, 0, length);
		if (u === null) continue;
		const v = clipRange(v0, v1, -half, half);
		if (v === null) continue;
		const y = clipRange(from[1], to[1], bottom, top);
		if (y === null) continue;
		if (intersectIntervals(intersectIntervals(u, v) ?? [0, 0], y) !== null) return true;
	}
	return false;
}

/**
 * Read whether an evaluated route passes through any compiled Wall solid.
 * Samples must be finite; a malformed sample is skipped rather than guessed.
 */
export function routeCrossesWall(input: RouteWallReadInput): RouteWallRead {
	const walls = input.geometry.walls;
	if (walls.length === 0 || input.samples.length < 2) {
		return { crosses: false, wallIds: [], crossingCount: 0 };
	}
	const datums = new Map<string, number>();
	const hitWalls = new Set<string>();
	let crossingCount = 0;
	for (let index = 0; index + 1 < input.samples.length; index += 1) {
		const from = input.samples[index]!;
		const to = input.samples[index + 1]!;
		if (
			!Number.isFinite(from[0]) ||
			!Number.isFinite(from[1]) ||
			!Number.isFinite(from[2]) ||
			!Number.isFinite(to[0]) ||
			!Number.isFinite(to[1]) ||
			!Number.isFinite(to[2])
		) {
			continue;
		}
		let crossed = false;
		for (const wall of walls) {
			let datum = datums.get(wall.wallId);
			if (datum === undefined) {
				datum = wallDatum(input.geometry, wall);
				datums.set(wall.wallId, datum);
			}
			if (!segmentCrossesWall(from, to, wall, datum)) continue;
			hitWalls.add(wall.wallId);
			crossed = true;
		}
		if (crossed) crossingCount += 1;
	}
	return {
		crosses: hitWalls.size > 0,
		wallIds: [...hitWalls],
		crossingCount
	};
}
