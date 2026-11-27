/**
 * T1 A5 — the copy-enclosure Room duplicate, core only.
 *
 * The contract pinned here:
 *
 * 1. a Room whose boundary Wall is shared with another Room duplicates: the
 *    copy owns a private copy of every boundary Wall, Junction and Opening and
 *    the source architecture is byte-identical where the copy does not touch it;
 * 2. a door relation that names a Room outside the copy is dropped from the
 *    copied Opening and reported once, while the source relation survives;
 * 3. a stationary Wall at a boundary Junction is left behind, never copied and
 *    never a refusal;
 * 4. the retained A4 refusals still hold for their own subjects (read-only
 *    profile objects and unresolved boundaries), and the A4 isolated planner
 *    still refuses its shared-boundary case;
 * 5. a Room with no door relation reports none.
 */
import { describe, expect, it } from 'vitest';

import { extractBoundaryCandidateFaces, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION, type LayoutDocumentWallFirst, type LayoutWallFirstRoom } from '@portfolio/layout-core/wall';
import { planDuplicateIsolatedRoom, planDuplicateRoom } from '@portfolio/layout-core/plan';

import { capturedId, freshCapture } from './__fixtures__/layout-id-capture';

function roomFromFace(
	id: string,
	name: string,
	face: ReturnType<typeof extractBoundaryCandidateFaces>['faces'][number]
): LayoutWallFirstRoom {
	return {
		id,
		name,
		boundary: face.boundary.map((ref) => ({ ...ref })),
		virtualEdges: [], overhead: 'closed',
	};
}

/**
 * Two 3×4 Rooms sharing the party Wall `wall-e`. The optional door sits on the
 * party Wall and joins the two Rooms.
 */
function sharedWallDocument(withDoor = false): LayoutDocumentWallFirst {
	const base: LayoutDocumentWallFirst = {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0.5 },
		junctions: [
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-m', point: [3, 0] },
			{ id: 'j-b', point: [6, 0] },
			{ id: 'j-c', point: [6, 4] },
			{ id: 'j-n', point: [3, 4] },
			{ id: 'j-d', point: [0, 4] }
		],
		walls: [
			{ id: 'wall-a1', startJunctionId: 'j-a', endJunctionId: 'j-m', thickness: 0.2, height: 3,
			top: { kind: 'level' }, centerline: { kind: 'line' } },
			{ id: 'wall-a2', startJunctionId: 'j-m', endJunctionId: 'j-b', thickness: 0.2, height: 3,
			top: { kind: 'level' }, centerline: { kind: 'line' } },
			{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', thickness: 0.2, height: 3,
			top: { kind: 'level' }, centerline: { kind: 'line' } },
			{ id: 'wall-c1', startJunctionId: 'j-c', endJunctionId: 'j-n', thickness: 0.2, height: 3,
			top: { kind: 'level' }, centerline: { kind: 'line' } },
			{ id: 'wall-c2', startJunctionId: 'j-n', endJunctionId: 'j-d', thickness: 0.2, height: 3,
			top: { kind: 'level' }, centerline: { kind: 'line' } },
			{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', thickness: 0.2, height: 3,
			top: { kind: 'level' }, centerline: { kind: 'line' } },
			{ id: 'wall-e', startJunctionId: 'j-m', endJunctionId: 'j-n', thickness: 0.2, height: 3,
			top: { kind: 'level' }, centerline: { kind: 'line' }, name: 'Party wall' }
		],
		rooms: [],
		openings: withDoor
			? [
					{
						id: 'opening:door:1',
						wallId: 'wall-e',
						kind: 'door',
						name: 'Shared door',
						offset: 1,
						width: 0.9,
						height: 2.1,
						sillHeight: 0,
						profile: 'rectangular',
						connectsRoomIds: ['room-left', 'room-right']
					}
				]
			: [],
		objects: [],
		regions: []
	};
	const extraction = extractBoundaryCandidateFaces(base);
	const left = extraction.faces.find((candidate) =>
		candidate.boundary.some((ref) => ref.wallId === 'wall-a1')
	)!;
	const right = extraction.faces.find((candidate) =>
		candidate.boundary.some((ref) => ref.wallId === 'wall-a2')
	)!;
	return {
		...base,
		rooms: [roomFromFace('room-left', 'Left', left), roomFromFace('room-right', 'Right', right)]
	};
}

function success(plan: ReturnType<typeof planDuplicateRoom>) {
	if (plan.kind !== 'success') throw new Error(`expected success, got ${plan.rejection.code}`);
	return plan;
}

function rejection(plan: ReturnType<typeof planDuplicateRoom>) {
	if (plan.kind !== 'rejected') throw new Error('expected a rejection');
	return plan.rejection;
}

describe('T1 A5 — Duplicate any Room as a free island', () => {
	it('[cap:layout.room-duplicate core] copies a shared-Wall Room privately and leaves the source shared Wall in place', () => {
		const source = sharedWallDocument();
		const capture = freshCapture();
		const before = JSON.stringify(source);

		const plan = success(planDuplicateRoom(source, { roomId: 'room-left', delta: [10, 0] }, capture, source.floor.id));

		// The source document is untouched: same ids, same party Wall, same Rooms.
		expect(JSON.stringify(source)).toBe(before);
		const sourceRooms = plan.document.rooms.filter((room) => !room.id.includes('-copy'));
		expect(sourceRooms).toHaveLength(2);
		expect(sourceRooms.every((room) => room.boundary.some((ref) => ref.wallId === 'wall-e'))).toBe(true);
		expect(plan.document.walls.filter((wall) => wall.id === 'wall-e')).toHaveLength(1);

		// The copy owns a private Wall for every boundary Wall, including the party Wall.
		expect([...plan.createdWallIds].sort()).toEqual(
			['wall-a1', 'wall-e', 'wall-c2', 'wall-d']
				.map((id) => capturedId(capture, `${id}-copy`))
				.sort()
		);
		expect(plan.createdJunctionIds).toHaveLength(4);
		expect(plan.createdRoomId).toBe(capturedId(capture, 'room-left-copy'));
		const copy = plan.document.rooms.find((room) => room.id === plan.createdRoomId)!;
		expect(copy.name).toBe('Left copy');
		expect(copy.boundary.map((ref) => ref.wallId).sort()).toEqual([...plan.createdWallIds].sort());
		// The party Wall copy is a distinct id at the translated position.
		const partyCopy = plan.document.walls.find(
			(wall) => wall.id === capturedId(capture, 'wall-e-copy')
		)!;
		expect(partyCopy.startJunctionId).toBe(capturedId(capture, 'j-m-copy'));
		const start = plan.document.junctions.find(
			(junction) => junction.id === partyCopy.startJunctionId
		)!;
		expect(start.point).toEqual([13, 0]);
	});

	it('[cap:layout.room-duplicate edge] copies the Door without its outside relation and reports the dropped relation', () => {
		const source = sharedWallDocument(true);
		const capture = freshCapture();
		const plan = success(planDuplicateRoom(source, { roomId: 'room-left', delta: [10, 0] }, capture, source.floor.id));

		expect(plan.droppedRoomRelations).toEqual([
			{ openingId: 'opening:door:1', roomIds: ['room-left', 'room-right'] }
		]);
		const copiedDoor = plan.document.openings.find(
			(opening) => opening.id === capturedId(capture, 'opening:door:1-copy')
		)!;
		expect(copiedDoor).toMatchObject({
			wallId: capturedId(capture, 'wall-e-copy'),
			kind: 'door',
			name: 'Shared door',
			offset: 1,
			width: 0.9,
			height: 2.1,
			sillHeight: 0,
			profile: 'rectangular'
		});
		expect(copiedDoor.connectsRoomIds).toBeUndefined();
		// The source door and its relation are untouched.
		expect(plan.document.openings.find((opening) => opening.id === 'opening:door:1')).toMatchObject({
			wallId: 'wall-e',
			connectsRoomIds: ['room-left', 'room-right']
		});
	});

	it('leaves a stationary Wall at a boundary Junction behind instead of refusing', () => {
		const base = sharedWallDocument();
		const withStub: LayoutDocumentWallFirst = {
			...base,
			junctions: [...base.junctions, { id: 'j-t', point: [3, -3] as LayoutVec2 }],
			walls: [
				...base.walls,
				{
					id: 'wall-stub',
					startJunctionId: 'j-m',
					endJunctionId: 'j-t',
					thickness: 0.2,
					height: 3,
					top: { kind: 'level' },
					centerline: { kind: 'line' }
				}
			]
		};
		const capture = freshCapture();
		const plan = success(planDuplicateRoom(withStub, { roomId: 'room-left', delta: [10, 0] }, capture, withStub.floor.id));
		expect(plan.createdWallIds).not.toContain(capturedId(capture, 'wall-stub-copy'));
		expect(plan.document.walls.filter((wall) => wall.id === 'wall-stub')).toHaveLength(1);
		expect(plan.createdWallIds).toHaveLength(4);
	});

	it('reports no dropped relation when the Room has no door relation', () => {
		const source = sharedWallDocument();
		const plan = success(planDuplicateRoom(source, { roomId: 'room-left', delta: [10, 0] }, freshCapture(), source.floor.id));
		expect(plan.droppedRoomRelations).toEqual([]);
	});

	it('still refuses a read-only profile object and an unresolved boundary', () => {
		const source = sharedWallDocument();
		const withProfile: LayoutDocumentWallFirst = {
			...source,
			objects: [
				{
					id: 'obj-profile',
					kind: 'profile',
					position: [1, 0.5, 1],
					rotation: [0, 0, 0],
					dimensions: [1, 1, 1],
					roomId: 'room-left'
				}
			]
		};
		expect(rejection(planDuplicateRoom(withProfile, { roomId: 'room-left', delta: [10, 0] }, freshCapture(), withProfile.floor.id)).code).toBe(
			'profile_object_read_only'
		);

		const missing: LayoutDocumentWallFirst = {
			...source,
			walls: source.walls.filter((wall) => wall.id !== 'wall-d')
		};
		expect(rejection(planDuplicateRoom(missing, { roomId: 'room-left', delta: [10, 0] }, freshCapture(), missing.floor.id)).code).toBe(
			'invalid_reference'
		);
	});

	it('keeps A4’s isolated planner refusing the shared-boundary Room', () => {
		const source = sharedWallDocument();
		expect(
			rejection(planDuplicateIsolatedRoom(source, { roomId: 'room-left', delta: [10, 0] }, freshCapture(), source.floor.id)).code
		).toBe('room_not_isolated');
	});

	it('derives every created id from the captured nonce, deterministically', () => {
		const source = sharedWallDocument(true);
		const first = success(planDuplicateRoom(source, { roomId: 'room-left', delta: [10, 0] }, freshCapture(), source.floor.id));
		const second = success(planDuplicateRoom(source, { roomId: 'room-left', delta: [10, 0] }, freshCapture(), source.floor.id));
		expect(first.createdRoomId).not.toBe(second.createdRoomId);
		expect(first.createdWallIds).not.toEqual(second.createdWallIds);
		// One capture replays the same identities for Redo.
		const capture = freshCapture();
		const replayA = success(planDuplicateRoom(source, { roomId: 'room-left', delta: [10, 0] }, capture, source.floor.id));
		const replayB = success(planDuplicateRoom(source, { roomId: 'room-left', delta: [10, 0] }, capture, source.floor.id));
		expect(replayA.createdRoomId).toBe(replayB.createdRoomId);
		expect(replayA.createdWallIds).toEqual(replayB.createdWallIds);
	});
});
