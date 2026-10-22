import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	deriveLayoutWallRole,
	deriveLayoutWallRoles,
	extractBoundaryCandidateFaces,
	layoutWallRoomMemberships,
	type LayoutDocumentWallFirst,
	type LayoutWall
} from '@portfolio/layout-core';

const p = (x: number, z: number): [number, number] => [x, z];

function wall(id: string, start: string, end: string): LayoutWall {
	return { id, startJunctionId: start, endJunctionId: end, thickness: 0.2, height: 3, centerline: { kind: 'line' } };
}

/**
 * Two Rooms sharing `v-1`, one free-standing stub — format 6's three derived
 * roles in one document. No authored `role` exists to disagree with.
 */
function twoRoomDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'j-0-0', point: p(0, 0) },
		{ id: 'j-1-0', point: p(4, 0) },
		{ id: 'j-2-0', point: p(8, 0) },
		{ id: 'j-0-1', point: p(0, 4) },
		{ id: 'j-1-1', point: p(4, 4) },
		{ id: 'j-2-1', point: p(8, 4) },
		{ id: 'j-free-0', point: p(12, 0) },
		{ id: 'j-free-1', point: p(16, 0) }
	];
	document.walls = [
		wall('h-0-0', 'j-0-0', 'j-1-0'),
		wall('h-1-0', 'j-1-0', 'j-2-0'),
		wall('h-0-1', 'j-0-1', 'j-1-1'),
		wall('h-1-1', 'j-1-1', 'j-2-1'),
		wall('v-0', 'j-0-0', 'j-0-1'),
		wall('v-1', 'j-1-0', 'j-1-1'),
		wall('v-2', 'j-2-0', 'j-2-1'),
		wall('free', 'j-free-0', 'j-free-1')
	];
	document.rooms = [
		{
			id: 'room-left',
			name: 'Left',
			boundary: [
				{ wallId: 'h-0-0', direction: 'forward' },
				{ wallId: 'v-1', direction: 'forward' },
				{ wallId: 'h-0-1', direction: 'reverse' },
				{ wallId: 'v-0', direction: 'reverse' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		},
		{
			id: 'room-right',
			name: 'Right',
			boundary: [
				{ wallId: 'h-1-0', direction: 'forward' },
				{ wallId: 'v-2', direction: 'forward' },
				{ wallId: 'h-1-1', direction: 'reverse' },
				{ wallId: 'v-1', direction: 'reverse' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	return document;
}

describe('format 6 — derived Wall role', () => {
	it('derives bounding, dividing and free-standing from Room boundary membership', () => {
		const document = twoRoomDocument();
		// A Room on each side of v-1: the dividing case, which no authored role
		// could express.
		expect(deriveLayoutWallRole(document, 'v-1')).toBe('dividing');
		expect(deriveLayoutWallRole(document, 'h-0-0')).toBe('bounding');
		expect(deriveLayoutWallRole(document, 'v-0')).toBe('bounding');
		expect(deriveLayoutWallRole(document, 'free')).toBe('free-standing');
		expect(deriveLayoutWallRole(document, 'no-such-wall')).toBeUndefined();
		expect(deriveLayoutWallRoles(document)).toEqual(
			new Map([
				['h-0-0', 'bounding'],
				['h-1-0', 'bounding'],
				['h-0-1', 'bounding'],
				['h-1-1', 'bounding'],
				['v-0', 'bounding'],
				['v-1', 'dividing'],
				['v-2', 'bounding'],
				['free', 'free-standing']
			])
		);
	});

	it('counts one Room once even when its boundary references the Wall twice', () => {
		const document = twoRoomDocument();
		document.rooms = [
			{
				...document.rooms[0]!,
				boundary: [
					{ wallId: 'v-1', direction: 'forward' },
					{ wallId: 'h-0-0', direction: 'forward' },
					{ wallId: 'v-1', direction: 'reverse' }
				]
			}
		];
		expect(layoutWallRoomMemberships(document).get('v-1')).toEqual(['room-left']);
		expect(deriveLayoutWallRole(document, 'v-1')).toBe('bounding');
	});

	it('emits the same derived vocabulary in compiled geometry', () => {
		const document = twoRoomDocument();
		// The premise: two Rooms, and face extraction sees exactly their two faces.
		expect(document.rooms).toHaveLength(2);
		expect(extractBoundaryCandidateFaces(document).faces).toHaveLength(2);

		const { geometry } = compileWallFirstLayoutGeometry(document);
		const byWallId = new Map(geometry.walls.map((compiled) => [compiled.wallId, compiled.role]));
		expect(byWallId.get('v-1')).toBe('dividing');
		expect(byWallId.get('h-0-0')).toBe('bounding');
		expect(byWallId.get('free')).toBe('free-standing');
		// Every compiled Wall's role is exactly the derived role — no second model.
		for (const compiled of geometry.walls) {
			expect(compiled.role).toBe(deriveLayoutWallRole(document, compiled.wallId));
		}
	});
});
