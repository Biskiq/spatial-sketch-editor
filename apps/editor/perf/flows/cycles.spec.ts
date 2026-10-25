/**
 * F13 — repeated open/close (leaks) (T3.P03.S02 harness).
 *
 * One context per row: open the S fixture, accept 20 exact-length edits, close
 * to the hub, then force GC and read the JS heap. The repeat-use row measures
 * ten cycles in the same context after a discarded warm-up; the cold row starts
 * in one fresh context and clears
 * cache and cookies before every open (it cannot reset the renderer's V8 code
 * cache inside the ten-cycle run, and already-loaded modules stay resident); warm
 * and repeat-use discard one cycle before measuring, so first Stage/module load
 * is reported separately from measured growth. T1.P02.S06 tiers the flow (the
 * workload's JSON under New Project's minted id, admitted through the real
 * chooser) and records the Stage renderer's live geometries, textures and
 * programs at the end of each cycle. Live WebGL contexts and detached nodes are
 * not captured.
 *
 * The owner's D1 ruling adds two post-GC readings inside each measured cycle,
 * with the project open: after the open and after its twenty accepted edits.
 * Their difference over the edits is the heap each accepted edit retains while
 * its history grows ("retained per edit").
 */

import { expect, test } from '@playwright/test';

import { browserFacts, clearBrowserState, heapUsedMiB, newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, VIEWPORT, passLimitations } from '../lib/config';
import {
	acceptedResultCount,
	commitPrecisionLength,
	closeProjectToHub,
	openProjectFromHub,
	openSourceJson,
	selectFirstWallAndOpenDimensions,
	waitForAcceptedResult
} from '../lib/flow';
import { clearObservations } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';
import { readHeapAfterGc, readOwnership, readRenderCounters, selectedTiers, smokeOr, tierAvailability, tierLimitations, tierProject, tierWorkloadLabel, unrunRow, type HeapSample, type Ownership } from '../lib/tiers';

const CYCLES = smokeOr(10);
const EDITS_PER_CYCLE = smokeOr(20);

test.describe('F13 repeated open/close', () => {
	test.setTimeout(7_200_000);
	for (const tier of selectedTiers()) test(`cold/warm/repeat-use cycles with twenty accepted edits at ${tier}`, async ({ browser }, testInfo) => {
		const report = startReport(`f13-cycles-${tier}-${testInfo.project.name.replace(/\s+/g, '-')}`);
		const availability = tierAvailability(tier);
		if (!availability.available) {
			report.rows.push(unrunRow(`F13-${tier}-unrun`, 'F13 repeated open/close', tierWorkloadLabel(tier), testInfo.project.name, availability.reason));
			fileReport(report);
			return;
		}
		for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
			const measuredCycles = cacheState === 'warm' ? 1 : CYCLES;
			const warmupCycles = cacheState === 'cold' ? 0 : 1;
			const session = await newMeasuredSession(browser, {
				viewport: VIEWPORT,
				deviceScaleFactor: DEVICE_SCALE_FACTOR,
				network: NETWORK,
				cacheState
			});
			try {
				const facts = await browserFacts(browser, session.page);
				const heaps: number[] = [];
				const resources: { documents: number; nodes: number; jsEventListeners: number }[] = [];
				const gpuObjects: { geometries: number; textures: number; programs: number }[] = [];
				const openHeaps: HeapSample[] = [];
				const peakHeaps: HeapSample[] = [];
				const peakOwnership: Ownership[] = [];
				const capture = async (sample: string) => {
					const heapMiB = await heapUsedMiB(session.cdp);
					expect(
						Number.isFinite(heapMiB),
						`F13 ${cacheState} ${sample} post-GC heap metric must be finite (got ${heapMiB})`
					).toBe(true);
					const counts = await session.cdp.send('Memory.getDOMCounters');
					console.log(`F13 resource sample: ${JSON.stringify({ cacheState, sample, heapMiB, ...counts })}`);
					return { heapMiB, counts };
				};
				const { page } = session;
				if (cacheState === 'cold') await clearBrowserState(session.cdp);
				// Record the virgin hub entry heap separately from warm/repeat-use's
				// measured baseline after the discarded warm-up.
				await page.goto('/projects');
				await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
				const appLifetime = await page.evaluate(() => {
					const token = crypto.randomUUID();
					Object.assign(window, { __F13_LIFETIME__: token });
					return { token, timeOrigin: performance.timeOrigin };
				});
				await clearObservations(page);
				const entrySample = await capture('entry-before-warmup');
				const runCycle = async (measured: boolean): Promise<void> => {
					if (cacheState === 'cold') await clearBrowserState(session.cdp);
					const projectId = await openProjectFromHub(page);
					await openSourceJson(page, tierProject(tier, projectId));
					await selectFirstWallAndOpenDimensions(page);
					if (measured) openHeaps.push(await readHeapAfterGc(session.cdp));
					for (let edit = 0; edit < EDITS_PER_CYCLE; edit++) {
						const before = await acceptedResultCount(page);
						await commitPrecisionLength(page, edit % 2 === 0 ? 4.5 : 5);
						await waitForAcceptedResult(page, before);
					}
					if (measured) {
						peakHeaps.push(await readHeapAfterGc(session.cdp));
						const counts = await readOwnership(page);
						if (counts !== null) peakOwnership.push(counts);
					}
					const stage = (await readRenderCounters(page)).stage;
					gpuObjects.push({ geometries: stage?.geometries ?? 0, textures: stage?.textures ?? 0, programs: stage?.programs ?? 0 });
					await closeProjectToHub(page);
					expect(await page.evaluate(() => ({
						token: (window as Window & { __F13_LIFETIME__?: string }).__F13_LIFETIME__,
						timeOrigin: performance.timeOrigin
					}))).toEqual(appLifetime);
				};
				// Warm and repeat-use rows discard one full cycle so first Stage/module
				// load is excluded from measured growth. Keep its entry heap above so
				// this startup cost remains visible in the report.
				for (let cycle = 0; cycle < warmupCycles; cycle++) {
					await runCycle(false);
					await clearObservations(page);
				}
				const baselineSample = warmupCycles === 0 ? entrySample : await capture('measured-baseline-after-warmup');
				heaps.push(baselineSample.heapMiB);
				resources.push(baselineSample.counts);
				for (let cycle = 0; cycle < measuredCycles; cycle++) {
					await runCycle(true);
					await clearObservations(page);
					const sample = await capture(`measured-cycle-${cycle + 1}`);
					heaps.push(sample.heapMiB);
					resources.push(sample.counts);
				}
				const growth = heaps[heaps.length - 1]! - heaps[0]!;
				const warmupDescription = warmupCycles === 0 ? '' : `${warmupCycles} discarded warm-up + `;
				const row: ResultRow = {
					id: `F13-cycles-${tier}-${cacheState}`,
					flow: 'F13 repeated open/close',
					workload: `${tierWorkloadLabel(tier)}, ${warmupDescription}${measuredCycles} measured cycle${measuredCycles === 1 ? '' : 's'} × (open + ${EDITS_PER_CYCLE} edits + close)`,
					cacheState,
					network: NETWORK,
					browser: `${testInfo.project.name} ${facts.chromeVersion}`,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: {
						warmupCycles,
						measuredCycles,
						heapEntryMiB: entrySample.heapMiB,
						heapBaselineMiB: heaps[0] ?? Number.NaN,
						heapEntryToBaselineDeltaMiB: (heaps[0] ?? Number.NaN) - entrySample.heapMiB,
						heapFinalMiB: heaps[heaps.length - 1] ?? Number.NaN,
						heapGrowthMiB: growth,
						heapPerCycle: heaps.map((value) => Number(value.toFixed(2))).join(','),
						domNodesPerCycle: resources.map((value) => value.nodes).join(','),
						domListenersPerCycle: resources.map((value) => value.jsEventListeners).join(','),
						domDocumentsPerCycle: resources.map((value) => value.documents).join(','),
						stageGeometriesPerCycle: gpuObjects.map((value) => value.geometries).join(','),
						stageTexturesPerCycle: gpuObjects.map((value) => value.textures).join(','),
						stageProgramsPerCycle: gpuObjects.map((value) => value.programs).join(','),
						heapOpenPerCycle: openHeaps.map((value) => Number(value.heapMiB.toFixed(2))).join(','),
						heapPeakPerCycle: peakHeaps.map((value) => Number(value.heapMiB.toFixed(2))).join(','),
						retainedPerEditMiB: summarize(peakHeaps.map((peak, index) => (peak.heapMiB - (openHeaps[index]?.heapMiB ?? Number.NaN)) / EDITS_PER_CYCLE)).median,
						domNodesAtPeakPerCycle: peakHeaps.map((value) => value.nodes).join(','),
						stageMaterialsAtPeakPerCycle: peakOwnership.map((value) => value.materials).join(','),
						stageMeshesAtPeakPerCycle: peakOwnership.map((value) => value.meshes).join(',')
					},
					stats: {
						heapAfterGCDistribution: summarize(heaps),
						heapOpenMiB: summarize(openHeaps.map((value) => value.heapMiB)),
						heapPeakMiB: summarize(peakHeaps.map((value) => value.heapMiB))
					},
					limitations: [
						...passLimitations(),
						`${cacheState === 'cold' ? 'cold starts in a fresh context and clears cache/cookies before each measured open; the V8 code cache is not reset within the ten-cycle run; ' : ''}${cacheState !== 'cold' ? 'entry heap is recorded before one discarded warm-up cycle; baseline and growth start after warm-up; ' : ''}${cacheState === 'warm' ? 'warm measures one cycle after its discarded warm-up; ' : ''}${cacheState === 'repeat-use' ? 'repeat-use measures ten cycles after its discarded warm-up; ' : ''}live WebGL contexts and detached nodes are not captured; Stage geometries/textures/programs are the renderer's live counts at each cycle's end (count, not timing)`,
						...tierLimitations(tier),
						'all cycles preserve one application realm via New Project and browser Back; harness observation buffers are cleared before GC; other harness overhead remains',
						'viewer and Preview enter/exit cycles are not available in this slice',
						'heapOpen/heapPeak (D1): post-GC heap with the project open, after the open and after the twenty edits; retainedPerEditMiB is their median difference per edit'
					]
				};
				report.rows.push(row);
				console.log(formatRow(row));
				expect(heaps).toHaveLength(measuredCycles + 1);
			} finally {
				await session.close();
			}
		}
		const path = fileReport(report);
		console.log(`raw results: ${path}`);
		expect(report.rows).toHaveLength(3);
	});
});
