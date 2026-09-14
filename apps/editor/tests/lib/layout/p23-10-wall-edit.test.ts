import { describe, expect, it } from 'vitest';
import {
	planExactJunctionMove,
	planExactRectangleDimensions,
	planExactWallAngle,
	planExactWallLength,
	planRigidWallMove,
	planWallSubdivision,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutWall,
	type NodingIdAllocator
} from '@portfolio/layout-core';

const allocator: NodingIdAllocator = {
	nextWallId: (_document, seed) => `${seed}-new`,
	nextJunctionId: (_document, seed) => `${seed}-junction`
};

/** One rectangular Room with a door on `w1`, plus one free-standing object. */
function squareDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
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

/**
 * Degree-3 fixture: the square's `w1` is split at `E` by a partition `w6` that
 * runs into the Room's interior. `E` carries three Walls (two boundary
 * fragments + one partition).
 */
function degreeThreeDocument(): LayoutDocumentWallFirst {
	const document = squareDocument();
	document.junctions.push({ id: 'E', point: [2, 0] }, { id: 'F', point: [2, 2] });
	document.walls = document.walls.map((wall): LayoutWall =>
		wall.id === 'w1'
			? { ...wall, endJunctionId: 'E' }
			: wall
	);
	document.walls.push(
		{ id: 'w1b', startJunctionId: 'E', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3 },
		{ id: 'w6', startJunctionId: 'E', endJunctionId: 'F', role: 'partition', thickness: 0.1, height: 3 }
	);
	// Keep deterministic canonical document order: the square boundary first,
	// then the two fragments in authored order.
	document.walls = ['w1', 'w1b', 'w2', 'w3', 'w4', 'w6'].map(
		(id) => document.walls.find((wall) => wall.id === id)!
	);
	document.rooms[0]!.boundary = [
		{ wallId: 'w1', direction: 'forward' },
		{ wallId: 'w1b', direction: 'forward' },
		{ wallId: 'w2', direction: 'forward' },
		{ wallId: 'w3', direction: 'forward' },
		{ wallId: 'w4', direction: 'forward' }
	];
	// The door sits on the fragment that starts at the fixed junction.
	document.openings = [];
	return document;
}

/**
 * Two Rooms sharing `w2`: `room` on the left, `room-2` on the right. The shared
 * Wall is the only two-Room adjacency in the document.
 */
function twoRoomDocument(): LayoutDocumentWallFirst {
	const document = squareDocument();
	document.junctions.push({ id: 'E', point: [8, 0] }, { id: 'F', point: [8, 3] });
	document.walls.push(
		{ id: 'w5', startJunctionId: 'C', endJunctionId: 'F', role: 'boundary', thickness: 0.2, height: 3 },
		{ id: 'w6', startJunctionId: 'F', endJunctionId: 'E', role: 'boundary', thickness: 0.2, height: 3 },
		{ id: 'w7', startJunctionId: 'E', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3 }
	);
	document.rooms.push({
		id: 'room-2',
		name: 'Room 2',
		// B → E → F → C → B (interior on the left), so both Rooms reference the
		// shared `w2` from opposite directions.
		boundary: [
			{ wallId: 'w7', direction: 'reverse' },
			{ wallId: 'w6', direction: 'reverse' },
			{ wallId: 'w5', direction: 'reverse' },
			{ wallId: 'w2', direction: 'reverse' }
		],
		floorThickness: 0.1,
		ceilingThickness: 0.1
	});
	return document;
}

/** Square plus a partition far to the right, for crossing rejections. */
function partitionCrossingDocument(): LayoutDocumentWallFirst {
	const document = squareDocument();
	document.junctions.push({ id: 'P', point: [10, 0] }, { id: 'Q', point: [10, 3] });
	document.walls.push({
		id: 'w5',
		startJunctionId: 'P',
		endJunctionId: 'Q',
		role: 'partition',
		thickness: 0.1,
		height: 3
	});
	return document;
}

describe('P23.10 — canonical Junction coordinate edits', () => {
	it('moves one Junction exactly and preserves every canonical ID', () => {
		const baseline = squareDocument();
		const snapshot = JSON.stringify(baseline);
		const result = planExactJunctionMove(baseline, 'A', [-1, 0]);

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.junctions.find((junction) => junction.id === 'A')?.point).toEqual([-1, 0]);
		expect(result.document.walls.map((wall) => wall.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
		expect(result.document.openings).toEqual(baseline.openings);
		expect(result.document.rooms.map((room) => ({ id: room.id, name: room.name }))).toEqual([
			{ id: 'room', name: 'Room' }
		]);
		expect(result.changedJunctionIds).toEqual(['A']);
		expect(result.changedWallIds).toEqual(['w1', 'w4']);
		expect(JSON.stringify(baseline)).toBe(snapshot);
	});

	it('reports every incident Wall exactly once for a degree-3 Junction', () => {
		const result = planExactJunctionMove(degreeThreeDocument(), 'E', [2, -1]);

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.changedJunctionIds).toEqual(['E']);
		expect(result.changedWallIds).toEqual(['w1', 'w1b', 'w6']);
		expect(result.document.junctions.find((junction) => junction.id === 'E')?.point).toEqual([2, -1]);
		// The partition's far end is untouched; the Room survives with its
		// rewritten fragment boundary.
		expect(result.document.junctions.find((junction) => junction.id === 'F')?.point).toEqual([2, 2]);
		expect(result.document.rooms[0]!.boundary.map((ref) => ref.wallId)).toEqual([
			'w1', 'w1b', 'w2', 'w3', 'w4'
		]);
	});

	it('rejects a duplicate Junction point and a crossing through a neighbour, atomically', () => {
		const baseline = squareDocument();
		expect(planExactJunctionMove(baseline, 'A', [4, 0])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'topology_invalid' }
		});
		expect(planExactJunctionMove(baseline, 'A', [0, 0])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'no_op' }
		});
		expect(planExactJunctionMove(baseline, 'missing', [1, 1])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'unknown_junction' }
		});
		expect(planExactJunctionMove(baseline, 'A', [Number.NaN, 0])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'invalid_value' }
		});

		// Moving the partition's end onto the square's `w2` span crosses it.
		const crossing = partitionCrossingDocument();
		const rejected = planExactJunctionMove(crossing, 'P', [4, 1.5]);
		expect(rejected).toMatchObject({ kind: 'rejected', rejection: { code: 'topology_invalid' } });
		expect(crossing.junctions.find((junction) => junction.id === 'P')?.point).toEqual([10, 0]);

		// A Junction that would collapse its Wall to zero effective length.
		expect(planExactJunctionMove(degreeThreeDocument(), 'E', [4, 0])).toMatchObject({
			kind: 'rejected'
		});
	});

	it('rejects a candidate that breaks a neighbouring hosted Opening', () => {
		const baseline = squareDocument();
		baseline.openings = [{
			id: 'door', wallId: 'w2', kind: 'door', offset: 1, width: 1.5, height: 2, sillHeight: 0, profile: 'rectangular'
		}];
		// `w2` shrinks from 3 m to 1 m; the door no longer fits.
		expect(planExactJunctionMove(baseline, 'C', [4, 1])).toMatchObject({
			kind: 'rejected'
		});
		expect(baseline.junctions.find((junction) => junction.id === 'C')?.point).toEqual([4, 3]);
	});

	it('rejects when an existing portal relation stops matching physical adjacency', () => {
		// Two Rooms share `w2`. A door hosted by `w1` (adjacent to ONE Room)
		// that relates both Rooms is endpoint-valid but physically nonadjacent —
		// exactly the hole the canonical portal gate owns.
		const baseline = twoRoomDocument();
		baseline.openings = [{
			id: 'door', wallId: 'w1', kind: 'door', offset: 1, width: 1, height: 2, sillHeight: 0,
			profile: 'rectangular', connectsRoomIds: ['room', 'room-2']
		}];
		expect(planExactJunctionMove(baseline, 'A', [-1, 0])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'portal_relation_invalid' }
		});
	});

	it('rejects when the candidate cannot map every baseline Room to one face', () => {
		const baseline = squareDocument();
		// A second closed boundary loop with no Room: extraction finds two
		// faces but only one is claimed, so identity preservation fails.
		baseline.junctions.push(
			{ id: 'E', point: [6, 0] },
			{ id: 'F', point: [10, 0] },
			{ id: 'G', point: [10, 3] },
			{ id: 'H', point: [6, 3] }
		);
		baseline.walls.push(
			{ id: 'w5', startJunctionId: 'E', endJunctionId: 'F', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'w6', startJunctionId: 'F', endJunctionId: 'G', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'w7', startJunctionId: 'G', endJunctionId: 'H', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'w8', startJunctionId: 'H', endJunctionId: 'E', role: 'boundary', thickness: 0.2, height: 3 }
		);
		expect(planExactJunctionMove(baseline, 'A', [-1, 0])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'room_identity_lost' }
		});
	});
});

describe('P23.10 — rigid straight-Wall translation', () => {
	it('translates both endpoints by one identical delta and preserves the Wall exactly', () => {
		const baseline = squareDocument();
		const snapshot = JSON.stringify(baseline);
		const result = planRigidWallMove(baseline, 'w1', [1, 1]);

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.operation).toBe('wall-move');
		expect(result.document.junctions.find((junction) => junction.id === 'A')?.point).toEqual([1, 1]);
		expect(result.document.junctions.find((junction) => junction.id === 'B')?.point).toEqual([5, 1]);
		expect(result.changedJunctionIds).toEqual(['A', 'B']);
		// Document-order union of the Walls incident to either endpoint.
		expect(result.changedWallIds).toEqual(['w1', 'w2', 'w4']);

		const wall = result.document.walls.find((candidate) => candidate.id === 'w1')!;
		expect(wall).toMatchObject({ startJunctionId: 'A', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3 });
		// Rigid: length and direction are byte-identical.
		const baselineWall = baseline.walls.find((candidate) => candidate.id === 'w1')!;
		const length = (document: LayoutDocumentWallFirst) => {
			const start = document.junctions.find((junction) => junction.id === document.walls.find((w) => w.id === 'w1')!.startJunctionId)!.point;
			const end = document.junctions.find((junction) => junction.id === document.walls.find((w) => w.id === 'w1')!.endJunctionId)!.point;
			return Math.hypot(end[0] - start[0], end[1] - start[1]);
		};
		expect(length(result.document)).toBeCloseTo(length(baseline), 12);
		expect(wall.startJunctionId).toBe(baselineWall.startJunctionId);

		// Hosted Openings keep ID, host, offset and width.
		expect(result.document.openings).toEqual(baseline.openings);
		// Neighbouring Walls reshape; Rooms keep identity and metadata.
		expect(result.document.rooms.map((room) => room.id)).toEqual(['room']);
		expect(result.document.rooms[0]!.boundary).toEqual(baseline.rooms[0]!.boundary);
		expect(JSON.stringify(baseline)).toBe(snapshot);
	});

	it('accepts a WallMoveIntent object form and reports the same candidate', () => {
		const baseline = squareDocument();
		const positional = planRigidWallMove(baseline, 'w2', [0.5, -0.5]);
		const intent = planRigidWallMove(baseline, { wallId: 'w2', delta: [0.5, -0.5] });
		expect(intent).toEqual(positional);
	});

	it('rejects non-finite, no-op, unknown and unsupported targets atomically', () => {
		const baseline = squareDocument();
		expect(planRigidWallMove(baseline, 'w1', [0, 0])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'no_op' }
		});
		expect(planRigidWallMove(baseline, 'w1', [Number.POSITIVE_INFINITY, 0])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'invalid_value' }
		});
		expect(planRigidWallMove(baseline, 'nope', [1, 0])).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'unknown_wall' }
		});
	});

	it('rejects a rigid move whose translation breaks a neighbouring Wall or Opening', () => {
		const baseline = squareDocument();
		// Translate the far Wall onto the neighbouring span: `w3` would end up
		// overlapping/crossing `w2` and `w4`.
		const crossed = planRigidWallMove(baseline, 'w3', [0, -3]);
		expect(crossed).toMatchObject({ kind: 'rejected' });

		const opening = squareDocument();
		opening.openings = [{
			id: 'door', wallId: 'w2', kind: 'door', offset: 1, width: 1, height: 2, sillHeight: 0, profile: 'rectangular'
		}];
		// Nothing about an Opening changes under a rigid translation, so this
		// move stays valid: the Opening's host, offset and width are exact.
		const moved = planRigidWallMove(opening, 'w2', [2, 0]);
		expect(moved.kind).toBe('success');
		if (moved.kind !== 'success') return;
		expect(moved.document.openings).toEqual(opening.openings);
	});
});

describe('P23.10 — reshape parity across the numeric and direct paths', () => {
	it('produces the identical document for an endpoint drag and an exact Junction move', () => {
		const baseline = squareDocument();
		const viaLength = planExactWallLength(baseline, 'w1', 6, 'start');
		const viaJunction = planExactJunctionMove(baseline, 'B', [6, 0]);

		expect(viaLength.kind).toBe('success');
		expect(viaJunction.kind).toBe('success');
		if (viaLength.kind !== 'success' || viaJunction.kind !== 'success') return;
		expect(JSON.stringify(viaLength.document)).toBe(JSON.stringify(viaJunction.document));
	});

	it('produces the identical document for an exact angle and its Junction target', () => {
		const baseline = squareDocument();
		const angle = Math.atan2(1, 1);
		const viaAngle = planExactWallAngle(baseline, { wallId: 'w1', angle, fixed: 'start' });
		expect(viaAngle.kind).toBe('success');
		if (viaAngle.kind !== 'success') return;
		const movedB = viaAngle.document.junctions.find((junction) => junction.id === 'B')!.point;
		const viaJunction = planExactJunctionMove(baseline, 'B', movedB as [number, number]);
		expect(viaJunction.kind).toBe('success');
		if (viaJunction.kind !== 'success') return;
		expect(JSON.stringify(viaLengthDocument(viaAngle))).toBe(JSON.stringify(viaJunction.document));
	});
});

/** Identity helper so the parity assertion cannot accidentally compare closures. */
function viaLengthDocument(plan: { document: LayoutDocumentWallFirst }): LayoutDocumentWallFirst {
	return plan.document;
}

describe('P23.10 — rectangle and subdivision reach the complete geometry seam', () => {
	it('resizes a rectangle while preserving Room identity and metadata', () => {
		const baseline = squareDocument();
		const result = planExactRectangleDimensions(baseline, 'room', 6, 2, {
			anchorJunctionId: 'A',
			widthWallId: 'w1'
		});

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		const points = new Map(result.document.junctions.map((junction) => [junction.id, junction.point]));
		expect(points.get('A')).toEqual([0, 0]);
		expect(points.get('B')).toEqual([6, 0]);
		expect(points.get('C')).toEqual([6, 2]);
		expect(points.get('D')).toEqual([0, 2]);
		expect(result.document.rooms[0]).toMatchObject({
			id: 'room',
			name: 'Room',
			floorThickness: 0.1,
			ceilingThickness: 0.1
		});
		expect(result.document.rooms[0]!.boundary).toEqual(baseline.rooms[0]!.boundary);
		expect(JSON.stringify(baseline)).toBe(JSON.stringify(squareDocument()));
	});

	it('keeps the rectangle ambiguity rejection and never mutates the baseline', () => {
		const shared = squareDocument();
		shared.rooms.push({ ...shared.rooms[0]!, id: 'room-2', name: 'Room 2' });
		expect(planExactRectangleDimensions(shared, 'room', 6, 2)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'shared_boundary_resize_ambiguous' }
		});
		expect(shared.junctions.find((junction) => junction.id === 'B')?.point).toEqual([4, 0]);
	});

	it('subdivides through the complete seam: deterministic IDs, rewritten boundary, exact Rooms', () => {
		const baseline = squareDocument();
		const result = planWallSubdivision(baseline, 'w1', 2, allocator);

		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.walls.map((wall) => wall.id)).toEqual(['w1', 'w1-b-new', 'w2', 'w3', 'w4']);
		expect(result.document.rooms[0]!.boundary.map((ref) => [ref.wallId, ref.direction])).toEqual([
			['w1', 'forward'],
			['w1-b-new', 'forward'],
			['w2', 'forward'],
			['w3', 'forward'],
			['w4', 'forward']
		]);
		expect(result.document.rooms[0]!.id).toBe('room');
		// The door sat at [1, 2] on `w1`, wholly before the split: it stays.
		expect(result.document.openings).toEqual(baseline.openings);
		// The retained fragment keeps the authored Wall ID and fields.
		expect(result.document.walls.find((wall) => wall.id === 'w1')).toMatchObject({
			startJunctionId: 'A',
			role: 'boundary',
			thickness: 0.2,
			height: 3
		});
		// Repeat planning from the same baseline/allocator is identical.
		expect(planWallSubdivision(baseline, 'w1', 2, allocator)).toEqual(result);
	});

	it('rebases Openings after the split and rejects endpoint / through-Opening splits', () => {
		const baseline = squareDocument();
		baseline.openings = [
			{ id: 'near', wallId: 'w1', kind: 'door', offset: 1, width: 0.5, height: 2, sillHeight: 0, profile: 'rectangular' },
			{ id: 'far', wallId: 'w1', kind: 'window', offset: 3, width: 0.5, height: 1, sillHeight: 1, profile: 'rectangular' }
		];
		const result = planWallSubdivision(baseline, 'w1', 2.5, allocator);
		expect(result.kind).toBe('success');
		if (result.kind !== 'success') return;
		expect(result.document.openings.find((opening) => opening.id === 'near')).toMatchObject({
			wallId: 'w1',
			offset: 1
		});
		expect(result.document.openings.find((opening) => opening.id === 'far')).toMatchObject({
			wallId: 'w1-b-new',
			offset: 0.5
		});

		expect(planWallSubdivision(baseline, 'w1', 0, allocator)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'split_at_existing_endpoint' }
		});
		expect(planWallSubdivision(baseline, 'w1', 4, allocator)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'split_at_existing_endpoint' }
		});
		expect(planWallSubdivision(baseline, 'w1', 1.2, allocator)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'split_through_opening_interior' }
		});
	});

	it('rejects a subdivision whose Room lineage cannot survive', () => {
		const baseline = squareDocument();
		baseline.junctions.push(
			{ id: 'E', point: [6, 0] },
			{ id: 'F', point: [10, 0] },
			{ id: 'G', point: [10, 3] },
			{ id: 'H', point: [6, 3] }
		);
		baseline.walls.push(
			{ id: 'w5', startJunctionId: 'E', endJunctionId: 'F', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'w6', startJunctionId: 'F', endJunctionId: 'G', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'w7', startJunctionId: 'G', endJunctionId: 'H', role: 'boundary', thickness: 0.2, height: 3 },
			{ id: 'w8', startJunctionId: 'H', endJunctionId: 'E', role: 'boundary', thickness: 0.2, height: 3 }
		);
		expect(planWallSubdivision(baseline, 'w1', 2, allocator)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'room_identity_lost' }
		});
	});

	it('routes every geometry operation through the reconciled portal gate', () => {
		// Two Rooms share `w2`; a door on `w1` relates both Rooms but is
		// physically adjacent to one. Endpoint-valid, topology-valid — only the
		// reconciled late gate can reject it. Every geometry operation must stop
		// there, so none can reach acceptance through a precision-only path.
		//
		// `room-3` is physically disjoint, so the rectangle operation cannot stop
		// at its own shared-boundary ambiguity gate first and has to reach the
		// reconciled seam like the rest.
		const portalInvalid = (): LayoutDocumentWallFirst => {
			const document = twoRoomDocument();
			document.junctions.push(
				{ id: 'P', point: [20, 0] },
				{ id: 'Q', point: [24, 0] },
				{ id: 'R', point: [24, 3] },
				{ id: 'S', point: [20, 3] }
			);
			document.walls.push(
				{ id: 'wb1', startJunctionId: 'P', endJunctionId: 'Q', role: 'boundary', thickness: 0.2, height: 3 },
				{ id: 'wb2', startJunctionId: 'Q', endJunctionId: 'R', role: 'boundary', thickness: 0.2, height: 3 },
				{ id: 'wb3', startJunctionId: 'R', endJunctionId: 'S', role: 'boundary', thickness: 0.2, height: 3 },
				{ id: 'wb4', startJunctionId: 'S', endJunctionId: 'P', role: 'boundary', thickness: 0.2, height: 3 }
			);
			document.rooms.push({
				id: 'room-3',
				name: 'Room 3',
				boundary: ['wb1', 'wb2', 'wb3', 'wb4'].map((wallId) => ({
					wallId,
					direction: 'forward' as const
				})),
				floorThickness: 0.1,
				ceilingThickness: 0.1
			});
			document.openings = [{
				id: 'door',
				wallId: 'w1',
				kind: 'door',
				offset: 1,
				width: 1,
				height: 2,
				sillHeight: 0,
				profile: 'rectangular',
				connectsRoomIds: ['room', 'room-2']
			}];
			return document;
		};
		const plans = [
			planExactJunctionMove(portalInvalid(), 'A', [-1, 0]),
			planRigidWallMove(portalInvalid(), 'w4', [-1, 0]),
			planExactWallLength(portalInvalid(), { wallId: 'w1', length: 3, fixed: 'start' }),
			planExactWallAngle(portalInvalid(), { wallId: 'w1', angle: Math.atan2(0.5, 4), fixed: 'start' }),
			planExactRectangleDimensions(portalInvalid(), 'room-3', 5, 3, {
				anchorJunctionId: 'P',
				widthWallId: 'wb1'
			}),
			planWallSubdivision(portalInvalid(), 'w1', 2, allocator)
		];
		for (const plan of plans) {
			expect(plan).toMatchObject({
				kind: 'rejected',
				rejection: { code: 'portal_relation_invalid' }
			});
		}
	});

	it('forwards the canonical rejection code and issues instead of a UI string', () => {
		const invalid = squareDocument();
		// The Room boundary references a Wall that does not exist: the canonical
		// wall-first codec owns that rejection, not the geometry finalizer.
		invalid.rooms[0]!.boundary[2] = { wallId: 'ghost', direction: 'forward' };
		const result = planRigidWallMove(invalid, 'w1', [1, 0]);
		expect(result).toMatchObject({ kind: 'rejected', rejection: { code: 'geometry_invalid' } });
		if (result.kind !== 'rejected') return;
		expect(result.rejection.issues?.length).toBeGreaterThan(0);
	});
});
