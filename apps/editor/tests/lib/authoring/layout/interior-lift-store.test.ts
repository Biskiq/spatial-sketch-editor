/**
 * T1 X1 — the Lift reading is temporary shell state, and its entry scope is stated.
 *
 * The store is the whole of Lift's authored-side entailment: one scope, four
 * transitions, and nothing else. It holds no document, no history entry, no
 * Camera intent and no persistence — so the guarantees that matter are that the
 * transitions are exactly these, that a `setScope` while Lift is off cannot start
 * one by accident, and that the module offers no second channel through which a
 * scope could reach a document.
 *
 * `initialLiftScope` is pinned here too: it is the one rule that decides whether a
 * press lifts a Space or everything, and it must not depend on the Camera after
 * entry.
 */
import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '@portfolio/layout-core/geometry';

import {
	initialLiftScope,
	interiorLift,
	liftedSourcesNow
} from '$lib/authoring/layout/interior-lift-store.svelte';
import * as liftModule from '$lib/authoring/layout/interior-lift-store.svelte';
import {
	BETWEEN_ROOMS_POINT,
	FIRST_ROOM_STANDING_POINT,
	twoRoomGeometry
} from '../../layout/__fixtures__/two-room-fixture';

describe('T1 X1 — the Lift reading', () => {
	it('starts, narrows, widens, puts back and clears', () => {
		interiorLift.clear();
		expect(interiorLift.isActive()).toBe(false);
		expect(interiorLift.reading).toBeNull();

		interiorLift.lift({ kind: 'all' });
		expect(interiorLift.isActive()).toBe(true);
		expect(interiorLift.reading).toEqual({ scope: { kind: 'all' } });

		interiorLift.setScope({ kind: 'space', roomId: 'room-a' });
		expect(interiorLift.reading).toEqual({ scope: { kind: 'space', roomId: 'room-a' } });

		interiorLift.lift({ kind: 'all' });
		expect(interiorLift.reading).toEqual({ scope: { kind: 'all' } });

		interiorLift.putBack();
		expect(interiorLift.isActive()).toBe(false);

		interiorLift.lift({ kind: 'space', roomId: 'room-b' });
		interiorLift.clear();
		expect(interiorLift.isActive()).toBe(false);
	});

	it('cannot be started by a scope change while it is off', () => {
		interiorLift.clear();
		interiorLift.setScope({ kind: 'all' });
		expect(interiorLift.isActive()).toBe(false);
		expect(interiorLift.reading).toBeNull();
	});

	it('names Layout’s sources for the live scope, and none when Lift is off', () => {
		const geometry = twoRoomGeometry();
		const [first, second] = geometry.rooms;
		interiorLift.clear();
		expect(liftedSourcesNow(geometry)).toEqual([]);

		interiorLift.lift({ kind: 'all' });
		expect(liftedSourcesNow(geometry).map((source) => source.subject.id)).toEqual(
			[first!.roomId, second!.roomId].sort()
		);

		interiorLift.lift({ kind: 'space', roomId: second!.roomId });
		const scoped = liftedSourcesNow(geometry);
		expect(scoped.map((source) => source.subject.id)).toEqual([second!.roomId]);
		expect(scoped[0]!.elevation).toBe(second!.ceilingElevation);

		interiorLift.clear();
	});

	it('offers no second channel to a document, a history or a Camera', () => {
		// The module's surface is the store, the source accessor and the entry rule.
		// A document write, a history participant or a Camera port would have to
		// appear here, and this line is what refuses it.
		expect(Object.keys(liftModule).sort()).toEqual([
			'initialLiftScope',
			'interiorLift',
			'liftedSourcesNow'
		]);
	});
});

describe('T1 X1 — the scope a Lift starts with', () => {
	it('takes the selected Room, whatever the eye is looking from', () => {
		const geometry = twoRoomGeometry();
		const roomId = geometry.rooms[1]!.roomId;
		expect(
			initialLiftScope({
				selectedRoomId: roomId,
				reading: '3d',
				eye: [...BETWEEN_ROOMS_POINT],
				compiled: geometry
			})
		).toEqual({ kind: 'space', roomId });
	});

	it('takes the Room the eye is inside in 3D, and everything otherwise', () => {
		const geometry = twoRoomGeometry();
		const eye = [...FIRST_ROOM_STANDING_POINT] as [number, number, number];
		// Order-independent: the scope names the one Room whose floor contains the eye.
		const containing = geometry.rooms.filter((room) =>
			pointInPolygon([eye[0], eye[2]], room.floorPolygon)
		);
		expect(containing).toHaveLength(1);
		expect(
			initialLiftScope({ selectedRoomId: null, reading: '3d', eye, compiled: geometry })
		).toEqual({ kind: 'space', roomId: containing[0]!.roomId });

		// Between the two Rooms, and above the lids: no Room occupies the eye.
		for (const outside of [[...BETWEEN_ROOMS_POINT], [eye[0], 9, eye[2]]] as [number, number, number][]) {
			expect(
				initialLiftScope({ selectedRoomId: null, reading: '3d', eye: outside, compiled: geometry })
			).toEqual({ kind: 'all' });
		}

		// Plan has no eye to be occupied by.
		expect(
			initialLiftScope({ selectedRoomId: null, reading: 'plan', eye, compiled: geometry })
		).toEqual({ kind: 'all' });
		expect(
			initialLiftScope({ selectedRoomId: null, reading: '3d', eye: null, compiled: geometry })
		).toEqual({ kind: 'all' });
	});

	it('breaks a tie between two Rooms on the smallest id', () => {
		const geometry = twoRoomGeometry();
		const point: [number, number, number] = [...FIRST_ROOM_STANDING_POINT];
		const occupied = geometry.rooms.find((room) =>
			pointInPolygon([point[0], point[2]], room.floorPolygon)
		)!;
		// A second Room over the same ring, under a later id: both contain the eye.
		const extended = {
			...geometry,
			rooms: [
				...geometry.rooms,
				{ ...occupied, roomId: `${occupied.roomId}-z`, cacheKey: `${occupied.cacheKey}:overlap` }
			]
		};
		expect(
			initialLiftScope({ selectedRoomId: null, reading: '3d', eye: point, compiled: extended })
		).toEqual({ kind: 'space', roomId: occupied.roomId });
	});

	it('freezes what entry decided: the reading never re-derives it', () => {
		const geometry = twoRoomGeometry();
		const scope = initialLiftScope({
			selectedRoomId: null,
			reading: '3d',
			eye: [...FIRST_ROOM_STANDING_POINT],
			compiled: geometry
		});
		interiorLift.lift(scope);
		expect(interiorLift.reading?.scope).toEqual(scope);
		interiorLift.clear();
	});
});
