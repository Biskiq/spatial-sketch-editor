import type { LayoutDocumentWallFirst, LayoutJunction, LayoutWall, LayoutWallFirstRoom, OrientedWallRef } from '../wall/types';
import { geometryId } from '../geometry/types';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { WallSamplingDerivation } from '../wall/centerline';
import { wallCenterlineSamples } from '../wall/centerline';
import { pointStrictlyInsidePolygon } from '../geometry/face-extraction';

/**
 * Predecessor Room boundary as an ordered X/Z polygon, resolved against a
 * complete document (shared with the wall role-change planner, which
 * runs the same correspondence as the chain engine). `null` when the
 * boundary is unresolvable — callers reject rather than guess. Curved Walls
 * contribute their oriented sampled centerline, matching candidate faces.
 */
export type RoomBoundaryLookup = {
	readonly roomById: ReadonlyMap<string, LayoutWallFirstRoom>;
	readonly junctionById: ReadonlyMap<string, LayoutJunction>;
	readonly wallById: ReadonlyMap<string, LayoutWall>;
};


export function createRoomBoundaryLookup(document: LayoutDocumentWallFirst): RoomBoundaryLookup {
	return {
		roomById: new Map(document.rooms.map((room) => [room.id, room])),
		junctionById: new Map(document.junctions.map((junction) => [junction.id, junction])),
		wallById: new Map(document.walls.map((wall) => [wall.id, wall]))
	};
}


/**
 * One edge of a Space's composed boundary, in cycle order.
 *
 * A `wall` edge is an authored Wall traversed in its stored direction; a
 * `virtual` edge is a stated straight segment between two Junctions. Together
 * they are the one mixed order; nothing else derives it.
 */
export type SpaceBoundaryEdge =
	| {
			kind: 'wall';
			wallId: string;
			direction: 'forward' | 'reverse';
			startJunctionId: string;
			endJunctionId: string;
	  }
	| {
			kind: 'virtual';
			startJunctionId: string;
			endJunctionId: string;
			/** Position in the persisted `virtualEdges` array. */
			index: number;
	  };


/** Stable machine codes for a Space whose boundary cannot compose. */
export type SpaceBoundaryIssueCode =
	| 'room_boundary_empty'
	| 'missing_reference'
	| 'space_boundary_open'
	| 'space_virtual_edge_unconsumed'
	| 'space_virtual_edge_degenerate'
	| 'duplicate_virtual_edge_origin';


export type SpaceBoundaryIssue = {
	code: SpaceBoundaryIssueCode;
	message: string;
	/** Index in `room.boundary` or `room.virtualEdges`, when one applies. */
	index?: number;
};


export type SpaceBoundaryResult =
	| { kind: 'ok'; edges: readonly SpaceBoundaryEdge[] }
	| { kind: 'failed'; issue: SpaceBoundaryIssue };


/**
 * The one composer of a Space's mixed Wall/virtual boundary.
 *
 * Wall order is persisted, a gap exists only where consecutive Wall ends
 * differ, and I3 forbids a virtual chain from revisiting a Junction, so the
 * parse is unique. The gap after the last Wall reference wraps to the first;
 * its virtual edges therefore come last in `virtualEdges`.
 *
 * `virtualEdges` is empty exactly when the Wall chain is closed. A virtual edge
 * where no gap exists is `space_virtual_edge_unconsumed`; a gap without enough
 * virtual edges, or a chain whose next edge does not start at the current
 * Junction, is `space_boundary_open`. Every failure rejects the whole Space;
 * there is no greedy partial parse.
 */
export function composeSpaceBoundary(
	document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'>,
	room: Pick<LayoutWallFirstRoom, 'id' | 'boundary' | 'virtualEdges'>,
	lookup?: Pick<RoomBoundaryLookup, 'junctionById' | 'wallById'>
): SpaceBoundaryResult {
	const junctionById = lookup?.junctionById ?? new Map(document.junctions.map((junction) => [junction.id, junction]));
	const wallById = lookup?.wallById ?? new Map(document.walls.map((wall) => [wall.id, wall]));
	if (room.boundary.length === 0) {
		return failure('room_boundary_empty', 'A canonical Room boundary must reference at least one Wall');
	}

	const walls: Array<{ ref: OrientedWallRef; wall: LayoutWall; startJunctionId: string; endJunctionId: string }> = [];
	for (const [index, ref] of room.boundary.entries()) {
		const wall = wallById.get(ref.wallId);
		if (!wall) {
			return failure('missing_reference', `Unknown wallId '${ref.wallId}'`, index);
		}
		const startJunctionId = ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
		const endJunctionId = ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
		if (!junctionById.has(startJunctionId) || !junctionById.has(endJunctionId)) {
			return failure('missing_reference', `Wall '${wall.id}' references an unknown Junction`, index);
		}
		walls.push({ ref, wall, startJunctionId, endJunctionId });
	}

	const virtualStarts = new Set<string>();
	for (const [index, edge] of room.virtualEdges.entries()) {
		if (!junctionById.has(edge.startJunctionId)) {
			return failure('missing_reference', `Unknown startJunctionId '${edge.startJunctionId}'`, index);
		}
		if (!junctionById.has(edge.endJunctionId)) {
			return failure('missing_reference', `Unknown endJunctionId '${edge.endJunctionId}'`, index);
		}
		if (edge.startJunctionId === edge.endJunctionId) {
			return failure('space_virtual_edge_degenerate', 'An open side may not start and end at the same Junction', index);
		}
		if (virtualStarts.has(edge.startJunctionId)) {
			return failure(
				'duplicate_virtual_edge_origin',
				`Junction '${edge.startJunctionId}' is the start of more than one open side`,
				index
			);
		}
		virtualStarts.add(edge.startJunctionId);
	}

	const edges: SpaceBoundaryEdge[] = [];
	let virtualIndex = 0;
	for (let wallIndex = 0; wallIndex < walls.length; wallIndex += 1) {
		const current = walls[wallIndex]!;
		const next = walls[(wallIndex + 1) % walls.length]!;
		edges.push({
			kind: 'wall',
			wallId: current.wall.id,
			direction: current.ref.direction,
			startJunctionId: current.startJunctionId,
			endJunctionId: current.endJunctionId
		});
		let cursor = current.endJunctionId;
		while (cursor !== next.startJunctionId) {
			const edge = room.virtualEdges[virtualIndex];
			if (!edge) {
				return failure(
					'space_boundary_open',
					`The boundary does not connect Wall '${current.wall.id}' to Wall '${next.wall.id}'`,
					wallIndex
				);
			}
			if (edge.startJunctionId !== cursor) {
				return failure(
					'space_boundary_open',
					`Open side ${virtualIndex} starts at '${edge.startJunctionId}', not at '${cursor}'`,
					wallIndex
				);
			}
			edges.push({
				kind: 'virtual',
				startJunctionId: edge.startJunctionId,
				endJunctionId: edge.endJunctionId,
				index: virtualIndex
			});
			cursor = edge.endJunctionId;
			virtualIndex += 1;
		}
	}
	if (virtualIndex !== room.virtualEdges.length) {
		return failure(
			'space_virtual_edge_unconsumed',
			`Open side ${virtualIndex} does not fall in a gap between boundary Walls`,
			virtualIndex
		);
	}
	return { kind: 'ok', edges };

	function failure(code: SpaceBoundaryIssueCode, message: string, index?: number): SpaceBoundaryResult {
		return { kind: 'failed', issue: { code, message, ...(index !== undefined ? { index } : {}) } };
	}
}


/**
 * Canonical cycle key for an open or enclosed Space.
 *
 * Wall tokens stay identical to `canonicalBoundaryCycleKey`; virtual edges add
 * `V~start~end` tokens. For an enclosed Space the key therefore equals today's
 * boundary-cycle key exactly, so a face key and a Room key can never diverge.
 * Returns `null` for a boundary that cannot compose.
 */
export function spaceBoundaryCycleKey(
	document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'>,
	room: Pick<LayoutWallFirstRoom, 'id' | 'boundary' | 'virtualEdges'>,
	lookup?: Pick<RoomBoundaryLookup, 'junctionById' | 'wallById'>
): string | null {
	const composed = composeSpaceBoundary(document, room, lookup);
	if (composed.kind === 'failed') return null;
	const tokens = composed.edges.map((edge) =>
		edge.kind === 'wall'
			? `${edge.wallId}~${edge.direction === 'forward' ? 'F' : 'R'}`
			: `V~${edge.startJunctionId}~${edge.endJunctionId}`
	);
	let smallest = tokens;
	for (let rotation = 1; rotation < tokens.length; rotation += 1) {
		const candidate = [...tokens.slice(rotation), ...tokens.slice(0, rotation)];
		if (candidate.join('|') < smallest.join('|')) smallest = candidate;
	}
	return geometryId(['face', ...smallest]);
}


/**
 * The composed outline as ordered X/Z points: Wall samples plus each virtual
 * edge's end Junction. This is the one polygon every area, bounds and witness
 * consumer reads; it never drops a gap end.
 */
export function spaceBoundaryPolygonFromEdges(
	edges: readonly SpaceBoundaryEdge[],
	document: Pick<LayoutDocumentWallFirst, 'junctions' | 'walls'>,
	lookup?: Pick<RoomBoundaryLookup, 'junctionById' | 'wallById'>,
	sampling?: WallSamplingDerivation
): readonly LayoutVec2[] | null {
	const junctionById = lookup?.junctionById ?? new Map(document.junctions.map((junction) => [junction.id, junction]));
	const wallById = lookup?.wallById ?? new Map(document.walls.map((wall) => [wall.id, wall]));
	const polygon: LayoutVec2[] = [];
	for (const edge of edges) {
		if (edge.kind === 'virtual') {
			// Every edge contributes its START. The next edge (Wall or virtual)
			// contributes the previous end, so the last implicit closing edge is
			// the first polygon point. Pushing a virtual edge's END instead drops
			// the Wall end that begins the gap and turns an opened rectangle into
			// a triangle (S2's F1, now fixed at the composer).
			const start = junctionById.get(edge.startJunctionId);
			if (!start) return null;
			polygon.push([...start.point] as LayoutVec2);
			continue;
		}
		const wall = wallById.get(edge.wallId);
		const start = junctionById.get(edge.startJunctionId);
		const end = junctionById.get(edge.endJunctionId);
		if (!wall || !start || !end) return null;
		polygon.push([...start.point] as LayoutVec2);
		if (wall.centerline.kind === 'line') continue;
		// `wallCenterlineSamples` takes the Wall's CANONICAL endpoints plus the
		// traversal direction. Passing the oriented ends here would mirror the
		// curve again on a reverse ref and bend the polygon away from the Wall.
		const canonicalStart = junctionById.get(wall.startJunctionId)?.point;
		const canonicalEnd = junctionById.get(wall.endJunctionId)?.point;
		if (!canonicalStart || !canonicalEnd) return null;
		const sampled = sampling === undefined
			? wallCenterlineSamples(wall, canonicalStart, canonicalEnd, edge.direction)
			: sampling.samples(wall, canonicalStart, canonicalEnd, edge.direction);
		if (!sampled) return null;
		for (const sample of sampled.samples.slice(1, -1)) {
			polygon.push([...sample.point] as LayoutVec2);
		}
	}
	// A closed Wall contributes ONE boundary reference but many sampled vertices.
	// The polygon requirement is therefore about resolved vertices, never the
	// number of Wall refs.
	return polygon.length >= 3 ? polygon : null;
}


/** Number of maximal runs of virtual edges around the cycle (0 when enclosed). */
export function spaceOpenSideCount(edges: readonly SpaceBoundaryEdge[]): number {
	const virtual = edges.map((edge) => edge.kind === 'virtual');
	if (!virtual.some(Boolean)) return 0;
	if (virtual.every(Boolean)) return 1;
	let runs = 0;
	for (let index = 0; index < virtual.length; index += 1) {
		if (virtual[index] && !virtual[(index - 1 + virtual.length) % virtual.length]) runs += 1;
	}
	return runs;
}


/**
 * The composed outline of one Space, or `null` when its boundary cannot
 * compose. This is a thin wrapper over {@link composeSpaceBoundary}, so every
 * caller that uses it as reconciliation evidence reads the true outline.
 */
export function roomBoundaryPolygon(
	document: LayoutDocumentWallFirst,
	roomId: string,
	lookup?: RoomBoundaryLookup,
	sampling?: WallSamplingDerivation
): readonly LayoutVec2[] | null {
	const room = lookup ? lookup.roomById.get(roomId) : document.rooms.find((candidate) => candidate.id === roomId);
	if (!room) return null;
	const composed = composeSpaceBoundary(document, room, lookup);
	if (composed.kind === 'failed') return null;
	return spaceBoundaryPolygonFromEdges(composed.edges, document, lookup, sampling);
}


/**
 * Deterministic interior witness for a predecessor room. The raw centroid can
 * land exactly ON a candidate divider (symmetric splits), where strict
 * containment is false for both faces and the correspondence degenerates.
 * Nudge by an infinitesimal diagonal from the centroid toward the polygon's
 * first vertex — order-independent enough for correspondence, and only used
 * as evidence (never persisted).
 */
export function interiorWitness(polygon: readonly LayoutVec2[]): LayoutVec2 {
	const centroid = polygonCentroid(polygon);
	for (const epsilon of [1e-9, 1e-7, 1e-5, 1e-3]) {
		for (const [dx, dz] of [
			[epsilon, epsilon],
			[-epsilon, epsilon],
			[epsilon, -epsilon],
			[-epsilon, -epsilon]
		] as const) {
			const candidate: LayoutVec2 = [centroid[0] + dx, centroid[1] + dz];
			if (pointStrictlyInsidePolygon(polygon, candidate)) return candidate;
		}
	}
	return centroid;
}


/** Signed-area polygon centroid (falls back to the vertex mean when degenerate). */
function polygonCentroid(points: readonly LayoutVec2[]): LayoutVec2 {
	let twiceArea = 0;
	let x = 0;
	let z = 0;
	for (let index = 0; index < points.length; index += 1) {
		const current = points[index]!;
		const next = points[(index + 1) % points.length]!;
		const cross = current[0] * next[1] - next[0] * current[1];
		twiceArea += cross;
		x += (current[0] + next[0]) * cross;
		z += (current[1] + next[1]) * cross;
	}
	if (Math.abs(twiceArea) <= 1e-12) {
		return [
			points.reduce((sum, point) => sum + point[0], 0) / points.length,
			points.reduce((sum, point) => sum + point[1], 0) / points.length
		];
	}
	return [x / (3 * twiceArea), z / (3 * twiceArea)];
}
