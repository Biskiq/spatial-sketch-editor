/**
 * F1 — editor startup (T3.P03.S02 harness).
 *
 * Measure: navigation start → hub interactive → Stage route → first
 * architectural frame on the starter, plus FCP, LCP, long tasks and script
 * bytes/requests per route. Cold creates a fresh context for every run; warm
 * and repeat-use keep one context (repeat-use re-enters through the hub).
 *
 * These are pre-flight numbers on a developer machine. F1's Stage **first
 * architectural frame** is the rAF rendering opportunity after activation; it is
 * not the contract's first interactive frame (a frame after which a pointer is
 * handled within 50 ms). The hard row is accepted only from the designated
 * reference machine, operated by the owner, and must be reported under this
 * label rather than as first-interactive.
 */

import { expect, test } from '@playwright/test';

import { collectMeasuredRuns, type MeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, RUNS, VIEWPORT, WARMUP_RUNS, passLimitations } from '../lib/config';
import { firstFrameAtOrAfter, readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

type StartRun = {
	readonly hubInteractive: number;
	readonly stageFirstFrame: number;
	readonly activationToFrame: number;
	readonly fcp: number | null;
	readonly lcp: number | null;
	readonly longTaskCount: number;
	readonly longTaskMax: number;
	readonly scriptBytes: number;
	readonly scriptRequests: number;
};

async function startOnce(session: MeasuredSession): Promise<StartRun> {
	const { page } = session;
	await page.goto('/projects');
	// The hub renders on the server; a click before hydration is silently lost, so
	// "hub interactive" waits for the client to be ready, not just for the pixel.
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
	const hubInteractive = await page.evaluate(() => performance.now());
	await page.getByRole('button', { name: 'New Project' }).click();
	await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeVisible();
	await page.getByRole('button', { name: 'Enclosed room' }).click();
	await expect(page.locator('canvas').first()).toBeVisible();
	const canvasVisibleAt = await page.evaluate(() => performance.now());
	await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
	const ledger = await readLedger(page);
	const activatedAt = ledger.records.find((entry) => entry.name === 'stage:activated')?.time ?? null;
	// Attribute the frame from the product's activation mark, not from the harness's
	// own observation of the canvas: waiting for a locator adds test time to a
	// product measurement.
	const stageFirstFrame = firstFrameAtOrAfter(ledger.ticks, activatedAt ?? canvasVisibleAt);
	if (stageFirstFrame === null) throw new Error('no frame was recorded after the Stage appeared');
	const resources = await page.evaluate(() =>
		performance
			.getEntriesByType('resource')
			.filter((entry) => (entry as PerformanceResourceTiming).initiatorType === 'script')
			.map((entry) => (entry as PerformanceResourceTiming).transferSize)
	);
	const longTasks = ledger.longTasks;
	return {
		hubInteractive,
		stageFirstFrame,
		activationToFrame: activatedAt === null ? Number.NaN : stageFirstFrame - activatedAt,
		fcp: ledger.paints['first-contentful-paint'] ?? null,
		lcp: ledger.lcp,
		longTaskCount: longTasks.length,
		longTaskMax: longTasks.reduce((max, entry) => Math.max(max, entry.duration), 0),
		scriptBytes: resources.reduce((sum, value) => sum + value, 0),
		scriptRequests: resources.length
	};
}

test.describe('F1 startup', () => {
	test('cold, warm and repeat-use starter boot', async ({ browser }, testInfo) => {
		const report = startReport(`f1-startup-${testInfo.project.name.replace(/\s+/g, '-')}`);
		const limitations = passLimitations();
		for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
			const { results: runs, facts } = await collectMeasuredRuns(
				browser,
				{ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK },
				{ cacheState, warmup: WARMUP_RUNS, runs: RUNS },
				startOnce
			);
			const row: ResultRow = {
				id: `F1-starter-${cacheState}`,
				flow: 'F1 editor startup',
				workload: 'starter gallery',
				cacheState,
				network: NETWORK,
				browser: `${testInfo.project.name} ${facts.chromeVersion}`,
				cpuRate: 1,
				viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
				metrics: {
					hubInteractive: summarize(runs.map((run) => run.hubInteractive)).median,
					stageFirstFrame: summarize(runs.map((run) => run.stageFirstFrame)).median,
					activationToFrame: summarize(runs.map((run) => run.activationToFrame)).median,
					fcp: summarize(runs.map((run) => run.fcp).filter((value): value is number => value !== null)).median,
					lcp: summarize(runs.map((run) => run.lcp).filter((value): value is number => value !== null)).median,
					longTaskCount: summarize(runs.map((run) => run.longTaskCount)).median,
					longTaskMax: summarize(runs.map((run) => run.longTaskMax)).max,
					scriptBytes: summarize(runs.map((run) => run.scriptBytes)).median,
					scriptRequests: summarize(runs.map((run) => run.scriptRequests)).median
				},
				stats: {
					stageFirstFrame: summarize(runs.map((run) => run.stageFirstFrame)),
					activationToFrame: summarize(runs.map((run) => run.activationToFrame))
				},
				limitations: [...limitations, 'first architectural frame is attributed to the rAF rendering opportunity']
			};
			report.rows.push(row);
			console.log(formatRow(row));
		}
		const path = fileReport(report);
		console.log(`raw results: ${path}`);
		expect(report.rows).toHaveLength(3);
	});
});
