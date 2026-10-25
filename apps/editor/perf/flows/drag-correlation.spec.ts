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
 * T1.P02.S06 tiers the flow (A.3, A.4): each run loads its tier's precomputed
 * JSON once (setup), then takes `PERF_DRAG_SAMPLES` samples at that loaded peak
 * state. Every sample uses a distinct input (drag distance, typed length) and
 * is reset by the product's own Undo, never a re-open. A sample that ran no
 * compile was served by a reuse cache: it is counted separately and never
 * enters the F3/F4 windows.
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
import {
	acceptedResultCount,
	closeToHub,
	commitPrecisionLength,
	dragWallHandle,
	gotoCreateIntent,
	openSourceJson,
	selectFirstWallAndOpenDimensions,
	selectWallAndOpenDimensions,
	undoRedoCycles,
	uniqueProjectId,
	waitForAcceptedResult
} from '../lib/flow';
import { correlateInputs, firstFrameAtOrAfter, latestInputAge, readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';
import {
	E5_FOCUS_WALL_NAME,
	readRenderCounters,
	readWork,
	renderCounterDelta,
	renderMetrics,
	resetRenderMaxima,
	selectedTiers,
	smokeOr,
	tierAvailability,
	tierLimitations,
	tierProject,
	tierWorkloadLabel,
	workDelta,
	workMetrics,
	type RenderCounters,
	type WorkSnapshot
} from '../lib/tiers';
import type { WorkloadId } from '../lib/workloads/registry';

/** A short extension along the Wall itself: valid candidates, never a collision. */
const DRAG_DISTANCE = 6;
const DELAYED_FRAME_MS = 500;
const DELAYED_RUNS = 3;
const UNDO_REDO_CYCLES = smokeOr(20);
/** In-session samples per run at the loaded peak state (A.4). */
const DRAG_SAMPLES = smokeOr(Number(process.env.PERF_DRAG_SAMPLES ?? 5));
const DRAG_INPUTS = smokeOr(INPUT_SAMPLES);
const HANDLER_INPUT_CLOCK_LIMITATION =
	'input-to-matching-preview uses the pointermove handler mark (performance.now()), not the event timestamp; time queued before handler entry is omitted';

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
	/** Commit and precision completions per measured (not cache-served) sample. */
	readonly commitCompletions: number[];
	readonly precisionCompletions: number[];
	readonly cacheServed: number;
	readonly setupMs: number;
	readonly wallMs: number;
	readonly dragWork: WorkSnapshot;
	readonly commitWork: WorkSnapshot;
	readonly undoRedoWork: WorkSnapshot;
	readonly dragRender: Record<string, RenderCounters>;
};

function addWork(into: WorkSnapshot, window: WorkSnapshot): void {
	for (const [name, span] of Object.entries(window.spans)) {
		const target = (into.spans[name] ??= { count: 0, totalMs: 0, maxMs: 0 });
		target.count += span.count;
		target.totalMs += span.totalMs;
		target.maxMs = Math.max(target.maxMs, span.maxMs);
	}
	for (const [name, value] of Object.entries(window.counts)) into.counts[name] = (into.counts[name] ?? 0) + value;
}

async function undoOnce(page: import('@playwright/test').Page): Promise<void> {
	const before = await acceptedResultCount(page);
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await waitForAcceptedResult(page, before);
}

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
	tier: WorkloadId,
	options: { settleMs?: number; samples?: number; inputs?: number } = {}
): Promise<DragRun> {
	const { page } = session;
	const started = performance.now();
	const samples = options.samples ?? DRAG_SAMPLES;
	const inputs = options.inputs ?? DRAG_INPUTS;
	const projectId = uniqueProjectId(`f3-${tier}`);
	// Setup: the cached canonical JSON, admitted once; the session stays at peak.
	const project = tierProject(tier, projectId);
	// The museum family drags its focus Wall: the sweep latency rows hold E5's
	// fixed edits constant (C). Grids drag the Index's first Wall.
	const focusWallId = project.envelope.units.layout.data.walls.find((wall) => wall.name === E5_FOCUS_WALL_NAME)?.id;
	const openWall = () => (focusWallId === undefined ? selectFirstWallAndOpenDimensions(page) : selectWallAndOpenDimensions(page, focusWallId));
	await gotoCreateIntent(page, projectId);
	await openSourceJson(page, project);
	await openWall();
	const setupMs = performance.now() - started;

	const dragWork: WorkSnapshot = { spans: {}, counts: {} };
	const commitWork: WorkSnapshot = { spans: {}, counts: {} };
	const undoRedoWork: WorkSnapshot = { spans: {}, counts: {} };
	const commitCompletions: number[] = [];
	const precisionCompletions: number[] = [];
	let cacheServed = 0;
	let dragRender: Record<string, RenderCounters> = {};
	for (let sample = 0; sample < samples; sample++) {
		// F3: a distinct drag per sample, reset by Undo.
		await openWall();
		await resetRenderMaxima(page);
		const renderBefore = await readRenderCounters(page);
		const workBefore = await readWork(page);
		const beforeDrag = await acceptedResultCount(page);
		await dragWallHandle(page, {
			samples: inputs,
			distance: DRAG_DISTANCE + sample * 0.5,
			settleMs: options.settleMs ?? 0
		});
		await waitForAcceptedResult(page, beforeDrag);
		const dragWindow = workDelta(workBefore, await readWork(page));
		dragRender = renderCounterDelta(renderBefore, await readRenderCounters(page));
		let ledger = await readLedger(page);
		const commit = commandCompletion(ledger.records, ledger.ticks, 'command:commit');
		const served = (dragWindow.counts.compile ?? 0) === 0;
		if (served) cacheServed += 1;
		else {
			addWork(dragWork, dragWindow);
			if (commit !== null) commitCompletions.push(commit);
		}
		await undoOnce(page);

		// F4: a distinct typed length per sample, reset by Undo.
		await openWall();
		const precisionBefore = await readWork(page);
		const beforePrecision = await acceptedResultCount(page);
		await commitPrecisionLength(page, 4.5 + sample * 0.01);
		await waitForAcceptedResult(page, beforePrecision);
		const precisionWindow = workDelta(precisionBefore, await readWork(page));
		ledger = await readLedger(page);
		const precision = commandCompletion(ledger.records, ledger.ticks, 'command:instrument');
		if ((precisionWindow.counts.compile ?? 0) === 0) cacheServed += 1;
		else {
			addWork(commitWork, precisionWindow);
			if (precision !== null) precisionCompletions.push(precision);
		}
		await undoOnce(page);
	}

	// F8: one accepted edit, then Undo/Redo cycles over it.
	await openWall();
	const beforeEdit = await acceptedResultCount(page);
	await commitPrecisionLength(page, 4.4);
	await waitForAcceptedResult(page, beforeEdit);
	const f8Start = await page.evaluate(() => performance.now());
	const undoBefore = await readWork(page);
	const beforeUndoRedo = await acceptedResultCount(page);
	await undoRedoCycles(page, UNDO_REDO_CYCLES);
	expect(await acceptedResultCount(page)).toBeGreaterThanOrEqual(beforeUndoRedo + UNDO_REDO_CYCLES * 2 - 2);
	addWork(undoRedoWork, workDelta(undoBefore, await readWork(page)));

	const ledger = await readLedger(page);
	const correlated = correlateInputs(ledger.records, ledger.ticks);
	const presented = correlated.filter((entry) => entry.status === 'presented');
	const latencies = presented.map((entry) => entry.latency).filter((value): value is number => value !== null);

	const undoCompletions: number[] = [];
	const redoCompletions: number[] = [];
	for (const [index, record] of ledger.records.entries()) {
		if (record.time < f8Start) continue;
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
		dispatched: inputs * samples,
		rows: correlated.length,
		presented: presented.length,
		superseded: correlated.filter((entry) => entry.status === 'superseded').length,
		unresolved: correlated.filter((entry) => entry.status === 'unresolved').length,
		refused: correlated.filter((entry) => entry.status === 'refused').length,
		latencies,
		ages: latestInputAge(correlated),
		commitCompletion: commitCompletions[0] ?? null,
		precisionCompletion: precisionCompletions[0] ?? null,
		undoCompletion: undoCompletions,
		redoCompletion: redoCompletions,
		commitCompletions,
		precisionCompletions,
		cacheServed,
		setupMs,
		wallMs: performance.now() - started,
		dragWork,
		commitWork,
		undoRedoWork,
		dragRender
	};
}

test.describe('F3/F4/F8 methodology', () => {
	// Each run drives DRAG_SAMPLES drags and typed commits (each reset by Undo)
	// and 20 Undo/Redo cycles at the loaded peak; the delay proof adds four more
	// runs with a deliberate 500 ms frame delay. This is measured work, not a hung
	// test.
	test.setTimeout(7_200_000);

	for (const tier of selectedTiers()) {
		test(`drag correlation, precision commit and undo/redo at ${tier}, cold, warm and repeat-use`, async ({ browser }, testInfo) => {
			const report = startReport(`drag-correlation-${tier}-${testInfo.project.name.replace(/\s+/g, '-')}`);
			const availability = tierAvailability(tier);
			if (!availability.available) {
				report.rows.push({
					id: `F3-${tier}-unrun`,
					flow: 'F3/F4/F8 on the shipped straight-Wall drag',
					workload: tierWorkloadLabel(tier),
					browser: testInfo.project.name,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: { unrun: availability.reason },
					limitations: ['unrun tier: reported, not skipped silently']
				});
				console.log(`F3 ${tier}: unrun — ${availability.reason}`);
				fileReport(report);
				return;
			}
			const limitations = [...passLimitations(), ...tierLimitations(tier)];
			for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
				const { results: runs, facts } = await collectMeasuredRuns(
					browser,
					{ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK },
					{
						cacheState,
						warmup: smokeOr(WARMUP_RUNS, 0),
						runs: smokeOr(RUNS),
						afterRun: cacheState === 'repeat-use' ? closeToHub : undefined
					},
					(session) => runDrag(session, tier)
				);
				const latencies = runs.flatMap((run) => run.latencies);
				const ages = runs.flatMap((run) => run.ages);
				const undo = runs.flatMap((run) => run.undoCompletion);
				const redo = runs.flatMap((run) => run.redoCompletion);
				const commit = runs.flatMap((run) => run.commitCompletions);
				const precision = runs.flatMap((run) => run.precisionCompletions);
				const sum = (windows: WorkSnapshot[]) => {
					const total: WorkSnapshot = { spans: {}, counts: {} };
					for (const window of windows) addWork(total, window);
					return total;
				};
				const measuredDrags = Math.max(1, commit.length);
				const setupMs = runs.reduce((total, run) => total + run.setupMs, 0);
				const wallMs = runs.reduce((total, run) => total + run.wallMs, 0);
				const prefix = (metrics: Record<string, number>, name: string) =>
					Object.fromEntries(Object.entries(metrics).map(([key, value]) => [`${name}:${key}`, value]));
				const row: ResultRow = {
					id: `F3-${tier}-${cacheState}`,
					flow: 'F3/F4/F8 on the shipped straight-Wall drag',
					workload: `${tierWorkloadLabel(tier)}; ${DRAG_SAMPLES} samples × ${DRAG_INPUTS} pointer inputs per run (handler-mark input clock), distinct exact lengths, ${UNDO_REDO_CYCLES} Undo/Redo cycles`,
					cacheState,
					network: NETWORK,
					browser: `${testInfo.project.name} ${facts.chromeVersion}`,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: {
						dispatched: runs.reduce((total, run) => total + run.dispatched, 0),
						rows: runs.reduce((total, run) => total + run.rows, 0),
						presented: runs.reduce((total, run) => total + run.presented, 0),
						superseded: runs.reduce((total, run) => total + run.superseded, 0),
						unresolved: runs.reduce((total, run) => total + run.unresolved, 0),
						refused: runs.reduce((total, run) => total + run.refused, 0),
						cacheServedSamples: runs.reduce((total, run) => total + run.cacheServed, 0),
						latestInputAgeMedian: summarize(ages).median,
						setupMs,
						wallMs,
						setupShare: wallMs > 0 ? setupMs / wallMs : null,
						...prefix(workMetrics(sum(runs.map((run) => run.dragWork)), measuredDrags), 'drag'),
						...prefix(workMetrics(sum(runs.map((run) => run.commitWork)), Math.max(1, precision.length)), 'precision'),
						...prefix(workMetrics(sum(runs.map((run) => run.undoRedoWork)), Math.max(1, undo.length + redo.length)), 'undoRedo'),
						...prefix(renderMetrics(runs[runs.length - 1]?.dragRender ?? {}), 'drag'),
						// Planner evaluations per presented frame (C): each pointer move plans
						// synchronously, so this checks frame-aligned input coalescing.
						'drag:compilesPerPresentedFrame': (() => {
							const last = runs[runs.length - 1];
							const frames = last?.dragRender.stage?.frames ?? 0;
							return last === undefined || frames === 0 ? null : (last.dragWork.counts.compile ?? 0) / Math.max(1, DRAG_SAMPLES - last.cacheServed) / frames;
						})()
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
						HANDLER_INPUT_CLOCK_LIMITATION,
						'no drawing feature exists in this slice: F3 measures the methodology on the shipped Wall drag',
						'cache-served samples (no compile in the window) are counted separately and excluded from the windows',
						'drag:*/precision:* stage rows are per measured sample; undoRedo:* per command'
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
	}

	test('a deliberately delayed preview shows latency, not a dropped sample', async ({ browser }, testInfo) => {
		// One proof per pass, in the grid-S tier; it is a correctness proof, not a tier row.
		test.skip(!selectedTiers().includes('grid-S'), 'the delay proof runs with the grid-S tier');
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
				// The proof's own run counts survive smoke mode: with one delayed run the
				// only presented sample can be the synchronous commit refresh.
				for (let index = 0; index < (frameDelayMs === 0 ? Math.max(smokeOr(RUNS), 3) : DELAYED_RUNS); index++) {
					runs.push(await runDrag(session, 'grid-S', { settleMs, samples: 1, inputs: INPUT_SAMPLES }));
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
			workload: `grid-S workload, ${INPUT_SAMPLES} samples per run (pointermove handler-mark input clock); baseline runs=${baseline.length}, delayed runs=${delayed.length}`,
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
				HANDLER_INPUT_CLOCK_LIMITATION,
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
