/**
 * P23B.4 correction (F1/OR-8) — wild curve-family fixtures with nonempty
 * Rooms + Openings.
 *
 * The pre-existing OR-8 wild document used partition Walls only (no Rooms, no
 * Openings), so its Room-polygon and Opening-position coverage was empty. These
 * two fixtures carry the relevant curve families (single-knot cubic, multi-knot
 * cubic, deep-bow cubic, straight, reversed shared Wall) through REAL Rooms with
 * REAL Openings on curved Walls, admitted by the shipped validator with clean
 * compile and successful planner runs.
 */
import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWallCenterline
} from '@portfolio/layout-core';

function curve(start: LayoutVec2, end: LayoutVec2, knot: LayoutVec2, knotId: string): LayoutWallCenterline {
	return wallCubicChain([{ id: knotId, point: knot }], deriveChainSpans([start, knot, end]));
}

export function buildWildRoomFixture(): LayoutDocumentWallFirst {
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: [
			{ id: 'j-0', point: [0, 0] as LayoutVec2 },
			{ id: 'j-1', point: [12, 0] as LayoutVec2 },
			{ id: 'j-2', point: [12, 10] as LayoutVec2 },
			{ id: 'j-3', point: [0, 10] as LayoutVec2 }
		],
		walls: [
			{ id: 'w-south', startJunctionId: 'j-0', endJunctionId: 'j-1', role: 'boundary', thickness: 0.2, height: 3, centerline: curve([0, 0], [12, 0], [6, -0.35], 'w-south:knot:1') },
			{ id: 'w-east', startJunctionId: 'j-1', endJunctionId: 'j-2', role: 'boundary', thickness: 0.2, height: 3, centerline: curve([12, 0], [12, 10], [12.35, 5], 'w-east:knot:1') },
			{ id: 'w-north', startJunctionId: 'j-2', endJunctionId: 'j-3', role: 'boundary', thickness: 0.2, height: 3, centerline: curve([12, 10], [0, 10], [6, 11.5], 'w-north:knot:1') },
			{ id: 'w-west', startJunctionId: 'j-3', endJunctionId: 'j-0', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
		],
		rooms: [
			{
				id: 'room-wild',
				name: 'Wild',
				floorThickness: 0.1,
				ceilingThickness: 0.1,
				boundary: [
					{ wallId: 'w-south', direction: 'forward' },
					{ wallId: 'w-east', direction: 'forward' },
					{ wallId: 'w-north', direction: 'forward' },
					{ wallId: 'w-west', direction: 'forward' }
				]
			}
		],
		openings: [
			{ id: 'op-south', wallId: 'w-south', kind: 'door', offset: 2, width: 1.2, height: 2.1, sillHeight: 0, profile: 'rectangular' },
			{ id: 'op-east', wallId: 'w-east', kind: 'door', offset: 3, width: 1.0, height: 2.1, sillHeight: 0, profile: 'rectangular' }
		]
	} as unknown as LayoutDocumentWallFirst;
}

export function buildWildSharedFixture(): LayoutDocumentWallFirst {
	const base = buildWildRoomFixture();
	return {
		...base,
		junctions: [
			...base.junctions,
			{ id: 'j-4', point: [24, 0] as LayoutVec2 },
			{ id: 'j-5', point: [24, 10] as LayoutVec2 }
		],
		walls: [
			...base.walls,
			{ id: 'w-south-2', startJunctionId: 'j-1', endJunctionId: 'j-4', role: 'boundary', thickness: 0.2, height: 3, centerline: curve([12, 0], [24, 0], [18, -0.3], 'w-south-2:knot:1') },
			{ id: 'w-east-2', startJunctionId: 'j-4', endJunctionId: 'j-5', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w-north-2', startJunctionId: 'j-5', endJunctionId: 'j-2', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
		],
		rooms: [
			base.rooms[0]!,
			{
				id: 'room-east',
				name: 'East',
				floorThickness: 0.1,
				ceilingThickness: 0.1,
				boundary: [
					{ wallId: 'w-south-2', direction: 'forward' },
					{ wallId: 'w-east-2', direction: 'forward' },
					{ wallId: 'w-north-2', direction: 'forward' },
					{ wallId: 'w-east', direction: 'reverse' }
				]
			}
		],
		openings: [
			...(base.openings as unknown[]),
			{ id: 'op-shared', wallId: 'w-east', kind: 'door', offset: 1, width: 0.9, height: 2.1, sillHeight: 0, profile: 'rectangular' }
		]
	} as unknown as LayoutDocumentWallFirst;
}
