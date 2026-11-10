/**
 * PR #287 — entering Unroll must preserve the current Camera pose.
 *
 * The store owns no Camera; it may only ask the route for the legacy conditional
 * return. Entry, scrub and face changes must issue no request at all.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type CompiledPhysicalWall
} from '@portfolio/layout-core';

import {
	wallUnfold,
	type WallUnfoldCameraRequest
} from '$lib/authoring/layout/wall-unfold-store.svelte';
import { freshCapture } from './__fixtures__/layout-id-capture';

const ENTRY = {
	pose: {
		target: [2, 0, 1] as [number, number, number],
		azimuthRadians: 0.4,
		elevationRadians: 0.7,
		targetPlaneHeightMeters: 0
	},
	reading: '3d' as const
};

function straightWall(): CompiledPhysicalWall {
	const base = createEmptyWallFirstLayoutDocument();
	const plan = planWallChain({
		baseline: base,
		points: [
			[0, 0],
			[6, 0]
		],
		close: false,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (plan.kind !== 'success') throw new Error('the straight fixture was refused');
	const wall = compileWallFirstLayoutGeometry(plan.document).geometry.walls[0];
	if (wall === undefined) throw new Error('the straight fixture compiled no Wall');
	return wall;
}

describe('PR287 — Unroll preserves the Camera', () => {
	it('never asks for a fit on entry, scrub, face change or Put back', () => {
		const wall = straightWall();
		const executor = vi.fn<(request: WallUnfoldCameraRequest) => boolean>(() => true);
		wallUnfold.setCameraExecutor(executor);
		try {
			wallUnfold.enter(wall, 0, ENTRY);
			expect(wallUnfold.state?.anchorStation).toBe(0);
			expect(executor).not.toHaveBeenCalled();

			wallUnfold.setU(wall, 0.45);
			wallUnfold.flip(wall);
			expect(executor).not.toHaveBeenCalled();

			wallUnfold.exit(wall);
			// Put back may ask for the legacy exact return, but it must be typed as
			// unadjusted so the route's own conditional guard refuses any move.
			expect(executor).toHaveBeenCalledTimes(1);
			expect(executor.mock.calls[0]?.[0]).toMatchObject({ kind: 'return', entryAdjusted: false });
		} finally {
			wallUnfold.exit();
			wallUnfold.setCameraExecutor(null);
		}
	});

	it('produces the same default anchor on repeated entry from any entry pose', () => {
		const wall = straightWall();
		wallUnfold.setCameraExecutor(null);
		wallUnfold.enter(wall, 0, ENTRY);
		const first = wallUnfold.state?.anchorStation;
		wallUnfold.exit(wall);
		wallUnfold.enter(wall, 0, {
			...ENTRY,
			pose: { ...ENTRY.pose, target: [5, 2, -3], azimuthRadians: 2.1 }
		});
		expect(wallUnfold.state?.anchorStation).toBe(first);
		wallUnfold.exit();
	});
});
