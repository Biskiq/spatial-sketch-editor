import type { LayoutVec2 } from './layout-coordinates';
import type {
	CompilerBoundarySource,
	CompilerFloorSource,
	CompilerOpening,
	LayoutGeometryIssue
} from './layout-geometry-types';
import {
	CURVE_ENDPOINT_EPSILON,
	CURVE_SELF_INTERSECTION_TOLERANCE,
	LayoutGeometrySamplingError,
	sampleSegment,
	sampledPolylineIntersects,
	sampledPolylineSelfIntersects,
	segmentVertexPoints,
	type SampleableSegment,
	type SampledSegment
} from './layout-geometry-curve';
import { LAYOUT_GEOMETRY_EPSILON, buildArchProfile, openingIntervals } from './layout-geometry-openings';

export type { LayoutGeometryIssue };

/**
 * First/last chain vertex of any boundary segment, without narrowing on kind.
 * The canonical wall-first boundary can carry a `cubic-chain` segment, which has
 * no `start`/`end` fields of its own.
 */
function segmentEndpoints(segment: SampleableSegment): { start: LayoutVec2; end: LayoutVec2 } {
	const points = segmentVertexPoints(segment);
	return { start: points[0]!, end: points.at(-1)! };
}

/**
 * Sample each finite boundary segment exactly once into a prepared
 * intermediate. Non-finite segments are represented by `null` so validation
 * can report them without sampling.
 */
export type PreparedLayoutRoomGeometry = {
	segments: (SampledSegment | null)[];
	issues: LayoutGeometryIssue[];
};

export function prepareLayoutRoomSegments(
	room: { id: string; boundary: CompilerBoundarySource },
	path = `rooms.${room.id}`,
	preSampled?: ReadonlyMap<SampleableSegment, SampledSegment>
): PreparedLayoutRoomGeometry {
	const issues: LayoutGeometryIssue[] = [];
	const segments = room.boundary.segments.map((segment, index) => {
		if (!isFiniteSegment(segment)) return null;
		// P23B.4 M-1: a mapped segment is served from the chain derivation instead
		// of re-sampling. Unmapped segments keep the historical kernel path exactly.
		const pre = preSampled?.get(segment);
		if (pre) return pre;
		try {
			return sampleSegment(segment);
		} catch (error) {
			const samplingError = error instanceof LayoutGeometrySamplingError ? error : null;
			issues.push({
				path: `${path}.boundary.segments[${index}]`,
				code: samplingError?.code ?? 'sampling_failed',
				message: samplingError?.message ?? 'Segment sampling failed.',
				targetId: segment.id
			});
			return null;
		}
	});
	return { segments, issues };
}

/**
 * The compiler-source Room slice room validation reads (T1.P02.S05): identity,
 * the boundary chain and its segment-hosted Openings. It is the same record the
 * shared compile core holds, so validation and compilation can never disagree
 * about what a Room is.
 */
export type CompilerRoomValidationSource = {
	id: string;
	boundary: CompilerBoundarySource;
	openings: readonly CompilerOpening[];
};

export function validatePreparedLayoutRoomGeometry(
	room: CompilerRoomValidationSource,
	/**
	 * P23.6I — `height` is optional and no format-6 source supplies it: the
	 * canonical wall-first Floor has no vertical extent, and each Room's Opening
	 * fit comes from its hosting Wall instead. Only a direct caller of the shared
	 * core can pass a storey height here, and then the fit (including the
	 * positivity issue) is exactly the historical one.
	 */
	floor: CompilerFloorSource,
	prepared: readonly (SampledSegment | null)[],
	path = `rooms.${room.id}`,
	/**
	 * P23.6H — optional per-boundary-segment vertical limit for Opening fit,
	 * keyed by segment id (the wall-first compiler supplies each Wall's
	 * authoritative height). Absent falls back to the optional `floor.height`;
	 * exactly one fit rule remains (this branch), never a second validator.
	 */
	openingHeightLimitBySegmentId?: Readonly<Record<string, number>>
): LayoutGeometryIssue[] {
	const issues: LayoutGeometryIssue[] = [];
	const segments = room.boundary.segments;
	if (floor.height !== undefined && (floor.height <= 0 || !Number.isFinite(floor.height))) {
		issues.push({ path: 'floor.height', code: 'invalid_floor_height', message: 'Floor height must be finite and greater than zero', targetId: floor.id });
	}
	if (segments.length < 3) {
		issues.push({ path: `${path}.boundary.segments`, code: 'too_few_segments', message: 'A room boundary needs at least three segments', targetId: room.id });
	}

	const sampled = new Map<string, SampledSegment>();
	for (const [index, segment] of segments.entries()) {
		if (!isFiniteSegment(segment)) {
			issues.push({ path: `${path}.boundary.segments[${index}]`, code: 'non_finite_endpoint', message: 'Segment points and interior anchors must be finite', targetId: segment.id });
			continue;
		}
		const sampledSegment = prepared[index];
		if (sampledSegment) {
			sampled.set(segment.id, sampledSegment);
			if (sampledSegment.length <= CURVE_ENDPOINT_EPSILON) {
				issues.push({ path: `${path}.boundary.segments[${index}]`, code: 'zero_length_segment', message: 'Segment must have non-zero effective length', targetId: segment.id });
			}
		}
	}

	if (segments.length >= 3) {
		for (let index = 0; index < segments.length; index += 1) {
			const current = segments[index]!;
			const next = segments[(index + 1) % segments.length]!;
			if (!pointsEqual(segmentEndpoints(current).end, segmentEndpoints(next).start)) {
				issues.push({ path: `${path}.boundary.segments[${index}].end`, code: 'disconnected_boundary', message: `Segment does not connect to ${next.id}.`, targetId: current.id });
			}
		}
		for (let first = 0; first < segments.length; first += 1) {
			const firstSamples = sampled.get(segments[first]!.id)?.samples ?? [];
			if (sampledPolylineSelfIntersects(firstSamples, CURVE_SELF_INTERSECTION_TOLERANCE)) {
				issues.push({ path: `${path}.boundary.segments[${first}]`, code: 'self_intersection', message: `Segment ${segments[first]!.id} intersects itself.`, targetId: room.id });
			}
			for (let second = first + 1; second < segments.length; second += 1) {
				const secondSamples = sampled.get(segments[second]!.id)?.samples ?? [];
				const sharedEndpoint = areAdjacent(first, second, segments.length)
					? first === 0 && second === segments.length - 1
						? segmentEndpoints(segments[first]!).start
						: segmentEndpoints(segments[first]!).end
					: undefined;
				if (sampledPolylineIntersects(firstSamples, secondSamples, CURVE_SELF_INTERSECTION_TOLERANCE, sharedEndpoint)) {
					issues.push({ path: `${path}.boundary.segments`, code: 'self_intersection', message: `Segments ${segments[first]!.id} and ${segments[second]!.id} intersect.`, targetId: room.id });
				}
			}
		}
	}

	const openingsBySegment = new Map<string, CompilerOpening[]>();
	for (const [index, opening] of room.openings.entries()) {
		const segment = segments.find((candidate) => candidate.id === opening.segmentId);
		if (!segment) {
			issues.push({ path: `${path}.openings[${index}].segmentId`, code: 'opening_segment_invalid', message: 'Opening must reference a room boundary segment.', targetId: opening.id });
			continue;
		}
		if (!Number.isFinite(opening.offset) || opening.offset < 0) issues.push({ path: `${path}.openings[${index}].offset`, code: 'opening_offset_invalid', message: 'Opening offset must be finite and non-negative.', targetId: opening.id });
		if (!Number.isFinite(opening.width) || opening.width <= 0) issues.push({ path: `${path}.openings[${index}].width`, code: 'opening_width_invalid', message: 'Opening width must be finite and greater than zero.', targetId: opening.id });
		if (!Number.isFinite(opening.height) || opening.height <= 0) issues.push({ path: `${path}.openings[${index}].height`, code: 'opening_height_invalid', message: 'Opening height must be finite and greater than zero.', targetId: opening.id });
		if (!Number.isFinite(opening.sillHeight) || opening.sillHeight < 0) issues.push({ path: `${path}.openings[${index}].sillHeight`, code: 'opening_sill_invalid', message: 'Opening sill height must be finite and non-negative.', targetId: opening.id });
		// P23.6I — provenance comes from **source presence**, never numeric equality.
		// Comparing `heightLimit === floor.height` mislabelled an Opening whose
		// hosting Wall happens to be exactly as tall as a supplied storey height:
		// the Opening is still constrained by its Wall and must name it.
		const wallHeightLimit = openingHeightLimitBySegmentId?.[opening.segmentId];
		const heightLimit = wallHeightLimit ?? floor.height;
		const usesWallHeight = wallHeightLimit !== undefined;
		if (
			heightLimit !== undefined &&
			Number.isFinite(opening.sillHeight) &&
			Number.isFinite(opening.height) &&
			opening.sillHeight + opening.height > heightLimit + LAYOUT_GEOMETRY_EPSILON
		) issues.push({ path: `${path}.openings[${index}]`, code: 'opening_over_height', message: usesWallHeight ? `Opening top exceeds Wall '${opening.segmentId}' height ${heightLimit} m.` : 'Opening top exceeds floor height.', targetId: opening.id });
		if (Number.isFinite(opening.width) && Number.isFinite(opening.height)) {
			const profileResult = buildArchProfile(opening.profile, opening.width, opening.height);
			for (const profileIssue of profileResult.issues) issues.push({ path: `${path}.openings[${index}].profile`, code: profileIssue.code, message: profileIssue.message, targetId: opening.id });
		}
		const sampledSegment = sampled.get(segment.id);
		if (sampledSegment && opening.offset + opening.width > sampledSegment.length + LAYOUT_GEOMETRY_EPSILON) {
			issues.push({ path: `${path}.openings[${index}]`, code: 'opening_out_of_bounds', message: 'Opening interval exceeds its wall segment.', targetId: opening.id });
		}
		const existing = openingsBySegment.get(segment.id) ?? [];
		existing.push(opening);
		openingsBySegment.set(segment.id, existing);
	}

	for (const [segmentId, openings] of openingsBySegment) {
		const segment = segments.find((candidate) => candidate.id === segmentId);
		if (!segment) continue;
		const intervals = openingIntervals(segment, openings);
		for (let index = 1; index < intervals.length; index += 1) {
			const previous = intervals[index - 1]!;
			const current = intervals[index]!;
			if (current.startDistance < previous.endDistance - LAYOUT_GEOMETRY_EPSILON) issues.push({ path: `${path}.openings`, code: 'opening_overlap', message: `Openings ${previous.openingId} and ${current.openingId} overlap.`, targetId: segmentId });
		}
	}
	return issues;
}

export function hasBlockingLayoutIssues(issues: readonly LayoutGeometryIssue[]): boolean {
	return issues.some((issue) => issue.severity !== 'warning');
}

export function isFiniteSegment(segment: SampleableSegment): boolean {
	const points = segmentVertexPoints(segment);
	return points.every((point) => point.every((value) => Number.isFinite(value)));
}

function pointsEqual(a: LayoutVec2, b: LayoutVec2): boolean {
	return Math.abs(a[0] - b[0]) <= LAYOUT_GEOMETRY_EPSILON && Math.abs(a[1] - b[1]) <= LAYOUT_GEOMETRY_EPSILON;
}

function areAdjacent(first: number, second: number, count: number): boolean {
	return second === first + 1 || (first === 0 && second === count - 1);
}
