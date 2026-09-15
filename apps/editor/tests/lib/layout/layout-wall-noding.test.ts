import { describe, expect, it } from 'vitest';

import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst
} from '$lib/layout/layout-wall-first-codec';
import {
	planWallCrossing,
	planWallSplit,
	type NodingIdAllocator
} from '$lib/layout/layout-wall-noding';

/** Deterministic allocator: seed-derived IDs with collision avoidance. */
function nodingAllocator(): NodingIdAllocator {
	return {
		nextWallId(base, seed) {
			let candidate = `${seed}-1`;
			let counter = 1;
			while (base.walls.some((wall) => wall.id === candidate)) {
				counter += 1;
				candidate = `${seed}-${counter}`;
			}
			return candidate;
		},
		nextJunctionId(base, seed) {
			let candidate = `j-${seed}-1`;
			let counter = 1;
			while (base.junctions.some((junction) => junction.id === candidate)) {
				counter += 1;
				candidate = `j-${seed}-${counter}`;
			}
			return candidate;
		}
	};
}

/** One rectangular room, walls 6 x 4, single door on wall-top at offset 2. */
function singleRoomDocument(): LayoutDocumentWallFirst {
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
			{ id: 'wall-bottom', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-right', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-top', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'wall-left', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
		],
		rooms: [
			{
				id: 'room-main',
				name: 'Main',
				boundary: [
					{ wallId: 'wall-bottom', direction: 'forward' },
					{ wallId: 'wall-right', direction: 'forward' },
					{ wallId: 'wall-top', direction: 'forward' },
					{ wallId: 'wall-left', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [
			{
				id: 'door-1',
				wallId: 'wall-top',
				kind: 'door',
				offset: 2,
				width: 0.9,
				height: 2.1,
				sillHeight: 0,
				profile: 'rectangular'
			}
		],
		objects: []
	};
}

describe('planWallSplit — T noding (H3 §9.1 / P23.8 identity rules)', () => {
	it('keeps the Wall ID on the original-start fragment and allocates one new wall + junction', () => {
		const baseline = singleRoomDocument();
		const plan = planWallSplit(baseline, 'wall-bottom', 2, nodingAllocator());
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;

		// Original wall retains its ID, canonical orientation, new end junction.
		const retained = plan.document.walls.find((wall) => wall.id === 'wall-bottom');
		expect(retained!.startJunctionId).toBe('j-a');
		expect(retained!.endJunctionId).toBe(plan.junctionId);
		// New fragment carries the new ID and the original end junction.
		const fragment = plan.document.walls.find((wall) => wall.id === plan.createdWallIds[0]);
		expect(fragment!.startJunctionId).toBe(plan.junctionId);
		expect(fragment!.endJunctionId).toBe('j-b');
		// The junction lands at exactly 2 m from j-a.
		const junction = plan.document.junctions.find((entry) => entry.id === plan.junctionId);
		expect(junction!.point).toEqual([2, 0]);
		// Nothing else changed.
		expect(plan.document.walls).toHaveLength(5);
		expect(plan.splitWallIds).toEqual(['wall-bottom']);
	});

	it('rebases openings past the split by meter offset and retains openings before it', () => {
		const baseline = singleRoomDocument();
		baseline.openings.push(
			{ id: 'door-late', wallId: 'wall-bottom', kind: 'door', offset: 4, width: 0.9, height: 2.1, sillHeight: 0, profile: 'rectangular' },
			{ id: 'win-early', wallId: 'wall-bottom', kind: 'window', offset: 0.5, width: 1, height: 1.2, sillHeight: 0.9, profile: 'rectangular' }
		);
		const plan = planWallSplit(baseline, 'wall-bottom', 3, nodingAllocator());
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const newWallId = plan.createdWallIds[0]!;

		const late = plan.document.openings.find((opening) => opening.id === 'door-late');
		expect(late!.wallId).toBe(newWallId);
		expect(late!.offset).toBe(1); // 4 - 3
		const early = plan.document.openings.find((opening) => opening.id === 'win-early');
		expect(early!.wallId).toBe('wall-bottom');
		expect(early!.offset).toBe(0.5);
	});

	it('rejects a split passing through an opening interior and mutates nothing', () => {
		const baseline = singleRoomDocument();
		// door-1 lives on wall-top, so split wall-bottom through its own door.
		baseline.openings.push(
			{ id: 'door-mid', wallId: 'wall-bottom', kind: 'door', offset: 1.5, width: 1, height: 2.1, sillHeight: 0, profile: 'rectangular' }
		);
		const frozen = structuredClone(baseline);
		const plan = planWallSplit(baseline, 'wall-bottom', 2, nodingAllocator());
		expect(plan).toEqual({
			kind: 'rejected',
			rejection: expect.objectContaining({ code: 'split_through_opening_interior', wallId: 'wall-bottom' })
		});
		expect(baseline).toEqual(frozen);
	});

	it('accepts exact opening-start/end splits as deterministic edge cases', () => {
		const baseline = singleRoomDocument();
		baseline.openings.push(
			{ id: 'door-touching', wallId: 'wall-bottom', kind: 'door', offset: 2, width: 1, height: 2.1, sillHeight: 0, profile: 'rectangular' }
		);
		// Split exactly at the opening's start: rebases to offset 0, legal.
		const atStart = planWallSplit(baseline, 'wall-bottom', 2, nodingAllocator());
		expect(atStart.kind).toBe('success');
		if (atStart.kind !== 'success') return;
		const moved = atStart.document.openings.find((opening) => opening.id === 'door-touching');
		expect(moved!.offset).toBe(0);
		expect(moved!.wallId).toBe(atStart.createdWallIds[0]!);
	});

	it('rejects endpoint splits and out-of-range distances with named codes', () => {
		const baseline = singleRoomDocument();
		expect(planWallSplit(baseline, 'wall-bottom', 0, nodingAllocator()).kind).toBe('rejected');
		const atZero = planWallSplit(baseline, 'wall-bottom', 0, nodingAllocator());
		expect(atZero.kind === 'rejected' && atZero.rejection.code).toBe('split_at_existing_endpoint');
		const pastEnd = planWallSplit(baseline, 'wall-bottom', 6, nodingAllocator());
		expect(pastEnd.kind === 'rejected' && pastEnd.rejection.code).toBe('split_at_existing_endpoint');
		const beyond = planWallSplit(baseline, 'wall-bottom', 7, nodingAllocator());
		expect(beyond.kind === 'rejected' && beyond.rejection.code).toBe('split_distance_out_of_range');
	});

	it('rewrites room boundaries atomically: forward [W] → [W, W2]', () => {
		const baseline = singleRoomDocument();
		// Make room-main reference wall-bottom in reverse to cover that arm.
		baseline.rooms[0]!.boundary[0] = { wallId: 'wall-bottom', direction: 'reverse' };
		const plan = planWallSplit(baseline, 'wall-bottom', 2, nodingAllocator());
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const newWallId = plan.createdWallIds[0]!;
		const boundary = plan.document.rooms[0]!.boundary;
		// Reverse arm: [W] → [W2, W] (both traversed toward the original end).
		expect(boundary.slice(0, 2)).toEqual([
			{ wallId: newWallId, direction: 'reverse' },
			{ wallId: 'wall-bottom', direction: 'reverse' }
		]);
	});

	it('reuses an existing junction instead of allocating a new one', () => {
		const baseline = singleRoomDocument();
		baseline.junctions.push({ id: 'j-t', point: [2, 0] });
		const plan = planWallSplit(baseline, 'wall-bottom', 2, nodingAllocator(), {
			existingJunctionId: 'j-t'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.junctionId).toBe('j-t');
		expect(plan.document.junctions).toHaveLength(5);
	});

	it('keeps a reused Junction coordinate canonical within identity tolerance', () => {
		const baseline = singleRoomDocument();
		const canonicalPoint: [number, number] = [2, 5e-10];
		baseline.junctions.push({ id: 'j-t', point: canonicalPoint });
		baseline.walls.push({
			id: 'wall-attached',
			startJunctionId: 'j-t',
			endJunctionId: 'j-d',
			role: 'partition',
			thickness: 0.1,
			height: 3,
			centerline: { kind: 'line' } as const,
		});
		const frozenAttachedWall = structuredClone(baseline.walls.at(-1));

		const plan = planWallSplit(baseline, 'wall-bottom', 2, nodingAllocator(), {
			existingJunctionId: 'j-t'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.junctions.find((junction) => junction.id === 'j-t')?.point).toEqual(
			canonicalPoint
		);
		expect(plan.document.walls.find((wall) => wall.id === 'wall-attached')).toEqual(
			frozenAttachedWall
		);
	});

	it('rejects unknown walls', () => {
		const plan = planWallSplit(singleRoomDocument(), 'wall-nope', 1, nodingAllocator());
		expect(plan.kind === 'rejected' && plan.rejection.code).toBe('unknown_wall');
	});
});

describe('planWallCrossing — X noding (H3 §9.2)', () => {
	it('splits both walls against one shared new junction at the crossing point', () => {
		const baseline = singleRoomDocument();
		// Partition wall crossing wall-bottom at (2, 0): a partition is not
		// part of room boundaries, so this stays a pure wall-graph operation.
		baseline.junctions.push(
			{ id: 'j-p1', point: [2, -3] },
			{ id: 'j-p2', point: [2, 3] }
		);
		baseline.walls.push(
			{ id: 'a-partition', startJunctionId: 'j-p1', endJunctionId: 'j-p2', role: 'partition', thickness: 0.1, height: 3, centerline: { kind: 'line' } as const}
		);
		const plan = planWallCrossing(baseline, ['wall-bottom', 'a-partition'], [2, 0], nodingAllocator());
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;

		// Exactly one new junction, at the crossing point.
		const junction = plan.document.junctions.find((entry) => entry.id === plan.junctionId);
		expect(junction!.point).toEqual([2, 0]);
		// Both originals subdivided; two new fragments.
		expect(plan.splitWallIds.sort()).toEqual(['a-partition', 'wall-bottom']);
		expect(plan.createdWallIds).toHaveLength(2);
		// Originals retain their IDs on their original-start fragments.
		const retainedBottom = plan.document.walls.find((wall) => wall.id === 'wall-bottom');
		expect(retainedBottom!.startJunctionId).toBe('j-a');
		expect(retainedBottom!.endJunctionId).toBe(plan.junctionId);
		const retainedPartition = plan.document.walls.find((wall) => wall.id === 'a-partition');
		expect(retainedPartition!.startJunctionId).toBe('j-p1');
		expect(retainedPartition!.endJunctionId).toBe(plan.junctionId);
	});

	it('is deterministic regardless of the input wall order (stable Wall-ID processing)', () => {
		const baseline = singleRoomDocument();
		baseline.junctions.push(
			{ id: 'j-p1', point: [2, -3] },
			{ id: 'j-p2', point: [2, 3] }
		);
		baseline.walls.push(
			{ id: 'a-partition', startJunctionId: 'j-p1', endJunctionId: 'j-p2', role: 'partition', thickness: 0.1, height: 3, centerline: { kind: 'line' } as const}
		);
		const first = planWallCrossing(baseline, ['wall-bottom', 'a-partition'], [2, 0], nodingAllocator());
		const second = planWallCrossing(baseline, ['a-partition', 'wall-bottom'], [2, 0], nodingAllocator());
		expect(first).toEqual(second);
	});

	it('rejects a crossing at a wall endpoint', () => {
		const baseline = singleRoomDocument();
		baseline.junctions.push(
			{ id: 'j-p1', point: [0, -3] },
			{ id: 'j-p2', point: [0, 3] }
		);
		baseline.walls.push(
			{ id: 'a-partition', startJunctionId: 'j-p1', endJunctionId: 'j-p2', role: 'partition', thickness: 0.1, height: 3, centerline: { kind: 'line' } as const}
		);
		// Crossing at (0,0) = j-a = wall-bottom's start endpoint.
		const plan = planWallCrossing(baseline, ['wall-bottom', 'a-partition'], [0, 0], nodingAllocator());
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('split_at_existing_endpoint');
	});
});
