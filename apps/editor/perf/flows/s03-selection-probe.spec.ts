/**
 * T2.P02.S03 — probe: which placement path leaves its new entity selected?
 *
 * This is **not** a gate row and not a lane. It exists to scope the acceptance
 * record's blocking finding, because the shipped adapter intends every placement
 * completion to make the new entity the canonical selection and the creator
 * journey contradicts that for the only path an imported model has.
 *
 * Leg A (the positive control) commits a native `box` through the instrument's
 * typed X/Z Place. That is the one path a creator has besides a floor click, and
 * it is asserted: the subject becomes the Scene entity and Compose can act on it.
 *
 * Leg B commits the same primitive with a floor click — the only path an imported
 * model has — and records the subject as it settles. It asserts nothing, because
 * the outcome is the finding under owner decision: asserting today's silence
 * would make a future fix fail this probe.
 *
 * Run it through the same supervisor as the gate:
 *   S03_QA_SPEC=perf/flows/s03-selection-probe.spec.ts
 *     npx vite-node --script perf/run-s03-own-model-qa.mjs
 */
import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loginAs, TEST_AUTH_SESSION_COOKIE } from '../../tests/e2e/test-auth';
import { newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, VIEWPORT } from '../lib/config';
import { acceptedResultCount, gotoCreateIntent, startStarterGallery, uniqueProjectId } from '../lib/flow';

const apiOrigin = process.env.PERF_API_ORIGIN;
const secret = process.env.E2E_TEST_AUTH_SECRET;
const editorOrigin = process.env.PERF_BASE_URL;
const resultsDir = process.env.PERF_RESULTS_DIR ?? '.perf-results';
const INSTRUMENT = '.scene-instrument';
const CARD = '[aria-label="Selected subject"]';

async function subject(page: Page): Promise<string> {
	const card = page.locator(CARD);
	if ((await card.count()) === 0) return '(no card)';
	const text = (await card.first().innerText().catch(() => '(unreadable)')).replace(/\s+/g, ' ').trim();
	return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

async function signedIn(browser: Parameters<typeof newMeasuredSession>[0]) {
	const login = await loginAs({ user: 'agent-admin', apiOrigin: apiOrigin!, secret: secret!, origin: editorOrigin! });
	const equals = login.cookie.indexOf('=');
	expect(login.cookie.slice(0, equals)).toBe(TEST_AUTH_SESSION_COOKIE);
	const session = await newMeasuredSession(browser, {
		viewport: VIEWPORT,
		deviceScaleFactor: DEVICE_SCALE_FACTOR,
		network: NETWORK,
		cacheState: 'cold'
	});
	await session.context.addCookies([
		{
			name: login.cookie.slice(0, equals),
			value: login.cookie.slice(equals + 1),
			domain: new URL(editorOrigin!).hostname,
			path: '/',
			httpOnly: true,
			secure: false
		}
	]);
	return session;
}

/** A starter project with a Cloud base, so Save and the import path are live. */
async function savedStarter(page: Page, projectId: string): Promise<void> {
	await gotoCreateIntent(page, projectId);
	await startStarterGallery(page);
	await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120_000 });
	const save = page.locator('[data-head-save] button').first();
	if ((await page.locator('[data-head-save]').getAttribute('data-save-status')) !== 'saved') {
		await expect(save).toBeEnabled();
		await save.click();
		await expect(page.locator('[data-head-save]')).toHaveAttribute('data-save-status', 'saved', { timeout: 60_000 });
	}
}

async function placeTask(page: Page): Promise<void> {
	await page.locator('.contributed-item button.item-row', { hasText: 'Place object' }).first().click();
	await expect(page.locator(INSTRUMENT)).toBeVisible({ timeout: 120_000 });
}

test('the typed and pointer placement paths, and which one keeps its selection', async ({ browser }) => {
	test.skip(!editorOrigin || !apiOrigin || !secret, 'requires perf/run-s03-own-model-qa.mjs');
	const session = await signedIn(browser);
	const { page } = session;
	const evidence: Record<string, unknown> = { typed: {}, pointer: {} };
	const typed: Record<string, unknown> = evidence.typed as Record<string, unknown>;
	const pointer: Record<string, unknown> = evidence.pointer as Record<string, unknown>;

	// --- Leg A: typed placement (the positive control) ---------------------
	await savedStarter(page, uniqueProjectId('s03probeTyped'));
	await placeTask(page);
	const beforeTyped = await acceptedResultCount(page);
	await page.locator(`${INSTRUMENT} input[inputmode="decimal"]`).nth(0).fill('1.5');
	await page.locator(`${INSTRUMENT} input[inputmode="decimal"]`).nth(1).fill('-1');
	await page.locator(`${INSTRUMENT} button`, { hasText: 'Place' }).last().click();
	await expect.poll(() => acceptedResultCount(page), { timeout: 60_000 }).toBeGreaterThan(beforeTyped);
	typed.subject = await subject(page);
	typed.accepted = true;
	// The one assertion: the typed completion is the working reference, so Compose
	// must be able to act on what it selected.
	await page.locator('.contributed-item button.item-row', { hasText: 'Resize' }).first().click();
	await expect(page.locator(INSTRUMENT)).toBeVisible({ timeout: 60_000 });
	typed.composeText = (await page.locator(INSTRUMENT).innerText()).replace(/\s+/g, ' ');
	typed.resizeDisabled = await page.locator(`${INSTRUMENT} button`, { hasText: 'Resize…' }).first().isDisabled();
	expect(typed.subject, 'a typed placement selects its new entity').toMatch(/^ENTITY · SCENE/);
	expect(typed.resizeDisabled, 'Compose can resize the entity a typed placement selected').toBe(false);
	await page.keyboard.press('Escape');

	// --- Leg B: pointer placement (the only path an imported model has) ----
	await savedStarter(page, uniqueProjectId('s03probePointer'));
	await placeTask(page);
	const beforePointer = await acceptedResultCount(page);
	const box = await page.locator('canvas').first().boundingBox();
	if (box === null) throw new Error('the Stage has no canvas box');
	await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.52);
	await expect.poll(() => acceptedResultCount(page), { timeout: 60_000 }).toBeGreaterThan(beforePointer);
	pointer.accepted = true;
	const samples: string[] = [];
	for (const delay of [0, 200, 1_000, 3_000]) {
		if (delay > 0) await page.waitForTimeout(delay);
		samples.push(`${delay}ms: ${await subject(page)}`);
	}
	pointer.subjectSamples = samples;
	pointer.instrumentText = (await page.locator(INSTRUMENT).innerText().catch(() => '')).replace(/\s+/g, ' ');

	await writeFile(resolve(resultsDir, 's03-selection-probe.json'), JSON.stringify(evidence, null, 2));
	await session.context.close();
});
