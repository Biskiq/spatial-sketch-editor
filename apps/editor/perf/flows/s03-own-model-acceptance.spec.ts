/**
 * T2.P02.S03 — the integrated own-model import acceptance journey.
 *
 * This is the phase's declared FINAL PHASE GATE evidence, not a measurement row
 * and not a lane: it drives the shipped creator surface (starter gallery, Library
 * Import, report review, approve, floor placement, Arrange move/turn, a second
 * instance, Save, a fresh-session reopen and Head Preview) against the
 * supervisor's real API, Postgres database and in-memory object store.
 *
 * Every assertion is a visible outcome or a stored consequence of it: the report
 * text a creator reads, the accepted results the Stage installs, the saved
 * envelope's pins, the derivative bytes fetched back by hash, and the rendered
 * pixels of the placed model in Preview. A document reload is never used to infer
 * an accepted result.
 *
 * The second test proves the owner-accepted bounds install nothing: oversize,
 * malformed, cancelled and project-replaced imports leave no resource and no
 * entity behind.
 *
 * Requires the supervisor (`perf/run-s03-own-model-qa.mjs`), which supplies
 * PERF_API_ORIGIN, E2E_TEST_AUTH_SECRET and PERF_BASE_URL. Without them the spec
 * skips with its reason.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
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
import { decodePng, mappedModelGlb, modelGreenPixels } from '../lib/own-model-fixture';

const apiOrigin = process.env.PERF_API_ORIGIN;
const secret = process.env.E2E_TEST_AUTH_SECRET;
const editorOrigin = process.env.PERF_BASE_URL;
const resultsDir = process.env.PERF_RESULTS_DIR ?? '.perf-results';

const IMPORT_ENTRY = { hasText: 'Import model…' } as const;
const REPORT = 'section[aria-label="Import report"]';
const INSTRUMENT = '.scene-instrument';
const CARD = '[aria-label="Selected subject"] h2';
const HEAD_PREVIEW = '[data-head-preview] button';
const VISITOR_CANVAS = '[aria-label="Visitor preview canvas"]';
const SOURCE_BOUND = 50 * 1024 * 1024;

/* --- product steps ------------------------------------------------------ */

async function saveProject(page: Page): Promise<void> {
	const save = page.locator('[data-head-save] button').first();
	// A freshly created empty project is saved already; Save is then disabled with
	// "All accepted changes are saved." rather than waiting for a first click.
	if ((await page.locator('[data-head-save]').getAttribute('data-save-status')) === 'saved' && (await save.isDisabled())) return;
	await expect(save).toBeEnabled();
	await save.click();
	await expect
		.poll(() => page.locator('[data-head-save]').getAttribute('data-save-status'), { timeout: 60_000 })
		.toBe('saved');
}

async function openImport(page: Page): Promise<void> {
	await page.locator('.contributed-item button.item-row', IMPORT_ENTRY).first().click();
	await expect(page.locator('#creator-model-file')).toBeVisible();
}

async function readModel(page: Page, buffer: Buffer, name: string): Promise<string> {
	await page.locator('#creator-model-file').setInputFiles({ name, mimeType: 'model/gltf-binary', buffer });
	await page.getByRole('button', { name: 'Read model' }).click();
	await expect(page.locator(REPORT)).toBeVisible({ timeout: 180_000 });
	return (await page.locator(REPORT).innerText()).replace(/\s+/g, ' ').trim();
}

/** A bounded wait for one more accepted result; faster feedback than the flow helper. */
async function waitAccepted(page: Page, before: number, timeout = 90_000): Promise<void> {
	await expect.poll(() => acceptedResultCount(page), { timeout, intervals: [100, 250, 500] }).toBeGreaterThan(before);
}

async function floorPoint(page: Page, dx = 0, dy = 0) {
	const box = await page.locator('canvas').first().boundingBox();
	if (box === null) throw new Error('the Stage has no canvas box');
	return { x: box.x + box.width * 0.6 + dx, y: box.y + box.height * 0.52 + dy };
}

async function placeAt(page: Page, dx = 0, dy = 0): Promise<void> {
	await expect(page.locator(INSTRUMENT)).toBeVisible({ timeout: 120_000 });
	const point = await floorPoint(page, dx, dy);
	const before = await acceptedResultCount(page);
	await page.mouse.click(point.x, point.y);
	await waitAccepted(page, before);
}

/** Open one contributed task by its Index row and wait for its instrument. */
async function invokeIndexTask(page: Page, label: string): Promise<void> {
	await page.locator('.contributed-item button.item-row', { hasText: label }).first().click();
	await expect(page.locator(INSTRUMENT)).toBeVisible();
}

async function canvasShot(page: Page, selector: string, name: string) {
	const buffer = await page.locator(selector).first().screenshot();
	await writeFile(resolve(resultsDir, name), buffer);
	return { buffer, pixels: modelGreenPixels(decodePng(buffer)) };
}

/**
 * Shot the canvas once the mapped derivative is actually painted.
 *
 * The mapped texture arrives as a fetched derivative after the first paint, so a
 * single shot taken on the first frame can catch the untextured fallback. The
 * row under test is "Preview shows the placed mapped model", so it waits for the
 * mapped pixels and records how long that took rather than asserting a frame.
 */
async function canvasShotMapped(
	page: Page,
	selector: string,
	name: string,
	minPixels = 500,
	timeoutMs = 60_000
) {
	const started = Date.now();
	let shot = await canvasShot(page, selector, name);
	while (shot.pixels <= minPixels && Date.now() - started < timeoutMs) {
		await page.waitForTimeout(250);
		shot = await canvasShot(page, selector, name);
	}
	return { ...shot, waitedMs: Date.now() - started };
}

type ProjectRead = { readonly revision: number | string; readonly document: Record<string, unknown> };

function projectApi(api: APIRequestContext) {
	return {
		async read(projectId: string): Promise<ProjectRead> {
			const response = await api.get(`${apiOrigin}/projects/${encodeURIComponent(projectId)}`);
			expect(response.status(), `GET /projects/${projectId}`).toBe(200);
			return (await response.json()) as ProjectRead;
		},
		async modelBytes(projectId: string, hash: string): Promise<{ status: number; bytes: Buffer }> {
			const response = await api.get(
				`${apiOrigin}/projects/${encodeURIComponent(projectId)}/models/content/${encodeURIComponent(hash)}`
			);
			return { status: response.status(), bytes: Buffer.from(await response.body()) };
		}
	};
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
	const login = await loginAs({
		user: 'agent-admin',
		apiOrigin: apiOrigin!,
		secret: secret!,
		origin: editorOrigin!
	});
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

/* --- spec --------------------------------------------------------------- */

test.describe('T2.P02.S03 integrated own-model import', () => {
	test.skip(apiOrigin === undefined || secret === undefined || editorOrigin === undefined, 'requires the S03 supervisor (PERF_API_ORIGIN + E2E_TEST_AUTH_SECRET + PERF_BASE_URL)');
	test.setTimeout(900_000);

	test('one mapped GLB through approve, place, arrange, Save, reopen and Preview', async ({ browser }, testInfo) => {
		const session = await signedInSession(browser);
		const { page } = session;
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error' && /THREE|Shader|Uncaught/.test(message.text())) errors.push(message.text());
		});
		const api = projectApi(session.context.request);
		const projectId = uniqueProjectId('s03');
		const evidence: Record<string, unknown> = { projectId, browser: testInfo.project.name, errors };

		await gotoCreateIntent(page, projectId);
		await startStarterGallery(page);
		await saveProject(page);

		// --- import, review, confirm, approve, place -------------------------
		await openImport(page);
		const report = await readModel(page, await mappedModelGlb(), 'gate-model.glb');
		evidence.report = report;
		expect(report).toContain('2.000 × 2.000 m');
		expect(report).toContain('contact 0.000 m');
		expect(report).toContain('Textures capped at 2048 px: 1 reduced');
		expect(report).toContain('0 animations, 0 variants');
		await page.locator('.import').getByRole('textbox').nth(0).fill('1');
		await page.locator('.import').getByRole('textbox').nth(1).fill('Gate model');
		await page.getByRole('button', { name: 'Approve and place' }).click();
		await placeAt(page);

		await fitStage(page);
		await setStageReading(page, '3D');
		const stagePlaced = await canvasShot(page, 'canvas', 's03-stage-placed.png');
		evidence.stagePlacedPixels = stagePlaced.pixels;
		expect(stagePlaced.pixels, 'the placed model renders in the editor 3D reading').toBeGreaterThan(1_000);

		// Record what the placement completion left selected. This is the
		// owner-deferred selection gap, and the recorded failure of the Compose
		// surface below follows from it: the acceptance report must not claim a
		// manipulation path the shipped UI does not offer.
		evidence.selectionAfterPlacement = (await page.locator(CARD).first().innerText().catch(() => '(none)')).replace(/\s+/g, ' ');

		// --- move and turn through Arrange's own entity chooser -------------
		await invokeIndexTask(page, 'Arrange');
		evidence.arrangeEntityOptions = await page.locator(`${INSTRUMENT} option`).allInnerTexts();
		const modelOption = (evidence.arrangeEntityOptions as string[]).find((option) => option.includes('· model'));
		expect(modelOption, 'the placed model is selectable inside Arrange').toBeTruthy();
		await page.locator(`${INSTRUMENT} select`).first().selectOption({ label: modelOption! });
		await page.getByRole('button', { name: 'Begin', exact: true }).click();
		const xField = page.locator(INSTRUMENT).getByRole('textbox').nth(0);
		const zField = page.locator(INSTRUMENT).getByRole('textbox').nth(1);
		const yawField = page.locator(INSTRUMENT).getByRole('textbox').nth(2);
		await xField.fill('1.25');
		await zField.fill('-0.5');
		const beforeMove = await acceptedResultCount(page);
		await page.getByRole('button', { name: 'Commit', exact: true }).click();
		await waitAccepted(page, beforeMove);

		await invokeIndexTask(page, 'Arrange');
		await page.locator(`${INSTRUMENT} select`).first().selectOption({ label: modelOption! });
		await page.getByRole('button', { name: 'Begin', exact: true }).click();
		await page.locator(INSTRUMENT).getByRole('textbox').nth(2).fill('0.5');
		const beforeTurn = await acceptedResultCount(page);
		await page.getByRole('button', { name: 'Commit', exact: true }).click();
		await waitAccepted(page, beforeTurn);

		await saveProject(page);
		let stored = await api.read(projectId);
		let entities = sceneEntities(stored.document);
		expect(entities).toHaveLength(1);
		evidence.afterMoveTurn = { position: entities[0]!.position, rotation: entities[0]!.rotation };
		expect(entities[0]!.position[0]).toBeCloseTo(1.25, 3);
		expect(entities[0]!.position[2]).toBeCloseTo(-0.5, 3);
		expect(entities[0]!.rotation[1]).toBeCloseTo(0.5, 3);

		// --- the Compose surface is unreachable for a placed creator model ---
		await invokeIndexTask(page, 'Resize');
		evidence.compose = {
			text: (await page.locator(INSTRUMENT).innerText()).replace(/\s+/g, ' ').slice(0, 240),
			resizeDisabled: await page.getByRole('button', { name: 'Resize…' }).isDisabled(),
			duplicateDisabled: await page.getByRole('button', { name: 'Duplicate', exact: true }).isDisabled(),
			deleteDisabled: await page.getByRole('button', { name: 'Delete', exact: true }).isDisabled()
		};
		expect(evidence.compose).toMatchObject({
			resizeDisabled: true,
			duplicateDisabled: true,
			deleteDisabled: true
		});

		// --- a second instance shares the one immutable revision ------------
		// Close the Compose task first; Import is its own procedure.
		await page.getByRole('button', { name: /^Close / }).first().click().catch(() => undefined);
		await openImport(page);
		await expect(page.locator('section[aria-label="Approved models in this project"]')).toBeVisible();
		await page.getByRole('button', { name: 'Place another' }).first().click();
		await placeAt(page, 60, 18);
		await saveProject(page);
		stored = await api.read(projectId);
		entities = sceneEntities(stored.document);
		const models = modelResources(stored.document);
		expect(entities).toHaveLength(2);
		expect(models).toHaveLength(1);
		expect(new Set(entities.map((entity) => entity.assetId)).size).toBe(1);
		expect(new Set(entities.map((entity) => entity.id)).size).toBe(2);
		expect(entities.every((entity) => entity.kind === 'model' && entity.fallback === 'generic')).toBe(true);
		evidence.twoInstances = {
			entityIds: entities.map((entity) => entity.id),
			assetIds: entities.map((entity) => entity.assetId),
			resourceIds: models.map((resource) => resource.id)
		};

		// --- the retained revision, its pins and its placement --------------
		const resource = models[0]!;
		const model = resource.model as Record<string, any>;
		evidence.resource = {
			id: resource.id,
			pin: resource.pin,
			source: model.source,
			recipe: model.recipe,
			reportDigest: model.reportDigest,
			placement: model.placement,
			contentRevision: resource.contentRevision
		};
		expect(model.recipe).toMatchObject({ id: 'creator-import@1', version: 1 });
		expect(typeof model.reportDigest).toBe('string');
		expect(model.placement.placement).toBe('floor');
		expect(model.placement.footprint.width).toBeCloseTo(2, 3);
		// The dependency lock pins the same immutable revision the resource names.
		const lock = (stored.document.dependencyLock ?? {}) as Record<string, any>;
		const lockEntry = (lock.entries ?? []).find((entry: Record<string, any>) => entry.domain === 'resource:model');
		expect(lockEntry?.subjectId).toBe(resource.id);
		expect(lockEntry?.pin?.hash).toBe(resource.pin.hash);
		expect(resource.contentRevision).toBe(resource.pin.hash);
		// No part, clip or variant is admitted: a model entity carries no part field
		// and the resource payload is the recipe's whole-model record only.
		expect(entities.every((entity) => entity.componentId === undefined && entity.partId === undefined)).toBe(true);
		expect(model).not.toHaveProperty('parts');
		expect(model).not.toHaveProperty('clips');
		expect(model).not.toHaveProperty('variants');
		const fetched = await api.modelBytes(projectId, resource.pin.hash);
		expect(fetched.status).toBe(200);
		expect(createHash('sha256').update(fetched.bytes).digest('hex')).toBe(resource.pin.hash.replace(/^sha256-/, ''));
		expect(fetched.bytes.length).toBe(resource.pin.size);
		evidence.derivativeBytes = { size: fetched.bytes.length, hash: resource.pin.hash };

		// --- Save, reopen in a fresh session --------------------------------
		const reopened = await signedInSession(browser);
		const reopenPage = reopened.page;
		const reopenErrors: string[] = [];
		reopenPage.on('pageerror', (error) => reopenErrors.push(error.message));
		await reopenPage.goto(`/project/${encodeURIComponent(projectId)}/spatial`);
		await expect(reopenPage.locator('canvas').first()).toBeVisible({ timeout: 180_000 });
		await expect
			.poll(async () => reopenPage.locator('.contributed-item button.item-row', IMPORT_ENTRY).count(), { timeout: 120_000 })
			.toBeGreaterThan(0);
		await setStageReading(reopenPage, '3D');
		await fitStage(reopenPage);
		const reopenedStage = await canvasShot(reopenPage, 'canvas', 's03-stage-reopened.png');
		evidence.reopenedPixels = reopenedStage.pixels;
		evidence.reopenErrors = reopenErrors;
		expect(reopenedStage.pixels, 'the stored revisions render on a fresh load').toBeGreaterThan(500);

		// --- Preview with the real mapped derivative ------------------------
		await reopenPage.getByRole('button', { name: 'Experience', exact: true }).click();
		await reopenPage.getByRole('button', { name: 'Create Experience' }).click();
		await expect(reopenPage.locator('[aria-label="Experience authoring"]')).toBeVisible();
		await reopenPage.getByRole('button', { name: 'Capture', exact: true }).click();
		await expect(
			reopenPage.locator('[aria-label="Experience authoring"]').getByText('Accepted.', { exact: true })
		).toBeVisible();
		await reopenPage.locator(HEAD_PREVIEW).click();
		await expect(reopenPage.locator(VISITOR_CANVAS)).toBeVisible({ timeout: 120_000 });
		await reopenPage.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
		const previewWithModel = await canvasShotMapped(reopenPage, VISITOR_CANVAS, 's03-preview-with-model.png');
		evidence.previewPixelsWithModel = previewWithModel.pixels;
		evidence.previewTextureWaitedMs = previewWithModel.waitedMs;
		expect(previewWithModel.pixels, 'Preview shows the placed mapped model').toBeGreaterThan(500);
		await reopenPage.getByRole('button', { name: /Exit Preview/ }).click();
		await expect(reopenPage.locator(VISITOR_CANVAS)).toBeHidden();

		// --- control: the same Preview surface with no creator model --------
		const controlId = uniqueProjectId('s03control');
		const controlPage = await reopened.context.newPage();
		await controlPage.goto(`/project/${encodeURIComponent(controlId)}/spatial?create=1`);
		await controlPage.getByRole('button', { name: 'Enclosed room' }).click();
		await expect(controlPage.locator('canvas').first()).toBeVisible({ timeout: 120_000 });
		await saveProject(controlPage);
		await controlPage.getByRole('button', { name: 'Experience', exact: true }).click();
		await controlPage.getByRole('button', { name: 'Create Experience' }).click();
		await expect(controlPage.locator('[aria-label="Experience authoring"]')).toBeVisible();
		await controlPage.getByRole('button', { name: 'Capture', exact: true }).click();
		await expect(
			controlPage.locator('[aria-label="Experience authoring"]').getByText('Accepted.', { exact: true })
		).toBeVisible();
		await controlPage.locator(HEAD_PREVIEW).click();
		await expect(controlPage.locator(VISITOR_CANVAS)).toBeVisible({ timeout: 120_000 });
		await controlPage.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
		const previewControl = await canvasShot(controlPage, VISITOR_CANVAS, 's03-preview-control.png');
		evidence.previewPixelsControl = previewControl.pixels;
		expect(previewControl.pixels, 'the control Preview carries no model colour').toBeLessThan(previewWithModel.pixels / 10);

		await writeFile(resolve(resultsDir, 's03-journey-evidence.json'), JSON.stringify(evidence, null, 2));
		expect(errors).toEqual([]);
		await reopened.context.close();
		await session.context.close();
	});

	test('an empty project imports and reviews the same model; placement needs a floor', async ({ browser }) => {
		const session = await signedInSession(browser);
		const { page } = session;
		const api = projectApi(session.context.request);
		const projectId = uniqueProjectId('s03empty');
		const evidence: Record<string, unknown> = { projectId };

		await page.goto(`/project/${encodeURIComponent(projectId)}/spatial?create=1`);
		await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeVisible();
		await page.getByRole('button', { name: 'Begin empty' }).click();
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120_000 });
		await saveProject(page);

		await openImport(page);
		const report = await readModel(page, await mappedModelGlb(), 'empty-project-model.glb');
		evidence.report = report;
		await page.getByRole('button', { name: 'Approve and place' }).click();
		await expect(page.locator(INSTRUMENT)).toBeVisible({ timeout: 120_000 });
		const point = await floorPoint(page);
		const before = await acceptedResultCount(page);
		await page.mouse.click(point.x, point.y);
		// An empty project has no compiled Room floor; the placement may refuse with
		// its reason. Record which happened rather than assuming either.
		await page.waitForTimeout(2_000);
		const accepted = (await acceptedResultCount(page)) > before;
		evidence.placementAccepted = accepted;
		evidence.feedback = (await page.locator(`${INSTRUMENT} p.feedback`).innerText().catch(() => '(none)')).replace(/\s+/g, ' ');
		evidence.instrumentText = (await page.locator(INSTRUMENT).innerText().catch(() => '(none)')).replace(/\s+/g, ' ');
		const emptyStage = await canvasShot(page, 'canvas', 's03-empty-project-stage.png');
		evidence.stageColourPixels = emptyStage.pixels;
		if (accepted) {
			await saveProject(page);
			const stored = await api.read(projectId);
			expect(modelResources(stored.document)).toHaveLength(1);
			expect(sceneEntities(stored.document)).toHaveLength(1);
		} else {
			await saveProject(page);
			const stored = await api.read(projectId);
			expect(modelResources(stored.document)).toHaveLength(0);
			expect(sceneEntities(stored.document)).toHaveLength(0);
			// The pointer claim is refused before a proposal, so the instrument shows no
			// reason at all. That silence is recorded as a finding in the acceptance
			// record rather than asserted here, so a future explanation does not fail
			// this flow.
		}
		await writeFile(resolve(resultsDir, 's03-empty-project-evidence.json'), JSON.stringify(evidence, null, 2));
		await session.context.close();
	});

	test('oversize, malformed, cancelled and project-replaced imports install nothing', async ({ browser }) => {
		const session = await signedInSession(browser);
		const { page } = session;
		const api = projectApi(session.context.request);
		const projectId = uniqueProjectId('s03refuse');
		const evidence: Record<string, unknown> = { projectId, cases: [] as unknown[] };
		const record = (entry: Record<string, unknown>) => (evidence.cases as unknown[]).push(entry);

		await gotoCreateIntent(page, projectId);
		await startStarterGallery(page);
		await saveProject(page);

		// Oversize: refused before any upload, from the declared byte count.
		// Playwright cannot carry a >50 MB buffer in memory, so the file is written
		// outside the repository and chosen by path.
		const oversizePath = resolve(resultsDir, 'oversize-source.glb');
		await writeFile(oversizePath, Buffer.alloc(SOURCE_BOUND + 1));
		await openImport(page);
		await page.locator('#creator-model-file').setInputFiles(oversizePath);
		await page.getByRole('button', { name: 'Read model' }).click();
		const oversizeAlert = page.getByRole('alert');
		await expect(oversizeAlert).toBeVisible({ timeout: 30_000 });
		const oversizeText = (await oversizeAlert.innerText()).replace(/\s+/g, ' ');
		record({ case: 'oversize', text: oversizeText });
		expect(oversizeText).toContain(`limited to ${SOURCE_BOUND} bytes`);
		await expect(page.locator(REPORT)).toHaveCount(0);

		// Malformed: a container that is not glTF installs nothing.
		await page.locator('#creator-model-file').setInputFiles({
			name: 'malformed.glb',
			mimeType: 'model/gltf-binary',
			buffer: Buffer.from('not a glb at all'.repeat(64))
		});
		await page.getByRole('button', { name: 'Read model' }).click();
		await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 });
		const malformedText = (await page.getByRole('alert').innerText()).replace(/\s+/g, ' ');
		record({ case: 'malformed', text: malformedText });
		expect(malformedText).toMatch(/could not be read|not a valid/i);
		await expect(page.locator(REPORT)).toHaveCount(0);

		// Cancelled: a reviewed import cancelled before approval installs nothing.
		const cancelledReport = await readModel(page, await mappedModelGlb(), 'cancelled.glb');
		record({ case: 'cancelled-report', text: cancelledReport.slice(0, 120) });
		await page.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(page.locator(REPORT)).toHaveCount(0, { timeout: 30_000 });

		// Project-replaced: leaving the project after review must not install it
		// into either project.
		await page.locator('#creator-model-file').setInputFiles({
			name: 'replaced.glb',
			mimeType: 'model/gltf-binary',
			buffer: await mappedModelGlb()
		});
		await page.getByRole('button', { name: 'Read model' }).click();
		await expect(page.locator(REPORT)).toBeVisible({ timeout: 180_000 });
		const otherId = uniqueProjectId('s03replaced');
		await gotoCreateIntent(page, otherId);
		await startStarterGallery(page);
		await saveProject(page);

		const first = await api.read(projectId);
		const second = await api.read(otherId);
		expect(modelResources(first.document)).toHaveLength(0);
		expect(sceneEntities(first.document)).toHaveLength(0);
		expect(modelResources(second.document)).toHaveLength(0);
		record({ case: 'installed-resources', first: 0, second: 0 });

		await writeFile(resolve(resultsDir, 's03-refusal-evidence.json'), JSON.stringify(evidence, null, 2));
		await session.context.close();
	});
});
