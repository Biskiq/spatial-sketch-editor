import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	validateWallFirstLayoutDocument,
	migrateLegacyLayoutDocument,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocument
} from '@portfolio/layout-core';
import type { LayoutVec2 } from '$lib/layout/layout-types';

/** One axis-aligned legacy room from boundary segments (world-space coords). */
function legacyRoom(config: {
	id: string;
	name: string;
	min: LayoutVec2;
	max: LayoutVec2;
	openings?: Array<{
		id: string;
		segmentId: string;
		kind?: 'door' | 'window';
		offset: number;
		width?: number;
		height?: number;
		sillHeight?: number;
		profile?: 'rectangular' | 'rounded' | 'pointed';
		connectsRoomIds?: [string, string];
	}>;
}): LayoutDocument['floors'][number]['rooms'][number] {
	const [minX, minZ] = config.min;
	const [maxX, maxZ] = config.max;
	return {
		id: config.id,
		name: config.name,
		frame: { origin: [0, 0], yaw: 0 },
		wallThickness: 0.2,
		floorThickness: 0.1,
		ceilingThickness: 0.1,
		boundary: {
			closed: true,
			segments: [
				{ id: `${config.id}-s`, kind: 'line', start: [minX, minZ], end: [maxX, minZ] },
				{ id: `${config.id}-e`, kind: 'line', start: [maxX, minZ], end: [maxX, maxZ] },
				{ id: `${config.id}-n`, kind: 'line', start: [maxX, maxZ], end: [minX, maxZ] },
				{ id: `${config.id}-w`, kind: 'line', start: [minX, maxZ], end: [minX, minZ] }
			]
		},
		openings: (config.openings ?? []).map((opening) => ({
			id: opening.id,
			segmentId: opening.segmentId,
			kind: opening.kind ?? 'door',
			offset: opening.offset,
			width: opening.width ?? 0.9,
			height: opening.height ?? 2.1,
			sillHeight: opening.sillHeight ?? 0,
			profile: opening.profile ?? 'rectangular',
			...(opening.connectsRoomIds ? { connectsRoomIds: opening.connectsRoomIds } : {})
		}))
	};
}

function legacyDocument(rooms: ReturnType<typeof legacyRoom>[], objects: LayoutDocument['objects'] = []): LayoutDocument {
	return {
		units: 'meters',
		floors: [
			{
				id: 'floor-1',
				name: 'Floor 1',
				elevation: 0,
				height: 3,
				rooms
			}
		],
		objects
	};
}

describe('legacy → wall-first Layout migration (P23.0b / H5)', () => {
	it('migrates two rooms sharing a wall: dedupe into one shared Wall, both rooms reference it', () => {
		const legacy = legacyDocument([
			legacyRoom({ id: 'room-a', name: 'A', min: [0, 0], max: [4, 3] }),
			legacyRoom({ id: 'room-b', name: 'B', min: [4, 0], max: [8, 3] })
		]);
		const result = migrateLegacyLayoutDocument(legacy);
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;

		const doc = result.document;
		// P23.6I — migration output is the current canonical format, and the legacy
		// storey height is consumed once into the migrated Wall heights (checked
		// below) rather than surviving on the canonical Floor.
		expect(doc.formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(doc.floor).toEqual({ id: 'floor-1', name: 'Floor 1', elevation: 0 });
		expect(doc.walls.map((wall) => wall.height)).toEqual(doc.walls.map(() => 3));

		// 4 corners for room-a + 2 new for room-b's far side = 6 junctions.
		expect(doc.junctions).toHaveLength(6);
		// 4 walls for room-a; the shared east wall of A is the west wall of B
		// (same junction pair) → deduped into one. 4 + 3 = 7.
		expect(doc.walls).toHaveLength(7);

		// Exactly one Wall spans the shared x=4 edge.
		const shared = doc.walls.filter(
			(wall) =>
				doc.junctions.find((j) => j.id === wall.startJunctionId)!.point[0] === 4 &&
				doc.junctions.find((j) => j.id === wall.endJunctionId)!.point[0] === 4
		);
		expect(shared).toHaveLength(1);

		// Both rooms reference the shared wall in opposite orientations.
		const roomA = doc.rooms.find((room) => room.id === 'room-a')!;
		const roomB = doc.rooms.find((room) => room.id === 'room-b')!;
		expect(roomA.boundary).toHaveLength(4);
		expect(roomB.boundary).toHaveLength(4);
		const sharedWallId = shared[0]!.id;
		expect(roomA.boundary.some((ref) => ref.wallId === sharedWallId)).toBe(true);
		expect(roomB.boundary.some((ref) => ref.wallId === sharedWallId)).toBe(true);

		// The migrated document validates against the strict wall-first codec.
		expect(validateWallFirstLayoutDocument(doc).success).toBe(true);
	});

	it('nodes partial adjacency: the butting wall splits the host wall at the T-junction', () => {
		// Room B butts into the middle of room A's east wall (partial overlap).
		const legacy = legacyDocument([
			legacyRoom({ id: 'room-a', name: 'A', min: [0, 0], max: [4, 6] }),
			legacyRoom({ id: 'room-b', name: 'B', min: [4, 2], max: [7, 4] })
		]);
		const result = migrateLegacyLayoutDocument(legacy);
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;

		const doc = result.document;
		// Room A's east edge (x=4, z 0→6) is noded at z=2 and z=4 into three
		// fragments; plus A's other three walls + B's three unique walls.
		expect(doc.walls.length).toBe(3 + 3 + 3);

		// The T-junctions exist at (4, 2) and (4, 4).
		const tPoints = doc.junctions
			.map((junction) => junction.point)
			.filter(([x, z]) => x === 4 && (z === 2 || z === 4));
		expect(tPoints).toHaveLength(2);

		// B's west wall spans exactly between the two T-junctions.
		const bWest = doc.walls.find((wall) => {
			const start = doc.junctions.find((j) => j.id === wall.startJunctionId)!.point;
			const end = doc.junctions.find((j) => j.id === wall.endJunctionId)!.point;
			return (
				((start[0] === 4 && start[1] === 2 && end[0] === 4 && end[1] === 4) ||
					(start[0] === 4 && start[1] === 4 && end[0] === 4 && end[1] === 2))
			);
		});
		expect(bWest).toBeDefined();
		expect(validateWallFirstLayoutDocument(doc).success).toBe(true);
	});

	it('carries a coincident shared door once and preserves its physical placement', () => {
		// Both rooms author the same physical door on their shared wall, each
		// measured from their own segment start — legacy offset 1 on A's east
		// wall (z 0→3) equals offset 2 on B's west wall (z 3→0).
		const legacy = legacyDocument([
			legacyRoom({
				id: 'room-a',
				name: 'A',
				min: [0, 0],
				max: [4, 3],
				openings: [{ id: 'door-a', segmentId: 'room-a-e', offset: 1, connectsRoomIds: ['room-a', 'room-b'] }]
			}),
			legacyRoom({
				id: 'room-b',
				name: 'B',
				min: [4, 0],
				max: [8, 3],
				// B's west wall runs (4,3)→(4,0); offset 1.1 from (4,3) spans
				// z ∈ [1, 1.9] — the same physical hole as A's door.
				openings: [{ id: 'door-b', segmentId: 'room-b-w', offset: 1.1, connectsRoomIds: ['room-a', 'room-b'] }]
			})
		]);
		const result = migrateLegacyLayoutDocument(legacy);
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;

		// One document-global opening survives the coincident pair. Its
		// physical hole must match A's authored span z ∈ [1, 1.9] on the shared
		// edge, whichever orientation the canonical Wall took: resolve the
		// canonical start's z from the Wall's junctions.
		expect(result.document.openings).toHaveLength(1);
		const opening = result.document.openings[0]!;
		const wall = result.document.walls.find((candidate) => candidate.id === opening.wallId)!;
		const startZ = result.document.junctions.find((j) => j.id === wall.startJunctionId)!.point[1];
		const canonicalStartsAtZero = startZ === 0;
		const physicalStart = canonicalStartsAtZero
			? opening.offset
			: 3 - (opening.offset + opening.width);
		expect(physicalStart).toBeCloseTo(1, 9);
		expect(opening.kind).toBe('door');

		// Lineage records both legacy contributors.
		const contributingKeys = result.report.openingLineage.flatMap((record) =>
			record.sourceOpeningKey.split('|')
		);
		expect(contributingKeys).toContain('room-a.door-a');
		expect(contributingKeys).toContain('room-b.door-b');
	});

	it('rejects conflicting coincident doors instead of choosing silently (H5)', () => {
		const legacy = legacyDocument([
			legacyRoom({
				id: 'room-a',
				name: 'A',
				min: [0, 0],
				max: [4, 3],
				openings: [{ id: 'door-a', segmentId: 'room-a-e', offset: 1 }]
			}),
			legacyRoom({
				id: 'room-b',
				name: 'B',
				min: [4, 0],
				max: [8, 3],
				// Physically a different place (z=3-2=1 measured from z=0): conflict.
				openings: [{ id: 'door-b', segmentId: 'room-b-w', offset: 1 }]
			})
		]);
		const result = migrateLegacyLayoutDocument(legacy);
		expect(result.kind).toBe('rejected');
		if (result.kind !== 'rejected') return;
		expect(result.code).toBe('conflicting-coincident-walls');
		expect(result.issues.length).toBeGreaterThan(0);
	});

	it('rejects curved boundaries by name — flattening is never lossless', () => {
		const room = legacyRoom({ id: 'room-a', name: 'A', min: [0, 0], max: [4, 3] });
		room.boundary.segments[1] = {
			id: 'room-a-e',
			kind: 'auto-bezier',
			start: [4, 0],
			end: [4, 3],
			interiorAnchors: [{ id: 'anchor-1', point: [5, 1.5] }]
		};
		const result = migrateLegacyLayoutDocument(legacyDocument([room]));
		expect(result.kind).toBe('rejected');
		if (result.kind !== 'rejected') return;
		expect(result.code).toBe('curve-unsupported');
		expect(result.issues[0]!.code).toBe('curve_unsupported');
		expect(result.issues[0]!.path).toContain('boundary.segments');
		expect(result.issues[0]!.message).toContain('room-a-e');
	});

	it('rejects multi-floor payloads to the compatibility path', () => {
		const room = legacyRoom({ id: 'room-a', name: 'A', min: [0, 0], max: [4, 3] });
		const doc = legacyDocument([room]);
		doc.floors.push({
			id: 'floor-2',
			name: 'Floor 2',
			elevation: 3,
			height: 3,
			rooms: [legacyRoom({ id: 'room-up', name: 'Up', min: [0, 0], max: [4, 3] })]
		});
		const result = migrateLegacyLayoutDocument(doc);
		expect(result.kind).toBe('rejected');
		if (result.kind !== 'rejected') return;
		expect(result.code).toBe('multi-floor-unsupported');
	});

	it('carries document objects verbatim (Layout objects are already world-local)', () => {
		const object = {
			id: 'obj-1',
			kind: 'box' as const,
			position: [2, 0.5, 1.5] as [number, number, number],
			rotation: [0, 0.4, 0] as [number, number, number],
			dimensions: [1, 1, 1] as [number, number, number],
			roomId: 'room-a'
		};
		const legacy = legacyDocument(
			[legacyRoom({ id: 'room-a', name: 'A', min: [0, 0], max: [4, 3] })],
			[object]
		);
		const result = migrateLegacyLayoutDocument(legacy);
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.objects).toHaveLength(1);
		expect(result.document.objects[0]).toEqual(object);
	});

	it('is deterministic: identical inputs produce identical documents', () => {
		const rooms = [
			legacyRoom({
				id: 'room-a',
				name: 'A',
				min: [0, 0],
				max: [4, 3],
				openings: [{ id: 'door-a', segmentId: 'room-a-e', offset: 1 }]
			}),
			legacyRoom({
				id: 'room-b',
				name: 'B',
				min: [4, 0],
				max: [8, 3],
				openings: [{ id: 'door-b', segmentId: 'room-b-w', offset: 1.1 }]
			})
		];
		const first = migrateLegacyLayoutDocument(legacyDocument(rooms));
		const second = migrateLegacyLayoutDocument(legacyDocument(rooms));
		expect(first.kind).toBe('success');
		expect(second.kind).toBe('success');
		if (first.kind !== 'success' || second.kind !== 'success') return;
		expect(second.document).toEqual(first.document);
		expect(second.report).toEqual(first.report);
	});

	it('compiles the migrated document through the wall-first compiler (cutover parity)', () => {
		const legacy = legacyDocument([
			legacyRoom({ id: 'room-a', name: 'A', min: [0, 0], max: [4, 3] })
		]);
		const result = migrateLegacyLayoutDocument(legacy);
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;

		// The migrated output compiles; floor elevation and room identity flow.
		// (Full geometry parity is covered by layout-geometry golden tests on
		// the shared compiler seam.)
		const compiled = compileWallFirstLayoutGeometry(result.document);
		expect(compiled.issues).toEqual([]);
		expect(compiled.geometry.rooms).toHaveLength(1);
		expect(compiled.geometry.rooms[0]!.roomId).toBe('room-a');
		expect(compiled.geometry.rooms[0]!.floorElevation).toBe(0);
		expect(compiled.geometry.rooms[0]!.floorPolygon).toHaveLength(4);
	});
});
