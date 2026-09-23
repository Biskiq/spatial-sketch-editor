/**
 * P23B.3a S2 — the GENERAL Wall/Junction connectivity test (M-3a-1).
 *
 * The policy slice re-scopes the SUBJECT of the validity gates from "all Walls
 * in the document" to "Walls in the same connected component", so the component
 * test has to exist and be trusted before any gate consumes it. No gate is
 * re-scoped in this step: nothing in the shipped behaviour changes here.
 *
 * What these pins establish:
 *
 * - connectivity is JUNCTION IDENTITY, never coordinates — two Walls at exactly
 *   the same point with distinct ids are independent (D-9);
 * - the test covers Walls no Room boundary references, which the Room-only
 *   helper cannot see (§2.11.3 GAP 1);
 * - Room grouping derived from the general test agrees with `connectedRoomIds`
 *   wherever that helper is already correct, so the existing consumer needs no
 *   change;
 * - the output is deterministic for a given document and its membership does not
 *   depend on the authored Wall order.
 */
import { describe, expect, it } from 'vitest';

import {
	connectedRoomIds,
	createEmptyWallFirstLayoutDocument,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	roomIdsConnectedByTopology,
	topologyComponentKeyByRoomId,
	topologyComponentKeyByWallId,
	wallIdsConnectedTo,
	wallJunctionComponents,
	wallsShareTopologyComponent,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline
} from '@portfolio/layout-core';

const LINE: LayoutWallCenterline = { kind: 'line' };

function wall(id: string, start: string, end: string, role: 'boundary' | 'partition' = 'partition') {
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		role,
		thickness: 0.2,
		height: 3,
		centerline: LINE
	} as LayoutWall;
}

function documentOf(
	junctions: Array<[string, number, number]>,
	walls: LayoutWall[]
): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	base.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	base.junctions = junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 }));
	base.walls = walls;
	return base;
}

/** Two enclosures DELIBERATELY sharing the interior Wall at x = 3 (j-m → j-n). */
function sharedWallDocument(): LayoutDocumentWallFirst {
	const base = documentOf(
		[
			['j-a', 0, 0],
			['j-m', 3, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-n', 3, 4],
			['j-d', 0, 4]
		],
		[
			wall('wall-a1', 'j-a', 'j-m', 'boundary'),
			wall('wall-a2', 'j-m', 'j-b', 'boundary'),
			wall('wall-b', 'j-b', 'j-c', 'boundary'),
			wall('wall-c1', 'j-c', 'j-n', 'boundary'),
			wall('wall-c2', 'j-n', 'j-d', 'boundary'),
			wall('wall-d', 'j-d', 'j-a', 'boundary'),
			wall('wall-e', 'j-m', 'j-n', 'boundary')
		]
	);
	base.rooms = [
		{
			id: 'room-left',
			name: 'Left',
			boundary: [
				{ wallId: 'wall-a1', direction: 'forward' },
				{ wallId: 'wall-e', direction: 'forward' },
				{ wallId: 'wall-c2', direction: 'backward' },
				{ wallId: 'wall-d', direction: 'backward' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		},
		{
			id: 'room-right',
			name: 'Right',
			boundary: [
				{ wallId: 'wall-a2', direction: 'forward' },
				{ wallId: 'wall-b', direction: 'forward' },
				{ wallId: 'wall-c1', direction: 'forward' },
				{ wallId: 'wall-e', direction: 'backward' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	return base;
}

describe('P23B.3a S2 — general Wall/Junction connectivity', () => {
	it('joins Walls that share an authored Junction id, and only those', () => {
		const document = sharedWallDocument();
		expect(wallsShareTopologyComponent(document, 'wall-a1', 'wall-e')).toBe(true);
		expect(wallsShareTopologyComponent(document, 'wall-a1', 'wall-c2')).toBe(true);
		// Everything in the fixture is one group (the two enclosures share wall-e).
		expect(wallIdsConnectedTo(document, 'wall-e').sort()).toEqual(
			[
				'wall-a1',
				'wall-a2',
				'wall-b',
				'wall-c1',
				'wall-c2',
				'wall-d',
				'wall-e'
			].sort()
		);
	});

	it('is coordinate-BLIND: identical endpoints with distinct ids stay independent (D-9)', () => {
		const document = documentOf(
			[
				['j-1-a', 0, 0],
				['j-1-b', 4, 0],
				['j-2-a', 4, 0],
				['j-2-b', 4, 4]
			],
			[wall('wall-1', 'j-1-a', 'j-1-b'), wall('wall-2', 'j-2-a', 'j-2-b')]
		);
		// The endpoints coincide exactly in X/Z...
		expect(document.junctions[1]!.point).toEqual(document.junctions[2]!.point);
		// ... and the two Walls are still separate components.
		expect(wallsShareTopologyComponent(document, 'wall-1', 'wall-2')).toBe(false);
		expect(wallJunctionComponents(document)).toHaveLength(2);
		// The same geometry with ONE shared id is one component.
		const joined = documentOf(
			[
				['j-1-a', 0, 0],
				['j-both', 4, 0],
				['j-2-b', 4, 4]
			],
			[wall('wall-1', 'j-1-a', 'j-both'), wall('wall-2', 'j-both', 'j-2-b')]
		);
		expect(wallsShareTopologyComponent(joined, 'wall-1', 'wall-2')).toBe(true);
		expect(wallJunctionComponents(joined)).toHaveLength(1);
	});

	it('covers Walls that no Room boundary references (GAP 1)', () => {
		const base = sharedWallDocument();
		// A standalone partition stub reaching one of the group's own Junctions.
		const withStub: LayoutDocumentWallFirst = {
			...base,
			junctions: [...base.junctions, { id: 'j-stub', point: [3, 6] as LayoutVec2 }],
			walls: [...base.walls, wall('wall-stub', 'j-n', 'j-stub')]
		};
		expect(wallsShareTopologyComponent(withStub, 'wall-stub', 'wall-e')).toBe(true);
		// The general test sees it as part of the group...
		expect(wallIdsConnectedTo(withStub, 'wall-stub')).toContain('wall-e');
		// ... while the ROOM-only helper cannot (it never visits the stub).
		expect([...connectedRoomIds(withStub, 'room-left')].sort()).toEqual([
			'room-left',
			'room-right'
		]);
		// Derived Room grouping stays equal to the Room-only answer here.
		expect([...roomIdsConnectedByTopology(withStub, 'room-left')].sort()).toEqual([
			'room-left',
			'room-right'
		]);
	});

	it('derives Room grouping that agrees with connectedRoomIds wherever that helper is correct', () => {
		const shared = sharedWallDocument();
		expect(roomIdsConnectedByTopology(shared, 'room-left')).toEqual(
			connectedRoomIds(shared, 'room-left')
		);
		expect(roomIdsConnectedByTopology(shared, 'room-right')).toEqual(
			connectedRoomIds(shared, 'room-right')
		);
		const rooms = topologyComponentKeyByRoomId(shared);
		expect(rooms.get('room-left')).toBe(rooms.get('room-right'));
	});

	it('answers per an UNKNOWN Wall or Room with an empty result rather than a guess', () => {
		const document = sharedWallDocument();
		expect(topologyComponentKeyByWallId(document).get('missing-wall')).toBeUndefined();
		expect(wallIdsConnectedTo(document, 'missing-wall')).toEqual([]);
		expect(roomIdsConnectedByTopology(document, 'missing-room')).toEqual([]);
	});

	it('is deterministic, and its membership does not depend on the authored Wall order', () => {
		const document = sharedWallDocument();
		const first = wallJunctionComponents(document);
		expect(wallJunctionComponents(document)).toEqual(first);

		const reversed = documentOf(
			document.junctions.map((junction) => [junction.id, junction.point[0], junction.point[1]]),
			[...document.walls].reverse()
		);
		const membership = (value: readonly { wallIds: readonly string[] }[]) =>
			value.map((component) => [...component.wallIds].sort().join('|')).sort();
		expect(membership(wallJunctionComponents(reversed))).toEqual(membership(first));

		// Components are labelled by their first member in document order.
		expect(first.map((component) => component.key)).toEqual(['wall-a1']);
	});

	it('counts a curved chain as ONE Wall node, and keeps independent groups apart', () => {
		// Two enclosures plus a standalone curved Wall elsewhere: three components.
		const base = sharedWallDocument();
		const withCurve: LayoutDocumentWallFirst = {
			...base,
			junctions: [
				...base.junctions,
				{ id: 'j-bow-a', point: [20, 0] as LayoutVec2 },
				{ id: 'j-bow-b', point: [28, 0] as LayoutVec2 }
			],
			walls: [...base.walls, wall('wall-bow', 'j-bow-a', 'j-bow-b')]
		};
		const components = wallJunctionComponents(withCurve);
		expect(components).toHaveLength(2);
		const bowComponent = components.find((component) =>
			component.wallIds.includes('wall-bow')
		)!;
		expect(bowComponent.wallIds).toEqual(['wall-bow']);
		expect(bowComponent.roomIds).toEqual([]);
		expect(wallsShareTopologyComponent(withCurve, 'wall-bow', 'wall-a1')).toBe(false);
	});
});
