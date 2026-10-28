/**
 * F3 / F4 / F8 methodology + the correlation proof (T3.P03.S02).
 *
 * F3 has no shipped drawing feature yet: the phase measures the methodology on
 * the shipped straight-Wall drag (the Layout adapter's selected-Wall handles), then
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
 * The owner's D1 ruling (2026-10-24) adds, outside every timed window: the JS
 * heap after a forced GC (with the DOM counters) after the open and after the
 * F3/F4/F8 sequence, and the Stage's live geometries, textures, programs,
 * materials and meshes after each accepted commit. D4: a renderer crash on a
 * report-only row is recorded once as a bounded failure row and the tier's
 * remaining cache states are not attempted; a crash at S, M or L still fails.
 * D5: `PERF_XL_DRAG_CACHE` (the bench's `--xl-drag-cache`) names the grid-XL
 * cache states a pass runs; the others are reported as unrun rows.
 *
 * These are methodology numbers, not budget claims. F3's hard rows are accepted
 * only from the designated reference machine.
 */

import { expect, test } from '@playwright/test';

import { collectMeasuredRuns, newMeasuredSession, type MeasuredSession } from '../lib/browser';
import {
	DEVICE_SCALE_FACTOR,
	DRAG_SAMPLES,
	INPUT_SAMPLES,
	LEAN,
	MILESTONE,
	NETWORK,
	RUNS,
	UNDO_REDO_CYCLES,
	VIEWPORT,
	WARMUP_RUNS,
	cacheStatesFor,
	passLimitations,
	runsFor
} from '../lib/config';
import {
	acceptedResultCount,
	closeToHub,
	commandPresentation,
	commitPrecisionLength,
	dragWallHandle,
	gotoCreateIntent,
	openSourceJson,
	selectFirstWall,
	selectWallById,
	undoRedoCycles,
	uniqueProjectId,
	waitForAcceptedResult,
	waitForStageSettled
} from '../lib/flow';
import { HARD_BUDGETS_MS, decisiveHardFailure, earlyStopEnabled } from '../lib/early-stop';
import {
	decideMilestoneRow,
	DRAG_FRAME_BUDGETS_MS,
	FRAME_INTERVAL_TOLERANCE_MS,
	MILESTONE_MAX_RUNS,
	milestoneOutcomeRules,
	milestoneOutcomesMetrics,
	type MilestoneRowOutcome
} from '../lib/milestone';
import { correlateInputs, firstFrameAtOrAfter, latestInputAge, readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';
import {
	crashBounded,
	crashRow,
	E5_FOCUS_WALL_NAME,
	heapMetrics,
	isRendererCrash,
	ownershipMetrics,
	readHeapAfterGc,
	readOwnership,
	readRenderCounters,
	readWork,
	renderCounterDelta,
	renderMetrics,
	resetRenderMaxima,
	selectedTiers,
	SMOKE,
	smokeOr,
	tierAvailability,
	tierLimitations,
	tierProject,
	tierWorkloadLabel,
	workDelta,
	workMetrics,
	type HeapSample,
	type Ownership,
	type RenderCounters,
	type WorkSnapshot,
	unrunRow
} from '../lib/tiers';
import type { WorkloadId } from '../lib/workloads/registry';

/** A short extension along the Wall itself: valid candidates, never a collision. */
const DRAG_DISTANCE = 6;
const DELAYED_FRAME_MS = 500;
const DELAYED_RUNS = 3;
const DRAG_INPUTS = smokeOr(INPUT_SAMPLES);
const CACHE_STATES = ['cold', 'warm', 'repeat-use'] as const;
/** D5: the grid-XL cache states this pass runs (every state unless the bench names some). */
function dragCacheStates(tier: WorkloadId): readonly (typeof CACHE_STATES)[number][] {
	const named = process.env.PERF_XL_DRAG_CACHE;
	if (tier !== 'grid-XL' || named === undefined) return CACHE_STATES;
	return CACHE_STATES.filter((state) => named.split(',').includes(state));
}
const HANDLER_INPUT_CLOCK_LIMITATION =
	'input-to-matching-preview uses the pointermove handler mark (performance.now()), not the event timestamp; time queued before handler entry is omitted';
/**
 * S04's supplemental Opening rows. Off by default so S06's accepted 15-row gate
 * keeps its exact shape; the S04 pass enables it to measure the Opening family
 * that S03 deferred.
 */
const OPENING_ROWS = process.env.PERF_OPENING_ROWS === '1';
/** The two typed Door starts that fit clear of the focus Wall's existing Window. */
const OPENING_OFFSETS = [1, 0.2] as const;

type DragRun = {
	readonly dispatched: number;
	readonly rows: number;
	readonly presented: number;
	readonly superseded: number;
	readonly unresolved: number;
	readonly refused: number;
	readonly latencies: number[];
	readonly ages: number[];
	/** rAF intervals inside the measured drag windows (F3's frame-time row). */
	readonly frameIntervals: number[];
	readonly longTasks: number;
	readonly longestTask: number;
	readonly commitCompletion: number | null;
	readonly precisionCompletion: number | null;
	readonly undoCompletion: number[];
	readonly redoCompletion: number[];
	/** Commit and precision completions per measured (not cache-served) sample. */
	readonly commitCompletions: number[];
	readonly precisionCompletions: number[];
	/** S04 supplemental: Opening create/delete and Undo/Redo completions. */
	readonly openingCreateCompletions: number[];
	readonly openingDeleteCompletions: number[];
	readonly openingUndoCompletion: number[];
	readonly openingRedoCompletion: number[];
	/** Drag samples that ran a compile (the denominator for the per-frame compile rate). */
	readonly dragCompiled: number;
	readonly cacheServed: number;
	readonly setupMs: number;
	readonly wallMs: number;
	readonly dragWork: WorkSnapshot;
	readonly commitWork: WorkSnapshot;
	readonly undoRedoWork: WorkSnapshot;
	readonly dragRender: Record<string, RenderCounters>;
	readonly heapAfterOpen: HeapSample;
	readonly heapAfterSequence: HeapSample;
	/** After each accepted commit (drag and typed), outside the timed windows. */
	readonly ownership: Ownership[];
};

/**
 * The compile span a pointer move runs. The accepted commit's representation
 * work is measured in F4; this row is the per-move Layout evaluation.
 */
function perEditCompileMs(run: DragRun): number {
	const compile = run.dragWork.spans['compile-delta']?.totalMs;
	return compile === undefined || run.dragCompiled === 0 ? Number.NaN : compile / run.dragCompiled / DRAG_INPUTS;
}

/**
 * The milestone decision set for one cache state's runs: F3's input latency and
 * latest-input age, F4's accepted completions, F8's Undo/Redo completions and,
 * at M, the per-edit Layout evaluation. Each row contributes **one entry**,
 * including `undecided`, so a missing row can never disappear from the verdict
 * list. Only the warm row is a decision row; cold and repeat-use are one-run
 * checks (the plan says so) and never produce a verdict.
 */
function dragMilestoneOutcomes(
	runs: readonly DragRun[],
	tier: WorkloadId,
	cacheState: string
): MilestoneRowOutcome[] | null {
	const budgets = HARD_BUDGETS_MS[tier];
	if (!MILESTONE || SMOKE || cacheState !== 'warm' || budgets === undefined) return null;
	const decide = (name: string, budget: number | undefined, values: (run: DragRun) => readonly number[]) => ({
		name,
		runs: runs.length,
		decision:
			budget === undefined
				? null
				: decideMilestoneRow({
						row: `${name}-${tier}-${cacheState}`,
						budgetMs: budget,
						perRunP95Ms: runs.map((run) => summarize(values(run)).p95),
						pooledP95Ms: summarize(runs.flatMap((run) => [...values(run)])).p95,
						maxRuns: MILESTONE_MAX_RUNS.f3,
						completedRuns: runs.length
					})
	});
	const outcomes: MilestoneRowOutcome[] = [
		decide('F3', budgets.F3, (run) => run.latencies),
		decide('F3-age', budgets.F3, (run) => run.ages),
		decide('F4', budgets.F4, (run) => [...run.commitCompletions, ...run.precisionCompletions]),
		decide('F8', budgets.F8, (run) => [...run.undoCompletion, ...run.redoCompletion])
	];
	// The contract's F3 row is also hard on frame time p95/p99 and long tasks.
	// The drag's rAF intervals give that row its own evidence; it is not inferred
	// from F7's orbit.
	const frameBudget = DRAG_FRAME_BUDGETS_MS[tier];
	if (frameBudget !== undefined) {
		const base = decideMilestoneRow({
			row: `F3-frame-${tier}-${cacheState}`,
			budgetMs: frameBudget.p95,
			perRunP95Ms: runs.map((run) => summarize(run.frameIntervals).p95),
			pooledP95Ms: summarize(runs.flatMap((run) => run.frameIntervals)).p95,
			maxRuns: MILESTONE_MAX_RUNS.f3,
			completedRuns: runs.length,
			headroom: 1
		});
		if (base !== null) {
			const atBound = runs.length >= MILESTONE_MAX_RUNS.f3;
			const p99 = summarize(runs.flatMap((run) => run.frameIntervals)).p99;
			const longest = Math.max(...runs.map((run) => run.longestTask));
			const reasons = [
				...(Number.isFinite(p99) && p99 > frameBudget.p99 + FRAME_INTERVAL_TOLERANCE_MS
					? [`p99 ${p99.toFixed(1)} ms exceeds the ${frameBudget.p99} ms hard budget`]
					: []),
				...(longest > frameBudget.longTask
					? [`a ${longest.toFixed(1)} ms long task breaches the 0 > ${frameBudget.longTask} ms hard clause`]
					: [])
			];
			const fail = base.verdict === 'fail' || (reasons.length > 0 && atBound);
			outcomes.push({
				name: 'F3-frame',
				runs: runs.length,
				decision:
					reasons.length === 0
						? base
						: {
								...base,
								verdict: fail ? 'fail' : 'borderline',
								rule: `${base.rule}; ${reasons.join('; ')}${fail ? '' : '; one more independent run is requested before the row is adjudicated'}`
							}
			});
		}
	}
	// The contract's per-edit Layout evaluation row is hard at M (≤ 8 ms). Its
	// representation half lands on the accepted commit and is measured in F4; the
	// per-move half is the compile span this sample's pointer moves ran.
	if (tier === 'grid-M') {
		outcomes.push({
			name: 'EVAL',
			runs: runs.length,
			decision: decideMilestoneRow({
				row: `EVAL-${tier}-${cacheState}`,
				budgetMs: 8,
				perRunP95Ms: runs.map(perEditCompileMs),
				pooledP95Ms: summarize(runs.map(perEditCompileMs)).p95,
				maxRuns: MILESTONE_MAX_RUNS.f3,
				completedRuns: runs.length
			})
		});
	}
	return outcomes;
}

function addWork(into: WorkSnapshot, window: WorkSnapshot): void {
	for (const [name, span] of Object.entries(window.spans)) {
		const target = (into.spans[name] ??= { count: 0, totalMs: 0 });
		target.count += span.count;
		target.totalMs += span.totalMs;
	}
	for (const [name, value] of Object.entries(window.counts)) into.counts[name] = (into.counts[name] ?? 0) + value;
}

async function undoOnce(page: import('@playwright/test').Page): Promise<void> {
	const before = await acceptedResultCount(page);
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await waitForAcceptedResult(page, before);
}

/** Leave Ink so a Wall selection offers its manipulation handles again. */
async function disarmInk(page: import('@playwright/test').Page): Promise<void> {
	const close = page.getByRole('button', { name: 'Close Ink' });
	if (await close.isVisible().catch(() => false)) await close.click();
}

/** Setup only: the shipped Opening palette, on the Wall selected through the Index. */
async function armOpeningPalette(page: import('@playwright/test').Page): Promise<void> {
	const closeCard = page.getByRole('button', { name: 'Close selection card' });
	if (await closeCard.isVisible().catch(() => false)) await closeCard.click();
	const dock = page.locator('[data-dock-tool="layout-ink"]');
	if ((await dock.getAttribute('aria-pressed')) !== 'true') await dock.click();
	await expect(page.locator('[data-layout-ink-palette]')).toBeVisible();
	const radio = page.locator('[data-ink-reading-opening]');
	if (!(await radio.isChecked())) await radio.check();
	await expect(page.locator('[data-layout-opening-palette]')).toBeVisible();
}

/** One typed Door placement; returns command→presented completion. */
async function measureOpeningCreate(page: import('@playwright/test').Page, offset: number): Promise<number | null> {
	await armOpeningPalette(page);
	await page.locator('[data-opening-kind]').selectOption('door');
	await page.locator('[data-opening-offset]').fill(String(offset));
	await page.locator('[data-opening-offset]').press('Tab');
	const refusal = page.locator('[data-opening-refusal]');
	const before = await acceptedResultCount(page);
	await page.locator('[data-opening-place]').click();
	await expect
		.poll(
			async () => {
				if ((await refusal.count()) > 0) return 'refused';
				return (await acceptedResultCount(page)) > before ? 'accepted' : 'pending';
			},
			{ timeout: 30_000, intervals: [100, 250, 500] }
		)
		.not.toBe('pending');
	if ((await refusal.count()) > 0) throw new Error(`Opening placement refused: ${(await refusal.innerText()).trim()}`);
	await waitForAcceptedResult(page, before);
	return commandPresentation(page, 'command:instrument');
}

/** The Wall selected through the Index, whose hosted Opening we place on. */
async function selectedWallId(page: import('@playwright/test').Page): Promise<string> {
	const current = page.locator('button.item-row[aria-current="true"]').first();
	const label = (await current.getAttribute('title')) ?? (await current.innerText());
	const match = /wall · (\S+)/.exec(label);
	if (match === null) throw new Error(`the selected Index row is not a Wall: ${label}`);
	return match[1]!;
}

/**
 * Select the Opening the placement just installed through the Index.
 *
 * The shipped adapter re-arms Ink after an accepted placement, and the Card is
 * not the active surface while Ink holds the task. A workload Opening's id ends
 * in its captured sequence (`grid3x…`); the newly placed one carries the
 * product's minted UUID, which is what identifies it on the host Wall.
 */
async function selectNewOpening(page: import('@playwright/test').Page, hostWallId: string): Promise<void> {
	const closeCard = page.getByRole('button', { name: 'Close selection card' });
	if (await closeCard.isVisible().catch(() => false)) await closeCard.click();
	await page.locator('#plate-index-search').fill(hostWallId);
	const rows = page.locator('button.item-row', {
		has: page.locator('.item-kind', { hasText: 'Opening' })
	});
	const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
	for (let index = 0; index < (await rows.count()); index += 1) {
		const row = rows.nth(index);
		const label = (await row.getAttribute('title')) ?? (await row.innerText());
		if (!uuid.test(label)) continue;
		await row.click();
		return;
	}
	throw new Error(`the placed Opening is not listed on ${hostWallId}`);
}

/** Remove the selected Opening through the Card's two-press disclosure. */
async function measureOpeningDelete(page: import('@playwright/test').Page): Promise<number | null> {
	const action = page.locator('[data-card-action="layout-opening-delete"]');
	await expect(action).toBeVisible();
	await action.click();
	await expect(action).toContainText('Confirm');
	const before = await acceptedResultCount(page);
	await action.click();
	await waitForAcceptedResult(page, before);
	return commandPresentation(page, 'command:instrument');
}

async function runDrag(
	session: MeasuredSession,
	tier: WorkloadId,
	options: { settleMs?: number; samples?: number; inputs?: number } = {}
): Promise<DragRun> {
	const { page } = session;
	const started = performance.now();
	const samples = options.samples ?? smokeOr(DRAG_SAMPLES);
	const inputs = options.inputs ?? DRAG_INPUTS;
	const projectId = uniqueProjectId(`f3-${tier}`);
	// Setup: the cached canonical JSON, admitted once; the session stays at peak.
	const project = tierProject(tier, projectId);
	// The museum family drags its focus Wall: the sweep latency rows hold E5's
	// fixed edits constant (C). Grids drag the Index's first Wall.
	const focusWallId = project.envelope.units.layout.data.walls.find((wall) => wall.name === E5_FOCUS_WALL_NAME)?.id;
	const openWall = () => (focusWallId === undefined ? selectFirstWall(page) : selectWallById(page, focusWallId));
	await gotoCreateIntent(page, projectId);
	await openSourceJson(page, project);
	await waitForStageSettled(page);
	await openWall();
	// Setup, outside every window: the retained heap at the loaded peak (D1).
	const heapAfterOpen = await readHeapAfterGc(session.cdp);
	const setupMs = performance.now() - started;
	const ownership: Ownership[] = [];
	const recordOwnership = async () => {
		const counts = await readOwnership(page);
		if (counts !== null) ownership.push(counts);
	};

	const frameWindows: { start: number; end: number }[] = [];
	const dragWork: WorkSnapshot = { spans: {}, counts: {} };
	const commitWork: WorkSnapshot = { spans: {}, counts: {} };
	const undoRedoWork: WorkSnapshot = { spans: {}, counts: {} };
	const commitCompletions: number[] = [];
	const precisionCompletions: number[] = [];
	let cacheServed = 0;
	let dragCompiled = 0;
	let dragRender: Record<string, RenderCounters> = {};
	for (let sample = 0; sample < samples; sample++) {
		// F3: a distinct drag per sample, reset by Undo.
		await openWall();
		await resetRenderMaxima(page);
		const renderBefore = await readRenderCounters(page);
		const workBefore = await readWork(page);
		const beforeDrag = await acceptedResultCount(page);
		const frameStarted = await page.evaluate(() => performance.now());
		await dragWallHandle(page, {
			samples: inputs,
			distance: DRAG_DISTANCE + sample * 0.5,
			settleMs: options.settleMs ?? 0
		});
		const frameEnded = await page.evaluate(() => performance.now());
		frameWindows.push({ start: frameStarted, end: frameEnded });
		await waitForAcceptedResult(page, beforeDrag);
		const dragWindow = workDelta(workBefore, await readWork(page));
		const sampleRender = renderCounterDelta(renderBefore, await readRenderCounters(page));
		await recordOwnership();
		const commit = await commandPresentation(page, 'command:commit');
		const served = (dragWindow.counts.compile ?? 0) === 0;
		if (served) cacheServed += 1;
		else {
			// Render counts follow the timing windows: the last measured sample, never a cache-served one.
			dragCompiled += 1;
			dragRender = sampleRender;
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
		await recordOwnership();
		const precision = await commandPresentation(page, 'command:instrument');
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
	const undoCycles = smokeOr(UNDO_REDO_CYCLES);
	await undoRedoCycles(page, undoCycles);
	expect(await acceptedResultCount(page)).toBeGreaterThanOrEqual(beforeUndoRedo + undoCycles * 2 - 2);
	addWork(undoRedoWork, workDelta(undoBefore, await readWork(page)));

	// S04 supplemental Opening rows: two create/delete pairs and one Undo/Redo
	// series over an accepted Opening create, all at the loaded peak. Setup and
	// the Card's first confirm press stay outside the measured intervals.
	const openingCreate: number[] = [];
	const openingDelete: number[] = [];
	const openingUndo: number[] = [];
	const openingRedo: number[] = [];
	if (OPENING_ROWS) {
		await disarmInk(page);
		await openWall();
		const openingHostId = await selectedWallId(page);
		for (const offset of OPENING_OFFSETS) {
			await disarmInk(page);
			await openWall();
			const create = await measureOpeningCreate(page, offset);
			if (create !== null) openingCreate.push(create);
			await selectNewOpening(page, openingHostId);
			const deletion = await measureOpeningDelete(page);
			if (deletion !== null) openingDelete.push(deletion);
		}
		await disarmInk(page);
		await openWall();
		const openingEditBefore = await acceptedResultCount(page);
		const openingBeforeF8 = await measureOpeningCreate(page, 1);
		if (openingBeforeF8 !== null) openingCreate.push(openingBeforeF8);
		await waitForAcceptedResult(page, openingEditBefore);
		const openingF8Start = await page.evaluate(() => performance.now());
		await undoRedoCycles(page, undoCycles);
		const openingLedger = await readLedger(page);
		for (const [index, record] of openingLedger.records.entries()) {
			if (record.time < openingF8Start) continue;
			if (record.kind !== 'mark' || (record.name !== 'command:undo' && record.name !== 'command:redo')) continue;
			const next = openingLedger.records
				.slice(index + 1)
				.find((candidate) => candidate.kind === 'result' && candidate.name === 'accepted-result');
			if (next === undefined) continue;
			const presentedAt = firstFrameAtOrAfter(openingLedger.ticks, next.time);
			if (presentedAt === null) continue;
			(record.name === 'command:undo' ? openingUndo : openingRedo).push(presentedAt - record.time);
		}
		// Restore the pre-measurement source so the retained-heap sample keeps its
		// S06 meaning.
		await undoOnce(page);
		await disarmInk(page);
	}
	const heapAfterSequence = await readHeapAfterGc(session.cdp);

	const ledger = await readLedger(page);
	const frameIntervals: number[] = [];
	let longTasks = 0;
	let longestTask = 0;
	for (const window of frameWindows) {
		const ticks = ledger.ticks.filter((tick) => tick >= window.start && tick <= window.end);
		for (let index = 1; index < ticks.length; index++) frameIntervals.push(ticks[index]! - ticks[index - 1]!);
		for (const task of ledger.longTasks) {
			if (task.start < window.start || task.start > window.end) continue;
			longTasks += 1;
			longestTask = Math.max(longestTask, task.duration);
		}
	}
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
		frameIntervals,
		longTasks,
		longestTask,
		commitCompletion: commitCompletions[0] ?? null,
		precisionCompletion: precisionCompletions[0] ?? null,
		undoCompletion: undoCompletions,
		redoCompletion: redoCompletions,
		commitCompletions,
		precisionCompletions,
		openingCreateCompletions: openingCreate,
		openingDeleteCompletions: openingDelete,
		openingUndoCompletion: openingUndo,
		openingRedoCompletion: openingRedo,
		dragCompiled,
		cacheServed,
		setupMs,
		wallMs: performance.now() - started,
		dragWork,
		commitWork,
		undoRedoWork,
		dragRender,
		heapAfterOpen,
		heapAfterSequence,
		ownership
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
				report.rows.push(unrunRow(`F3-${tier}-unrun`, 'F3/F4/F8 on the shipped straight-Wall drag', tierWorkloadLabel(tier), testInfo.project.name, availability.reason));
				fileReport(report);
				return;
			}
			const limitations = [...passLimitations(), ...tierLimitations(tier)];
			const flowName = 'F3/F4/F8 on the shipped straight-Wall drag';
			// Only the hard tiers carry contract rows; report-only tiers never stop.
			const hardBudgets = HARD_BUDGETS_MS[tier];
			const runStates = dragCacheStates(tier);
			let crashed = false;
			for (const cacheState of cacheStatesFor('f3')) {
				if (crashed || !runStates.includes(cacheState)) {
					const reason = crashed
						? 'not attempted: the renderer crashed earlier at this tier (owner D4 bound)'
						: `not run in this pass: the owner's D5 ruling runs grid-XL F3/F4/F8 ${runStates.join(', ')} only`;
					report.rows.push(unrunRow(`F3-${tier}-${cacheState}`, flowName, tierWorkloadLabel(tier), testInfo.project.name, reason));
					continue;
				}
				let collected: Awaited<ReturnType<typeof collectMeasuredRuns<DragRun>>>;
				try {
					collected = await collectMeasuredRuns(
						browser,
						{ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK },
						{
							cacheState,
							warmup: smokeOr(WARMUP_RUNS, 0),
							runs: smokeOr(runsFor('f3', cacheState)),
							afterRun: cacheState === 'repeat-use' ? closeToHub : undefined,
							earlyStop:
								earlyStopEnabled() && hardBudgets !== undefined
									? (completed: readonly DragRun[]) => {
											// One value per measured run: the rule needs three runs, never
											// several samples of one run. F4 uses the run's fastest commit or
											// precision completion and F8 its fastest command, so a decision
											// still means every observation is beyond the margin; F3 uses
											// the run's p95 (every run's p95 above the margin implies the
											// pooled p95 is too).
											const runMinimum = (values: readonly number[]): number =>
												values.length === 0 ? Number.NaN : Math.min(...values);
											const commit = completed.map((run) => runMinimum([...run.commitCompletions, ...run.precisionCompletions]));
											const undo = completed.map((run) => runMinimum(run.undoCompletion));
											const latencies = completed.map((run) => summarize(run.latencies).p95);
											return (
												decisiveHardFailure(`F4-${tier}-${cacheState}`, commit, hardBudgets.F4) ??
												decisiveHardFailure(`F8-${tier}-${cacheState}`, undo, hardBudgets.F8) ??
												decisiveHardFailure(`F3-${tier}-${cacheState}`, latencies, hardBudgets.F3)
											);
										}
									: undefined,
							// The milestone method spends one more independent run only while
							// at least one of F3/F4/F8 is undecided. A decided row never costs
							// another run, and the series stops when all three are decided.
							...(MILESTONE && !SMOKE
								? {
										extendRuns:
											cacheState === 'warm' && hardBudgets !== undefined
												? (completed: readonly DragRun[]) => {
														const outcomes = dragMilestoneOutcomes(completed, tier, cacheState);
														const open =
															outcomes === null ||
															outcomes.some((outcome) => outcome.decision === null || outcome.decision.verdict === 'borderline');
														return open && completed.length < MILESTONE_MAX_RUNS.f3 ? completed.length + 1 : null;
													}
												: undefined,
										maxRuns: MILESTONE_MAX_RUNS.f3
									}
								: {})
						},
						(session) => runDrag(session, tier)
					);
				} catch (error) {
					if (!crashBounded(tier) || !isRendererCrash(error)) throw error;
					report.rows.push(crashRow(`F3-${tier}-${cacheState}`, flowName, tierWorkloadLabel(tier), testInfo.project.name, cacheState, error));
					crashed = true;
					continue;
				}
				const { results: runs, facts, earlyStop } = collected;
				const milestone = dragMilestoneOutcomes(runs, tier, cacheState);
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
				const last = runs[runs.length - 1];
				const row: ResultRow = {
					id: `F3-${tier}-${cacheState}`,
					flow: flowName,
					workload: `${tierWorkloadLabel(tier)}; ${smokeOr(DRAG_SAMPLES)} samples × ${DRAG_INPUTS} pointer inputs per run (handler-mark input clock), distinct exact lengths, ${smokeOr(UNDO_REDO_CYCLES)} Undo/Redo cycles`,
					cacheState,
					network: NETWORK,
					browser: `${testInfo.project.name} ${facts.chromeVersion}`,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: {
						measuredRuns: runs.length,
						dispatched: runs.reduce((total, run) => total + run.dispatched, 0),
						rows: runs.reduce((total, run) => total + run.rows, 0),
						presented: runs.reduce((total, run) => total + run.presented, 0),
						superseded: runs.reduce((total, run) => total + run.superseded, 0),
						unresolved: runs.reduce((total, run) => total + run.unresolved, 0),
						refused: runs.reduce((total, run) => total + run.refused, 0),
						cacheServedSamples: runs.reduce((total, run) => total + run.cacheServed, 0),
						latestInputAgeMedian: summarize(ages).median,
						latestInputAgeP95: summarize(ages).p95,
						frameLongTasks: runs.reduce((total, run) => total + run.longTasks, 0),
						frameLongestTask: Math.max(0, ...runs.map((run) => run.longestTask)),
						frameIntervals: summarize(runs.flatMap((run) => run.frameIntervals)).p95,
						// One number per independent run so a shrunk completion sample is visible.
						completionsPerRun: `F4=${runs.map((run) => run.commitCompletions.length + run.precisionCompletions.length).join('/')}; F8=${runs.map((run) => run.undoCompletion.length + run.redoCompletion.length).join('/')}`,
						perEditCompileMs: tier === 'grid-M' ? summarize(runs.map(perEditCompileMs)).p95 : null,
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
							const frames = last?.dragRender.stage?.frames ?? 0;
							const lastSamples = Math.max(1, last?.dragCompiled ?? 1);
							return last === undefined || frames === 0 ? null : (last.dragWork.counts.compile ?? 0) / lastSamples / frames;
						})(),
						...heapMetrics('open', last?.heapAfterOpen),
						...heapMetrics('sequence', last?.heapAfterSequence),
						...ownershipMetrics('commit', last?.ownership ?? []),
						...(earlyStop === null
							? {}
							: {
									earlyStop: 'demonstrated failure (not a pass)',
									earlyStopSamples: earlyStop.samples,
									earlyStopMinimumMs: earlyStop.statisticMs
								}),
						...(milestone === null
							? MILESTONE && !SMOKE && cacheState === 'warm' && hardBudgets !== undefined
								? { 'milestone:verdict': 'undecided (fewer than 3 usable independent runs)' }
								: {}
							: milestoneOutcomesMetrics(milestone))
					},
					stats: {
						heapAfterOpenMiB: summarize(runs.map((run) => run.heapAfterOpen.heapMiB)),
						heapAfterSequenceMiB: summarize(runs.map((run) => run.heapAfterSequence.heapMiB)),
						inputToMatchingPreview: summarize(latencies),
						latestInputAge: summarize(ages),
						dragFrameInterval: summarize(runs.flatMap((run) => run.frameIntervals)),
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
						'drag:*/precision:* stage rows are per measured sample; undoRedo:* per command',
						'open:postGc/sequence:postGc: JS heap after a forced GC and DOM counters, outside the timed windows (D1); commit:ownership: Stage live objects after each accepted commit, last run',
						...(earlyStop === null ? [] : [earlyStop.rule]),
						...(milestone === null
							? MILESTONE && !SMOKE && cacheState === 'warm' && hardBudgets !== undefined
								? ['milestone: undecided — the row did not produce three usable independent runs, so it is not a pass']
								: []
							: milestoneOutcomeRules(milestone))
					]
				};
				report.rows.push(row);
				console.log(formatRow(row));

				// S04 supplemental rows: the Opening family S03 deferred, measured with
				// the same three-run decision rule and 100 ms F4/F8 hard budgets. They
				// are extra report rows, never part of S06's promised 15 decision rows.
				if (
					OPENING_ROWS &&
					cacheState === 'warm' &&
					hardBudgets !== undefined &&
					(tier === 'grid-S' || tier === 'grid-M')
				) {
					const openingCreate = runs.flatMap((run) => run.openingCreateCompletions);
					const openingDelete = runs.flatMap((run) => run.openingDeleteCompletions);
					const openingUndo = runs.flatMap((run) => run.openingUndoCompletion);
					const openingRedo = runs.flatMap((run) => run.openingRedoCompletion);
					const createDecision = MILESTONE
						? decideMilestoneRow({
								row: `F4-opening-${tier}-${cacheState}`,
								budgetMs: hardBudgets.F4,
								perRunP95Ms: runs.map((run) => summarize(run.openingCreateCompletions).p95),
								pooledP95Ms: summarize(openingCreate).p95,
								maxRuns: MILESTONE_MAX_RUNS.f3,
								completedRuns: runs.length
							})
						: null;
					const deleteDecision = MILESTONE
						? decideMilestoneRow({
								row: `F8-opening-delete-${tier}-${cacheState}`,
								budgetMs: hardBudgets.F8,
								perRunP95Ms: runs.map((run) => summarize(run.openingDeleteCompletions).p95),
								pooledP95Ms: summarize(openingDelete).p95,
								maxRuns: MILESTONE_MAX_RUNS.f3,
								completedRuns: runs.length
							})
						: null;
					const formalCreate = summarize(openingCreate).p95;
					const formalDelete = summarize(openingDelete).p95;
					const formalUndo = summarize(openingUndo).p95;
					const formalRedo = summarize(openingRedo).p95;
					const formalRule = (p95: number, budget: number, samples: number) =>
						`formal acceptance: pooled p95 ${p95.toFixed(1)} ms against the ${budget} ms hard budget over ${samples} completions`;
					report.rows.push({
						id: `F4-opening-${tier}-${cacheState}`,
						flow: 'F4 Opening create on the shipped palette (S04 supplemental)',
						workload: `${tierWorkloadLabel(tier)}; two typed Door placements per run at ${OPENING_OFFSETS.join(' and ')} m, then one Undo/Redo series over an accepted create`,
						cacheState,
						network: NETWORK,
						browser: `${testInfo.project.name} ${facts.chromeVersion}`,
						cpuRate: 1,
						viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
						metrics: {
							measuredRuns: runs.length,
							perRunCreateP95: runs.map((run) => summarize(run.openingCreateCompletions).p95).join('/'),
							perRunDeleteP95: runs.map((run) => summarize(run.openingDeleteCompletions).p95).join('/'),
							createVerdict: createDecision?.verdict ?? (openingCreate.length > 0 ? (formalCreate <= hardBudgets.F4 ? 'pass' : 'fail') : 'undecided'),
							deleteVerdict: deleteDecision?.verdict ?? (openingDelete.length > 0 ? (formalDelete <= hardBudgets.F8 ? 'pass' : 'fail') : 'undecided'),
							createRule: createDecision?.rule ?? (openingCreate.length > 0 ? formalRule(formalCreate, hardBudgets.F4, openingCreate.length) : 'no usable create samples'),
							deleteRule: deleteDecision?.rule ?? (openingDelete.length > 0 ? formalRule(formalDelete, hardBudgets.F8, openingDelete.length) : 'no usable delete samples')
						},
						stats: {
							openingCreate: summarize(openingCreate),
							openingDelete: summarize(openingDelete),
							openingUndo: summarize(openingUndo),
							openingRedo: summarize(openingRedo)
						},
						limitations: [
							...limitations,
							'S04 supplemental row, not one of S06\'s 15 promised decision rows',
							'two create/delete samples per independent run; each run\'s p95 is therefore close to its maximum',
							'the typed Opening offset is the start edge; the Card\'s first confirm press is outside the delete interval',
							'presentation is the rendering-opportunity frame, not a traced image'
						]
					});
					report.rows.push({
						id: `F8-opening-${tier}-${cacheState}`,
						flow: 'F8 Opening Undo/Redo on the shipped palette (S04 supplemental)',
						workload: `${tierWorkloadLabel(tier)}; ${smokeOr(UNDO_REDO_CYCLES)} alternating Undo/Redo after one accepted Opening create`,
						cacheState,
						network: NETWORK,
						browser: `${testInfo.project.name} ${facts.chromeVersion}`,
						cpuRate: 1,
						viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
						metrics: {
							measuredRuns: runs.length,
							perRunUndoP95: runs.map((run) => summarize(run.openingUndoCompletion).p95).join('/'),
							perRunRedoP95: runs.map((run) => summarize(run.openingRedoCompletion).p95).join('/')
						},
						stats: {
							openingUndo: summarize(openingUndo),
							openingRedo: summarize(openingRedo)
						},
						limitations: [
							...limitations,
							'S04 supplemental row, not one of S06\'s 15 promised decision rows',
							'each Undo/Redo command is a separate measured completion',
							'presentation is the rendering-opportunity frame, not a traced image'
						]
					});
				}
				expect(runs.every((run) => run.rows === run.dispatched)).toBe(true);
			}
			const path = fileReport(report);
			console.log(`raw results: ${path}`);
			expect(report.rows).toHaveLength(OPENING_ROWS && (tier === 'grid-S' || tier === 'grid-M') ? 5 : 3);
		});
	}

	test('a deliberately delayed preview shows latency, not a dropped sample', async ({ browser }, testInfo) => {
		// One proof per pass, in the grid-S tier; it is a correctness proof, not a tier row.
		// The diagnostic profile does not rerun it: Bench 1 proved the unchanged
		// correlation path, and the pre-pass is deliberately short.
		test.skip(LEAN, 'lean profiles: the delayed-preview proof is Bench 1 evidence and does not rerun');
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
