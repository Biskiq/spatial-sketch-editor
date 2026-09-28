import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	APPROXIMATE_TEXT_MEASURE,
	placeRoomLabels,
	roomFloorAreaM2,
	type RoomLabelFacts,
	type RoomLabelMask,
	type RoomLabelMemory
} from '$lib/editor/layout/plan-room-labels';
import {
	P23B_M1_ROOM_LABEL_ARMS,
	P23B_M1_ROOM_LABEL_ARM_RULE,
	p23bM1ActionLabelArmRecords,
	p23bM1ActionLabelArms,
	p23bM1RecordActionLabelArm,
	p23bM1ResetActionLabelArms,
	p23bM1RoomLabelArm,
	p23bM1RoomLabelArmEnabled,
	setP23bM1RoomLabelArm
} from '$lib/editor/layout/p23b-m1-room-label-arm';
import { createPlanViewportState, type PlanViewportState } from '$lib/editor/layout/layout-plan-transform';
import type { LayoutVec2 } from '$lib/layout/layout-types';

/**
 * The BEFORE/AFTER arm is the one thing a product module learns about M1, so two
 * things are pinned here and nowhere else:
 *
 * 1. the GATE — the arm may only select the pre-change grid when the DEV build AND
 *    `__P2311_PERF__` are both on, and the registry may only attribute an action to
 *    the arm it actually ran under; and
 * 2. the PARITY — both arms place labels IDENTICALLY on a fixture set that covers
 *    what the grid actually sees (long curved boundaries, concavity, masks of every
 *    kind, three zoom regimes, a sticky second pass). Without that, the arm would
 *    measure two behaviours instead of two costs.
 */
const globals = globalThis as {
	__P2311_PERF__?: boolean;
	__P23B_M1_ROOM_LABEL_ARM__?: string;
};

describe('M1 room-label arm — the DEV switch', () => {
	beforeEach(() => {
		delete globals.__P2311_PERF__;
		delete globals.__P23B_M1_ROOM_LABEL_ARM__;
		p23bM1ResetActionLabelArms();
	});

	afterEach(() => {
		delete globals.__P2311_PERF__;
		delete globals.__P23B_M1_ROOM_LABEL_ARM__;
		p23bM1ResetActionLabelArms();
	});

	it('cannot select the pre-change grid without the DEV measurement switch', () => {
		// The arm global alone is not enough: the whole instrument is gated like
		// every other capture-side one, so a stray global in a production build
		// still runs the shipped grid.
		setP23bM1RoomLabelArm('per-cell-grid');
		expect(p23bM1RoomLabelArmEnabled()).toBe(false);
		expect(p23bM1RoomLabelArm()).toBe('pruned-grid');

		globals.__P2311_PERF__ = true;
		expect(p23bM1RoomLabelArmEnabled()).toBe(true);
		expect(p23bM1RoomLabelArm()).toBe('per-cell-grid');
	});

	it('defaults to the shipped grid, and ignores a value it does not know', () => {
		globals.__P2311_PERF__ = true;
		expect(p23bM1RoomLabelArm()).toBe('pruned-grid');
		globals.__P23B_M1_ROOM_LABEL_ARM__ = 'something-else';
		expect(p23bM1RoomLabelArm()).toBe('pruned-grid');
		setP23bM1RoomLabelArm('per-cell-grid');
		expect(p23bM1RoomLabelArm()).toBe('per-cell-grid');
		setP23bM1RoomLabelArm(null);
		expect(p23bM1RoomLabelArm()).toBe('pruned-grid');
	});

	it('interleaves the shipped grid first, and states the one-session rule it exists for', () => {
		expect(P23B_M1_ROOM_LABEL_ARMS).toEqual(['pruned-grid', 'per-cell-grid']);
		expect(P23B_M1_ROOM_LABEL_ARM_RULE).toContain('interleaved PER ATTEMPT');
		expect(P23B_M1_ROOM_LABEL_ARM_RULE).toContain('WITHIN-SESSION');
		expect(P23B_M1_ROOM_LABEL_ARM_RULE).toContain('session-conditioned');
		// The placer is a presentation cost, so the rule must say which rows it moves
		// and which row stands beside them as the control.
		expect(P23B_M1_ROOM_LABEL_ARM_RULE).toContain('post-release window');
		expect(P23B_M1_ROOM_LABEL_ARM_RULE).toContain('unchanged control');
	});
});

describe('M1 room-label arm — the per-action registry', () => {
	beforeEach(() => p23bM1ResetActionLabelArms());
	afterEach(() => p23bM1ResetActionLabelArms());

	it('keys an arm to its fixture, class and action index, and to nothing else', () => {
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:rigid-wall-drag', 3, 'per-cell-grid');
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:rigid-wall-drag', 4, 'pruned-grid');
		p23bM1RecordActionLabelArm('f2', 'p23b-m1:rigid-wall-drag', 3, 'pruned-grid');
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', 0, 'per-cell-grid');

		expect([...p23bM1ActionLabelArms('f1', 'p23b-m1:rigid-wall-drag')]).toEqual([
			[3, 'per-cell-grid'],
			[4, 'pruned-grid']
		]);
		expect([...p23bM1ActionLabelArms('f2', 'p23b-m1:rigid-wall-drag')]).toEqual([[3, 'pruned-grid']]);
		// A class that recorded nothing reads as an empty map — never as "all one
		// arm", which would silently invent a before/after for an uninstrumented run.
		expect(p23bM1ActionLabelArms('f1', 'p23b-m1:room-creation-commit').size).toBe(0);
		expect(p23bM1ActionLabelArms('f2', 'p23b-m1:bend').size).toBe(0);
	});

	it('drops everything on reset, so arms cannot leak from one run into the next', () => {
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:rigid-wall-drag', 0, 'per-cell-grid');
		p23bM1ResetActionLabelArms();
		expect(p23bM1ActionLabelArmRecords()).toHaveLength(0);
		expect(p23bM1ActionLabelArms('f1', 'p23b-m1:rigid-wall-drag').size).toBe(0);
	});
});

/* ------------------------------------------------------------------ *
 * The parity differential: the arm must move COST, never a placement
 * ------------------------------------------------------------------ */

function view(overrides: Partial<PlanViewportState> = {}): PlanViewportState {
	return { ...createPlanViewportState(), ...overrides };
}

function ring(roomId: string, radiusM: number, vertices: number, facts: Partial<RoomLabelFacts> = {}): RoomLabelFacts {
	const polygon: LayoutVec2[] = [];
	for (let index = 0; index < vertices; index += 1) {
		const angle = (index / vertices) * Math.PI * 2;
		polygon.push([Math.cos(angle) * radiusM, Math.sin(angle) * radiusM]);
	}
	return {
		roomId,
		polygon,
		name: facts.name !== undefined ? facts.name : 'Gallery',
		reference: facts.reference !== undefined ? facts.reference : 'R-7K3M',
		areaM2: facts.areaM2 !== undefined ? facts.areaM2 : roomFloorAreaM2(polygon)
	};
}

function rect(roomId: string, at: LayoutVec2, size: LayoutVec2, facts: Partial<RoomLabelFacts> = {}): RoomLabelFacts {
	const [x, z] = at;
	const [width, height] = size;
	const polygon: LayoutVec2[] = [
		[x, z],
		[x + width, z],
		[x + width, z + height],
		[x, z + height]
	];
	return {
		roomId,
		polygon,
		name: facts.name !== undefined ? facts.name : 'Gallery',
		reference: facts.reference !== undefined ? facts.reference : 'R-7K3M',
		areaM2: facts.areaM2 !== undefined ? facts.areaM2 : roomFloorAreaM2(polygon)
	};
}

/** A concave C-face: the ear-clipped interior point has to be reached through it. */
const concave = rect('room-c', [0, 0], [6, 6], { name: 'Store', reference: 'R-1111' });
concave.polygon = [
	[0, 0],
	[6, 0],
	[6, 2],
	[2, 2],
	[2, 4],
	[6, 4],
	[6, 6],
	[0, 6]
];
concave.areaM2 = roomFloorAreaM2(concave.polygon);

/** Every mask class the grid prices, with a long protected-edge polyline. */
const mask: RoomLabelMask = (() => {
	const edge: LayoutVec2[] = [];
	for (let index = 0; index < 64; index += 1) edge.push([-3 + (index / 63) * 6, -1.5 + Math.sin(index / 4) * 0.1]);
	return {
		protectedEdges: [{ points: edge, clearancePx: 12 }],
		obstacles: [{ polygon: [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]], clearancePx: 8 }],
		acquisitionZones: [{ center: [1.4, 1.4], radiusPx: 40, clearancePx: 4 }],
		activeText: [{ rect: { minX: -120, minY: 60, maxX: -20, maxY: 84 }, clearancePx: 24 }]
	};
})();

const cases: { name: string; rooms: RoomLabelFacts[]; planView: PlanViewportState; mask?: RoomLabelMask; reason?: 'geometry' | 'frozen' }[] = [
	{ name: 'one large rect', rooms: [rect('room-1', [0, 0], [6, 4])], planView: view() },
	{ name: 'concave face', rooms: [concave], planView: view() },
	{ name: 'curved 256-vertex boundary', rooms: [ring('room-r', 3, 256)], planView: view() },
	{ name: 'curved boundary, every mask class', rooms: [ring('room-m', 3, 96)], planView: view(), mask },
	{ name: 'two rooms, duplicate identity', rooms: [rect('room-a', [0, 0], [4, 3]), rect('room-b', [5, 0], [4, 3])], planView: view() },
	{ name: 'far zoom (mask budget coarsens the grid)', rooms: [ring('room-f', 6, 128)], planView: view({ pixelsPerMeter: 9 }) },
	{ name: 'near zoom', rooms: [ring('room-n', 3, 128)], planView: view({ pixelsPerMeter: 140 }) },
	{ name: 'frozen gesture (no relocation permitted)', rooms: [ring('room-z', 3, 64)], planView: view(), reason: 'frozen' }
];

/**
 * Run one case under one arm. The arm is set through the module's own switch, so
 * this exercises the same path the driver uses; the memory instance is per run,
 * because placement memory is mutated in place.
 */
function runCase(
	entry: (typeof cases)[number],
	arm: 'pruned-grid' | 'per-cell-grid',
	memory: RoomLabelMemory = new Map()
): { labels: unknown; readout: unknown; memory: [string, unknown][] } {
	globals.__P2311_PERF__ = true;
	setP23bM1RoomLabelArm(arm);
	// The case must have run under the arm it says it did: a gate that silently fell
	// back to the shipped grid would make this whole differential an agreement
	// between the shipped path and itself.
	expect(p23bM1RoomLabelArm()).toBe(arm);
	const result = placeRoomLabels({
		rooms: entry.rooms,
		planView: entry.planView,
		measure: APPROXIMATE_TEXT_MEASURE,
		...(entry.mask ? { mask: entry.mask } : {}),
		...(entry.reason ? { reason: entry.reason } : {}),
		settleGeneration: 4,
		memory
	});
	return {
		labels: result.labels,
		readout: result.readout,
		memory: [...result.memory.entries()].sort(([left], [right]) => left.localeCompare(right))
	};
}

describe('M1 room-label arm — both arms place labels identically', () => {
	afterEach(() => {
		delete globals.__P2311_PERF__;
		delete globals.__P23B_M1_ROOM_LABEL_ARM__;
	});

	it('agrees on every fixture, anchor and tier, and on the whole sticky memory', () => {
		for (const entry of cases) {
			const after = runCase(entry, 'pruned-grid');
			const before = runCase(entry, 'per-cell-grid');
			expect(before.labels, entry.name).toEqual(after.labels);
			expect(before.readout, entry.name).toEqual(after.readout);
			expect(before.memory, entry.name).toEqual(after.memory);
		}
	});

	it('agrees on the second pass, when the sticky memory is what decides', () => {
		// The second placement is the interesting one: the first pass fills the memory
		// and the second reads it, so a grid that visited a different cell would move a
		// label here even when pass one agreed.
		const entry = cases.find((candidate) => candidate.mask !== undefined)!;
		const afterMemory: RoomLabelMemory = new Map();
		const beforeMemory: RoomLabelMemory = new Map();
		let afterFirst: unknown = null;
		let beforeFirst: unknown = null;
		for (let pass = 0; pass < 2; pass += 1) {
			const after = runCase(entry, 'pruned-grid', afterMemory);
			const before = runCase(entry, 'per-cell-grid', beforeMemory);
			expect(before.labels, `${entry.name} pass ${pass}`).toEqual(after.labels);
			expect(before.memory, `${entry.name} pass ${pass}`).toEqual(after.memory);
			if (pass === 0) {
				afterFirst = after.labels;
				beforeFirst = before.labels;
			}
		}
		// A sanity check on the test itself: the fixture must have placed something,
		// or "both arms agree" would be an agreement about nothing.
		expect((afterFirst as unknown[]).length).toBeGreaterThan(0);
		expect(beforeFirst).toEqual(afterFirst);
	});
});
