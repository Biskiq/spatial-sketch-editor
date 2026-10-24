/**
 * F10 — capture/bind and Preview entry (S and M fixtures).
 * F13 (Preview) — repeated Preview enter/exit in **one application lifetime**.
 *
 * Both flows drive the shipped creator loop through its real UI: starter gallery
 * → Experience lens → dock Capture → Head Preview → Exit. No test-only route,
 * adapter or build injection is reached.
 *
 * F10 records, per capture: the accepted capture/bind result and the entry time
 * into the isolated Preview run, from product marks
 * (`experience:capture-accepted` → `preview:entered`). Guide-free entry is the
 * row measured here; Guide entry shares the same handover.
 *
 * F13 does not infer cleanup from a document reload: the realm must survive every
 * cycle (`performance.timeOrigin`), exactly one visitor surface may survive each
 * return (hidden and inert — a warm Preview, not a leak), and post-GC heap is
 * reported per cycle. The visitor chunk and its scene are built once and reused,
 * which is the repeat-use condition the phase requires for an instant entry.
 *
 * Hard rows are accepted only from the designated reference machine (owner's
 * MacBook Air M2, 16 GB, owner-operated). Any other run is pre-flight.
 */
import { expect, test, type Page } from '@playwright/test';

import { collectMeasuredRuns, heapUsedMiB, newMeasuredSession, type MeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, RUNS, VIEWPORT, WARMUP_RUNS, passLimitations } from '../lib/config';
import { fixtureProject, type FixtureSize } from '../lib/fixtures';
import { uniqueProjectId, closeToHub, gotoCreateIntent, openSourceJson, waitForMark } from '../lib/flow';
import { clearObservations, readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

const EXPERIENCE_LENS = { name: 'Experience', exact: true } as const;
const CAPTURE_KEY = { name: 'Capture', exact: true } as const;
const HEAD_PREVIEW = '[data-head-preview] button';
const VISITOR_CANVAS = '[aria-label="Visitor preview canvas"]';

/**
 * The `size` workload is seeded from its fixture (`fixtureProject`), opened through
 * the shipped source-JSON path, then the Experience lens. A `size` never selects a
 * starter scene: the starter enclosure is a different workload.
 */
async function startExperienceProject(page: Page, size: FixtureSize): Promise<void> {
	const projectId = uniqueProjectId(`f10-${size}`);
	const project = await fixtureProject(size, projectId);
	await gotoCreateIntent(page, projectId);
	await openSourceJson(page, project);
	await page.getByRole('button', EXPERIENCE_LENS).click();
	await page.getByRole('button', { name: 'Create Experience' }).click();
	// The captured View must record the perspective the creator actually sees.
	await expect(page.locator('[aria-label="Experience authoring"]')).toBeVisible();
	await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function captureOnce(page: Page): Promise<void> {
	await page.getByRole('button', CAPTURE_KEY).click();
	await waitForMark(page, 'experience:capture-accepted');
}

async function enterPreview(page: Page): Promise<number> {
	await page.locator(HEAD_PREVIEW).click();
	const press = await waitForMark(page, 'preview:press');
	await waitForMark(page, 'preview:entered');
	await expect(page.locator(VISITOR_CANVAS)).toBeVisible();
	return press.time;
}

async function exitPreview(page: Page): Promise<void> {
	await page.getByRole('button', { name: /Exit Preview/ }).click();
	await waitForMark(page, 'preview:returned');
	// The surface is kept warm for the next entry: hidden and inert, not rebuilt.
	await expect(page.locator(VISITOR_CANVAS)).toBeHidden();
}

type CaptureRun = { readonly captureToEntered: number; readonly pressToFrame: number };

async function captureAndEnterOnce(session: MeasuredSession, size: FixtureSize): Promise<CaptureRun> {
	const { page } = session;
	await startExperienceProject(page, size);
	await captureOnce(page);
	const capture = await waitForMark(page, 'experience:capture-accepted');
	const press = await enterPreview(page);
	const entered = await waitForMark(page, 'preview:entered');
	const frame = await waitForMark(page, 'visitor:entry-frame');
	await exitPreview(page);
	return {
		captureToEntered: entered.time - capture.time,
		pressToFrame: frame.time - press
	};
}

for (const size of ['S', 'M'] as const) {
	test.describe(`F10 capture and Preview entry — ${size}`, () => {
		test(`cold, warm and repeat-use ${size} fixture`, async ({ browser }, testInfo) => {
			test.setTimeout(600_000);
			const report = startReport(`f10-capture-preview-${size}-${testInfo.project.name.replace(/\s+/g, '-')}`);
			const limitations = passLimitations();
			for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
				const { results: runs, facts } = await collectMeasuredRuns(
					browser,
					{ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK },
					{
						cacheState,
						warmup: WARMUP_RUNS,
						runs: RUNS,
						afterRun: cacheState === 'repeat-use' ? closeToHub : undefined
					},
					(session) => captureAndEnterOnce(session, size)
				);
				const row: ResultRow = {
					id: `F10-${size}-${cacheState}`,
					flow: 'F10 capture/bind and Guide-free Preview entry',
					workload: `${size} fixture (perf/lib/fixtures.ts), one captured View and Presentation, Preview entered and returned`,
					cacheState,
					network: NETWORK,
					browser: `${testInfo.project.name} ${facts.chromeVersion}`,
					cpuRate: 1,
					viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
					metrics: {
						captureToEnteredMedian: summarize(runs.map((run) => run.captureToEntered)).median,
						pressToFrameMedian: summarize(runs.map((run) => run.pressToFrame)).median
					},
					stats: {
						captureToEntered: summarize(runs.map((run) => run.captureToEntered)),
						pressToFrame: summarize(runs.map((run) => run.pressToFrame))
					},
					limitations: [
						...limitations,
						'press-to-frame ends at the first rendering opportunity after the run starts, not a traced image',
						'Guide-free entry only; a Guide entry shares the same handover path',
						'the hidden Preview scene is warmed when the Experience lens opens, so cold measures the first press in a fresh context'
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

test('F13 repeated Preview enter/exit in one application lifetime', async ({ browser }, testInfo) => {
	test.setTimeout(900_000);
	const session = await newMeasuredSession(browser, {
		viewport: VIEWPORT,
		deviceScaleFactor: DEVICE_SCALE_FACTOR,
		network: NETWORK,
		cacheState: 'repeat-use'
	});
	const errors: string[] = [];
	session.page.on('pageerror', (error) => errors.push(error.message));
	session.page.on('console', (message) => {
		if (/THREE\.WebGLProgram|Shader Error/.test(message.text())) errors.push(message.text());
	});
	const report = startReport(`f13-preview-lifecycle-${testInfo.project.name.replace(/\s+/g, '-')}`);
	try {
		const { page, cdp } = session;
		await startExperienceProject(page, 'S');
		await captureOnce(page);
		const lifetime = await page.evaluate(() => performance.timeOrigin);

		// One discarded warm-up cycle: the visitor chunk and its renderer load once.
		await enterPreview(page);
		await exitPreview(page);

		await clearObservations(page);
		const entryHeap = await heapUsedMiB(cdp);
		const cycles = RUNS;
		const heaps: number[] = [];
		const cycleTimes: number[] = [];
		let lastReturn = 0;
		let lastEpoch = 0;
		for (let cycle = 0; cycle < cycles; cycle += 1) {
			await enterPreview(page);
			await exitPreview(page);
			// Warm reuse, not accumulation: exactly one visitor surface survives
			// every cycle, and it is hidden while the Stage is authoring.
			await expect(page.locator(VISITOR_CANVAS)).toHaveCount(1);
			const after = await readLedger(page);
			const entered = [...after.records].reverse().find((record) => record.name === 'preview:entered');
			const returned = [...after.records].reverse().find((record) => record.name === 'preview:returned');
			if (entered === undefined || returned === undefined) throw new Error('Preview lifecycle marks are missing');
			// Every cycle enters after the previous return, under a strictly newer run
			// epoch: neither a completion nor an ownership epoch is reused.
			expect(entered.time).toBeGreaterThan(lastReturn);
			expect(returned.time).toBeGreaterThan(entered.time);
			const runEpoch = Number(entered.detail?.runEpoch ?? 0);
			expect(runEpoch).toBeGreaterThan(lastEpoch);
			lastReturn = returned.time;
			lastEpoch = runEpoch;
			cycleTimes.push(returned.time - entered.time);
			// The application realm and the Stage survive; the one isolated surface is
			// kept warm (hidden) rather than disposed and rebuilt.
			expect(await page.evaluate(() => performance.timeOrigin)).toBe(lifetime);
			expect(await page.locator('[aria-label="Spatial stage"]').count()).toBe(1);
			heaps.push(await heapUsedMiB(cdp));
		}
		const growth = heaps.at(-1)! - entryHeap;
		const row: ResultRow = {
			id: 'F13-preview-repeat-use',
			flow: 'F13 repeated Preview enter/exit',
			workload: `${cycles} enter/exit cycles in one application lifetime, one captured Presentation, S fixture`,
			cacheState: 'repeat-use',
			network: NETWORK,
			browser: `${testInfo.project.name} ${await page.evaluate(() => navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? 'unknown')}`,
			cpuRate: 1,
			viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
			metrics: {
				entryHeapMiB: entryHeap,
				finalHeapMiB: heaps.at(-1)!,
				postGcGrowthMiB: growth,
				previewDwellMedianMs: summarize(cycleTimes).median
			},
			stats: { previewDwell: summarize(cycleTimes) },
			limitations: [
				...passLimitations(),
				'heap after forced GC; renderer/GPU resources are not directly observable here',
				'the visitor chunk loads once (repeat-use), which is the phase condition, not a cold first entry'
			]
		};
		report.rows.push(row);
		console.log(formatRow(row));
		expect(errors).toEqual([]);
		// A reload would destroy the realm the phase forbids inferring from.
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(lifetime);
		const path = fileReport(report);
		console.log(`raw results: ${path}`);
	} finally {
		await session.close();
	}
});
