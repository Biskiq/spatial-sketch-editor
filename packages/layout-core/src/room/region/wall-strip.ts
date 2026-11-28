/**
 * `wall-strip.ts` — the canonical top of one compiled Wall body, in plan, for
 * the vertical relation and the two V3b fits (§7.3).
 *
 * The strip is the compiled Wall's own swept body plus the Junction material
 * that the Wall owns, with its top in world Y:
 *
 * ```text
 * cell    a ruled quad between two consecutive stations of the compiled strip
 *         front F(u) = lerp(fa, fb, u), back B(u) = lerp(ba, bb, u), u in [0, 1]
 *         top(u)     = lerp(topA, topB, u)   (exact: cells split at Wall-top knots)
 * patch   a convex Junction-owned plan polygon at one constant top
 *         (a bevel or both-open wedge the Wall's seam owns, or a sector keel)
 * ```
 *
 * Stations are the compiled sample distances and Wall-top profile knots over
 * the resolved span `[clipStart, length - clipEnd]`. A station off a sample is
 * interpolated exactly as the Wall mesh's clip samples are (point and tangent
 * linearly, tangent renormalized). An untrimmed end takes the resolved corner
 * instead of its offset points, so a mitre apex carries the end's own top: the
 * §6.1 endpoint clamp. The mesh may add render-only tessellation knots (Opening
 * lintels, band crossings, interface edges); those subdivide a cell without
 * changing its station mapping, and on a curved cell they move the face by at
 * most `half * (1 - cos(dθ / 2))` for the turn `dθ` across that cell.
 *
 * This module only builds the pieces. `wall-extrema.ts` certifies the extrema
 * of a Region's underside against them.
 */
import type { LayoutVec2 } from '../../geometry/coordinates';
import { LAYOUT_GEOMETRY_EPSILON } from '../../geometry/openings';
import type {
	CompiledCornerSide,
	CompiledEndCorner,
	CompiledLegJoin,
	CompiledPhysicalWall,
} from '../../geometry/types';
import { wallEndReachPoint } from '../../wall/end-reach';
import { compiledWallEndTop, compiledWallTopAt, compiledWallTopKnots } from '../../wall/wall-top';

/** The resolved Junction ends of one Wall, as `legJoinsByWall` returns them. */
export type WallStripEnds = {
	readonly start: CompiledLegJoin | null;
	readonly end: CompiledLegJoin | null;
};

/** One ruled cell of the Wall body; top Y is world Y and linear in `u`. */
export type WallStripCell = {
	readonly kind: 'cell';
	readonly fa: LayoutVec2;
	readonly fb: LayoutVec2;
	readonly ba: LayoutVec2;
	readonly bb: LayoutVec2;
	readonly topA: number;
	readonly topB: number;
	readonly stationA: number;
	readonly stationB: number;
};

/** One convex Junction-owned plan polygon at a constant world-Y top. */
export type WallStripPatch = {
	readonly kind: 'patch';
	readonly polygon: readonly LayoutVec2[];
	readonly topY: number;
	readonly source: 'junction-wedge' | 'junction-keel';
	/** The Wall end whose Junction owns the patch. */
	readonly end: 'start' | 'end';
};

export type WallStripPiece = WallStripCell | WallStripPatch;

export type WallStripWall = Pick<
	CompiledPhysicalWall,
	'wallId' | 'thickness' | 'height' | 'topProfile' | 'samples' | 'openings' | 'sections'
>;

type StripSample = {
	readonly point: LayoutVec2;
	readonly normal: LayoutVec2;
	readonly distance: number;
	readonly corner: 'start' | 'end' | null;
};

/** Every piece of one Wall's canonical top, in Wall station order. */
export function compiledWallStrip(
	wall: WallStripWall,
	ends: WallStripEnds | undefined,
	floorElevation: number,
): WallStripPiece[] {
	const samples = wall.samples;
	if (samples.length < 2 || !(wall.thickness > 0)) return [];
	const length = samples.at(-1)!.distance;
	const half = wall.thickness / 2;
	const start = ends?.start ?? null;
	const end = ends?.end ?? null;
	const clipStart = start?.clipDistance ?? 0;
	const clipEnd = length - (end?.clipDistance ?? 0);
	const pieces: WallStripPiece[] = [];
	if (clipEnd - clipStart > LAYOUT_GEOMETRY_EPSILON) {
		const cornerStart = endCorner(start, samples[0]!.point, samples[0]!.normal, half);
		const cornerEnd = endCorner(end, samples.at(-1)!.point, samples.at(-1)!.normal, half);
		const stations = stripStations(wall, clipStart, clipEnd, length);
		const topAt = (distance: number) =>
			floorElevation +
			(wall.topProfile ? compiledWallTopAt(wall.topProfile, distance) : wall.height);
		const reach = (side: 'front' | 'back', sample: StripSample): LayoutVec2 | null =>
			sample.corner !== null
				? null
				: wallEndReachPoint(
						samples,
						sample.distance,
						clipStart <= LAYOUT_GEOMETRY_EPSILON
							? ownCornerPoint(cornerStart[side], 'current')
							: null,
						clipEnd >= length - LAYOUT_GEOMETRY_EPSILON
							? ownCornerPoint(cornerEnd[side], 'previous')
							: null,
					);
		let previous: { front: LayoutVec2; back: LayoutVec2; top: number; distance: number } | null =
			null;
		for (const sample of stations) {
			const current = {
				front: reach('front', sample) ?? offsetPoint(sample, half, cornerStart, cornerEnd),
				back: reach('back', sample) ?? offsetPoint(sample, -half, cornerStart, cornerEnd),
				top: topAt(sample.distance),
				distance: sample.distance,
			};
			if (previous !== null) {
				pieces.push({
					kind: 'cell',
					fa: previous.front,
					fb: current.front,
					ba: previous.back,
					bb: current.back,
					topA: previous.top,
					topB: current.top,
					stationA: previous.distance,
					stationB: current.distance,
				});
			}
			previous = current;
		}
	}
	for (const [join, atEnd] of [
		[start, false],
		[end, true],
	] as const) {
		if (join === null) continue;
		pieces.push(...wedgePatches(wall, join, atEnd, length, floorElevation));
		pieces.push(...keelPatches(join, atEnd, floorElevation));
	}
	return pieces;
}

/**
 * The clip stations of the resolved span, deduplicated with the mesh's own
 * epsilon so a profile knot on a sample is one station.
 */
function stripStations(
	wall: WallStripWall,
	clipStart: number,
	clipEnd: number,
	length: number,
): StripSample[] {
	const interior: number[] = [];
	const inside = (distance: number) =>
		distance > clipStart + LAYOUT_GEOMETRY_EPSILON && distance < clipEnd - LAYOUT_GEOMETRY_EPSILON;
	for (const sample of wall.samples) if (inside(sample.distance)) interior.push(sample.distance);
	for (const knot of compiledWallTopKnots(wall.topProfile)) if (inside(knot)) interior.push(knot);
	interior.sort((left, right) => left - right);
	const stations: StripSample[] = [stationSample(wall.samples, clipStart, length)];
	let previous = clipStart;
	for (const distance of interior) {
		if (distance - previous <= LAYOUT_GEOMETRY_EPSILON) continue;
		stations.push(stationSample(wall.samples, distance, length));
		previous = distance;
	}
	stations.push(stationSample(wall.samples, clipEnd, length));
	return stations;
}

/** The compiled cross-section at one station, interpolated like the mesh's clip samples. */
function stationSample(
	samples: WallStripWall['samples'],
	distance: number,
	length: number,
): StripSample {
	const corner =
		distance <= LAYOUT_GEOMETRY_EPSILON
			? 'start'
			: distance >= length - LAYOUT_GEOMETRY_EPSILON
				? 'end'
				: null;
	const target = Math.min(length, Math.max(0, distance));
	for (let index = 1; index < samples.length; index += 1) {
		const a = samples[index - 1]!;
		const b = samples[index]!;
		if (target <= b.distance + 1e-9) {
			const span = b.distance - a.distance;
			const amount = span > 1e-9 ? (target - a.distance) / span : 0;
			const tx = a.tangent[0] + (b.tangent[0] - a.tangent[0]) * amount;
			const tz = a.tangent[1] + (b.tangent[1] - a.tangent[1]) * amount;
			const magnitude = Math.hypot(tx, tz) || 1;
			return {
				point: [
					a.point[0] + (b.point[0] - a.point[0]) * amount,
					a.point[1] + (b.point[1] - a.point[1]) * amount,
				],
				normal: [-tz / magnitude, tx / magnitude],
				distance: target,
				corner,
			};
		}
	}
	const last = samples.at(-1)!;
	return { point: last.point, normal: last.normal, distance: last.distance, corner };
}

/** The resolved corner of one end, or the square corner of a free end. */
function endCorner(
	join: CompiledLegJoin | null,
	point: LayoutVec2,
	normal: LayoutVec2,
	half: number,
): CompiledEndCorner {
	if (join?.corner) return join.corner;
	const apex = (sign: number): LayoutVec2 => [
		point[0] + sign * half * normal[0],
		point[1] + sign * half * normal[1],
	];
	return { front: { kind: 'miter', apex: apex(1) }, back: { kind: 'miter', apex: apex(-1) } };
}

/**
 * The Wall's own point of a cross-section: the resolved corner at an untrimmed
 * end (the mitre apex, or the Wall's own bevel point), its offset elsewhere.
 */
function offsetPoint(
	sample: StripSample,
	half: number,
	cornerStart: CompiledEndCorner,
	cornerEnd: CompiledEndCorner,
): LayoutVec2 {
	const side = half >= 0 ? 'front' : 'back';
	if (sample.corner === 'start') return ownCornerPoint(cornerStart[side], 'current');
	if (sample.corner === 'end') return ownCornerPoint(cornerEnd[side], 'previous');
	return [sample.point[0] + half * sample.normal[0], sample.point[1] + half * sample.normal[1]];
}

function ownCornerPoint(side: CompiledCornerSide, wall: 'previous' | 'current'): LayoutVec2 {
	if (side.kind === 'miter') return side.apex;
	return wall === 'previous' ? side.a0 : side.b0;
}

/**
 * The wedge a seam-owning end fills between its own corner points and its
 * neighbour's: emitted for a bevel, or when both endpoints open onto an
 * Opening. The wedge is solid only where **both** endpoint profiles are solid
 * (the mesh caps a one-sided band vertically and leaves it open above), so its
 * top is the top of the highest both-solid band: `min` of the two end tops
 * when both Walls are solid there.
 */
function wedgePatches(
	wall: WallStripWall,
	join: CompiledLegJoin,
	atEnd: boolean,
	length: number,
	floorElevation: number,
): WallStripPatch[] {
	const neighbor = join.neighbor;
	const canonical = join.canonicalCorner;
	const role = join.canonicalRole;
	if (!neighbor || !canonical || !role || !join.ownedSeam) return [];
	const front = canonical.front;
	const back = canonical.back;
	const isBevel = front.kind === 'bevel' || back.kind === 'bevel';
	const ownOpens = atEnd
		? wall.openings.some(
				(opening) => opening.offset + opening.width >= length - LAYOUT_GEOMETRY_EPSILON,
			)
		: wall.openings.some((opening) => opening.offset <= LAYOUT_GEOMETRY_EPSILON);
	if (!isBevel && !(ownOpens && neighbor.endpointOpen)) return [];
	const sample = atEnd ? wall.samples.at(-1)! : wall.samples[0]!;
	const sign = atEnd ? -1 : 1;
	const ownTangent: LayoutVec2 = [sign * sample.tangent[0], sign * sample.tangent[1]];
	const ownNormal: LayoutVec2 = [sign * sample.normal[0], sign * sample.normal[1]];
	const prevIsOwn = role === 'prev';
	const half = wall.thickness / 2;
	const prev = prevIsOwn
		? { tangent: ownTangent, normal: ownNormal, half }
		: { tangent: neighbor.tangentOut, normal: neighbor.normalOut, half: neighbor.halfThickness };
	const cur = prevIsOwn
		? { tangent: neighbor.tangentOut, normal: neighbor.normalOut, half: neighbor.halfThickness }
		: { tangent: ownTangent, normal: ownNormal, half };
	const frontA = front.kind === 'bevel' ? front.a0 : front.apex;
	const frontB = front.kind === 'bevel' ? front.b0 : front.apex;
	const backA = back.kind === 'bevel' ? back.a0 : back.apex;
	const backB = back.kind === 'bevel' ? back.b0 : back.apex;
	const outer = back.kind === 'bevel' ? outerApex(sample.point, prev, cur) : null;
	const ownTop = compiledWallEndTop(wall.topProfile, wall.height, atEnd, length);
	const solidTop = bothSolidTop(
		ownEndpointIntervals(wall, atEnd ? length : 0, ownTop),
		mergedIntervals(
			neighbor.endpointSolidBands
				.filter((band) => band.solid)
				.map((band) => [band.bottomY, band.topY] as const),
		),
	);
	if (solidTop === null) return [];
	const topY = floorElevation + solidTop;
	const triangles: LayoutVec2[][] = [[frontA, frontB, backA]];
	if (outer) triangles.push([frontB, backB, backA], [backA, backB, outer]);
	return triangles
		.filter(([a, b, c]) => distinct(a!, b!) && distinct(b!, c!) && distinct(a!, c!))
		.map((polygon) => ({
			kind: 'patch',
			polygon,
			topY,
			source: 'junction-wedge',
			end: atEnd ? 'end' : 'start',
		}));
}

type Interval = readonly [number, number];

/**
 * This Wall's solid vertical intervals at one endpoint, from its compiled
 * sections. A sill ends at its own height; every other section reaches the
 * Wall's end top `ownTop` (a compiled section top is the span maximum, and a
 * fit candidate's new top may exceed it).
 */
function ownEndpointIntervals(wall: WallStripWall, distance: number, ownTop: number): Interval[] {
	const intervals: Interval[] = [];
	for (const section of wall.sections) {
		if (
			distance < section.startDistance - LAYOUT_GEOMETRY_EPSILON ||
			distance > section.endDistance + LAYOUT_GEOMETRY_EPSILON
		)
			continue;
		const sill = section.kind === 'side' && section.openingId !== undefined;
		intervals.push([section.bottomY, sill ? Math.min(section.topY, ownTop) : ownTop]);
	}
	return mergedIntervals(intervals);
}

function mergedIntervals(intervals: readonly Interval[]): Interval[] {
	const sorted = intervals
		.filter(([lo, hi]) => hi > lo + LAYOUT_GEOMETRY_EPSILON)
		.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const merged: Array<[number, number]> = [];
	for (const [lo, hi] of sorted) {
		const last = merged.at(-1);
		if (last && lo <= last[1] + LAYOUT_GEOMETRY_EPSILON) last[1] = Math.max(last[1], hi);
		else merged.push([lo, hi]);
	}
	return merged;
}

/** The top of the highest band both interval sets cover, or `null` if none overlap. */
function bothSolidTop(own: readonly Interval[], neighbor: readonly Interval[]): number | null {
	let top: number | null = null;
	for (const [aLo, aHi] of own) {
		for (const [bLo, bHi] of neighbor) {
			const hi = Math.min(aHi, bHi);
			if (hi - Math.max(aLo, bLo) > LAYOUT_GEOMETRY_EPSILON) top = Math.max(top ?? hi, hi);
		}
	}
	return top;
}

/** A degree >= 3 sector keel this end owns, at the top of its highest band. */
function keelPatches(
	join: CompiledLegJoin,
	atEnd: boolean,
	floorElevation: number,
): WallStripPatch[] {
	const keel = join.keel;
	if (!keel || keel.bands.length === 0) return [];
	let top = -Infinity;
	for (const band of keel.bands) {
		if (band.topY - band.bottomY > LAYOUT_GEOMETRY_EPSILON) top = Math.max(top, band.topY);
	}
	if (!Number.isFinite(top)) return [];
	return keel.regions
		.filter((region) => region.length >= 3)
		.map((polygon) => ({
			kind: 'patch',
			polygon,
			topY: floorElevation + top,
			source: 'junction-keel',
			end: atEnd ? 'end' : 'start',
		}));
}

/** The unconstrained back mitre apex of the exterior void, from both legs' facts. */
function outerApex(
	junction: LayoutVec2,
	prev: { tangent: LayoutVec2; normal: LayoutVec2; half: number },
	cur: { tangent: LayoutVec2; normal: LayoutVec2; half: number },
): LayoutVec2 {
	const a0: LayoutVec2 = [
		junction[0] - prev.half * prev.normal[0],
		junction[1] - prev.half * prev.normal[1],
	];
	const b0: LayoutVec2 = [
		junction[0] - cur.half * cur.normal[0],
		junction[1] - cur.half * cur.normal[1],
	];
	const dirA: LayoutVec2 = [-prev.tangent[0], -prev.tangent[1]];
	const dirB = cur.tangent;
	const det = dirA[0] * dirB[1] - dirA[1] * dirB[0];
	if (Math.abs(det) < 1e-9) return a0;
	const dx = b0[0] - a0[0];
	const dz = b0[1] - a0[1];
	const u = (dx * dirB[1] - dz * dirB[0]) / det;
	return [a0[0] + u * dirA[0], a0[1] + u * dirA[1]];
}

function distinct(a: LayoutVec2, b: LayoutVec2): boolean {
	return Math.hypot(a[0] - b[0], a[1] - b[1]) > LAYOUT_GEOMETRY_EPSILON;
}
