import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	APPROXIMATE_TEXT_MEASURE,
	placeRoomLabels,
	resetRoomLabelGridCache,
	roomFloorAreaM2,
	type RoomLabelFacts,
	type RoomLabelMask,
	type RoomLabelMemory
} from '$lib/editor/layout/plan-room-labels';
import {
	P23B_M1_ROOM_LABEL_ARMS,
	P23B_M1_ROOM_LABEL_ARM_AFTER,
	P23B_M1_ROOM_LABEL_ARM_RULE,
	p23bM1ActionLabelArmRecords,
	p23bM1ActionLabelArmRecordsFor,
	p23bM1GridBuildKey,
	p23bM1GridBuildKeys,
	p23bM1RecordActionLabelArm,
	p23bM1RecordRoomLabelCall,
	p23bM1RoomLabelAttemptKeys,
	p23bM1RoomLabelAttemptSequence,
	p23bM1ResetActionLabelArms,
	p23bM1RoomLabelArm,
	p23bM1RoomLabelArmEnabled,
	p23bM1RoomLabelGridBuilds,
	p23bM1RoomLabelMemoHits,
	setP23bM1RoomLabelArm,
	type P23BM1GridBuildInputs,
	type P23BM1RoomLabelArm
} from '$lib/editor/layout/p23b-m1-room-label-arm';
import { createPlanViewportState, type PlanViewportState } from '$lib/editor/layout/layout-plan-transform';
import type { LayoutVec2 } from '$lib/layout/layout-types';

/**
 * The label arm is the one thing a product module learns about M1, so two
 * things are pinned here and nowhere else:
 *
 * 1. the GATE — the bypass grid may be selected only when the DEV build AND
 *    `__P2311_PERF__` are both on, and the registry may only attribute an action to
 *    the arm it actually ran under;
 * 2. the PARITY — BOTH arms place labels IDENTICALLY on a fixture set that covers
 *    what the grid actually sees (long curved boundaries, concavity, masks of every
 *    kind, three zoom regimes, a sticky second pass). Without that, the arm would
 *    measure two behaviours instead of two costs; and the memo arm is asserted to have
 *    HIT as well as to agree, because a cache that never hit would pass the parity by
 *    doing nothing at all; and
 * 3. the BUILD COUNT — the shipped placer reads the arm once per grid build, so the
 *    switch's own call count is the grid's build count. It is pinned here because a
 *    later "reuse the grid" change would be measured with it.
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

	it('cannot select an experimental grid without the DEV measurement switch', () => {
		// The arm global alone is not enough: the whole instrument is gated like
		// every other capture-side one, so a stray global in a production build
		// still runs the shipped grid.
		setP23bM1RoomLabelArm('no-memo-grid');
		expect(p23bM1RoomLabelArmEnabled()).toBe(false);
		expect(p23bM1RoomLabelArm()).toBe(P23B_M1_ROOM_LABEL_ARM_AFTER);

		globals.__P2311_PERF__ = true;
		expect(p23bM1RoomLabelArmEnabled()).toBe(true);
		expect(p23bM1RoomLabelArm()).toBe('no-memo-grid');
	});

	it('defaults to the shipped grid, and ignores a value it does not know', () => {
		globals.__P2311_PERF__ = true;
		expect(p23bM1RoomLabelArm()).toBe('seeded-grid');
		globals.__P23B_M1_ROOM_LABEL_ARM__ = 'something-else';
		expect(p23bM1RoomLabelArm()).toBe('seeded-grid');
		// The bypass arm is not a second grid but the SHIPPED grid with its cache skipped, so
		// it must be selectable by name and must never fall back to the shipped path.
		// (P23B.8 S8: the pre-change and previous grids are retired.)
		setP23bM1RoomLabelArm('no-memo-grid');
		expect(p23bM1RoomLabelArm()).toBe('no-memo-grid');
		setP23bM1RoomLabelArm(null);
		expect(p23bM1RoomLabelArm()).toBe('seeded-grid');
	});

	it('counts the grid builds the switch is read for, and starts a new count per arm change', () => {
		globals.__P2311_PERF__ = true;
		setP23bM1RoomLabelArm('seeded-grid');
		expect(p23bM1RoomLabelGridBuilds()).toBe(0);
		p23bM1RoomLabelArm();
		p23bM1RoomLabelArm();
		expect(p23bM1RoomLabelGridBuilds()).toBe(2);
		// The count belongs to ONE attempt: the arm is chosen per attempt, so changing
		// it is what closes the previous attempt's window.
		setP23bM1RoomLabelArm('no-memo-grid');
		expect(p23bM1RoomLabelGridBuilds()).toBe(0);
		// And it counts a production read too: the gate cannot hide a build.
		delete globals.__P2311_PERF__;
		p23bM1RoomLabelArm();
		expect(p23bM1RoomLabelGridBuilds()).toBe(1);
	});

	it('interleaves the shipped grid first, and states the one-session rule it exists for', () => {
		expect(P23B_M1_ROOM_LABEL_ARMS).toEqual(['seeded-grid', 'no-memo-grid']);
		expect(P23B_M1_ROOM_LABEL_ARM_AFTER).toBe('seeded-grid');
		expect(P23B_M1_ROOM_LABEL_ARM_RULE).toContain('interleaved PER ATTEMPT');
		expect(P23B_M1_ROOM_LABEL_ARM_RULE).toContain('WITHIN-SESSION');
		expect(P23B_M1_ROOM_LABEL_ARM_RULE).toContain('session-conditioned');
	});
});

describe('M1 room-label arm — the per-action registry', () => {
	beforeEach(() => p23bM1ResetActionLabelArms());
	afterEach(() => p23bM1ResetActionLabelArms());

	it('keys an arm to its fixture, class and action index, and to nothing else', () => {
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:rigid-wall-drag', 3, 'no-memo-grid');
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:rigid-wall-drag', 4, 'seeded-grid');
		p23bM1RecordActionLabelArm('f2', 'p23b-m1:rigid-wall-drag', 3, 'seeded-grid');
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', 0, 'no-memo-grid');

		expect(
			p23bM1ActionLabelArmRecordsFor('f1', 'p23b-m1:rigid-wall-drag').map((record) => [
				record.actionIndex,
				record.arm
			])
		).toEqual([
			[3, 'no-memo-grid'],
			[4, 'seeded-grid']
		]);
		expect(p23bM1ActionLabelArmRecordsFor('f2', 'p23b-m1:rigid-wall-drag')).toHaveLength(1);
		expect(p23bM1ActionLabelArmRecordsFor('f2', 'p23b-m1:rigid-wall-drag')[0]?.arm).toBe(
			'seeded-grid'
		);
		// The build count travels with the action it was measured for: it is the same
		// attempt window the arm belongs to, so a record can never pair an arm with a
		// count taken while another arm was live.
		expect(p23bM1ActionLabelArmRecords().map((record) => record.builds)).toEqual([0, 0, 0, 0]);
		setP23bM1RoomLabelArm('no-memo-grid');
		p23bM1RoomLabelArm();
		p23bM1RoomLabelArm();
		p23bM1RoomLabelArm();
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:rigid-wall-drag', 5, 'no-memo-grid');
		expect(p23bM1ActionLabelArmRecords().at(-1)?.builds).toBe(3);
		// A class that recorded nothing reads as an empty map — never as "all one
		// arm", which would silently invent a before/after for an uninstrumented run.
		expect(p23bM1ActionLabelArmRecordsFor('f1', 'p23b-m1:room-creation-commit')).toHaveLength(0);
		expect(p23bM1ActionLabelArmRecordsFor('f2', 'p23b-m1:bend')).toHaveLength(0);
	});

	it('drops everything on reset, so arms cannot leak from one run into the next', () => {
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:rigid-wall-drag', 0, 'no-memo-grid');
		p23bM1ResetActionLabelArms();
		expect(p23bM1ActionLabelArmRecords()).toHaveLength(0);
		expect(p23bM1ActionLabelArmRecordsFor('f1', 'p23b-m1:rigid-wall-drag')).toHaveLength(0);
	});
});

/* ------------------------------------------------------------------ *
 * The build key: could this grid have been reused instead of rebuilt?
 * ------------------------------------------------------------------ */

/**
 * One grid's inputs, with a coordinate that can be moved and a mask that can be edited:
 * everything the grid is a function of, and nothing about the Room's identity.
 */
function buildInputs(
	shift = 0,
	clearancePx = 8
): P23BM1GridBuildInputs {
	return {
		polygonScreen: [
			[100 + shift, 100],
			[200 + shift, 100],
			[200 + shift, 200],
			[100 + shift, 200]
		],
		mask: {
			protectedEdges: [{ points: [[110 + shift, 100], [110 + shift, 200]], clearancePx }],
			obstacles: [{ polygon: [[150, 150], [160, 150], [160, 160]], clearancePx: 4 }],
			acquisition: [{ center: [120, 180], radiusPx: 12, clearancePx: 2 }],
			activeText: [{ rect: { minX: 130, minY: 130, maxX: 150, maxY: 140 }, clearancePx: 24 }]
		},
		centerScreen: [150 + shift, 150]
	};
}

describe('M1 room-label arm — the grid-build key', () => {
	beforeEach(() => {
		globals.__P2311_PERF__ = true;
		p23bM1ResetActionLabelArms();
	});
	afterEach(() => {
	p23bM1ResetActionLabelArms();
	delete globals.__P2311_PERF__;
	delete globals.__P23B_M1_ROOM_LABEL_ARM__;
});

	it('keeps the attempt’s builds in ARRIVAL ORDER, so a cache policy can be simulated from the capture', () => {
		setP23bM1RoomLabelArm('seeded-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		const first = buildInputs();
		const second = buildInputs(1);
		const build = (inputs: P23BM1GridBuildInputs) =>
			p23bM1RoomLabelArm(inputs.polygonScreen, inputs.mask, inputs.centerScreen);
		build(first);
		build(second);
		build(first);
		build(second);
		build(first);
		// `1 2 1 2 1` — interleaved, not adjacent. The counts alone (5 builds, 2 distinct)
		// cannot tell this apart from `1 1 2 2 1`, and the two want different caches: one
		// entry misses every repeat here, two entries miss none.
		expect(p23bM1RoomLabelAttemptSequence()).toEqual([1, 2, 1, 2, 1]);
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', 3, 'seeded-grid');
		const record = p23bM1ActionLabelArmRecordsFor('f1', 'p23b-m1:bend')[0];
		expect(record?.sequence).toEqual([1, 2, 1, 2, 1]);
		// The read is a copy: a reader holding it cannot edit the attempt's own order.
		const held = p23bM1RoomLabelAttemptSequence() as number[];
		held.push(99);
		expect(p23bM1RoomLabelAttemptSequence()).toEqual([1, 2, 1, 2, 1]);
		// The next attempt starts its own order, exactly as it starts its own count.
		setP23bM1RoomLabelArm('no-memo-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		expect(p23bM1RoomLabelAttemptSequence()).toEqual([]);
	});

	it('records one call per placement, with the range of the attempt’s builds it produced', () => {
		setP23bM1RoomLabelArm('seeded-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		const first = buildInputs();
		const second = buildInputs(1);
		const build = (inputs: P23BM1GridBuildInputs) =>
			p23bM1RoomLabelArm(inputs.polygonScreen, inputs.mask, inputs.centerScreen);
		// A first placement over two Rooms, then a second one that rebuilds the first
		// Room's grid — the shape the leg reports, recorded as WHICH call built what.
		p23bM1RecordRoomLabelCall({ rooms: 2, reason: 'lod', settleGeneration: 4, hasMemory: true, at: 1 });
		build(first);
		build(second);
		p23bM1RecordRoomLabelCall({ rooms: 1, reason: 'frozen', settleGeneration: 4, hasMemory: true, at: 1.5 });
		build(first);
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', 4, 'seeded-grid');
		const record = p23bM1ActionLabelArmRecordsFor('f1', 'p23b-m1:bend')[0];
		expect(record?.sequence).toEqual([1, 2, 1]);
		expect(
			record?.calls.map((call) => ({
				reason: call.reason,
				rooms: call.rooms,
				buildStart: call.buildStart,
				builds: call.builds
			}))
		).toEqual([
			{ reason: 'lod', rooms: 2, buildStart: 0, builds: 2 },
			{ reason: 'frozen', rooms: 1, buildStart: 2, builds: 1 }
		]);
		// The attempt closes its own census: the next one starts with no calls, and a call
		// that is never followed by a build is still recorded as having built nothing.
		setP23bM1RoomLabelArm('seeded-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		p23bM1RecordRoomLabelCall({ rooms: 2, reason: 'lod', settleGeneration: 4, hasMemory: false, at: 2 });
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', 5, 'seeded-grid');
		expect(p23bM1ActionLabelArmRecordsFor('f1', 'p23b-m1:bend').at(-1)?.calls).toEqual([
			{
				rooms: 2,
				reason: 'lod',
				settleGeneration: 4,
				hasMemory: false,
				at: 2,
				buildStart: 0,
				builds: 0,
				durationMs: null,
				labelsDigest: null,
				memoryDigest: null
			}
		]);
	});

	it('prices the pass: a placement records its entry and its own wall time at the one exit', () => {
		setP23bM1RoomLabelArm('seeded-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		const result = placeRoomLabels({
			rooms: [ring('room-a', 3, 64)],
			planView: view(),
			measure: APPROXIMATE_TEXT_MEASURE
		});
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', 8, 'seeded-grid');
		const record = p23bM1ActionLabelArmRecordsFor('f1', 'p23b-m1:bend')[0];
		// The pass really ran (it placed something and built a grid), and the census holds
		// ONE entry for it: what it was handed, and how long it took end to end.
		expect(result.labels.length).toBeGreaterThan(0);
		expect(record?.calls).toHaveLength(1);
		expect(record?.calls[0]?.rooms).toBe(1);
		expect(record?.calls[0]?.reason).toBe('lod');
		expect(record?.calls[0]?.builds).toBeGreaterThan(0);
		expect(typeof record?.calls[0]?.durationMs).toBe('number');
		expect(record?.calls[0]?.durationMs ?? -1).toBeGreaterThanOrEqual(0);
	});

	it('digests what the pass produced, so two passes can be COMPARED instead of assumed', () => {
		const place = (rooms: RoomLabelFacts[], index: number) => {
			setP23bM1RoomLabelArm('seeded-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
			placeRoomLabels({ rooms, planView: view(), measure: APPROXIMATE_TEXT_MEASURE });
			p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', index, 'seeded-grid');
			return p23bM1ActionLabelArmRecordsFor('f1', 'p23b-m1:bend').at(-1)?.calls[0];
		};
		const first = place([ring('room-a', 3, 64)], 10);
		expect(first?.labelsDigest).not.toBeNull();
		expect(first?.memoryDigest).not.toBeNull();
		// Identical inputs placed again: the same digest. This is the property a claim that
		// one pass repeats the last one is made of — the keys prove the same GRIDS, and this
		// proves the same LABELS, which the keys alone can never say.
		const repeated = place([ring('room-a', 3, 64)], 11);
		expect(repeated?.labelsDigest).toBe(first?.labelsDigest);
		expect(repeated?.memoryDigest).toBe(first?.memoryDigest);
		// A pass that places something else cannot hide behind a shared digest.
		const different = place([ring('room-a', 1.2, 64)], 12);
		expect(different?.labelsDigest).not.toBe(first?.labelsDigest);
	});

	it('keys a grid by its INPUTS, to the last bit, and not by the objects they arrived in', () => {
		// Two separately-built input sets with equal values: the same grid, so one key.
		expect(p23bM1GridBuildKey(buildInputs())).toBe(p23bM1GridBuildKey(buildInputs()));
		// One coordinate apart by one ulp is a different grid, and must be a different key:
		// a rounded key would merge the two and OVERSTATE the repeat rate.
		const near = buildInputs();
		near.polygonScreen = [[100, 100], [200, 100], [200, 200], [100, 200 + Number.EPSILON * 256]];
		expect(p23bM1GridBuildKey(near)).not.toBe(p23bM1GridBuildKey(buildInputs()));
		// A mask clearance is part of the grid too, and so is the centre.
		expect(p23bM1GridBuildKey(buildInputs(0, 9))).not.toBe(p23bM1GridBuildKey(buildInputs()));
		const moved = buildInputs(1);
		expect(p23bM1GridBuildKey(moved)).not.toBe(p23bM1GridBuildKey(buildInputs()));
	});

	it('counts the attempt’s own distinct builds, and records them on the action', () => {
		setP23bM1RoomLabelArm('seeded-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		p23bM1RoomLabelArm(buildInputs().polygonScreen, buildInputs().mask, buildInputs().centerScreen);
		p23bM1RoomLabelArm(buildInputs().polygonScreen, buildInputs().mask, buildInputs().centerScreen);
		const changed = buildInputs(1);
		p23bM1RoomLabelArm(changed.polygonScreen, changed.mask, changed.centerScreen);
		expect(p23bM1RoomLabelGridBuilds()).toBe(3);
		expect(p23bM1RoomLabelAttemptKeys()).toBe(2);
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', 7, 'seeded-grid');
		const record = p23bM1ActionLabelArmRecordsFor('f1', 'p23b-m1:bend')[0];
		expect(record?.builds).toBe(3);
		expect(record?.distinctBuilds).toBe(2);
		// The next attempt starts its own key set: the arm is set once per attempt, and
		// setting it is what closes the previous one.
		setP23bM1RoomLabelArm('no-memo-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		expect(p23bM1RoomLabelAttemptKeys()).toBe(0);
	});

	it('reports the class’s keys ACROSS its attempts, with the worst repeat named', () => {
		setP23bM1RoomLabelArm('seeded-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		// Attempt 1: the same grid built twice.
		for (let i = 0; i < 2; i += 1) {
			const same = buildInputs();
			p23bM1RoomLabelArm(same.polygonScreen, same.mask, same.centerScreen);
		}
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', 0, 'seeded-grid');
		// Attempt 2: the same grid as attempt 1, then a changed one, then the change back.
		setP23bM1RoomLabelArm('seeded-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		const repeated = buildInputs();
		const changed = buildInputs(1);
		p23bM1RoomLabelArm(repeated.polygonScreen, repeated.mask, repeated.centerScreen);
		p23bM1RoomLabelArm(changed.polygonScreen, changed.mask, changed.centerScreen);
		p23bM1RoomLabelArm(repeated.polygonScreen, repeated.mask, repeated.centerScreen);
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', 1, 'seeded-grid');
		expect(p23bM1GridBuildKeys('f1', 'p23b-m1:bend')).toEqual({
			builds: 5,
			distinctKeys: 2,
			repeatedBuilds: 3,
			maxRepeatOfOneKey: 4
		});
		// A class that built nothing reads as null, never as zero repeats.
		expect(p23bM1GridBuildKeys('f2', 'p23b-m1:bend')).toBeNull();
	});

	it('records no key at all when the instrument is off, while still counting the builds', () => {
		delete globals.__P2311_PERF__;
		setP23bM1RoomLabelArm('seeded-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		const inputs = buildInputs();
		p23bM1RoomLabelArm(inputs.polygonScreen, inputs.mask, inputs.centerScreen);
		p23bM1RoomLabelArm(inputs.polygonScreen, inputs.mask, inputs.centerScreen);
		// The count is taken BEFORE the gate — a build is a build whether or not the
		// instrument is on — while the key needs the gate, so there is no key to report.
		expect(p23bM1RoomLabelGridBuilds()).toBe(2);
		expect(p23bM1RoomLabelAttemptKeys()).toBe(0);
		expect(p23bM1GridBuildKeys('f1', 'p23b-m1:bend')).toBeNull();
		// The call census is behind the same gate: a run that took no key takes no census.
		p23bM1RecordRoomLabelCall({ rooms: 3, reason: 'lod', settleGeneration: 1, hasMemory: false, at: 0 });
		p23bM1RecordActionLabelArm('f1', 'p23b-m1:bend', 9, 'seeded-grid');
		expect(p23bM1ActionLabelArmRecordsFor('f1', 'p23b-m1:bend')[0]?.calls).toEqual([]);
	});

	it('drops the keys on reset, so a run cannot inherit another run’s repeat rate', () => {
		setP23bM1RoomLabelArm('seeded-grid', { fixtureId: 'f1', actionClass: 'p23b-m1:bend' });
		const inputs = buildInputs();
		p23bM1RoomLabelArm(inputs.polygonScreen, inputs.mask, inputs.centerScreen);
		p23bM1ResetActionLabelArms();
		expect(p23bM1GridBuildKeys('f1', 'p23b-m1:bend')).toBeNull();
		expect(p23bM1RoomLabelAttemptKeys()).toBe(0);
		expect(p23bM1RoomLabelAttemptSequence()).toEqual([]);
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
	arm: P23BM1RoomLabelArm,
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

describe('M1 room-label arm — every arm places labels identically', () => {
	afterEach(() => {
		delete globals.__P2311_PERF__;
		delete globals.__P23B_M1_ROOM_LABEL_ARM__;
	});

	/**
	 * The shipped arm is the reference and the other arm is compared against it: if it
	 * equals the reference, they equal each other. The reference is the AFTER side
	 * deliberately — the arm whose behaviour ships is the one the other must not move.
	 */
	const reference = P23B_M1_ROOM_LABEL_ARM_AFTER;
	const others = P23B_M1_ROOM_LABEL_ARMS.filter((arm) => arm !== reference);

	it('agrees on every fixture, anchor and tier, and on the whole sticky memory', () => {
		for (const entry of cases) {
			const shipped = runCase(entry, reference);
			for (const arm of others) {
				const other = runCase(entry, arm);
				expect(other.labels, `${entry.name} · ${arm}`).toEqual(shipped.labels);
				expect(other.readout, `${entry.name} · ${arm}`).toEqual(shipped.readout);
				expect(other.memory, `${entry.name} · ${arm}`).toEqual(shipped.memory);
			}
		}
	});

	it('agrees on the second pass, when the sticky memory is what decides', () => {
		// The second placement is the interesting one: the first pass fills the memory
		// and the second reads it, so a grid that visited a different cell would move a
		// label here even when pass one agreed.
		const entry = cases.find((candidate) => candidate.mask !== undefined)!;
		const memories = new Map<P23BM1RoomLabelArm, RoomLabelMemory>(
			P23B_M1_ROOM_LABEL_ARMS.map((arm) => [arm, new Map<string, never>()] as const)
		);
		let shippedFirst: unknown = null;
		for (let pass = 0; pass < 2; pass += 1) {
			const shipped = runCase(entry, reference, memories.get(reference) as RoomLabelMemory);
			for (const arm of others) {
				const other = runCase(entry, arm, memories.get(arm) as RoomLabelMemory);
				expect(other.labels, `${entry.name} · ${arm} pass ${pass}`).toEqual(shipped.labels);
				expect(other.memory, `${entry.name} · ${arm} pass ${pass}`).toEqual(shipped.memory);
			}
			if (pass === 0) shippedFirst = shipped.labels;
		}
		// A sanity check on the test itself: the fixture must have placed something,
		// or "the arms agree" would be an agreement about nothing.
		expect((shippedFirst as unknown[]).length).toBeGreaterThan(0);
	});

	it('runs the shipped path through its cache on EVERY fixture, and places what the BYPASS places', () => {
		// The case the shipped cache exists for: the settled `lod` pass after the `geometry`
		// pass of the same settle. Same geometry, so identical grid inputs, so the second pass
		// must be served from the cache — which is ALSO why the two arms must agree, since a hit
		// returns exactly the grid the bypass arm would have rebuilt.
		//
		// EVERY fixture, not one: a memo proved on the fixture it was designed around proves
		// nothing about the concave face, the 256-vertex ring, the coarsened far-zoom grid or
		// the duplicate-identity pair, and this change is shipped.
		for (const entry of cases) {
			const placeTwice = (arm: P23BM1RoomLabelArm) => {
				globals.__P2311_PERF__ = true;
				// A cold cache per arm: the shipped cache is module state and outlives one
				// placement by design, so a test has to say when it wants a cold one.
				resetRoomLabelGridCache();
				setP23bM1RoomLabelArm(arm);
				const memory: RoomLabelMemory = new Map();
				const base = {
					rooms: entry.rooms,
					planView: entry.planView,
					measure: APPROXIMATE_TEXT_MEASURE,
					...(entry.mask ? { mask: entry.mask } : {}),
					settleGeneration: 4
				};
				const geometry = placeRoomLabels({ ...base, reason: 'geometry', memory });
				const hitsBefore = p23bM1RoomLabelMemoHits();
				const lod = placeRoomLabels({ ...base, reason: 'lod', memory });
				return {
					labels: [geometry.labels, lod.labels],
					memory: [...lod.memory.entries()].sort(([left], [right]) => left.localeCompare(right)),
					hits: p23bM1RoomLabelMemoHits() - hitsBefore
				};
			};
			const bypassed = placeTwice('no-memo-grid');
			const shipped = placeTwice(P23B_M1_ROOM_LABEL_ARM_AFTER);
			// The exercise FIRST: a cache that never hit would pass the equality below by
			// doing nothing at all, and the bypass arm must not be reading a cache at all.
			expect(shipped.hits, `${entry.name}: the shipped cache was not exercised`).toBeGreaterThan(0);
			expect(bypassed.hits, `${entry.name}: the bypass arm reads no cache`).toBe(0);
			expect(shipped.labels, entry.name).toEqual(bypassed.labels);
			expect(shipped.memory, entry.name).toEqual(bypassed.memory);
		}
	});
});
