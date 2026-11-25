import type { LayoutDocumentWallFirst, LayoutJunction, LayoutWall, LayoutWallFirstRoom, OrientedWallRef } from './types';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { SpaceBoundaryEdge } from '../room/reconciliation-boundary';
import { composeSpaceBoundary } from '../room/reconciliation-boundary';
import { JUNCTION_COINCIDENCE_EPSILON } from './junction-identity';

/** The boundary match for one drawn Wall against one stated open side. */
type PartialVirtualEdgeMatch = {
	readonly direction: 'forward' | 'reverse';
	readonly startJunctionId: string;
	readonly endJunctionId: string;
	/** Where the remaining virtual edge sits relative to the new Wall edge. */
	readonly remainingSide: 'before' | 'after';
	readonly remaining: readonly [string, string];
};


/**
 * SP1d — turn a proper subsegment of an open side into boundary Walls.
 *
 * Only a Wall the operation authored, with one endpoint on an existing
 * virtual-edge Junction and the other strictly inside that edge, matches. A
 * Wall that merely crosses or ends on the edge stays free-standing (I9); a
 * full-edge Wall is left to the existing face/re-close path. The new Wall joins
 * the boundary on the covered side and the remaining virtual edge keeps its
 * direction, so the Space keeps its id, name, overhead and all other edges.
 */
export function absorbPartialVirtualEdgeWalls(
	document: LayoutDocumentWallFirst,
	authoredWallIds: ReadonlySet<string>
): string[] {
	const absorbed = new Set<string>();
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction] as const));
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall] as const));
	for (const room of document.rooms) {
		if (room.virtualEdges.length === 0) continue;
		const composed = composeSpaceBoundary(document, room);
		if (composed.kind === 'failed') continue;
		const edges: SpaceBoundaryEdge[] = [...composed.edges];
		const usedWalls = new Set<string>();
		let changed = false;
		for (let index = 0; index < edges.length; index += 1) {
			const edge = edges[index]!;
			if (edge.kind !== 'virtual') continue;
			for (const wallId of authoredWallIds) {
				if (usedWalls.has(wallId)) continue;
				const wall = wallById.get(wallId);
				if (wall === undefined || wall.centerline.kind !== 'line') continue;
				const match = matchPartialVirtualEdge(junctionById, wall, edge);
				if (match === null) continue;
				const wallEdge: SpaceBoundaryEdge = {
					kind: 'wall',
					wallId,
					direction: match.direction,
					startJunctionId: match.startJunctionId,
					endJunctionId: match.endJunctionId
				};
				const remaining: SpaceBoundaryEdge = {
					kind: 'virtual',
					startJunctionId: match.remaining[0],
					endJunctionId: match.remaining[1],
					index: 0
				};
				const replacement =
					match.remainingSide === 'before' ? [remaining, wallEdge] : [wallEdge, remaining];
				edges.splice(index, 1, ...replacement);
				usedWalls.add(wallId);
				changed = true;
				index += replacement.length - 1;
				break;
			}
		}
		if (!changed) continue;
		const parts = boundaryPartsFromEdges(edges);
		if (parts.boundary.length === 0) continue;
		room.boundary = parts.boundary;
		room.virtualEdges = parts.virtualEdges;
		absorbed.add(room.id);
	}
	return [...absorbed];
}


/** One authored Wall against one composed virtual edge, or `null`. */
function matchPartialVirtualEdge(
	junctionById: ReadonlyMap<string, LayoutJunction>,
	wall: LayoutWall,
	edge: Extract<SpaceBoundaryEdge, { kind: 'virtual' }>
): PartialVirtualEdgeMatch | null {
	const start = junctionById.get(edge.startJunctionId)?.point;
	const end = junctionById.get(edge.endJunctionId)?.point;
	if (start === undefined || end === undefined) return null;
	const touchesStart =
		wall.startJunctionId === edge.startJunctionId || wall.endJunctionId === edge.startJunctionId;
	const touchesEnd =
		wall.startJunctionId === edge.endJunctionId || wall.endJunctionId === edge.endJunctionId;
	// Both ends name the edge's ends: the existing full-edge face path owns it.
	// Neither end touches an edge end: this is a crossing/ending Wall, not an
	// absorption (I9 keeps the Space unchanged).
	if (touchesStart === touchesEnd) return null;
	const freeJunctionId = touchesStart
		? wall.startJunctionId === edge.startJunctionId
			? wall.endJunctionId
			: wall.startJunctionId
		: wall.startJunctionId === edge.endJunctionId
			? wall.endJunctionId
			: wall.startJunctionId;
	if (freeJunctionId === edge.startJunctionId || freeJunctionId === edge.endJunctionId) return null;
	const free = junctionById.get(freeJunctionId)?.point;
	if (free === undefined || !pointStrictlyOnEdge(free, start, end)) return null;
	const traversalStart = touchesStart ? edge.startJunctionId : freeJunctionId;
	const traversalEnd = touchesStart ? freeJunctionId : edge.endJunctionId;
	const direction =
		wall.startJunctionId === traversalStart && wall.endJunctionId === traversalEnd
			? 'forward'
			: 'reverse';
	return {
		direction,
		startJunctionId: traversalStart,
		endJunctionId: traversalEnd,
		remainingSide: touchesStart ? 'after' : 'before',
		remaining: touchesStart
			? [freeJunctionId, edge.endJunctionId]
			: [edge.startJunctionId, freeJunctionId]
	};
}


/** True only for a point strictly between the ends and on the straight edge. */
function pointStrictlyOnEdge(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): boolean {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const lengthSquared = dx * dx + dz * dz;
	if (!(lengthSquared > 0)) return false;
	const t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared;
	if (!(t > 0 && t < 1)) return false;
	const projectedX = start[0] + dx * t;
	const projectedZ = start[1] + dz * t;
	return Math.hypot(point[0] - projectedX, point[1] - projectedZ) <= JUNCTION_COINCIDENCE_EPSILON;
}


/** Rebuild the persisted boundary arrays from one mixed edge cycle. */
function boundaryPartsFromEdges(edges: readonly SpaceBoundaryEdge[]): Pick<
	LayoutWallFirstRoom,
	'boundary' | 'virtualEdges'
> {
	const firstWall = edges.findIndex((edge) => edge.kind === 'wall');
	const ordered = firstWall < 0 ? [] : [...edges.slice(firstWall), ...edges.slice(0, firstWall)];
	const boundary: OrientedWallRef[] = [];
	const virtualEdges: LayoutWallFirstRoom['virtualEdges'] = [];
	for (const edge of ordered) {
		if (edge.kind === 'wall') {
			boundary.push({ wallId: edge.wallId, direction: edge.direction });
		} else {
			virtualEdges.push({
				startJunctionId: edge.startJunctionId,
				endJunctionId: edge.endJunctionId
			});
		}
	}
	return { boundary, virtualEdges };
}
