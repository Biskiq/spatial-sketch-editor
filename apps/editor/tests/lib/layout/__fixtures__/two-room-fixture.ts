/**
 * Two isolated, closed, opening-free Rooms, one beside the other.
 *
 * A Lift reading's own fixture: two enclosures are enough to tell "this Space"
 * from "everything", no door portal is mounted, and every Room floor is a plain
 * rectangle, so a point inside one is a point a person could stand at.
 */
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { captureFor } from './layout-id-capture';

const FIRST: readonly LayoutVec2[] = [
	[0, 0],
	[6, 0],
	[6, 4],
	[0, 4]
];
const SECOND: readonly LayoutVec2[] = [
	[8, 0],
	[14, 0],
	[14, 4],
	[8, 4]
];

export function twoRoomDocument(): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	const first = planWallChain({
		baseline: base,
		points: [...FIRST],
		close: true,
		// Deterministic captures: a compiled Room id embeds its capture's nonce, and a
		// fixture whose ids change per call cannot pin an id-based rule.
		capture: captureFor('two-room-first'),
		levelId: base.floor.id
	});
	if (first.kind !== 'success') throw new Error(`the first Room was refused: ${first.rejection.message}`);
	const second = planWallChain({
		baseline: first.document,
		points: [...SECOND],
		close: true,
		capture: captureFor('two-room-second'),
		levelId: base.floor.id
	});
	if (second.kind !== 'success') throw new Error(`the second Room was refused: ${second.rejection.message}`);
	return second.document;
}

export function twoRoomGeometry(): CompiledLayoutGeometry {
	const geometry = compileWallFirstLayoutGeometry(twoRoomDocument()).geometry;
	if (geometry.rooms.length !== 2) throw new Error(`expected two Rooms, compiled ${geometry.rooms.length}`);
	return geometry;
}

/** A point inside the first Room, and its floor level, for an occupied-eye test. */
export const FIRST_ROOM_STANDING_POINT = [3, 1.6, 2] as const;
/** A point outside both Rooms, at the same height. */
export const BETWEEN_ROOMS_POINT = [7, 1.6, 2] as const;
