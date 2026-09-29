import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	P23B_M1_ARM_RULE,
	P23B_M1_ROOM_DRAG_ARMS,
	p23bM1ActionArmRecords,
	p23bM1ActionArms,
	p23bM1RecordActionArm,
	p23bM1ResetActionArms,
	p23bM1RoomDragArm,
	setP23bM1RoomDragArm
} from '$lib/editor/layout/p23b-m1-room-drag-arm';

/**
 * The room-drag arm is retired to the shipped path (P23B.8 S8), so its gate is
 * pinned here rather than left to the live harness: the reader always returns
 * `transient`, and the registry may only attribute an action to the arm it
 * actually ran under.
 */
const globals = globalThis as {
	__P2311_PERF__?: boolean;
	__P23B_M1_ROOM_DRAG_ARM__?: string;
};

describe('M1 room-drag arm — the DEV switch (P23B.8 S8: comparison retired)', () => {
	beforeEach(() => {
		delete globals.__P2311_PERF__;
		delete globals.__P23B_M1_ROOM_DRAG_ARM__;
		p23bM1ResetActionArms();
	});

	afterEach(() => {
		delete globals.__P2311_PERF__;
		delete globals.__P23B_M1_ROOM_DRAG_ARM__;
		p23bM1ResetActionArms();
	});

	it('always runs the shipped path: the pre-change path is retired', () => {
		// The arm global alone is not enough — and even with the instrument on,
		// the retired pre-change path is unreachable: only `transient` remains.
		setP23bM1RoomDragArm('transient');
		expect(p23bM1RoomDragArm()).toBe('transient');

		globals.__P2311_PERF__ = true;
		expect(p23bM1RoomDragArm()).toBe('transient');
		setP23bM1RoomDragArm(null);
		expect(p23bM1RoomDragArm()).toBe('transient');
	});

	it('defaults to the shipped path, and ignores a value it does not know', () => {
		globals.__P2311_PERF__ = true;
		expect(p23bM1RoomDragArm()).toBe('transient');
		globals.__P23B_M1_ROOM_DRAG_ARM__ = 'something-else';
		expect(p23bM1RoomDragArm()).toBe('transient');
		setP23bM1RoomDragArm('transient');
		expect(p23bM1RoomDragArm()).toBe('transient');
		setP23bM1RoomDragArm(null);
		expect(p23bM1RoomDragArm()).toBe('transient');
	});

	it('lists only the shipped path, and states the one-session rule old legs were read under', () => {
		expect(P23B_M1_ROOM_DRAG_ARMS).toEqual(['transient']);
		expect(P23B_M1_ARM_RULE).toContain('comparison is retired');
		// The rule must say that a cross-session delta is NOT admissible: that is
		// the rule old legs were read under (session drift is ×0.38–×1.03).
		expect(P23B_M1_ARM_RULE).toContain('session-conditioned');
	});
});

describe('M1 room-drag arm — the per-action registry', () => {
	beforeEach(() => p23bM1ResetActionArms());
	afterEach(() => p23bM1ResetActionArms());

	it('keys an arm to its fixture, class and action index, and to nothing else', () => {
		p23bM1RecordActionArm('f1', 'p23b-m1:whole-room-move-bridge', 3, 'transient');
		p23bM1RecordActionArm('f1', 'p23b-m1:whole-room-move-bridge', 4, 'transient');
		p23bM1RecordActionArm('f2', 'p23b-m1:whole-room-move-bridge', 3, 'transient');
		p23bM1RecordActionArm('f1', 'p23b-m1:rigid-wall-drag', 3, 'transient');

		expect([...p23bM1ActionArms('f1', 'p23b-m1:whole-room-move-bridge')]).toEqual([
			[3, 'transient'],
			[4, 'transient']
		]);
		expect([...p23bM1ActionArms('f2', 'p23b-m1:whole-room-move-bridge')]).toEqual([[3, 'transient']]);
		// A class that recorded nothing reads as an empty map — never as "all one
		// arm", which would silently invent a before/after for an uninstrumented run.
		expect(p23bM1ActionArms('f1', 'p23b-m1:bend').size).toBe(0);
		expect(p23bM1ActionArms('f2', 'p23b-m1:rigid-wall-drag').size).toBe(0);
	});

	it('hands back copies, so a reader can never mutate the registry', () => {
		p23bM1RecordActionArm('f1', 'p23b-m1:whole-room-move-bridge', 0, 'transient');
		const records = p23bM1ActionArmRecords();
		expect(records).toHaveLength(1);
		(records[0] as { arm: string }).arm = 'transient-mutated';
		expect(p23bM1ActionArmRecords()[0]?.arm).toBe('transient');
	});

	it('drops everything on reset, so arms cannot leak from one run into the next', () => {
		p23bM1RecordActionArm('f1', 'p23b-m1:whole-room-move-bridge', 0, 'transient');
		p23bM1ResetActionArms();
		expect(p23bM1ActionArmRecords()).toHaveLength(0);
		expect(p23bM1ActionArms('f1', 'p23b-m1:whole-room-move-bridge').size).toBe(0);
	});
});
