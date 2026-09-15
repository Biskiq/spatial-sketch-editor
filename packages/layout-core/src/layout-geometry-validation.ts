import type { LayoutDocument, LayoutFloor, LayoutRoom, LayoutVec2 } from './layout-types';
import type { CompilerBoundarySource, LayoutGeometryIssue } from './layout-geometry-types';
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
	path = `rooms.${room.id}`
): PreparedLayoutRoomGeometry {
	const issues: LayoutGeometryIssue[] = [];
	const segments = room.boundary.segments.map((segment, index) => {
		if (!isFiniteSegment(segment)) return null;
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

export function validateLineRoom(room: LayoutRoom, floor: LayoutFloor, path = `rooms.${room.id}`): LayoutGeometryIssue[] {
	return validateLayoutRoomGeometry(room, floor, path);
}

/** Convenience validator for edit candidates: prepares then validates. */
export function validateLayoutRoomGeometry(room: LayoutRoom, floor: LayoutFloor, path = `rooms.${room.id}`): LayoutGeometryIssue[] {
	const prepared = prepareLayoutRoomSegments(room, path);
	return [
		...prepared.issues,
		...validatePreparedLayoutRoomGeometry(room, floor, prepared.segments, path)
	];
}

export function validatePreparedLayoutRoomGeometry(
	room: { id: string; boundary: CompilerBoundarySource } & {
		openings: readonly LayoutRoom['openings'][number][];
	},
	/**
	 * P23.6I — `height` is now optional: the canonical wall-first Floor has no
	 * vertical extent at all, while the legacy Room-owned Floor still drives the
	 * Opening fit for its own Rooms (unchanged, including the positivity issue).
	 */
	floor: Pick<LayoutFloor, 'id'> & { height?: number },
	prepared: readonly (SampledSegment | null)[],
	path = `rooms.${room.id}`,
	/**
	 * P23.6H — optional per-boundary-segment vertical limit for Opening fit,
	 * keyed by segment id (the wall-first compiler supplies each Wall's
	 * authoritative height). Absent keeps the historical `floor.height` rule and
	 * byte-identical legacy behavior/cache keys; exactly one fit rule remains
	 * (this branch), never a second validator.
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

	const openingsBySegment = new Map<string, LayoutRoom['openings']>();
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
		// Comparing `heightLimit === floor.height` mislabelled a wall-first Opening
		// whose hosting Wall happens to be exactly as tall as the legacy storey: the
		// Opening is still constrained by its Wall and must name it.
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

export function validateLayoutDocumentGeometry(document: LayoutDocument): LayoutGeometryIssue[] {
	const issues: LayoutGeometryIssue[] = [];
	for (const [floorIndex, floor] of document.floors.entries()) {
		for (const [roomIndex, room] of floor.rooms.entries()) issues.push(...validateLayoutRoomGeometry(room, floor, `floors[${floorIndex}].rooms[${roomIndex}]`));
	}
	return issues;
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
