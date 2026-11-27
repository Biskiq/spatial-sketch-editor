/**
 * `layout-region-form-geometry.ts` — the compiled faces of one shed or gable
 * Region.
 *
 * The form is a profile extruded across the footprint and clipped by it. A
 * footprint may be concave, so the region on one side of the ridge is not one
 * ring: a U, a spiral or a ridge through a notch yields several plan pieces.
 * This module builds an exact partition instead of guessing a ring:
 *
 * 1. The footprint is ear-clipped into triangles (collinear boundary points are
 *    dropped first; they are not corners).
 * 2. Each triangle is clipped against the ridge half-planes. A triangle is
 *    convex, so the clip is exact and every crossing is computed once per
 *    undirected triangulation edge.
 * 3. The sub-triangles of each side are merged back by cancelling shared
 *    directed edges. The remaining boundary loops are the maximal planar
 *    pieces of that side, and they include every ridge crossing once.
 * 4. The triangulation's own boundary edges give the vertical perimeter faces,
 *    split at the same crossings. Top, underside and edge faces therefore share
 *    identical vertex values: no cracks, no T-junctions and an exact ridge.
 *
 * The profile is affine on each side of the ridge, so each merged loop is
 * planar. The top is the same plan loop offset by `thickness`, so the slab has a
 * constant vertical thickness everywhere. This is a bounded geometric
 * derivation, not a second form model: heights come only from
 * `regionUndersideAtStation`.
 */
import type { LayoutVec2 } from '../../geometry/coordinates';
import { LAYOUT_GEOMETRY_EPSILON } from '../../geometry/openings';
import { orientXZ } from '../../geometry/robust-orientation';
import { spaceOutlineSignedArea } from '../space-outline';
import type { Vec3 } from '../../kernel/types';
import type { CompiledRegion } from '../../geometry/types';
import type { LayoutRegion } from '../../wall/types';
import { regionFormProfile, regionUndersideAtStation, type RegionFormProfile } from './form';

type Face = CompiledRegion['faces'][number];
type PointKey = string;

/** The input facts the compiler holds for one authored region. */
export type RegionFormSource = Pick<LayoutRegion, 'role' | 'form' | 'thickness'> & {
	readonly footprint: readonly LayoutVec2[];
};

export type RegionFormCompilation =
	| {
			readonly kind: 'compiled';
			readonly faces: Face[];
			/** Lowest underside over the footprint (the eave). */
			readonly bottomY: number;
			/** Highest top over the footprint. */
			readonly topY: number;
	  }
	| { readonly kind: 'failed'; readonly message: string };

function keyOfVertex(index: number): PointKey {
	return `v:${index}`;
}

function keyOfCrossing(a: number, b: number): PointKey {
	return `e:${Math.min(a, b)}:${Math.max(a, b)}`;
}

function pointInTriangleInclusive(
	point: LayoutVec2,
	a: LayoutVec2,
	b: LayoutVec2,
	c: LayoutVec2,
): boolean {
	return orientXZ(a, b, point) >= 0 && orientXZ(b, c, point) >= 0 && orientXZ(c, a, point) >= 0;
}

/**
 * Drop boundary points that are not corners.
 *
 * A point on the straight run between its neighbours adds no shape and makes a
 * zero-area ear, so it is removed before triangulation. The authored footprint
 * itself is untouched: bounds, Plan records and the Region query polygon still
 * use every authored point.
 */
function cleanRing(points: readonly LayoutVec2[]): LayoutVec2[] | null {
	if (points.length < 3) return null;
	const ring = points.map(([x, z]): LayoutVec2 => [x, z]);
	let changed = true;
	while (changed && ring.length >= 3) {
		changed = false;
		for (let index = 0; index < ring.length; index++) {
			const count = ring.length;
			const before = ring[(index + count - 1) % count]!;
			const point = ring[index]!;
			const after = ring[(index + 1) % count]!;
			if (orientXZ(before, point, after) !== 0) continue;
			// Only a between point is a redundant boundary point; a spike is an
			// invalid footprint and the shared admission refuses it before here.
			const between =
				(before[0] - point[0]) * (after[0] - point[0]) +
					(before[1] - point[1]) * (after[1] - point[1]) <=
				0;
			if (!between) continue;
			ring.splice(index, 1);
			changed = true;
			break;
		}
	}
	if (ring.length < 3) return null;
	if (!(spaceOutlineSignedArea(ring) > 0)) return null;
	return ring;
}

/**
 * Ear clipping over a simple CCW ring with no collinear corners.
 *
 * The ear test is inclusive: a vertex exactly on the candidate triangle's
 * boundary blocks that ear, so every emitted triangle's edges are real
 * diagonals or boundary edges. That is what makes the later shared-edge
 * cancellation exact. The two-ears theorem guarantees an ear for every simple
 * polygon with no three consecutive collinear vertices.
 */
function earClip(ring: readonly LayoutVec2[]): number[][] | null {
	const count = ring.length;
	const remaining = ring.map((_, index) => index);
	const triangles: number[][] = [];
	let guard = 0;
	while (remaining.length > 3) {
		if (++guard > count * count + 4) return null;
		let found = false;
		const size = remaining.length;
		for (let position = 0; position < size; position++) {
			const a = remaining[(position + size - 1) % size]!;
			const b = remaining[position]!;
			const c = remaining[(position + 1) % size]!;
			if (orientXZ(ring[a]!, ring[b]!, ring[c]!) <= 0) continue;
			let blocked = false;
			for (const other of remaining) {
				if (other === a || other === b || other === c) continue;
				if (pointInTriangleInclusive(ring[other]!, ring[a]!, ring[b]!, ring[c]!)) {
					blocked = true;
					break;
				}
			}
			if (blocked) continue;
			triangles.push([a, b, c]);
			remaining.splice(position, 1);
			found = true;
			break;
		}
		if (!found) return null;
	}
	const [a, b, c] = remaining as [number, number, number];
	if (orientXZ(ring[a]!, ring[b]!, ring[c]!) <= 0) return null;
	triangles.push([a, b, c]);
	return triangles;
}

/** Signed area of a plan loop; positive is the face orientation. */
function loopArea(
	loop: readonly PointKey[],
	coordinates: ReadonlyMap<PointKey, LayoutVec2>,
): number {
	return spaceOutlineSignedArea(loop.map((key) => coordinates.get(key)!));
}

/**
 * Merge sub-triangle boundaries into the maximal boundary loops of one side.
 *
 * Every interior edge of a valid triangulation appears once in each direction,
 * so cancelling opposite directed edges leaves exactly the outer boundary. The
 * boundary of a concave half-plane cut is several loops; tracing each loop
 * separately is what keeps a U-shaped footprint from becoming a weak polygon.
 */
function boundaryLoops(
	pieces: readonly (readonly PointKey[])[],
	coordinates: ReadonlyMap<PointKey, LayoutVec2>,
): PointKey[][] | null {
	const counts = new Map<string, number>();
	const order: Array<[PointKey, PointKey]> = [];
	for (const piece of pieces) {
		for (let index = 0; index < piece.length; index++) {
			const from = piece[index]!;
			const to = piece[(index + 1) % piece.length]!;
			const key = `${from}|${to}`;
			if (!counts.has(key)) order.push([from, to]);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	const outgoing = new Map<PointKey, PointKey[]>();
	let edgeCount = 0;
	for (const [from, to] of order) {
		const forward = counts.get(`${from}|${to}`) ?? 0;
		const reverse = counts.get(`${to}|${from}`) ?? 0;
		for (let index = 0; index < forward - reverse; index++) {
			let destinations = outgoing.get(from);
			if (destinations === undefined) {
				destinations = [];
				outgoing.set(from, destinations);
			}
			destinations.push(to);
			edgeCount++;
		}
	}
	if (edgeCount === 0) return null;

	const loops: PointKey[][] = [];
	for (const [start, destinations] of outgoing) {
		while (destinations.length > 0) {
			const path: PointKey[] = [start];
			let current = start;
			let closed = false;
			for (let step = 0; step <= edgeCount; step++) {
				const list = outgoing.get(current);
				if (list === undefined || list.length === 0) break;
				const next = list.shift()!;
				if (next === start) {
					closed = true;
					break;
				}
				path.push(next);
				current = next;
			}
			if (!closed) return null;
			for (const loop of splitAtRepeats(path)) {
				if (loop.length < 3) continue;
				if (!(loopArea(loop, coordinates) > 0)) continue;
				loops.push(loop);
			}
		}
	}
	return loops.length > 0 ? loops : null;
}

/**
 * A boundary walk may touch a pinch vertex twice. Splitting at the repeat keeps
 * every emitted face a simple ring, which is what the mesh builder triangulates.
 */
function splitAtRepeats(path: readonly PointKey[]): PointKey[][] {
	const loops: PointKey[][] = [];
	const pending: PointKey[][] = [path.slice()];
	for (let index = 0; index < pending.length; index++) {
		const current = pending[index]!;
		let split = false;
		for (let first = 0; first < current.length && !split; first++) {
			for (let second = first + 2; second < current.length; second++) {
				if (current[first] !== current[second]) continue;
				const loop = current.slice(first, second);
				if (loop.length >= 3) loops.push(loop);
				const rest = [...current.slice(0, first + 1), ...current.slice(second + 1)];
				if (rest.length >= 3) pending.push(rest);
				split = true;
				break;
			}
		}
		if (!split && current.length >= 3) loops.push(current);
	}
	return loops;
}

function normalized(vector: Vec3): Vec3 {
	const length = Math.hypot(vector[0], vector[1], vector[2]);
	return length > 0 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [0, 1, 0];
}

/**
 * Append the vertical perimeter faces for one cleaned footprint, split at the
 * same cached ridge crossings the top and underside use. Keeping this loop out
 * of the main compile keeps both functions within the locality budget and makes
 * the shared-edge contract obvious: bottom→top at the start vertex, top→bottom at
 * the end vertex, reversed relative to the plan ring.
 */
function appendPerimeterFaces(
	cleaned: readonly LayoutVec2[],
	stationByKey: ReadonlyMap<PointKey, number>,
	coordinates: ReadonlyMap<PointKey, LayoutVec2>,
	underside: ReadonlyMap<PointKey, number>,
	profile: RegionFormProfile,
	thickness: number,
	faces: Face[],
	crossingOn: (a: number, b: number) => PointKey,
): void {
	for (let index = 0; index < cleaned.length; index++) {
		const next = (index + 1) % cleaned.length;
		const currentKey = keyOfVertex(index);
		const nextKey = keyOfVertex(next);
		const currentStation = stationByKey.get(currentKey)!;
		const nextStation = stationByKey.get(nextKey)!;
		const keys: PointKey[] =
			(currentStation < profile.qRidge && nextStation > profile.qRidge) ||
			(currentStation > profile.qRidge && nextStation < profile.qRidge)
				? [currentKey, crossingOn(index, next), nextKey]
				: [currentKey, nextKey];
		for (let edge = 0; edge + 1 < keys.length; edge++) {
			const from = keys[edge]!;
			const to = keys[edge + 1]!;
			const fromPoint = coordinates.get(from)!;
			const toPoint = coordinates.get(to)!;
			const dx = toPoint[0] - fromPoint[0];
			const dz = toPoint[1] - fromPoint[1];
			const length = Math.hypot(dx, dz);
			if (!(length > LAYOUT_GEOMETRY_EPSILON)) continue;
			faces.push({
				surface: 'edge',
				polygon: [
					[fromPoint[0], underside.get(from)!, fromPoint[1]],
					[fromPoint[0], underside.get(from)! + thickness, fromPoint[1]],
					[toPoint[0], underside.get(to)! + thickness, toPoint[1]],
					[toPoint[0], underside.get(to)!, toPoint[1]],
				],
				normal: [dz / length, 0, -dx / length],
			});
		}
	}
}

/**
 * Compile the faces of one non-flat Region. The caller has already refused a
 * missing ridge, a non-overhead role and invalid envelope values; a `failed`
 * result is a genuine triangulation failure and blocks the whole compile.
 */
export function compileRegionFormFaces(
	region: RegionFormSource,
	datumY: number,
): RegionFormCompilation {
	const { form, thickness } = region;
	if (form.kind === 'flat') {
		return { kind: 'failed', message: 'A flat Region has no form geometry' };
	}
	if (region.role !== 'overhead') {
		return { kind: 'failed', message: 'Only an overhead Region may carry a sloped form' };
	}
	if (!(thickness > 0) || !Number.isFinite(thickness)) {
		return { kind: 'failed', message: 'Region thickness must be positive and finite' };
	}
	const profile = regionFormProfile(form, region.footprint);
	if (profile === null) {
		return { kind: 'failed', message: 'Region form has no usable projected ridge' };
	}
	const cleaned = cleanRing(region.footprint);
	if (cleaned === null) {
		return { kind: 'failed', message: 'Region footprint has no usable simple ring' };
	}
	const triangles = earClip(cleaned);
	if (triangles === null) {
		return { kind: 'failed', message: 'Region footprint could not be triangulated' };
	}

	const cos = Math.cos(profile.azimuth);
	const sin = Math.sin(profile.azimuth);
	const stationOf = (point: LayoutVec2): number => point[0] * cos + point[1] * sin;
	const stationByKey = new Map<PointKey, number>();
	const coordinates = new Map<PointKey, LayoutVec2>();
	const underside = new Map<PointKey, number>();
	for (const [index, point] of cleaned.entries()) {
		const key = keyOfVertex(index);
		coordinates.set(key, point);
		const station = stationOf(point);
		stationByKey.set(key, station);
		underside.set(key, regionUndersideAtStation(form, profile, datumY, station));
	}
	const crossingOn = (a: number, b: number): PointKey => {
		const key = keyOfCrossing(a, b);
		if (coordinates.has(key)) return key;
		const first = Math.min(a, b);
		const second = Math.max(a, b);
		const from = cleaned[first]!;
		const to = cleaned[second]!;
		const fromStation = stationOf(from);
		const toStation = stationOf(to);
		const amount = (profile.qRidge - fromStation) / (toStation - fromStation);
		const point: LayoutVec2 = [
			from[0] + (to[0] - from[0]) * amount,
			from[1] + (to[1] - from[1]) * amount,
		];
		coordinates.set(key, point);
		// Both sides read one cached ridge value: the shared ridge edge is exact.
		stationByKey.set(key, profile.qRidge);
		underside.set(key, regionUndersideAtStation(form, profile, datumY, profile.qRidge));
		return key;
	};

	const belowPieces: PointKey[][] = [];
	const abovePieces: PointKey[][] = [];
	for (const triangle of triangles) {
		const keys = triangle.map(keyOfVertex);
		for (const [side, keepNegative] of [
			[belowPieces, true],
			[abovePieces, false],
		] as const) {
			const inside = (key: PointKey): boolean =>
				keepNegative
					? stationByKey.get(key)! <= profile.qRidge
					: stationByKey.get(key)! >= profile.qRidge;
			const piece: PointKey[] = [];
			for (let index = 0; index < keys.length; index++) {
				const current = keys[index]!;
				const next = keys[(index + 1) % keys.length]!;
				const currentStation = stationByKey.get(current)!;
				const nextStation = stationByKey.get(next)!;
				if (inside(current)) piece.push(current);
				if (
					(currentStation < profile.qRidge && nextStation > profile.qRidge) ||
					(currentStation > profile.qRidge && nextStation < profile.qRidge)
				) {
					piece.push(crossingOn(triangle[index]!, triangle[(index + 1) % keys.length]!));
				}
			}
			// A half-plane clip can repeat a point when a vertex lies on the line.
			const deduped = piece.filter(
				(key, index) => key !== piece[(index + piece.length - 1) % piece.length],
			);
			if (deduped.length < 3) continue;
			if (!(loopArea(deduped, coordinates) > 0)) continue;
			side.push(deduped);
		}
	}

	const belowLoops = boundaryLoops(belowPieces, coordinates);
	const aboveLoops = boundaryLoops(abovePieces, coordinates);
	if (belowLoops === null && aboveLoops === null) {
		return { kind: 'failed', message: 'Region form split produced no faces' };
	}

	const loopSlope = (loop: readonly PointKey[]): number | null => {
		if (form.kind === 'shed') return form.rise / profile.runBelow;
		for (const key of loop) {
			const station = stationByKey.get(key)!;
			if (station < profile.qRidge) return form.rise / profile.runBelow;
			if (station > profile.qRidge) return -form.rise / profile.runAbove;
		}
		return null;
	};
	const topNormal = (slope: number): Vec3 => normalized([-slope * cos, 1, -slope * sin]);
	const undersideNormal = (slope: number): Vec3 => normalized([slope * cos, -1, slope * sin]);

	const faces: Face[] = [];
	const addSide = (loops: readonly (readonly PointKey[])[] | null, top: boolean): void => {
		if (loops === null) return;
		for (const loop of loops) {
			const slope = loopSlope(loop);
			if (slope === null) continue;
			if (top) {
				faces.push({
					surface: 'top',
					polygon: loop
						.map((key): Vec3 => {
							const point = coordinates.get(key)!;
							return [point[0], underside.get(key)! + thickness, point[1]];
						})
						.reverse(),
					normal: topNormal(slope),
				});
			} else {
				faces.push({
					surface: 'underside',
					polygon: loop.map((key): Vec3 => {
						const point = coordinates.get(key)!;
						return [point[0], underside.get(key)!, point[1]];
					}),
					normal: undersideNormal(slope),
				});
			}
		}
	};
	// Top first, then underside, matching the flat path's face order. Both are
	// emitted per planar piece, and every top vertex is exactly `thickness` above
	// its underside vertex.
	addSide(belowLoops, true);
	addSide(aboveLoops, true);
	addSide(belowLoops, false);
	addSide(aboveLoops, false);

	appendPerimeterFaces(
		cleaned,
		stationByKey,
		coordinates,
		underside,
		profile,
		thickness,
		faces,
		crossingOn,
	);

	let bottomY = Infinity;
	let topOfUnderside = -Infinity;
	for (const height of underside.values()) {
		if (height < bottomY) bottomY = height;
		if (height > topOfUnderside) topOfUnderside = height;
	}
	if (!Number.isFinite(bottomY) || !Number.isFinite(topOfUnderside)) {
		return { kind: 'failed', message: 'Region form produced no finite vertical extent' };
	}
	return {
		kind: 'compiled',
		faces,
		bottomY,
		topY: topOfUnderside + thickness,
	};
}
