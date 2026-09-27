import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildP23BContainment } from '$lib/bench/p23b-containment';
import type { P23BCaptureLedger } from '$lib/bench/bench-types';
import {
	buildP23BM1Record,
	m1ClassLedger,
	m1Population,
	summarizeM1Class,
	P23B6_S1B_D1_COMPARISON,
	P23B_M1_D13_NOTE,
	P23B_M1_WARMUP_RULE
} from '$lib/bench/p23b-m1-record';
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
import { p23bM1MeasuredClass } from '../../../src/routes/dev/perf/p23b/drive';

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
	it('excludes the leading warm-up actions per path in ledger order, then keeps accepted only', () => {
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
		expect(population.acceptedIncludingWarmup).toBe(3);
		expect(population.excludedByOutcome).toBe(0);
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
			gestureFrames: null,
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
			gestureFrames: null,
			longFrameWindow: null
		});
		expect(row.longFrames.frames).toBe(0);
		expect(row.longFrames.supported).toBe(false);
		expect(row.longFrames.notMeasuredReason).toContain('NOT MEASURED');
	});

	it('keeps the gesture series inside the class that carried it', () => {
		const capture = ledger(drags);
		const row = summarizeM1Class({
			fixtureId: 'fixture',
			sessionId: 'session-1',
			actionClass: 'p23b-m1:rigid-wall-drag',
			actionPath: 'plan-drag-edit',
			ledger: capture,
			containment: buildP23BContainment(capture, []),
			warmup: 0,
			gestureFrames: {
				label: 'plan-drag-edit',
				definition: P23B_M1_GESTURE_FRAME_DEFINITION,
				startedAt: 0,
				endedAt: 100,
				spanMs: 100,
				frames: 1,
				samples: [{ end: 16, interval: 16 }],
				distribution: { count: 1, p50: 16, p95: 16, max: 16, mean: 16 },
				overFrameBudget: 0,
				over50Ms: 0,
				pointermove: [],
				coverage: {
					drags: 1,
					frames: 1,
					framesInsidePointermoveWindows: 1,
					pointermoveMarks: 1,
					pointermoveShare: 1
				}
			},
			longFrameWindow: null
		});
		expect(row.gestureFrames?.coverage.drags).toBe(1);
		expect(row.gestureFrames?.definition).toBe(P23B_M1_GESTURE_FRAME_DEFINITION);
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
			gestureFrames: null,
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
		expect(record.provenance.fixtureOrder).toEqual(['fixture-a', 'fixture-b']);
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
		expect(drive).toContain('async function runM1()');
	});

	it('publishes the runner entry point and keeps the record on a DEV global', () => {
		expect(page).toContain('globals.__P23B_M1_RUN__ = () => runM1Capture();');
		expect(page).toContain('__P23B_M1_RECORD__');
		expect(page).toContain('p23b-m1:');
		expect(page).toContain('onclick={runM1Capture}');
		// The M1 record takes its ladder from the M1 run, not from the P23B.11 one.
		expect(page).toContain('planViewLadderPixelsPerMeter: m1LadderPixelsPerMeter');
		// The class rows are built from the ledger the harness read back when the
		// class closed, not from a live lookup alone (see `m1ClassLedger`).
		expect(page).toContain('m1ClassLedger(entry, p23bInteractionCaptureLedger)');
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
		p23bM1RecordGestureFrames('fixture-a', measured, 'plan-drag-edit', series);
		p23bM1RecordLongFrames('fixture-a', measured, [], true);
		const registry = p23bM1FrameTiming();
		expect(p23bM1GestureFramesFor(registry, 'fixture-a', measured)).not.toBeNull();
		expect(p23bM1LongFramesFor(registry, 'fixture-a', measured)).not.toBeNull();
		expect(p23bM1GestureFramesFor(registry, 'fixture-a', 'rigid-wall-drag')).toBeNull();
		expect(p23bM1LongFramesFor(registry, 'fixture-a', 'rigid-wall-drag')).toBeNull();
		p23bM1ResetFrameTiming();
		// And the run keys every class that way.
		expect(drive).toContain('actionClass: p23bM1MeasuredClass(entry.actionClass)');
	});

	it('adds no M1 instrumentation to a product module', () => {
		// The two authorized items are page-side: a gesture sampler and a
		// long-animation-frame observer, both driven by the DEV harness. Nothing in
		// the product tree may learn about them, which is what the plan's §4.5 guard
		// rail means by "if an item cannot be added without touching a production
		// module, STOP and report".
		const productFiles = [
			'src/lib/editor/layout/LayoutPlanViewport.svelte',
			'src/lib/editor/layout/layout-preview-state.svelte.ts',
			'src/lib/editor/layout/layout-transient-edit.ts',
			'src/lib/editor/app/PlanWorkspace.svelte',
			'src/lib/editor/store/history-controller.svelte.ts'
		];
		for (const file of productFiles) {
			const body = fs.readFileSync(path.resolve(editorRoot, file), 'utf8');
			expect(body, `${file} must not carry M1 instrumentation`).not.toContain('p23b-m1');
			expect(body, `${file} must not import the M1 frame timing`).not.toContain('p23bM1');
		}
	});
});
