/**
 * T2.P02.S03 — diagnostics, not acceptance rows.
 *
 * The gate's required journey lives in `s03-own-model-acceptance.spec.ts` and
 * asserts only behaviour the product is expected to deliver. These three flows
 * exist because the gate found behaviour the product does **not** deliver, and a
 * gate must record that without turning the defect into a passing assertion:
 *
 * 1. the canonical selection a pointer placement leaves behind, and whether the
 *    Index names the placed entity at all;
 * 2. the same comparison on a native primitive, so the pointer completion can be
 *    told apart from the Compose surface (the typed leg is the positive control);
 * 3. the plan's "from an empty project" leg, whose placement outcome depends on
 *    whether a Room floor exists.
 *
 * Nothing here asserts that a defect is present. A fix that makes a creator
 * model selectable, or an empty project placeable, changes the recorded values and
 * keeps these flows green — the acceptance record, not the harness, owns the
 * verdict. What is asserted is limited to positive controls (a typed placement
 * selects its entity; Compose can resize it) and storage consistency with the
 * outcome actually observed, so evidence can never disagree with itself.
 *
 * Run through the S03 supervisor:
 *   S03_QA_SPEC=perf/flows/s03-diagnostics.spec.ts \
 *     npx vite-node --script perf/run-s03-own-model-qa.mjs
 */
import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loginAs, TEST_AUTH_SESSION_COOKIE } from '../../tests/e2e/test-auth';
import { newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, VIEWPORT } from '../lib/config';
import {
	acceptedResultCount,
	fitStage,
	gotoCreateIntent,
	setStageReading,
	startStarterGallery,
	uniqueProjectId
} from '../lib/flow';
import { mappedModelGlb } from '../lib/own-model-fixture';

const apiOrigin = process.env.PERF_API_ORIGIN;
const secret = process.env.E2E_TEST_AUTH_SECRET;
const editorOrigin = process.env.PERF_BASE_URL;
const resultsDir = process.env.PERF_RESULTS_DIR ?? '.perf-results';

const IMPORT_ENTRY = { hasText: 'Import model…' } as const;
const REPORT = 'section[aria-label="Import report"]';
const INSTRUMENT = '.scene-instrument';
const CARD = '[aria-label="Selected subject"]';

/* --- shared helpers ------------------------------------------------------ */

function cookieFor(pair: string) {
	const equals = pair.indexOf('=');
	return {
		name: pair.slice(0, equals),
		value: pair.slice(equals + 1),
		domain: new URL(editorOrigin!).hostname,
		path: '/',
		httpOnly: true,
		secure: false
	};
}

async function signedInSession(browser: Parameters<typeof newMeasuredSession>[0]) {
	const login = await loginAs({ user: 'agent-admin', apiOrigin: apiOrigin!, secret: secret!, origin: editorOrigin! });
	const equals = login.cookie.indexOf('=');
	expect(login.cookie.slice(0, equals)).toBe(TEST_AUTH_SESSION_COOKIE);
	const session = await newMeasuredSession(browser, {
		viewport: VIEWPORT,
		deviceScaleFactor: DEVICE_SCALE_FACTOR,
		network: NETWORK,
		cacheState: 'cold'
	});
	await session.context.addCookies([cookieFor(login.cookie)]);
	return session;
}

async function saveProject(page: Page): Promise<void> {
	const save = page.locator('[data-head-save] button').first();
	const status = await page.locator('[data-head-save]').getAttribute('data-save-status');
	if (status === 'saved' && (await save.isDisabled())) return;
	if (status === 'saving') {
		await expect
			.poll(() => page.locator('[data-head-save]').getAttribute('data-save-status'), { timeout: 60_000 })
			.toBe('saved');
		return;
	}
	await expect(save).toBeEnabled();
	await save.click();
	await expect(page.locator('[data-head-save]')).toHaveAttribute('data-save-status', 'saved', { timeout: 60_000 });
}

async function subject(page: Page): Promise<string> {
	const card = page.locator(CARD);
	if ((await card.count()) === 0) return '(no card)';
	const text = (await card.first().innerText().catch(() => '(unreadable)')).replace(/\s+/g, ' ').trim();
	return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

/** The Compose surface as reached from the Index, or why it was not reached. */
async function compose(page: Page): Promise<Record<string, unknown>> {
	const row = page.locator('.contributed-item button.item-row', { hasText: 'Resize' });
	if ((await row.count()) === 0) return { opened: false, reason: 'no Resize row in the Index' };
	await row.first().click();
	// Wait for the instrument itself rather than for a fixed delay, so a slow
	// mount is not recorded as an absent instrument.
	await page
		.locator(INSTRUMENT)
		.first()
		.waitFor({ state: 'visible', timeout: 20_000 })
		.catch(() => undefined);
	if ((await page.locator(INSTRUMENT).count()) === 0) return { opened: false, reason: 'no instrument after Resize' };
	return {
		opened: true,
		text: (await page.locator(INSTRUMENT).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300),
		resizeDisabled: await page.locator(`${INSTRUMENT} button`, { hasText: 'Resize…' }).first().isDisabled().catch(() => null),
		duplicateDisabled: await page
			.locator(`${INSTRUMENT} button`, { hasText: 'Duplicate' })
			.first()
			.isDisabled()
			.catch(() => null),
		deleteDisabled: await page.locator(`${INSTRUMENT} button`, { hasText: 'Delete' }).first().isDisabled().catch(() => null)
	};
}

async function openImport(page: Page): Promise<void> {
	await page.locator('.contributed-item button.item-row', IMPORT_ENTRY).first().click();
	await expect(page.locator('#creator-model-file')).toBeVisible();
}

async function readModel(page: Page, name: string): Promise<string> {
	await page.locator('#creator-model-file').setInputFiles({
		name,
		mimeType: 'model/gltf-binary',
		buffer: await mappedModelGlb()
	});
	await page.getByRole('button', { name: 'Read model' }).click();
	await expect(page.locator(REPORT)).toBeVisible({ timeout: 180_000 });
	return (await page.locator(REPORT).innerText()).replace(/\s+/g, ' ').trim();
}

function sceneEntities(document: Record<string, unknown>): Record<string, any>[] {
	const units = (document.units ?? {}) as Record<string, any>;
	const scene = (units.scene?.data ?? units.scene ?? {}) as Record<string, any>;
	return (scene.entities ?? []) as Record<string, any>[];
}

function modelResources(document: Record<string, unknown>): Record<string, any>[] {
	const units = (document.units ?? {}) as Record<string, any>;
	const resources = (units.resources?.data?.resources ?? units.resources?.data ?? []) as unknown;
	return Array.isArray(resources) ? (resources as Record<string, any>[]).filter((entry) => entry?.kind === 'model') : [];
}

async function writeEvidence(name: string, evidence: Record<string, unknown>): Promise<void> {
	await writeFile(resolve(resultsDir, name), JSON.stringify(evidence, null, 2));
}

async function savedStarter(page: Page, projectId: string): Promise<void> {
	await gotoCreateIntent(page, projectId);
	await startStarterGallery(page);
	await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120_000 });
	await saveProject(page);
}

/* --- diagnostics -------------------------------------------------------- */

test.describe('T2.P02.S03 diagnostics (recorded, never acceptance rows)', () => {
	test.skip(
		apiOrigin === undefined || secret === undefined || editorOrigin === undefined,
		'requires the S03 supervisor (PERF_API_ORIGIN + E2E_TEST_AUTH_SECRET + PERF_BASE_URL)'
	);
	test.setTimeout(900_000);

	test('a pointer placement: the selected subject, the Index, and Compose', async ({ browser }) => {
		const session = await signedInSession(browser);
		const { page } = session;
		const projectId = uniqueProjectId('s03diagsel');
		const evidence: Record<string, unknown> = { projectId };

		await savedStarter(page, projectId);
		await openImport(page);
		evidence.report = await readModel(page, 'diagnostic-model.glb');
		await page.locator('.import').getByRole('textbox').nth(0).fill('1');
		await page.locator('.import').getByRole('textbox').nth(1).fill('Diagnostic model');
		await page.getByRole('button', { name: 'Approve and place' }).click();
		await expect(page.locator(INSTRUMENT)).toBeVisible({ timeout: 120_000 });

		const box = await page.locator('canvas').first().boundingBox();
		if (box === null) throw new Error('the Stage has no canvas box');
		const before = await acceptedResultCount(page);
		await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.52);
		await expect.poll(() => acceptedResultCount(page), { timeout: 90_000 }).toBeGreaterThan(before);

		// As the accepted install settles, not as a single frame.
		const samples: string[] = [];
		for (const delay of [0, 200, 1_000, 3_000]) {
			if (delay > 0) await page.waitForTimeout(delay);
			samples.push(`${delay}ms: ${await subject(page)}`);
		}
		evidence.subjectSamples = samples;

		await fitStage(page);
		await setStageReading(page, '3D');
		// Two different regions: contributed task groups (`.contributed-group`) and
		// the Layout subject groups, which are plain `.index-group`. Only the second
		// can say whether the Index names the placed entity as a subject, so both are
		// recorded — the shared class alone would make the subject answer empty by
		// construction.
		const taskGroups = page.locator('section.index-group.contributed-group');
		const subjectGroups = page.locator('section.index-group:not(.contributed-group)');
		evidence.taskRegionHeadings = await taskGroups.locator('h3.group-heading').allInnerTexts();
		evidence.taskRegionRows = (await taskGroups.locator('button.item-row').allInnerTexts()).map((text) =>
			text.replace(/\s+/g, ' ').trim()
		);
		evidence.subjectRegionHeadings = await subjectGroups.locator('h3.group-heading').allInnerTexts();
		evidence.subjectRegionRows = (await subjectGroups.locator('button.item-row').allInnerTexts()).map((text) =>
			text.replace(/\s+/g, ' ').trim()
		);
		evidence.subjectRowsNamingTheModel = await subjectGroups
			.locator('button.item-row', { hasText: 'Diagnostic model' })
			.count();
		evidence.taskRowsNamingTheModel = await taskGroups
			.locator('button.item-row', { hasText: 'Diagnostic model' })
			.count();
		evidence.compose = await compose(page);

		// The one settled fact this flow can hold the product to: one approved
		// placement stores exactly one model resource and one entity.
		await saveProject(page);
		const stored = (await (await session.context.request.get(
			`${apiOrigin}/projects/${encodeURIComponent(projectId)}`
		)).json()) as { document: Record<string, unknown> };
		expect(modelResources(stored.document), 'one approved placement stores one model resource').toHaveLength(1);
		expect(sceneEntities(stored.document), 'one approved placement stores one entity').toHaveLength(1);

		await writeEvidence('s03-diagnostic-selection.json', evidence);
		await session.context.close();
	});

	test('the typed and pointer placement paths on one native primitive', async ({ browser }) => {
		const session = await signedInSession(browser);
		const { page } = session;
		const evidence: Record<string, unknown> = { typed: {}, pointer: {} };
		const typed = evidence.typed as Record<string, unknown>;
		const pointer = evidence.pointer as Record<string, unknown>;

		// Typed X/Z Place: the positive control, so a broken Compose would show up
		// here instead of being blamed on the pointer path.
		await savedStarter(page, uniqueProjectId('s03diagtyped'));
		await page.locator('.contributed-item button.item-row', { hasText: 'Place object' }).first().click();
		await expect(page.locator(INSTRUMENT)).toBeVisible({ timeout: 120_000 });
		const beforeTyped = await acceptedResultCount(page);
		await page.locator(`${INSTRUMENT} input[inputmode="decimal"]`).nth(0).fill('1.5');
		await page.locator(`${INSTRUMENT} input[inputmode="decimal"]`).nth(1).fill('-1');
		await page.locator(`${INSTRUMENT} button`, { hasText: 'Place' }).last().click();
		await expect.poll(() => acceptedResultCount(page), { timeout: 60_000 }).toBeGreaterThan(beforeTyped);
		typed.subject = await subject(page);
		await page.locator('.contributed-item button.item-row', { hasText: 'Resize' }).first().click();
		await expect(page.locator(INSTRUMENT)).toBeVisible({ timeout: 60_000 });
		typed.composeText = (await page.locator(INSTRUMENT).innerText()).replace(/\s+/g, ' ').slice(0, 300);
		typed.resizeDisabled = await page.locator(`${INSTRUMENT} button`, { hasText: 'Resize…' }).first().isDisabled();
		expect(typed.subject, 'a typed placement selects its new entity').toMatch(/^ENTITY · SCENE/);
		expect(typed.resizeDisabled, 'Compose can resize the entity a typed placement selected').toBe(false);
		await page.keyboard.press('Escape');

		// Floor click on the same primitive: recorded, not asserted.
		await savedStarter(page, uniqueProjectId('s03diagpointer'));
		await page.locator('.contributed-item button.item-row', { hasText: 'Place object' }).first().click();
		await expect(page.locator(INSTRUMENT)).toBeVisible({ timeout: 120_000 });
		const beforePointer = await acceptedResultCount(page);
		const box = await page.locator('canvas').first().boundingBox();
		if (box === null) throw new Error('the Stage has no canvas box');
		await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.52);
		await expect.poll(() => acceptedResultCount(page), { timeout: 60_000 }).toBeGreaterThan(beforePointer);
		const samples: string[] = [];
		for (const delay of [0, 200, 1_000, 3_000]) {
			if (delay > 0) await page.waitForTimeout(delay);
			samples.push(`${delay}ms: ${await subject(page)}`);
		}
		pointer.subjectSamples = samples;

		await writeEvidence('s03-diagnostic-placement-paths.json', evidence);
		await session.context.close();
	});

	test('from an empty project: import, review, and whether a placement can commit', async ({ browser }) => {
		const session = await signedInSession(browser);
		const { page } = session;
		const projectId = uniqueProjectId('s03diagempty');
		const evidence: Record<string, unknown> = { projectId };

		await page.goto(`/project/${encodeURIComponent(projectId)}/spatial?create=1`);
		await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeVisible();
		await page.getByRole('button', { name: 'Begin empty' }).click();
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120_000 });
		await saveProject(page);

		await openImport(page);
		evidence.report = await readModel(page, 'empty-project-model.glb');
		await page.getByRole('button', { name: 'Approve and place' }).click();
		await expect(page.locator(INSTRUMENT)).toBeVisible({ timeout: 120_000 });

		const box = await page.locator('canvas').first().boundingBox();
		if (box === null) throw new Error('the Stage has no canvas box');
		const before = await acceptedResultCount(page);
		await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.52);
		// Poll for an accepted result instead of classifying by a fixed wait: a commit
		// slower than the wait would otherwise be recorded as a refusal, and could
		// then land after the save and contradict the 0/0 storage assertions.
		const classifyStarted = Date.now();
		const commitDeadline = classifyStarted + 15_000;
		let accepted = false;
		while (Date.now() < commitDeadline) {
			if ((await acceptedResultCount(page)) > before) {
				accepted = true;
				break;
			}
			await page.waitForTimeout(250);
		}
		if (!accepted) {
			// One bounded grace period before calling it refused, so a late commit is
			// still seen rather than being frozen into the evidence.
			await page.waitForTimeout(1_000);
			accepted = (await acceptedResultCount(page)) > before;
		}
		evidence.classificationWaitMs = Date.now() - classifyStarted;
		evidence.placementAccepted = accepted;
		evidence.subject = await subject(page);
		evidence.feedback = (await page.locator(`${INSTRUMENT} p.feedback`).innerText().catch(() => '(none)')).replace(
			/\s+/g,
			' '
		);
		evidence.instrumentText = (await page.locator(INSTRUMENT).innerText().catch(() => '(none)'))
			.replace(/\s+/g, ' ')
			.slice(0, 300);
		// The state a creator sees: an empty baseline, the Place instrument, nothing
		// installed. This image is the record's only view of that surface.
		await page.locator('canvas').first().screenshot({ path: resolve(resultsDir, 's03-empty-project-stage.png') });

		// Storage must agree with whichever outcome was observed — nothing more.
		await saveProject(page);
		const stored = (await (await session.context.request.get(
			`${apiOrigin}/projects/${encodeURIComponent(projectId)}`
		)).json()) as { document: Record<string, unknown> };
		const resources = modelResources(stored.document).length;
		const entities = sceneEntities(stored.document).length;
		evidence.stored = { resources, entities };
		if (accepted) {
			expect(resources, 'an accepted placement stores its resource').toBe(1);
			expect(entities, 'an accepted placement stores its entity').toBe(1);
		} else {
			expect(resources, 'a refused placement stores no resource').toBe(0);
			expect(entities, 'a refused placement stores no entity').toBe(0);
		}

		await writeEvidence('s03-diagnostic-empty-project.json', evidence);
		await session.context.close();
	});
});
