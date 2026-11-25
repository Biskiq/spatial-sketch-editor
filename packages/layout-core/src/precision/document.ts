import { layoutLength } from '../layout-source-collections';
import { countWork } from '../p2311-perf';
import type { LayoutDocumentWallFirst, LayoutWall } from '../layout-wall-first-types';
import { cloneWallCenterline } from '../layout-wall-centerline';
import type { CurveSample } from '../layout-geometry-curve';
import type { PlanBox } from '../layout-plan-box-index';
import type { TopologySegment } from '../layout-wall-topology';
import type { LayoutVec2 } from '../layout-coordinates';
import type { WallFirstArchitectureProposalIntent } from './types';
import { distance } from '../vec2';

function cloneDocument(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	return {
		...document,
		floor: { ...document.floor },
		junctions: document.junctions.map((junction) => ({ ...junction, point: [junction.point[0], junction.point[1]] })),
		// Wall clones deep-copy the centerline so candidate planners
		// never share anchor arrays or points with the baseline.
		walls: document.walls.map((wall) => ({ ...wall, centerline: cloneWallCenterline(wall.centerline) })),
		rooms: document.rooms.map((room) => ({ ...room, boundary: room.boundary.map((ref) => ({ ...ref })) })),
		openings: document.openings.map((opening) => ({
			...opening,
			...(opening.connectsRoomIds ? { connectsRoomIds: [...opening.connectsRoomIds] as [string, string] } : {})
		})),
		objects: document.objects.map((object) => ({
			...object,
			position: [...object.position] as typeof object.position,
			rotation: [...object.rotation] as typeof object.rotation,
			dimensions: [...object.dimensions] as typeof object.dimensions,
			...(object.profile
				? {
						profile: {
							...object.profile,
							segments: object.profile.segments.map((segment) => ({
								...segment,
								start: [...segment.start] as LayoutVec2,
								end: [...segment.end] as LayoutVec2,
								...(segment.kind === 'auto-bezier'
									? { interiorAnchors: segment.interiorAnchors.map((anchor) => ({ ...anchor, point: [...anchor.point] as LayoutVec2 })) }
									: {})
							}))
						}
					}
				: {})
		}))
	};
}


export function currentJunctionPoint(document: LayoutDocumentWallFirst, junctionId: string): LayoutVec2 {
	return document.junctions.find((junction) => junction.id === junctionId)!.point;
}


function _moveJunction(document: LayoutDocumentWallFirst, junctionId: string, point: LayoutVec2): LayoutDocumentWallFirst {
	const candidate = cloneDocument(document);
	candidate.junctions.find((junction) => junction.id === junctionId)!.point = [point[0], point[1]];
	return candidate;
}


export function incidentWallIds(document: LayoutDocumentWallFirst, junctionId: string): string[] {
	return document.walls
		.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
		.map((wall) => wall.id);
}


export function sharedJunctionIds(a: LayoutWall, b: LayoutWall): string[] {
	return [a.startJunctionId, a.endJunctionId].filter((id) => id === b.startJunctionId || id === b.endJunctionId);
}


/**
 * One Wall's resolved endpoints. `points` is an optional id→point index for
 * callers that resolve many Walls (T1.P02.S06 D.1: the topology gates); without
 * it the historical linear Junction scan runs, so a one-off caller is unchanged.
 */
export function wallEndpoints(
	document: LayoutDocumentWallFirst,
	wall: LayoutWall,
	points?: ReadonlyMap<string, LayoutVec2>
): { start: LayoutVec2; end: LayoutVec2; length: number } | undefined {
	let start: LayoutVec2 | undefined;
	let end: LayoutVec2 | undefined;
	if (points) {
		// Two identity lookups; the index removes the linear scan entirely.
		countWork('lookup:junctions', 2);
		start = points.get(wall.startJunctionId);
		end = points.get(wall.endJunctionId);
	} else {
		// Two linear Junction lookups per Wall (an upper bound on the visits).
		countWork('lookup:junctions', 2 * layoutLength(document, 'junctions'));
		start = document.junctions.find((junction) => junction.id === wall.startJunctionId)?.point;
		end = document.junctions.find((junction) => junction.id === wall.endJunctionId)?.point;
	}
	if (!start || !end) return undefined;
	return { start, end, length: distance(start, end) };
}


/** Inclusive plan-space box of one resolved Wall segment. */
export function segmentPlanBox(segment: TopologySegment): PlanBox {
	return {
		minX: Math.min(segment.start[0], segment.end[0]),
		minZ: Math.min(segment.start[1], segment.end[1]),
		maxX: Math.max(segment.start[0], segment.end[0]),
		maxZ: Math.max(segment.start[1], segment.end[1])
	};
}


/** Inclusive plan-space box of a sampled polyline, expanded by `pad` on each side. */
export function sampledPlanBox(samples: readonly CurveSample[], pad: number): PlanBox {
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	for (const sample of samples) {
		const x = sample.point[0];
		const z = sample.point[1];
		if (x < minX) minX = x;
		if (z < minZ) minZ = z;
		if (x > maxX) maxX = x;
		if (z > maxZ) maxZ = z;
	}
	return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad };
}


/**
 * A straight Wall's centerline as a two-point polyline. Densifying a
 * line adds no information for crossing tests, so the chord endpoints are the
 * whole representation (and the shape `sampledWallsCross` already walks for
 * curved Walls).
 */
export function chordPolyline(segment: TopologySegment): CurveSample[] {
	return [
		{ point: segment.start, distance: 0, tangent: [1, 0], normal: [0, 1], t: 0 },
		{ point: segment.end, distance: distance(segment.start, segment.end), tangent: [1, 0], normal: [0, 1], t: 1 }
	];
}


/** An INJECTIVE encoding of one target's fields: `JSON.stringify` escapes the components apart. */
function targetIdentity(fields: readonly string[]): string {
	return JSON.stringify(fields);
}


/**
 * The identity a gesture's target keeps across moves; a change re-initializes the scope.
 *
 * THE FIELDS ARE A TUPLE, NEVER A DELIMITER JOIN. Layout IDs are free-form —
 * `/^[A-Za-z0-9][A-Za-z0-9._:-]*$/` admits `:` — so joining them with a delimiter is ambiguous:
 * `(wall "A:B", knot "C")` and `(wall "A", knot "B:C")` both encoded as
 * `curve-control-move:A:B:C`. Two different targets sharing one identity means a target CHANGE can
 * reuse the previous target's initialization, and then a candidate the canonical gate refuses is
 * reported `pending`. `JSON.stringify` of the field tuple keeps the components
 * separable whatever they contain and stays a plain string, so the comparison is unchanged. */
export function architectureIntentTargetIdentity(intent: WallFirstArchitectureProposalIntent): string {
	if (intent.kind === 'junction-move') return targetIdentity(['junction-move', intent.junctionId]);
	if (intent.kind === 'wall-move') return targetIdentity(['wall-move', intent.wallId]);
	if (intent.kind === 'wall-bend') return targetIdentity(['wall-bend', intent.wallId, String(intent.distance)]);
	return targetIdentity(['curve-control-move', intent.wallId, intent.knotId]);
}
