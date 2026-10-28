/** Owner-approved S01 Option B: real creator selection/operations/Save/reopen/Preview. */
import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import { evaluateSceneForm } from '@portfolio/project-model/scene-planning';
import type { SceneFormEntity } from '@portfolio/project-model';
import { createUnitProject } from '../../tests/lib/authoring/__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../../tests/lib/layout/__fixtures__/layout-id-capture';
import { loginAs } from '../../tests/e2e/test-auth';
import { newMeasuredSession } from '../lib/browser';
import { acceptedResultCount, commandPresentation, gotoCreateIntent, setStageReading, uniqueProjectId, waitForCameraSettled } from '../lib/flow';
import { readLedger } from '../lib/ledger';

const apiOrigin = process.env.PERF_API_ORIGIN!;
const editorOrigin = process.env.PERF_BASE_URL!;
const resultsDir = process.env.PERF_RESULTS_DIR!;
const CARD = '[aria-label="Selected subject"]';
function form(plane: 'plan' | 'elevation', x: number): SceneFormEntity {
	return { kind: 'form', id: `form-${plane}`, name: `${plane} acceptance form`, position: [x, 0, 3], rotation: [0, 0, 0],
		materialId: 'plaster-warm', castShadow: true, receiveShadow: true,
		form: { generator: { kind: 'extrude', plane, extent: 1.5, outline: [
			{ key: 1, u: -0.6, v: 0, smooth: false }, { key: 2, u: 0.6, v: 0, smooth: false },
			{ key: 3, u: 0.6, v: 1.2, smooth: false }, { key: 4, u: -0.6, v: 1.2, smooth: false }
		] }, scale: [1, 1, 1], nextKey: 5 } };
}
async function fixture(id: string) {
	const layout = createEmptyWallFirstLayoutDocument();
	const walls = planWallChain({ baseline: layout, points: [[0, 0], [9, 0], [9, 8], [0, 8]], close: true,
		capture: freshCapture(), levelId: layout.floor.id });
	if (walls.kind !== 'success') throw new Error('native form fixture walls refused');
	return createUnitProject({ id, name: 'Native form acceptance', layout: walls.document,
		scene: { formatVersion: 1, entities: [form('plan', 2.5), form('elevation', 6)], materials: [], textures: [], navigationNodes: [], connections: [] } });
}
async function download(page: Page) {
	const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download source JSON', exact: true }).click()]);
	const path = await file.path();
	if (path === null) throw new Error('source download missing');
	return JSON.parse(await readFile(path, 'utf8'));
}
async function clickWorld(page: Page, point: [number, number, number]) {
	const css = await page.evaluate((world) => {
		const camera = (window as any).__BISKIQ_PERF_RENDER_REFS__?.stage?.camera;
		if (!camera) throw new Error('Stage has no rendered camera');
		const apply = (m: number[], p: number[]) => [0, 1, 2, 3].map((r) => m[r]! * p[0]! + m[4 + r]! * p[1]! + m[8 + r]! * p[2]! + m[12 + r]! * p[3]!);
		const clip = apply(camera.projectionMatrix.elements, apply(camera.matrixWorldInverse.elements, [...world, 1]));
		const rect = document.querySelector('.stage canvas')!.getBoundingClientRect();
		return { x: rect.left + (clip[0]! / clip[3]! + 1) / 2 * rect.width, y: rect.top + (1 - clip[1]! / clip[3]!) / 2 * rect.height };
	}, point);
	await page.mouse.click(css.x, css.y);
}
async function accepted(page: Page, action: () => Promise<unknown>) {
	const before = await acceptedResultCount(page);
	await action();
	await expect.poll(() => acceptedResultCount(page), { timeout: 30_000 }).toBeGreaterThan(before);
	await expect(page.locator('.form-fields')).toBeVisible();
}
async function selectFromIndex(page: Page, name: string) {
	await page.locator('#plate-index-search').fill(name);
	await page.locator('.index-group .item button.item-row', { hasText: name }).click();
	await expect(page.locator('.form-fields')).toBeVisible();
	await page.locator('#plate-index-search').fill('');
}

async function renderedForms(page: Page, surface: 'stage' | 'preview', ids = ['form-plan', 'form-elevation']) {
	await expect.poll(() => page.evaluate(({ surface, ids }) => {
		const scene = (window as any).__BISKIQ_PERF_RENDER_REFS__?.[surface]?.scene;
		return ids.every((id) => {
			const root = scene?.getObjectByName(`SceneEntity:${id}`);
			return root?.getObjectByProperty('isMesh', true) !== undefined;
		});
	}, { surface, ids })).toBe(true);
	return page.evaluate(({ surface, ids }) => {
		const scene = (window as any).__BISKIQ_PERF_RENDER_REFS__[surface].scene;
		return ids.map((id) => {
			const mesh = scene.getObjectByName(`SceneEntity:${id}`).getObjectByProperty('isMesh', true);
			mesh.updateWorldMatrix(true, false);
			return { id, positions: Array.from(mesh.geometry.attributes.position.array), world: Array.from(mesh.matrixWorld.elements) };
		});
	}, { surface, ids });
}

test('native forms are selectable and operable through Stage, Plan, Index, Find and isolated Preview', async ({ browser }, testInfo) => {
	test.setTimeout(600_000);
	expect(apiOrigin && editorOrigin && resultsDir && process.env.E2E_TEST_AUTH_SECRET, 'requires the local API supervisor').toBeTruthy();
	const session = await newMeasuredSession(browser, { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N1', cacheState: 'cold' });
	let page = session.page;
	const context = session.context;
	let reopenedSession: Awaited<ReturnType<typeof newMeasuredSession>> | null = null;
	const errors: string[] = [];
	page.on('dialog', (dialog) => void dialog.accept());
	page.on('pageerror', (error) => errors.push(error.message));
	const id = uniqueProjectId('native-form');
	const evidence: Record<string, unknown> = { id, browser: testInfo.project.name, version: browser.version(), network: 'N1', cache: 'cold', errors };
	try {
		const login = await loginAs({ user: 'agent-admin', apiOrigin, secret: process.env.E2E_TEST_AUTH_SECRET!, origin: editorOrigin });
		const equals = login.cookie.indexOf('=');
		await context.addCookies([{ name: login.cookie.slice(0, equals), value: login.cookie.slice(equals + 1), domain: new URL(editorOrigin).hostname, path: '/', httpOnly: true, secure: false }]);
		await gotoCreateIntent(page, id);
		await page.getByRole('button', { name: 'Begin empty', exact: true }).click();
		const source = await fixture(id);
		const chooser = page.waitForEvent('filechooser');
		await page.getByRole('button', { name: 'Open source JSON', exact: true }).click();
		await page.getByRole('alertdialog', { name: 'Replace project' }).getByRole('button', { name: 'Replace', exact: true }).click();
		await (await chooser).setFiles({ name: 'native-forms.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
		await expect(page.getByRole('heading', { name: 'Native form acceptance', exact: true })).toBeVisible();
		await waitForCameraSettled(page);
		await renderedForms(page, 'stage');
		// Actual canvas clicks, before any locator has installed a selection.
		await clickWorld(page, [2.5, 0.75, 3.6]);
		await expect(page.locator(CARD)).toContainText('form-plan');
		await expect(page.locator('.form-fields')).toBeVisible();
		await page.screenshot({ path: resolve(resultsDir, 'native-form-3d-selection.png') });
		await setStageReading(page, 'Plan');
		await clickWorld(page, [6, 0, 3.75]);
		await expect(page.locator(CARD)).toContainText('form-elevation');
		await page.screenshot({ path: resolve(resultsDir, 'native-form-plan-selection.png') });
		await selectFromIndex(page, 'plan acceptance form');
		await page.locator('[data-head-find] summary').click();
		await page.locator('[data-head-find] input').fill('elevation acceptance form');
		await page.locator('[data-head-find] button', { hasText: 'elevation acceptance form' }).click();
		await expect(page.locator(CARD)).toContainText('form-elevation');
		await page.locator('[data-head-find] summary').click();
		await selectFromIndex(page, 'plan acceptance form');
		const before = await download(page);
		await page.getByLabel('Form X (m)', { exact: true }).fill('3');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Move', exact: true }).click());
		await page.getByLabel('Form yaw (rad)', { exact: true }).fill('0.4');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Turn', exact: true }).click());
		await page.getByLabel('Form Z (m)', { exact: true }).fill('4');
		await accepted(page, () => page.getByRole('button', { name: 'Place on floor', exact: true }).click());
		await page.getByLabel('Form width (m)', { exact: true }).fill('2');
		await page.getByLabel('Form height (m)', { exact: true }).fill('2.2');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Size', exact: true }).click());
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Duplicate', exact: true }).click());
		const duplicated = await download(page);
		const copy = duplicated.units.scene.data.entities.find((entity: any) => !['form-plan', 'form-elevation'].includes(entity.id));
		expect(copy?.kind).toBe('form');
		await page.getByRole('button', { name: 'Delete form', exact: true }).click();
		await page.getByRole('button', { name: 'Confirm Delete form', exact: true }).click();
		await expect(page.locator('.form-fields')).toBeHidden();
		const after = await download(page);
		expect(after.units.scene.data.entities).toHaveLength(2);
		for (let index = 0; index < 6; index++) await page.getByRole('button', { name: 'Undo', exact: true }).click();
		expect((await download(page)).units.scene.data.entities).toEqual(before.units.scene.data.entities);
		for (let index = 0; index < 6; index++) await page.getByRole('button', { name: 'Redo', exact: true }).click();
		expect((await download(page)).units.scene.data.entities).toEqual(after.units.scene.data.entities);
		await selectFromIndex(page, 'plan acceptance form');
		await setStageReading(page, '3D');
		await page.screenshot({ path: resolve(resultsDir, 'native-form-edited-shadow.png') });
		await page.locator('[data-head-save] button').first().click();
		await expect.poll(() => page.locator('[data-head-save]').getAttribute('data-save-status'), { timeout: 60_000 }).toBe('saved');
		const response = await context.request.get(`${apiOrigin}/projects/${encodeURIComponent(id)}`);
		expect(response.status()).toBe(200);
		const stored = await response.json();
		expect(stored.document.units.scene.data.entities).toEqual(after.units.scene.data.entities);
		evidence.editLedger = await readLedger(page);
		reopenedSession = await newMeasuredSession(browser, { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N1', cacheState: 'cold' });
		await reopenedSession.context.addCookies(await context.cookies());
		page = reopenedSession.page;
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto(`${editorOrigin}/project/${encodeURIComponent(id)}/spatial`);
		await waitForCameraSettled(page);
		await selectFromIndex(page, 'plan acceptance form');
		expect((await download(page)).units.scene.data.entities).toEqual(after.units.scene.data.entities);
		await page.getByRole('button', { name: 'Experience', exact: true }).click();
		await page.getByRole('button', { name: 'Create Experience', exact: true }).click();
		await page.getByRole('button', { name: 'Capture', exact: true }).click();
		await expect(page.locator('[aria-label="Experience authoring"]').getByText('Accepted.', { exact: true })).toBeVisible();
		const previewSource = await download(page);
		// Capture is a separate accepted edit. Select at the Preview boundary so
		// this row proves the isolated run itself preserves the canonical subject.
		await selectFromIndex(page, 'plan acceptance form');
		const stageMeshes = await renderedForms(page, 'stage');
		for (const mesh of stageMeshes) {
			const entity = previewSource.units.scene.data.entities.find((entity: any) => entity.id === mesh.id);
			expect(mesh.positions).toEqual(Array.from(new Float32Array(evaluateSceneForm(entity.form).positions)));
		}
		await page.locator('[data-head-preview] button').click();
		await expect(page.locator('[aria-label="Visitor preview canvas"]')).toBeVisible({ timeout: 90_000 });
		await expect(page.locator(CARD)).toBeHidden();
		await expect(page.locator('[data-head-find]')).toBeHidden();
		await expect(page.locator('.form-fields')).toBeHidden();
		expect(await renderedForms(page, 'preview')).toEqual(stageMeshes);
		await page.locator('[aria-label="Visitor preview canvas"]').screenshot({ path: resolve(resultsDir, 'native-form-preview.png') });
		await page.getByRole('button', { name: /Exit Preview/ }).click();
		expect((await download(page)).units.scene.data.entities).toEqual(previewSource.units.scene.data.entities);
		await page.getByRole('button', { name: 'World', exact: true }).click();
		await expect(page.locator(CARD)).toContainText('form-plan');
		await expect(page.locator('.form-fields')).toBeVisible();
		evidence.scene = after.units.scene;
		evidence.ledger = await readLedger(page);
		expect(errors).toEqual([]);
	} finally {
		await writeFile(resolve(resultsDir, 'native-form-journey.json'), JSON.stringify(evidence, null, 2));
		await reopenedSession?.close();
		await session.close();
	}
});


/** AC-only performance evidence; battery/reference acceptance remains separately pending. */
test('native form M cold open and Size/Undo/Redo measurements', async ({ browser }, testInfo) => {
	test.setTimeout(600_000);
	const ring = JSON.parse(await readFile(new URL('../../tests/lib/geometry-core/__fixtures__/regular-ring-units.json', import.meta.url), 'utf8'))['128'] as [number, number][];
	const id = uniqueProjectId('native-form-m');
	const base = await fixture(id);
	const entities = Array.from({ length: 60 }, (_, i) => ({ ...form('plan', 1 + (i % 10) * 0.7), id: `form-m-${i}`,
		name: `M form ${i}`, position: [1 + (i % 10) * 0.7, 0, 1 + Math.floor(i / 10) * 0.9] as [number, number, number],
		form: { generator: { kind: 'extrude' as const, plane: 'plan' as const, extent: 0.5 + i * 0.01,
			outline: ring.map(([u, v], index) => ({ key: index + 1, u: u * 0.28, v: v * 0.28, smooth: true })) }, scale: [1, 1, 1] as [number, number, number], nextKey: 129 }
	}));
	const source = await createUnitProject({ id, name: 'Native form M workload', layout: base.units.layout.data,
		scene: { formatVersion: 1, entities, textures: [], materials: [], navigationNodes: [], connections: [] } });
	const login = await loginAs({ user: 'agent-admin', apiOrigin, secret: process.env.E2E_TEST_AUTH_SECRET!, origin: editorOrigin });
	const equals = login.cookie.indexOf('=');
	const runs: unknown[] = [];
	try {
		for (let run = -1; run < 10; run++) {
			const session = await newMeasuredSession(browser, { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, network: 'N1', cacheState: 'cold' });
			const { page, context } = session;
			try {
				page.on('dialog', (dialog) => void dialog.accept());
				await context.addCookies([{ name: login.cookie.slice(0, equals), value: login.cookie.slice(equals + 1), domain: new URL(editorOrigin).hostname, path: '/', httpOnly: true, secure: false }]);
				await gotoCreateIntent(page, id);
				await page.getByRole('button', { name: 'Begin empty', exact: true }).click();
				const chooser = page.waitForEvent('filechooser');
				await page.getByRole('button', { name: 'Open source JSON', exact: true }).click();
				await page.getByRole('alertdialog', { name: 'Replace project' }).getByRole('button', { name: 'Replace', exact: true }).click();
				await (await chooser).setFiles({ name: 'native-form-m.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
				await expect(page.getByRole('heading', { name: 'Native form M workload', exact: true })).toBeVisible();
				await renderedForms(page, 'stage', entities.map((entity) => entity.id));
				await waitForCameraSettled(page);
				const openLedger = await readLedger(page);
				await setStageReading(page, 'Plan');
				await clickWorld(page, [1, 0, 1]);
				await expect(page.locator(CARD)).toContainText('form-m-0');
				await selectFromIndex(page, 'M form 0');
				await page.getByLabel('Form height (m)', { exact: true }).fill('0.6');
				await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Size', exact: true }).click());
				await expect.poll(() => commandPresentation(page, 'command:scene-form')).not.toBeNull();
				const sizeMs = await commandPresentation(page, 'command:scene-form');
				const history: Record<string, number | null> = {};
				for (const label of ['Undo', 'Redo'] as const) {
					const count = await acceptedResultCount(page);
					await page.getByRole('button', { name: label, exact: true }).click();
					await expect.poll(() => acceptedResultCount(page)).toBeGreaterThan(count);
					await expect.poll(() => commandPresentation(page, `command:${label.toLowerCase()}`)).not.toBeNull();
					history[label] = await commandPresentation(page, `command:${label.toLowerCase()}`);
				}
				if (run >= 0) runs.push({ run, openLedger, sizeMs, history, ledger: await readLedger(page) });
			} finally { await session.close(); }
		}
	} finally {
		await writeFile(resolve(resultsDir, 'native-form-m-performance.json'), JSON.stringify({ browser: testInfo.project.name, version: browser.version(), profile: 'AC-only; battery acceptance pending', warmup: 1, measuredRuns: 10, forms: 60, smoothAnchors: 128, runs }, null, 2));
	}
});
