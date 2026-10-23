/**
 * F3 / F4 / F8 methodology + the correlation proof (T3.P03.S02).
 *
 * F3 has no shipped drawing feature yet: the phase measures the methodology on
 * the shipped straight-Wall drag (the Layout adapter's Dimensions handles), then
 * F4's typed precision commit and F8's Undo/Redo on the same accepted revision.
 * Later consumers add their own flow marks; this slice does not pre-build them.
 *
 * The proof the plan requires: a deliberately delayed preview must show up as
 * **latency, not a dropped sample**. The harness reruns the same drag with every
 * application rAF callback delayed; every dispatched input must still have a
 * ledger row, and the presented latency must grow. The delay is a harness init
 * script, never a product flag.
 *
 * These are methodology numbers, not budget claims. F3's hard rows are accepted
 * only from the designated reference machine.
 */

import { expect, test } from '@playwright/test';

import { collectMeasuredRuns, newMeasuredSession, type MeasuredSession } from '../lib/browser';
import {
	DEVICE_SCALE_FACTOR,
	INPUT_SAMPLES,
	NETWORK,
	RUNS,
	VIEWPORT,
	WARMUP_RUNS,
	passLimitations
} from '../lib/config';
import { fixtureProject } from '../lib/fixtures';
import {
	acceptedResultCount,
	closeToHub,
	commitPrecisionLength,
	dragWallHandle,
	gotoCreateIntent,
	openSourceJson,
	selectFirstWallAndOpenDimensions,
	undoRedoCycles,
	uniqueProjectId,
	waitForAcceptedResult
} from '../lib/flow';
import { correlateInputs, firstFrameAtOrAfter, latestInputAge, readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

/** A short extension along the Wall itself: valid candidates, never a collision. */
const DRAG_DISTANCE = 6;
const DELAYED_FRAME_MS = 500;
const DELAYED_RUNS = 3;
const UNDO_REDO_CYCLES = 20;

type DragRun = {
	readonly dispatched: number;
	readonly rows: number;
	readonly presented: number;
	readonly superseded: number;
	readonly unresolved: number;
	readonly refused: number;
	readonly latencies: number[];
	readonly ages: number[];
	readonly commitCompletion: number | null;
	readonly precisionCompletion: number | null;
	readonly undoCompletion: number[];
	readonly redoCompletion: number[];
};

function commandCompletion(
	records: Awaited<ReturnType<typeof readLedger>>['records'],
	ticks: readonly number[],
	commandName: string
): number | null {
	const command = [...records].reverse().find((record) => record.name === commandName && record.kind === 'mark');
	if (command === undefined) return null;
	const result = records.find(
		(record) => record.kind === 'result' && record.name === 'accepted-result' && record.time >= command.time
	);
	if (result === undefined) return null;
	const presented = firstFrameAtOrAfter(ticks, result.time);
	return presented === null ? null : presented - command.time;
}

async function runDrag(
	session: MeasuredSession,
	options: { settleMs?: number } = {}
): Promise<DragRun> {
	const { page } = session;
	const projectId = uniqueProjectId('f3');
	const project = await fixtureProject('S', projectId);
	await gotoCreateIntent(page, projectId);
	await openSourceJson(page, project);
	await selectFirstWallAndOpenDimensions(page);

	const beforeDrag = await acceptedResultCount(page);
	await dragWallHandle(page, {
		samples: INPUT_SAMPLES,
		distance: DRAG_DISTANCE,
		settleMs: options.settleMs ?? 0
	});
	await waitForAcceptedResult(page, beforeDrag);

	// An accepted install rebinds the adapter's task; reopen Dimensions through the
	// shipped Index entry before the typed command.
	await selectFirstWallAndOpenDimensions(page);
	const beforePrecision = await acceptedResultCount(page);
	await commitPrecisionLength(page, 4.5);
	await waitForAcceptedResult(page, beforePrecision);

	const beforeUndoRedo = await acceptedResultCount(page);
	await undoRedoCycles(page, UNDO_REDO_CYCLES);
	expect(await acceptedResultCount(page)).toBeGreaterThanOrEqual(beforeUndoRedo + UNDO_REDO_CYCLES * 2 - 2);

	const ledger = await readLedger(page);
	const samples = correlateInputs(ledger.records, ledger.ticks);
	const presented = samples.filter((sample) => sample.status === 'presented');
	const latencies = presented.map((sample) => sample.latency).filter((value): value is number => value !== null);

	// Command completion, per command kind: the frame after the installed result.
	const commitCompletion = commandCompletion(ledger.records, ledger.ticks, 'command:commit');
	const precisionCompletion = commandCompletion(ledger.records, ledger.ticks, 'command:instrument');
	const undoCompletions: number[] = [];
	const redoCompletions: number[] = [];
	for (const [index, record] of ledger.records.entries()) {
		if (record.kind !== 'mark' || (record.name !== 'command:undo' && record.name !== 'command:redo')) continue;
		const next = ledger.records
			.slice(index + 1)
			.find((candidate) => candidate.kind === 'result' && candidate.name === 'accepted-result');
		if (next === undefined) continue;
		const presentedAt = firstFrameAtOrAfter(ledger.ticks, next.time);
		if (presentedAt === null) continue;
		(record.name === 'command:undo' ? undoCompletions : redoCompletions).push(presentedAt - record.time);
	}

	return {
		dispatched: INPUT_SAMPLES,
		rows: samples.length,
		presented: presented.length,
		superseded: samples.filter((sample) => sample.status === 'superseded').length,
		unresolved: samples.filter((sample) => sample.status === 'unresolved').length,
		refused: samples.filter((sample) => sample.status === 'refused').length,
		latencies,
		ages: latestInputAge(samples),
		commitCompletion,
		precisionCompletion,
		undoCompletion: undoCompletions,
		redoCompletion: redoCompletions
	};
}

test.describe('F3/F4/F8 methodology', () => {
	// Eleven runs per cache state (one discarded) each drive 60 pointer samples, a
	// precision commit and 40 Undo/Redo commits; the delay proof adds four more
	// runs with a deliberate 500 ms frame delay. This is measured work, not a hung
	// test.
	test.setTimeout(1_800_000);

	test('drag correlation, precision commit and undo/redo, cold, warm and repeat-use', async ({ browser }, testInfo) => {
		const report = startReport(`drag-correlation-${testInfo.project.name.replace(/\s+/g, '-')}`);
		const limitations = passLimitations();
		for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
			const { results: runs, facts } = await collectMeasuredRuns(
				browser,
				{ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK },
				{
					cacheState,
					warmup: WARMUP_RUNS,
					runs: RUNS,
					afterRun: cacheState === 'repeat-use' ? closeToHub : undefined
				},
				(session) => runDrag(session)
			);
			const latencies = runs.flatMap((run) => run.latencies);
			const ages = runs.flatMap((run) => run.ages);
			const undo = runs.flatMap((run) => run.undoCompletion);
			const redo = runs.flatMap((run) => run.redoCompletion);
			const commit = runs
				.map((run) => run.commitCompletion)
				.filter((value): value is number => value !== null);
			const precision = runs
				.map((run) => run.precisionCompletion)
				.filter((value): value is number => value !== null);
			const row: ResultRow = {
				id: `F3-methodology-S-${cacheState}`,
				flow: 'F3/F4/F8 methodology on the shipped straight-Wall drag',
				workload: 'S fixture, 60 pointer samples, exact length, 20 Undo/Redo cycles',
				cacheState,
				network: NETWORK,
				browser: `${testInfo.project.name} ${facts.chromeVersion}`,
				cpuRate: 1,
				viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
				metrics: {
					dispatched: runs.reduce((sum, run) => sum + run.dispatched, 0),
					rows: runs.reduce((sum, run) => sum + run.rows, 0),
					presented: runs.reduce((sum, run) => sum + run.presented, 0),
					superseded: runs.reduce((sum, run) => sum + run.superseded, 0),
					unresolved: runs.reduce((sum, run) => sum + run.unresolved, 0),
					refused: runs.reduce((sum, run) => sum + run.refused, 0),
					latestInputAgeMedian: summarize(ages).median
				},
				stats: {
					inputToMatchingPreview: summarize(latencies),
					commitCompletion: summarize(commit),
					precisionCompletion: summarize(precision),
					undoCompletion: summarize(undo),
					redoCompletion: summarize(redo)
				},
				limitations: [
					...limitations,
					'no drawing feature exists in this slice: F3 measures the methodology on the shipped Wall drag',
					'GPU, frame-time and GPU-memory rows stay unrun and owner-run on the reference machine'
				]
			};
			report.rows.push(row);
			console.log(formatRow(row));
			expect(runs.every((run) => run.rows === run.dispatched)).toBe(true);
		}
		const path = fileReport(report);
		console.log(`raw results: ${path}`);
		expect(report.rows).toHaveLength(3);
	});

	test('a deliberately delayed preview shows latency, not a dropped sample', async ({ browser }, testInfo) => {
		const report = startReport(`drag-delay-proof-${testInfo.project.name.replace(/\s+/g, '-')}`);
		const limitations = passLimitations();
		const measure = async (frameDelayMs: number, settleMs: number): Promise<DragRun[]> => {
			const session = await newMeasuredSession(browser, {
				viewport: VIEWPORT,
				deviceScaleFactor: DEVICE_SCALE_FACTOR,
				network: NETWORK,
				cacheState: 'warm',
				harness: { frameDelayMs }
			});
			try {
				const runs: DragRun[] = [];
				for (let index = 0; index < (frameDelayMs === 0 ? RUNS : DELAYED_RUNS); index++) {
					runs.push(await runDrag(session, { settleMs }));
				}
				return runs;
			} finally {
				await session.close();
			}
		};
		const baseline = await measure(0, 0);
		// Settle past one delayed frame so the final preview actually paints before
		// release clears it; the delay itself is what the measurement must expose.
		const delayed = await measure(DELAYED_FRAME_MS, DELAYED_FRAME_MS + 120);
		const baselineLatency = summarize(baseline.flatMap((run) => run.latencies));
		const delayedLatency = summarize(delayed.flatMap((run) => run.latencies));
		const delayedSuperseded = delayed.reduce((sum, run) => sum + run.superseded, 0);
		const row: ResultRow = {
			id: 'F3-correlation-delay-proof',
			flow: 'F3 correlation proof (harness-injected frame delay)',
			workload: `S fixture, ${INPUT_SAMPLES} samples per run; baseline runs=${baseline.length}, delayed runs=${delayed.length}`,
			cacheState: 'warm',
			network: NETWORK,
			browser: `${testInfo.project.name}`,
			cpuRate: 1,
			viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
			metrics: {
				baselineRows: baseline.reduce((sum, run) => sum + run.rows, 0),
				baselineDispatched: baseline.reduce((sum, run) => sum + run.dispatched, 0),
				delayedRows: delayed.reduce((sum, run) => sum + run.rows, 0),
				delayedDispatched: delayed.reduce((sum, run) => sum + run.dispatched, 0),
				delayedMissedSamples: delayed.reduce((sum, run) => sum + (run.dispatched - run.rows), 0),
				delayedPresented: delayed.reduce((sum, run) => sum + run.presented, 0),
				delayedSuperseded
			},
			stats: {
				baselineInputToMatchingPreview: baselineLatency,
				delayedInputToMatchingPreview: delayedLatency
			},
			limitations: [
				...limitations,
				`delay is a harness init script that defers every application rAF callback by ${DELAYED_FRAME_MS} ms`,
				'the injected delay coalesces presentations: most delayed samples are recorded as superseded, not presented',
				'the accepted commit refreshes the overlay synchronously, so the final presented sample can be earlier than the injected delay; the delayed tail is a lower bound of that delay',
				'presentation is the rendering-opportunity frame, not a traced image'
			]
		};
		report.rows.push(row);
		console.log(formatRow(row));
		const path = fileReport(report);
		console.log(`raw results: ${path}`);

		// The proof: every dispatched input keeps a ledger row (no dropped sample),
		// the delayed presentation shifts the measured distribution well beyond the
		// baseline, and the coalesced inputs are recorded as superseded rather than
		// deleted. The comparison is relative on purpose: the injected delay is a
		// harness amount, so an absolute threshold would encode this machine's
		// rendering speed rather than the correlation property being proved.
		for (const run of [...baseline, ...delayed]) expect(run.rows).toBe(run.dispatched);
		expect(delayedLatency.count).toBeGreaterThan(0);
		// A delayed presentation must clear the whole baseline distribution: a
		// median-only move would not prove the injected delay was present.
		expect(delayedLatency.p95).toBeGreaterThan(baselineLatency.p95);
		expect(delayedLatency.max).toBeGreaterThan(baselineLatency.max * 2);
		expect(delayedSuperseded).toBeGreaterThan(0);
	});
});
