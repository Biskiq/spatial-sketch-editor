/**
 * SP1d — the open-side handles' canonical planners.
 *
 * These are real-planner regressions over the authored document: a mid-grip
 * moves both virtual-edge end Junctions square to the side, an end knob slides
 * into its adjoining Wall and splits it with the canonical noder, and both
 * journeys keep the Space's id/name, use deterministic captured ids and reach
 * Save. Overlap and containment are refused by the same placement gate every
 * other Layout writer uses, and a refusal never mutates the baseline.
 */
import { describe, expect, it } from 'vitest';

import {
	allocateCapturedId,
	createEmptyWallFirstLayoutDocument,
	parseWallFirstLayoutDocumentJson,
	planSpaceOpenSideEndSlide,
	planSpaceOpenSideOffset,
	planWallSegment,
	roomBoundaryPolygon,
	serializeWallFirstLayoutDocument,
	spaceOpenSideFrame,
	spaceOpenSideFrames,
	spaceOutlineSignedArea,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutVec2,
	type NodingIdAllocator
} from '@portfolio/layout-core';

import { captureFor } from './__fixtures__/layout-id-capture';

function wall(id: string, start: string, end: string): LayoutDocumentWallFirst['walls'][number] {
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		thickness: 0.2,
		height: 3,
		centerline: { kind: 'line' }
	};
}

function junction(id: string, point: LayoutVec2): LayoutDocumentWallFirst['junctions'][number] {
	return { id, point };
}

/**
 * A 4×3 open Space whose open side is D(0,3)→A(0,0) (normal +X), plus a small
 * enclosed free-standing Room at (-2..-1, 1..2) outside it.
 */
function openSpaceWithOutsideRoom(): LayoutDocumentWallFirst {
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: [
			junction('j-a', [0, 0]),
			junction('j-b', [4, 0]),
			junction('j-c', [4, 3]),
			junction('j-d', [0, 3]),
			junction('j-e', [-2, 1]),
			junction('j-f', [-1, 1]),
			junction('j-g', [-1, 2]),
			junction('j-h', [-2, 2])
		],
		walls: [
			wall('wall-a', 'j-a', 'j-b'),
			wall('wall-b', 'j-b', 'j-c'),
			wall('wall-c', 'j-c', 'j-d'),
			wall('outside-s', 'j-e', 'j-f'),
			wall('outside-e', 'j-f', 'j-g'),
			wall('outside-n', 'j-g', 'j-h'),
			wall('outside-w', 'j-h', 'j-e')
		],
		rooms: [
			{
				id: 'room-open',
				name: 'Gallery',
				boundary: [
					{ wallId: 'wall-a', direction: 'forward' },
					{ wallId: 'wall-b', direction: 'forward' },
					{ wallId: 'wall-c', direction: 'forward' }
				],
				virtualEdges: [{ startJunctionId: 'j-d', endJunctionId: 'j-a' }],
				overhead: 'closed',
			},
			{
				id: 'room-booth',
				name: 'Booth',
				boundary: [
					{ wallId: 'outside-s', direction: 'forward' },
					{ wallId: 'outside-e', direction: 'forward' },
					{ wallId: 'outside-n', direction: 'forward' },
					{ wallId: 'outside-w', direction: 'forward' }
				],
				virtualEdges: [],
				overhead: 'closed',
			}
		]
	};
}

function capturedAllocator(capture: LayoutIdCapture): NodingIdAllocator {
	return {
		nextWallId(document, seed) {
			return allocateCapturedId(new Set(document.walls.map((entry) => entry.id)), seed, capture);
		},
		nextJunctionId(document, seed) {
			return allocateCapturedId(new Set(document.junctions.map((entry) => entry.id)), seed, capture);
		}
	};
}

function area(document: LayoutDocumentWallFirst, roomId: string): number {
	const polygon = roomBoundaryPolygon(document, roomId);
	if (polygon === null) throw new Error(`no composed polygon for ${roomId}`);
	return spaceOutlineSignedArea(polygon);
}

describe('SP1d — open-side frames', () => {
	it('reads the one composed side, its normal and both adjoining Walls', () => {
		const document = openSpaceWithOutsideRoom();
		const frames = spaceOpenSideFrames(document, 'room-open');
		expect(frames).toHaveLength(1);
		const frame = frames[0]!;
		expect(frame.startJunctionId).toBe('j-d');
		expect(frame.endJunctionId).toBe('j-a');
		expect(frame.midpoint).toEqual([0, 1.5]);
		expect(frame.length).toBe(3);
		expect(frame.normal[0]).toBeCloseTo(1, 9);
		expect(frame.normal[1]).toBeCloseTo(0, 9);
		expect(frame.startWall).toMatchObject({ wallId: 'wall-c', direction: 'forward' });
		expect(frame.endWall).toMatchObject({ wallId: 'wall-a', direction: 'forward' });
		expect(spaceOpenSideFrame(document, 'room-open', 'j-a', 'j-d')).toBeNull();
	});

	it('offers no Wall end where two virtual edges meet', () => {
		const document = openSpaceWithOutsideRoom();
		document.walls = [document.walls[0]!];
		document.rooms = [
			{
				...document.rooms[0]!,
				boundary: [{ wallId: 'wall-a', direction: 'forward' }],
				virtualEdges: [
					{ startJunctionId: 'j-b', endJunctionId: 'j-c' },
					{ startJunctionId: 'j-c', endJunctionId: 'j-d' },
					{ startJunctionId: 'j-d', endJunctionId: 'j-a' }
				]
			}
		];
		const frames = spaceOpenSideFrames(document, 'room-open');
		expect(frames.find((frame) => frame.startJunctionId === 'j-b')).toMatchObject({
			startWall: { wallId: 'wall-a' },
			endWall: null
		});
		expect(frames.find((frame) => frame.startJunctionId === 'j-c')).toMatchObject({
			startWall: null,
			endWall: null
		});
		expect(frames.find((frame) => frame.startJunctionId === 'j-d')).toMatchObject({
			startWall: null,
			endWall: { wallId: 'wall-a' }
		});
	});
});

describe('SP1d — mid-grip offset', () => {
	it('moves both end Junctions square to the side and preserves the Space', () => {
		const document = openSpaceWithOutsideRoom();
		const baseline = serializeWallFirstLayoutDocument(document);
		const plan = planSpaceOpenSideOffset(document, 'room-open', 'j-d', 'j-a', 0.5);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const room = plan.document.rooms.find((entry) => entry.id === 'room-open')!;
		expect(room.name).toBe('Gallery');
		expect(room.virtualEdges).toEqual([{ startJunctionId: 'j-d', endJunctionId: 'j-a' }]);
		expect(room.boundary).toEqual(document.rooms[0]!.boundary);
		expect(plan.document.junctions.find((entry) => entry.id === 'j-d')!.point).toEqual([0.5, 3]);
		expect(plan.document.junctions.find((entry) => entry.id === 'j-a')!.point).toEqual([0.5, 0]);
		expect(plan.changedJunctionIds).toEqual(['j-d', 'j-a']);
		expect(area(plan.document, 'room-open')).toBeCloseTo(10.5, 9);
		// Nothing was allocated: a second identical drag is byte-identical.
		const again = planSpaceOpenSideOffset(document, 'room-open', 'j-d', 'j-a', 0.5);
		expect(again.kind).toBe('success');
		if (again.kind !== 'success') return;
		expect(serializeWallFirstLayoutDocument(again.document)).toBe(
			serializeWallFirstLayoutDocument(plan.document)
		);
		// The planner is pure: the baseline is untouched.
		expect(serializeWallFirstLayoutDocument(document)).toBe(baseline);
	});

	it('refuses an overlap and a containment with the other Space named', () => {
		const document = openSpaceWithOutsideRoom();
		const baseline = serializeWallFirstLayoutDocument(document);
		const overlap = planSpaceOpenSideOffset(document, 'room-open', 'j-d', 'j-a', -1.5);
		expect(overlap.kind).toBe('rejected');
		if (overlap.kind === 'rejected') {
			expect(overlap.rejection.code).toBe('space_overlap');
			expect(overlap.rejection.targetIds).toEqual(
				expect.arrayContaining(['room-open', 'room-booth'])
			);
			expect(overlap.rejection.message).toContain('Booth');
		}
		const contained = planSpaceOpenSideOffset(document, 'room-open', 'j-d', 'j-a', -3);
		expect(contained.kind).toBe('rejected');
		if (contained.kind === 'rejected') {
			expect(contained.rejection.code).toBe('space_contains_space');
			expect(contained.rejection.targetIds).toEqual(
				expect.arrayContaining(['room-open', 'room-booth'])
			);
		}
		expect(serializeWallFirstLayoutDocument(document)).toBe(baseline);
	});

	it('refuses a fold and never silently clamps', () => {
		const document = openSpaceWithOutsideRoom();
		const plan = planSpaceOpenSideOffset(document, 'room-open', 'j-d', 'j-a', 4.5);
		expect(plan.kind).toBe('rejected');
		if (plan.kind === 'rejected') {
			expect(['space_outline_invalid', 'room_identity_lost', 'geometry_invalid']).toContain(
				plan.rejection.code
			);
		}
		expect(serializeWallFirstLayoutDocument(document)).toBe(
			serializeWallFirstLayoutDocument(openSpaceWithOutsideRoom())
		);
	});
});

describe('SP1d — end-knob slide and split at release', () => {
	it('splits the adjoining Wall, drops the stub and re-points the open side', () => {
		const document = openSpaceWithOutsideRoom();
		const capture = captureFor('sp1d-slide-end');
		const plan = planSpaceOpenSideEndSlide(
			document,
			'room-open',
			'j-d',
			'j-a',
			'end',
			'wall-a',
			1.5,
			[1.5, 0],
			capturedAllocator(capture)
		);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const room = plan.document.rooms.find((entry) => entry.id === 'room-open')!;
		expect(room.name).toBe('Gallery');
		expect(room.virtualEdges).toEqual([
			{ startJunctionId: 'j-d', endJunctionId: plan.splitJunctionId }
		]);
		expect(room.boundary.some((ref) => ref.wallId === plan.stubWallId)).toBe(false);
		expect(room.boundary.some((ref) => ref.wallId === plan.keptWallId)).toBe(true);
		const split = plan.document.junctions.find((entry) => entry.id === plan.splitJunctionId)!;
		expect(split.point[0]).toBeCloseTo(1.5, 9);
		expect(split.point[1]).toBeCloseTo(0, 9);
		// The old corner is still a Junction, on the released stub.
		expect(plan.document.junctions.some((entry) => entry.id === 'j-a')).toBe(true);
		const stub = plan.document.walls.find((entry) => entry.id === plan.stubWallId)!;
		expect([stub.startJunctionId, stub.endJunctionId]).toEqual(
			expect.arrayContaining(['j-a', plan.splitJunctionId])
		);
		expect(plan.createdWallIds).toContain(plan.stubWallId === 'wall-a' ? plan.keptWallId : plan.stubWallId);
		expect(area(plan.document, 'room-open')).toBeCloseTo(9.75, 9);
		expect(plan.document.rooms.map((entry) => entry.id).sort()).toEqual(['room-booth', 'room-open']);
	});

	it('splits at the start knob onto the previous Wall', () => {
		const document = openSpaceWithOutsideRoom();
		const plan = planSpaceOpenSideEndSlide(
			document,
			'room-open',
			'j-d',
			'j-a',
			'start',
			'wall-c',
			2.5,
			[1.5, 3],
			capturedAllocator(captureFor('sp1d-slide-start'))
		);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const room = plan.document.rooms.find((entry) => entry.id === 'room-open')!;
		expect(room.virtualEdges).toEqual([
			{ startJunctionId: plan.splitJunctionId, endJunctionId: 'j-a' }
		]);
		expect(room.boundary.some((ref) => ref.wallId === plan.stubWallId)).toBe(false);
		expect(plan.document.junctions.some((entry) => entry.id === 'j-d')).toBe(true);
		expect(area(plan.document, 'room-open')).toBeCloseTo(9.75, 9);
	});

	it('replays the same captured ids and reaches Save byte-identically', () => {
		const document = openSpaceWithOutsideRoom();
		const first = planSpaceOpenSideEndSlide(
			document,
			'room-open',
			'j-d',
			'j-a',
			'end',
			'wall-a',
			1.5,
			[1.5, 0],
			capturedAllocator(captureFor('sp1d-slide-replay'))
		);
		if (first.kind !== 'success') throw new Error('the first slide did not plan');
		const json = serializeWallFirstLayoutDocument(first.document);
		const replay = planSpaceOpenSideEndSlide(
			document,
			'room-open',
			'j-d',
			'j-a',
			'end',
			'wall-a',
			1.5,
			[1.5, 0],
			capturedAllocator(captureFor('sp1d-slide-replay'))
		);
		if (replay.kind !== 'success') throw new Error('the replay did not plan');
		expect(replay.splitJunctionId).toBe(first.splitJunctionId);
		expect(replay.stubWallId).toBe(first.stubWallId);
		expect(replay.keptWallId).toBe(first.keptWallId);
		expect(serializeWallFirstLayoutDocument(replay.document)).toBe(json);

		const reopened = parseWallFirstLayoutDocumentJson(json);
		expect(reopened.success).toBe(true);
		if (!reopened.success) return;
		expect(serializeWallFirstLayoutDocument(reopened.document)).toBe(json);
		const reopenedRoom = reopened.document.rooms.find((room) => room.id === 'room-open')!;
		expect(reopenedRoom.virtualEdges).toEqual([
			{ startJunctionId: 'j-d', endJunctionId: first.splitJunctionId }
		]);
	});

	it('refuses a station outside the Wall', () => {
		const document = openSpaceWithOutsideRoom();
		const outside = planSpaceOpenSideEndSlide(
			document,
			'room-open',
			'j-d',
			'j-a',
			'end',
			'wall-a',
			5,
			[5, 0],
			capturedAllocator(captureFor('sp1d-slide-outside'))
		);
		expect(outside.kind).toBe('rejected');
		if (outside.kind === 'rejected') {
			expect(outside.rejection.code).toBe('split_distance_out_of_range');
		}
	});

	it('derives a straight split from its station, never a stray caller point', () => {
		const plan = planSpaceOpenSideEndSlide(
			openSpaceWithOutsideRoom(),
			'room-open',
			'j-d',
			'j-a',
			'end',
			'wall-a',
			1.5,
			[5, 0],
			capturedAllocator(captureFor('sp1d-slide-stray-point'))
		);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.junctions.find((entry) => entry.id === plan.splitJunctionId)!.point).toEqual([
			1.5, 0
		]);
	});

	it('refuses to release a stub that still hosts an Opening', () => {
		const document = openSpaceWithOutsideRoom();
		document.openings = [
			{
				id: 'door-stub',
				wallId: 'wall-a',
				kind: 'door',
				offset: 0.5,
				width: 0.6,
				height: 2,
				sillHeight: 0,
				profile: 'rectangular'
			}
		];
		const plan = planSpaceOpenSideEndSlide(
			document,
			'room-open',
			'j-d',
			'j-a',
			'end',
			'wall-a',
			1.5,
			[1.5, 0],
			capturedAllocator(captureFor('sp1d-slide-stub-opening'))
		);
		expect(plan.kind).toBe('rejected');
		if (plan.kind === 'rejected') {
			expect(plan.rejection.code).toBe('opening_on_released_stub');
			expect(plan.rejection.targetIds).toEqual(expect.arrayContaining(['door-stub']));
		}
	});
});

describe('SP1d — partial-Wall absorption', () => {
	function absorb(from: LayoutVec2, to: LayoutVec2, captureName: string) {
		const document = openSpaceWithOutsideRoom();
		const plan = planWallSegment({
			baseline: document,
			start: from,
			end: to,
			capture: captureFor(captureName),
			levelId: document.floor.id,
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: from[1] === 0 ? 'j-a' : 'j-d' }]
		});
		return { document, plan };
	}

	it('absorbs a Wall from the end knob orientation and shortens the open side', () => {
		const { plan } = absorb([0, 0], [0, 1.5], 'sp1d-absorb-end');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.absorbedRoomIds).toEqual(['room-open']);
		const room = plan.document.rooms.find((entry) => entry.id === 'room-open')!;
		expect(room).toMatchObject({ name: 'Gallery', overhead: 'closed' });
		expect(room.virtualEdges).toHaveLength(1);
		const remaining = room.virtualEdges[0]!;
		expect(remaining.startJunctionId).toBe('j-d');
		expect(plan.document.junctions.find((entry) => entry.id === remaining.endJunctionId)!.point).toEqual([0, 1.5]);
		const newWallId = plan.createdWallIds[0]!;
		const newWall = plan.document.walls.find((wall) => wall.id === newWallId);
		expect(newWall).toBeDefined();
		expect(newWall!.centerline).toEqual({ kind: 'line' });
		expect(room.boundary.map((ref) => ref.wallId)).toContain(newWallId);
		expect(area(plan.document, 'room-open')).toBeCloseTo(12, 9);
		const json = serializeWallFirstLayoutDocument(plan.document);
		const reopened = parseWallFirstLayoutDocumentJson(json);
		expect(reopened.success).toBe(true);
		if (!reopened.success) return;
		expect(serializeWallFirstLayoutDocument(reopened.document)).toBe(json);
		expect(reopened.document.rooms.find((entry) => entry.id === 'room-open')!.virtualEdges).toEqual(
			room.virtualEdges
		);
		const replay = absorb([0, 0], [0, 1.5], 'sp1d-absorb-end');
		expect(replay.plan.kind).toBe('success');
		if (replay.plan.kind !== 'success') return;
		expect(serializeWallFirstLayoutDocument(replay.plan.document)).toBe(json);
	});

	it('absorbs from the start-knob orientation with the other virtual direction', () => {
		const { plan } = absorb([0, 3], [0, 1.5], 'sp1d-absorb-start');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.absorbedRoomIds).toEqual(['room-open']);
		const room = plan.document.rooms.find((entry) => entry.id === 'room-open')!;
		expect(room.virtualEdges).toHaveLength(1);
		const remaining = room.virtualEdges[0]!;
		expect(remaining.endJunctionId).toBe('j-a');
		expect(plan.document.junctions.find((entry) => entry.id === remaining.startJunctionId)!.point).toEqual([0, 1.5]);
		expect(room.boundary).toHaveLength(4);
		expect(room.boundary.map((ref) => ref.wallId)).toContain(plan.createdWallIds[0]);
		expect(area(plan.document, 'room-open')).toBeCloseTo(12, 9);
	});

	it('leaves a non-collinear stroke free-standing and the Space unchanged', () => {
		const { document, plan } = absorb([0, 0], [0.2, 1.5], 'sp1d-absorb-free');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.absorbedRoomIds).toEqual([]);
		const room = plan.document.rooms.find((entry) => entry.id === 'room-open')!;
		expect(room.virtualEdges).toEqual(document.rooms[0]!.virtualEdges);
		expect(room.boundary).toEqual(document.rooms[0]!.boundary);
	});
});
