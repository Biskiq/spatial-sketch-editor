/**
 * T5.P01.S03 — integrated final-gate browser acceptance.
 *
 * On-demand QA, not a benchmark and not part of a Vitest lane. It drives the
 * shipped editor against the real API and a task-private database through the
 * API test-auth seam, and records a row plus a screenshot for every scenario it
 * can observe. The exhaustive plan asks for the integrated creator journey, the
 * two-project My Objects lifecycle, cold reopen, Undo/Redo, Plan/3D/Preview
 * parity and the refusal paths; this spec is that route.
 *
 * Run through `perf/run-t1-s04-integrated-qa.mjs` with
 * `T1_S04_QA_SPEC=perf/flows/t5-p01-s03-integrated-final-gate.spec.ts`.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { formMeshDigest } from '@portfolio/geometry-core';
import type { SceneFormSource } from '@portfolio/project-model';
import { canonicalUnitJson } from '@portfolio/project-model/units';
import { evaluateSceneForm } from '@portfolio/project-model/scene-planning';
import { expect, test, type Browser, type Dialog, type Page } from '@playwright/test';

import { loginAs, TEST_AUTH_SESSION_COOKIE } from '../../tests/e2e/test-auth';
import { acceptedResultCount, uniqueProjectId, waitForAcceptedResult } from '../lib/flow';
import { perfInitScript } from '../lib/ledger';

const apiOrigin = process.env.PERF_API_ORIGIN;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const resultsDir = process.env.PERF_RESULTS_DIR;
if (!apiOrigin || !authSecret || !resultsDir) {
	throw new Error('PERF_API_ORIGIN, E2E_TEST_AUTH_SECRET and PERF_RESULTS_DIR are required');
}

const REVISION = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8' }).trim();
const STAGE = '[role="application"][aria-label="Spatial stage"]';
const DOCK = '[data-stage-dock]';
const INK = '[data-layout-ink-palette]';
const CARD = 'aside.card';
const evidencePath = resolve(resultsDir, 't5-p01-s03-integrated-evidence.json');

type Entity = {
	readonly id: string;
	readonly name: string;
	readonly kind: string;
	readonly position: [number, number, number];
	readonly rotation: [number, number, number];
	form?: SceneFormSource;
};

type SceneSource = {
	readonly units: {
		readonly layout: { readonly data: { readonly walls: unknown[]; readonly junctions: unknown[]; readonly rooms: unknown[] } };
		readonly scene: { readonly header: { formatVersion: number; contentRevision: string }; readonly data: { formatVersion: number; entities: Entity[] } };
		readonly resources?: { readonly data?: { readonly resources?: unknown[] } };
	};
	readonly dependencyLock?: { readonly entries?: unknown[] };
};

type Row = {
	readonly id: string;
	readonly scenario: string;
	readonly status: 'passed' | 'failed' | 'not-run';
	readonly detail: string;
	readonly revision: string;
	readonly viewport: string;
	readonly reducedMotion: boolean;
	readonly url: string;
	readonly screenshot?: string;
	readonly digest?: string;
};

type Session = {
	readonly page: Page;
	readonly context: Awaited<ReturnType<Browser['newContext']>>;
	readonly close: () => Promise<void>;
	readonly errors: string[];
};

function cookieForBrowser(pair: string, baseURL: string) {
	const equals = pair.indexOf('=');
	if (equals < 1) throw new Error('test-auth did not return a cookie pair');
	const name = pair.slice(0, equals);
	if (name !== TEST_AUTH_SESSION_COOKIE) throw new Error(`unexpected session cookie ${name}`);
	return {
		name,
		value: pair.slice(equals + 1),
		domain: new URL(baseURL).hostname,
		path: '/',
		httpOnly: true,
		secure: false
	};
}

async function session(
	browser: Browser,
	baseURL: string,
	options: { viewport: { width: number; height: number }; reducedMotion?: 'no-preference' | 'reduce' }
): Promise<Session> {
	const context = await browser.newContext({
		viewport: options.viewport,
		deviceScaleFactor: 1,
		reducedMotion: options.reducedMotion ?? 'no-preference',
		serviceWorkers: 'block',
		locale: 'en-US',
		timezoneId: 'UTC'
	});
	await context.addInitScript(perfInitScript, {});
	const auth = await loginAs({
		user: 'agent-admin',
		apiOrigin: apiOrigin!,
		secret: authSecret!,
		origin: baseURL
	});
	await context.addCookies([cookieForBrowser(auth.cookie, baseURL)]);
	const page = await context.newPage();
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error' && /THREE|Shader|Uncaught/.test(message.text())) errors.push(message.text());
	});
	return { page, context, errors, close: () => context.close() };
}

async function startEmpty(page: Page, id: string): Promise<void> {
	await page.goto(`/project/${encodeURIComponent(id)}/spatial?create=1`);
	await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeVisible();
	await page.getByRole('button', { name: 'Begin empty', exact: true }).click();
	await expect(page.locator(STAGE)).toBeVisible({ timeout: 60_000 });
	await expect(page.locator(DOCK)).toBeVisible();
	await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
	await page.waitForTimeout(600);
}

async function startStarter(page: Page, id: string): Promise<void> {
	await page.goto(`/project/${encodeURIComponent(id)}/spatial?create=1`);
	await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeVisible();
	await page.getByRole('button', { name: 'Enclosed room', exact: true }).click();
	await expect(page.locator(STAGE)).toBeVisible({ timeout: 60_000 });
	await expect(page.locator(DOCK)).toBeVisible();
	await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
	await page.waitForTimeout(800);
}

async function gotoHub(page: Page): Promise<void> {
	// The route's unsaved-work guard can answer a full navigation with a confirm;
	// this hub visit is deliberate and the project was saved before it.
	const discard = (dialog: Dialog) => (dialog.type() === 'confirm' ? dialog.accept() : dialog.dismiss());
	page.on('dialog', discard);
	try {
		await page.goto('/projects');
	} finally {
		page.off('dialog', discard);
	}
}

async function openSavedProject(page: Page, id: string): Promise<void> {
	await page.goto(`/project/${encodeURIComponent(id)}/spatial?load=1`);
	await expect(page.locator(STAGE)).toBeVisible({ timeout: 90_000 });
	await expect(page.locator(DOCK)).toBeVisible();
	await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
	await waitForCameraSettled(page);
	await page.waitForTimeout(800);
}

async function cameraPose(page: Page): Promise<string> {
	return page.evaluate(() => {
		type Camera = { matrixWorld: { elements: number[] }; projectionMatrix: { elements: number[] } };
		const camera = (window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { camera?: Camera }> })
			.__BISKIQ_PERF_RENDER_REFS__?.stage?.camera;
		return camera === undefined
			? ''
			: [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]
					.map((value) => value.toFixed(6))
					.join(',');
	});
}

async function waitForCameraSettled(page: Page, timeout = 20_000): Promise<void> {
	const started = Date.now();
	let previous: string | null = null;
	await page.waitForTimeout(400);
	while (Date.now() - started < timeout) {
		const pose = await cameraPose(page);
		if (pose !== '' && pose === previous) return;
		if (pose !== '') previous = pose;
		await page.waitForTimeout(200);
	}
	throw new Error(`the Stage camera did not settle in ${timeout}ms`);
}

async function cssPoint(page: Page, point: readonly [number, number, number]): Promise<{ x: number; y: number }> {
	await page.waitForFunction(() =>
		Boolean(
			(window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { camera?: unknown }> })
				.__BISKIQ_PERF_RENDER_REFS__?.stage?.camera
		)
	);
	return page.evaluate(([x, y, z]) => {
		type Vec = { set(x: number, y: number, z: number): Vec; project(camera: unknown): Vec; x: number; y: number };
		type Camera = {
			position: { clone(): Vec };
			matrixWorld: { elements: number[] };
			matrixWorldInverse: { copy(matrix: unknown): { invert(): void } };
			projectionMatrix: unknown;
			updateMatrixWorld(force?: boolean): void;
		};
		const camera = (window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { camera?: Camera }> })
			.__BISKIQ_PERF_RENDER_REFS__?.stage?.camera;
		if (camera === undefined) throw new Error('the Stage camera is not published to the harness');
		camera.updateMatrixWorld(true);
		camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
		const vector = camera.position.clone();
		vector.set(x, y, z);
		vector.project(camera);
		const stage = document.querySelector<HTMLElement>('[role="application"][aria-label="Spatial stage"]');
		if (stage === null) throw new Error('the Stage is not mounted');
		const rect = stage.getBoundingClientRect();
		return {
			x: rect.left + (vector.x * 0.5 + 0.5) * rect.width,
			y: rect.top + (-vector.y * 0.5 + 0.5) * rect.height
		};
	}, point as [number, number, number]);
}

async function clickWorld(page: Page, point: readonly [number, number, number]): Promise<void> {
	const { x, y } = await cssPoint(page, point);
	const hit = await page.evaluate(([clientX, clientY]) => {
		const element = document.elementFromPoint(clientX, clientY);
		return element === null ? 'none' : `${element.tagName.toLowerCase()}.${String(element.className)}`;
	}, [x, y] as const);
	if (!hit.includes('canvas') && !hit.includes('stage')) {
		throw new Error(`world point ${point.join(',')} projects to ${x.toFixed(0)},${y.toFixed(0)} over ${hit}, not the Stage`);
	}
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.up();
	await page.waitForTimeout(150);
}

async function fitPlan(page: Page): Promise<void> {
	await page.locator('.stage-actions').getByRole('button', { name: 'Fit', exact: true }).click();
	await waitForCameraSettled(page);
	await page.locator('.stage-actions').getByRole('button', { name: 'Plan', exact: true }).click();
	await expect(page.locator('.stage-actions').getByRole('button', { name: 'Plan', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await waitForCameraSettled(page);
}

async function setReading(page: Page, reading: 'Plan' | '3D'): Promise<void> {
	const button = page.locator('.stage-actions').getByRole('button', { name: reading, exact: true });
	await button.click();
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	await waitForCameraSettled(page);
}

async function closeCard(page: Page): Promise<void> {
	const close = page.getByRole('button', { name: 'Close selection card' });
	if (await close.isVisible().catch(() => false)) await close.click();
}

async function armInk(page: Page): Promise<void> {
	const key = page.locator('[data-dock-tool="layout-ink"]');
	if ((await key.getAttribute('aria-pressed')) !== 'true') await key.click();
	await expect(page.locator(INK)).toBeVisible();
	await expect(key).toHaveAttribute('aria-pressed', 'true');
	await page.locator('[data-ink-reading-wall]').check();
}

async function chooseReading(page: Page, reading: 'wall' | 'opening' | 'shape'): Promise<void> {
	await armInk(page);
	const radio = page.locator(`[data-ink-reading="${reading}"]`);
	await radio.check();
	await expect(radio).toBeChecked();
	if (reading === 'shape') await expect(page.locator('[data-shape-palette]')).toBeVisible();
}

async function inkPoints(page: Page): Promise<number> {
	return page.evaluate(() => {
		const text = document.querySelector('[data-layout-ink-palette] .live')?.textContent ?? '';
		const match = /Points\s*(\d+)/.exec(text);
		return match ? Number(match[1]) : -1;
	});
}

async function shapePoints(page: Page): Promise<number> {
	return page.evaluate(() => {
		const text = document.querySelector('[data-shape-palette] .live')?.textContent ?? '';
		const match = /Points\s*(\d+)/.exec(text);
		return match ? Number(match[1]) : -1;
	});
}

async function waitForPoints(page: Page, count: number, shape = false): Promise<void> {
	await expect.poll(() => (shape ? shapePoints(page) : inkPoints(page)), { timeout: 10_000 }).toBe(count);
}

async function typePoint(page: Page, x: number, z: number, count: number): Promise<void> {
	await page.locator('[data-ink-x]').fill(String(x));
	await page.locator('[data-ink-z]').fill(String(z));
	await page.locator('[data-ink-add-point]').click();
	await waitForPoints(page, count);
}

async function clickShapePoint(page: Page, point: readonly [number, number, number], count: number): Promise<void> {
	await clickWorld(page, point);
	await waitForPoints(page, count, true);
}

async function finishWithEnter(page: Page): Promise<void> {
	await page.locator(STAGE).focus();
	await page.keyboard.press('Enter');
}

async function downloadSource(page: Page): Promise<SceneSource> {
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Download source JSON', exact: true }).click()
	]);
	const path = await download.path();
	if (path === null) throw new Error('the source download produced no local path');
	return JSON.parse(await readFile(path, 'utf8')) as SceneSource;
}

function entitiesOf(source: SceneSource): Entity[] {
	return source.units.scene.data.entities;
}

function formsOf(source: SceneSource): Entity[] {
	return entitiesOf(source).filter((entity) => entity.kind === 'form');
}

function digestOf(entity: Entity): string {
	if (entity.form === undefined) throw new Error(`${entity.id} is not a form`);
	return formMeshDigest(evaluateSceneForm(entity.form));
}

function digestMap(source: SceneSource): Record<string, string> {
	return Object.fromEntries(formsOf(source).map((entity) => [entity.id, digestOf(entity)]));
}

async function selectSubject(page: Page, sourceId: string): Promise<void> {
	await closeCard(page);
	await page.locator('#plate-index-search').fill(sourceId);
	const row = page.locator('button.item-row', { hasText: sourceId }).first();
	await expect(row).toBeVisible();
	await row.click();
	await expect(page.locator(CARD)).toBeVisible();
}

async function saveToCloud(page: Page): Promise<void> {
	const button = page.locator('[data-head-save] button').first();
	await expect(button).toBeEnabled();
	await button.click();
	await expect(page.locator('[data-head-save]')).toHaveAttribute('data-save-status', 'saved', { timeout: 90_000 });
}

async function capture(page: Page, name: string): Promise<string> {
	await mkdir(resultsDir!, { recursive: true });
	await page.screenshot({ path: resolve(resultsDir!, name), fullPage: true, animations: 'disabled' });
	return name;
}

function row(
	id: string,
	scenario: string,
	status: Row['status'],
	detail: string,
	page: Page,
	viewport: string,
	reducedMotion: boolean,
	screenshot?: string,
	digest?: string
): Row {
	return {
		id,
		scenario,
		status,
		detail,
		revision: REVISION,
		viewport,
		reducedMotion,
		url: page.url(),
		...(screenshot === undefined ? {} : { screenshot }),
		...(digest === undefined ? {} : { digest })
	};
}

async function writeRows(rows: readonly Row[]): Promise<void> {
	let evidence: Record<string, unknown> = {
		flow: 'T5.P01.S03 integrated final-gate browser acceptance',
		revision: REVISION,
		apiOrigin,
		browser: 'chromium',
		generatedAt: new Date().toISOString(),
		rows: []
	};
	try {
		evidence = JSON.parse(await readFile(evidencePath, 'utf8')) as Record<string, unknown>;
	} catch {
		/* first row */
	}
	const existing = (evidence.rows as Row[] | undefined) ?? [];
	evidence.rows = [...existing, ...rows];
	evidence.generatedAt = new Date().toISOString();
	await mkdir(resultsDir!, { recursive: true });
	await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
}

async function accepted(page: Page, action: () => Promise<unknown>): Promise<number> {
	const before = await acceptedResultCount(page);
	await action();
	await waitForAcceptedResult(page, before);
	return before;
}

async function undoRedo(page: Page, expectedBefore: Entity[], expectedAfter: Entity[]): Promise<void> {
	await accepted(page, () => page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click());
	expect(entitiesOf(await downloadSource(page))).toEqual(expectedBefore);
	await accepted(page, () => page.locator('[data-editor-history]').getByRole('button', { name: 'Redo', exact: true }).click());
	expect(entitiesOf(await downloadSource(page))).toEqual(expectedAfter);
}

async function renderedForms(
	page: Page,
	surface: 'stage' | 'preview',
	ids: readonly string[]
): Promise<{ id: string; positions: number[]; index: number[]; world: number[] }[]> {
	await expect
		.poll(
			() =>
				page.evaluate(({ surface, ids }) => {
					const scene = (window as any).__BISKIQ_PERF_RENDER_REFS__?.[surface]?.scene;
					return ids.every((id) => {
						const root = scene?.getObjectByName(`SceneEntity:${id}`);
						return root?.getObjectByProperty('isMesh', true) !== undefined;
					});
				}, { surface, ids }),
			{ timeout: 60_000 }
		)
		.toBe(true);
	return page.evaluate(({ surface, ids }) => {
		const scene = (window as any).__BISKIQ_PERF_RENDER_REFS__[surface].scene;
		return ids.map((id) => {
			const mesh = scene.getObjectByName(`SceneEntity:${id}`).getObjectByProperty('isMesh', true);
			mesh.updateWorldMatrix(true, false);
			return {
				id,
				positions: Array.from(mesh.geometry.attributes.position.array),
				index: Array.from(mesh.geometry.index?.array ?? []),
				world: Array.from(mesh.matrixWorld.elements)
			};
		});
	}, { surface, ids });
}

async function projectSummary(page: Page, id: string) {
	const response = await page.context().request.get(`${apiOrigin}/projects`);
	expect(response.status()).toBe(200);
	const body = (await response.json()) as { projects: { id: string; name: string }[] };
	return body.projects.find((project) => project.id === id) ?? null;
}

async function libraryItems(page: Page) {
	const response = await page.context().request.get(`${apiOrigin}/library/items`);
	expect(response.status()).toBe(200);
	return ((await response.json()) as { items: { id: string; name: string; contentId: string; formatVersion: number }[] }).items;
}

async function libraryPayload(page: Page, itemId: string) {
	const response = await page.context().request.get(`${apiOrigin}/library/items/${encodeURIComponent(itemId)}`);
	expect(response.status()).toBe(200);
	return {
		contentId: response.headers()['etag']?.replaceAll('"', '') ?? '',
		payload: (await response.json()) as {
			formatVersion: number;
			kind: 'form';
			name: string;
			form: NonNullable<Entity['form']>;
		}
	};
}

async function cloudEntities(page: Page, projectId: string): Promise<Entity[]> {
	const response = await page.context().request.get(`${apiOrigin}/projects/${encodeURIComponent(projectId)}`);
	expect(response.status()).toBe(200);
	const body = (await response.json()) as { document: SceneSource };
	return entitiesOf(body.document);
}

function hashedRevision(data: unknown): string {
	return `sha256-${createHash('sha256').update(canonicalUnitJson(data)).digest('hex')}`;
}

async function importSource(page: Page, source: unknown): Promise<void> {
	const chooserPromise = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Open source JSON', exact: true }).click();
	const dialog = page.getByRole('alertdialog', { name: 'Replace project' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Replace', exact: true }).click();
	const chooser = await chooserPromise;
	await chooser.setFiles({
		name: 's03-refusal.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(source))
	});
}

async function openMyObjects(page: Page): Promise<void> {
	// A selected form's Card can cover the instrument; dismiss it without clearing
	// the selection, then open Place object from the Index the way a creator does.
	await closeCard(page);
	const placeTask = page.locator('.contributed-item button.item-row', { hasText: 'Place object' }).first();
	await expect(placeTask).toBeVisible({ timeout: 20_000 });
	await placeTask.click();
	await expect(page.locator('[data-stage-instrument]')).toBeVisible();
	const toggle = page.locator('[data-my-objects-toggle]').first();
	await expect(toggle).toBeVisible({ timeout: 20_000 });
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
	await expect(page.locator('[data-my-objects]')).toBeVisible({ timeout: 20_000 });
}

async function insertCopy(page: Page, itemId: string, x: number, z: number): Promise<void> {
	await openMyObjects(page);
	const item = page.locator(`[data-my-objects-item="${itemId}"]`);
	await expect(item).toBeVisible({ timeout: 30_000 });
	await item.locator('[data-my-objects-insert]').click();
	await expect(item.getByText('Ready to place', { exact: true })).toBeVisible({ timeout: 30_000 });
	const placeRow = page.locator('.row.place');
	const inputs = placeRow.locator('input');
	await inputs.nth(0).fill(String(x));
	await inputs.nth(1).fill(String(z));
	const before = await acceptedResultCount(page);
	await placeRow.getByRole('button', { name: 'Place', exact: true }).click();
	await waitForAcceptedResult(page, before);
	await expect(page.locator('.form-fields')).toBeVisible({ timeout: 30_000 });
}

/** The rendered mesh centre in world space, so a Plan pick lands inside the body. */
function meshCenter(entry: { positions: number[]; world: number[] }): [number, number, number] {
	let x = 0;
	let y = 0;
	let z = 0;
	const count = entry.positions.length / 3;
	for (let index = 0; index < entry.positions.length; index += 3) {
		x += entry.positions[index]!;
		y += entry.positions[index + 1]!;
		z += entry.positions[index + 2]!;
	}
	x /= count;
	y /= count;
	z /= count;
	const m = entry.world;
	return [
		m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
		m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
		m[2]! * x + m[6]! * y + m[10]! * z + m[14]!
	];
}

test.describe.configure({ mode: 'serial' });

let projectA = '';
let projectAName = '';
let projectB = '';
let itemId = '';
let itemContentId = '';
let itemForm: SceneFormSource | null = null;
let aSavedEntities: Entity[] = [];
let aSavedDigests: Record<string, string> = {};
let firstFormId = '';

test('S03 integrated creator journey from an empty project', async ({ browser, baseURL }) => {
	test.setTimeout(900_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
	const rows: Row[] = [];
	const viewport = '1440x900';
	const reducedMotion = false;
	const { page, errors } = started;
	try {
		projectA = uniqueProjectId('t5-s03-a');
		await startEmpty(page, projectA);

		// The enclosure is the shipped Ink route and the floor later placement needs.
		await armInk(page);
		await typePoint(page, 2, -2, 1);
		await typePoint(page, 6, -2, 2);
		await typePoint(page, 6, 2, 3);
		await typePoint(page, 2, 2, 4);
		const closeBefore = await acceptedResultCount(page);
		await page.locator('[data-ink-close]').click();
		await waitForAcceptedResult(page, closeBefore);
		const enclosed = await downloadSource(page);
		expect(enclosed.units.layout.data.rooms).toHaveLength(1);
		await accepted(page, () => page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click());
		expect((await downloadSource(page)).units.layout.data.rooms).toHaveLength(0);
		await accepted(page, () => page.locator('[data-editor-history]').getByRole('button', { name: 'Redo', exact: true }).click());
		expect((await downloadSource(page)).units.layout.data.rooms).toHaveLength(1);
		rows.push(row('layout.close', 'Draw and close the Room, then Undo/Redo it', 'passed', '4 Walls / 1 Room; Undo removed the Room and Redo restored it', page, viewport, reducedMotion, await capture(page, 't5-s03-01-empty-room.png')));

		// A floor rectangle is the first of the walkthrough's three objects.
		await fitPlan(page);
		await armInk(page);
		await chooseReading(page, 'shape');
		await clickShapePoint(page, [3, 0, 1.4], 1);
		await clickShapePoint(page, [5, 0, 1.4], 2);
		await clickShapePoint(page, [5, 0, 0.4], 3);
		await clickShapePoint(page, [3, 0, 0.4], 4);
		await finishWithEnter(page);
		await expect(page.locator('[data-shape-depth]')).toBeVisible();
		await page.locator('[data-shape-depth]').fill('1.2');
		await page.locator('[data-shape-depth]').press('Tab');
		const createBefore = await acceptedResultCount(page);
		await page.locator('[data-shape-create]').click();
		await waitForAcceptedResult(page, createBefore);
		const created = await downloadSource(page);
		const createdForms = formsOf(created);
		expect(createdForms).toHaveLength(1);
		const formEntity = createdForms[0]!;
		firstFormId = formEntity.id;
		const createdDigest = digestOf(formEntity);
		expect(formEntity.form?.generator).toMatchObject({ kind: 'extrude', plane: 'plan', extent: 1.2 });
		rows.push(row('shape.floor.create', 'Create a floor native form', 'passed', `1 form ${formEntity.id}; plan extrude 1.2 m`, page, viewport, reducedMotion, await capture(page, 't5-s03-02-floor-form.png'), createdDigest));

		// Creation is one history entry; Undo removes it and Redo restores the exact source.
		await undoRedo(page, [], createdForms);
		rows.push(row('history.create', 'Create is one history entry', 'passed', 'Undo removed the form; Redo restored the identical entity', page, viewport, reducedMotion));
		await selectSubject(page, firstFormId);

		// Move, turn, size per axis, duplicate and delete, each with exact Undo/Redo.
		const beforeMove = entitiesOf(await downloadSource(page));
		await page.getByLabel('Form X (m)', { exact: true }).fill('3');
		await page.getByLabel('Form Z (m)', { exact: true }).fill('1');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Move', exact: true }).click());
		const afterMove = entitiesOf(await downloadSource(page));
		await undoRedo(page, beforeMove, afterMove);
		const moved = afterMove.find((entity) => entity.id === firstFormId);
		rows.push(row('edit.move', 'Move is one history entry', 'passed', `position ${JSON.stringify(moved?.position)}; Undo/Redo exact`, page, viewport, reducedMotion));

		await selectSubject(page, firstFormId);
		const beforeTurn = entitiesOf(await downloadSource(page));
		await page.getByLabel('Form yaw (rad)', { exact: true }).fill('0.4');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Turn', exact: true }).click());
		const afterTurn = entitiesOf(await downloadSource(page));
		await undoRedo(page, beforeTurn, afterTurn);
		rows.push(row('edit.turn', 'Turn is one history entry', 'passed', 'yaw 0.4 written; Undo/Redo exact', page, viewport, reducedMotion));

		await selectSubject(page, firstFormId);
		const beforeSize = entitiesOf(await downloadSource(page));
		await page.getByLabel('Form width (m)', { exact: true }).fill('3');
		await page.getByLabel('Form height (m)', { exact: true }).fill('1.2');
		await page.getByLabel('Form depth (m)', { exact: true }).fill('2');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Size', exact: true }).click());
		const afterSize = entitiesOf(await downloadSource(page));
		await undoRedo(page, beforeSize, afterSize);
		rows.push(row('edit.size', 'Size per axis is one history entry', 'passed', 'width 3 / height 1.2 / depth 2; Undo/Redo exact', page, viewport, reducedMotion, await capture(page, 't5-s03-03-sized.png')));

		// A no-op edit names itself and adds no history.
		await selectSubject(page, firstFormId);
		const noOpCount = await acceptedResultCount(page);
		await page.locator('.form-fields').getByRole('button', { name: 'Size', exact: true }).click();
		await expect(page.locator('.form-fields').getByRole('status')).toContainText('No change');
		expect(await acceptedResultCount(page)).toBe(noOpCount);
		rows.push(row('edit.no-op', 'Unchanged Size adds no history', 'passed', '“No change.” shown; accepted-result count unchanged', page, viewport, reducedMotion));

		await selectSubject(page, firstFormId);
		const beforeDuplicate = entitiesOf(await downloadSource(page));
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Duplicate', exact: true }).click());
		const afterDuplicate = entitiesOf(await downloadSource(page));
		expect(afterDuplicate.filter((entity) => entity.kind === 'form')).toHaveLength(2);
		await undoRedo(page, beforeDuplicate, afterDuplicate);
		rows.push(row('edit.duplicate', 'Duplicate is one history entry', 'passed', 'one detached copy; Undo/Redo exact', page, viewport, reducedMotion));

		await selectSubject(page, firstFormId);
		const duplicate = afterDuplicate.find((entity) => entity.kind === 'form' && entity.id !== firstFormId);
		if (duplicate === undefined) throw new Error('the duplicate has no new entity id');
		await selectSubject(page, duplicate.id);
		const beforeDelete = entitiesOf(await downloadSource(page));
		await page.getByRole('button', { name: 'Delete form', exact: true }).click();
		await page.getByRole('button', { name: 'Confirm Delete form', exact: true }).click();
		await expect.poll(async () => formsOf(await downloadSource(page)).length, { timeout: 30_000 }).toBe(1);
		const afterDelete = entitiesOf(await downloadSource(page));
		await undoRedo(page, beforeDelete, afterDelete);
		rows.push(row('edit.delete', 'Delete is one history entry', 'passed', `removed ${duplicate.id}; Undo/Redo exact`, page, viewport, reducedMotion));

		// Refused, cancelled and invalid-depth edits add no history. The Card is
		// dismissed for the Ink leg so it cannot cover the reading controls.
		await selectSubject(page, firstFormId);
		await closeCard(page);
		const refusalBase = await acceptedResultCount(page);
		await chooseReading(page, 'shape');
		for (const [index, point] of ([
			[2.5, 0, 1.8],
			[3.5, 0, 0.8],
			[3.5, 0, 1.8],
			[2.5, 0, 0.8]
		] as const).entries()) {
			await clickShapePoint(page, point, index + 1);
		}
		const invalidRefusal = page.locator('[data-shape-refusal]');
		await expect(invalidRefusal).toBeVisible();
		await expect(invalidRefusal).toContainText(/crosses itself/i);
		await expect(page.locator('[data-shape-finish]')).toBeDisabled();
		expect(await acceptedResultCount(page)).toBe(refusalBase);
		rows.push(row('refusal.outline', 'Self-crossing outline refuses with no history', 'passed', `${(await invalidRefusal.innerText()).trim()}; Finish disabled`, page, viewport, reducedMotion, await capture(page, 't5-s03-04-refused-outline.png')));
		await page.locator('[data-shape-clear]').click();

		await clickShapePoint(page, [3, 0, 1.8], 1);
		await clickShapePoint(page, [4, 0, 1.8], 2);
		await clickShapePoint(page, [4, 0, 1.2], 3);
		await finishWithEnter(page);
		await expect(page.locator('[data-shape-depth]')).toBeVisible();
		await page.locator('[data-shape-back]').click();
		await expect(page.locator('[data-shape-depth]')).toBeHidden();
		await expect(page.locator('[data-shape-finish]')).toBeEnabled();
		expect(await acceptedResultCount(page)).toBe(refusalBase);
		rows.push(row('refusal.depth-cancel', 'Cancelling depth restores the outline with no history', 'passed', 'Back restored Finish; no accepted result', page, viewport, reducedMotion, await capture(page, 't5-s03-05-depth-cancel.png')));

		await finishWithEnter(page);
		const depth = page.locator('[data-shape-depth]');
		await depth.fill('0');
		await depth.press('Tab');
		await expect(page.locator('[data-shape-refusal]')).toContainText(/between/i);
		await expect(page.locator('[data-shape-create]')).toBeDisabled();
		expect(await acceptedResultCount(page)).toBe(refusalBase);
		rows.push(row('refusal.depth-range', 'Invalid typed depth refuses Create', 'passed', '0 m names the admitted range; Create disabled', page, viewport, reducedMotion));
		await page.locator('[data-shape-back]').click();
		await page.locator('[data-shape-clear]').click();

		// The second object: a triangular floor form.
		await chooseReading(page, 'shape');
		// The bottom Ink instrument owns the lower screen in fitted Plan, so the
		// second body is drawn in the upper-right floor area.
		await clickShapePoint(page, [4.8, 0, 1.9], 1);
		await clickShapePoint(page, [5.8, 0, 1.9], 2);
		await clickShapePoint(page, [5.3, 0, 1.3], 3);
		await page.locator('[data-shape-finish]').click();
		await page.locator('[data-shape-depth]').fill('0.8');
		await page.locator('[data-shape-depth]').press('Tab');
		const secondBefore = await acceptedResultCount(page);
		await page.locator('[data-shape-create]').click();
		await waitForAcceptedResult(page, secondBefore);
		const twoForms = formsOf(await downloadSource(page));
		expect(twoForms).toHaveLength(2);

		// The third object: an upright elevation form on a 3D sheet.
		await closeCard(page);
		await setReading(page, '3D');
		await page.locator('.stage-actions').getByRole('button', { name: 'Fit', exact: true }).click();
		await waitForCameraSettled(page);
		await chooseReading(page, 'shape');
		await page.locator('[data-shape-plane-elevation]').check();
		await page.locator('[data-shape-x]').fill('4');
		await page.locator('[data-shape-z]').fill('0');
		await page.locator('[data-shape-yaw]').fill('0');
		await page.locator('[data-shape-sheet-apply]').click();
		for (const [index, point] of ([
			[4, 2, 0],
			[5, 2, 0],
			[4, 2.5, 0]
		] as const).entries()) {
			await clickShapePoint(page, point, index + 1);
		}
		await page.locator('[data-shape-finish]').click();
		await page.locator('[data-shape-depth]').fill('0.5');
		await page.locator('[data-shape-depth]').press('Tab');
		const uprightBefore = await acceptedResultCount(page);
		await page.locator('[data-shape-create]').click();
		await waitForAcceptedResult(page, uprightBefore);
		const threeFormsSource = await downloadSource(page);
		const threeForms = formsOf(threeFormsSource);
		expect(threeForms).toHaveLength(3);
		const upright = threeForms.find((entity) => entity.form?.generator.plane === 'elevation');
		if (upright === undefined) throw new Error('the upright form is missing');
		expect(upright.form?.generator.extent).toBeCloseTo(0.5, 3);
		const triangle = threeForms.find((entity) => entity.id !== firstFormId && entity.id !== upright.id)!;

		// Every created body accepts the shared operations: the triangle moves and
		// turns, the upright body is sized per axis where its profile lives.
		await selectSubject(page, triangle.id);
		await page.getByLabel('Form X (m)', { exact: true }).fill('3');
		await page.getByLabel('Form Z (m)', { exact: true }).fill('-1');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Move', exact: true }).click());
		await page.getByLabel('Form yaw (rad)', { exact: true }).fill('0.2');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Turn', exact: true }).click());
		await page.getByLabel('Form width (m)', { exact: true }).fill('1.5');
		await page.getByLabel('Form height (m)', { exact: true }).fill('0.8');
		await page.getByLabel('Form depth (m)', { exact: true }).fill('0.8');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Size', exact: true }).click());

		await selectSubject(page, upright.id);
		await page.getByLabel('Form width (m)', { exact: true }).fill('1');
		await page.getByLabel('Form height (m)', { exact: true }).fill('0.6');
		await page.getByLabel('Form depth (m)', { exact: true }).fill('0.5');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Size', exact: true }).click());
		await page.getByLabel('Form yaw (rad)', { exact: true }).fill('0.1');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Turn', exact: true }).click());
		rows.push(row('walkthrough.three-objects', 'Three different objects from an empty project', 'passed', `floor rectangle ${firstFormId}, floor triangle ${triangle.id}, upright ${upright.id}; each accepts Move/Turn/Size`, page, viewport, reducedMotion, await capture(page, 't5-s03-06-three-forms.png')));

		// Save to My Objects: outside authoring history and outside project dirtiness.
		await selectSubject(page, firstFormId);
		const saveCount = await acceptedResultCount(page);
		await page.locator('[data-save-to-my-objects]').click();
		await expect(page.locator('.form-fields').getByRole('status')).toContainText(/Saved .* to My Objects/, { timeout: 30_000 });
		expect(await acceptedResultCount(page)).toBe(saveCount);
		const items = await libraryItems(page);
		expect(items).toHaveLength(1);
		itemId = items[0]!.id;
		itemContentId = items[0]!.contentId;
		const item = await libraryPayload(page, itemId);
		itemForm = item.payload.form;
		expect(item.payload.formatVersion).toBe(1);
		expect(item.payload.kind).toBe('form');
		expect(item.payload.form).toEqual(formsOf(threeFormsSource).find((entity) => entity.id === firstFormId)?.form);
		rows.push(row('my-objects.save', 'Save a selected form to My Objects', 'passed', `item ${itemId}; content ${itemContentId}; no history entry`, page, viewport, reducedMotion, await capture(page, 't5-s03-07-saved-item.png'), itemContentId));

		// Experience + Capture make Preview enterable; both are saved with A. The
		// Card is dismissed first so it cannot cover the lens controls.
		await closeCard(page);
		await page.locator('.lens-button', { hasText: 'Experience' }).click();
		const lens = page.getByRole('region', { name: 'Experience lens' });
		await expect(lens).toBeVisible({ timeout: 30_000 });
		await lens.getByRole('button', { name: 'Create Experience', exact: true }).click();
		await expect(lens.getByText('Accepted.')).toBeVisible({ timeout: 30_000 });
		await setReading(page, '3D');
		await page.getByRole('toolbar', { name: 'Experience dock' }).getByRole('button', { name: 'Capture', exact: true }).click();
		await expect(lens.getByText('Accepted.')).toBeVisible({ timeout: 30_000 });

		await saveToCloud(page);
		const savedSource = await downloadSource(page);
		aSavedEntities = entitiesOf(savedSource);
		aSavedDigests = digestMap(savedSource);
		const project = await projectSummary(page, projectA);
		expect(project).not.toBeNull();
		projectAName = project!.name;

		// Cold reopen in a fresh browser session.
		const reopened = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
		try {
			const fresh = reopened.page;
			await openSavedProject(fresh, projectA);
			await expect(fresh.locator(STAGE)).toBeVisible({ timeout: 90_000 });
			const reopenedSource = await downloadSource(fresh);
			expect(entitiesOf(reopenedSource)).toEqual(aSavedEntities);
			expect(digestMap(reopenedSource)).toEqual(aSavedDigests);
			rows.push(row('cold-reopen.a', 'Save and cold reopen project A', 'passed', `all ${savedSource.units.scene.data.entities.length} entities and form digests identical`, fresh, viewport, reducedMotion, await capture(fresh, 't5-s03-08-reopened-a.png'), JSON.stringify(aSavedDigests)));

			// Plan and 3D are the same accepted entities and rendered geometry.
			const ids = formsOf(reopenedSource).map((entity) => entity.id);
			await setReading(fresh, '3D');
			const stage3d = await renderedForms(fresh, 'stage', ids);
			const planShotBase = await capture(fresh, 't5-s03-09-plan-parity.png');
			await setReading(fresh, 'Plan');
			const stagePlan = await renderedForms(fresh, 'stage', ids);
			expect(stagePlan).toEqual(stage3d);
			for (const entity of formsOf(reopenedSource)) {
				const mesh = stagePlan.find((entry) => entry.id === entity.id);
				if (mesh === undefined) throw new Error(`${entity.id} has no Plan mesh`);
				await clickWorld(fresh, meshCenter(mesh));
				await expect(fresh.locator(CARD)).toContainText(entity.name, { timeout: 20_000 });
				await closeCard(fresh);
			}
			rows.push(row('parity.plan-3d', 'Plan and 3D show the same forms', 'passed', `${ids.length} forms; rendered positions/world matrices identical; every Plan pick selected its form`, fresh, viewport, reducedMotion, planShotBase));

			// Preview renders the same forms from the same accepted source.
			await setReading(fresh, '3D');
			const preview = fresh.locator('[data-head-preview] button');
			await expect(preview).toBeEnabled({ timeout: 60_000 });
			await preview.click();
			await expect(fresh.locator('[aria-label="Visitor preview canvas"]')).toBeVisible({ timeout: 90_000 });
			const previewForms = await renderedForms(fresh, 'preview', ids);
			expect(previewForms).toEqual(stage3d);
			const previewShot = await capture(fresh, 't5-s03-10-preview-parity.png');
			const exit = fresh.getByRole('button', { name: /Exit Preview/ });
			if (await exit.isVisible().catch(() => false)) await exit.click();
			else await fresh.keyboard.press('Escape');
			await expect(fresh.locator(STAGE)).toBeVisible({ timeout: 30_000 });
			expect(entitiesOf(await downloadSource(fresh))).toEqual(aSavedEntities);
			rows.push(row('parity.preview', 'Preview renders the same forms without writing', 'passed', `${ids.length} preview meshes identical to Stage; source unchanged`, fresh, viewport, reducedMotion, previewShot));

			expect(reopened.errors).toEqual([]);
		} finally {
			await reopened.close();
		}

		// Scene format 3 and a malformed form are refused, leaving A unchanged.
		const format3 = structuredClone(await downloadSource(page));
		format3.units.scene.header.formatVersion = 3;
		format3.units.scene.data.formatVersion = 3;
		format3.units.scene.header.contentRevision = hashedRevision(format3.units.scene.data);
		const beforeImports = entitiesOf(await downloadSource(page));
		await importSource(page, format3);
		await expect(page.locator('.stage-note')).toContainText(/not the current document format|unchanged/i, { timeout: 30_000 });
		expect(entitiesOf(await downloadSource(page))).toEqual(beforeImports);
		rows.push(row('refusal.scene-format-3', 'Scene format 3 is refused', 'passed', `${(await page.locator('.stage-note').innerText()).trim()}`, page, viewport, reducedMotion, await capture(page, 't5-s03-11-format-3.png')));

		const malformed = structuredClone(await downloadSource(page));
		const malformedForm = formsOf(malformed)[0]!;
		if (malformedForm.form === undefined) throw new Error('the malformed fixture names no form');
		malformedForm.form = {
			...malformedForm.form,
			generator: {
				...malformedForm.form.generator,
				outline: [
					{ key: 1, u: 0, v: 0, smooth: false },
					{ key: 2, u: 1, v: 1, smooth: false },
					{ key: 3, u: 1, v: 0, smooth: false },
					{ key: 4, u: 0, v: 1, smooth: false }
				]
			}
		};
		malformed.units.scene.header.contentRevision = hashedRevision(malformed.units.scene.data);
		await importSource(page, malformed);
		await expect(page.locator('.stage-note')).toContainText(/unchanged/i, { timeout: 30_000 });
		expect(entitiesOf(await downloadSource(page))).toEqual(beforeImports);
		rows.push(row('refusal.malformed-form', 'A malformed form is refused', 'passed', `${(await page.locator('.stage-note').innerText()).trim()}`, page, viewport, reducedMotion, await capture(page, 't5-s03-12-malformed.png')));

		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(row('main.test', 'integrated S03 creator journey', 'failed', error instanceof Error ? error.message : String(error), page, viewport, reducedMotion));
		throw error;
	} finally {
		await writeRows(rows);
		await started.close();
	}
});

test('S03 two-project My Objects lifecycle', async ({ browser, baseURL }) => {
	test.setTimeout(900_000);
	expect(itemId).not.toBe('');
	expect(itemForm).not.toBeNull();
	expect(aSavedEntities.length).toBeGreaterThan(0);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
	const rows: Row[] = [];
	const viewport = '1440x900';
	const reducedMotion = false;
	const { page, errors } = started;
	try {
		projectB = uniqueProjectId('t5-s03-b');
		await startStarter(page, projectB);
		expect((await downloadSource(page)).units.layout.data.rooms.length).toBeGreaterThan(0);

		// Insert an editable copy of the saved item from project A.
		const beforeInsert = entitiesOf(await downloadSource(page));
		await insertCopy(page, itemId, 3, 0);
		const afterInsert = entitiesOf(await downloadSource(page));
		const copies = afterInsert.filter((entity) => entity.kind === 'form');
		expect(copies).toHaveLength(beforeInsert.filter((entity) => entity.kind === 'form').length + 1);
		const copy = copies.find((entity) => !beforeInsert.some((old) => old.id === entity.id));
		if (copy === undefined) throw new Error('the inserted copy has no new entity id');
		expect(copy.form).toEqual(itemForm);
		expect(JSON.stringify(copy)).not.toContain(itemId);
		const copyDigest = digestOf(copy);
		rows.push(row('my-objects.insert', 'Insert a saved form as an editable copy', 'passed', `copy ${copy.id}; form source identical to item ${itemId}; no item reference`, page, viewport, reducedMotion, await capture(page, 't5-s03-13-inserted-copy.png'), copyDigest));

		await undoRedo(page, beforeInsert, afterInsert);
		rows.push(row('my-objects.insert-history', 'Insertion is one exact history entry', 'passed', 'Undo removed the copy; Redo restored identical source', page, viewport, reducedMotion));
		await selectSubject(page, copy.id);

		// A second insertion is an independent entity.
		const beforeSecond = entitiesOf(await downloadSource(page));
		await insertCopy(page, itemId, 4.5, 0);
		const afterSecond = entitiesOf(await downloadSource(page));
		const second = afterSecond.find((entity) => entity.kind === 'form' && !beforeSecond.some((old) => old.id === entity.id));
		if (second === undefined) throw new Error('the second insertion has no entity');
		expect(second.id).not.toBe(copy.id);
		expect(second.form).toEqual(itemForm);
		rows.push(row('my-objects.second-copy', 'Two insertions are independent entities', 'passed', `${copy.id} and ${second.id} share the saved source but not identity`, page, viewport, reducedMotion));

		// Refine the first copy; the item and A's original must not move. Leaving
		// Place object first keeps its instrument off the Card's controls.
		const closePlace = page.getByRole('button', { name: 'Close Place object' });
		if (await closePlace.isVisible().catch(() => false)) await closePlace.click();
		await selectSubject(page, copy.id);
		await page.getByLabel('Form width (m)', { exact: true }).fill('1.5');
		await page.getByLabel('Form height (m)', { exact: true }).fill('1');
		await page.getByLabel('Form depth (m)', { exact: true }).fill('1');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Size', exact: true }).click());
		await page.getByLabel('Form X (m)', { exact: true }).fill('3.4');
		await page.getByLabel('Form Z (m)', { exact: true }).fill('0.2');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Move', exact: true }).click());
		await page.getByLabel('Form yaw (rad)', { exact: true }).fill('0.25');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Turn', exact: true }).click());
		const refined = formsOf(await downloadSource(page)).find((entity) => entity.id === copy.id);
		if (refined === undefined) throw new Error('the refined copy disappeared');
		expect(refined.form).not.toEqual(itemForm);
		const itemAfter = await libraryPayload(page, itemId);
		expect(itemAfter.payload.form).toEqual(itemForm);
		expect(itemAfter.contentId).toBe(itemContentId);
		const aAfter = await cloudEntities(page, projectA);
		const aForm = aAfter.find((entity) => entity.id === firstFormId);
		expect(aForm?.form).toEqual(aSavedEntities.find((entity) => entity.id === firstFormId)?.form);
		rows.push(row('my-objects.independence', 'Copy edits reach neither the item nor project A', 'passed', `copy scale/pose changed; item ${itemContentId} and A ${firstFormId} unchanged`, page, viewport, reducedMotion, await capture(page, 't5-s03-14-copy-refined.png')));

		await saveToCloud(page);
		const bSavedSource = await downloadSource(page);
		const bSavedEntities = entitiesOf(bSavedSource);
		const bDigests = digestMap(bSavedSource);
		expect(bSavedSource.units.resources?.data?.resources ?? []).toEqual([]);
		expect(bSavedSource.dependencyLock?.entries ?? []).toEqual([]);
		expect(JSON.stringify(bSavedSource)).not.toContain(itemId);

		// Cold reopen B in a fresh session.
		const reopened = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
		try {
			const fresh = reopened.page;
			await openSavedProject(fresh, projectB);
			const reopenedSource = await downloadSource(fresh);
			expect(entitiesOf(reopenedSource)).toEqual(bSavedEntities);
			expect(digestMap(reopenedSource)).toEqual(bDigests);
			await setReading(fresh, 'Plan');
			const ids = formsOf(reopenedSource).map((entity) => entity.id);
			const plan = await renderedForms(fresh, 'stage', ids);
			await setReading(fresh, '3D');
			const world = await renderedForms(fresh, 'stage', ids);
			expect(plan).toEqual(world);
			rows.push(row('cold-reopen.b', 'Save and cold reopen project B', 'passed', `${bSavedEntities.length} entities and ${ids.length} form digests identical; Plan/3D geometry equal`, fresh, viewport, reducedMotion, await capture(fresh, 't5-s03-15-reopened-b.png'), JSON.stringify(bDigests)));
			expect(reopened.errors).toEqual([]);
		} finally {
			await reopened.close();
		}

		// Delete project A through the shipped hub; the owner-scoped item and B survive.
		await gotoHub(page);
		await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({ timeout: 60_000 });
		await expect(page.getByRole('button', { name: `Delete ${projectAName}` })).toBeVisible({ timeout: 30_000 });
		await page.getByRole('button', { name: `Delete ${projectAName}` }).click();
		const dialog = page.locator('dialog[open]');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: `Delete ${projectAName}` }).click();
		await expect(page.getByText(/Project deleted|byte cleanup is pending/i)).toBeVisible({ timeout: 60_000 });
		expect(await projectSummary(page, projectA)).toBeNull();
		expect(await libraryItems(page)).toHaveLength(1);
		const bAfterDelete = await cloudEntities(page, projectB);
		expect(bAfterDelete).toEqual(bSavedEntities);
		rows.push(row('lifecycle.delete-a', 'Delete project A; item and B copy survive', 'passed', `A ${projectA} deleted; item ${itemId} still listed; B entities unchanged`, page, viewport, reducedMotion, await capture(page, 't5-s03-16-a-deleted.png')));

		// Remove the item; B's copies remain and B still saves.
		await openSavedProject(page, projectB);
		await openMyObjects(page);
		const item = page.locator(`[data-my-objects-item="${itemId}"]`);
		await expect(item).toBeVisible({ timeout: 30_000 });
		await item.locator('[data-my-objects-remove]').click();
		await expect(item.locator('[data-my-objects-remove]')).toContainText('Confirm remove');
		await item.locator('[data-my-objects-remove]').click();
		await expect(page.locator(`[data-my-objects-item="${itemId}"]`)).toHaveCount(0, { timeout: 30_000 });
		expect(await libraryItems(page)).toHaveLength(0);
		expect(await cloudEntities(page, projectB)).toEqual(bSavedEntities);
		// Removal is not a project edit, so prove B still saves by making a real edit.
		const closePlaceAfter = page.getByRole('button', { name: 'Close Place object' });
		if (await closePlaceAfter.isVisible().catch(() => false)) await closePlaceAfter.click();
		await selectSubject(page, copy.id);
		await page.getByLabel('Form width (m)', { exact: true }).fill('1.6');
		await accepted(page, () => page.locator('.form-fields').getByRole('button', { name: 'Size', exact: true }).click());
		await saveToCloud(page);
		rows.push(row('lifecycle.remove-item', 'Remove the item; B copies stay editable', 'passed', `item ${itemId} removed; both copies unchanged; B saved a further edit`, page, viewport, reducedMotion, await capture(page, 't5-s03-17-item-removed.png')));

		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(row('lifecycle.test', 'two-project My Objects lifecycle', 'failed', error instanceof Error ? error.message : String(error), page, viewport, reducedMotion));
		throw error;
	} finally {
		await writeRows(rows);
		await started.close();
	}
});

test('S03 starter journey keeps the same creator contract', async ({ browser, baseURL }) => {
	test.setTimeout(600_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
	const rows: Row[] = [];
	const viewport = '1440x900';
	const { page, errors } = started;
	try {
		expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
		const id = uniqueProjectId('t5-s03-starter');
		await startStarter(page, id);
		const before = formsOf(await downloadSource(page));
		expect(before).toHaveLength(0);
		await fitPlan(page);
		await chooseReading(page, 'shape');
		// The fitted starter fills the upper Stage; the dock occupies the lower
		// centre, so the outline stays in the room's upper floor area.
		await clickShapePoint(page, [2, 0, 1.5], 1);
		await clickShapePoint(page, [3, 0, 1.5], 2);
		await clickShapePoint(page, [2, 0, 0.5], 3);
		await page.locator('[data-shape-finish]').click();
		await page.locator('[data-shape-depth]').fill('0.4');
		await page.locator('[data-shape-depth]').press('Tab');
		const createBefore = await acceptedResultCount(page);
		await page.locator('[data-shape-create]').click();
		await waitForAcceptedResult(page, createBefore);
		const after = formsOf(await downloadSource(page));
		expect(after).toHaveLength(1);
		await saveToCloud(page);
		await openSavedProject(page, id);
		const reopened = formsOf(await downloadSource(page));
		expect(reopened.map((entity) => entity.id)).toEqual(after.map((entity) => entity.id));
		expect(digestMap(await downloadSource(page))).toEqual(Object.fromEntries(after.map((entity) => [entity.id, digestOf(entity)])));
		rows.push(row('starter.draw', 'Draw and create a form from the starter', 'passed', `starter Room plus one form; Save/reload preserved ${digestOf(after[0]!)}`, page, viewport, true, await capture(page, 't5-s03-18-starter.png'), digestOf(after[0]!)));
		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(row('starter.test', 'starter creator journey', 'failed', error instanceof Error ? error.message : String(error), page, viewport, true));
		throw error;
	} finally {
		await writeRows(rows);
		await started.close();
	}
});
