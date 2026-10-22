/**
 * F13 — repeated open/close (leaks) (T3.P03.S02 harness).
 *
 * Ten cycles in one context: open the S fixture, accept 20 exact-length edits,
 * close to the hub, then force GC and read the JS heap. Geometry/texture counts,
 * live WebGL contexts and detached nodes need a renderer probe the shipped Stage
 * does not expose; those rows stay unrun and owner-run on the reference machine.
 */

import { expect, test } from '@playwright/test';

import { browserFacts, heapUsedMiB, newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, VIEWPORT, passLimitations } from '../lib/config';
import { fixtureProject } from '../lib/fixtures';
import {
	acceptedResultCount,
	commitPrecisionLength,
	gotoCreateIntent,
	openSourceJson,
	selectFirstWallAndOpenDimensions,
	uniqueProjectId,
	waitForAcceptedResult
} from '../lib/flow';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

const CYCLES = 10;
const EDITS_PER_CYCLE = 20;

test.describe('F13 repeated open/close', () => {
	test.setTimeout(1_200_000);
	test('ten cycles with twenty accepted edits each', async ({ browser }, testInfo) => {
		const report = startReport(`f13-cycles-${testInfo.project.name.replace(/\s+/g, '-')}`);
		const session = await newMeasuredSession(browser, {
			viewport: VIEWPORT,
			deviceScaleFactor: DEVICE_SCALE_FACTOR,
			network: NETWORK,
			cacheState: 'warm'
		});
		try {
			const facts = await browserFacts(browser, session.page);
			const heaps: number[] = [];
			const { page } = session;
			// The initial hub document is the baseline before any Stage cycle.
			await page.goto('/projects');
			await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
			heaps.push(await heapUsedMiB(session.cdp));
			for (let cycle = 0; cycle < CYCLES; cycle++) {
				const projectId = uniqueProjectId(`f13-${cycle}`);
				const project = await fixtureProject('S', projectId);
				await gotoCreateIntent(page, projectId);
				await openSourceJson(page, project);
				await selectFirstWallAndOpenDimensions(page);
				for (let edit = 0; edit < EDITS_PER_CYCLE; edit++) {
					const before = await acceptedResultCount(page);
					await commitPrecisionLength(page, edit % 2 === 0 ? 4.5 : 5);
					await waitForAcceptedResult(page, before);
				}
				await page.goto('/projects');
				await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
				heaps.push(await heapUsedMiB(session.cdp));
			}
			const growth = heaps[heaps.length - 1]! - heaps[0]!;
			const row: ResultRow = {
				id: 'F13-cycles-S',
				flow: 'F13 repeated open/close',
				workload: `S fixture, ${CYCLES} cycles × (open + ${EDITS_PER_CYCLE} edits + close)`,
				cacheState: 'warm',
				network: NETWORK,
				browser: `${testInfo.project.name} ${facts.chromeVersion}`,
				cpuRate: 1,
				viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
				metrics: {
					cycles: CYCLES,
					heapBaselineMiB: heaps[0] ?? Number.NaN,
					heapFinalMiB: heaps[heaps.length - 1] ?? Number.NaN,
					heapGrowthMiB: growth,
					heapPerCycle: heaps.map((value) => Number(value.toFixed(2))).join(',')
				},
				stats: { heapAfterGCDistribution: summarize(heaps) },
				limitations: [
					...passLimitations(),
					'geometry/texture counts, live WebGL contexts and detached nodes are not captured',
					'viewer and Preview enter/exit cycles are not available in this slice'
				]
			};
			report.rows.push(row);
			console.log(formatRow(row));
			const path = fileReport(report);
			console.log(`raw results: ${path}`);
			expect(heaps).toHaveLength(CYCLES + 1);
		} finally {
			await session.close();
		}
	});
});
