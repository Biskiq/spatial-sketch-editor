/**
 * T1 X1 — `overheadSourcesOf`, Layout's one statement of what a Lift lifts.
 *
 * The contract pinned here is deliberately small, because everything else about
 * Lift reads it:
 *
 * - one source per compiled Room, sorted by Room id, carrying that Room's own
 *   ceiling ring and elevation — never a second derivation;
 * - a Space scope returns exactly that Room's lid, and an unknown Room returns
 *   nothing rather than guessing;
 * - a Room with no usable ceiling ring contributes no source, so a caller cannot
 *   draw an outline around a degenerate polygon;
 * - the outline is a **copy**: a consumer that edits it cannot write the compiled
 *   geometry every other reader shares.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	overheadSourcesOf,
	type CompiledLayoutGeometry
} from '@portfolio/layout-core';

import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';

function compiled(): CompiledLayoutGeometry {
	return compileWallFirstLayoutGeometry(buildScaleFixture(SCALE_FIXTURE_SEEDS.small)).geometry;
}

describe('T1 X1 — overhead sources', () => {
	it('names one lid per compiled Room, sorted, with that Room’s own ring and elevation', () => {
		const geometry = compiled();
		expect(geometry.rooms.length).toBeGreaterThan(1);
		const sources = overheadSourcesOf(geometry, { kind: 'all' });

		expect(sources).toHaveLength(geometry.rooms.length);
		expect(sources.map((source) => source.key.roomId)).toEqual(
			geometry.rooms.map((room) => room.roomId).slice().sort((left, right) =>
				left < right ? -1 : left > right ? 1 : 0
			)
		);

		const roomById = new Map(geometry.rooms.map((room) => [room.roomId, room] as const));
		for (const source of sources) {
			const room = roomById.get(source.key.roomId)!;
			expect(source.key).toEqual({ kind: 'room-lid', roomId: room.roomId });
			// The lid is selected through its Room: one subject, never a ceiling
			// subject of its own.
			expect(source.subject).toEqual({ kind: 'room', id: room.roomId });
			expect(source.elevation).toBe(room.ceilingElevation);
			expect(source.outline).toEqual(room.ceilingPolygon);
			expect(source.outline.length).toBeGreaterThanOrEqual(3);
		}
	});

	it('returns exactly one Space’s lid, and nothing for a Room it cannot find', () => {
		const geometry = compiled();
		const roomId = geometry.rooms[2]!.roomId;

		const scoped = overheadSourcesOf(geometry, { kind: 'space', roomId });
		expect(scoped).toHaveLength(1);
		expect(scoped[0]!.key.roomId).toBe(roomId);
		expect(scoped[0]!.elevation).toBe(geometry.rooms[2]!.ceilingElevation);

		expect(overheadSourcesOf(geometry, { kind: 'space', roomId: 'no-such-room' })).toEqual([]);
	});

	it('omits a Room whose ceiling ring cannot describe an area', () => {
		const geometry = compiled();
		const degenerate = geometry.rooms[0]!;
		const pruned: CompiledLayoutGeometry = {
			...geometry,
			rooms: geometry.rooms.map((room) =>
				room.roomId === degenerate.roomId
					? { ...room, ceilingPolygon: room.ceilingPolygon.slice(0, 2) }
					: room
			)
		};

		const all = overheadSourcesOf(pruned, { kind: 'all' });
		expect(all).toHaveLength(geometry.rooms.length - 1);
		expect(all.some((source) => source.key.roomId === degenerate.roomId)).toBe(false);
		expect(overheadSourcesOf(pruned, { kind: 'space', roomId: degenerate.roomId })).toEqual([]);
	});

	it('hands back a copy of the ring, so a caller cannot write the compiled geometry', () => {
		const geometry = compiled();
		const room = geometry.rooms[0]!;
		const source = overheadSourcesOf(geometry, { kind: 'space', roomId: room.roomId })[0]!;
		const original = room.ceilingPolygon[0]!;
		const originalX = original[0];

		// A consumer is free to close a loop, rotate it or rescale it in place; the
		// compiled Room every other reader holds must not move.
		(source.outline as [number, number][]).push([0, 0]);
		(source.outline[0] as [number, number])[0] = originalX + 5;

		expect(room.ceilingPolygon).toHaveLength(source.outline.length - 1);
		expect(room.ceilingPolygon[0]![0]).toBe(originalX);
	});
});
