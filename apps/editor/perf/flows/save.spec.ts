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
 * production and is listed as owner-run in the acceptance record. F9's hard
 * rows (main-thread work, local feedback ≤ 100 ms) are accepted only from the
 * designated reference machine.
 */

import { expect, test } from '@playwright/test';

import { loginAs, TEST_AUTH_SESSION_COOKIE } from '../../tests/e2e/test-auth';
import { browserFacts, clearBrowserState, newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, RUNS, VIEWPORT, WARMUP_RUNS, passLimitations } from '../lib/config';
import { fixtureProject } from '../lib/fixtures';
import {
	acceptedResultCount,
	closeToHub,
	commitPrecisionLength,
	gotoCreateIntent,
	openSourceJson,
	selectFirstWallAndOpenDimensions,
	uniqueProjectId,
	waitForAcceptedResult
} from '../lib/flow';
import { readLedger } from '../lib/ledger';
import { fileReport, formatRow, startReport, type ResultRow } from '../lib/report';
import { summarize } from '../lib/stats';

const apiOrigin = process.env.PERF_API_ORIGIN;
const secret = process.env.E2E_TEST_AUTH_SECRET;

type SaveRun = {
	readonly submitToSavingLabel: number | null;
	readonly submitToReceipt: number | null;
	readonly submitToSavedLabel: number | null;
	readonly wireBytes: number;
};

async function saveOnce(
	session: Awaited<ReturnType<typeof newMeasuredSession>>,
	origin: string
): Promise<SaveRun> {
	const { page } = session;
	const projectId = uniqueProjectId('f9');
	const project = await fixtureProject('S', projectId);
	await gotoCreateIntent(page, projectId);
	await openSourceJson(page, project);
	await selectFirstWallAndOpenDimensions(page);
	const beforeEdit = await acceptedResultCount(page);
	await commitPrecisionLength(page, 4.5);
	await waitForAcceptedResult(page, beforeEdit);

	// Record the Head's own status transitions with in-page timestamps; a polling
	// wait would be coarser than the ≤ 100 ms local-feedback row.
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

	const submitMark = await page.evaluate(() => performance.now());
	const receipt = page.waitForResponse(
		(response) => response.url() === `${origin}/projects/${projectId}` && response.request().method() === 'PUT',
		{ timeout: 60_000 }
	);
	await page.locator('[data-head-save] button').first().click();
	await page.waitForFunction(
		() => document.querySelector('[data-head-save]')?.getAttribute('data-save-status') === 'saved',
		undefined,
		{ timeout: 60_000 }
	);
	const response = await receipt;
	const receiptAt = await page.evaluate(() => performance.now());
	const transitions = await page.evaluate(
		() =>
			(window as Window & { __BISKIQ_SAVE_TRANSITIONS__?: { status: string | null; time: number }[] })
				.__BISKIQ_SAVE_TRANSITIONS__ ?? []
	);
	const saving = transitions.find((entry) => entry.status === 'saving');
	const saved = transitions.find((entry) => entry.status === 'saved');
	const ledger = await readLedger(page);
	const submit = [...ledger.records].reverse().find((record) => record.name === 'save:submit');
	const submitTime = submit?.time ?? submitMark;
	return {
		submitToSavingLabel: saving === undefined ? null : saving.time - submitTime,
		submitToReceipt: receiptAt,
		submitToSavedLabel: saved === undefined ? null : saved.time - submitTime,
		wireBytes: Number(response.request().postData()?.length ?? 0)
	};
}

test.describe('F9 Save', () => {
	test.setTimeout(900_000);
	test.skip(apiOrigin === undefined || secret === undefined, 'requires PERF_API_ORIGIN + E2E_TEST_AUTH_SECRET (local stack only)');
	test('save against the local test-auth stack, cold, warm and repeat-use', async ({ browser, baseURL }, testInfo) => {
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
			const session = await newMeasuredSession(browser, {
				viewport: VIEWPORT,
				deviceScaleFactor: DEVICE_SCALE_FACTOR,
				network: NETWORK,
				cacheState
			});
			try {
				if (cacheState === 'cold') await clearBrowserState(session.cdp);
				await session.context.addCookies([cookie]);
				const facts = await browserFacts(browser, session.page);
				for (let index = 0; index < WARMUP_RUNS; index++) {
					if (cacheState === 'cold') {
						await clearBrowserState(session.cdp);
						await session.context.addCookies([cookie]);
					}
					await saveOnce(session, origin);
					if (cacheState === 'repeat-use') await closeToHub(session.page);
				}
				const runs: SaveRun[] = [];
				for (let index = 0; index < RUNS; index++) {
					if (cacheState === 'cold') {
						await clearBrowserState(session.cdp);
						await session.context.addCookies([cookie]);
					}
					runs.push(await saveOnce(session, origin));
					if (cacheState === 'repeat-use') await closeToHub(session.page);
				}
				const feedback = runs
					.map((run) => run.submitToSavingLabel)
					.filter((value): value is number => value !== null);
				const receipt = runs
					.map((run) => run.submitToReceipt)
					.filter((value): value is number => value !== null);
				const saved = runs
					.map((run) => run.submitToSavedLabel)
					.filter((value): value is number => value !== null);
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
						localFeedback: summarize(feedback),
						durableReceipt: summarize(receipt),
						savedLabel: summarize(saved)
					},
					limitations: [
						...passLimitations(),
						'loopback unthrottled transport: the durable-receipt target formula is not evaluated here',
						'main-thread work during Save is not split out by this pass'
					]
				};
				report.rows.push(row);
				console.log(formatRow(row));
				expect(feedback.length).toBeGreaterThan(0);
			} finally {
				await session.close();
			}
		}
		const path = fileReport(report);
		console.log(`raw results: ${path}`);
		expect(report.rows).toHaveLength(3);
	});
});
