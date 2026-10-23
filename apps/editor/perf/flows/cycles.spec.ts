/**
 * F13 — repeated open/close (leaks) (T3.P03.S02 harness).
 *
 * One context per row: open the S fixture, accept 20 exact-length edits, close
 * to the hub, then force GC and read the JS heap. The repeat-use row cycles the
 * same context ten times; the cold row clears cache and cookies before every
 * open; the warm row measures one cycle after a discarded cycle has warmed the
 * Stage in that context. Geometry/texture counts, live WebGL contexts and
 * detached nodes need a renderer probe the shipped Stage does not expose; those
 * rows stay unrun and owner-run on the reference machine.
 */

import { expect, test } from '@playwright/test';

import { browserFacts, clearBrowserState, heapUsedMiB, newMeasuredSession } from '../lib/browser';
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
	test.setTimeout(1_800_000);
	test('ten cycles with twenty accepted edits each, cold/warm/repeat-use', async ({ browser }, testInfo) => {
		const report = startReport(`f13-cycles-${testInfo.project.name.replace(/\s+/g, '-')}`);
		for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
			const cycles = cacheState === 'warm' ? 1 : CYCLES;
			const session = await newMeasuredSession(browser, {
				viewport: VIEWPORT,
				deviceScaleFactor: DEVICE_SCALE_FACTOR,
				network: NETWORK,
				cacheState
			});
			try {
				const facts = await browserFacts(browser, session.page);
				const heaps: number[] = [];
				const { page } = session;
				if (cacheState === 'cold') await clearBrowserState(session.cdp);
				// The hub document is the baseline before the measured cycles (after the
				// discarded warm-up, for a warm row).
				await page.goto('/projects');
				await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
				const runCycle = async (cycle: number): Promise<void> => {
					if (cacheState === 'cold') await clearBrowserState(session.cdp);
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
				};
				// A warm row is meaningless if its only cycle also performed the first
				// Stage compilation; discard one cycle so the measured one starts warm.
				if (cacheState === 'warm') await runCycle(0);
				heaps.push(await heapUsedMiB(session.cdp));
				for (let cycle = 0; cycle < cycles; cycle++) {
					await runCycle(cycle);
					heaps.push(await heapUsedMiB(session.cdp));
				}
				const growth = heaps[heaps.length - 1]! - heaps[0]!;
				const row: ResultRow = {
					id: `F13-cycles-S-${cacheState}`,
					flow: 'F13 repeated open/close',
					workload: `S fixture, ${cycles} cycle${cycles === 1 ? '' : 's'} × (open + ${EDITS_PER_CYCLE} edits + close)`,
					cacheState,
					network: NETWORK,
					browser: `${testInfo.project.name} ${facts.chromeVersion}`,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: {
						cycles,
						heapBaselineMiB: heaps[0] ?? Number.NaN,
						heapFinalMiB: heaps[heaps.length - 1] ?? Number.NaN,
						heapGrowthMiB: growth,
						heapPerCycle: heaps.map((value) => Number(value.toFixed(2))).join(',')
					},
					stats: { heapAfterGCDistribution: summarize(heaps) },
					limitations: [
						...passLimitations(),
						`${cacheState === 'cold' ? 'cold clears cache and cookies before each open; ' : ''}${cacheState === 'warm' ? 'warm is one cycle after a discarded warm-up cycle; repeat-use is ten cycles; ' : ''}geometry/texture counts, live WebGL contexts and detached nodes are not captured`,
						'viewer and Preview enter/exit cycles are not available in this slice'
					]
				};
				report.rows.push(row);
				console.log(formatRow(row));
				expect(heaps).toHaveLength(cycles + 1);
			} finally {
				await session.close();
			}
		}
		const path = fileReport(report);
		console.log(`raw results: ${path}`);
		expect(report.rows).toHaveLength(3);
	});
});
