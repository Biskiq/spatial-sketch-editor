/**
 * F7 — orbit/navigation (T3.P03.S02 harness).
 *
 * A scripted 10 s orbit + dolly on the M fixture, measured cold, warm and
 * repeat-use with the harness's rAF frame clock: frame intervals p50/p95/p99,
 * long tasks and dropped frames. Cold creates a fresh context per run; warm and
 * repeat-use reuse one context, with repeat-use closing to the hub between
 * cycles.
 *
 * The script paces movement to a wall-clock deadline, so the orbit itself takes
 * 10 s rather than the shorter time a fixed per-step delay produced. If the
 * display paces below 60 Hz (battery/thermal state), the same orbit continues
 * past 10 s until each run has the contract's 600 frames; the row records the
 * actual duration and frames per run instead of claiming a duration it did not
 * achieve.
 *
 * T1.P02.S06 tiers the flow and attaches the render counters: draw calls,
 * triangles, shadow-map passes and shadow draws per frame, programs, geometries
 * and textures, planner/compile work per frame during the orbit, and frames
 * rendered at rest in a 2 s idle window after it. F7's frame-time budget is a
 * hard row on the reference machine, never a claim from a pre-flight or smoke
 * pass.
 *
 * The owner's D1 ruling (2026-10-24) adds, inside each run and after the
 * required window (no extra open):
 *
 * - the orbit starts from the shipped Fit, not the default view, which for the
 *   museum family showed nothing until Fit;
 * - two **all-visible windows**, 3D after Fit and the Plan reading after Fit:
 *   a 1 s rest, a one-frame compatible-bin census ("count, not timing": a
 *   logical model of the physical frame) and a 3 s scripted pan and zoom, each
 *   with the render counters, resident bytes and frame intervals;
 * - CPU time inside each `render()` call in every window, and GPU time where
 *   `EXT_disjoint_timer_query_webgl2` is exposed (otherwise the reason).
 */

import { expect, test } from '@playwright/test';

import { collectMeasuredRuns, type MeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, MILESTONE, NETWORK, VIEWPORT, WARMUP_RUNS, cacheStatesFor, passLimitations, runsFor } from '../lib/config';
import { closeToHub, fitStage, frameWindow, gotoCreateIntent, openSourceJson, scriptedPanZoom, setStageReading, uniqueProjectId, waitForStageSettled } from '../lib/flow';
import {
	decideMilestoneRow,
	FRAME_BUDGETS_MS,
	FRAME_INTERVAL_TOLERANCE_MS,
	MILESTONE_MAX_RUNS,
	milestoneMetrics,
	type MilestoneRowDecision
} from '../lib/milestone';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';
import {
	binCensusMetrics,
	crashBounded,
	crashRow,
	isRendererCrash,
	readBinCensus,
	readRenderCounters,
	readRenderTime,
	readResidentBytes,
	renderTimeMetrics,
	readWork,
	renderCounterDelta,
	renderMetrics,
	residentMetrics,
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
	type BinCensus,
	type RenderCounters,
	type RenderTime,
	type ResidentBytes,
	type WorkSnapshot,
	unrunRow
} from '../lib/tiers';
import type { WorkloadId } from '../lib/workloads/registry';

/** A smoke orbit proves the flow executes; it never reaches the contract's floor. */
const ORBIT_MS = SMOKE ? 2_000 : 10_000;
const FRAME_FLOOR = SMOKE ? 0 : 600;
const IDLE_MS = 2_000;
const MAX_ORBIT_MS = 60_000;
const STEPS_PER_ORBIT = 60;
const STEP_MS = ORBIT_MS / STEPS_PER_ORBIT;
/** The all-visible windows (D1): a rest after Fit, then a scripted pan and zoom. */
const VIEW_REST_MS = 1_000;
const VIEW_MOVE_MS = 3_000;

type ViewWindow = {
	readonly rest: Record<string, RenderCounters>;
	readonly restTime: RenderTime | null;
	readonly move: Record<string, RenderCounters>;
	readonly moveTime: RenderTime | null;
	readonly intervals: number[];
	readonly bins: BinCensus | null;
	readonly resident: ResidentBytes | null;
	readonly work: WorkSnapshot;
};

type OrbitRun = {
	readonly intervals: number[];
	readonly longTasks: number;
	readonly longestTask: number;
	readonly durationMs: number;
	readonly frames: number;
	readonly setupMs: number;
	readonly render: Record<string, RenderCounters>;
	readonly idleRender: Record<string, RenderCounters>;
	readonly work: WorkSnapshot;
	readonly resident: ResidentBytes | null;
	readonly orbitTime: RenderTime | null;
	readonly views: { readonly all3d: ViewWindow; readonly plan: ViewWindow };
};

type TickWindow = Window & { __BISKIQ_PERF_TICKS__?: number[] };

/**
 * F7 is a milestone decision row only at the hard frame tiers (S/M), warm, and
 * only the contract's frame-interval p95 **and p99** plus the zero-long-task
 * clause. L is a Target row: recorded, never adjudicated as a milestone gate.
 */
function orbitMilestoneDecision(
	runs: readonly OrbitRun[],
	tier: WorkloadId,
	cacheState: string
): MilestoneRowDecision | null {
	const budget = FRAME_BUDGETS_MS[tier];
	if (!MILESTONE || SMOKE || cacheState !== 'warm' || budget === undefined || !(tier === 'grid-S' || tier === 'grid-M')) return null;
	const decision = decideMilestoneRow({
		row: `F7-${tier}-${cacheState}`,
		budgetMs: budget.p95,
		perRunP95Ms: runs.map((run) => summarize(run.intervals).p95),
		pooledP95Ms: summarize(runs.flatMap((run) => run.intervals)).p95,
		maxRuns: MILESTONE_MAX_RUNS.f7,
		completedRuns: runs.length,
		// 16.7 ms is one 60 Hz refresh interval: the budget is the display floor,
		// not a work bound that could hold 25 % headroom.
		headroom: 1
	});
	if (decision === null) return null;
	const atBound = runs.length >= MILESTONE_MAX_RUNS.f7;
	const longest = Math.max(...runs.map((run) => run.longestTask));
	const longTaskBreach = longest > budget.longTask;
	// The contract's F7 row is hard on p95 **and** p99. A p99 breach can be a
	// genuine tail or a small-sample artefact, so while the row is below its
	// bound it stays open; at the bound it is a failure, never a pass.
	const p99 = summarize(runs.flatMap((run) => run.intervals)).p99;
	const p99Breach = Number.isFinite(p99) && p99 > budget.p99 + FRAME_INTERVAL_TOLERANCE_MS;
	const reasons = [
		...(longTaskBreach ? [`a ${longest.toFixed(1)} ms long task breaches the 0 > ${budget.longTask} ms hard clause`] : []),
		...(p99Breach ? [`p99 ${p99.toFixed(1)} ms exceeds the ${budget.p99} ms hard budget`] : [])
	];
	if (reasons.length === 0) return decision;
	const fail = decision.verdict === 'fail' || atBound;
	return {
		...decision,
		verdict: fail ? 'fail' : 'borderline',
		rule:
			`${decision.rule}; ${reasons.join('; ')}` +
			(fail ? '' : '; one more independent run is requested before the row is adjudicated')
	};
}

/** One all-visible window at the settled current framing: rest, census, pan and zoom. */
async function viewWindow(page: import('@playwright/test').Page): Promise<ViewWindow> {
	await resetRenderMaxima(page);
	const restBefore = await readRenderCounters(page);
	await page.waitForTimeout(VIEW_REST_MS);
	const rest = renderCounterDelta(restBefore, await readRenderCounters(page));
	const restTime = await readRenderTime(page);
	const bins = await readBinCensus(page);
	const resident = await readResidentBytes(page);
	await resetRenderMaxima(page);
	const moveBefore = await readRenderCounters(page);
	const workBefore = await readWork(page);
	const started = await page.evaluate(() => performance.now());
	await scriptedPanZoom(page, VIEW_MOVE_MS);
	const ended = await page.evaluate(() => performance.now());
	const move = renderCounterDelta(moveBefore, await readRenderCounters(page));
	const moveTime = await readRenderTime(page);
	const work = workDelta(workBefore, await readWork(page));
	const intervals = (await frameWindow(page, started, ended)).intervals;
	return { rest, restTime, move, moveTime, intervals, bins, resident, work };
}

async function orbitOnce(session: MeasuredSession, tier: WorkloadId): Promise<OrbitRun> {
	const { page } = session;
	const setupStarted = performance.now();
	const projectId = uniqueProjectId(`f7-${tier}`);
	await gotoCreateIntent(page, projectId);
	await openSourceJson(page, tierProject(tier, projectId));
	await expect(page.locator('canvas').first()).toBeVisible();
	await waitForStageSettled(page);
	// F7 starts in 3D from the shipped Fit (D1, F6a): every footprint in frame.
	// A reused context may restore the previous run's Plan reading.
	await setStageReading(page, '3D');
	await fitStage(page);
	const setupMs = performance.now() - setupStarted;
	await resetRenderMaxima(page);
	const renderBefore = await readRenderCounters(page);
	const workBefore = await readWork(page);
	const stage = page.locator('.stage').first();
	const box = await stage.boundingBox();
	if (box === null) throw new Error('the Stage has no box');
	const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	await page.keyboard.down('Shift');
	await page.mouse.move(center.x, center.y);
	await page.mouse.down();
	const started = await page.evaluate(() => performance.now());
	const startTicks = await page.evaluate(
		() => (window as TickWindow).__BISKIQ_PERF_TICKS__?.length ?? 0
	);
	// Sixty moves per revolution, paced against an absolute wall-clock deadline:
	// the measured orbit genuinely lasts ORBIT_MS, and the frame count (not the
	// movement script) decides whether the contract's floor is met.
	const wallStart = Date.now();
	let step = 0;
	let frames = 0;
	while (true) {
		const elapsed = Date.now() - wallStart;
		// Two extra ticks cover the interval lost at each end of the window.
		if (elapsed >= ORBIT_MS && frames >= FRAME_FLOOR + 2) break;
		if (elapsed >= MAX_ORBIT_MS) break;
		const target = wallStart + step * STEP_MS;
		const wait = target - Date.now();
		if (wait > 0) await page.waitForTimeout(wait);
		const angle = (step / STEPS_PER_ORBIT) * Math.PI * 2;
		await page.mouse.move(center.x + Math.cos(angle) * 140, center.y + Math.sin(angle) * 70);
		if (step % 15 === 0) await page.mouse.wheel(0, step % 30 === 0 ? 40 : -30);
		step += 1;
		frames =
			(await page.evaluate(() => (window as TickWindow).__BISKIQ_PERF_TICKS__?.length ?? 0)) -
			startTicks;
	}
	const ended = await page.evaluate(() => performance.now());
	const render = renderCounterDelta(renderBefore, await readRenderCounters(page));
	const orbitTime = await readRenderTime(page);
	const work = workDelta(workBefore, await readWork(page));
	await page.mouse.up();
	await page.keyboard.up('Shift');
	// Idle: no input for IDLE_MS. The counters' "at rest" frames need a second
	// without input, so the window starts after it.
	await page.waitForTimeout(1_100);
	const idleBefore = await readRenderCounters(page);
	await page.waitForTimeout(IDLE_MS);
	const idleRender = renderCounterDelta(idleBefore, await readRenderCounters(page));
	const resident = await readResidentBytes(page);
	// One in-page reduction: the orbit needs intervals and long tasks, not the
	// frame clock and input records that a full ledger read would serialize.
	const frameData = await frameWindow(page, started, ended);
	const intervals = frameData.intervals;
	// The all-visible windows (D1), after the required orbit and idle windows.
	await fitStage(page);
	const all3d = await viewWindow(page);
	await setStageReading(page, 'Plan');
	await fitStage(page);
	const plan = await viewWindow(page);
	return {
		intervals,
		longTasks: frameData.longTaskCount,
		longestTask: frameData.longestLongTask,
		durationMs: ended - started,
		frames: intervals.length,
		setupMs,
		render,
		idleRender,
		work,
		resident,
		orbitTime,
		views: { all3d, plan }
	};
}

/** One all-visible window's row metrics (from the last run, like the orbit's counters). */
function viewMetrics(name: string, window: ViewWindow): Record<string, number | string | null> {
	const perFrame = (counters: RenderCounters | undefined, field: 'drawCalls' | 'triangles') =>
		counters === undefined || counters.frames === 0 ? null : counters[field] / counters.frames;
	return {
		[`${name}:rest:frames`]: window.rest.stage?.frames ?? 0,
		[`${name}:rest:drawCallsPerFrame`]: perFrame(window.rest.stage, 'drawCalls'),
		[`${name}:rest:trianglesPerFrame`]: perFrame(window.rest.stage, 'triangles'),
		...renderTimeMetrics(`${name}:rest`, window.rest.stage, window.restTime),
		[`${name}:move:frames`]: window.move.stage?.frames ?? 0,
		[`${name}:move:drawCallsPerFrame`]: perFrame(window.move.stage, 'drawCalls'),
		[`${name}:move:trianglesPerFrame`]: perFrame(window.move.stage, 'triangles'),
		[`${name}:move:maxDrawCallsPerFrame`]: window.move.stage?.maxDrawCallsPerFrame ?? 0,
		[`${name}:move:compiles`]: window.work.counts.compile ?? 0,
		...renderTimeMetrics(`${name}:move`, window.move.stage, window.moveTime),
		...binCensusMetrics(name, window.bins),
		...residentMetrics(window.resident, name)
	};
}

test.describe('F7 orbit', () => {
	test.setTimeout(3_000_000);
	for (const tier of selectedTiers()) {
		test(`scripted orbit and dolly at ${tier}, ${cacheStatesFor('f7').join(', ')}`, async ({ browser }, testInfo) => {
			const report = startReport(`f7-orbit-${tier}-${testInfo.project.name.replace(/\s+/g, '-')}`);
			const availability = tierAvailability(tier);
			if (!availability.available) {
				report.rows.push(unrunRow(`F7-${tier}-unrun`, 'F7 orbit/navigation', tierWorkloadLabel(tier), testInfo.project.name, availability.reason));
				fileReport(report);
				return;
			}
			const runCount = smokeOr(runsFor('f7'));
			const states = cacheStatesFor('f7');
			let crashed = false;
			for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
				if (!states.includes(cacheState)) {
					report.rows.push(unrunRow(`F7-orbit-${tier}-${cacheState}`, 'F7 orbit/navigation', tierWorkloadLabel(tier), testInfo.project.name, 'not run in this lean profile: F7 keeps one warm decision row; the frame row needs no cold/repeat-use distribution'));
					continue;
				}
				if (crashed) {
					report.rows.push(unrunRow(`F7-orbit-${tier}-${cacheState}`, 'F7 orbit/navigation', tierWorkloadLabel(tier), testInfo.project.name, 'not attempted: the renderer crashed earlier at this tier (owner D4 bound)'));
					continue;
				}
				let collected: Awaited<ReturnType<typeof collectMeasuredRuns<OrbitRun>>>;
				try {
					collected = await collectMeasuredRuns(
						browser,
						{ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK },
						{
							cacheState,
							warmup: smokeOr(WARMUP_RUNS, 0),
							runs: runCount,
							afterRun: cacheState === 'repeat-use' ? closeToHub : undefined,
							...(MILESTONE && !SMOKE
								? {
										extendRuns:
											cacheState === 'warm' && (tier === 'grid-S' || tier === 'grid-M')
												? (completed: readonly OrbitRun[]) => {
														const decision = orbitMilestoneDecision(completed, tier, cacheState);
														const open = decision === null || decision.verdict === 'borderline';
														return open && completed.length < MILESTONE_MAX_RUNS.f7 ? completed.length + 1 : null;
													}
												: undefined,
									maxRuns: MILESTONE_MAX_RUNS.f7
								}
								: {})
						},
						(session) => orbitOnce(session, tier)
					);
				} catch (error) {
					if (!crashBounded(tier) || !isRendererCrash(error)) throw error;
					report.rows.push(crashRow(`F7-orbit-${tier}-${cacheState}`, 'F7 orbit/navigation', tierWorkloadLabel(tier), testInfo.project.name, cacheState, error));
					crashed = true;
					continue;
				}
				const { results: runs, facts } = collected;
				const milestone = orbitMilestoneDecision(runs, tier, cacheState);
				const intervals = runs.flatMap((run) => run.intervals);
				const dropped = runs.reduce(
					(sum, run) => sum + run.intervals.filter((interval) => interval > 33.4).length,
					0
				);
				const last = runs[runs.length - 1]!;
				const frameCount = Math.max(1, last.render.stage?.frames ?? 0);
				const perFrame = Object.fromEntries(
					Object.entries(last.render.stage ?? {})
						.filter(([name]) => ['drawCalls', 'triangles', 'shadowMapRenders', 'shadowDrawCalls'].includes(name))
						.map(([name, value]) => [`render:stage:${name}PerFrame`, value / frameCount])
				);
				const orbitWork = workMetrics(last.work);
				const row: ResultRow = {
					id: `F7-orbit-${tier}-${cacheState}`,
					flow: 'F7 orbit/navigation',
					workload: `${tierWorkloadLabel(tier)}, ${ORBIT_MS / 1000} s scripted orbit + dolly, extended only to reach the ${FRAME_FLOOR}-frame floor`,
					cacheState,
					network: NETWORK,
					browser: `${testInfo.project.name} ${facts.chromeVersion}`,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: {
						measuredRuns: runs.length,
						frames: intervals.length,
						framesPerRunMin: Math.min(...runs.map((run) => run.frames)),
						durationMsMedian: summarize(runs.map((run) => run.durationMs)).median,
						durationMsMin: Math.min(...runs.map((run) => run.durationMs)),
						droppedFramesOver33ms: dropped,
						longTaskCount: runs.reduce((sum, run) => sum + run.longTasks, 0),
						longestTask: runs.reduce((max, run) => Math.max(max, run.longestTask), 0),
						setupMs: runs.reduce((sum, run) => sum + run.setupMs, 0),
						...renderMetrics(last.render),
						...perFrame,
						...Object.fromEntries(Object.entries(orbitWork).map(([name, value]) => [`orbit:${name}`, value])),
						'orbit:compilesPerFrame': (last.work.counts.compile ?? 0) / frameCount,
						'idle:render:stage:frames': last.idleRender.stage?.frames ?? 0,
						'idle:render:stage:framesAtRest': last.idleRender.stage?.framesAtRest ?? 0,
						idleWindowMs: IDLE_MS,
						...residentMetrics(last.resident, 'orbit'),
						...renderTimeMetrics('orbit', last.render.stage, last.orbitTime),
						...(milestone === null
							? MILESTONE && !SMOKE && cacheState === 'warm' && (tier === 'grid-S' || tier === 'grid-M')
								? { 'milestone:verdict': 'undecided (fewer than 3 usable runs)' }
								: {}
							: milestoneMetrics(milestone)),
						allVisibleRestMs: VIEW_REST_MS,
						allVisibleMoveMs: VIEW_MOVE_MS,
						...viewMetrics('all3d', last.views.all3d),
						...viewMetrics('plan', last.views.plan)
					},
					stats: {
						frameInterval: summarize(intervals),
						durationMs: summarize(runs.map((run) => run.durationMs)),
						framesPerRun: summarize(runs.map((run) => run.frames)),
						orbitRenderCpuMs: summarize(runs.flatMap((run) => run.orbitTime?.cpuSamples ?? [])),
						all3dMoveFrameInterval: summarize(runs.flatMap((run) => run.views.all3d.intervals)),
						all3dMoveRenderCpuMs: summarize(runs.flatMap((run) => run.views.all3d.moveTime?.cpuSamples ?? [])),
						all3dRestRenderCpuMs: summarize(runs.flatMap((run) => run.views.all3d.restTime?.cpuSamples ?? [])),
						planMoveFrameInterval: summarize(runs.flatMap((run) => run.views.plan.intervals)),
						planMoveRenderCpuMs: summarize(runs.flatMap((run) => run.views.plan.moveTime?.cpuSamples ?? [])),
						planRestRenderCpuMs: summarize(runs.flatMap((run) => run.views.plan.restTime?.cpuSamples ?? []))
					},
					limitations: [
						...passLimitations(),
						...tierLimitations(tier),
						'render counters are Three renderer.info per frame (count, not timing); renderCpu is main-thread time inside render() (CPU submission), not GPU time',
						'GPU time only where EXT_disjoint_timer_query_webgl2 resolved frames (gpuTimer says which); never inferred',
						'all-visible windows (D1): 3D and Plan after the shipped Fit, each a 1 s rest, a one-frame compatible-bin census (count, not timing: a logical model of the physical frame) and a 3 s scripted pan/zoom',
						'the orbit starts from the shipped Fit (D1); earlier F7 rows started from the default view',
						'frame intervals are rAF-to-rAF on a 60 Hz panel and do not substitute for presented-result latency',
						`runs extend past ${ORBIT_MS} ms only when the display cannot deliver ${FRAME_FLOOR} frames in that time`,
						...(milestone === null
							? MILESTONE && !SMOKE && cacheState === 'warm' && (tier === 'grid-S' || tier === 'grid-M')
								? ['milestone: undecided — the row did not produce three usable independent runs, so it is not a pass']
								: []
							: [milestone.rule])
					]
				};
				report.rows.push(row);
				console.log(formatRow(row));
				// The milestone may spend one run at a time, so the series can exceed
				// the plan minimum; it never exceeds its bound.
				expect(runs.length).toBeGreaterThanOrEqual(runCount);
				if (MILESTONE && !SMOKE) expect(runs.length).toBeLessThanOrEqual(MILESTONE_MAX_RUNS.f7);
				for (const run of runs) expect(run.frames).toBeGreaterThanOrEqual(FRAME_FLOOR);
			}
			const path = fileReport(report);
			console.log(`raw results: ${path}`);
			expect(report.rows).toHaveLength(3);
		});
	}
});
