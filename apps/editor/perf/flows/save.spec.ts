/**
 * F9 — Save (T3.P03.S02 harness).
 *
 * Save click → local feedback presented → durable receipt → idle, through the
 * API's test-auth seam on a local stack (never production). Requires:
 *
 *   PERF_API_ORIGIN       e.g. http://127.0.0.1:8791 (also exported as
 *                         PUBLIC_API_ORIGIN for the preview build)
 *   E2E_TEST_AUTH_SECRET  the local-only seam secret
 *   EDITOR_ORIGIN         the preview origin the API accepts
 *
 * Without those, the spec skips with its reason: the flow is not faked against
 * production and is listed as owner-run in the acceptance record. Cold creates a
 * fresh context per run and installs the session cookie in each one; warm and
 * repeat-use reuse a context, with repeat-use closing to the hub between saves.
 * F9's hard rows (main-thread work, local feedback ≤ 100 ms) are accepted only
 * from the designated reference machine.
 */

import { expect, test } from '@playwright/test';

import { loginAs, TEST_AUTH_SESSION_COOKIE } from '../../tests/e2e/test-auth';
import { collectMeasuredRuns, newMeasuredSession, type MeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, RUNS, VIEWPORT, WARMUP_RUNS, passLimitations } from '../lib/config';
import { fixtureProject } from '../lib/fixtures';
import {
	acceptedResultCount,
	closeToHub,
	commitPrecisionLength,
	gotoCreateIntent,
	openSourceJson,
	selectFirstWall,
	uniqueProjectId,
	waitForAcceptedResult
} from '../lib/flow';
import { readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

const apiOrigin = process.env.PERF_API_ORIGIN;
const secret = process.env.E2E_TEST_AUTH_SECRET;

type SaveRun = {
	readonly commandToSavingLabelDomUpdate: number | null;
	readonly commandToRequest: number;
	readonly requestToReceipt: number;
	readonly commandToSavedLabelDomUpdate: number | null;
	readonly wireBytes: number;
};

type SaveDelayOptions = {
	/** Delay before the Save command, which must not enter request-to-receipt. */
	readonly beforeCommandMs?: number;
	/** Delay delivery of a successful local API response to the browser. */
	readonly successfulReceiptMs?: number;
};

function isLoopbackOrigin(origin: string | undefined): boolean {
	if (origin === undefined) return false;
	try {
		const hostname = new URL(origin).hostname;
		return (
			hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
		);
	} catch {
		return false;
	}
}

function requireCompleteSamples(
	label: string,
	values: readonly (number | null)[],
	expectedCount: number
): number[] {
	const samples = values.filter((value): value is number => value !== null);
	expect(samples, `${label} must be measured for every run`).toHaveLength(expectedCount);
	return samples;
}

async function saveOnce(session: MeasuredSession, origin: string, delays: SaveDelayOptions = {}): Promise<SaveRun> {
	const { page } = session;
	const projectId = uniqueProjectId('f9');
	const project = await fixtureProject('S', projectId);
	await gotoCreateIntent(page, projectId);
	await openSourceJson(page, project);
	await selectFirstWall(page);
	const beforeEdit = await acceptedResultCount(page);
	await commitPrecisionLength(page, 4.5);
	await waitForAcceptedResult(page, beforeEdit);

	// Record Head status-attribute DOM updates with in-page timestamps. They do
	// not identify paint or presentation; a polling wait would be coarser still.
	await page.evaluate(() => {
		const target = document.querySelector('[data-head-save]');
		const target_ = window as Window & { __BISKIQ_SAVE_TRANSITIONS__?: { status: string | null; time: number }[] };
		target_.__BISKIQ_SAVE_TRANSITIONS__ = [];
		if (target === null) return;
		const record = () =>
			target_.__BISKIQ_SAVE_TRANSITIONS__!.push({
				status: target.getAttribute('data-save-status'),
				time: performance.now()
			});
		new MutationObserver(record).observe(target, { attributes: true, attributeFilter: ['data-save-status'] });
		record();
	});

	const recordStart = await page.evaluate(
		() => (window as Window & { __BISKIQ_PERF_RECORDS__?: { name: string }[] }).__BISKIQ_PERF_RECORDS__?.length ?? 0
	);
	const requestUrl = `${origin}/projects/${projectId}`;
	if ((delays.successfulReceiptMs ?? 0) > 0) {
		const delayMs = delays.successfulReceiptMs!;
		await page.route(requestUrl, async (route) => {
			if (route.request().method() !== 'PUT') return route.continue();
			const upstream = await route.fetch();
			if (upstream.ok()) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
			await route.fulfill({ response: upstream });
		});
	}
	if ((delays.beforeCommandMs ?? 0) > 0) await page.waitForTimeout(delays.beforeCommandMs!);
	const receipt = page.waitForResponse(
		(response) => response.url() === requestUrl && response.request().method() === 'PUT',
		{ timeout: 60_000 }
	);
	await page.locator('[data-head-save] button').first().click();
	await page.waitForFunction(
		() => document.querySelector('[data-head-save]')?.getAttribute('data-save-status') === 'saved',
		undefined,
		{ timeout: 60_000 }
	);
	const response = await receipt;
	expect(response.ok()).toBe(true);
	if ((delays.successfulReceiptMs ?? 0) > 0) await page.unroute(requestUrl);
	const transitions = await page.evaluate(
		() =>
			(window as Window & { __BISKIQ_SAVE_TRANSITIONS__?: { status: string | null; time: number }[] })
				.__BISKIQ_SAVE_TRANSITIONS__ ?? []
	);
	const savingDomUpdate = transitions.find((entry) => entry.status === 'saving');
	const savedDomUpdate = transitions.find((entry) => entry.status === 'saved');
	const ledger = await readLedger(page);
	const saveRecords = ledger.records.slice(recordStart);
	const command = saveRecords.find((record) => record.kind === 'mark' && record.name === 'save:command');
	const request = saveRecords.find((record) => record.kind === 'mark' && record.name === 'save:request');
	// Both times come from product marks on this page's monotonic clock. The
	// Playwright response verifies HTTP success/request identity and supplies bytes.
	const requestBody = response.request().postData();
	if (requestBody === null) throw new Error('The successful Save request has no body');
	const operationId = (JSON.parse(requestBody) as { capture?: { operationId?: unknown } }).capture?.operationId;
	if (typeof operationId !== 'string') throw new Error('The successful Save request has no operation ID');
	const saveReceipt = saveRecords.find(
		(record) =>
			record.kind === 'mark' &&
			record.name === 'save:receipt' &&
			record.detail?.projectId === projectId &&
			record.detail?.operationId === operationId
	);
	if (command === undefined || request === undefined || saveReceipt === undefined) {
		throw new Error('The Save command, HTTP request, or matching successful receipt mark is missing');
	}
	return {
		commandToSavingLabelDomUpdate: savingDomUpdate === undefined ? null : savingDomUpdate.time - command.time,
		commandToRequest: request.time - command.time,
		requestToReceipt: saveReceipt.time - request.time,
		commandToSavedLabelDomUpdate: savedDomUpdate === undefined ? null : savedDomUpdate.time - command.time,
		wireBytes: Number(response.request().postDataBuffer()?.byteLength ?? 0)
	};
}

test.describe('F9 Save', () => {
	test.setTimeout(900_000);
	test.skip(apiOrigin === undefined || secret === undefined, 'requires PERF_API_ORIGIN + E2E_TEST_AUTH_SECRET (local stack only)');
	test.skip(
		apiOrigin !== undefined && !isLoopbackOrigin(apiOrigin),
		'PERF_API_ORIGIN must be a loopback local API; production is never used'
	);
	test('save against the local test-auth stack, cold, warm and repeat-use', async ({ browser, baseURL }, testInfo) => {
		test.skip(
			!isLoopbackOrigin(baseURL),
			'PERF_BASE_URL must be a loopback local preview; production is never used'
		);
		const origin = apiOrigin!;
		const report = startReport(`f9-save-${testInfo.project.name.replace(/\s+/g, '-')}`);
		const login = await loginAs({
			user: 'agent-admin',
			apiOrigin: origin,
			secret: secret!,
			origin: baseURL
		});
		const pair = login.cookie;
		const equals = pair.indexOf('=');
		const name = pair.slice(0, equals);
		const value = pair.slice(equals + 1);
		expect(name).toBe(TEST_AUTH_SESSION_COOKIE);
		const cookie = {
			name,
			value,
			domain: new URL(baseURL!).hostname,
			path: '/',
			httpOnly: true,
			secure: false
		};

		for (const cacheState of ['cold', 'warm', 'repeat-use'] as const) {
			const { results: runs, facts } = await collectMeasuredRuns(
				browser,
				{ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK },
				{
					cacheState,
					warmup: WARMUP_RUNS,
					runs: RUNS,
					prepare: async (session) => session.context.addCookies([cookie]),
					afterRun: cacheState === 'repeat-use' ? closeToHub : undefined
				},
				(session) => saveOnce(session, origin)
			);
			expect(runs, `${cacheState} measured run count`).toHaveLength(RUNS);
			const savingLabelDomUpdate = requireCompleteSamples(
				'saving-label DOM update',
				runs.map((run) => run.commandToSavingLabelDomUpdate),
				runs.length
			);
			const durableReceipt = requireCompleteSamples(
				'durable receipt',
				runs.map((run) => run.requestToReceipt),
				runs.length
			);
			const savedLabelDomUpdate = requireCompleteSamples(
				'saved-label DOM update',
				runs.map((run) => run.commandToSavedLabelDomUpdate),
				runs.length
			);
			const row: ResultRow = {
				id: `F9-save-local-${cacheState}`,
				flow: 'F9 Save',
				workload: 'S fixture, one typed edit, Save to the local test-auth stack',
				cacheState,
				network: NETWORK,
				browser: `${testInfo.project.name} ${facts.chromeVersion}`,
				cpuRate: 1,
				viewport: `${VIEWPORT.width}x${VIEWPORT.height}@${DEVICE_SCALE_FACTOR}`,
				metrics: {
					wireBytesMedian: summarize(runs.map((run) => run.wireBytes)).median,
					runs: runs.length
				},
				stats: {
					savingLabelDomUpdate: summarize(savingLabelDomUpdate),
					durableReceipt: summarize(durableReceipt),
					savedLabelDomUpdate: summarize(savedLabelDomUpdate)
				},
				limitations: [
					...passLimitations(),
					'save-status DOM updates are not paint/presentation timestamps and cannot establish the contract\'s presented-local-feedback gate',
					'local loopback test API under the configured CDP network profile; no production-service baseline and the durable-receipt target formula is not accepted here',
					'main-thread work during Save is not split out by this pass'
				]
			};
			report.rows.push(row);
			console.log(formatRow(row));
		}
		const path = fileReport(report);
		console.log(`raw results: ${path}`);
		expect(report.rows).toHaveLength(3);
	});

	test('receipt latency excludes pre-Save delay and includes delayed local receipt', async ({ browser, baseURL }) => {
		test.skip(
			!isLoopbackOrigin(baseURL),
			'PERF_BASE_URL must be a loopback local preview; production is never used'
		);
		const origin = apiOrigin!;
		const login = await loginAs({
			user: 'agent-admin',
			apiOrigin: origin,
			secret: secret!,
			origin: baseURL
		});
		const pair = login.cookie;
		const equals = pair.indexOf('=');
		const name = pair.slice(0, equals);
		const value = pair.slice(equals + 1);
		expect(name).toBe(TEST_AUTH_SESSION_COOKIE);
		const cookie = {
			name,
			value,
			domain: new URL(baseURL!).hostname,
			path: '/',
			httpOnly: true,
			secure: false
		};

		const session = await newMeasuredSession(browser, {
			viewport: VIEWPORT,
			deviceScaleFactor: DEVICE_SCALE_FACTOR,
			network: 'N0',
			cacheState: 'warm'
		});
		try {
			await session.context.addCookies([cookie]);
			const baseline = await saveOnce(session, origin);
			await closeToHub(session.page);

			const preSaveDelayMs = 2_000;
			const withPreSaveDelay = await saveOnce(session, origin, { beforeCommandMs: preSaveDelayMs });
			await closeToHub(session.page);

			const receiptDelayMs = 600;
			const withDelayedReceipt = await saveOnce(session, origin, { successfulReceiptMs: receiptDelayMs });
			expect(Math.abs(withPreSaveDelay.requestToReceipt - baseline.requestToReceipt)).toBeLessThan(
				preSaveDelayMs / 2
			);
			expect(withDelayedReceipt.requestToReceipt - baseline.requestToReceipt).toBeGreaterThan(receiptDelayMs / 2);
		} finally {
			await session.close();
		}
	});
});
