/**
 * PR #287 — Ink must hit the curved Wall the Stage drew, not its endpoint chord.
 */
import { describe, expect, it } from 'vitest';

import {
	classifyInkPointerTarget,
	offsetAlongWall,
	pointAlongWall,
	pointOnWallCenterline,
	projectedWallLength,
	type ProjectedWall
} from '$lib/authoring/adapters/layout/ink';

const SPAN = Math.hypot(5, 3);

const curved: ProjectedWall = {
	id: 'wall-curve',
	startCss: [0, 0],
	endCss: [100, 0],
	start: [0, 0],
	end: [10, 0],
	path: [
		[0, 0],
		[5, 3],
		[10, 0]
	],
	pathCss: [
		[0, 0],
		[50, 30],
		[100, 0]
	]
};

describe('PR287 — curved Ink hit test', () => {
	it('names the curved body the Stage drew and rejects the endpoint chord', () => {
		expect(classifyInkPointerTarget({ css: [50, 30], junctions: [], walls: [curved] })).toEqual({
			kind: 'host',
			wallId: 'wall-curve'
		});
		// The chord's midpoint is 30 CSS px from the drawn curve: outside the 6 px
		// Wall tolerance, so it must never be reported as a host.
		expect(classifyInkPointerTarget({ css: [50, 0], junctions: [], walls: [curved] })).toBeNull();
	});

	it('projects the split point, arc-length offset and inverse point on the curve', () => {
		const split = pointOnWallCenterline(curved, [5, 5]);
		expect(split[0]).toBeCloseTo(5, 6);
		expect(split[1]).toBeCloseTo(3, 6);
		expect(projectedWallLength(curved)).toBeCloseTo(SPAN * 2, 6);
		expect(offsetAlongWall(curved, [5, 3])).toBeCloseTo(SPAN, 6);
		const inverse = pointAlongWall(curved, SPAN);
		expect(inverse[0]).toBeCloseTo(5, 6);
		expect(inverse[1]).toBeCloseTo(3, 6);
	});
});
