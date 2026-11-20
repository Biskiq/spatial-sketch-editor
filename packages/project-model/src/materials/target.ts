/**
 * Target qualification: what a real draw can actually sample.
 *
 * A Finish may be authored before a target exists, and one Finish may be shared
 * by a native Form, a Wall and an imported mesh. Qualification therefore works
 * on derived facts, never on authored records:
 *
 * - a UV set exists only when every referenced vertex has a finite pair;
 * - a normal frame exists only when at least one active triangle has nonzero
 *   area, nonzero UV edge lengths and a non-singular 2×2 UV Jacobian;
 * - an empty draw range contributes no requirement.
 *
 * The geometry summarizer below is the headless adapter for those facts. It
 * reads raw attribute arrays, so it works with the editor canvas closed and
 * creates no mesh, cache or renderer object.
 */
import type { TargetDraw, TargetFacts } from './types';

export type DrawGeometry = {
	/** Flat xyz triples. */
	readonly positions: ArrayLike<number>;
	/** Flat triangle indices; absent for a non-indexed draw. */
	readonly indices?: ArrayLike<number> | null;
	/** The active index range, as Three's `drawRange` states it. */
	readonly drawRange?: { readonly start: number; readonly count: number } | null;
	/** Material groups; when present they are the active ranges. */
	readonly groups?: readonly { readonly start: number; readonly count: number }[] | null;
	/** UV0 and UV1 as flat uv pairs; absent means the attribute is missing. */
	readonly uvs: readonly [ArrayLike<number> | null, ArrayLike<number> | null];
};

function readVertex(
	array: ArrayLike<number>,
	index: number,
	width: number
): readonly number[] | null {
	const base = index * width;
	const values: number[] = [];
	for (let offset = 0; offset < width; offset += 1) {
		const value = array[base + offset];
		if (value === undefined || !Number.isFinite(value)) return null;
		values.push(value);
	}
	return values;
}

type ActiveIndices = {
	readonly active: readonly number[];
	readonly invalid: boolean;
};

function isRange(value: { readonly start: number; readonly count: number }): boolean {
	return (
		Number.isInteger(value.start) &&
		Number.isInteger(value.count) &&
		value.start >= 0 &&
		value.count >= 0 &&
		value.count % 3 === 0
	);
}

/**
 * Read the active index ranges. An empty range is valid and contributes no
 * requirement; a malformed range, index or position array is invalid and must
 * not be reported as "no UV requirement".
 */
function activeIndices(geometry: DrawGeometry): ActiveIndices {
	if (geometry.positions.length % 3 !== 0) return { active: [], invalid: true };
	const vertexCount = Math.floor(geometry.positions.length / 3);
	const total = geometry.indices ? geometry.indices.length : vertexCount;
	const ranges =
		geometry.groups !== undefined && geometry.groups !== null && geometry.groups.length > 0
			? geometry.groups
			: [
					{
						start: geometry.drawRange?.start ?? 0,
						count: geometry.drawRange?.count ?? total - (geometry.drawRange?.start ?? 0)
					}
				];
	const active: number[] = [];
	for (const range of ranges) {
		if (!isRange(range) || range.start + range.count > total) return { active: [], invalid: true };
		for (let index = range.start; index < range.start + range.count; index += 1) {
			const vertex = geometry.indices ? geometry.indices[index] : index;
			if (vertex === undefined || !Number.isInteger(vertex) || vertex < 0 || vertex >= vertexCount) {
				return { active: [], invalid: true };
			}
			active.push(vertex);
		}
	}
	if (active.length === 0) return { active: [], invalid: false };
	if (active.length % 3 !== 0) return { active: [], invalid: true };
	return { active, invalid: false };
}

function uvSetAvailable(uv: ArrayLike<number> | null, referenced: readonly number[]): boolean {
	if (uv === null) return false;
	for (const vertex of referenced) {
		if (readVertex(uv, vertex, 2) === null) return false;
	}
	return true;
}

function frameAvailable(
	geometry: DrawGeometry,
	triangles: readonly (readonly [number, number, number])[],
	uv: ArrayLike<number> | null
): boolean {
	if (uv === null) return false;
	for (const [a, b, c] of triangles) {
		const pa = readVertex(geometry.positions, a, 3);
		const pb = readVertex(geometry.positions, b, 3);
		const pc = readVertex(geometry.positions, c, 3);
		const ua = readVertex(uv, a, 2);
		const ub = readVertex(uv, b, 2);
		const uc = readVertex(uv, c, 2);
		if (pa === null || pb === null || pc === null) continue;
		if (ua === null || ub === null || uc === null) continue;

		const ab = [pb[0]! - pa[0]!, pb[1]! - pa[1]!, pb[2]! - pa[2]!] as const;
		const ac = [pc[0]! - pa[0]!, pc[1]! - pa[1]!, pc[2]! - pa[2]!] as const;
		const cross = [
			ab[1] * ac[2] - ab[2] * ac[1],
			ab[2] * ac[0] - ab[0] * ac[2],
			ab[0] * ac[1] - ab[1] * ac[0]
		] as const;
		if (Math.hypot(cross[0], cross[1], cross[2]) <= 0) continue;

		const duv1 = [ub[0]! - ua[0]!, ub[1]! - ua[1]!] as const;
		const duv2 = [uc[0]! - ua[0]!, uc[1]! - ua[1]!] as const;
		const length1 = Math.hypot(duv1[0], duv1[1]);
		const length2 = Math.hypot(duv2[0], duv2[1]);
		if (!(length1 > 0) || !(length2 > 0)) continue;
		const determinant = Math.abs(duv1[0] * duv2[1] - duv1[1] * duv2[0]);
		if (determinant > 1e-6 * length1 * length2) return true;
	}
	return false;
}

/**
 * Derive one draw's UV and normal-frame availability. An empty active range is
 * vacuously available: it contributes no requirement to the intersection.
 */
export function summarizeDrawGeometry(drawKey: string, geometry: DrawGeometry): TargetDraw {
	const { active, invalid } = activeIndices(geometry);
	if (invalid) {
		return { drawKey, invalidGeometry: true, uvSets: [], normalFrameSets: [] };
	}
	if (active.length === 0) {
		return { drawKey, uvSets: [0, 1], normalFrameSets: [0, 1] };
	}
	const referenced = [...new Set(active)];
	const uvSets: (0 | 1)[] = [];
	for (const set of [0, 1] as const) {
		if (uvSetAvailable(geometry.uvs[set], referenced)) uvSets.push(set);
	}
	const triangles: (readonly [number, number, number])[] = [];
	for (let index = 0; index + 2 < active.length; index += 3) {
		triangles.push([active[index]!, active[index + 1]!, active[index + 2]!]);
	}
	const normalFrameSets: (0 | 1)[] = [];
	for (const set of [0, 1] as const) {
		const uv = geometry.uvs[set];
		if (!uvSetAvailable(uv, referenced)) continue;
		if (frameAvailable(geometry, triangles, uv)) normalFrameSets.push(set);
	}
	return { drawKey, uvSets, normalFrameSets };
}

export type AvailabilityIntersection = {
	readonly uvSets: readonly (0 | 1)[];
	readonly normalFrameSets: readonly (0 | 1)[];
};

/**
 * The intersection of availability across every affected target and draw.
 *
 * This is the acceptance reading: a signal is available only when every user
 * can sample it. A target with no draws, and a draw with an empty active range,
 * contribute no constraint.
 */
export function intersectTargetAvailability(
	targets: readonly TargetFacts[]
): AvailabilityIntersection {
	let uvSets: (0 | 1)[] = [0, 1];
	let normalFrameSets: (0 | 1)[] = [0, 1];
	for (const facts of targets) {
		for (const draw of facts.draws) {
			// A malformed draw is reported by binding; it must not make a signal
			// look available or unavailable in the acceptance intersection.
			if (draw.invalidGeometry) continue;
			uvSets = uvSets.filter((set) => draw.uvSets.includes(set));
			normalFrameSets = normalFrameSets.filter((set) => draw.normalFrameSets.includes(set));
		}
	}
	return { uvSets, normalFrameSets };
}

/** Whether a target has any active draw at all. */
export function targetHasDraws(facts: TargetFacts): boolean {
	return facts.draws.length > 0;
}
