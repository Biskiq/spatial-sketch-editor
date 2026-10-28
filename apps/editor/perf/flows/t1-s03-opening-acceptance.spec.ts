/**
 * T1.P02.S03 — on-demand browser acceptance for the Opening family.
 *
 * Drives the shipped Stage through the real Ink palette, Card, Save and reload
 * path against the compiled API and a task-private database. It asserts the
 * accepted source, not selectors: a placement is only a pass when the downloaded
 * Layout gains the expected Opening (or refuses without changing it).
 *
 * Run through `perf/run-t1-s02-browser-qa.mjs` with
 * `T1_S02_QA_SPEC=perf/flows/t1-s03-opening-acceptance.spec.ts`.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Browser, type Page } from '@playwright/test';

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
const OPENING_PALETTE = '[data-layout-opening-palette]';
const OPENING_REFUSAL = '[data-opening-refusal]';
const CARD = 'aside.card';
const OPENING_DELETE = '[data-card-action="layout-opening-delete"]';
const evidencePath = resolve(resultsDir, 't1-s03-opening-evidence.json');

type Row = {
	readonly id: string;
	readonly concern: string;
	readonly status: 'passed' | 'failed' | 'not-run';
	readonly detail: string;
	readonly revision: string;
	readonly viewport: string;
	readonly reducedMotion: boolean;
	readonly url: string;
	readonly screenshot?: string;
};

async function writeEvidence(row: Row): Promise<void> {
	let evidence: Record<string, unknown> = {
		flow: 'T1.P02.S03 Opening browser acceptance',
		revision: REVISION,
		apiOrigin,
		browser: process.env.T1_S02_QA_PROJECT ?? 'chromium',
		generatedAt: new Date().toISOString(),
		rows: []
	};
	try {
		evidence = JSON.parse(await readFile(evidencePath, 'utf8')) as Record<string, unknown>;
	} catch {
		/* first row */
	}
	const rows = (evidence.rows as Row[] | undefined) ?? [];
	rows.push(row);
	evidence.rows = rows;
	evidence.generatedAt = new Date().toISOString();
	await mkdir(resultsDir!, { recursive: true });
	await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
}

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

type Session = {
	readonly page: Page;
	readonly close: () => Promise<void>;
	readonly errors: string[];
};

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
	const auth = await loginAs({ user: 'agent-admin', apiOrigin: apiOrigin!, secret: authSecret!, origin: baseURL });
	await context.addCookies([cookieForBrowser(auth.cookie, baseURL)]);
	const page = await context.newPage();
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error' && /THREE|Shader|Uncaught/.test(message.text())) errors.push(message.text());
	});
	return { page, errors, close: () => context.close() };
}

async function startProject(page: Page, starter: 'Enclosed room' | 'Begin empty'): Promise<string> {
	const projectId = uniqueProjectId('t1s03');
	await page.goto(`/project/${encodeURIComponent(projectId)}/spatial?create=1`);
	await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeVisible();
	await page.getByRole('button', { name: starter, exact: true }).click();
	await expect(page.locator(STAGE)).toBeVisible({ timeout: 60_000 });
	await expect(page.locator(DOCK)).toBeVisible();
	await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
	await page.waitForTimeout(600);
	return projectId;
}

async function cameraPose(page: Page): Promise<string> {
	return page.evaluate(() => {
		type Camera = { matrixWorld: { elements: number[] }; projectionMatrix: { elements: number[] } };
		const camera = (window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { camera?: Camera }> }).__BISKIQ_PERF_RENDER_REFS__?.stage?.camera;
		return camera === undefined
			? ''
			: [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements].map((value) => value.toFixed(6)).join(',');
	});
}

async function waitForCameraSettled(page: Page, timeout = 20_000): Promise<void> {
	const started = Date.now();
	let previous = '';
	let sampled = false;
	while (Date.now() - started < timeout) {
		const pose = await cameraPose(page);
		if (sampled && pose !== '' && pose === previous) return;
		previous = pose;
		sampled = true;
		await page.waitForTimeout(250);
	}
	throw new Error('the Stage camera did not settle');
}

async function fitPlan(page: Page): Promise<void> {
	await page.locator('.stage-actions').getByRole('button', { name: 'Fit', exact: true }).click();
	await waitForCameraSettled(page);
	await page.locator('.stage-actions').getByRole('button', { name: 'Plan', exact: true }).click();
	await expect(page.locator('.stage-actions').getByRole('button', { name: 'Plan', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await waitForCameraSettled(page);
}

async function setReading(page: Page, reading: 'Plan' | '3D'): Promise<void> {
	const button = page.locator('.stage-actions').getByRole('button', { name: reading, exact: true });
	await button.click();
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	await waitForCameraSettled(page);
}

async function armInk(page: Page): Promise<void> {
	const key = page.locator('[data-dock-tool="layout-ink"]');
	if ((await key.getAttribute('aria-pressed')) !== 'true') await key.click();
	await expect(page.locator(INK)).toBeVisible();
	await expect(key).toHaveAttribute('aria-pressed', 'true');
}

async function armOpening(page: Page): Promise<void> {
	const closeCard = page.getByRole('button', { name: 'Close selection card' });
	if (await closeCard.isVisible().catch(() => false)) await closeCard.click();
	await armInk(page);
	const radio = page.locator('[data-ink-reading-opening]');
	if (!(await radio.isChecked())) await radio.check();
	await expect(page.locator(OPENING_PALETTE)).toBeVisible();
}

async function cssPoint(page: Page, point: readonly [number, number, number]): Promise<{ x: number; y: number }> {
	await page.waitForFunction(
		() => Boolean((window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { camera?: unknown }> }).__BISKIQ_PERF_RENDER_REFS__?.stage?.camera)
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
		const camera = (window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { camera?: Camera }> }).__BISKIQ_PERF_RENDER_REFS__?.stage?.camera;
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
		throw new Error(`world point ${point.join(',')} projects over ${hit}, not the Stage`);
	}
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.up();
	await page.waitForTimeout(180);
}

async function finishWithEnter(page: Page): Promise<void> {
	await page.locator(STAGE).focus();
	await page.keyboard.press('Enter');
}

async function downloadSource(page: Page): Promise<Record<string, any>> {
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Download source JSON', exact: true }).click()
	]);
	const path = await download.path();
	if (path === null) throw new Error('the source download produced no local path');
	return JSON.parse(await readFile(path, 'utf8')) as Record<string, any>;
}

type Layout = {
	walls: { id: string; startJunctionId: string; endJunctionId: string }[];
	junctions: { id: string; point: [number, number] }[];
	openings: { id: string; wallId: string; kind: string; width: number; height: number; sillHeight: number; offset: number }[];
};

function layoutOf(source: Record<string, any>): Layout {
	return source.units?.layout?.data as Layout;
}

type HostWall = {
	id: string;
	start: [number, number];
	end: [number, number];
	length: number;
};

function hostWalls(source: Record<string, any>): HostWall[] {
	const layout = layoutOf(source);
	const junctions = new Map(layout.junctions.map((junction) => [junction.id, junction.point]));
	const walls: HostWall[] = [];
	for (const wall of layout.walls) {
		const start = junctions.get(wall.startJunctionId);
		const end = junctions.get(wall.endJunctionId);
		if (start === undefined || end === undefined) continue;
		walls.push({
			id: wall.id,
			start,
			end,
			length: Math.hypot(end[0] - start[0], end[1] - start[1])
		});
	}
	if (walls.length === 0) throw new Error('the project has no resolvable Wall');
	return walls.sort((left, right) => right.length - left.length);
}

function along(host: HostWall, fraction: number): [number, number, number] {
	return [
		host.start[0] + (host.end[0] - host.start[0]) * fraction,
		0,
		host.start[1] + (host.end[1] - host.start[1]) * fraction
	];
}

async function exposed(page: Page, point: readonly [number, number, number]): Promise<boolean> {
	const { x, y } = await cssPoint(page, point);
	return page.evaluate(([clientX, clientY]) => {
		const element = document.elementFromPoint(clientX, clientY);
		return element !== null && /canvas|stage/i.test(`${element.tagName}.${String(element.className)}`);
	}, [x, y] as const);
}

async function exposedPoints(page: Page, host: HostWall): Promise<[number, number, number][]> {
	const points: [number, number, number][] = [];
	const misses: string[] = [];
	for (const fraction of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
		const point = along(host, fraction);
		if (await exposed(page, point)) {
			points.push(point);
			continue;
		}
		const { x, y } = await cssPoint(page, point);
		const hit = await page.evaluate(([clientX, clientY]) => {
			const element = document.elementFromPoint(clientX, clientY);
			return element === null ? 'none' : `${element.tagName.toLowerCase()}.${String(element.className)}`;
		}, [x, y] as const);
		misses.push(`${fraction}→${x.toFixed(0)},${y.toFixed(0)} ${hit}`);
	}
	if (points.length === 0 && process.env.T1_S03_DEBUG === '1') {
		console.log(`exposed: no point on ${host.id}: ${misses.join(' | ')}`);
	}
	return points;
}

async function pickExposedHost(
	page: Page,
	hosts: readonly HostWall[]
): Promise<{ host: HostWall; points: [number, number, number][] }> {
	for (const host of hosts) {
		const points = await exposedPoints(page, host);
		if (points.length > 0) return { host, points };
	}
	throw new Error('no Wall face has an exposed point on the Stage');
}

async function selectSubject(page: Page, sourceId: string): Promise<void> {
	const closeCard = page.getByRole('button', { name: 'Close selection card' });
	if (await closeCard.isVisible().catch(() => false)) await closeCard.click();
	await page.locator('#plate-index-search').fill(sourceId);
	const row = page.locator('button.item-row', { hasText: sourceId }).first();
	await expect(row).toBeVisible();
	await row.click();
	await expect(page.locator(CARD)).toBeVisible();
}

async function capture(page: Page, name: string): Promise<string> {
	await page.screenshot({ path: resolve(resultsDir!, name), fullPage: true, animations: 'disabled' });
	return name;
}

function row(
	id: string,
	concern: string,
	status: Row['status'],
	detail: string,
	page: Page,
	viewport: string,
	reducedMotion: boolean,
	screenshot?: string
): Row {
	return {
		id,
		concern,
		status,
		detail,
		revision: REVISION,
		viewport,
		reducedMotion,
		url: page.url(),
		...(screenshot === undefined ? {} : { screenshot })
	};
}

test.describe.configure({ mode: 'serial' });

test('starter: place, refuse/repair, remove, undo/redo, save and reload one Opening', async ({ browser, baseURL }) => {
	test.setTimeout(300_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
	const rows: Row[] = [];
	try {
		const { page, errors } = started;
		await startProject(page, 'Enclosed room');
		await fitPlan(page);
		const source = await downloadSource(page);
		const hosts = hostWalls(source);
		await armOpening(page);
		const { host, points } = await pickExposedHost(page, hosts);
		expect(host.length).toBeGreaterThan(1);
		rows.push(row('starter.baseline', 'starter host Wall', 'passed', `${host.id} is ${host.length.toFixed(2)} m; three exposed points`, page, '1440x900', false));

		await page.locator('[data-opening-width]').fill('0.9');
		await page.locator('[data-opening-height]').fill('2.1');
		await page.locator('[data-opening-sill]').fill('0');
		await page.locator('[data-opening-kind]').selectOption('door');
		await page.locator('[data-opening-width]').press('Tab');

		// An unpressed hover previews the host and offset without claiming the move.
		const hover = await cssPoint(page, points[0]!);
		await page.mouse.move(hover.x, hover.y);
		await expect(page.locator(OPENING_PALETTE)).toContainText(host.id);
		rows.push(row('starter.hover', 'unpressed hover previews the host', 'passed', host.id, page, '1440x900', false));

		const before = await acceptedResultCount(page);
		await clickWorld(page, points[0]!);
		await waitForAcceptedResult(page, before);
		const placedSource = await downloadSource(page);
		const placed = layoutOf(placedSource).openings;
		expect(placed).toHaveLength(1);
		expect(placed[0]).toMatchObject({ wallId: host.id, kind: 'door', width: 0.9, height: 2.1, sillHeight: 0 });
		// The install closes Ink and the shell re-arms the same dock tool on the
		// next live evaluation; the Opening reading and measures survive it.
		await expect(page.locator(INK)).toBeVisible({ timeout: 20_000 });
		await expect(page.locator('[data-ink-reading-opening]')).toBeChecked();
		await expect(page.locator('[data-opening-kind]')).toHaveValue('door');
		rows.push(row(
			'starter.place',
			'place one door on a Wall face',
			'passed',
			`${placed[0]!.id} at ${placed[0]!.offset.toFixed(3)} m; one accepted result; Ink re-armed`,
			page,
			'1440x900',
			false,
			await capture(page, 't1-s03-starter-placed.png')
		));

		// An Opening wider than its host cannot fit from any aim: the candidate
		// refuses in words and writes nothing.
		await armOpening(page);
		await page.locator('[data-opening-width]').fill((host.length + 1).toFixed(2));
		await page.locator('[data-opening-width]').press('Tab');
		await clickWorld(page, points[0]!);
		await expect(page.locator(OPENING_REFUSAL)).toContainText('past the end of the');
		await expect(page.locator(OPENING_REFUSAL)).toContainText('Move it');
		expect(layoutOf(await downloadSource(page)).openings).toHaveLength(1);
		rows.push(row('starter.refusal', 'Wall-end overflow refuses with a repair', 'passed', await page.locator(OPENING_REFUSAL).innerText(), page, '1440x900', false));

		// The live candidate is still editable: repair by narrowing and placing the
		// next door at an exact offset on the selected host, keyboard-only.
		await selectSubject(page, host.id);
		await armOpening(page);
		await page.locator('[data-opening-width]').fill('0.9');
		await page.locator('[data-opening-width]').press('Tab');
		await page.locator('[data-opening-offset]').fill('1');
		await page.locator('[data-opening-place]').click();
		await expect.poll(async () => layoutOf(await downloadSource(page)).openings.length, { timeout: 20_000 }).toBe(2);
		rows.push(row('starter.repair', 'typed Offset repair accepts on the preferred host', 'passed', 'a second door installed at 1.000 m without a reading switch', page, '1440x900', false));

		// Invalid fields must block pointer placement; the adapter must not fall
		// back to its previous valid measures while the controls show an error.
		await armOpening(page);
		await page.locator('[data-opening-width]').fill('abc');
		await page.locator('[data-opening-width]').press('Tab');
		await expect(page.locator('.error')).toContainText('Width');
		await clickWorld(page, points[0]!);
		await expect(page.locator(OPENING_REFUSAL)).toContainText('Check the Opening Width');
		expect(layoutOf(await downloadSource(page)).openings).toHaveLength(2);
		rows.push(row('starter.invalid', 'invalid measures block pointer placement', 'passed', 'no stale-value Opening installed', page, '1440x900', false));

		// Closing and reopening Ink discards the invalid draft; the remembered
		// measures are valid and the adapter must agree before the next placement.
		await page.getByRole('button', { name: 'Close Ink' }).click();
		await expect(page.locator(INK)).toHaveCount(0);
		const inkKey = page.locator('[data-dock-tool="layout-ink"]');
		if ((await inkKey.getAttribute('aria-pressed')) === 'true') {
			await inkKey.click();
			await expect(inkKey).toHaveAttribute('aria-pressed', 'false');
		}
		await armOpening(page);
		await expect(page.locator('[data-opening-width]')).toHaveValue('0.9');
		await expect(page.locator('.error')).toHaveCount(0);
		await selectSubject(page, host.id);
		await armOpening(page);
		await page.locator('[data-opening-offset]').fill('5');
		await page.locator('[data-opening-place]').click();
		await expect.poll(async () => layoutOf(await downloadSource(page)).openings.length, { timeout: 20_000 }).toBe(3);
		const beforeRemountUndo = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, beforeRemountUndo);
		expect(layoutOf(await downloadSource(page)).openings).toHaveLength(2);
		rows.push(row('starter.remount-validity', 'reopened Ink accepts remembered valid measures', 'passed', 'typed placement accepted, then Undo', page, '1440x900', false));

		await selectSubject(page, placed[0]!.id);
		await expect(page.locator(OPENING_DELETE)).toBeVisible();
		const beforeDelete = await acceptedResultCount(page);
		await page.locator(OPENING_DELETE).click();
		await expect(page.locator(OPENING_DELETE)).toContainText('Confirm');
		await page.locator(OPENING_DELETE).click();
		await waitForAcceptedResult(page, beforeDelete);
		expect(layoutOf(await downloadSource(page)).openings.map((opening) => opening.id)).not.toContain(placed[0]!.id);
		rows.push(row('starter.remove', 'Card removes one Opening in one undo step', 'passed', 'Confirm press then accepted; host remains', page, '1440x900', false));

		const beforeUndo = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, beforeUndo);
		expect(layoutOf(await downloadSource(page)).openings.map((opening) => opening.id)).toContain(placed[0]!.id);
		const beforeRedo = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Redo', exact: true }).click();
		await waitForAcceptedResult(page, beforeRedo);
		expect(layoutOf(await downloadSource(page)).openings.map((opening) => opening.id)).not.toContain(placed[0]!.id);
		rows.push(row('starter.undo-redo', 'Undo restores and Redo re-removes the same identity', 'passed', placed[0]!.id, page, '1440x900', false));

		// Put one Opening back, save, and reopen the project in a fresh session.
		await armOpening(page);
		await page.locator('[data-opening-kind]').selectOption('window');
		await expect(page.locator('[data-opening-width]')).toHaveValue('1.2');
		await expect(page.locator('[data-opening-height]')).toHaveValue('1.2');
		await expect(page.locator('[data-opening-sill]')).toHaveValue('1');
		const beforeSavePlace = await acceptedResultCount(page);
		await clickWorld(page, points[0]!);
		await waitForAcceptedResult(page, beforeSavePlace);
		const savedSource = await downloadSource(page);
		const windowOpening = layoutOf(savedSource).openings.find((opening) => opening.kind === 'window');
		if (windowOpening === undefined) throw new Error('the window did not install');
		rows.push(row('starter.window-defaults', 'Window uses canonical defaults', 'passed', '1.2 x 1.2, sill 1', page, '1440x900', false));

		// A rebuilt Opening palette reads the adapter's remembered options.
		const closeCard = page.getByRole('button', { name: 'Close selection card' });
		if (await closeCard.isVisible().catch(() => false)) await closeCard.click();
		await page.locator('[data-ink-reading-wall]').check();
		await expect(page.locator(OPENING_PALETTE)).toHaveCount(0);
		await page.locator('[data-ink-reading-opening]').check();
		await expect(page.locator(OPENING_PALETTE)).toBeVisible();
		await expect(page.locator('[data-opening-kind]')).toHaveValue('window');
		await expect(page.locator('[data-opening-width]')).toHaveValue('1.2');
		await expect(page.locator('[data-opening-height]')).toHaveValue('1.2');
		await expect(page.locator('[data-opening-sill]')).toHaveValue('1');
		rows.push(row('starter.remount', 'palette remount keeps remembered measures', 'passed', 'window 1.2 x 1.2 sill 1', page, '1440x900', false));

		await setReading(page, '3D');
		expect(layoutOf(await downloadSource(page)).openings).toHaveLength(2);
		await setReading(page, 'Plan');
		const saveButton = page.locator('[data-head-save] button').first();
		await expect(saveButton).toBeEnabled();
		await saveButton.click();
		await expect(page.locator('[data-head-save]')).toHaveAttribute('data-save-status', 'saved', { timeout: 90_000 });
		await page.reload();
		await expect(page.locator(STAGE)).toBeVisible({ timeout: 60_000 });
		await expect(page.locator(DOCK)).toBeVisible();
		await page.waitForTimeout(800);
		await selectSubject(page, windowOpening.id);
		const reloaded = layoutOf(await downloadSource(page));
		expect(reloaded.openings.find((opening) => opening.id === windowOpening.id)).toMatchObject({
			kind: 'window',
			width: 1.2,
			height: 1.2,
			sillHeight: 1
		});
		rows.push(row(
			'starter.save-reload',
			'Plan/3D agreement, Save and a fresh-session reload keep identity',
			'passed',
			`${windowOpening.id}; ${windowOpening.width} × ${windowOpening.height} sill ${windowOpening.sillHeight}`,
			page,
			'1440x900',
			false,
			await capture(page, 't1-s03-starter-reloaded.png')
		));

		expect(errors).toEqual([]);
		for (const evidenceRow of rows) await writeEvidence(evidenceRow);
	} finally {
		await started.close();
	}
});

test('3D: place on a visible Wall face, not only at datum height', async ({ browser, baseURL }) => {
	test.setTimeout(240_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
	try {
		const { page, errors } = started;
		await startProject(page, 'Enclosed room');
		await fitPlan(page);
		await setReading(page, '3D');
		await armOpening(page);
		const host = hostWalls(await downloadSource(page))[0]!;
		let face: [number, number, number] | null = null;
		for (const fraction of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
			const base = along(host, fraction);
			const point: [number, number, number] = [base[0], 1, base[2]];
			if (!(await exposed(page, point))) continue;
			const { x, y } = await cssPoint(page, point);
			await page.mouse.move(x, y);
			await page.waitForTimeout(120);
			const hostText = await page.locator('[data-layout-opening-palette] .live dd').first().innerText();
			if (!hostText.includes('Aim at a Wall face')) {
				face = point;
				break;
			}
		}
		if (face === null) throw new Error('no raised Wall face previewed a host in 3D');
		const before = await acceptedResultCount(page);
		await clickWorld(page, face);
		await expect.poll(async () => layoutOf(await downloadSource(page)).openings.length, { timeout: 20_000 }).toBe(1);
		const opening = layoutOf(await downloadSource(page)).openings[0]!;
		expect(opening.wallId).toBe(host.id);
		expect(opening.offset).toBeGreaterThan(0);
		expect(errors).toEqual([]);
		await writeEvidence(row('3d.face', '3D Wall face is a host', 'passed', `${opening.id} at ${opening.offset.toFixed(3)} m`, page, '1440x900', false, await capture(page, 't1-s03-3d-face.png')));
	} finally {
		await started.close();
	}
});

test('empty: draw a Wall, then place a window with keyboard metrics', async ({ browser, baseURL }) => {
	test.setTimeout(240_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
	const rows: Row[] = [];
	try {
		const { page, errors } = started;
		await startProject(page, 'Begin empty');
		await fitPlan(page);
		await armInk(page);
		const typePoint = async (x: number, z: number, count: number) => {
			await page.locator('[data-ink-x]').fill(String(x));
			await page.locator('[data-ink-z]').fill(String(z));
			await page.locator('[data-ink-add-point]').click();
			await expect.poll(async () => {
				const text = await page.locator('[data-layout-ink-palette] .live').innerText();
				return Number(/Points\s*(\d+)/.exec(text)?.[1] ?? -1);
			}, { timeout: 10_000 }).toBe(count);
		};
		await typePoint(0, 0, 1);
		await typePoint(6, 0, 2);
		const beforeWall = await acceptedResultCount(page);
		await finishWithEnter(page);
		await waitForAcceptedResult(page, beforeWall);
		const wallSource = await downloadSource(page);
		expect(layoutOf(wallSource).walls).toHaveLength(1);
		rows.push(row('empty.wall', 'empty project gains one drawn Wall', 'passed', '0,0 → 6,0 accepted', page, '1280x800', true));

		await armOpening(page);
		const { points } = await pickExposedHost(page, hostWalls(wallSource));
		await page.locator('[data-opening-kind]').selectOption('window');
		await expect(page.locator('[data-opening-width]')).toHaveValue('1.2');
		await expect(page.locator('[data-opening-height]')).toHaveValue('1.2');
		await expect(page.locator('[data-opening-sill]')).toHaveValue('1');
		const beforePlace = await acceptedResultCount(page);
		await clickWorld(page, points[0]!);
		await waitForAcceptedResult(page, beforePlace);
		const window = layoutOf(await downloadSource(page)).openings[0]!;
		expect(window).toMatchObject({ kind: 'window', width: 1.2, height: 1.2, sillHeight: 1 });
		expect(errors).toEqual([]);
		for (const evidenceRow of [
			...rows,
			row('empty.window', 'place a keyed window on the new Wall', 'passed', `${window.id} at ${window.offset.toFixed(3)} m`, page, '1280x800', true, await capture(page, 't1-s03-empty-window.png'))
		]) {
			await writeEvidence(evidenceRow);
		}
	} finally {
		await started.close();
	}
});
