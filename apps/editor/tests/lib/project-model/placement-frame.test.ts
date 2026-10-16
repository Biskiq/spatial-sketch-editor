/**
 * T2.P01.S01 exit criteria — the explicit yaw-only local input frame.
 *
 * One contract: the contract's forward and inverse conversion, the direction
 * conversion's exclusion of translation, and the single composition of frame
 * yaw with local yaw. The round-trip assertions use a nonzero origin, yaw and
 * elevation, because a frame at the origin with yaw 0 cannot fail.
 */
import { describe, expect, it } from 'vitest';
import {
	frameDirectionFromWorld,
	frameDirectionToWorld,
	framePointFromWorld,
	framePointToWorld,
	frameYawFromWorld,
	frameYawToWorld,
	isFinitePlacementFrame,
	type LocalInputFrame,
	type Vec3
} from '@portfolio/project-model';

const QUARTER_TURN: LocalInputFrame = { origin: [1, 2, 3], yaw: Math.PI / 2 };
const TILTED: LocalInputFrame = { origin: [1, 0.5, 2], yaw: 0.4 };

describe('the yaw-only local input frame', () => {
	it('converts a local point with the contract formula', () => {
		// cos(pi/2) = 0, sin(pi/2) = 1: world.x = 1 + 1*0 + 0*1, world.z = 3 - 1*1 + 0*0.
		const world = framePointToWorld(QUARTER_TURN, [1, 0, 0]);
		expect(world[0]).toBeCloseTo(1, 12);
		expect(world[1]).toBe(2);
		expect(world[2]).toBeCloseTo(2, 12);
		// The frame's own origin height is carried by the point conversion only;
		// the placement planner takes its resting Y from Layout support instead.
		expect(framePointToWorld(QUARTER_TURN, [0, 0.5, 2])[1]).toBe(2.5);
	});

	it('round-trips a nonzero origin, yaw and elevation', () => {
		const local: Vec3 = [0.3, 1.7, -1.2];
		const world = framePointToWorld(TILTED, local);
		const back = framePointFromWorld(TILTED, world);
		expect(back[0]).toBeCloseTo(local[0], 12);
		expect(back[1]).toBeCloseTo(local[1], 12);
		expect(back[2]).toBeCloseTo(local[2], 12);
	});

	it('excludes translation from direction conversion', () => {
		expect(frameDirectionToWorld(QUARTER_TURN, [0, 1, 0])).toEqual([0, 1, 0]);
		const rotated = frameDirectionToWorld(QUARTER_TURN, [1, 0, 0]);
		expect(rotated[0]).toBeCloseTo(0, 12);
		expect(rotated[1]).toBe(0);
		expect(rotated[2]).toBeCloseTo(-1, 12);
		const direction: Vec3 = [0.4, -0.2, 0.9];
		const back = frameDirectionFromWorld(TILTED, frameDirectionToWorld(TILTED, direction));
		expect(back[0]).toBeCloseTo(direction[0], 12);
		expect(back[1]).toBeCloseTo(direction[1], 12);
		expect(back[2]).toBeCloseTo(direction[2], 12);
	});

	it('composes the frame yaw once and round-trips through normalization', () => {
		expect(frameYawToWorld(TILTED, 0)).toBeCloseTo(TILTED.yaw, 12);
		// 0.4 + 2.9 = 3.3 rad normalizes into (-pi, pi] as 3.3 - 2*pi.
		const composed = frameYawToWorld(TILTED, 2.9);
		expect(composed).toBeCloseTo(3.3 - Math.PI * 2, 12);
		expect(frameYawFromWorld(TILTED, composed)).toBeCloseTo(2.9, 12);
	});

	it('rejects a frame the conversion math is not defined on', () => {
		expect(isFinitePlacementFrame(TILTED)).toBe(true);
		expect(isFinitePlacementFrame({ origin: [0, 0, 0], yaw: Number.NaN })).toBe(false);
		expect(isFinitePlacementFrame({ origin: [0, Number.POSITIVE_INFINITY, 0], yaw: 0 })).toBe(false);
		expect(isFinitePlacementFrame({ origin: [0, 0], yaw: 0 } as unknown as LocalInputFrame)).toBe(false);
	});
});


it('keeps composed yaw consistent with the frame matrix for huge finite radians', () => {
 const frame: LocalInputFrame = { origin: [0, 0, 0], yaw: Number.MAX_VALUE };
 const localYaw = Number.MAX_VALUE;
 const composed = frameYawToWorld(frame, localYaw);
 const direction = frameDirectionToWorld(frame, [Math.cos(localYaw), 0, -Math.sin(localYaw)]);
 expect(Math.cos(composed)).toBeCloseTo(direction[0], 12);
 expect(-Math.sin(composed)).toBeCloseTo(direction[2], 12);
});
