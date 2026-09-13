import { describe, expect, it } from 'vitest';
import {
	planDeleteLayoutObject,
	planExactJunctionMove,
	planExactLayoutObjectTransform,
	planExactRectangleDimensions,
	planExactWallAngle,
	planExactWallLength,
	planExactWallThickness,
	planWallSubdivision,
	resolveRectangle,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type NodingIdAllocator
} from '@portfolio/layout-core';

function squareDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		// Canonical-current fixture: the pre-H `4` literal belongs only to
		// historical compatibility fixtures (P23.6H H4 audit).
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] },
			{ id: 'B', point: [4, 0] },
			{ id: 'C', point: [4, 3] },
			{ id: 'D', point: [0, 3] }
		],
		walls: [
			{ id: 'w1', startJunctionId: 'A', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'w4', startJunctionId: 'D', endJunctionId: 'A', role: 'boundary', thickness: 0.2, height: 3 }
		],
		rooms: [{
			id: 'room',
			name: 'Room',
			boundary: [
				{ wallId: 'w1', direction: 'forward' },
				{ wallId: 'w2', direction: 'forward' },
				{ wallId: 'w3', direction: 'forward' },
				{ wallId: 'w4', direction: 'forward' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}],
		openings: [{
			id: 'door', wallId: 'w1', kind: 'door', offset: 1, width: 1, height: 2, sillHeight: 0, profile: 'rectangular'
		}],
		objects: [{ id: 'chair', kind: 'box', position: [1, 0.5, 1], rotation: [0, 0, 0], dimensions: [1, 1, 1] }]
	};
}

const allocator: NodingIdAllocator = {
	nextWallId: (_document, seed) => `${seed}-new`,
	nextJunctionId: (_document, seed) => `${seed}-junction`
};

describe('P23.1 wall-first precise semantic operations', () => {
	it('moves one Junction and preserves the canonical graph IDs', () => {
		const baseline = squareDocument();
		const result = planExactJunctionMove(baseline, 'A', [-1, 0]);

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.junctions.find((junction) => junction.id === 'A')?.point).toEqual([-1, 0]);
		expect(result.document.walls.map((wall) => wall.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
		expect(baseline.junctions.find((junction) => junction.id === 'A')?.point).toEqual([0, 0]);
	});

	it('sets Wall length with Start fixed and deforms the connected network', () => {
		const result = planExactWallLength(squareDocument(), 'w1', 6, 'start');

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.junctions.find((junction) => junction.id === 'A')?.point).toEqual([0, 0]);
		expect(result.document.junctions.find((junction) => junction.id === 'B')?.point).toEqual([6, 0]);
		expect(result.document.walls.find((wall) => wall.id === 'w1')).toMatchObject({ startJunctionId: 'A', endJunctionId: 'B' });
	});

	it('sets canonical Wall angle in radians without reversing orientation', () => {
		const angle = Math.atan2(0.5, 4);
		const result = planExactWallAngle(squareDocument(), { wallId: 'w1', angle, fixed: 'start' });

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		const end = result.document.junctions.find((junction) => junction.id === 'B')!.point;
		expect(end[0]).toBeCloseTo((4 * 4) / Math.hypot(4, 0.5));
		expect(end[1]).toBeCloseTo((4 * 0.5) / Math.hypot(4, 0.5));
		expect(result.document.walls.find((wall) => wall.id === 'w1')?.startJunctionId).toBe('A');
	});

	it('sets canonical Wall angle with End fixed', () => {
		const angle = Math.atan2(-0.5, 4);
		const result = planExactWallAngle(squareDocument(), { wallId: 'w1', angle, fixed: 'end' });

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		const start = result.document.junctions.find((junction) => junction.id === 'A')!.point;
		const length = 4;
		const directionLength = Math.hypot(4, -0.5);
		expect(result.document.junctions.find((junction) => junction.id === 'B')?.point).toEqual([4, 0]);
		expect(start[0]).toBeCloseTo(4 - (length * 4) / directionLength);
		expect(start[1]).toBeCloseTo(-(length * -0.5) / directionLength);
		expect(result.document.walls.find((wall) => wall.id === 'w1')).toMatchObject({ startJunctionId: 'A', endJunctionId: 'B' });
	});

	it('changes Wall thickness while keeping openings and Wall identity', () => {
		const result = planExactWallThickness(squareDocument(), 'w1', 0.35);

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.walls.find((wall) => wall.id === 'w1')?.thickness).toBe(0.35);
		expect(result.document.openings[0]?.wallId).toBe('w1');
	});

	it('resizes a rectangle from a deterministic anchor and explicit width Wall', () => {
		const result = planExactRectangleDimensions(squareDocument(), 'room', 6, 2, { anchorJunctionId: 'A', widthWallId: 'w1' });

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		const points = new Map(result.document.junctions.map((junction) => [junction.id, junction.point]));
		expect(points.get('A')).toEqual([0, 0]);
		expect(points.get('B')).toEqual([6, 0]);
		expect(points.get('C')).toEqual([6, 2]);
		expect(points.get('D')).toEqual([0, 2]);
	});

	it('resolves rectangle references once and exposes only incident width Walls', () => {
		const resolved = resolveRectangle(squareDocument(), 'room', { anchorJunctionId: 'A' });

		expect(resolved).not.toHaveProperty('rejection');
		if ('rejection' in resolved) return;
		expect([resolved.widthWallId, resolved.depthWallId]).toEqual(['w1', 'w4']);
		expect(resolveRectangle(squareDocument(), 'room', { anchorJunctionId: 'A', widthWallId: 'w2' })).toMatchObject({
			rejection: { code: 'invalid_reference' }
		});
	});

	it('subdivides a Wall with deterministic IDs and keeps the opening on a valid fragment', () => {
		const result = planWallSubdivision(squareDocument(), 'w1', 2, allocator);

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.walls.map((wall) => wall.id)).toContain('w1-b-new');
		expect(result.document.rooms[0]?.boundary).toHaveLength(5);
		expect(result.document.openings[0]?.wallId).toBe('w1');
	});

	it('rejects opening-interior subdivision, invalid values, no-ops, and shared rectangle ambiguity atomically', () => {
		const baseline = squareDocument();
		const split = planWallSubdivision(baseline, 'w1', 1.5, allocator);
		expect(split).toMatchObject({ kind: 'rejected', rejection: { code: 'split_through_opening_interior' } });
		expect(planExactWallLength(baseline, 'w1', 0, 'start')).toMatchObject({ kind: 'rejected', rejection: { code: 'invalid_value' } });
		expect(planExactWallThickness(baseline, 'w1', 0.2)).toMatchObject({ kind: 'rejected', rejection: { code: 'no_op' } });

		const shared = squareDocument();
		shared.rooms.push({ ...shared.rooms[0]!, id: 'room-2', name: 'Room 2' });
		expect(planExactRectangleDimensions(shared, 'room', 6, 2)).toMatchObject({ kind: 'rejected', rejection: { code: 'shared_boundary_resize_ambiguous' } });
		expect(baseline.junctions.find((junction) => junction.id === 'B')?.point).toEqual([4, 0]);
	});

	it('rejects a duplicate Junction point without mutating the input', () => {
		const baseline = squareDocument();
		const result = planExactJunctionMove(baseline, 'A', [4, 0]);

		expect(result).toMatchObject({ kind: 'rejected', rejection: { code: 'topology_invalid' } });
		if (result.kind !== 'rejected') return;
		expect(result.rejection.issues).toEqual(expect.arrayContaining([
		expect.objectContaining({ code: 'duplicate_junction_point' })
		]));
		expect(baseline.junctions.find((junction) => junction.id === 'A')?.point).toEqual([0, 0]);
	});

	it('edits document-level LayoutObject transforms as one exact candidate', () => {
		const result = planExactLayoutObjectTransform(squareDocument(), 'chair', {
			position: [2, 0.5, 1],
			dimensions: [1.2, 1, 1]
		});

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.objects[0]).toMatchObject({ position: [2, 0.5, 1], dimensions: [1.2, 1, 1] });
	});

	it('reparents a LayoutObject only to an existing Room and deletes through the planner', () => {
		const document = squareDocument();
		document.rooms.push({ ...document.rooms[0]!, id: 'room-2', name: 'Room 2' });
		const reparented = planExactLayoutObjectTransform(document, 'chair', { roomId: 'room-2' });

		expect(reparented.kind).toBe('success');
		if (reparented.kind !== 'success') return;
		expect(reparented.document.objects[0]?.roomId).toBe('room-2');
		expect(planExactLayoutObjectTransform(document, 'chair', { roomId: 'missing' })).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'invalid_reference', message: "Unknown roomId 'missing'" }
		});

		const deleted = planDeleteLayoutObject(reparented.document, 'chair');
		expect(deleted.kind).toBe('success');
		if (deleted.kind !== 'success') return;
		expect(deleted.document.objects).toEqual([]);
	});
});
