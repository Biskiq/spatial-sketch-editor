/**
 * F2 — project open (T3.P03.S02 harness).
 *
 * Open JSON → canonical admission → first architectural frame, for the S
 * (grid-3) and M (grid-7) fixtures. Cold clears cache/cookies before every
 * measured navigation; warm repeats in the same context. The F2 hard row is
 * accepted only from the designated reference machine.
 */

import { expect, test } from '@playwright/test';

import { browserFacts, clearBrowserState, newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, RUNS, VIEWPORT, WARMUP_RUNS, passLimitations } from '../lib/config';
import { fixtureProject, type FixtureSize } from '../lib/fixtures';
import { gotoCreateIntent, openSourceJson, uniqueProjectId } from '../lib/flow';
import { firstFrameAtOrAfter, readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

type OpenRun = {
	readonly admission: number;
	readonly admittedToFrame: number;
	readonly total: number;
};

async function openOnce(
	session: Awaited<ReturnType<typeof newMeasuredSession>>,
	size: FixtureSize
): Promise<OpenRun> {
	const { page } = session;
	const projectId = uniqueProjectId(`f2-${size}`);
	const project = await fixtureProject(size, projectId);
	await gotoCreateIntent(page, projectId);
	await openSourceJson(page, project);
	await expect(page.locator('canvas').first()).toBeVisible();
	await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
	const ledger = await readLedger(page);
	const requested = ledger.records.find((record) => record.name === 'f2:open-requested');
	const admitted = ledger.records.find((record) => record.name === 'f2:open-admitted');
	if (requested === undefined || admitted === undefined) throw new Error('F2 marks are missing');
	// The flow starts at the chosen file and ends at the admission mark; the frame
	// is the first rendering opportunity after that mark. Waiting for a locator is
	// harness time, never product time.
	const frame = firstFrameAtOrAfter(ledger.ticks, admitted.time);
	if (frame === null) throw new Error('no frame after admission');
	return {
		admission: admitted.time - requested.time,
		admittedToFrame: frame - admitted.time,
		total: frame - requested.time
	};
}

for (const size of ['S', 'M'] as const) {
	test.describe(`F2 project open — ${size}`, () => {
		test(`cold and warm ${size} fixture`, async ({ browser }, testInfo) => {
			const report = startReport(`f2-open-${size}-${testInfo.project.name.replace(/\s+/g, '-')}`);
			const limitations = passLimitations();
			for (const cacheState of ['cold', 'warm'] as const) {
				const session = await newMeasuredSession(browser, {
					viewport: VIEWPORT,
					deviceScaleFactor: DEVICE_SCALE_FACTOR,
					network: NETWORK,
					cacheState: 'cold'
				});
				try {
					const facts = await browserFacts(browser, session.page);
					for (let index = 0; index < WARMUP_RUNS; index++) {
						if (cacheState === 'cold') await clearBrowserState(session.cdp);
						await openOnce(session, size);
					}
					const runs: OpenRun[] = [];
					for (let index = 0; index < RUNS; index++) {
						if (cacheState === 'cold') await clearBrowserState(session.cdp);
						runs.push(await openOnce(session, size));
					}
					const row: ResultRow = {
						id: `F2-${size}-${cacheState}`,
						flow: 'F2 project open',
						workload: `${size} fixture (${size === 'S' ? 'grid-3, ~20 walls' : 'grid-7, ~100 walls'})`,
						cacheState,
						network: NETWORK,
						browser: `${testInfo.project.name} ${facts.chromeVersion}`,
						cpuRate: 1,
						viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
						metrics: {
							admissionMedian: summarize(runs.map((run) => run.admission)).median,
							admittedToFrameMedian: summarize(runs.map((run) => run.admittedToFrame)).median,
							totalMedian: summarize(runs.map((run) => run.total)).median
						},
						stats: {
							admission: summarize(runs.map((run) => run.admission)),
							total: summarize(runs.map((run) => run.total))
						},
						limitations: [
							...limitations,
							'F2 flow starts at the chosen file, not at the Open button (the dialog is not admission work)',
							'first architectural frame is attributed to the rAF rendering opportunity'
						]
					};
					report.rows.push(row);
					console.log(formatRow(row));
				} finally {
					await session.close();
				}
			}
			const path = fileReport(report);
			console.log(`raw results: ${path}`);
			expect(report.rows).toHaveLength(2);
		});
	});
}
