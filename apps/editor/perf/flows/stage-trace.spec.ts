/**
 * Per-stage traces (T1.P02.S06 C): one traced window per flow and tier.
 *
 * Tracing perturbs the workload, so these windows never feed a timing row:
 * the untraced flows own the numbers, and this spec supplies the attribution
 * the characterization reads beside each row's work-ledger stage spans
 * (main-thread busy/idle, GC, script, style/layout, paint, GPU process). Each
 * tier runs in one warm session: F2's open, one F3 drag sample, one F4 typed
 * commit, one Undo/Redo, and a 3 s F7 orbit, each traced on its own.
 */

import { expect, test, type Page } from '@playwright/test';

import { newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, VIEWPORT } from '../lib/config';
import {
	acceptedResultCount,
	commitPrecisionLength,
	dragWallHandle,
	gotoCreateIntent,
	openSourceJson,
	selectFirstWallAndOpenDimensions,
	uniqueProjectId,
	waitForAcceptedResult
} from '../lib/flow';
import { fileReport, formatRow, startReport } from '../lib/report';
import { startStageTrace, summarizeStageTrace, type StageTraceSummary } from '../lib/stage-trace';
import { readWork, selectedTiers, SMOKE_LABEL, SMOKE, tierAvailability, tierProject, tierWorkloadLabel, workDelta, workMetrics, unrunRow } from '../lib/tiers';

async function traced(page: Page, cdp: Parameters<typeof startStageTrace>[0], work: () => Promise<void>): Promise<{ trace: StageTraceSummary; stages: Record<string, number> }> {
	const before = await readWork(page);
	const stop = await startStageTrace(cdp);
	await work();
	const trace = summarizeStageTrace(await stop());
	return { trace, stages: workMetrics(workDelta(before, await readWork(page))) };
}

test.describe('per-stage traces', () => {
	test.setTimeout(3_600_000);
	for (const tier of selectedTiers()) {
		test(`traced windows at ${tier}`, async ({ browser }, testInfo) => {
			const report = startReport(`stage-trace-${tier}-${testInfo.project.name.replace(/\s+/g, '-')}`);
			const availability = tierAvailability(tier);
			if (!availability.available) {
				report.rows.push(unrunRow(`trace-${tier}-unrun`, 'per-stage traced windows', tierWorkloadLabel(tier), testInfo.project.name, availability.reason));
				fileReport(report);
				return;
			}
			const session = await newMeasuredSession(browser, { viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK, cacheState: 'warm' });
			try {
				const { page, cdp } = session;
				const projectId = uniqueProjectId(`trace-${tier}`);
				const project = tierProject(tier, projectId);
				await gotoCreateIntent(page, projectId);
				const windows: Record<string, Awaited<ReturnType<typeof traced>>> = {};
				windows.F2 = await traced(page, cdp, async () => {
					await openSourceJson(page, project);
					await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
				});
				await selectFirstWallAndOpenDimensions(page);
				windows.F3 = await traced(page, cdp, async () => {
					const before = await acceptedResultCount(page);
					await dragWallHandle(page, { samples: SMOKE ? 1 : 60, distance: 6 });
					await waitForAcceptedResult(page, before);
				});
				await selectFirstWallAndOpenDimensions(page);
				windows.F4 = await traced(page, cdp, async () => {
					const before = await acceptedResultCount(page);
					await commitPrecisionLength(page, 4.45);
					await waitForAcceptedResult(page, before);
				});
				windows.F8 = await traced(page, cdp, async () => {
					for (const name of ['Undo', 'Redo']) {
						const before = await acceptedResultCount(page);
						await page.getByRole('button', { name, exact: true }).click();
						await waitForAcceptedResult(page, before);
					}
				});
				const box = await page.locator('.stage').first().boundingBox();
				if (box === null) throw new Error('the Stage has no box');
				windows.F7 = await traced(page, cdp, async () => {
					const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
					await page.keyboard.down('Shift');
					await page.mouse.move(center.x, center.y);
					await page.mouse.down();
					const steps = SMOKE ? 6 : 18;
					for (let step = 0; step < steps; step++) {
						const angle = (step / steps) * Math.PI * 2;
						await page.mouse.move(center.x + Math.cos(angle) * 140, center.y + Math.sin(angle) * 70);
						await page.waitForTimeout(3_000 / steps);
					}
					await page.mouse.up();
					await page.keyboard.up('Shift');
				});
				for (const [flow, window] of Object.entries(windows)) {
					const row = {
						id: `trace-${flow}-${tier}`,
						flow: `${flow} traced window (attribution, never a timing row)`,
						workload: tierWorkloadLabel(tier),
						cacheState: 'warm',
						network: NETWORK,
						browser: testInfo.project.name,
						cpuRate: 1,
						viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
						metrics: {
							...Object.fromEntries(
								Object.entries(window.trace).map(([name, value]): [string, number | string] => [
									`trace:${name}`,
									typeof value === 'number' ? value : (value as readonly number[]).map((entry) => entry.toFixed(1)).join(',')
								])
							),
							...window.stages
						},
						limitations: ['tracing perturbs the workload: attribution only', ...(SMOKE ? [SMOKE_LABEL] : [])]
					};
					report.rows.push(row);
					console.log(formatRow(row));
				}
				expect(Object.keys(windows)).toHaveLength(5);
			} finally {
				await session.close();
			}
			console.log(`raw results: ${fileReport(report)}`);
		});
	}
});
