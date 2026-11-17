/**
 * `layout-space-placement.ts` — the one placement gate between Spaces.
 *
 * I7 in words: two Spaces of which at least one is open share no interior
 * area, unless the open one lies wholly inside an enclosed one. Enclosed /
 * enclosed pairs keep today's permissive rule. Touching along an edge is not
 * sharing interior area.
 *
 * The compiler calls this as blocking issues and the certified world index
 * calls it as a certification predicate, so a Wall stroke, a Room move or a
 * duplicate can never commit an overlap through a path that skipped the gate.
 *
 * The pure polygon predicates live in `layout-space-outline.ts` so Room
 * reconciliation can run the same authority without importing this module
 * (which imports reconciliation for `roomBoundaryPolygon`).
 */
import type { LayoutVec2 } from './layout-coordinates';
import { createPlanBoxIndex, type PlanBox } from './layout-plan-box-index';
import { roomBoundaryPolygon } from './layout-room-reconciliation';
import { spacePairIssue } from './layout-space-outline';
import type { LayoutDocumentWallFirst, LayoutWallFirstRoom } from './layout-wall-first-types';

export {
	polygonContainsPolygon,
	spaceOutlineSelfIntersects,
	spaceOutlineSignedArea
} from './layout-space-outline';

export type SpacePlacementIssue = {
	code: 'space_overlap' | 'space_contains_space';
	message: string;
	roomIds: readonly [string, string];
};

/**
 * Every I7 violation between the document's Spaces.
 *
 * Only a pair with at least one open Space is examined, and a composed outline
 * that cannot resolve is skipped here: the codec and the compiler report that
 * boundary failure with its own code, never as a placement conflict.
 */
export function spacePlacementIssues(document: LayoutDocumentWallFirst): SpacePlacementIssue[] {
	const openRooms = document.rooms.filter((room) => room.virtualEdges.length > 0);
	if (openRooms.length === 0) return [];
	// Compose each resolvable outline once, then prune the room pairs by their
	// plan boxes. A pair whose boxes do not overlap cannot share interior area,
	// so the predicate still sees every pair it could accept. This uses the
	// existing plan-box index that already owns the other pair gates; it is not
	// a second membership authority and not a new spatial index.
	const indexedRooms: Array<{ room: LayoutWallFirstRoom; polygon: readonly LayoutVec2[]; box: PlanBox }> = [];
	for (const room of document.rooms) {
		const polygon = roomBoundaryPolygon(document, room.id);
		if (polygon) indexedRooms.push({ room, polygon, box: polygonPlanBox(polygon) });
	}
	const boxIndex = createPlanBoxIndex(indexedRooms.map((entry) => entry.box));
	const issues: SpacePlacementIssue[] = [];
	for (let first = 0; first < indexedRooms.length; first += 1) {
		const a = indexedRooms[first]!.room;
		const polygonA = indexedRooms[first]!.polygon;
		for (const second of boxIndex.overlaps(indexedRooms[first]!.box)) {
			if (second <= first) continue;
			const b = indexedRooms[second]!.room;
			const verdict = spacePairIssue(polygonA, indexedRooms[second]!.polygon, isOpenSpace(a), isOpenSpace(b));
			if (verdict === null) continue;
			issues.push({
				code: verdict,
				message:
					verdict === 'space_contains_space'
						? `Space '${a.name}' and Space '${b.name}' contain one another`
						: `Space '${a.name}' overlaps Space '${b.name}'`,
				roomIds: [a.id, b.id]
			});
		}
	}
	return issues;
}

function polygonPlanBox(polygon: readonly LayoutVec2[]): PlanBox {
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of polygon) {
		minX = Math.min(minX, x);
		minZ = Math.min(minZ, z);
		maxX = Math.max(maxX, x);
		maxZ = Math.max(maxZ, z);
	}
	return { minX, minZ, maxX, maxZ };
}

/** A Space is open when it states virtual edges; `open-to-sky` is an overhead reading, not topology. */
export function isOpenSpace(room: Pick<LayoutWallFirstRoom, 'virtualEdges'>): boolean {
	return room.virtualEdges.length > 0;
}
