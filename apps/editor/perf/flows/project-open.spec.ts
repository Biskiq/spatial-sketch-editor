/**
 * F2 — project open (T3.P03.S02 harness; tiered by T1.P02.S06).
 *
 * Open JSON → canonical admission → first architectural frame. Each tier loads
 * its precomputed workload through the real Open-source-JSON chooser, since
 * opening is what F2 measures (A.2). Tiers run peak first (A.3).
 *
 * A.6 method validation: grid-S and grid-M also run under the **old method**
 * (topology rebuilt through the planners inside the run, then opened), on the
 * same revision. Those rows are labelled `F2-old-*`, never merged with the new
 * method's rows, and carry the old method's wall time.
 *
 * Cold creates a fresh context for every run; warm and repeat-use keep one
 * context, and repeat-use closes back to the hub before opening a fresh
 * project. Hard rows are accepted only from the designated reference machine.
 */

import { expect, test } from '@playwright/test';

import { collectMeasuredRuns, type MeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, RUNS, VIEWPORT, WARMUP_RUNS, passLimitations } from '../lib/config';
import { fixtureProject, type FixtureProject, type FixtureSize } from '../lib/fixtures';
import { closeToHub, gotoCreateIntent, openSourceJson, uniqueProjectId } from '../lib/flow';
import { firstFrameAtOrAfter, readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';
import {
	readRenderCounters,
	readResidentBytes,
	readWork,
	renderCounterDelta,
	renderMetrics,
	residentMetrics,
	selectedTiers,
	smokeOr,
	tierAvailability,
	tierLimitations,
	tierProject,
	tierWorkloadLabel,
	workDelta,
	workMetrics,
	type RenderCounters,
	type ResidentBytes,
	type WorkSnapshot,
	unrunRow
} from '../lib/tiers';
import type { WorkloadId } from '../lib/workloads/registry';

type OpenRun = {
	readonly admission: number;
	readonly admittedToFrame: number;
	readonly total: number;
	readonly setupMs: number;
	readonly wallMs: number;
	readonly work: WorkSnapshot;
	readonly render: Record<string, RenderCounters>;
	readonly resident: ResidentBytes | null;
};

type Source = { readonly method: 'new'; readonly tier: WorkloadId } | { readonly method: 'old'; readonly size: FixtureSize };

async function openOnce(session: MeasuredSession, source: Source): Promise<OpenRun> {
	const { page } = session;
	const started = performance.now();
	const projectId = uniqueProjectId(`f2-${source.method === 'new' ? source.tier : `old-${source.size}`}`);
	// The old method rebuilds topology through the planners here; the new one
	// reads the cached canonical JSON. Both are setup, outside the window.
	const project: FixtureProject = source.method === 'new' ? tierProject(source.tier, projectId) : await fixtureProject(source.size, projectId);
	await gotoCreateIntent(page, projectId);
	const setupMs = performance.now() - started;
	const workBefore = await readWork(page);
	const renderBefore = await readRenderCounters(page);
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
	const work = workDelta(workBefore, await readWork(page));
	const render = renderCounterDelta(renderBefore, await readRenderCounters(page));
	const resident = await readResidentBytes(page);
	return {
		admission: admitted.time - requested.time,
		admittedToFrame: frame - admitted.time,
		total: frame - requested.time,
		setupMs,
		wallMs: performance.now() - started,
		work,
		render,
		resident
	};
}

function mergeWindows(runs: readonly OpenRun[]): { work: WorkSnapshot; render: Record<string, RenderCounters> } {
	const work: WorkSnapshot = { spans: {}, counts: {} };
	for (const run of runs) {
		for (const [name, span] of Object.entries(run.work.spans)) {
			const into = (work.spans[name] ??= { count: 0, totalMs: 0 });
			into.count += span.count;
			into.totalMs += span.totalMs;
		}
		for (const [name, value] of Object.entries(run.work.counts)) work.counts[name] = (work.counts[name] ?? 0) + value;
	}
	// Render counters are deterministic per open; the last run represents the row.
	return { work, render: runs[runs.length - 1]?.render ?? {} };
}

const sources: { readonly id: string; readonly source: Source; readonly workload: string; readonly limitations: string[] }[] = [
	...selectedTiers().map((tier) => ({
		id: tier,
		source: { method: 'new', tier } as const,
		workload: tierWorkloadLabel(tier),
		limitations: tierLimitations(tier)
	})),
	// A.6: the old method, F2 S/M only, on the same revision.
	...(['S', 'M'] as const)
		.filter((size) => selectedTiers().includes(`grid-${size}`))
		.map((size) => ({
			id: `old-${size}`,
			source: { method: 'old', size } as const,
			workload: `old method: grid-${size === 'S' ? 3 : 7} rebuilt through the planners in the run (A.6)`,
			limitations: tierLimitations(`grid-${size}`)
		}))
];

for (const entry of sources) {
	test.describe(`F2 project open — ${entry.id}`, () => {
		// Ten runs per cache state of a large tier's open: measured work, not a hang.
		test.setTimeout(7_200_000);
		test(`cold, warm and repeat-use ${entry.id}`, async ({ browser }, testInfo) => {
			const report = startReport(`f2-open-${entry.id}-${testInfo.project.name.replace(/\s+/g, '-')}`);
			if (entry.source.method === 'new') {
				const availability = tierAvailability(entry.source.tier);
				if (!availability.available) {
					report.rows.push(unrunRow(`F2-${entry.id}-unrun`, 'F2 project open', entry.workload, testInfo.project.name, availability.reason));
					fileReport(report);
					return;
				}
			}
			const limitations = [...passLimitations(), ...entry.limitations];
			for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
				const { results: runs, facts } = await collectMeasuredRuns(
					browser,
					{ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK },
					{
						cacheState,
						warmup: smokeOr(WARMUP_RUNS, 0),
						runs: smokeOr(RUNS),
						afterRun: cacheState === 'repeat-use' ? closeToHub : undefined
					},
					(session) => openOnce(session, entry.source)
				);
				const windows = mergeWindows(runs);
				const setupMs = runs.reduce((sum, run) => sum + run.setupMs, 0);
				const wallMs = runs.reduce((sum, run) => sum + run.wallMs, 0);
				const row: ResultRow = {
					id: `F2-${entry.id}-${cacheState}`,
					flow: entry.source.method === 'old' ? 'F2 project open (old method, A.6)' : 'F2 project open',
					workload: entry.workload,
					cacheState,
					network: NETWORK,
					browser: `${testInfo.project.name} ${facts.chromeVersion}`,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: {
						admissionMedian: summarize(runs.map((run) => run.admission)).median,
						admittedToFrameMedian: summarize(runs.map((run) => run.admittedToFrame)).median,
						totalMedian: summarize(runs.map((run) => run.total)).median,
						setupMs,
						wallMs,
						setupShare: wallMs > 0 ? setupMs / wallMs : null,
						...workMetrics(windows.work, runs.length),
						...renderMetrics(windows.render),
						...residentMetrics(runs[runs.length - 1]?.resident ?? null, 'open')
					},
					stats: {
						admission: summarize(runs.map((run) => run.admission)),
						total: summarize(runs.map((run) => run.total))
					},
					limitations: [
						...limitations,
						'F2 flow starts at the chosen file, not at the Open button (the dialog is not admission work)',
						'first architectural frame is attributed to the rAF rendering opportunity',
						'stage:* rows are per-run means of the work ledger inside the window; work:* are deterministic counts'
					]
				};
				report.rows.push(row);
				console.log(formatRow(row));
			}
			const path = fileReport(report);
			console.log(`raw results: ${path}`);
			expect(report.rows).toHaveLength(3);
		});
	});
}
