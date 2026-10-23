/**
 * CPU calibration (T3.P03.S02).
 *
 * A production-minified bundle of the grid-7 compile + Stage admission runs 20×
 * in Chrome. The **reference median is owner-run** on the designated reference
 * machine (Apple MacBook Air M2, 16 GB) and supplied as
 * `PERF_REFERENCE_CALIBRATION_MS`; without it this pass records only its own
 * pre-flight median and performs no throttling search. When it is supplied, the
 * CDP rate whose median lands within ±10 % is recorded; if none matches, the run
 * reports no calibrated equivalence and never extrapolates a pass. The rate is
 * per machine and browser major, so it is not a durable constant.
 */

import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, VIEWPORT, passLimitations } from '../lib/config';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

const CALIBRATION_RUNS = 20;
const THROTTLE_RUNS = 7;
const RATES = [1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4];

type CalibrationPageResult = {
	compileMs: number[];
	admissionMs: number[];
	totalMs: number[];
	walls: number;
	rooms: number;
};

async function calibrationBundle(): Promise<string> {
	const directory = mkdtempSync(join(tmpdir(), 'biskiq-calibration-'));
	const lib = resolve(dirname(new URL(import.meta.url).pathname), '../');
	const editorRoot = resolve(lib, '..');
	const result = await build({
		entryPoints: [resolve(editorRoot, 'perf/calibration/entry.ts')],
		bundle: true,
		write: false,
		minify: true,
		sourcemap: false,
		format: 'esm',
		target: 'chrome120',
		platform: 'browser',
		define: { 'process.env.NODE_ENV': '"production"' },
		alias: { $lib: resolve(editorRoot, 'src/lib') },
		outdir: directory
	});
	const output = result.outputFiles?.[0];
	if (output === undefined) throw new Error('calibration bundle produced no output');
	return output.text;
}

async function runCalibration(
	page: import('@playwright/test').Page,
	runs = CALIBRATION_RUNS
): Promise<CalibrationPageResult> {
	return page.evaluate(
		(count) => {
			const calibration = (window as Window & { __biskiqCalibration?: (runs: number) => Promise<CalibrationPageResult> })
				.__biskiqCalibration;
			if (calibration === undefined) throw new Error('calibration entry did not install');
			return calibration(count);
		},
		runs
	);
}

test.describe('CPU calibration', () => {
	test('grid-7 compile + Stage admission', async ({ browser }, testInfo) => {
		const bundle = await calibrationBundle();
		const report = startReport(`calibration-${testInfo.project.name.replace(/\s+/g, '-')}`);
		const session = await newMeasuredSession(browser, {
			viewport: VIEWPORT,
			deviceScaleFactor: DEVICE_SCALE_FACTOR,
			network: 'N0',
			cacheState: 'cold'
		});
		try {
			// A real localhost document, not about:blank: the admission path computes
			// the content digest with WebCrypto, which exists only in a secure context.
			await session.page.goto('/');
			await session.page.addScriptTag({ content: bundle, type: 'module' });
			const baseline = await runCalibration(session.page);
			const reference = Number(process.env.PERF_REFERENCE_CALIBRATION_MS);
			const hasReference = Number.isFinite(reference) && reference > 0;
			const search: { rate: number; median: number; within: boolean }[] = [];
			let selected: number | null = null;
			if (hasReference) {
				for (const rate of RATES) {
					await session.cdp.send('Emulation.setCPUThrottlingRate', { rate });
					const result = await runCalibration(session.page, THROTTLE_RUNS);
					const median = summarize(result.totalMs).median;
					const within = Math.abs(median - reference) / reference <= 0.1;
					search.push({ rate, median, within });
					if (within && selected === null) selected = rate;
				}
				await session.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
			}
			const total = summarize(baseline.totalMs);
			const row: ResultRow = {
				id: 'calibration-grid7',
				flow: 'CPU calibration',
				workload: `grid-7 ${baseline.walls} walls / ${baseline.rooms} rooms, ${CALIBRATION_RUNS} runs`,
				cacheState: 'cold',
				network: 'N0',
				browser: testInfo.project.name,
				cpuRate: 1,
				viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
				metrics: {
					compileMedian: summarize(baseline.compileMs).median,
					admissionMedian: summarize(baseline.admissionMs).median,
					totalMedian: total.median,
					referenceMedian: hasReference ? reference : 'owner-run (not supplied to this pass)',
					selectedThrottleRate: selected ?? 'none — no calibrated equivalence',
					throttleSearch: search.map((entry) => `${entry.rate}x:${entry.median.toFixed(1)}${entry.within ? '*' : ''}`).join(' '),
					searchRunsPerRate: THROTTLE_RUNS
				},
				stats: { total: total },
				limitations: [
					...passLimitations(),
					'hard rows are accepted only from the owner-operated reference pass (MacBook Air M2); this pre-flight pass is not that evidence',
					hasReference
						? 'throttling search compares this bundle’s median against the supplied reference median'
						: 'no reference median supplied: no rate is claimed and no pass is extrapolated'
				]
			};
			report.rows.push(row);
			console.log(formatRow(row));
			const path = fileReport(report);
			console.log(`raw results: ${path}`);
			expect(baseline.totalMs).toHaveLength(CALIBRATION_RUNS);
			if (hasReference) expect(search).toHaveLength(RATES.length);
		} finally {
			await session.close();
		}
	});
});
