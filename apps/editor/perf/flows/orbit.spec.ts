/**
 * F7 — orbit/navigation (T3.P03.S02 harness).
 *
 * A scripted 10 s orbit + dolly on the M fixture, measured with the harness's
 * rAF frame clock: frame intervals p50/p95/p99, long tasks and dropped frames.
 *
 * Draw calls, triangles and GPU time need a renderer probe the shipped Stage
 * does not expose; those rows stay unrun and owner-run on the reference
 * machine. F7's frame-time budget is a hard row there, never a claim from this
 * pre-flight pass.
 */

import { expect, test } from '@playwright/test';

import { browserFacts, newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, RUNS, VIEWPORT, passLimitations } from '../lib/config';
import { fixtureProject } from '../lib/fixtures';
import { gotoCreateIntent, openSourceJson, uniqueProjectId } from '../lib/flow';
import { frameIntervals, readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

const ORBIT_MS = 10_000;

type OrbitRun = {
	readonly intervals: number[];
	readonly longTasks: number;
	readonly longestTask: number;
};

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
	// Sixty paced moves across the full orbit: the input rate is not the F7 metric
	// (frame intervals are), and awaiting 600+ protocol round-trips on a heavy
	// scene would make the script the bottleneck instead of the renderer.
	const steps = 60;
	const paceMs = Math.max(16, Math.floor(ORBIT_MS / steps) - 60);
	for (let index = 0; index < steps; index++) {
		const angle = (index / steps) * Math.PI * 2;
		await page.mouse.move(center.x + Math.cos(angle) * 140, center.y + Math.sin(angle) * 70);
		if (index % 15 === 0) await page.mouse.wheel(0, index % 30 === 0 ? 40 : -30);
		await page.waitForTimeout(paceMs);
	}
	const ended = await page.evaluate(() => performance.now());
	await page.mouse.up();
	await page.keyboard.up('Shift');
	const ledger = await readLedger(page);
	return {
		intervals: frameIntervals(ledger.ticks, started, ended),
		longTasks: ledger.longTasks.filter((entry) => entry.start >= started && entry.start <= ended).length,
		longestTask: ledger.longTasks
			.filter((entry) => entry.start >= started && entry.start <= ended)
			.reduce((max, entry) => Math.max(max, entry.duration), 0)
	};
}

test.describe('F7 orbit', () => {
	test.setTimeout(900_000);
	test('scripted orbit and dolly on M', async ({ browser }, testInfo) => {
		const report = startReport(`f7-orbit-${testInfo.project.name.replace(/\s+/g, '-')}`);
		const session = await newMeasuredSession(browser, {
			viewport: VIEWPORT,
			deviceScaleFactor: DEVICE_SCALE_FACTOR,
			network: NETWORK,
			cacheState: 'warm'
		});
		try {
			const facts = await browserFacts(browser, session.page);
			await orbitOnce(session); // discarded warm-up
			const runs: OrbitRun[] = [];
			for (let index = 0; index < RUNS; index++) runs.push(await orbitOnce(session));
			const intervals = runs.flatMap((run) => run.intervals);
			const dropped = runs.reduce(
				(sum, run) => sum + run.intervals.filter((interval) => interval > 33.4).length,
				0
			);
			const row: ResultRow = {
				id: 'F7-orbit-M',
				flow: 'F7 orbit/navigation',
				workload: 'M fixture, 10 s scripted orbit + dolly',
				cacheState: 'warm',
				network: NETWORK,
				browser: `${testInfo.project.name} ${facts.chromeVersion}`,
				cpuRate: 1,
				viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
				metrics: {
					frames: intervals.length,
					droppedFramesOver33ms: dropped,
					longTaskCount: runs.reduce((sum, run) => sum + run.longTasks, 0),
					longestTask: runs.reduce((max, run) => Math.max(max, run.longestTask), 0)
				},
				stats: {
					frameInterval: summarize(intervals)
				},
				limitations: [
					...passLimitations(),
					'draw calls, triangles and GPU time are not captured (no renderer probe on the shipped Stage)',
					'S and L orbit rows stay unrun in this slice',
					'frame intervals are rAF-to-rAF on a 60 Hz panel and do not substitute for presented-result latency'
				]
			};
			report.rows.push(row);
			console.log(formatRow(row));
			const path = fileReport(report);
			console.log(`raw results: ${path}`);
			expect(intervals.length).toBeGreaterThan(0);
		} finally {
			await session.close();
		}
	});
});
