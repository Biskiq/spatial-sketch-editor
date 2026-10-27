/**
 * Targeted attribution between Bench 2 (`e8cc2fc0`) and the frozen candidate
 * (`d89554b1`), NOT a bench pass and NOT another acceptance method.
 *
 * One session per tier drives the same three real interactions on both builds:
 * a Plan pan/zoom, a canvas pick of a known Wall, and one typed local commit.
 * The window records wall time, CDP main-thread/script time, net JS heap and DOM
 * node change, rAF intervals, and every relevant work-ledger count. The app
 * revision is supplied by `PERF_APP_REVISION`; this report's `commit` is the
 * harness commit, so the two must not be confused.
 */
import { expect, test } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';

import { newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, VIEWPORT } from '../lib/config';
import {
	acceptedResultCount,
	commandPresentation,
	commitPrecisionLength,
	fitStage,
	frameWindow,
	gotoCreateIntent,
	handlePoint,
	openSourceJson,
	selectWallAndOpenDimensions,
	setStageReading,
	uniqueProjectId,
	waitForAcceptedResult,
	waitForCameraSettled,
	waitForStageSettled
} from '../lib/flow';
import { commitSha, fileReport, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';
import { readWork, selectedTiers, tierProject, workDelta, type WorkSnapshot } from '../lib/tiers';

type Metrics = Record<string, number>;

/** CDP's cumulative main-thread counters; durations are seconds in the protocol. */
async function performanceMetrics(cdp: CDPSession): Promise<Metrics> {
	await cdp.send('Performance.enable');
	const { metrics } = await cdp.send('Performance.getMetrics');
	return Object.fromEntries(metrics.map((metric: { name: string; value: number }) => [metric.name, metric.value]));
}

function delta(after: Metrics, before: Metrics, name: string, scale = 1): number {
	return ((after[name] ?? 0) - (before[name] ?? 0)) * scale;
}

/** Counts a revision's Plan/pick/compile work; other ledger entries stay out of the row. */
function interestingWork(work: WorkSnapshot): Record<string, number> {
	const out: Record<string, number> = {};
	for (const [name, value] of Object.entries(work.counts)) {
		if (!/^(plan:|plan-pick:|compile|materialize:|storage:map-node|storage:vector-node)/.test(name)) continue;
		if (value !== 0) out[name] = value;
	}
	return out;
}

/** A continuous background drag: one pan intent per pointer move, the per-frame case. */
async function continuousPan(page: Page, durationMs: number): Promise<number> {
	const box = await page.locator('.stage').first().boundingBox();
	if (box === null) throw new Error('the Stage has no box');
	const start = { x: box.x + 24, y: box.y + box.height - 24 };
	const steps = Math.round(durationMs / 16);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	try {
		for (let step = 1; step <= steps; step += 1) {
			await page.mouse.move(start.x + step * 0.6, start.y - step * 0.35);
			await page.waitForTimeout(durationMs / steps);
		}
	} finally {
		await page.mouse.up();
	}
	return steps;
}

async function cameraPose(page: Page): Promise<string> {
	return page.evaluate(() => {
		type Camera = { matrixWorld: { elements: number[] }; projectionMatrix: { elements: number[] } };
		const camera = (window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { camera: Camera }> }).__BISKIQ_PERF_RENDER_REFS__?.stage?.camera;
		return camera === undefined ? '' : [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements].map((value) => value.toFixed(6)).join(',');
	});
}

async function closeSelectionCard(page: Page): Promise<void> {
	const close = page.getByRole('button', { name: 'Close selection card' });
	if (await close.isVisible().catch(() => false)) await close.click();
}

/** The click dispatch and its synchronous hit handler; the DOM settles outside the window. */
async function clickWall(page: Page, midpoint: { x: number; y: number }): Promise<void> {
	await page.mouse.click(midpoint.x, midpoint.y);
}

async function waitForWallSelection(page: Page, wallId: string): Promise<void> {
	await page.waitForFunction(
		(id) => {
			const row = document.querySelector('button.item-row[aria-current="true"]');
			return row?.textContent?.includes(id) === true;
		},
		wallId,
		{ timeout: 5_000 }
	);
}

type WindowResult = {
	wallMs: number;
	taskMs: number;
	scriptMs: number;
	layoutMs: number;
	styleMs: number;
	heapDeltaMiB: number;
	nodesDelta: number;
	frameP50: number;
	frameP95: number;
	longTasks: number;
	longestLongTask: number;
	work: Record<string, number>;
	error: string | null;
};

async function measure(
	page: Page,
	cdp: CDPSession,
	action: () => Promise<void>
): Promise<WindowResult> {
	const beforeMetrics = await performanceMetrics(cdp);
	const beforeWork = await readWork(page);
	const start = await page.evaluate(() => performance.now());
	let error: string | null = null;
	try {
		await action();
	} catch (failure) {
		// A miss is a recorded outcome, not a reason to lose the window.
		error = failure instanceof Error ? failure.message : String(failure);
	}
	const end = await page.evaluate(() => performance.now());
	const afterMetrics = await performanceMetrics(cdp);
	const afterWork = await readWork(page);
	const frames = await frameWindow(page, start, end);
	const intervals = summarize(frames.intervals);
	return {
		wallMs: end - start,
		taskMs: delta(afterMetrics, beforeMetrics, 'TaskDuration', 1000),
		scriptMs: delta(afterMetrics, beforeMetrics, 'ScriptDuration', 1000),
		layoutMs: delta(afterMetrics, beforeMetrics, 'LayoutDuration', 1000),
		styleMs: delta(afterMetrics, beforeMetrics, 'RecalcStyleDuration', 1000),
		heapDeltaMiB: delta(afterMetrics, beforeMetrics, 'JSHeapUsedSize') / (1024 * 1024),
		nodesDelta: delta(afterMetrics, beforeMetrics, 'Nodes'),
		frameP50: intervals.median,
		frameP95: intervals.p95,
		longTasks: frames.longTaskCount,
		longestLongTask: frames.longestLongTask,
		work: interestingWork(workDelta(beforeWork, afterWork)),
		error
	};
}

function metricsFor(prefix: string, window: WindowResult): Record<string, number | string | null> {
	const out: Record<string, number | string | null> = {
		[`${prefix}:wallMs`]: window.wallMs,
		[`${prefix}:taskMs`]: window.taskMs,
		[`${prefix}:scriptMs`]: window.scriptMs,
		[`${prefix}:layoutMs`]: window.layoutMs,
		[`${prefix}:styleMs`]: window.styleMs,
		[`${prefix}:heapDeltaMiB`]: window.heapDeltaMiB,
		[`${prefix}:nodesDelta`]: window.nodesDelta,
		[`${prefix}:frameP50`]: window.frameP50,
		[`${prefix}:frameP95`]: window.frameP95,
		[`${prefix}:longTasks`]: window.longTasks,
		[`${prefix}:longestLongTask`]: window.longestLongTask
	};
	if (window.error !== null) out[`${prefix}:error`] = window.error;
	for (const [name, value] of Object.entries(window.work)) out[`${prefix}:work:${name}`] = value;
	return out;
}

test.describe('post-Bench-2 attribution', () => {
	test.setTimeout(180_000);
	// This check is S/L by default; an accidental bare run must not start XL.
	const tiers = selectedTiers(process.env.PERF_TIERS === undefined ? ['grid-S', 'grid-L'] : undefined);

	for (const tier of tiers) {
		test(`pan, pick and a local commit at ${tier}`, async ({ browser }, testInfo) => {
			const report = startReport(`attribution-${tier}`);
			const appRevision = process.env.PERF_APP_REVISION ?? 'unrecorded';
			const session = await newMeasuredSession(browser, {
				viewport: VIEWPORT,
				deviceScaleFactor: DEVICE_SCALE_FACTOR,
				network: NETWORK,
				cacheState: 'cold'
			});
			try {
				const { page, cdp } = session;
				const project = tierProject(tier, uniqueProjectId(`attribution-${tier}`));
				const walls = project.envelope.units.layout.data.walls;
				expect(walls.length).toBeGreaterThan(1);
				const wallA = walls[0]!.id;
				const wallB = walls[1]!.id;

				await gotoCreateIntent(page, project.projectId);
				await openSourceJson(page, project);
				await waitForStageSettled(page);
				await setStageReading(page, 'Plan');
				await fitStage(page);
				await waitForCameraSettled(page);
				// One short pan outside the measured window: the Plan overlay's first
				// build is a one-time read, not the per-move cost under test.
				await continuousPan(page, 300);
				await fitStage(page);
				await waitForCameraSettled(page);

				// A continuous pan in the Plan reading: the interaction the locality
				// work claims should no longer re-derive the Plan per camera move.
				const poseBefore = await cameraPose(page);
				let panMoves = 0;
				const pan = await measure(page, cdp, async () => {
					panMoves = await continuousPan(page, 1500);
				});
				const poseAfter = await cameraPose(page);
				await fitStage(page);
				await waitForCameraSettled(page);

				// Canvas pick: select A to learn its handle midpoint, select B so the
				// selection is elsewhere, then click A's midpoint. The Index row's
				// `aria-current` is the presentation of the resolved hit.
				const midpointOf = async (): Promise<{ x: number; y: number }> => {
					const start = await handlePoint(page, 'Wall start');
					const end = await handlePoint(page, 'Wall end');
					return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
				};
				await selectWallAndOpenDimensions(page, wallA);
				const midpointA = await midpointOf();
				await selectWallAndOpenDimensions(page, wallB);
				const midpointB = await midpointOf();
				// The Index still filters on B; A's row must exist for the hit's
				// presentation check.
				await page.locator('#plate-index-search').fill('');
				await closeSelectionCard(page);

				// The first pick on a Plan evaluation pays the broad-phase build; the
				// repeats against the same Plan answer the question the build exists for.
				const picked = await measure(page, cdp, async () => {
					await clickWall(page, midpointA);
				});
				await waitForWallSelection(page, wallA);
				// Repeated clicks and the late-order target are large-workload questions:
				// at S the adjacent Wall midpoints are only a few pixels apart.
				const repeated: WindowResult[] = [];
				let worst: WindowResult | null = null;
				if (tier === 'grid-L') {
					for (const [midpoint, id] of [
						[midpointB, wallB],
						[midpointA, wallA],
						[midpointB, wallB]
					] as const) {
						await closeSelectionCard(page);
					repeated.push(await measure(page, cdp, async () => clickWall(page, midpoint)));
					await waitForWallSelection(page, id);
				}

				// A late-order Wall is the scan's worst case: the old hit path visits
					// the fragments before it. The index is already built, so this is a query.
					const worstId = walls[Math.floor(walls.length * 0.9)]!.id;
					try {
						await selectWallAndOpenDimensions(page, worstId);
						const worstMidpoint = await midpointOf();
						await selectWallAndOpenDimensions(page, wallA);
						await page.locator('#plate-index-search').fill('');
						await closeSelectionCard(page);
						worst = await measure(page, cdp, async () => clickWall(page, worstMidpoint));
						await waitForWallSelection(page, worstId);
					} catch (failure) {
						worst = null;
						console.log(`grid-L: late-order pick unavailable — ${failure instanceof Error ? failure.message : String(failure)}`);
					}
				}

				// Local accepted edit of A: a typed length change through the shipped
				// Dimensions instrument. The presentation is the command's first frame.
				await selectWallAndOpenDimensions(page, wallA);
				let presentation: number | null = null;
				const edit = await measure(page, cdp, async () => {
					const before = await acceptedResultCount(page);
					await commitPrecisionLength(page, 3.7 + Number(tier.endsWith('L')) * 0.01);
					await waitForAcceptedResult(page, before);
					presentation = await commandPresentation(page, 'command:instrument');
				});

				// A new generation is a new Plan; the first click after it answers
				// whether the broad phase's build is paid again.
				let postEdit: WindowResult | null = null;
				if (tier === 'grid-L') {
					try {
						const closeTask = page.getByRole('button', { name: 'Close Dimensions task' });
						if (await closeTask.isVisible().catch(() => false)) await closeTask.click();
						await closeSelectionCard(page);
						await page.locator('#plate-index-search').fill('');
						postEdit = await measure(page, cdp, async () => clickWall(page, midpointB));
						await waitForWallSelection(page, wallB);
					} catch (failure) {
						postEdit = null;
						console.log(`grid-L: post-edit pick unavailable — ${failure instanceof Error ? failure.message : String(failure)}`);
					}
				}

				const row: ResultRow = {
					id: `attribution-${tier}`,
					flow: 'post-Bench-2 attribution: Plan pan, canvas pick, typed local commit',
					workload: `${tier} (${project.facts.walls} walls, ${project.facts.rooms} rooms)`,
					cacheState: 'cold',
					network: NETWORK,
					browser: `Chrome ${browser.version()}`,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: {
						appRevision,
						harnessCommit: commitSha(),
						...metricsFor('pan', pan),
						'pan:moves': panMoves,
						'pan:taskPerMoveMs': panMoves === 0 ? null : pan.taskMs / panMoves,
						'pan:cameraMoved': poseBefore !== '' && poseBefore !== poseAfter ? 1 : 0,
						...metricsFor('pick:first', picked),
						'pick:first:selected': picked.error === null ? 'wall-a' : 'unresolved',
						...(repeated.length === 0
							? {}
							: {
									...Object.assign({}, ...repeated.map((window, index) => metricsFor(`pick:repeat${index + 1}`, window))),
									'pick:repeatMedianWallMs': summarize(repeated.map((window) => window.wallMs)).median,
									'pick:repeatMedianTaskMs': summarize(repeated.map((window) => window.taskMs)).median
								}),
						...(worst === null ? {} : metricsFor('pick:worst', worst)),
						...metricsFor('edit', edit),
						'edit:presentationMs': presentation,
						...(postEdit === null ? {} : metricsFor('pick:postEdit', postEdit)),
					},
					limitations: [
						'targeted attribution, not bench acceptance evidence; one session per tier and revision',
						'CDP TaskDuration/ScriptDuration are cumulative main-thread/script time; JSHeapUsedSize is net heap, not total allocation',
						'pick wall time is click dispatch plus the synchronous hit handler; the Index selection update is awaited outside the window, and the old revision records no plan-pick counters',
						'pan is a continuous background pointer drag (one pan intent per move); the camera has no resize, so a drag pans in the Plan reading',
						'typed commit uses 3.7 m (+0.01 at L); the same value is sent to both revisions',
						`app revision ${appRevision}; harness commit ${commitSha()}`
					]
				};
				report.rows.push(row);
				console.log(`${tier}: pan ${pan.wallMs.toFixed(0)} ms task ${pan.taskMs.toFixed(0)} ms; pick ${picked.wallMs.toFixed(0)} ms (${picked.error ?? 'hit'}); edit ${edit.wallMs.toFixed(0)} ms task ${edit.taskMs.toFixed(0)} ms presentation ${String(presentation)}`);
				testInfo.annotations.push({ type: 'app-revision', description: appRevision });
				fileReport(report);
			} finally {
				await session.close();
			}
		});
	}
});
