import { describe, expect, it } from 'vitest';
import {
	alignReferenceKey,
	planLayoutObjectAlign,
	type CompiledLayoutGeometry,
	type CompiledLayoutObject,
	type CompiledQuerySpan
} from '@portfolio/layout-core';

function emptyGeometry(): CompiledLayoutGeometry {
	return {
		floors: [],
		rooms: [],
		walls: [],
		objects: [],
		queries: { points: [], spans: [], polygons: [], aabbs: [] },
		bounds: null
	};
}

function footprintPolygon(
	objectId: string,
	footprint: [number, number][]
): CompiledLayoutGeometry['queries']['polygons'][number] {
	const xs = footprint.map(([x]) => x);
	const zs = footprint.map(([, z]) => z);
	return {
		id: `p:${objectId}`,
		cacheKey: `c:${objectId}`,
		kind: 'object-footprint',
		polygon: footprint,
		aabb: {
			min: [Math.min(...xs), Math.min(...zs)],
			max: [Math.max(...xs), Math.max(...zs)]
		},
		sourceId: objectId,
		objectId
	};
}

function boxObject(
	objectId: string,
	position: [number, number, number],
	footprint: [number, number][],
	kind: CompiledLayoutObject['kind'] = 'box'
): CompiledLayoutObject {
	const xs = footprint.map(([x]) => x);
	const zs = footprint.map(([, z]) => z);
	return {
		id: `o:${objectId}`,
		cacheKey: `c:${objectId}`,
		objectId,
		kind,
		position,
		rotation: [0, 0, 0],
		dimensions: [1, 1, 1],
		readonly: false,
		worldAabb: {
			min: [Math.min(...xs), 0, Math.min(...zs)],
			max: [Math.max(...xs), 1, Math.max(...zs)]
		},
		planFootprint: footprint
	};
}

function wallSpan(
	segmentId: string,
	start: [number, number],
	end: [number, number],
	roomId = 'r',
	startDistance = 0
): CompiledQuerySpan {
	const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
	return {
		id: `s:${segmentId}:${startDistance}`,
		cacheKey: `k:${segmentId}:${startDistance}`,
		kind: 'wall',
		start,
		end,
		startDistance,
		endDistance: startDistance + length,
		aabb: {
			min: [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
			max: [Math.max(start[0], end[0]), Math.max(start[1], end[1])]
		},
		sourceId: segmentId,
		floorId: 'f',
		roomId,
		segmentId
	};
}

// Box object at the origin: plan footprint AABB is x 0..2, z 0..1.
function originBox(position: [number, number, number] = [0, 0.5, 0]): CompiledLayoutObject {
	return boxObject('box', position, [
		[0, 0],
		[2, 0],
		[2, 1],
		[0, 1]
	]);
}

// Reference object footprint AABB is x 5..9, z 3..6. Object bounds
// references resolve from compiled query polygons, so both records are added.
function referenceGeometry(): CompiledLayoutGeometry {
	const geometry = emptyGeometry();
	const selfFootprint: [number, number][] = [
		[0, 0],
		[2, 0],
		[2, 1],
		[0, 1]
	];
	const refFootprint: [number, number][] = [
		[5, 3],
		[9, 3],
		[9, 6],
		[5, 6]
	];
	geometry.objects.push(originBox(), boxObject('ref', [5, 0.5, 3], refFootprint));
	geometry.queries.polygons.push(
		footprintPolygon('box', selfFootprint),
		footprintPolygon('ref', refFootprint)
	);
	return geometry;
}

function alignedPositionOf(
	geometry: CompiledLayoutGeometry,
	objectId: string,
	reference: Parameters<typeof planLayoutObjectAlign>[2],
	action: Parameters<typeof planLayoutObjectAlign>[3],
	axis: Parameters<typeof planLayoutObjectAlign>[4] = 'x'
): [number, number, number] {
	const plan = planLayoutObjectAlign(geometry, objectId, reference, action, axis);
	expect(plan.kind).toBe('success');
	if (plan.kind !== 'success') throw new Error('expected success');
	return plan.position;
}

describe('P23.2 alignment bounds actions per axis', () => {
	const geometry = referenceGeometry();

	it('aligns X min/center/max to another object bounds', () => {
		expect(alignedPositionOf(geometry, 'box', { kind: 'object', id: 'ref' }, 'min')).toEqual([5, 0.5, 0]);
		expect(alignedPositionOf(geometry, 'box', { kind: 'object', id: 'ref' }, 'center')).toEqual([6, 0.5, 0]);
		expect(alignedPositionOf(geometry, 'box', { kind: 'object', id: 'ref' }, 'max')).toEqual([7, 0.5, 0]);
	});

	it('aligns Z min/center/max to another object bounds', () => {
		expect(alignedPositionOf(geometry, 'box', { kind: 'object', id: 'ref' }, 'min', 'z')).toEqual([0, 0.5, 3]);
		expect(alignedPositionOf(geometry, 'box', { kind: 'object', id: 'ref' }, 'center', 'z')).toEqual([0, 0.5, 4]);
		expect(alignedPositionOf(geometry, 'box', { kind: 'object', id: 'ref' }, 'max', 'z')).toEqual([0, 0.5, 5]);
	});

	it('aligns to a Room boundary-span AABB', () => {
		const roomGeometry = referenceGeometry();
		roomGeometry.queries.spans.push(
			wallSpan('room-north', [5, 3], [9, 3], 'room-9'),
			wallSpan('room-south', [5, 6], [9, 6], 'room-9')
		);
		expect(alignedPositionOf(roomGeometry, 'box', { kind: 'room', id: 'room-9' }, 'max', 'z')).toEqual([0, 0.5, 5]);
		// Footprint z 0..1 (center 0.5) aligns its center to the room's z center 4.5.
		expect(alignedPositionOf(roomGeometry, 'box', { kind: 'room', id: 'room-9' }, 'center', 'z')).toEqual([0, 0.5, 4]);
	});

	it('aligns to a straight Wall compiled span AABB', () => {
		const wallGeometry = referenceGeometry();
		wallGeometry.queries.spans.push(wallSpan('wall-a', [5, 3], [9, 6]));
		expect(alignedPositionOf(wallGeometry, 'box', { kind: 'wall', id: 'wall-a' }, 'min')).toEqual([5, 0.5, 0]);
		expect(alignedPositionOf(wallGeometry, 'box', { kind: 'wall', id: 'wall-a' }, 'center')).toEqual([6, 0.5, 0]);
	});
});	describe('P23.2 center-on-wall alignment', () => {
	it('projects the footprint center onto the canonical wall span', () => {
		const geometry = emptyGeometry();
		geometry.objects.push(
			boxObject('diamond', [0, 0, 0], [
				[1, 0],
				[2, 1],
				[1, 2],
				[0, 1]
			])
		);
		geometry.queries.spans.push(wallSpan('floor-wall', [0, 0], [10, 0]));
		const plan = planLayoutObjectAlign(geometry, 'diamond', { kind: 'wall', id: 'floor-wall' }, 'center-on-wall');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// Footprint center [1,1] projects to [1,0]: only Z moves, X is preserved.
		expect(plan.position).toEqual([0, 0, -1]);
	});

	it('clamps the projection to the wall span ends', () => {
		const geometry = emptyGeometry();
		geometry.objects.push(
			boxObject('beyond', [8, 0, 0], [
				[9, 0],
				[10, 1],
				[9, 2],
				[8, 1]
			])
		);
		geometry.queries.spans.push(wallSpan('short-wall', [0, 0], [4, 0]));
		const plan = planLayoutObjectAlign(geometry, 'beyond', { kind: 'wall', id: 'short-wall' }, 'center-on-wall');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.position).toEqual([3, 0, -1]);
	});

	it('centers on the full extent of a compiled-shaped multi-span wall', () => {
		// The compiler emits one wall query span per sample interval
		// (0.25 m for straight lines), so a 10 m wall arrives as 40 spans.
		const geometry = emptyGeometry();
		geometry.objects.push(
			boxObject('box', [1, 0.5, 1], [
				[0.5, 0.5],
				[1.5, 0.5],
				[1.5, 1.5],
				[0.5, 1.5]
			])
		);
		for (let start = 0; start < 10; start += 0.25) {
			geometry.queries.spans.push(
				wallSpan('multi', [start, 0], [start + 0.25, 0], 'r', start)
			);
		}
		const plan = planLayoutObjectAlign(geometry, 'box', { kind: 'wall', id: 'multi' }, 'center-on-wall');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// Footprint center [1,1] projects onto the FULL wall at [1,0]: the
		// along-wall coordinate is preserved and Z moves 1 → 0. Before the
		// merge fix this resolved against the first 0.25 m sample and the
		// object was dragged to x=0.25.
		expect(plan.position[0]).toBeCloseTo(1, 6);
		expect(plan.position[2]).toBeCloseTo(0, 6);
	});

	it('merges reversed shared-wall spans across rooms into the full extent', () => {
		// A wall shared by two rooms compiles spans for both: room 'a'
		// traverses forward (startDistance from the true start), room 'b'
		// traverses reversed (startDistance from the true end).
		const geometry = emptyGeometry();
		geometry.objects.push(
			boxObject('box', [1, 0.5, 1], [
				[0.5, 0.5],
				[1.5, 0.5],
				[1.5, 1.5],
				[0.5, 1.5]
			])
		);
		for (let start = 0; start < 10; start += 0.25) {
			geometry.queries.spans.push(wallSpan('shared', [start, 0], [start + 0.25, 0], 'a', start));
			geometry.queries.spans.push(wallSpan('shared', [10 - start, 0], [10 - start - 0.25, 0], 'b', start));
		}
		const plan = planLayoutObjectAlign(geometry, 'box', { kind: 'wall', id: 'shared' }, 'center-on-wall');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// Same as the multi-span case: the merged extent preserves the
		// along-wall coordinate (x=1) instead of clamping to the first
		// sample chunk near the wall start.
		expect(plan.position[0]).toBeCloseTo(1, 6);
		expect(plan.position[2]).toBeCloseTo(0, 6);
	});
});

describe('P23.2 alignment invariants', () => {
	it('preserves Y, rotation-affecting fields, dimensions and returns reference metadata', () => {
		const geometry = referenceGeometry();
		const box = geometry.objects[0]!;
		box.position = [0, 1.25, 0];
		box.dimensions = [2, 0.5, 3];
		const plan = planLayoutObjectAlign(geometry, 'box', { kind: 'object', id: 'ref' }, 'center');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.position[1]).toBe(1.25);
		expect(box.rotation).toEqual([0, 0, 0]);
		expect(box.dimensions).toEqual([2, 0.5, 3]);
		expect(plan.reference).toEqual({ kind: 'object', id: 'ref' });
		expect(plan.action).toBe('center');
		expect(plan.axis).toBe('x');
	});

	it('reports no_op when already aligned so callers add no history', () => {
		const geometry = referenceGeometry();
		const first = planLayoutObjectAlign(geometry, 'box', { kind: 'object', id: 'ref' }, 'min');
		expect(first.kind).toBe('success');
		if (first.kind !== 'success') return;
		const geometry2 = referenceGeometry();
		geometry2.objects[0]!.position = [...first.position] as [number, number, number];
		geometry2.objects[0]!.planFootprint = geometry2.objects[0]!.planFootprint.map(([x, z]) => [
			x + first.position[0],
			z
		]);
		const second = planLayoutObjectAlign(geometry2, 'box', { kind: 'object', id: 'ref' }, 'min');
		expect(second).toMatchObject({ kind: 'rejected', code: 'no_op' });
	});
});

describe('P23.2 alignment rejections', () => {
	it('rejects unknown objects and unknown references', () => {
		const geometry = referenceGeometry();
		expect(planLayoutObjectAlign(geometry, 'ghost', { kind: 'object', id: 'ref' }, 'min')).toMatchObject({
			kind: 'rejected',
			code: 'unknown_object'
		});
		expect(planLayoutObjectAlign(geometry, 'box', { kind: 'object', id: 'ghost' }, 'min')).toMatchObject({
			kind: 'rejected',
			code: 'unknown_reference'
		});
		expect(planLayoutObjectAlign(geometry, 'box', { kind: 'room', id: 'ghost-room' }, 'min')).toMatchObject({
			kind: 'rejected',
			code: 'unknown_reference'
		});
		expect(planLayoutObjectAlign(geometry, 'box', { kind: 'wall', id: 'ghost-wall' }, 'min')).toMatchObject({
			kind: 'rejected',
			code: 'unknown_reference'
		});
	});
});

describe('P23.2 align reference identity', () => {
	it('keys references by kind:id so colliding ids never collapse', () => {
		expect(alignReferenceKey({ kind: 'object', id: 'foo' })).toBe('object:foo');
		expect(alignReferenceKey({ kind: 'wall', id: 'foo' })).toBe('wall:foo');
		expect(alignReferenceKey({ kind: 'room', id: 'foo' })).toBe('room:foo');
		expect(alignReferenceKey({ kind: 'object', id: 'foo' })).not.toBe(alignReferenceKey({ kind: 'wall', id: 'foo' }));
	});

	it('resolves a wall reference independently of a same-id object reference', () => {
		// Object `foo` (x 5..9, center 7) and wall `foo` (x 0..4, center 2)
		// both legally exist: lookups keyed on id alone would collapse them.
		const geometry = emptyGeometry();
		geometry.objects.push(
			originBox(),
			boxObject('foo', [5, 0.5, 3], [[5, 3], [9, 3], [9, 6], [5, 6]])
		);
		geometry.queries.polygons.push(
			footprintPolygon('box', [[0, 0], [2, 0], [2, 1], [0, 1]]),
			footprintPolygon('foo', [[5, 3], [9, 3], [9, 6], [5, 6]])
		);
		geometry.queries.spans.push(wallSpan('foo', [0, 0], [4, 0]));
		// Wall `foo` bounds x 0..4 (center 2): box footprint x 0..2 (center 1) → x = 1.
		expect(alignedPositionOf(geometry, 'box', { kind: 'wall', id: 'foo' }, 'center')).toEqual([1, 0.5, 0]);
		// Object `foo` bounds x 5..9 (center 7) → x = 6.
		expect(alignedPositionOf(geometry, 'box', { kind: 'object', id: 'foo' }, 'center')).toEqual([6, 0.5, 0]);
	});
});

describe('P23.2 center-on-wall with negative slope', () => {
	it('projects onto the true negative-slope diagonal, not the bounding-box anti-diagonal', () => {
		const geometry = emptyGeometry();
		geometry.objects.push(
			boxObject('box', [1, 0.5, 1], [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]])
		);
		for (let start = 0; start < 4; start += 1) {
			geometry.queries.spans.push(wallSpan('diag', [start, 4 - start], [start + 1, 3 - start], 'r', start));
		}
		const plan = planLayoutObjectAlign(geometry, 'box', { kind: 'wall', id: 'diag' }, 'center-on-wall');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// Footprint center [1,1] projects onto the true diagonal at [2,2]:
		// a min/max merge would project onto the anti-diagonal and report a
		// no-op instead.
		expect(plan.position[0]).toBeCloseTo(2, 6);
		expect(plan.position[2]).toBeCloseTo(2, 6);
		expect(plan.position[1]).toBe(0.5);
	});

	it('rejects center-on-wall for a curved wall but keeps bounds actions', () => {
		const geometry = emptyGeometry();
		geometry.objects.push(
			boxObject('box', [1, 0.5, 0], [[1, 0], [3, 0], [3, 1], [1, 1]])
		);
		// Two-chord arc through (1,1): sample path longer than the chord.
		geometry.queries.spans.push(wallSpan('arc', [0, 0], [1, 1]), wallSpan('arc', [1, 1], [2, 0]));
		expect(planLayoutObjectAlign(geometry, 'box', { kind: 'wall', id: 'arc' }, 'center-on-wall')).toMatchObject({
			kind: 'rejected',
			code: 'unsupported_reference'
		});
		// Bounds actions still resolve from the compiled sample AABB: box
		// max x 3 aligns to the arc AABB max x 2 → x=0.
		expect(planLayoutObjectAlign(geometry, 'box', { kind: 'wall', id: 'arc' }, 'max', 'x')).toMatchObject({
			kind: 'success',
			position: [0, 0.5, 0]
		});
	});

	it('resolves a legacy wall reference inside the selected object room only', () => {
		const geometry = emptyGeometry();
		const box = originBox();
		box.roomId = 'room-a';
		geometry.objects.push(box);
		// Room 'a' wall-1 is the diagonal (0,4) → (4,0) (x bounds 0..4); room
		// 'b' wall-1 is the horizontal (10,0) → (14,0) (x bounds 10..14).
		for (let start = 0; start < 4; start += 1) {
			geometry.queries.spans.push({
				...wallSpan('wall-1', [start, 4 - start], [start + 1, 3 - start], 'room-a', start),
				wallKey: 'f:room-a:wall-1'
			});
			geometry.queries.spans.push({
				...wallSpan('wall-1', [10 + start, 0], [11 + start, 0], 'room-b', start),
				wallKey: 'f:room-b:wall-1'
			});
		}
		// Box footprint x 0..2 (max 2) aligns to room-a wall-1 max x=4 → x=2.
		// Resolving against room-b wall-1 would give x=12.
		expect(planLayoutObjectAlign(geometry, 'box', { kind: 'wall', id: 'wall-1' }, 'max', 'x')).toMatchObject({
			kind: 'success',
			position: [2, 0.5, 0]
		});
	});

	it('merges reversed shared negative-slope spans for center-on-wall', () => {
		const geometry = emptyGeometry();
		geometry.objects.push(
			boxObject('box', [1, 0.5, 1], [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]])
		);
		for (let start = 0; start < 4; start += 1) {
			geometry.queries.spans.push(wallSpan('diag', [start, 4 - start], [start + 1, 3 - start], 'a', start));
			geometry.queries.spans.push(wallSpan('diag', [4 - start, start], [3 - start, start + 1], 'b', start));
		}
		const plan = planLayoutObjectAlign(geometry, 'box', { kind: 'wall', id: 'diag' }, 'center-on-wall');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.position[0]).toBeCloseTo(2, 6);
		expect(plan.position[2]).toBeCloseTo(2, 6);
	});
});

describe('P23.2 alignment rejections', () => {
	it('rejects profile objects and invalid action/reference combinations', () => {
		const geometry = referenceGeometry();
		geometry.objects.push(boxObject('stencil', [0, 0.5, 0], [[0, 0], [1, 1]], 'profile'));
		expect(planLayoutObjectAlign(geometry, 'stencil', { kind: 'object', id: 'ref' }, 'min')).toMatchObject({
			kind: 'rejected',
			code: 'unsupported_reference'
		});
		expect(planLayoutObjectAlign(geometry, 'box', { kind: 'object', id: 'ref' }, 'center-on-wall')).toMatchObject({
			kind: 'rejected',
			code: 'unsupported_reference'
		});
		expect(planLayoutObjectAlign(geometry, 'box', { kind: 'object', id: 'ref' }, 'diagonal' as never)).toMatchObject({
			kind: 'rejected',
			code: 'invalid_action'
		});
	});
});
