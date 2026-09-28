import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildP23BContainment } from '$lib/bench/p23b-containment';
import type { P23BCaptureLedger } from '$lib/bench/bench-types';
import {
	buildP23BM1Record,
	m1ClassLedger,
	m1MeasuredActionIndices,
	m1Population,
	summarizeLabelArmWindows,
	summarizeM1Class,
	P23B6_S1B_D1_COMPARISON,
	P23B_M1_D13_NOTE,
	P23B_M1_WARMUP_RULE,
	P23B_M1_POST_RELEASE_FAMILY,
	pairM1PostReleaseWithPresented,
	postReleaseWindowOf,
	unionMs
} from '$lib/bench/p23b-m1-record';
import {
	summarizeIntervals,
	P23B_M1_LABEL_ARM_WINDOW_RULE,
	P23B_M1_WINDOW_ARM_NOTE
} from '$lib/bench/p23b-m1-frame-timing';
import {
	buildGestureFrameSeries,
	p23bM1FrameTiming,
	p23bM1GestureFramesFor,
	p23bM1LongFramesFor,
	p23bM1RecordGestureFrames,
	p23bM1RecordLongFrames,
	p23bM1ResetFrameTiming,
	P23B_M1_GESTURE_FRAME_DEFINITION
} from '$lib/bench/p23b-m1-frame-timing';
import {
	P23B_M1_ARM_RULE,
	type P23BM1RoomDragArm
} from '$lib/editor/layout/p23b-m1-room-drag-arm';
import {
	P23B_M1_ROOM_LABEL_ARMS,
	P23B_M1_ROOM_LABEL_ARM_RULE,
	type P23BM1RoomLabelArm
} from '$lib/editor/layout/p23b-m1-room-label-arm';
import { p23bM1MeasuredClass } from '../../../src/routes/dev/perf/p23b/drive';

/** An empty M1 gesture registry: the shape every class row is built against. */
const noGestures = (): { gestureFrames: []; longFrames: [] } => ({ gestureFrames: [], longFrames: [] });

const here = path.dirname(fileURLToPath(import.meta.url));
const editorRoot = path.resolve(here, '../../..');

/**
 * The M1 record is the slice's deliverable, so these tests pin its THREE rules
 * rather than its values: one population across boundaries, marks and release
 * spans; keyed self-only-where-priceable mark rows; and a signal label plus
 * coverage on every release-side row. The wiring tests below then pin the parts
 * of the contract that live in the harness: the M1 protocol exists, the runner
 * entry point is published, and no product module was touched.
 */

type Action = P23BCaptureLedger['actions'][number];

function action(
	index: number,
	options: {
		path?: Action['path'];
		outcome?: Action['outcome'];
		status?: Action['status'];
		release?: { start: number; end: number };
		frame?: { start: number; end: number };
	} = {}
): Action {
	const start = index * 1000;
	return {
		index,
		intent: options.path ?? 'plan-drag-edit',
		path: options.path === undefined ? 'plan-drag-edit' : options.path,
		outcome: options.outcome ?? 'accepted',
		status: options.status ?? 'completed',
		planView: null,
		samples: [
			{ boundary: 'input', duration: 5, start, end: start + 5 },
			...(options.release
				? [
						{
							boundary: 'release' as const,
							duration: options.release.end - options.release.start,
							start: options.release.start,
							end: options.release.end
						}
					]
				: []),
			...(options.frame
				? [
						{
							boundary: 'browser-frame' as const,
							duration: options.frame.end - options.frame.start,
							start: options.frame.start,
							end: options.frame.end
						}
					]
				: [])
		]
	};
}

function ledger(actions: Action[], overrides: Partial<P23BCaptureLedger> = {}): P23BCaptureLedger {
	return {
		sessionId: 'session-1',
		startedAt: 0,
		endedAt: 100000,
		fixtureResets: actions.length,
		droppedBoundaries: 0,
		settled: true,
		actions,
		...overrides
	};
}

describe('M1 record — population rule', () => {
	it('excludes the leading warm-up slots per path in ledger order, then keeps accepted only', () => {
		const record = ledger([
			action(0, { release: { start: 10, end: 20 } }),
			action(1, { outcome: 'rejected', release: { start: 30, end: 40 } }),
			action(2, { release: { start: 50, end: 60 } }),
			// A different path's actions never consume this path's warm-up slots.
			action(3, { path: 'bend-knot-edit', release: { start: 70, end: 80 } }),
			action(4, { release: { start: 90, end: 100 } })
		]);
		const population = m1Population(record, 'plan-drag-edit', 2);
		// Warm-up is the first two plan-drag-edit actions (one accepted, one
		// rejected), so exactly the two later accepted ones survive.
		expect(population.measured.map((entry) => entry.index)).toEqual([2, 4]);
		// Four plan-drag-edit actions in this ledger (the bend action is another path
		// and never consumes a slot); the first two are the slots, one of them accepted.
		expect(population).toMatchObject({
			completedOfPath: 4,
			warmupSlots: 2,
			warmupAcceptedExcluded: 1,
			consideredAfterWarmup: 2,
			excludedByOutcome: 0
		});
	});

	it('decomposes warm-up in SLOTS, so a class with extra non-accepted actions reconciles', () => {
		// The wall-authoring run taps an anchor (a `setup` action of the SAME path)
		// before each commit, and warm-up is sliced BEFORE the accepted filter — the
		// interaction report's own rule. Reporting `min(warmup, accepted)` claimed
		// five accepted actions were dropped of a class that really dropped three
		// `setup` actions and two accepted ones, and left 25 − 5 ≠ 23 unexplained.
		const actions: Action[] = [];
		for (let index = 0; index < 25; index += 1) {
			actions.push(action(index * 2, { outcome: 'setup', release: { start: index * 10, end: index * 10 + 5 } }));
			actions.push(action(index * 2 + 1, { release: { start: index * 10 + 5, end: index * 10 + 9 } }));
		}
		const population = m1Population(ledger(actions), 'plan-drag-edit', 5);
		expect(population).toMatchObject({
			completedOfPath: 50,
			warmupSlots: 5,
			// the first five slots are setup · accepted · setup · accepted · setup
			warmupAcceptedExcluded: 2,
			consideredAfterWarmup: 45,
			excludedByOutcome: 22
		});
		expect(population.measured).toHaveLength(23);
		// The decomposition is an identity, so no count can go missing.
		expect(population.warmupSlots + population.excludedByOutcome + population.measured.length).toBe(
			population.completedOfPath
		);
		expect(population.warmupAcceptedExcluded + population.measured.length).toBe(25);
	});

	it('keys the measured population by ledger index, the key the gesture registry is filtered by', () => {
		expect([...m1MeasuredActionIndices([action(3), action(7), action(11)])]).toEqual([3, 7, 11]);
	});
});

describe('M1 record — class row', () => {
	const drags = [
		action(0, { release: { start: 100, end: 200 }, frame: { start: 200, end: 210 } }),
		action(1, { release: { start: 300, end: 420 }, frame: { start: 420, end: 432 } }),
		action(2, { release: { start: 500, end: 640 }, frame: { start: 640, end: 660 } })
	];

	function classRow() {
		const capture = ledger(drags);
		const containment = buildP23BContainment(capture, [
			{ name: 'p2311:commit-capture', startTime: 105, duration: 40 },
			{ name: 'p2311:mesh-prebuild', startTime: 305, duration: 12 },
			{ name: 'p2311:pointermove-rigid', startTime: 130, duration: 20 }
		]);
		return summarizeM1Class({
			fixtureId: 'p23b-40-wall-all-curved-v1',
			sessionId: 'session-1',
			actionClass: 'p23b-m1:rigid-wall-drag',
			actionPath: 'plan-drag-edit',
			ledger: capture,
			containment,
			warmup: 0,
			actionsPerClass: 3,
			gestureRegistry: noGestures(),
			longFrameWindow: {
				supported: true,
				entries: [
					{
						startTime: 320,
						duration: 80,
						renderStart: 322,
						styleAndLayoutStart: 350,
						blockingDuration: 40,
						firstScriptStart: 320
					}
				]
			}
		});
	}

	it('keys its mark and boundary rows and carries exclusive self only where it is priceable', () => {
		const row = classRow();
		expect(row.population.rule).toBe(P23B_M1_WARMUP_RULE);
		expect(row.population.measuredAccepted).toBe(3);
		// Marks are keyed by label, so a reader cannot mis-index them.
		expect(Object.keys(row.marks).sort()).toEqual([
			'p2311:commit-capture',
			'p2311:mesh-prebuild',
			'p2311:pointermove-rigid'
		]);
		expect(row.marks['p2311:commit-capture']).toMatchObject({ count: 1, p50: 40, maxPerAction: 1 });
		// The release boundary is present as a boundary row with its own self time.
		expect(row.boundaries['release']?.count).toBe(3);
		expect(row.boundaries['browser-frame']?.count).toBe(3);
		// The release spans are the SAME actions the mark rows were taken over.
		expect(row.releaseSpans.map((span) => span.actionIndex)).toEqual([0, 1, 2]);
		// The page-side row is the PROXY and says so, with its coverage.
		expect(row.releaseRow.signal).toBe('proxy');
		expect(row.releaseRow.coverage).toEqual({ releases: 3, coveredReleases: 3, coveredShare: 1 });
		// Three release frames (10, 12, 20 ms); the repo's nearest-rank upper p50 is
		// the middle value, not the extreme the proxy would otherwise advertise.
		expect(row.releaseRow.proxy.distribution.p50).toBe(12);
	});

	it('reports the commit-capture mark separately (D7) and summarizes the long-frame window', () => {
		const row = classRow();
		expect(row.commitCapture).toMatchObject({ count: 1, p50: 40 });
		expect(row.longFrames.frames).toBe(1);
		expect(row.longFrames.notMeasuredReason).toBeNull();
		// One release (300–420) intersects the long frame; the coverage says so.
		expect(row.longFrames.coverage.releasesTouched).toBe(1);
	});

	it('marks the long-frame row NOT MEASURED when no window was opened, instead of reporting zero', () => {
		const capture = ledger(drags);
		const row = summarizeM1Class({
			fixtureId: 'fixture',
			sessionId: 'session-1',
			actionClass: 'p23b-m1:rigid-wall-drag',
			actionPath: 'plan-drag-edit',
			ledger: capture,
			containment: buildP23BContainment(capture, []),
			warmup: 0,
			gestureRegistry: noGestures(),
			longFrameWindow: null
		});
		expect(row.longFrames.frames).toBe(0);
		expect(row.longFrames.supported).toBe(false);
		expect(row.longFrames.notMeasuredReason).toContain('NOT MEASURED');
	});

	it('merges the gesture series over the class\'s OWN measured population, never over every bracket', () => {
		// Three drags were bracketed: the first is the path's warm-up, the other two
		// are the measured actions the class reports. The row must merge two — and
		// say it left one out — because a bracket is per ATTEMPT, not per action.
		const capture = ledger(drags);
		const containment = buildP23BContainment(capture, []);
		function series(frameInterval: number) {
			return buildGestureFrameSeries({
				label: 'plan-drag-edit',
				startedAt: 0,
				endedAt: 100,
				samples: [{ end: 16, interval: frameInterval }],
				pointermoveMarks: []
			});
		}
		const row = summarizeM1Class({
			fixtureId: 'fixture',
			sessionId: 'session-1',
			actionClass: 'p23b-m1:rigid-wall-drag',
			actionPath: 'plan-drag-edit',
			ledger: capture,
			containment,
			warmup: 1,
			actionsPerClass: 3,
			gestureRegistry: {
				gestureFrames: [
					// index 0 is the warm-up action and is NOT in the measured population
					{ key: 'k0', fixtureId: 'fixture', actionClass: 'p23b-m1:rigid-wall-drag', path: 'plan-drag-edit', actionIndex: 0, outcome: 'accepted', series: series(999) },
					{ key: 'k1', fixtureId: 'fixture', actionClass: 'p23b-m1:rigid-wall-drag', path: 'plan-drag-edit', actionIndex: 1, outcome: 'accepted', series: series(20) },
					{ key: 'k2', fixtureId: 'fixture', actionClass: 'p23b-m1:rigid-wall-drag', path: 'plan-drag-edit', actionIndex: 2, outcome: 'accepted', series: series(30) },
					// an unresolved attempt: it can never be a measured action
					{ key: 'kx', fixtureId: 'fixture', actionClass: 'p23b-m1:rigid-wall-drag', path: 'plan-drag-edit', actionIndex: null, outcome: null, series: series(999) }
				],
				longFrames: []
			},
			longFrameWindow: null
		});
		expect(row.gestureFrames?.coverage).toMatchObject({
			populationActions: 2,
			drags: 2,
			registeredDrags: 4,
			excludedDrags: 2
		});
		expect(row.gestureFrames?.samples.map((sample) => sample.interval).sort((a, b) => a - b)).toEqual([20, 30]);
		expect(row.gestureFrames?.definition).toBe(P23B_M1_GESTURE_FRAME_DEFINITION);
	});

	it('reports NO series when the measured population produced none, instead of merging warm-ups', () => {
		const capture = ledger(drags);
		const row = summarizeM1Class({
			fixtureId: 'fixture',
			sessionId: 'session-1',
			actionClass: 'p23b-m1:rigid-wall-drag',
			actionPath: 'plan-drag-edit',
			ledger: capture,
			containment: buildP23BContainment(capture, []),
			warmup: 1,
			actionsPerClass: 3,
			gestureRegistry: {
				gestureFrames: [
					{ key: 'k0', fixtureId: 'fixture', actionClass: 'p23b-m1:rigid-wall-drag', path: 'plan-drag-edit', actionIndex: 0, outcome: 'accepted', series: buildGestureFrameSeries({ label: 'plan-drag-edit', startedAt: 0, endedAt: 10, samples: [{ end: 5, interval: 5 }], pointermoveMarks: [] }) }
				],
				longFrames: []
			},
			longFrameWindow: null
		});
		expect(row.gestureFrames).toBeNull();
	});
});

describe('M1 record — the whole record', () => {
	function classFor(fixtureId: string, actionClass: string, actionPath: 'wall-authoring' | 'plan-drag-edit') {
		const actions = [0, 1].map((index) => ({
			index,
			intent: actionPath,
			path: actionPath,
			outcome: 'accepted' as const,
			status: 'completed' as const,
			planView: null,
			samples: [
				{ boundary: 'release' as const, duration: 120 + index * 10, start: index * 1000, end: index * 1000 + 120 + index * 10 },
				{ boundary: 'browser-frame' as const, duration: 20, start: index * 1000 + 120, end: index * 1000 + 140 }
			]
		}));
		const capture = ledger(actions);
		const containment = buildP23BContainment(capture, [
			{ name: 'p2311:commit-capture', startTime: 5, duration: 60 },
			{ name: 'p2311:chain-canonical-gates', startTime: 20, duration: 40 }
		]);
		return summarizeM1Class({
			fixtureId,
			sessionId: `session-${fixtureId}-${actionClass}`,
			actionClass,
			actionPath,
			ledger: capture,
			containment,
			warmup: 0,
			actionsPerClass: 2,
			gestureRegistry: noGestures(),
			longFrameWindow: { supported: true, entries: [] }
		});
	}

	const record = buildP23BM1Record({
		protocol: 'test protocol',
		provenance: { commitSha: 'deadbeef' },
		fixtureOrder: ['fixture-a', 'fixture-b'],
		limitations: ['advisory'],
		classes: [
			classFor('fixture-a', 'p23b-m1:wall-authoring', 'wall-authoring'),
			classFor('fixture-a', 'p23b-m1:room-creation-commit', 'wall-authoring'),
			classFor('fixture-a', 'p23b-m1:whole-room-move-bridge', 'plan-drag-edit'),
			classFor('fixture-b', 'p23b-m1:wall-authoring', 'wall-authoring')
		]
	});

	it('groups classes per fixture and reports D1 rows only for the two named classes', () => {
		expect(record.fixtures.map((fixture) => fixture.fixtureId)).toEqual(['fixture-a', 'fixture-b']);
		expect(record.fixtures[0]?.classes).toHaveLength(3);
		expect(record.d1.rows.map((row) => `${row.fixtureId}:${row.row}`)).toEqual([
			'fixture-a:wall-authoring',
			'fixture-b:wall-authoring',
			'fixture-a:whole-room-move-bridge'
		]);
		// The room-creation class reports the same path but is NOT the D1 row.
		expect(record.d1.rows.some((row) => row.actionClass.endsWith('room-creation-commit'))).toBe(false);
		// Both rows carry P23B.6's numbers as comparison material, marked as such.
		expect(record.d1.rows[0]?.comparison).toBe(P23B6_S1B_D1_COMPARISON['wall-authoring']);
		expect(record.d1.rows[0]?.comparison.after).toBe(3601.2);
		expect(record.d1.note).toContain('COMPARISON ONLY');
	});

	it('carries D7 rows, the D13 note and the schema rules', () => {
		expect(record.d7.rows).toHaveLength(4);
		expect(record.d7.rows[0]?.mark?.p50).toBe(60);
		expect(record.d13.coverageLimit).toBe(P23B_M1_D13_NOTE);
		expect(record.schema.keyed).toContain('exclusiveSelf');
		expect(record.schema.releaseSide).toContain('PROXY');
		expect(record.schema.gesturePopulation).toContain('MEASURED actions only');
		expect(record.provenance.fixtureOrder).toEqual(['fixture-a', 'fixture-b']);
	});

	it('states every class\'s population decomposition and which counts differ', () => {
		// The reconciliation, in the record itself: 23 and 20 are both reported, the
		// slots and the accepted actions inside them are separated, and the distinct
		// counts are listed — so two rows over different counts can never be read as
		// equivalent samples.
		expect(record.populations.rows).toHaveLength(4);
		expect(record.populations.rows[0]).toMatchObject({
			fixtureId: 'fixture-a',
			actionClass: 'p23b-m1:wall-authoring',
			completedOfPath: 2,
			warmupSlots: 0,
			warmupAcceptedExcluded: 0,
			excludedByOutcome: 0,
			measuredAccepted: 2,
			nominalMeasured: 2,
			matchesNominal: true
		});
		expect(record.populations.measuredCounts).toEqual([2]);
		expect(record.populations.note).toContain('not equivalent samples');
		expect(record.d1.note).toContain('populations');
	});

	it('marks a class whose measured count is not actions − warm-up, and lists both counts', () => {
		// The shipped wall-authoring sequence: an anchor tap that records a `setup`
		// action of the SAME path, then the commit. Forty-five of the path's
		// completed actions survive warm-up; 23 of them are accepted.
		const wallAuthoringLedger = ledger(
			Array.from({ length: 25 }, (_, index) => [
				action(index * 2, { outcome: 'setup', release: { start: index * 10, end: index * 10 + 5 } }),
				action(index * 2 + 1, { release: { start: index * 10 + 5, end: index * 10 + 9 } })
			]).flat()
		);
		expect(m1Population(wallAuthoringLedger, 'plan-drag-edit', 5).measured).toHaveLength(23);
		const row = summarizeM1Class({
			fixtureId: 'fixture-a',
			sessionId: 'session-wall-authoring',
			actionClass: 'p23b-m1:wall-authoring',
			actionPath: 'plan-drag-edit',
			ledger: wallAuthoringLedger,
			containment: buildP23BContainment(wallAuthoringLedger, []),
			warmup: 5,
			actionsPerClass: 25,
			gestureRegistry: noGestures(),
			longFrameWindow: null
		});
		expect(row.population.measuredAccepted).toBe(23);
		expect(row.population.nominalMeasured).toBe(20);
		expect(row.population.matchesNominal).toBe(false);
		expect(row.releaseSpans).toHaveLength(23);
		const record = buildP23BM1Record({
			protocol: 'test protocol',
			provenance: {},
			fixtureOrder: ['fixture-a'],
			limitations: [],
			classes: [row, classFor('fixture-a', 'p23b-m1:rigid-wall-drag', 'plan-drag-edit')]
		});
		// The divergence is a stated fact of the record, with both counts present.
		expect(record.populations.measuredCounts).toEqual([2, 23]);
		expect(
			record.populations.rows.filter((entry) => entry.matchesNominal === false).map((entry) => entry.measuredAccepted)
		).toEqual([23]);
	});

	it('marks the advisory fixture and keeps it out of D1 and D7', () => {
		// §3.2 runs the connected case LAST as evidence that the protocol runs it,
		// and a connected case inside a recorded table is a fixture leak. Its rows
		// stay inside its own marked entry.
		const advisory = buildP23BM1Record({
			protocol: 'test protocol',
			provenance: {},
			fixtureOrder: ['fixture-a', 'connected-curved-grid-v1'],
			limitations: [],
			classes: [
				classFor('fixture-a', 'p23b-m1:wall-authoring', 'wall-authoring'),
				classFor('connected-curved-grid-v1', 'p23b-m1:wall-authoring', 'wall-authoring'),
				classFor('connected-curved-grid-v1', 'p23b-m1:whole-room-move-bridge', 'plan-drag-edit')
			]
		});
		expect(advisory.fixtures.map((fixture) => [fixture.fixtureId, fixture.advisory])).toEqual([
			['fixture-a', false],
			['connected-curved-grid-v1', true]
		]);
		// It is still evidence that the protocol ran the case...
		expect(advisory.fixtures[1]?.classes).toHaveLength(2);
		// ...and no recorded row may cite it, even though both its classes carry the
		// marks D1 and D7 read.
		expect(advisory.d1.rows.map((row) => row.fixtureId)).toEqual(['fixture-a']);
		expect(advisory.d7.rows.map((row) => row.fixtureId)).toEqual(['fixture-a']);
		expect(advisory.schema.advisoryFixtures).toContain('never a recorded row');
	});

	it('is conservative about settlement: one unsettled class unsettles its fixture only', () => {
		expect(record.fixtures[0]?.settled).toBe(true);
		const unsettled = buildP23BM1Record({
			protocol: 'test protocol',
			provenance: {},
			fixtureOrder: ['fixture-a'],
			limitations: [],
			classes: [
				{
					...classFor('fixture-a', 'p23b-m1:wall-authoring', 'wall-authoring'),
					ledger: {
						recordedActions: 2,
						fixtureResets: 2,
						droppedBoundaries: 3,
						settled: false
					}
				}
			]
		});
		expect(unsettled.fixtures[0]?.settled).toBe(false);
		expect(unsettled.fixtures[0]?.droppedBoundaries).toBe(3);
	});
});

describe('M1 record — the ledger a class row is built from', () => {
	// One M1 run opens nineteen class sessions, and the live registry keeps only
	// its most recent few readable. Reading a class row by a live lookup alone
	// therefore loses the population of every class but the last handful, while
	// the class's marks still look complete.
	it('prefers the close-time snapshot over a lookup that can no longer see the session', () => {
		const snapshot = ledger([action(0, { release: { start: 10, end: 20 } })]);
		expect(m1ClassLedger({ sessionId: 'evicted', ledger: snapshot }, () => null)).toBe(snapshot);
	});

	it('falls back to the live lookup only when no snapshot was kept', () => {
		const live = ledger([action(0, { release: { start: 10, end: 20 } })], { sessionId: 'live' });
		expect(m1ClassLedger({ sessionId: 'live', ledger: null }, () => live)).toBe(live);
	});

	it('reports missing rather than guessing when neither is available', () => {
		expect(m1ClassLedger({ sessionId: 'evicted', ledger: null }, () => null)).toBeNull();
	});
});

describe('M1 wiring', () => {
	const drive = fs.readFileSync(
		path.resolve(editorRoot, 'src/routes/dev/perf/p23b/drive.ts'),
		'utf8'
	);
	const page = fs.readFileSync(
		path.resolve(editorRoot, 'src/routes/dev/perf/p23b/+page.svelte'),
		'utf8'
	);
	const occurrences = (text: string, needle: string): number => text.split(needle).length - 1;

	it('defines the M1 protocol as one prefix, one fixture order and five classes', () => {
		expect(drive).toContain("export const P23B_M1_PREFIX = 'p23b-m1:'");
		expect(drive).toContain('export const P23B_M1_FIXTURE_ORDER = P23B11_S1_FIXTURE_ORDER');
		for (const actionClass of [
			'rigid-wall-drag',
			'bend',
			'whole-room-move-bridge',
			'wall-authoring',
			'room-creation-commit'
		]) {
			expect(drive).toContain(`actionClass: '${actionClass}'`);
		}
		// The gesture series is bracketed in the drag classes only, and the long-frame
		// window is opened per class — both once, so neither can be double-counted.
		expect(occurrences(drive, 'bracketGestureFrames(timing')).toBe(3);
		expect(occurrences(drive, 'const observer = timing ? longFrameObserverOf() : null')).toBe(1);
		expect(drive).toContain('async function runM1(arms = false, labelArms = false)');
	});

	it('interleaves the BEFORE/AFTER arms on the whole-Room class and releases the switch afterwards', () => {
		// The arm is chosen per ATTEMPT and recorded against the action the attempt
		// resolved to, so the record can split the measured population by the arm
		// that actually produced it. Only the whole-Room class takes arms.
		expect(drive).toContain('arms: arms && entry.actionClass === \'whole-room-move-bridge\' ? P23B_M1_ROOM_DRAG_ARMS : null');
		expect(drive).toContain('const arm = arms && arms.length > 0 ? arms[index % arms.length]! : null;');
		expect(drive).toContain('setP23bM1RoomDragArm(arm);');
		expect(drive).toContain(
			'p23bM1RecordActionArm(timing.fixtureId, timing.actionClass, action.index, arm)'
		);
		// The switch is released at the run's start, per class AND in the run's
		// `finally`, so an aborted run can never leave the before path selected for a
		// later session.
		expect(occurrences(drive, 'setP23bM1RoomDragArm(null);')).toBe(3);
		expect(drive).toContain('p23bM1ResetActionArms();');
		expect(drive).toContain('await runM1Fixture(fixture, arms, labelArms);');
	});

	it('interleaves the ROOM-LABEL arms in EVERY class, records them per resolved action, and releases the switch', () => {
		// The placer runs on every Plan render, so unlike the room drag its arm is not
		// confined to the class that changed: every class that redraws the Plan takes
		// it, and the record's per-arm rows are then per class rather than one class.
		expect(drive).toContain('labelArms: labelArms ? P23B_M1_ROOM_LABEL_ARMS : null');
		expect(drive).toContain(
			'const arm = arms && arms.length > 0 ? arms[index % arms.length]! : null;'
		);
		expect(drive).toContain('setP23bM1RoomLabelArm(arm);');
		expect(drive).toContain(
			'p23bM1RecordActionLabelArm(timing.fixtureId, timing.actionClass, action.index, arm)'
		);
		expect(drive).toContain('p23bM1ResetActionLabelArms();');
		// Released per fixture, at the run's start AND in the run's `finally`: a render
		// during fixture hosting, or after an aborted run, must never run the
		// pre-change grid.
		expect(occurrences(drive, 'setP23bM1RoomLabelArm(null);')).toBe(3);
		// The one class-level statement that would confine it to a single class is
		// absent: the assignment above is per class, unconditionally.
		expect(drive).not.toContain('labelArms: labelArms && entry.actionClass');
	});

	it('keeps the label arm’s own grid inside the placer, as a second narrow, counted exception', () => {
		// §4.5's guard rail says an instrument that cannot be added without touching a
		// production module is a STOP. The grid is the exception that WAS authorized:
		// the placer itself must choose which implementation to walk, and no page-side
		// module can reach inside it. So the count is pinned — one import, one read —
		// and the second reader is the DEV arm module, nothing else.
		const placer = fs.readFileSync(
			path.resolve(editorRoot, 'src/lib/editor/layout/plan-room-labels.ts'),
			'utf8'
		);
		expect(occurrences(placer, "from './p23b-m1-room-label-arm'")).toBe(1);
		expect(occurrences(placer, 'p23bM1RoomLabelArm()')).toBe(1);
		for (const forbidden of [
			'p23bM1RecordActionLabelArm',
			'p23bM1ResetActionLabelArms',
			'p23bM1ActionLabelArms',
			'__P23B_M1_ROOM_LABEL_ARM__'
		]) {
			expect(placer, `the placer must not contain ${forbidden}`).not.toContain(forbidden);
		}
	});

	it('publishes the runner entry point and keeps the record on a DEV global', () => {
		expect(page).toContain('globals.__P23B_M1_RUN__ = () => runM1Capture();');
		expect(page).toContain('__P23B_M1_RECORD__');
		expect(page).toContain('p23b-m1:');
		expect(page).toContain('onclick={() => runM1Capture()}');
		// The BEFORE/AFTER mode is reachable from the page and from the CDP runner.
		expect(page).toContain('onclick={() => runM1Capture(true)}');
		expect(page).toContain('globals.__P23B_M1_RUN_ARMS__ = () => runM1Capture(true);');
		// …and the ROOM-LABEL arm mode is its own entry point, because the two changes
		// are orthogonal and a run that flipped both would confound them.
		expect(page).toContain('onclick={() => runM1Capture(false, true)}');
		expect(page).toContain(
			'globals.__P23B_M1_RUN_LABEL_ARMS__ = () => runM1Capture(false, true);'
		);
		// The page reports the ASSIGNMENT only; the per-arm rows are priced by the
		// runner, which is the only process that can see a presented frame.
		expect(page).toContain('p23bM1ActionLabelArms(');
		expect(page).not.toContain('summarizePresentedWindowArms');
		// The M1 record takes its ladder from the M1 run, not from the P23B.11 one.
		expect(page).toContain('planViewLadderPixelsPerMeter: m1LadderPixelsPerMeter');
		// The class rows are built from the ledger the harness read back when the
		// class closed, not from a live lookup alone (see `m1ClassLedger`).
		expect(page).toContain('m1ClassLedger(entry, p23bInteractionCaptureLedger)');
		// The page hands over the REGISTRY, never a pre-merged series: the class's own
		// measured population has to decide which brackets may be merged, and only
		// `summarizeM1Class` knows that population.
		expect(page).toContain('gestureRegistry: timing');
		expect(page).not.toContain('p23bM1GestureFramesFor(timing');
	});

	it('measures each class under the name the record reads it back by', () => {
		// One string names a class end to end: the session it opens, the prefix it is
		// reported under, and the key both M1 registries are read by. A class measured
		// under its bare name stores rows nobody can find — the record then reports the
		// gesture series and the long-frame window as not measured while the capture
		// still looks complete, which is exactly how this went unnoticed once.
		const measured = p23bM1MeasuredClass('rigid-wall-drag');
		expect(measured).toBe('p23b-m1:rigid-wall-drag');
		const series = buildGestureFrameSeries({
			label: 'plan-drag-edit',
			startedAt: 0,
			endedAt: 100,
			samples: [{ end: 16, interval: 16 }],
			pointermoveMarks: []
		});
		p23bM1ResetFrameTiming();
		const population = new Set([6]);
		p23bM1RecordGestureFrames('fixture-a', measured, 'plan-drag-edit', series, {
			index: 6,
			outcome: 'accepted'
		});
		p23bM1RecordLongFrames('fixture-a', measured, [], true);
		const registry = p23bM1FrameTiming();
		expect(p23bM1GestureFramesFor(registry, 'fixture-a', measured, population)).not.toBeNull();
		expect(p23bM1LongFramesFor(registry, 'fixture-a', measured)).not.toBeNull();
		expect(p23bM1GestureFramesFor(registry, 'fixture-a', 'rigid-wall-drag', population)).toBeNull();
		expect(p23bM1LongFramesFor(registry, 'fixture-a', 'rigid-wall-drag')).toBeNull();
		// A bracket whose action is outside the measured population is NOT merged,
		// and a population with no bracket reports null rather than a warm-up row.
		expect(p23bM1GestureFramesFor(registry, 'fixture-a', measured, new Set([7]))).toBeNull();
		p23bM1ResetFrameTiming();
		// And the run keys every class that way.
		expect(drive).toContain('actionClass: p23bM1MeasuredClass(entry.actionClass)');
	});

	it('adds no M1 instrumentation to a product module', () => {
		// The two authorized instrumentation items are page-side: a gesture sampler
		// and a long-animation-frame observer, both driven by the DEV harness.
		// Nothing in the product tree may learn about them — the plan's §4.5 guard
		// rail, "if an item cannot be added without touching a production module,
		// STOP and report".
		const untouched = [
			'src/lib/editor/layout/layout-preview-state.svelte.ts',
			'src/lib/editor/layout/layout-transient-edit.ts',
			'src/lib/editor/app/PlanWorkspace.svelte',
			'src/lib/editor/store/history-controller.svelte.ts'
		];
		for (const file of untouched) {
			const body = fs.readFileSync(path.resolve(editorRoot, file), 'utf8');
			expect(body, `${file} must not carry M1 instrumentation`).not.toContain('p23b-m1');
			expect(body, `${file} must not import the M1 frame timing`).not.toContain('p23bM1');
		}
	});

	it('gives the viewport exactly ONE DEV arm read, and nothing else about M1', () => {
		// ONE DELIBERATE, NARROW EXCEPTION (pre-P23B.8 follow-up §P5). A
		// same-session before/after needs the VIEWPORT to be able to run the path
		// this change removed, and no page-side instrument can reach that branch. So
		// the viewport learns exactly one thing — which arm to run — through one
		// import and one call. This assertion is what keeps that from growing: the
		// viewport may contain no recorder, no sampler, no observer, no registry and
		// no direct read of the arm global, and the two counts below are pinned.
		const viewport = fs.readFileSync(
			path.resolve(editorRoot, 'src/lib/editor/layout/LayoutPlanViewport.svelte'),
			'utf8'
		);
		for (const forbidden of [
			'p23bM1RecordGestureFrames',
			'p23bM1RecordActionArm',
			'p23bM1RecordLongFrames',
			'p23bM1ResetActionArms',
			'createP23BGestureFrameSampler',
			'p23bM1FrameTiming',
			'__P23B_M1_ROOM_DRAG_ARM__'
		]) {
			expect(viewport, `LayoutPlanViewport must not contain ${forbidden}`).not.toContain(forbidden);
		}
		expect(occurrences(viewport, "from './p23b-m1-room-drag-arm'")).toBe(1);
		expect(occurrences(viewport, 'p23bM1RoomDragArm()')).toBe(1);
	});
});

describe('M1 record — the post-release window (restore versus commit)', () => {
	/**
	 * Three accepted actions, each with a release, built so the two placements the
	 * split exists for are BOTH exercised:
	 *
	 *   A  work inside the release (which the D1 row already contains) AND work
	 *      after it, including a RESTORE whose own children nest three deep —
	 *      the case that must not be counted twice.
	 *   B  a mark the action recorded as UNBOUND: it begins after the release end
	 *      but outside every boundary, so it exists only in the containment
	 *      record's own remainder and would be invisible to a tree-only reader.
	 *   C  a pre-release unbound mark that must NOT reach the after-release window.
	 */
	const capture = ledger([
		action(0, { release: { start: 100, end: 140 }, frame: { start: 140, end: 300 } }),
		action(1, { release: { start: 1100, end: 1140 }, frame: { start: 1145, end: 1155 } }),
		action(2, { release: { start: 2100, end: 2140 }, frame: { start: 2140, end: 2300 } })
	]);
	const containment = buildP23BContainment(capture, [
		// A — inside the release, then the release's own aftermath.
		{ name: 'p2311:acceptance-compile', startTime: 105, duration: 20 },
		{ name: 'p2311:commit-capture', startTime: 141, duration: 4 },
		{ name: 'p2311:baseline-restore', startTime: 150, duration: 60 },
		{ name: 'p2311:restore-mesh-install', startTime: 152, duration: 55 },
		{ name: 'p2311:mesh-prebuild', startTime: 154, duration: 50 },
		// B — after the release, between boundaries: unbound, and only visible there.
		{ name: 'p2311:commit-capture', startTime: 1141, duration: 3 },
		// C — BEFORE the release and unbound: not part of any post-release window.
		{ name: 'p2311:mesh-prebuild', startTime: 2020, duration: 5 },
		{ name: 'p2311:commit-capture', startTime: 2141, duration: 10 }
	]);
	const measured = m1Population(capture, 'plan-drag-edit', 0).measured;

	it('splits every action into what the release contains and what follows it', () => {
		const window = postReleaseWindowOf(containment, measured);
		expect(window.withRelease).toBe(3);
		const [a, b, c] = window.rows;
		// A: the compile is INSIDE the release (the release row already holds it)…
		expect(a?.insideRelease.windowMs).toBe(20);
		expect(a?.insideRelease.commitMs).toBe(20);
		expect(a?.insideRelease.restoreMs).toBe(0);
		// …and the aftermath is 4 ms of commit beside a 60 ms restore.
		expect(a?.afterRelease.commitMs).toBe(4);
		expect(a?.afterRelease.restoreMs).toBe(60);
		// THE NO-DOUBLE-COUNT RULE: `restore-mesh-install` and `mesh-prebuild` are
		// inside `baseline-restore`, which is 150→210, so the union is 4 + 60 = 64 —
		// never 4 + 60 + 55 + 50.
		expect(a?.afterRelease.windowMs).toBe(64);
		expect(a?.afterRelease.labels.map((entry) => entry.label)).toEqual([
			'p2311:commit-capture',
			'p2311:baseline-restore'
		]);
		expect(a?.afterRelease.firstStartOffsetMs).toBe(1);
		// B: only the containment record's own remainder knows about this one.
		expect(b?.afterRelease.windowMs).toBe(3);
		expect(b?.afterRelease.commitMs).toBe(3);
		expect(b?.afterRelease.unboundMs).toBe(3);
		expect(b?.afterRelease.otherMs).toBe(0);
		// C: the unbound mark that began BEFORE the release is not after it.
		expect(c?.afterRelease.windowMs).toBe(10);
		expect(c?.afterRelease.otherMs).toBe(0);
		expect(c?.afterRelease.labels.every((entry) => entry.startOffsetMs >= 0)).toBe(true);
	});

	it('reports a nested mark under its parent, not as its own after-release row', () => {
		const window = postReleaseWindowOf(containment, measured);
		expect(window.byLabel['p2311:baseline-restore']).toMatchObject({
			family: 'restore',
			actionsAfter: 1,
			actionsInside: 0
		});
		expect(window.byLabel['p2311:baseline-restore']?.afterMs.p50).toBe(60);
		// The two marks nested inside the restore are inside a kept mark: they are
		// never counted as post-release rows of their own, and `byLabel` lists only
		// labels that REACHED a bucket — an absent key says "never built a window of
		// its own", which a zero could not distinguish from a measured zero.
		expect(window.byLabel['p2311:restore-mesh-install']).toBeUndefined();
		expect(window.byLabel['p2311:mesh-prebuild']).toBeUndefined();
		expect(window.byLabel['p2311:commit-capture']?.actionsAfter).toBe(3);
		expect(P23B_M1_POST_RELEASE_FAMILY['p2311:baseline-restore']).toBe('restore');
		expect(P23B_M1_POST_RELEASE_FAMILY['p2311:plan-render-model']).toBeUndefined();
	});

	it('pairs the window with the presented instant action by action, and counts its matches', () => {
		const window = postReleaseWindowOf(containment, measured);
		const pairing = pairM1PostReleaseWithPresented(window, [
			{ actionIndex: 0, latencyMs: 250 },
			{ actionIndex: 1, latencyMs: 20 },
			{ actionIndex: 2, latencyMs: 30 },
			// A release with no post-release row is NOT a pair, and is not guessed.
			{ actionIndex: 99, latencyMs: 40 }
		]);
		expect(pairing?.matchedActions).toBe(3);
		expect(pairing?.presented.p50).toBe(30);
		expect(pairing?.window.p50).toBe(10);
		// max(0, presented − window) per action: 186, 17, 20.
		expect(pairing?.unexplained.p50).toBe(20);
		expect(pairing?.insideRelease.p50).toBe(0);
		expect(pairing?.medians.windowShare).toBe(0.333);
		// No paired action at all is `null`, never a zero-length row.
		expect(pairM1PostReleaseWithPresented(window, [])).toBeNull();
	});

	it('merges overlapping intervals instead of summing them', () => {
		expect(unionMs([{ start: 0, end: 10 }, { start: 5, end: 20 }])).toBe(20);
		expect(unionMs([{ start: 0, end: 10 }, { start: 10, end: 20 }])).toBe(20);
		expect(unionMs([{ start: 30, end: 40 }, { start: 0, end: 10 }])).toBe(20);
		expect(unionMs([])).toBe(0);
	});
});

describe('M1 record — the before/after arms (one session, no pre-change tree)', () => {
	const fixtureId = 'fixture-arms';
	const actionClass = 'p23b-m1:whole-room-move-bridge';
	// Even attempts ran the shipped `transient` path, odd ones the pre-change
	// `per-move` path — the interleave the driver performs, recorded per action.
	const assignment: ReadonlyMap<number, P23BM1RoomDragArm> = new Map<number, P23BM1RoomDragArm>([
		[0, 'transient'],
		[1, 'per-move'],
		[2, 'transient'],
		[3, 'per-move']
	]);
	/** Four drags: two per arm, with the arms given deliberately different costs. */
	const drags = [
		action(0, { release: { start: 100, end: 120 }, frame: { start: 120, end: 122 } }),
		action(1, { release: { start: 200, end: 260 }, frame: { start: 260, end: 280 } }),
		action(2, { release: { start: 300, end: 340 }, frame: { start: 340, end: 348 } }),
		action(3, { release: { start: 400, end: 520 }, frame: { start: 520, end: 560 } })
	];
	// The pre-change path compiles and installs per pointermove; the shipped path
	// does not. The mark is on the per-move actions ONLY — that asymmetry is the
	// finding the split exists to report.
	const marks = [
		{ name: 'p2311:preview-compile', startTime: 210, duration: 30 },
		{ name: 'p2311:preview-compile', startTime: 410, duration: 60 }
	];

	function series(interval: number) {
		return buildGestureFrameSeries({
			label: 'plan-drag-edit',
			startedAt: 0,
			endedAt: 100,
			samples: [{ end: interval, interval }],
			pointermoveMarks: []
		});
	}

	function armRow() {
		const capture = ledger(drags);
		return summarizeM1Class({
			fixtureId,
			sessionId: 'session-arms',
			actionClass,
			actionPath: 'plan-drag-edit',
			ledger: capture,
			containment: buildP23BContainment(capture, marks),
			warmup: 0,
			actionsPerClass: 4,
			gestureRegistry: {
				gestureFrames: [
					{ key: 't0', fixtureId, actionClass, path: 'plan-drag-edit', actionIndex: 0, outcome: 'accepted', series: series(10) },
					{ key: 'p1', fixtureId, actionClass, path: 'plan-drag-edit', actionIndex: 1, outcome: 'accepted', series: series(100) },
					{ key: 't2', fixtureId, actionClass, path: 'plan-drag-edit', actionIndex: 2, outcome: 'accepted', series: series(10) },
					{ key: 'p3', fixtureId, actionClass, path: 'plan-drag-edit', actionIndex: 3, outcome: 'accepted', series: series(100) }
				],
				longFrames: []
			},
			longFrameWindow: { supported: true, entries: [] },
			actionArms: assignment
		});
	}

	it('splits the measured population by arm and marks the mixed class rows as mixed', () => {
		const row = armRow();
		expect(row.arms?.rule).toBe(P23B_M1_ARM_RULE);
		expect(row.arms?.arms).toEqual(['transient', 'per-move']);
		expect(row.arms?.mixed).toBe(true);
		expect(row.arms?.rows.map((arm) => [arm.arm, arm.actions])).toEqual([
			['transient', 2],
			['per-move', 2]
		]);
		// The class's own rows beside the block span BOTH arms, which is exactly why
		// the per-arm rows exist; the reader is told rather than left to infer it.
		expect(row.boundaries['release']?.count).toBe(4);
		expect(row.arms?.mixed).toBe(true);
	});

	it('takes each arm over its OWN actions: the pre-move path pays preview-compile, the shipped path does not', () => {
		const row = armRow();
		const transient = row.arms?.rows.find((arm) => arm.arm === 'transient');
		const perMove = row.arms?.rows.find((arm) => arm.arm === 'per-move');
		expect(transient?.marks['p2311:preview-compile']).toBeUndefined();
		expect(perMove?.marks['p2311:preview-compile']).toMatchObject({ count: 2 });
		// The class row pools both arms, so its own mark row is the mixed population
		// the `mixed` flag warns about.
		expect(row.marks['p2311:preview-compile']?.count).toBe(2);
		// Every arm's rows are taken over its own measured accepted actions.
		expect(transient?.boundaries['release']?.count).toBe(2);
		expect(perMove?.boundaries['release']?.count).toBe(2);
	});

	it('reports the before/after table with signed deltas, and a null cell rather than a zero', () => {
		const row = armRow();
		const byLabel = new Map((row.arms?.comparison.rows ?? []).map((entry) => [entry.label, entry]));
		const release = byLabel.get('release');
		expect(release?.perMoveMs).not.toBeNull();
		expect(release?.transientMs).not.toBeNull();
		// Delay before, saving after: the delta is `transient − perMove` and is signed.
		expect(release!.perMoveMs!).toBeGreaterThan(release!.transientMs!);
		expect(release!.deltaMs!).toBeLessThan(0);
		const gesture = byLabel.get('gesture rAF interval p50');
		expect(gesture?.perMoveMs).toBe(100);
		expect(gesture?.transientMs).toBe(10);
		expect(gesture?.deltaMs).toBe(-90);
		expect(gesture?.ratio).toBe(0.1);
		// The pre-move arm alone pays preview-compile, so the arm that never pays it
		// reports NULL — a zero would read as "it was free", which is not measured.
		const compile = byLabel.get('mark p2311:preview-compile');
		expect(compile?.transientMs).toBeNull();
		expect(compile?.deltaMs).toBeNull();
		expect(compile?.perMoveMs).not.toBeNull();
		expect(row.arms?.comparison.note).toContain('WITHIN-SESSION');
	});

	it('resolves each arm\'s gesture series over that arm\'s own measured actions', () => {
		const row = armRow();
		const transient = row.arms?.rows.find((arm) => arm.arm === 'transient');
		const perMove = row.arms?.rows.find((arm) => arm.arm === 'per-move');
		// Each arm merges its OWN two brackets and COUNTS the other arm's two as
		// excluded — an arm's row never pools the other arm's frames.
		expect(transient?.gestureFrames?.coverage).toMatchObject({
			drags: 2,
			registeredDrags: 4,
			excludedDrags: 2
		});
		expect(perMove?.gestureFrames?.coverage).toMatchObject({
			drags: 2,
			registeredDrags: 4,
			excludedDrags: 2
		});
		expect(transient?.gestureFrames?.distribution.p50).toBe(10);
		expect(perMove?.gestureFrames?.distribution.p50).toBe(100);
	});

	it('reports NO arms block for a class that ran one path, instead of an empty one', () => {
		const capture = ledger(drags);
		const row = summarizeM1Class({
			fixtureId,
			sessionId: 'session-arms',
			actionClass,
			actionPath: 'plan-drag-edit',
			ledger: capture,
			containment: buildP23BContainment(capture, marks),
			warmup: 0,
			gestureRegistry: noGestures(),
			longFrameWindow: null,
			actionArms: new Map()
		});
		expect(row.arms).toBeNull();
	});
});

describe('M1 record — the room-label arm (the assignment the page reports, the rows the runner prices)', () => {
	const fixtureId = 'fixture-labels';
	const actionClass = 'p23b-m1:rigid-wall-drag';
	const key = `${fixtureId}/${actionClass}`;
	// The class this dimension rides on: the placer runs on every Plan render, so it
	// is recorded in every class — here on the rigid drag's own actions.
	const drags = [
		action(0, { release: { start: 100, end: 120 }, frame: { start: 120, end: 122 } }),
		action(1, { release: { start: 200, end: 260 }, frame: { start: 260, end: 280 } }),
		action(2, { release: { start: 300, end: 340 }, frame: { start: 340, end: 348 } })
	];
	const marks = [{ name: 'p2311:preview-compile', startTime: 210, duration: 30 }];
	// The placer runs in EVERY class, so this dimension is recorded over every class —
	// even and odd attempts alternating between the shipped and the pre-change grid.
	const assignment: ReadonlyMap<number, P23BM1RoomLabelArm> = new Map<number, P23BM1RoomLabelArm>([
		[0, 'pruned-grid'],
		[1, 'per-cell-grid'],
		[2, 'pruned-grid']
	]);

	it('records the assignment per resolved action, sorted, with the rule it was made under', () => {
		const row = summarizeM1Class({
			fixtureId,
			sessionId: 'session-labels',
			actionClass,
			actionPath: 'plan-drag-edit',
			ledger: ledger(drags),
			containment: buildP23BContainment(ledger(drags), marks),
			warmup: 0,
			gestureRegistry: noGestures(),
			longFrameWindow: null,
			actionLabelArms: assignment
		});
		expect(row.labelArms?.rule).toBe(P23B_M1_ROOM_LABEL_ARM_RULE);
		expect(row.labelArms?.arms).toEqual(P23B_M1_ROOM_LABEL_ARMS);
		expect(row.labelArms?.byAction).toEqual([
			{ actionIndex: 0, arm: 'pruned-grid' },
			{ actionIndex: 1, arm: 'per-cell-grid' },
			{ actionIndex: 2, arm: 'pruned-grid' }
		]);
	});

	it('reports NO label block for a run that took no arm, so the runner cannot invent a split', () => {
		const row = summarizeM1Class({
			fixtureId,
			sessionId: 'session-labels',
			actionClass,
			actionPath: 'plan-drag-edit',
			ledger: ledger(drags),
			containment: buildP23BContainment(ledger(drags), marks),
			warmup: 0,
			gestureRegistry: noGestures(),
			longFrameWindow: null,
			actionLabelArms: new Map()
		});
		expect(row.labelArms).toBeNull();
	});

	it('carries the runner\u2019s split under the rule and note it was produced under', () => {
		const windowRow = (arm: string, windows: number) => ({
			arm,
			assignedActions: windows,
			windows,
			summary: {
				definition: 'window',
				windows,
				windowMs: summarizeIntervals([120]),
				frameOccupiedMs: summarizeIntervals([]),
				outsideFramesMs: summarizeIntervals([]),
				framesPerWindow: summarizeIntervals([]),
				phases: [],
				scriptFunctions: []
			}
		});
		const block = summarizeLabelArmWindows({
			presentedWindows: 7,
			rows: [
				{
					key,
					unassignedWindows: 2,
					arms: [windowRow('pruned-grid', 3), windowRow('per-cell-grid', 2)],
					comparison: [
						{ label: 'window p50', beforeMs: 200, afterMs: 120, deltaMs: -80, ratio: 0.6 }
					],
					cpu: [
						{ key: 'per-cell-grid', windows: 2, sampledInWindowMs: 90, topSelfTime: [] }
					]
				}
			]
		});
		expect(block?.rule).toBe(P23B_M1_LABEL_ARM_WINDOW_RULE);
		expect(block?.note).toBe(P23B_M1_WINDOW_ARM_NOTE);
		// The shipped grid is the AFTER side by construction, so the sign of every
		// delta is knowable without reading the rows.
		expect(block?.afterArm).toBe('pruned-grid');
		expect(block?.beforeArm).toBe('per-cell-grid');
		expect(block?.notMeasuredReason).toBeNull();
		expect(block?.rows[0]?.unassignedWindows).toBe(2);
		expect(block?.rows[0]?.cpu.map((row) => row.key)).toEqual(['per-cell-grid']);
	});

	it('says NOT MEASURED when every arm came back empty, instead of an empty comparison', () => {
		const emptyArm = (arm: string) => ({
			arm,
			assignedActions: 4,
			windows: 0,
			summary: {
				definition: 'window',
				windows: 0,
				windowMs: summarizeIntervals([]),
				frameOccupiedMs: summarizeIntervals([]),
				outsideFramesMs: summarizeIntervals([]),
				framesPerWindow: summarizeIntervals([]),
				phases: [],
				scriptFunctions: []
			}
		});
		const block = summarizeLabelArmWindows({
			presentedWindows: 0,
			rows: [{ key, unassignedWindows: 0, arms: [emptyArm('pruned-grid'), emptyArm('per-cell-grid')], comparison: [], cpu: [] }]
		});
		expect(block?.notMeasuredReason).toContain('NOT MEASURED');
		// …and the rows are still carried: an arm that ran 4 actions and covered no
		// window is a measurement about the run, not an absent one.
		expect(block?.rows[0]?.arms.map((arm) => arm.assignedActions)).toEqual([4, 4]);
		expect(summarizeLabelArmWindows({ rows: [], presentedWindows: 0 })).toBeNull();
	});
});
