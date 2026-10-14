import { describe, expect, it } from 'vitest';

import {
	createEmptyWallFirstLayoutDocument,
	parseWallFirstLayoutDocumentJson,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument
} from '@portfolio/layout-core';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '@portfolio/layout-core';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core';

/** Rectangle room expressed in the new wall-first schema. */
function wallFirstDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-b', point: [6, 0] },
			{ id: 'j-c', point: [6, 4] },
			{ id: 'j-d', point: [0, 4] }
		],
		walls: [
			{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const },
			{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const }
		],
		rooms: [
			{
				id: 'room-main',
				name: 'Main Room',
				boundary: [
					{ wallId: 'wall-a', direction: 'forward' },
					{ wallId: 'wall-b', direction: 'forward' },
					{ wallId: 'wall-c', direction: 'forward' },
					{ wallId: 'wall-d', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			},
			{
				id: 'room-second',
				name: 'Second Room',
				// Shares wall-a with room-main in the opposite direction — the
				// valid undirected-reuse (shared physical wall) case.
				boundary: [{ wallId: 'wall-a', direction: 'reverse' }],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [
			{
				id: 'door-1',
				wallId: 'wall-a',
				kind: 'door',
				offset: 1,
				width: 0.9,
				height: 2.1,
				sillHeight: 0,
				profile: 'rectangular',
				connectsRoomIds: ['room-main', 'room-second']
			}
		],
		objects: [
			{
				id: 'object-1',
				kind: 'box',
				position: [1, 0, 1],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-main'
			}
		]
	};
}

function issueCodes(result: { success: boolean; issues?: Array<{ code: string }> }): string[] {
	return result.success ? [] : result.issues!.map((issue) => issue.code);
}

describe('wall-first layout codec (P23.0a scaffolding)', () => {
	it('validates and canonically round-trips a wall-first document', () => {
		const document = wallFirstDocument();
		const result = validateWallFirstLayoutDocument(document);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.document.formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(result.document.rooms).toHaveLength(2);
		expect(result.document.objects[0]!.roomId).toBe('room-main');
		// Canonical portal ordering: the pair is sorted lexicographically.
		expect(result.document.openings[0]!.connectsRoomIds).toEqual(['room-main', 'room-second']);
		expect(serializeWallFirstLayoutDocument(document)).toBe(result.canonicalJson);

		const reparsed = parseWallFirstLayoutDocumentJson(result.canonicalJson);
		expect(reparsed.success).toBe(true);
	});

	it('rejects unknown keys and non-integer formatVersion values', () => {
		const unknownKey = wallFirstDocument() as unknown as Record<string, unknown>;
		unknownKey.extra = true;
		expect(issueCodes(validateWallFirstLayoutDocument(unknownKey))).toContain('unknown_key');

		const fractionalVersion = { ...wallFirstDocument(), formatVersion: 4.5 };
		expect(issueCodes(validateWallFirstLayoutDocument(fractionalVersion))).toContain(
			'invalid_type'
		);
	});

	it('keeps document-global identity validation across walls, openings and objects', () => {
		const document = wallFirstDocument();
		document.openings.push({ ...document.openings[0]! });
		expect(issueCodes(validateWallFirstLayoutDocument(document))).toContain('duplicate_id');

		const duplicateObject = wallFirstDocument();
		duplicateObject.objects.push({ ...duplicateObject.objects[0]! });
		expect(issueCodes(validateWallFirstLayoutDocument(duplicateObject))).toContain('duplicate_id');
	});

	it('validates wall/junction reference integrity', () => {
		const document = wallFirstDocument();
		document.walls[0]!.endJunctionId = 'j-missing';
		expect(issueCodes(validateWallFirstLayoutDocument(document))).toContain('missing_reference');

		const selfLoop = wallFirstDocument();
		selfLoop.walls[0]!.endJunctionId = selfLoop.walls[0]!.startJunctionId;
		expect(issueCodes(validateWallFirstLayoutDocument(selfLoop))).toContain('invalid_value');
	});

	it('rejects duplicate walls between the same two junctions in either direction', () => {
		const document = wallFirstDocument();
		document.walls.push({
			id: 'wall-a2',
			startJunctionId: 'j-b',
			endJunctionId: 'j-a',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' } as const,
		});
		expect(issueCodes(validateWallFirstLayoutDocument(document))).toContain('duplicate_wall_pair');
	});

	it('validates room boundary and opening references', () => {
		const document = wallFirstDocument();
		document.rooms[0]!.boundary.push({ wallId: 'wall-missing', direction: 'forward' });
		expect(issueCodes(validateWallFirstLayoutDocument(document))).toContain('missing_reference');

		const duplicateRef = wallFirstDocument();
		duplicateRef.rooms[0]!.boundary.push({ wallId: 'wall-a', direction: 'forward' });
		expect(issueCodes(validateWallFirstLayoutDocument(duplicateRef))).toContain(
			'duplicate_boundary_reference'
		);

		const stalePortal = wallFirstDocument();
		stalePortal.openings[0]!.connectsRoomIds = ['room-main', 'room-gone'];
		expect(issueCodes(validateWallFirstLayoutDocument(stalePortal))).toContain(
			'missing_reference'
		);

		const windowRelation = wallFirstDocument();
		windowRelation.openings[0]!.kind = 'window';
		expect(issueCodes(validateWallFirstLayoutDocument(windowRelation))).toContain('invalid_value');
	});

	it('validates optional object roomId associations against persistent rooms', () => {
		const document = wallFirstDocument();
		document.objects[0]!.roomId = 'room-gone';
		expect(issueCodes(validateWallFirstLayoutDocument(document))).toContain('missing_reference');
	});

	it('keeps createEmptyWallFirstLayoutDocument valid', () => {
		const empty = createEmptyWallFirstLayoutDocument();
		const result = validateWallFirstLayoutDocument(empty);
		expect(result.success).toBe(true);
	});
});
