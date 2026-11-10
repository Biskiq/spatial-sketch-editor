/**
 * PR #287 — entering Unroll must preserve the current Camera pose.
 *
 * The store owns no Camera; it may only ask the route for the legacy conditional
 * return. Entry, scrub and face changes must issue no request at all.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
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

	it('moves the pin without leaving the session or changing the face', () => {
		const wall = straightWall();
		wallUnfold.enter(wall, 1, ENTRY, { side: -1, insideSide: -1 });
		wallUnfold.setAnchor(wall, 4.25);
		expect(wallUnfold.state?.anchorStation).toBeCloseTo(4.25, 9);
		expect(wallUnfold.state?.side).toBe(-1);
		expect(wallUnfold.state?.insideSide).toBe(-1);
		expect(wallUnfold.state?.u).toBe(1);
		wallUnfold.exit();
	});

	it('retains the pin per Wall through Put back and re-entry', () => {
		const wall = straightWall();
		wallUnfold.setCameraExecutor(null);
		wallUnfold.forgetAnchor(wall.wallId);
		try {
			wallUnfold.enter(wall, 0, ENTRY);
			wallUnfold.setAnchor(wall, 4.25);
			expect(wallUnfold.anchorForWall(wall)).toBeCloseTo(4.25, 9);
			wallUnfold.exit();
			expect(wallUnfold.state).toBeNull();
			expect(wallUnfold.anchorForWall(wall)).toBeCloseTo(4.25, 9);

			const remembered = wallUnfold.anchorForWall(wall)!;
			wallUnfold.enter(wall, remembered, ENTRY);
			expect(wallUnfold.state?.anchorStation).toBeCloseTo(4.25, 9);
			wallUnfold.exit();
		} finally {
			wallUnfold.exit();
			wallUnfold.forgetAnchor(wall.wallId);
		}
	});

	it('does not overwrite an explicit pin when the idle default changes', () => {
		const wall = straightWall();
		wallUnfold.forgetAnchor(wall.wallId);
		try {
			expect(wallUnfold.ensureAnchor(wall, 2)).toBeCloseTo(2, 9);
			expect(wallUnfold.ensureAnchor(wall, 5)).toBeCloseTo(2, 9);
		} finally {
			wallUnfold.forgetAnchor(wall.wallId);
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

describe('PR287 — one persistent two-faced presentation', () => {
	afterEach(() => {
		wallUnfold.exit();
		vi.unstubAllGlobals();
	});

	it('keeps a persistent half-turn for each face, including reduced motion', () => {
		vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
		const wall = straightWall();
		wallUnfold.setCameraExecutor(null);
		wallUnfold.enter(wall, 0, ENTRY, { side: -1, insideSide: -1 });
		expect(wallUnfold.state?.side).toBe(-1);
		expect(wallUnfold.state?.insideSide).toBe(-1);
		expect(wallUnfold.presentationAngle).toBeCloseTo(Math.PI, 9);

		wallUnfold.flip(wall);
		expect(wallUnfold.state?.side).toBe(1);
		expect(wallUnfold.presentationAngle).toBeCloseTo(Math.PI * 2, 9);

		wallUnfold.flip(wall);
		expect(wallUnfold.state?.side).toBe(-1);
		expect(wallUnfold.presentationAngle).toBeCloseTo(Math.PI * 3, 9);
		expect(wallUnfold.state?.u).toBe(1);
	});

	it('continues from the on-screen angle when a rapid flip reverses', () => {
		let now = 0;
		const frames: ((time: number) => void)[] = [];
		vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
		vi.stubGlobal('performance', { now: () => now });
		vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
			frames.push(callback);
			return frames.length;
		});
		vi.stubGlobal('cancelAnimationFrame', () => {
			frames.length = 0;
		});
		const step = (time: number): void => {
			const callback = frames.shift();
			callback?.(time);
		};
		const wall = straightWall();
		wallUnfold.setCameraExecutor(null);
		wallUnfold.enter(wall, 0, ENTRY);
		wallUnfold.setU(wall, 0.45);
		wallUnfold.flip(wall);
		expect(wallUnfold.presentationAngle).toBe(0);

		now = 130;
		step(130);
		expect(wallUnfold.presentationAngle).toBeCloseTo(Math.PI / 2, 6);

		wallUnfold.flip(wall);
		expect(wallUnfold.presentationAngle).toBeCloseTo(Math.PI / 2, 6);
		now = 260;
		step(260);
		// The second flip starts from the half-turned sheet, not from π or zero.
		expect(wallUnfold.presentationAngle).toBeCloseTo(Math.PI / 4, 6);
		now = 390;
		step(390);
		expect(wallUnfold.presentationAngle).toBeCloseTo(0, 6);
		expect(wallUnfold.state?.u).toBe(0.45);
	});
});
