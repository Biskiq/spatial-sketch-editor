import { describe, expect, it } from 'vitest';

import type { LayoutVec2 } from '$lib/layout/layout-types';
import { extractBoundaryCandidateFaces } from '$lib/layout/layout-face-extraction';
import {
	reconcileRooms,
	ROOM_CREATION_DEFAULTS,
	type ComponentLineage,
	type RoomIdAllocator
} from '$lib/layout/layout-room-reconciliation';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst
} from '$lib/layout/layout-wall-first-codec';

type WallSeed = {
	id: string;
	start: string;
	end: string;
	role?: 'boundary' | 'partition';
};

function document(
	junctions: Array<[string, number, number]>,
	walls: WallSeed[]
): Omit<LayoutDocumentWallFirst, 'rooms'> {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.start,
			endJunctionId: wall.end,
			role: wall.role ?? 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' } as const,
		})),
		openings: [],
		objects: []
	};
}

const RECT_JUNCTIONS: Array<[string, number, number]> = [
	['j-a', 0, 0],
	['j-b', 6, 0],
	['j-c', 6, 4],
	['j-d', 0, 4]
];
const RECT_WALLS: WallSeed[] = [
	{ id: 'wall-a', start: 'j-a', end: 'j-b' },
	{ id: 'wall-b', start: 'j-b', end: 'j-c' },
	{ id: 'wall-c', start: 'j-c', end: 'j-d' },
	{ id: 'wall-d', start: 'j-d', end: 'j-a' }
];

const RECT = document(RECT_JUNCTIONS, RECT_WALLS);
const RECT_FACE = extractBoundaryCandidateFaces({ ...RECT, rooms: [] }).faces[0]!;

/** Two-room noded candidate: 6x4 rectangle split at x=3 by wall-e. */
function twoRoomCandidate(): Omit<LayoutDocumentWallFirst, 'rooms'> {
	return document(
		[
			['j-a', 0, 0],
			['j-m', 3, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-n', 3, 4],
			['j-d', 0, 4]
		],
		[
			{ id: 'wall-a1', start: 'j-a', end: 'j-m' },
			{ id: 'wall-a2', start: 'j-m', end: 'j-b' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c1', start: 'j-c', end: 'j-n' },
			{ id: 'wall-c2', start: 'j-n', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{ id: 'wall-e', start: 'j-m', end: 'j-n' }
		]
	);
}

const SPLIT_CANDIDATE = twoRoomCandidate();
const SPLIT_EXTRACTION = extractBoundaryCandidateFaces({ ...SPLIT_CANDIDATE, rooms: [] });
const SPLIT_LEFT_FACE = SPLIT_EXTRACTION.faces.find((face) =>
	face.boundary.some((ref) => ref.wallId === 'wall-e' && ref.direction === 'forward')
)!;
const SPLIT_RIGHT_FACE = SPLIT_EXTRACTION.faces.find((face) =>
	face.boundary.some((ref) => ref.wallId === 'wall-e' && ref.direction === 'reverse')
)!;

function allocator(): RoomIdAllocator {
	let counter = 0;
	return {
		nextRoomId(base) {
			let candidate = `room-new-${++counter}`;
			while (base.rooms.some((room) => room.id === candidate)) {
				candidate = `room-new-${++counter}`;
			}
			return candidate;
		},
		nextRoomName(existing) {
			return `Room ${existing.length + 1}`;
		}
	};
}

function room(
	id: string,
	name: string,
	boundary: Array<{ wallId: string; direction: 'forward' | 'reverse' }>,
	overrides: Partial<{ floorThickness: number; ceilingThickness: number }> = {}
) {
	return {
		id,
		name,
		boundary,
		floorThickness: 0.1,
		ceilingThickness: 0.1,
		...overrides
	};
}

describe('Room reconciliation — safe components (P23.8 / H5)', () => {
	it('creates Rooms from candidate faces with no predecessor (0→1 birth)', () => {
		const result = reconcileRooms({
			baseline: { ...RECT, rooms: [] },
			candidateDocument: RECT,
			extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
			components: [{ candidateFaceKeys: [RECT_FACE.key], predecessorRoomIds: [] }],
			allocator: allocator()
		});
		if (!('document' in result)) {
			throw new Error('expected success');
		}
		expect(result.document.rooms).toHaveLength(1);
		expect(result.document.rooms[0]!.floorThickness).toBe(ROOM_CREATION_DEFAULTS.floorThickness);
		expect(result.document.rooms[0]!.ceilingThickness).toBe(
			ROOM_CREATION_DEFAULTS.ceilingThickness
		);
		expect(result.lineage[0]!.kind).toBe('created');
		expect(result.retiredRoomIds).toEqual([]);
	});

	it('preserves identity and metadata on 1→1 correspondence', () => {
		const baseline: LayoutDocumentWallFirst = {
			...RECT,
			rooms: [
				room('room-main', 'Main', RECT_FACE.boundary.map((ref) => ({ ...ref })), {
					floorThickness: 0.15
				})
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: RECT,
			extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
			components: [
				{ candidateFaceKeys: [RECT_FACE.key], predecessorRoomIds: ['room-main'] }
			],
			allocator: allocator()
		});
		if (!('document' in result)) throw new Error('expected success');
		const preserved = result.document.rooms[0]!;
		expect(preserved.id).toBe('room-main');
		expect(preserved.name).toBe('Main');
		expect(preserved.floorThickness).toBe(0.15);
		expect(result.lineage[0]!.kind).toBe('preserved');
	});

	it('resolves a 1→2 split by overlap, then witness; identity stays on the winner', () => {
		const baseline: LayoutDocumentWallFirst = {
			...RECT,
			rooms: [room('room-main', 'Main', RECT_FACE.boundary.map((ref) => ({ ...ref })))]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: SPLIT_CANDIDATE,
			extraction: SPLIT_EXTRACTION,
			components: [
				{
					candidateFaceKeys: [SPLIT_LEFT_FACE.key, SPLIT_RIGHT_FACE.key],
					predecessorRoomIds: ['room-main']
				}
			],
			// Equal overlap (12 vs 12): the witness [1, 2] lies strictly inside
			// the left face only, so room-main survives there (H5 §6.2).
			predecessorPolygons: new Map([['room-main', [[0, 0], [6, 0], [6, 4], [0, 4]]]]),
			predecessorWitnesses: new Map([['room-main', [1, 2]]]),
			allocator: allocator()
		});
		if (!('document' in result)) throw new Error('expected success');
		expect(result.document.rooms).toHaveLength(2);
		const survivor = result.document.rooms.find((entry) => entry.id === 'room-main')!;
		expect(survivor.boundary).toEqual(SPLIT_LEFT_FACE.boundary.map((ref) => ({ ...ref })));
		const newborn = result.document.rooms.find((entry) => entry.id !== 'room-main')!;
		expect(newborn.floorThickness).toBe(0.1); // inherited from predecessor
		expect(result.lineage.map((record) => record.kind).sort()).toEqual(['created', 'split-survivor']);
		expect(result.retiredRoomIds).toEqual([]);
	});

	it('breaks split ties by canonical face key when no evidence separates them', () => {
		const baseline: LayoutDocumentWallFirst = {
			...RECT,
			rooms: [room('room-main', 'Main', RECT_FACE.boundary.map((ref) => ({ ...ref })))]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: SPLIT_CANDIDATE,
			extraction: SPLIT_EXTRACTION,
			components: [
				{
					candidateFaceKeys: [SPLIT_LEFT_FACE.key, SPLIT_RIGHT_FACE.key],
					predecessorRoomIds: ['room-main']
				}
			],
			allocator: allocator()
		});
		if (!('document' in result)) throw new Error('expected success');
		const survivor = result.document.rooms.find((entry) => entry.id === 'room-main')!;
		// No overlap polygons, no witness → smallest canonical face key wins.
		const smallestKey = [SPLIT_LEFT_FACE.key, SPLIT_RIGHT_FACE.key].sort()[0]!;
		expect(survivor.boundary).toEqual(
			smallestKey === SPLIT_LEFT_FACE.key
				? SPLIT_LEFT_FACE.boundary.map((ref) => ({ ...ref }))
				: SPLIT_RIGHT_FACE.boundary.map((ref) => ({ ...ref }))
		);
	});

	it('merges two rooms into one candidate (2→1) with deterministic survivor and portal collapse', () => {
		const baseline: LayoutDocumentWallFirst = {
			...SPLIT_CANDIDATE,
			rooms: [
				room('room-left', 'Left', SPLIT_LEFT_FACE.boundary.map((ref) => ({ ...ref }))),
				room('room-right', 'Right', SPLIT_RIGHT_FACE.boundary.map((ref) => ({ ...ref })))
			],
			openings: [
				{
					id: 'door-shared',
					wallId: 'wall-e',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['room-left', 'room-right']
				}
			],
			objects: [
				{ id: 'object-1', kind: 'box', position: [4, 0, 2], rotation: [0, 0, 0], dimensions: [1, 1, 1], roomId: 'room-right' }
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: { ...RECT, openings: baseline.openings, objects: baseline.objects },
			extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
			components: [
				{
					candidateFaceKeys: [RECT_FACE.key],
					predecessorRoomIds: ['room-left', 'room-right']
				}
			],
			// Equal contributions → smallest Room ID ('room-left') survives.
			predecessorPolygons: new Map([
				['room-left', [[0, 0], [3, 0], [3, 4], [0, 4]]],
				['room-right', [[3, 0], [6, 0], [6, 4], [3, 4]]]
			]),
			allocator: allocator()
		});
		if (!('document' in result)) throw new Error('expected success');
		expect(result.document.rooms).toHaveLength(1);
		expect(result.document.rooms[0]!.id).toBe('room-left');
		expect(result.retiredRoomIds).toEqual(['room-right']);
		// Object association follows the merge survivor; transform untouched.
		expect(result.document.objects[0]!.roomId).toBe('room-left');
		expect(result.document.objects[0]!.position).toEqual([4, 0, 2]);
		// Portal semantic collapse: both ends map to the survivor, physical
		// door preserved, explicit relation cleared.
		expect(result.document.openings[0]!.id).toBe('door-shared');
		expect(result.document.openings[0]!.connectsRoomIds).toBeUndefined();
		expect(result.lineage[0]!.kind).toBe('merge-survivor');
	});

	it('rejects a merge whose authored surface metadata conflicts (H5 §6.4)', () => {
		const baseline: LayoutDocumentWallFirst = {
			...SPLIT_CANDIDATE,
			rooms: [
				room('room-left', 'Left', SPLIT_LEFT_FACE.boundary.map((ref) => ({ ...ref }))),
				room('room-right', 'Right', SPLIT_RIGHT_FACE.boundary.map((ref) => ({ ...ref })), {
					floorThickness: 0.2
				})
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: RECT,
			extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
			components: [
				{
					candidateFaceKeys: [RECT_FACE.key],
					predecessorRoomIds: ['room-left', 'room-right']
				}
			],
			allocator: allocator()
		});
		expect(result).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({ code: 'metadata_merge_conflict' })
		});
	});

	it('retires rooms outside every component and clears their dangling associations', () => {
		// Baseline: two independent rectangles; candidate keeps only rect one.
		const otherJunctions: Array<[string, number, number]> = [
			['j-p', 20, 0],
			['j-q', 26, 0],
			['j-r', 26, 4],
			['j-s', 20, 4]
		];
		const otherWalls: WallSeed[] = [
			{ id: 'wall-p', start: 'j-p', end: 'j-q' },
			{ id: 'wall-q', start: 'j-q', end: 'j-r' },
			{ id: 'wall-r', start: 'j-r', end: 'j-s' },
			{ id: 'wall-s', start: 'j-s', end: 'j-p' }
		];
		const otherFace = extractBoundaryCandidateFaces({
			...document(otherJunctions, otherWalls),
			rooms: []
		}).faces[0]!;
		const baseline: LayoutDocumentWallFirst = {
			...RECT,
			junctions: [...RECT.junctions, ...otherJunctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 }))],
			walls: [...RECT.walls, ...otherWalls.map((wall) => ({
				id: wall.id,
				startJunctionId: wall.start,
				endJunctionId: wall.end,
				role: 'boundary' as const,
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' } as const,
			}))],
			rooms: [
				room('room-keep', 'Keep', RECT_FACE.boundary.map((ref) => ({ ...ref }))),
				room('room-gone', 'Gone', otherFace.boundary.map((ref) => ({ ...ref })))
			],
			objects: [
				{ id: 'object-1', kind: 'box', position: [22, 0, 2], rotation: [0, 0, 0], dimensions: [1, 1, 1], roomId: 'room-gone' }
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: { ...RECT, objects: baseline.objects },
			extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
			components: [{ candidateFaceKeys: [RECT_FACE.key], predecessorRoomIds: ['room-keep'] }],
			allocator: allocator()
		});
		if (!('document' in result)) throw new Error('expected success');
		expect(result.retiredRoomIds).toEqual(['room-gone']);
		// No successor exists (disappearance, not merge) → association cleared.
		expect(result.document.objects[0]!.roomId).toBeUndefined();
	});

	it('rejects an unresolved portal relation on one-sided room disappearance', () => {
		const otherJunctions: Array<[string, number, number]> = [
			['j-p', 20, 0],
			['j-q', 26, 0],
			['j-r', 26, 4],
			['j-s', 20, 4]
		];
		const otherWalls: WallSeed[] = [
			{ id: 'wall-p', start: 'j-p', end: 'j-q' },
			{ id: 'wall-q', start: 'j-q', end: 'j-r' },
			{ id: 'wall-r', start: 'j-r', end: 'j-s' },
			{ id: 'wall-s', start: 'j-s', end: 'j-p' }
		];
		const baseline: LayoutDocumentWallFirst = {
			...RECT,
			junctions: [...RECT.junctions, ...otherJunctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 }))],
			walls: [...RECT.walls, ...otherWalls.map((wall) => ({
				id: wall.id,
				startJunctionId: wall.start,
				endJunctionId: wall.end,
				role: 'boundary' as const,
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' } as const,
			}))],
			rooms: [
				room('room-keep', 'Keep', RECT_FACE.boundary.map((ref) => ({ ...ref }))),
				room('room-gone', 'Gone', [
					{ wallId: 'wall-p', direction: 'forward' },
					{ wallId: 'wall-q', direction: 'forward' },
					{ wallId: 'wall-r', direction: 'forward' },
					{ wallId: 'wall-s', direction: 'forward' }
				])
			],
			// Door declared between a surviving and a disappearing room: the
			// remap is ambiguous for the surviving side → whole command rejects.
			openings: [
				{
					id: 'door-bridge',
					wallId: 'wall-a',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['room-keep', 'room-gone']
				}
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: { ...RECT, openings: baseline.openings },
			extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
			components: [{ candidateFaceKeys: [RECT_FACE.key], predecessorRoomIds: ['room-keep'] }],
			allocator: allocator()
		});
		expect(result).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({ code: 'unresolved_portal_remap' })
		});
	});
});

describe('Room reconciliation — rejection guards', () => {
	it('rejects components claiming unknown faces or unknown predecessors', () => {
		const baseline: LayoutDocumentWallFirst = { ...RECT, rooms: [] };
		expect(
			reconcileRooms({
				baseline,
				candidateDocument: RECT,
				extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
				components: [{ candidateFaceKeys: ['face-nope'], predecessorRoomIds: [] }],
				allocator: allocator()
			})
		).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({ code: 'unsupported_component' })
		});
		expect(
			reconcileRooms({
				baseline,
				candidateDocument: RECT,
				extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
				components: [{ candidateFaceKeys: [RECT_FACE.key], predecessorRoomIds: ['room-nope'] }],
				allocator: allocator()
			})
		).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({ code: 'unsupported_component' })
		});
	});

	it('rejects a face claimed by two components as ambiguous correspondence', () => {
		const baseline: LayoutDocumentWallFirst = {
			...RECT,
			rooms: [
				room('room-one', 'One', RECT_FACE.boundary.map((ref) => ({ ...ref }))),
				room('room-two', 'Two', RECT_FACE.boundary.map((ref) => ({ ...ref })))
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: RECT,
			extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
			components: [
				{ candidateFaceKeys: [RECT_FACE.key], predecessorRoomIds: ['room-one'] },
				{ candidateFaceKeys: [RECT_FACE.key], predecessorRoomIds: ['room-two'] }
			],
			allocator: allocator()
		});
		expect(result).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({ code: 'ambiguous_room_correspondence' })
		});
	});

	it('rejects unsupported component shapes such as 2→2', () => {
		const baseline: LayoutDocumentWallFirst = {
			...RECT,
			rooms: [
				room('room-one', 'One', RECT_FACE.boundary.map((ref) => ({ ...ref }))),
				room('room-two', 'Two', RECT_FACE.boundary.map((ref) => ({ ...ref })))
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: SPLIT_CANDIDATE,
			extraction: SPLIT_EXTRACTION,
			components: [
				{
					candidateFaceKeys: [SPLIT_LEFT_FACE.key, SPLIT_RIGHT_FACE.key],
					predecessorRoomIds: ['room-one', 'room-two']
				}
			],
			allocator: allocator()
		});
		expect(result).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({
				code: 'unsupported_component',
				roomIds: ['room-one', 'room-two']
			})
		});
	});

	// P23 review round 1: takenNames started empty and allocation saw only
	// the already-created finalRooms, so a birth during a multi-component
	// operation could collide with a pre-existing baseline Room id/name.
	it('seeds allocation with baseline Room ids and names (multi-component collision)', () => {
		const baseline: LayoutDocumentWallFirst = {
			...RECT,
			rooms: [
				room('room-new-1', 'Room 1', RECT_FACE.boundary.map((ref) => ({ ...ref })))
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: RECT,
			extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
			components: [{ candidateFaceKeys: [RECT_FACE.key], predecessorRoomIds: [] }],
			allocator: allocator()
		});
		if (!('document' in result)) {
			throw new Error('expected success');
		}
		const created = result.document.rooms.find((candidate) => candidate.id !== 'room-new-1');
		expect(created).toBeDefined();
		// Without baseline seeding the allocator would hand back the very id
		// and name the baseline room already owns.
		expect(created!.id).not.toBe('room-new-1');
		expect(created!.name).not.toBe('Room 1');
	});

	it('keeps allocations distinct across two birth components in one operation', () => {
		const twoRects = document(
			[
				['j-a', 0, 0],
				['j-b', 6, 0],
				['j-c', 6, 4],
				['j-d', 0, 4],
				['j-e', 20, 0],
				['j-f', 26, 0],
				['j-g', 26, 4],
				['j-h', 20, 4]
			],
			[
				{ id: 'wall-a1', start: 'j-a', end: 'j-b' },
				{ id: 'wall-a2', start: 'j-b', end: 'j-c' },
				{ id: 'wall-a3', start: 'j-c', end: 'j-d' },
				{ id: 'wall-a4', start: 'j-d', end: 'j-a' },
				{ id: 'wall-b1', start: 'j-e', end: 'j-f' },
				{ id: 'wall-b2', start: 'j-f', end: 'j-g' },
				{ id: 'wall-b3', start: 'j-g', end: 'j-h' },
				{ id: 'wall-b4', start: 'j-h', end: 'j-e' }
			]
		);
		const extraction = extractBoundaryCandidateFaces({ ...twoRects, rooms: [] });
		expect(extraction.faces).toHaveLength(2);
		const leftFace = extraction.faces.find((face) =>
			face.boundary.some((ref) => ref.wallId === 'wall-a1')
		)!;
		const rightFace = extraction.faces.find((face) =>
			face.boundary.some((ref) => ref.wallId === 'wall-b1')
		)!;

		const result = reconcileRooms({
			baseline: { ...twoRects, rooms: [] },
			candidateDocument: twoRects,
			extraction,
			components: [
				{ candidateFaceKeys: [leftFace.key], predecessorRoomIds: [] },
				{ candidateFaceKeys: [rightFace.key], predecessorRoomIds: [] }
			],
			allocator: allocator()
		});
		if (!('document' in result)) {
			throw new Error('expected success');
		}
		expect(result.document.rooms).toHaveLength(2);
		expect(new Set(result.document.rooms.map((candidate) => candidate.id)).size).toBe(2);
		expect(new Set(result.document.rooms.map((candidate) => candidate.name)).size).toBe(2);
		expect(result.lineage.every((record) => record.kind === 'created')).toBe(true);
	});

	it('rejects a predecessor claimed by two components', () => {
		const baseline: LayoutDocumentWallFirst = {
			...SPLIT_CANDIDATE,
			rooms: [
				room(
					'room-main',
					'Main',
					SPLIT_LEFT_FACE.boundary.map((ref) => ({ ...ref }))
				)
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: SPLIT_CANDIDATE,
			extraction: SPLIT_EXTRACTION,
			components: [
				{ candidateFaceKeys: [SPLIT_LEFT_FACE.key], predecessorRoomIds: ['room-main'] },
				{ candidateFaceKeys: [SPLIT_RIGHT_FACE.key], predecessorRoomIds: ['room-main'] }
			],
			allocator: allocator()
		});
		expect(result).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({
				code: 'ambiguous_room_correspondence',
				roomIds: ['room-main']
			})
		});
	});

	it('rejects when a candidate face is claimed by no component', () => {
		const baseline: LayoutDocumentWallFirst = {
			...SPLIT_CANDIDATE,
			rooms: [
				room(
					'room-left',
					'Left',
					SPLIT_LEFT_FACE.boundary.map((ref) => ({ ...ref }))
				),
				room(
					'room-right',
					'Right',
					SPLIT_RIGHT_FACE.boundary.map((ref) => ({ ...ref }))
				)
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: SPLIT_CANDIDATE,
			extraction: SPLIT_EXTRACTION,
			// Only the left face is claimed; the right face is silently
			// dropped unless the correspondence is rejected.
			components: [
				{ candidateFaceKeys: [SPLIT_LEFT_FACE.key], predecessorRoomIds: ['room-left'] }
			],
			allocator: allocator()
		});
		expect(result).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({
				code: 'unsupported_component',
				faceKey: SPLIT_RIGHT_FACE.key
			})
		});
	});

	// P23 review round 1 fixture: promoting a partition to boundary and
	// closing an annex in one operation — identity preserved on the original
	// room while two births allocate distinct ids/names across components.
	it('creates Rooms from partition→boundary promotion: preserved room plus two births', () => {
		const candidate = document(
			[
				['j-a', 0, 0],
				['j-m', 3, 0],
				['j-b', 6, 0],
				['j-c', 6, 4],
				['j-n', 3, 4],
				['j-d', 0, 4],
				['j-f', 10, 0],
				['j-g', 10, 4]
			],
			[
				{ id: 'wall-a1', start: 'j-a', end: 'j-m' },
				{ id: 'wall-a2', start: 'j-m', end: 'j-b' },
				{ id: 'wall-b', start: 'j-b', end: 'j-c' },
				{ id: 'wall-c1', start: 'j-c', end: 'j-n' },
				{ id: 'wall-c2', start: 'j-n', end: 'j-d' },
				{ id: 'wall-d', start: 'j-d', end: 'j-a' },
				{ id: 'wall-e', start: 'j-m', end: 'j-n' },
				{ id: 'wall-f', start: 'j-b', end: 'j-f' },
				{ id: 'wall-g', start: 'j-f', end: 'j-g' },
				{ id: 'wall-h', start: 'j-g', end: 'j-c' }
			]
		);
		const extraction = extractBoundaryCandidateFaces({ ...candidate, rooms: [] });
		expect(extraction.faces).toHaveLength(3);
		const faceByWall = (wallId: string) =>
			extraction.faces.find((face) => face.boundary.some((ref) => ref.wallId === wallId))!;
		const leftFace = faceByWall('wall-a1');
		const rightFace = faceByWall('wall-a2');
		const annexFace = faceByWall('wall-f');

		const baseline: LayoutDocumentWallFirst = {
			...RECT,
			rooms: [room('room-main', 'Main', RECT_FACE.boundary.map((ref) => ({ ...ref })))]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: candidate,
			extraction,
			components: [
				{ candidateFaceKeys: [leftFace.key], predecessorRoomIds: ['room-main'] },
				{ candidateFaceKeys: [rightFace.key], predecessorRoomIds: [] },
				{ candidateFaceKeys: [annexFace.key], predecessorRoomIds: [] }
			],
			predecessorWitnesses: new Map([['room-main', [1, 2]]]),
			allocator: allocator()
		});
		if (!('document' in result)) {
			throw new Error('expected success');
		}
		expect(result.document.rooms).toHaveLength(3);
		const preserved = result.document.rooms.find((entry) => entry.id === 'room-main')!;
		expect(preserved.boundary).toEqual(leftFace.boundary.map((ref) => ({ ...ref })));
		const newborns = result.document.rooms.filter((entry) => entry.id !== 'room-main');
		expect(newborns).toHaveLength(2);
		expect(new Set(newborns.map((entry) => entry.id)).size).toBe(2);
		expect(new Set(newborns.map((entry) => entry.name)).size).toBe(2);
		expect(newborns.every((entry) => entry.floorThickness === ROOM_CREATION_DEFAULTS.floorThickness)).toBe(true);
		expect(result.lineage.find((record) => record.roomId === 'room-main')!.kind).toBe('preserved');
		expect(result.retiredRoomIds).toEqual([]);
	});

	it('subdivides end-to-end: split, portal preserved, association retains the survivor', () => {
		const baseline: LayoutDocumentWallFirst = {
			...RECT,
			rooms: [room('room-main', 'Main', RECT_FACE.boundary.map((ref) => ({ ...ref })))],
			openings: [
				{
					id: 'door-perimeter',
					wallId: 'wall-b',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular'
				}
			],
			objects: [
				{ id: 'object-1', kind: 'box', position: [4, 0, 1], rotation: [0, 0, 0], dimensions: [1, 1, 1], roomId: 'room-main' }
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: { ...SPLIT_CANDIDATE, openings: baseline.openings, objects: baseline.objects },
			extraction: SPLIT_EXTRACTION,
			components: [
				{
					candidateFaceKeys: [SPLIT_LEFT_FACE.key, SPLIT_RIGHT_FACE.key],
					predecessorRoomIds: ['room-main']
				}
			],
			predecessorPolygons: new Map([['room-main', [[0, 0], [6, 0], [6, 4], [0, 4]]]]),
			predecessorWitnesses: new Map([['room-main', [1, 2]]]),
			allocator: allocator()
		});
		if (!('document' in result)) {
			throw new Error('expected success');
		}
		expect(result.document.rooms).toHaveLength(2);
		expect(result.document.rooms.find((entry) => entry.id === 'room-main')).toBeDefined();
		const newborn = result.document.rooms.find((entry) => entry.id !== 'room-main')!;
		// P23.8: on split the association retains the survivor ID "without
		// choosing by object position" — even though the object sits in the
		// newborn half, it stays with room-main and is never moved.
		expect(result.document.objects[0]!.roomId).toBe('room-main');
		expect(result.document.objects[0]!.position).toEqual([4, 0, 1]);
		expect(newborn.id).not.toBe('room-main');
		// The perimeter door carries over untouched (still hosted by wall-b).
		expect(result.document.openings).toHaveLength(1);
		expect(result.document.openings[0]!.id).toBe('door-perimeter');
		expect(result.lineage.map((record) => record.kind).sort()).toEqual(['created', 'split-survivor']);
	});

	it('rejects the whole command when one component is unsupported alongside valid ones', () => {
		const baseline: LayoutDocumentWallFirst = {
			...SPLIT_CANDIDATE,
			rooms: [
				room(
					'room-left',
					'Left',
					SPLIT_LEFT_FACE.boundary.map((ref) => ({ ...ref }))
				),
				room(
					'room-right',
					'Right',
					SPLIT_RIGHT_FACE.boundary.map((ref) => ({ ...ref }))
				)
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: RECT,
			extraction: extractBoundaryCandidateFaces({ ...RECT, rooms: [] }),
			// First component is a valid 2→1 merge; the second references an
			// unknown face. The whole command must reject — never a partial
			// commit of the valid half.
			components: [
				{
					candidateFaceKeys: [RECT_FACE.key],
					predecessorRoomIds: ['room-left', 'room-right']
				},
				{ candidateFaceKeys: ['face-does-not-exist'], predecessorRoomIds: [] }
			],
			allocator: allocator()
		});
		expect(result).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({
				code: 'unsupported_component'
			})
		});
		expect('document' in result).toBe(false);
	});

	it('remaps a portal to distinct rooms when one endpoint retires into a merge survivor', () => {
		const candidate = document(
			[
				...RECT_JUNCTIONS,
				['j-e', 20, 0],
				['j-f', 26, 0],
				['j-g', 26, 4],
				['j-h', 20, 4]
			],
			[
				...RECT_WALLS,
				{ id: 'wall-annex-a', start: 'j-e', end: 'j-f' },
				{ id: 'wall-annex-b', start: 'j-f', end: 'j-g' },
				{ id: 'wall-annex-c', start: 'j-g', end: 'j-h' },
				{ id: 'wall-annex-d', start: 'j-h', end: 'j-e' }
			]
		);
		const extraction = extractBoundaryCandidateFaces({ ...candidate, rooms: [] });
		expect(extraction.faces).toHaveLength(2);
		const rectFace = extraction.faces.find((face) =>
			face.boundary.some((ref) => ref.wallId === 'wall-a')
		)!;
		const annexFace = extraction.faces.find((face) =>
			face.boundary.some((ref) => ref.wallId === 'wall-annex-a')
		)!;
		const baseline: LayoutDocumentWallFirst = {
			...candidate,
			rooms: [
				room('room-left', 'Left', RECT_FACE.boundary.map((ref) => ({ ...ref }))),
				room('room-right', 'Right', RECT_FACE.boundary.map((ref) => ({ ...ref }))),
				room(
					'room-annex',
					'Annex',
					annexFace.boundary.map((ref) => ({ ...ref }))
				)
			],
			openings: [
				{
					id: 'door-corridor',
					wallId: 'wall-d',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['room-right', 'room-annex']
				}
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: { ...candidate, openings: baseline.openings, objects: [] },
			extraction,
			components: [
				{ candidateFaceKeys: [rectFace.key], predecessorRoomIds: ['room-left', 'room-right'] },
				{ candidateFaceKeys: [annexFace.key], predecessorRoomIds: ['room-annex'] }
			],
			predecessorPolygons: new Map([
				['room-left', [[0, 0], [3, 0], [3, 4], [0, 4]]],
				['room-right', [[3, 0], [6, 0], [6, 4], [3, 4]]]
			]),
			// Witness in the left half pins room-left as the merge survivor,
			// so room-right retires into room-left.
			predecessorWitnesses: new Map([
				['room-left', [1, 2]],
				['room-right', [4, 2]]
			]),
			allocator: allocator()
		});
		if (!('document' in result)) {
			throw new Error('expected success');
		}
		expect(result.retiredRoomIds).toEqual(['room-right']);
		const door = result.document.openings.find((opening) => opening.id === 'door-corridor')!;
		// Retired endpoint remaps to its successor; surviving endpoint stays.
		expect(door.connectsRoomIds).toEqual(['room-left', 'room-annex']);
	});
});

/**
 * P23.3 step 0 — split-side portal remap (P23.8-owned). The two-room
 * candidate with the LEFT room additionally split at x=1.5 into leftA
 * (x∈[0,1.5]) and leftB (x∈[1.5,3]). Only `leftB` touches the portal wall
 * `wall-e`, so wall-side adjacency is the only correct successor signal.
 */
function leftSplitCandidate(): Omit<LayoutDocumentWallFirst, 'rooms'> {
	return document(
		[
			['j-a', 0, 0],
			['j-o', 1.5, 0],
			['j-m', 3, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-n', 3, 4],
			['j-p', 1.5, 4],
			['j-d', 0, 4]
		],
		[
			{ id: 'wall-a1', start: 'j-a', end: 'j-o' },
			{ id: 'wall-a1b', start: 'j-o', end: 'j-m' },
			{ id: 'wall-a2', start: 'j-m', end: 'j-b' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c1', start: 'j-c', end: 'j-n' },
			{ id: 'wall-c2', start: 'j-n', end: 'j-p' },
			{ id: 'wall-c2b', start: 'j-p', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{ id: 'wall-e', start: 'j-m', end: 'j-n' },
			{ id: 'wall-f', start: 'j-o', end: 'j-p' }
		]
	);
}

const LEFT_SPLIT_CANDIDATE = leftSplitCandidate();
const LEFT_SPLIT_EXTRACTION = extractBoundaryCandidateFaces({
	...LEFT_SPLIT_CANDIDATE,
	rooms: []
});
const LEFT_SPLIT_LEFT_A = LEFT_SPLIT_EXTRACTION.faces.find((face) =>
	face.boundary.some((ref) => ref.wallId === 'wall-a1')
)!;
const LEFT_SPLIT_LEFT_B = LEFT_SPLIT_EXTRACTION.faces.find((face) =>
	face.boundary.some((ref) => ref.wallId === 'wall-a1b')
)!;

const PORTAL_DOOR = {
	id: 'door-shared',
	wallId: 'wall-e',
	kind: 'door' as const,
	offset: 1,
	width: 0.9,
	height: 2.1,
	sillHeight: 0,
	profile: 'rectangular' as const,
	connectsRoomIds: ['room-left', 'room-right'] as [string, string]
};

function twoRoomBaselineWithPortal(openings = [PORTAL_DOOR]): LayoutDocumentWallFirst {
	return {
		...SPLIT_CANDIDATE,
		rooms: [
			room('room-left', 'Left', SPLIT_LEFT_FACE.boundary.map((ref) => ({ ...ref }))),
			room('room-right', 'Right', SPLIT_RIGHT_FACE.boundary.map((ref) => ({ ...ref })))
		],
		openings: openings.map((opening) => ({ ...opening }))
	};
}

describe('Room reconciliation — split-side portal remap (P23.3 step 0)', () => {
	it('maps a split relation side to the descendant adjacent to the hosting Wall, not the ID survivor', () => {
		const baseline = twoRoomBaselineWithPortal();
		const result = reconcileRooms({
			baseline,
			candidateDocument: { ...LEFT_SPLIT_CANDIDATE, openings: baseline.openings },
			extraction: LEFT_SPLIT_EXTRACTION,
			components: [
				{
					candidateFaceKeys: [LEFT_SPLIT_LEFT_A.key, LEFT_SPLIT_LEFT_B.key],
					predecessorRoomIds: ['room-left']
				},
				{ candidateFaceKeys: [SPLIT_RIGHT_FACE.key], predecessorRoomIds: ['room-right'] }
			],
			predecessorPolygons: new Map([['room-left', [[0, 0], [3, 0], [3, 4], [0, 4]]]]),
			// Witness in the far half pins leftA as the survivor, so the
			// predecessor ID stays on the half that does NOT touch wall-e.
			predecessorWitnesses: new Map([['room-left', [0.5, 2]]]),
			allocator: allocator()
		});
		if (!('document' in result)) throw new Error('expected success');
		expect(result.retiredRoomIds).toEqual([]);
		const survivor = result.document.rooms.find((entry) => entry.id === 'room-left')!;
		expect(survivor.boundary).toEqual(
			LEFT_SPLIT_LEFT_A.boundary.map((ref) => ({ ...ref }))
		);
		const newborn = result.document.rooms.find(
			(entry) => entry.id !== 'room-left' && entry.id !== 'room-right'
		)!;
		expect(newborn.boundary.some((ref) => ref.wallId === 'wall-e')).toBe(true);
		expect(survivor.boundary.some((ref) => ref.wallId === 'wall-e')).toBe(false);
		// Relation follows physical adjacency: the door opens into the new child.
		expect(result.document.openings[0]!.connectsRoomIds).toEqual([
			newborn.id,
			'room-right'
		]);
	});

	it('keeps the relation on the survivor when the survivor is the adjacent descendant', () => {
		const baseline = twoRoomBaselineWithPortal();
		const result = reconcileRooms({
			baseline,
			candidateDocument: { ...LEFT_SPLIT_CANDIDATE, openings: baseline.openings },
			extraction: LEFT_SPLIT_EXTRACTION,
			components: [
				{
					candidateFaceKeys: [LEFT_SPLIT_LEFT_A.key, LEFT_SPLIT_LEFT_B.key],
					predecessorRoomIds: ['room-left']
				},
				{ candidateFaceKeys: [SPLIT_RIGHT_FACE.key], predecessorRoomIds: ['room-right'] }
			],
			predecessorPolygons: new Map([['room-left', [[0, 0], [3, 0], [3, 4], [0, 4]]]]),
			// Witness in the wall-e-adjacent half keeps the ID there.
			predecessorWitnesses: new Map([['room-left', [2.5, 2]]]),
			allocator: allocator()
		});
		if (!('document' in result)) throw new Error('expected success');
		const survivor = result.document.rooms.find((entry) => entry.id === 'room-left')!;
		expect(survivor.boundary).toEqual(
			LEFT_SPLIT_LEFT_B.boundary.map((ref) => ({ ...ref }))
		);
		expect(result.document.openings[0]!.connectsRoomIds).toEqual([
			'room-left',
			'room-right'
		]);
	});

	it('rejects the topology edit when no descendant is adjacent to the hosting Wall', () => {
		// Far rectangle (x∈[20,26]) split at x=23 with a stale, nonadjacent
		// legacy relation hosted on wall-e: wall-side lineage names no unique
		// descendant for the split side → reject, never guess.
		const farJunctions: Array<[string, number, number]> = [
			['j-p', 20, 0],
			['j-r', 26, 0],
			['j-s', 26, 4],
			['j-u', 20, 4]
		];
		const farWalls: WallSeed[] = [
			{ id: 'wall-p', start: 'j-p', end: 'j-r' },
			{ id: 'wall-q', start: 'j-r', end: 'j-s' },
			{ id: 'wall-r', start: 'j-s', end: 'j-u' },
			{ id: 'wall-s', start: 'j-u', end: 'j-p' }
		];
		const farFace = extractBoundaryCandidateFaces({
			...document(farJunctions, farWalls),
			rooms: []
		}).faces[0]!;
		const candidate = document(
			[
				...twoRoomCandidate().junctions.map(
					(junction) => [junction.id, junction.point[0], junction.point[1]] as [string, number, number]
				),
				['j-p', 20, 0],
				['j-v', 23, 0],
				['j-r', 26, 0],
				['j-s', 26, 4],
				['j-w', 23, 4],
				['j-u', 20, 4]
			],
			[
				...twoRoomCandidate().walls.map((wall) => ({
					id: wall.id,
					start: wall.startJunctionId,
					end: wall.endJunctionId
				})),
				{ id: 'wall-p', start: 'j-p', end: 'j-v' },
				{ id: 'wall-p2', start: 'j-v', end: 'j-r' },
				{ id: 'wall-q', start: 'j-r', end: 'j-s' },
				{ id: 'wall-r', start: 'j-s', end: 'j-w' },
				{ id: 'wall-r2', start: 'j-w', end: 'j-u' },
				{ id: 'wall-t', start: 'j-v', end: 'j-w' },
				{ id: 'wall-s', start: 'j-u', end: 'j-p' }
			]
		);
		const extraction = extractBoundaryCandidateFaces({ ...candidate, rooms: [] });
		expect(extraction.faces).toHaveLength(4);
		const faceByWall = (wallId: string) =>
			extraction.faces.find((face) => face.boundary.some((ref) => ref.wallId === wallId))!;
		const farA = extraction.faces.find((face) =>
			face.boundary.some((ref) => ref.wallId === 'wall-p')
		)!;
		const farB = faceByWall('wall-p2');
		const baseline: LayoutDocumentWallFirst = {
			...candidate,
			rooms: [
				room('room-left', 'Left', SPLIT_LEFT_FACE.boundary.map((ref) => ({ ...ref }))),
				room('room-right', 'Right', SPLIT_RIGHT_FACE.boundary.map((ref) => ({ ...ref }))),
				room('room-far', 'Far', farFace.boundary.map((ref) => ({ ...ref })))
			],
			openings: [
				{
					...PORTAL_DOOR,
					connectsRoomIds: ['room-left', 'room-far']
				}
			]
		};
		const result = reconcileRooms({
			baseline,
			candidateDocument: { ...candidate, openings: baseline.openings },
			extraction,
			components: [
				{ candidateFaceKeys: [faceByWall('wall-a1').key], predecessorRoomIds: ['room-left'] },
				{ candidateFaceKeys: [faceByWall('wall-a2').key], predecessorRoomIds: ['room-right'] },
				{ candidateFaceKeys: [farA.key, farB.key], predecessorRoomIds: ['room-far'] }
			],
			predecessorWitnesses: new Map([['room-far', [20.5, 2]]]),
			allocator: allocator()
		});
		expect(result).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({ code: 'unresolved_portal_remap' })
		});
	});
});
