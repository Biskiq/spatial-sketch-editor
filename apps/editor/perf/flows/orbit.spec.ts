/**
 * F7 — orbit/navigation (T3.P03.S02 harness).
 *
 * A scripted 10 s orbit + dolly on the M fixture, measured cold, warm and
 * repeat-use with the harness's rAF frame clock: frame intervals p50/p95/p99,
 * long tasks and dropped frames.
 *
 * The script paces movement to a wall-clock deadline, so the orbit itself takes
 * 10 s rather than the shorter time a fixed per-step delay produced. If the
 * display paces below 60 Hz (battery/thermal state), the same orbit continues
 * past 10 s until each run has the contract's 600 frames; the row records the
 * actual duration and frames per run instead of claiming a duration it did not
 * achieve.
 *
 * Draw calls, triangles and GPU time need a renderer probe the shipped Stage
 * does not expose; those rows stay unrun and owner-run on the reference
 * machine. F7's frame-time budget is a hard row there, never a claim from this
 * pre-flight pass.
 */

import { expect, test } from '@playwright/test';

import { browserFacts, clearBrowserState, newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, RUNS, VIEWPORT, passLimitations } from '../lib/config';
import { fixtureProject } from '../lib/fixtures';
import { closeToHub, gotoCreateIntent, openSourceJson, uniqueProjectId } from '../lib/flow';
import { frameIntervals, readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

const ORBIT_MS = 10_000;
const FRAME_FLOOR = 600;
const MAX_ORBIT_MS = 60_000;
const STEPS_PER_ORBIT = 60;
const STEP_MS = ORBIT_MS / STEPS_PER_ORBIT;

type OrbitRun = {
	readonly intervals: number[];
	readonly longTasks: number;
	readonly longestTask: number;
	readonly durationMs: number;
	readonly frames: number;
};

type TickWindow = Window & { __BISKIQ_PERF_TICKS__?: number[] };

async function orbitOnce(
	session: Awaited<ReturnType<typeof newMeasuredSession>>
): Promise<OrbitRun> {
	const { page } = session;
	const projectId = uniqueProjectId('f7');
	const project = await fixtureProject('M', projectId);
	await gotoCreateIntent(page, projectId);
	await openSourceJson(page, project);
	await expect(page.locator('canvas').first()).toBeVisible();
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
	await page.mouse.up();
	await page.keyboard.up('Shift');
	const ledger = await readLedger(page);
	const intervals = frameIntervals(ledger.ticks, started, ended);
	return {
		intervals,
		longTasks: ledger.longTasks.filter((entry) => entry.start >= started && entry.start <= ended).length,
		longestTask: ledger.longTasks
			.filter((entry) => entry.start >= started && entry.start <= ended)
			.reduce((max, entry) => Math.max(max, entry.duration), 0),
		durationMs: ended - started,
		frames: intervals.length
	};
}

test.describe('F7 orbit', () => {
	test.setTimeout(3_000_000);
	test('scripted orbit and dolly on M, cold, warm and repeat-use', async ({ browser }, testInfo) => {
		const report = startReport(`f7-orbit-${testInfo.project.name.replace(/\s+/g, '-')}`);
		for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
			const session = await newMeasuredSession(browser, {
				viewport: VIEWPORT,
				deviceScaleFactor: DEVICE_SCALE_FACTOR,
				network: NETWORK,
				cacheState
			});
			try {
				const facts = await browserFacts(browser, session.page);
				if (cacheState === 'cold') await clearBrowserState(session.cdp);
				await orbitOnce(session); // discarded warm-up
				if (cacheState === 'repeat-use') await closeToHub(session.page);
				const runs: OrbitRun[] = [];
				for (let index = 0; index < RUNS; index++) {
					if (cacheState === 'cold') await clearBrowserState(session.cdp);
					runs.push(await orbitOnce(session));
					if (cacheState === 'repeat-use') await closeToHub(session.page);
				}
				const intervals = runs.flatMap((run) => run.intervals);
				const dropped = runs.reduce(
					(sum, run) => sum + run.intervals.filter((interval) => interval > 33.4).length,
					0
				);
				const row: ResultRow = {
					id: `F7-orbit-M-${cacheState}`,
					flow: 'F7 orbit/navigation',
					workload: 'M fixture, 10 s scripted orbit + dolly, extended only to reach the 600-frame floor',
					cacheState,
					network: NETWORK,
					browser: `${testInfo.project.name} ${facts.chromeVersion}`,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: {
						frames: intervals.length,
						framesPerRunMin: Math.min(...runs.map((run) => run.frames)),
						durationMsMedian: summarize(runs.map((run) => run.durationMs)).median,
						durationMsMin: Math.min(...runs.map((run) => run.durationMs)),
						droppedFramesOver33ms: dropped,
						longTaskCount: runs.reduce((sum, run) => sum + run.longTasks, 0),
						longestTask: runs.reduce((max, run) => Math.max(max, run.longestTask), 0)
					},
					stats: {
						frameInterval: summarize(intervals),
						durationMs: summarize(runs.map((run) => run.durationMs)),
						framesPerRun: summarize(runs.map((run) => run.frames))
					},
					limitations: [
						...passLimitations(),
						'draw calls, triangles and GPU time are not captured (no renderer probe on the shipped Stage)',
						'S and L orbit rows stay unrun in this slice',
						'frame intervals are rAF-to-rAF on a 60 Hz panel and do not substitute for presented-result latency',
						`runs extend past ${ORBIT_MS} ms only when the display cannot deliver ${FRAME_FLOOR} frames in that time`
					]
				};
				report.rows.push(row);
				console.log(formatRow(row));
				expect(runs).toHaveLength(RUNS);
				for (const run of runs) expect(run.frames).toBeGreaterThanOrEqual(FRAME_FLOOR);
			} finally {
				await session.close();
			}
		}
		const path = fileReport(report);
		console.log(`raw results: ${path}`);
		expect(report.rows).toHaveLength(3);
	});
});
