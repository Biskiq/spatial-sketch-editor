/**
 * `form-partition.ts` — the one exact plan partition of a shed or gable Region,
 * shared by the face compiler and the Plan section.
 *
 * A footprint may be concave, so the part of it on one side of a level line is
 * not one ring: a U, a spiral or a line through a notch yields several pieces.
 * The partition is built exactly instead of guessing a ring:
 *
 * 1. The footprint is ear-clipped into triangles (collinear boundary points are
 *    dropped first; they are not corners).
 * 2. Each convex piece is clipped against a level of a scalar field that is
 *    affine on it — the ridge station for the compiler, the underside height for
 *    a Plan cut. A convex piece clips exactly, and every crossing is computed
 *    once per undirected piece edge from that edge's canonical endpoint order,
 *    so neighbouring pieces read identical crossing points.
 * 3. Pieces are merged back by cancelling shared directed edges. The remaining
 *    boundary loops are the maximal pieces of each side.
 *
 * Every classification reads one value map, and no piece or segment is dropped
 * by length or area, so every directed interior edge keeps its opposite.
 */
import type { LayoutVec2 } from '../../geometry/coordinates';
import { LAYOUT_GEOMETRY_EPSILON } from '../../geometry/openings';
import { orientXZ } from '../../geometry/robust-orientation';
import type { LayoutRegionForm } from '../../wall/types';
import { spaceOutlineSignedArea } from '../space-outline';
import { regionFormProfile, type RegionFormProfile } from './form';

export type PointKey = string;

/** Plan points and one scalar value per key; clipping adds its crossings here. */
export type LevelField = {
	readonly point: Map<PointKey, LayoutVec2>;
	readonly value: Map<PointKey, number>;
};

/**
 * The largest height error the ridge classification may introduce: the layout's
 * own geometric resolution. A snapped vertex, or the rounding of a station or a
 * crossing point, moves a height by `slope × plan error`; a form whose bound
 * exceeds this is refused rather than silently bent out of plane.
 */
export const REGION_FORM_HEIGHT_TOLERANCE_METERS = LAYOUT_GEOMETRY_EPSILON;

export type RegionFormPartition = {
	readonly kind: 'partitioned';
	readonly profile: RegionFormProfile;
	/** The cleaned footprint ring; vertex `i` has key `v:i`. */
	readonly ring: readonly LayoutVec2[];
	/** Plan points and the (snapped) ridge station of every key. */
	readonly field: LevelField;
	/** Convex pieces at or below the ridge (a whole shed). */
	readonly below: readonly (readonly PointKey[])[];
	/** Convex pieces at or above a gable ridge; empty for a shed. */
	readonly above: readonly (readonly PointKey[])[];
	/** Conservative bound on the height error of the classification, metres. */
	readonly heightErrorBound: number;
};

export type RegionFormPartitionResult =
	| RegionFormPartition
	| { readonly kind: 'failed'; readonly message: string };

export function vertexKey(index: number): PointKey {
	return `v:${index}`;
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
 * Drop boundary points that are not corners. A point on the straight run between
 * its neighbours adds no shape and makes a zero-area ear. The authored footprint
 * itself is untouched.
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
			// Only a between point is redundant; a spike is an invalid footprint
			// and the shared admission refuses it before here.
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
 * Ear clipping over a simple CCW ring with no collinear corners. The ear test is
 * inclusive, so every emitted edge is a real diagonal or boundary edge, which is
 * what makes shared-edge cancellation exact.
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

/**
 * The crossing of `level` on the piece edge `a–b`, cached by the edge's canonical
 * endpoint order so both pieces sharing the edge read one point.
 */
export function crossingAt(
	field: LevelField,
	a: PointKey,
	b: PointKey,
	level: number,
	tag: string,
): PointKey {
	const [first, second] = a < b ? [a, b] : [b, a];
	const key = `${tag}(${first}|${second})`;
	if (field.point.has(key)) return key;
	const from = field.point.get(first)!;
	const to = field.point.get(second)!;
	const fromValue = field.value.get(first)!;
	const toValue = field.value.get(second)!;
	const amount = (level - fromValue) / (toValue - fromValue);
	field.point.set(key, [
		from[0] + (to[0] - from[0]) * amount,
		from[1] + (to[1] - from[1]) * amount,
	]);
	field.value.set(key, level);
	return key;
}

function strictlyCrosses(left: number, right: number, level: number): boolean {
	return (left < level && right > level) || (left > level && right < level);
}

/** The keys along `a→b` with the crossing of `level` inserted when it is strictly inside. */
export function edgeKeysAtLevel(
	field: LevelField,
	a: PointKey,
	b: PointKey,
	level: number,
	tag: string,
): PointKey[] {
	return strictlyCrosses(field.value.get(a)!, field.value.get(b)!, level)
		? [a, crossingAt(field, a, b, level, tag), b]
		: [a, b];
}

/**
 * Split convex pieces at `level` of an affine field. A piece lying wholly on the
 * level belongs to the lower side only; a side that only touches the level at a
 * vertex or an edge gets no piece.
 */
export function splitAtLevel(
	field: LevelField,
	pieces: readonly (readonly PointKey[])[],
	level: number,
	tag: string,
): { below: PointKey[][]; above: PointKey[][] } {
	const below: PointKey[][] = [];
	const above: PointKey[][] = [];
	for (const piece of pieces) {
		const onLevel = piece.every((key) => field.value.get(key) === level);
		for (const [side, lower] of [
			[below, true],
			[above, false],
		] as const) {
			if (onLevel && !lower) continue;
			const out: PointKey[] = [];
			for (let index = 0; index < piece.length; index++) {
				const current = piece[index]!;
				const next = piece[(index + 1) % piece.length]!;
				const value = field.value.get(current)!;
				if (lower ? value <= level : value >= level) out.push(current);
				if (strictlyCrosses(value, field.value.get(next)!, level)) {
					out.push(crossingAt(field, current, next, level, tag));
				}
			}
			const deduped = out.filter(
				(key, index) => key !== out[(index + out.length - 1) % out.length],
			);
			if (new Set(deduped).size >= 3) side.push(deduped);
		}
	}
	return { below, above };
}

/**
 * A boundary walk may touch a pinch vertex twice. Splitting at the repeat keeps
 * every loop a simple ring.
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

/**
 * Merge piece boundaries into maximal boundary loops by cancelling opposite
 * directed edges. `[]` for no pieces; `null` only when a walk fails to close,
 * which is a broken partition the caller must refuse.
 */
export function boundaryLoops(pieces: readonly (readonly PointKey[])[]): PointKey[][] | null {
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
			// A level piece of a simple polygon has no holes, so every loop is an
			// outer boundary; none is dropped by area, or closure would break.
			for (const loop of splitAtRepeats(path)) if (loop.length >= 3) loops.push(loop);
		}
	}
	return loops;
}

/**
 * The station band treated as "on the ridge": a few hundred ulps of the
 * footprint's coordinate scale, wide enough to absorb the rounding of
 * `x cos + z sin` (for example `cos(pi / 2) = 6e-17`).
 */
function coordinateScale(points: readonly LayoutVec2[]): number {
	let scale = 1;
	for (const [x, z] of points) scale = Math.max(scale, Math.abs(x) + Math.abs(z));
	return scale;
}

/**
 * Partition a shed or gable footprint at its ridge, or refuse it.
 *
 * The height error bound is `slope × (largest snap + 8 ulps of scale)`: the snap
 * of a vertex onto the ridge plus the rounding of every station and crossing
 * point. A steep form far from the origin can exceed the layout's resolution;
 * that form is refused instead of compiled out of plane.
 */
export function partitionRegionForm(
	form: LayoutRegionForm,
	footprint: readonly LayoutVec2[],
): RegionFormPartitionResult {
	const profile = regionFormProfile(form, footprint);
	if (form.kind === 'flat' || profile === null) {
		return { kind: 'failed', message: 'Region form has no usable projected ridge' };
	}
	const ring = cleanRing(footprint);
	if (ring === null)
		return { kind: 'failed', message: 'Region footprint has no usable simple ring' };
	const triangles = earClip(ring);
	if (triangles === null) {
		return { kind: 'failed', message: 'Region footprint could not be triangulated' };
	}
	const cos = Math.cos(profile.azimuth);
	const sin = Math.sin(profile.azimuth);
	const scale = coordinateScale(ring);
	const snap = 256 * Number.EPSILON * scale;
	const field: LevelField = { point: new Map(), value: new Map() };
	let largestSnap = 0;
	for (const [index, point] of ring.entries()) {
		const raw = point[0] * cos + point[1] * sin;
		const offset = Math.abs(raw - profile.qRidge);
		const station = offset <= snap ? profile.qRidge : raw;
		if (station !== raw) largestSnap = Math.max(largestSnap, offset);
		field.point.set(vertexKey(index), point);
		field.value.set(vertexKey(index), station);
	}
	const slope =
		form.kind === 'shed'
			? form.rise / profile.runBelow
			: Math.max(form.rise / profile.runBelow, form.rise / profile.runAbove);
	const heightErrorBound = slope * (largestSnap + 8 * Number.EPSILON * scale);
	if (!(heightErrorBound <= REGION_FORM_HEIGHT_TOLERANCE_METERS)) {
		return {
			kind: 'failed',
			message: `the ${form.kind} is too steep for its position to compile exactly (height error up to ${heightErrorBound.toExponential(1)} m). Lower the rise, widen the slope or move the footprint nearer the origin`,
		};
	}
	const pieces = triangles.map((triangle) => triangle.map(vertexKey));
	// A shed's `qRidge` is its high eave, so it has no above side.
	if (form.kind === 'shed') {
		return {
			kind: 'partitioned',
			profile,
			ring,
			field,
			below: pieces,
			above: [],
			heightErrorBound,
		};
	}
	const { below, above } = splitAtLevel(field, pieces, profile.qRidge, 'r');
	return { kind: 'partitioned', profile, ring, field, below, above, heightErrorBound };
}
