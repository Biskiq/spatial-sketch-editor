/**
 * T1.P02.S04 — integrated final-gate browser acceptance.
 *
 * This is on-demand gate evidence, not a measurement row. It drives the shipped
 * Stage through the real Ink palette, Opening palette, dock, Card, Head and
 * Save/reload path against the compiled API and a task-private database.
 *
 * Every row records the revision, viewport, reduced-motion state and the
 * observed consequence. A step is only a pass when the downloaded canonical
 * source shows the expected Walls, junctions, Rooms and Openings: a selector is
 * never accepted as proof of a committed edit.
 *
 * Run through `perf/run-t1-s04-integrated-qa.mjs`.
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
const CARD = 'aside.card';
const DELETE_WALL = '[data-card-action="layout-wall-delete"]';
const evidencePath = resolve(resultsDir, 't1-s04-integrated-evidence.json');

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

type Layout = {
	walls: { id: string; startJunctionId: string; endJunctionId: string }[];
	junctions: { id: string; point: [number, number] }[];
	rooms: { id: string }[];
	openings: {
		id: string;
		wallId: string;
		kind: string;
		width: number;
		height: number;
		sillHeight: number;
		offset: number;
	}[];
};

function machineFacts(): Record<string, unknown> | null {
	const raw = process.env.PERF_MACHINE_FACTS;
	if (raw === undefined || raw.length === 0) return null;
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return null;
	}
}

async function writeEvidence(row: Row): Promise<void> {
	let evidence: Record<string, unknown> = {
		flow: 'T1.P02.S04 integrated final-gate browser acceptance',
		revision: REVISION,
		apiOrigin,
		browser: process.env.T1_S04_QA_PROJECT ?? 'chromium',
		machine: machineFacts(),
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
	options: {
		viewport: { width: number; height: number };
		reducedMotion?: 'no-preference' | 'reduce';
	}
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
	const projectId = uniqueProjectId('t1s04');
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

async function armInk(page: Page): Promise<void> {
	const key = page.locator('[data-dock-tool="layout-ink"]');
	if ((await key.getAttribute('aria-pressed')) !== 'true') await key.click();
	await expect(page.locator(INK)).toBeVisible();
	await expect(key).toHaveAttribute('aria-pressed', 'true');
	// The Ink reading is remembered across installs; a Wall chain needs the Wall
	// reading even when the previous accepted result left the Opening reading on.
	const wallReading = page.locator('[data-ink-reading-wall]');
	if ((await wallReading.count()) > 0 && !(await wallReading.isChecked())) await wallReading.check();
}

async function armOpening(page: Page): Promise<void> {
	const closeCard = page.getByRole('button', { name: 'Close selection card' });
	if (await closeCard.isVisible().catch(() => false)) await closeCard.click();
	await armInk(page);
	const radio = page.locator('[data-ink-reading-opening]');
	if (!(await radio.isChecked())) await radio.check();
	await expect(page.locator(OPENING_PALETTE)).toBeVisible();
}

async function inkPoints(page: Page): Promise<number> {
	return page.evaluate(() => {
		const text = document.querySelector('[data-layout-ink-palette] .live')?.textContent ?? '';
		const match = /Points\s*(\d+)/.exec(text);
		return match ? Number(match[1]) : -1;
	});
}

async function waitForPoints(page: Page, count: number): Promise<void> {
	await expect.poll(() => inkPoints(page), { timeout: 10_000 }).toBe(count);
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
		throw new Error(`world point ${point.join(',')} projects over ${hit}, not the Stage`);
	}
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.up();
	await page.waitForTimeout(150);
}

async function clickWorldAndWait(page: Page, point: readonly [number, number, number], count: number): Promise<void> {
	await clickWorld(page, point);
	await waitForPoints(page, count);
}

async function typePoint(page: Page, x: number, z: number, count: number): Promise<void> {
	await page.locator('[data-ink-x]').fill(String(x));
	await page.locator('[data-ink-z]').fill(String(z));
	await page.locator('[data-ink-add-point]').click();
	await waitForPoints(page, count);
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

function layoutOf(source: Record<string, any>): Layout {
	return source.units?.layout?.data as Layout;
}

function layoutCounts(source: Record<string, any>) {
	const layout = layoutOf(source);
	return {
		walls: layout.walls.length,
		junctions: layout.junctions.length,
		rooms: layout.rooms.length,
		openings: layout.openings?.length ?? 0
	};
}

function layoutIds(source: Record<string, any>) {
	const layout = layoutOf(source);
	return {
		walls: layout.walls.map((wall) => wall.id).sort(),
		junctions: layout.junctions.map((junction) => junction.id).sort(),
		rooms: layout.rooms.map((room) => room.id).sort(),
		openings: (layout.openings ?? []).map((opening) => opening.id).sort()
	};
}

/**
 * The Wall added by a division: new relative to the before-source, and the only
 * new Wall whose two endpoints are both junctions that division just created.
 */
function dividerWall(sourceAfter: Record<string, any>, sourceBefore: Record<string, any>): { id: string } {
	const before = layoutIds(sourceBefore);
	const layout = layoutOf(sourceAfter);
	const beforeWalls = new Set(before.walls);
	const beforeJunctions = new Set(before.junctions);
	const divider = layout.walls.find(
		(wall) =>
			!beforeWalls.has(wall.id) &&
			!beforeJunctions.has(wall.startJunctionId) &&
			!beforeJunctions.has(wall.endJunctionId)
	);
	if (divider === undefined) throw new Error('the division added no divider between two new split junctions');
	return divider;
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

async function saveToCloud(page: Page): Promise<void> {
	const button = page.locator('[data-head-save] button').first();
	await expect(button).toBeEnabled();
	await button.click();
	await expect(page.locator('[data-head-save]')).toHaveAttribute('data-save-status', 'saved', { timeout: 90_000 });
}

async function placeOpeningThroughPalette(page: Page, before: number): Promise<void> {
	const refusal = page.locator('[data-opening-refusal]');
	await page.locator('[data-opening-place]').click();
	// A typed placement either accepts or refuses in words; never wait the full
	// five-minute tier bound for a refusal that already happened.
	await expect
		.poll(
			async () => {
				if ((await refusal.count()) > 0) return 'refused';
				return (await acceptedResultCount(page)) > before ? 'accepted' : 'pending';
			},
			{ timeout: 30_000, intervals: [100, 250, 500] }
		)
		.not.toBe('pending');
	if ((await refusal.count()) > 0) throw new Error(`the Opening was refused: ${(await refusal.innerText()).trim()}`);
	await waitForAcceptedResult(page, before);
}

async function deleteWallThroughCard(page: Page, wallId: string): Promise<number> {
	await selectSubject(page, wallId);
	const action = page.locator(DELETE_WALL);
	await expect(action).toBeVisible();
	await action.click();
	await expect(action).toContainText('Confirm');
	await expect(page.locator('[data-card-actions]')).toContainText(/hosted Opening|Room/);
	const before = await acceptedResultCount(page);
	await action.click();
	await waitForAcceptedResult(page, before);
	return before;
}

async function openSourceVariant(page: Page, source: Record<string, any>): Promise<void> {
	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.locator('.stage-actions').getByRole('button', { name: 'Open source JSON', exact: true }).click()
	]);
	await chooser.setFiles({
		name: 's04-format-probe.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(source))
	});
}

function tamperedFormat(source: Record<string, any>, version: number): Record<string, any> {
	const copy = structuredClone(source);
	copy.units.layout.data.formatVersion = version;
	return copy;
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

test('starter: draw, close, divide, host an Opening, delete, identities, Undo/Redo and reload', async ({
	browser,
	baseURL
}) => {
	test.setTimeout(420_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
	const rows: Row[] = [];
	const viewport = '1440x900';
	const reducedMotion = false;
	try {
		const { page, errors } = started;
		await startProject(page, 'Enclosed room');
		await fitPlan(page);
		const baselineSource = await downloadSource(page);
		const baseline = layoutCounts(baselineSource);
		expect(baseline).toEqual({ walls: 4, junctions: 4, rooms: 1, openings: 0 });
		rows.push(row('starter.baseline', 'starter enclosure', 'passed', JSON.stringify(baseline), page, viewport, reducedMotion));

		// A deliberate junction join at the starter's (7, 2) corner, then a new
		// enclosure whose other corners are free points; closing on the joined
		// Junction must not mint a parallel Junction at the same coordinate.
		const initialCard = page.getByRole('button', { name: 'Close selection card' });
		if (await initialCard.isVisible().catch(() => false)) await initialCard.click();
		const stageBox = await page.locator(STAGE).boundingBox();
		if (stageBox === null) throw new Error('the Stage has no box');
		await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
		await page.mouse.wheel(0, 400);
		await page.waitForTimeout(300);
		await armInk(page);
		await clickWorldAndWait(page, [7, 0, 2], 1);
		await typePoint(page, 9, 2, 2);
		await typePoint(page, 9, 4, 3);
		await typePoint(page, 7, 4, 4);
		const closeBefore = await acceptedResultCount(page);
		await page.locator('[data-ink-close]').click();
		await waitForAcceptedResult(page, closeBefore);
		await expect(page.locator('[data-ink-refusal]')).toHaveCount(0);
		const closedSource = await downloadSource(page);
		const afterClose = layoutCounts(closedSource);
		expect(afterClose).toEqual({ walls: 8, junctions: 7, rooms: 2, openings: 0 });
		rows.push(
			row(
				'starter.close',
				'free Wall → deliberate join → enclosure',
				'passed',
				`${JSON.stringify(baseline)} → ${JSON.stringify(afterClose)}; one accepted result installed`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-starter-closed.png')
			)
		);

		await setReading(page, '3D');
		expect(layoutCounts(await downloadSource(page))).toEqual(afterClose);
		rows.push(
			row(
				'starter.plan-3d-close',
				'Plan and 3D read one candidate',
				'passed',
				'the reading switch preserved the accepted counts',
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-starter-closed-3d.png')
			)
		);
		await setReading(page, 'Plan');

		// Divide the new enclosure through the interiors of its two side Walls.
		const closeCard = page.getByRole('button', { name: 'Close selection card' });
		if (await closeCard.isVisible().catch(() => false)) await closeCard.click();
		await armInk(page);
		await typePoint(page, 7, 3, 1);
		await typePoint(page, 9, 3, 2);
		const divideBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		await waitForAcceptedResult(page, divideBefore);
		const dividedSource = await downloadSource(page);
		const afterDivide = layoutCounts(dividedSource);
		expect(afterDivide.rooms).toBe(afterClose.rooms + 1);
		expect(afterDivide.walls).toBeGreaterThan(afterClose.walls);
		const divider = dividerWall(dividedSource, closedSource);
		rows.push(
			row(
				'starter.divide',
				'divide a Room through both host Walls',
				'passed',
				`${JSON.stringify(afterClose)} → ${JSON.stringify(afterDivide)}; divider ${divider.id}`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-starter-divided.png')
			)
		);

		// A Window on the divider. The Card is closed by the palette, so the
		// selected Wall is the typed offset's preferred host.
		await selectSubject(page, divider.id);
		await armOpening(page);
		await page.locator('[data-opening-kind]').selectOption('window');
		await expect(page.locator('[data-opening-width]')).toHaveValue('1.2');
		await expect(page.locator('[data-opening-height]')).toHaveValue('1.2');
		await expect(page.locator('[data-opening-sill]')).toHaveValue('1');
		// `offset` is the start edge, not the centre: 0.4 + 1.2 = 1.6 fits the 2 m
		// divider with 0.4 m clearance at each end.
		await page.locator('[data-opening-offset]').fill('0.4');
		const openingBefore = await acceptedResultCount(page);
		await placeOpeningThroughPalette(page, openingBefore);
		const openingSource = await downloadSource(page);
		const opening = (layoutOf(openingSource).openings ?? []).find((entry) => entry.wallId === divider.id);
		if (opening === undefined) throw new Error('the Window did not install on the selected divider');
		expect(opening).toMatchObject({ kind: 'window', width: 1.2, height: 1.2, sillHeight: 1 });
		const afterOpening = layoutCounts(openingSource);
		rows.push(
			row(
				'starter.opening',
				'place a Window on the divider',
				'passed',
				`${opening.id} on ${divider.id} at ${opening.offset.toFixed(3)} m`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-starter-opening.png')
			)
		);

		await setReading(page, '3D');
		expect(layoutCounts(await downloadSource(page))).toEqual(afterOpening);
		rows.push(
			row(
				'starter.plan-3d-opening',
				'Plan and 3D agree with the Opening',
				'passed',
				'the accepted Opening and counts survived the reading switch',
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-starter-opening-3d.png')
			)
		);
		await setReading(page, 'Plan');

		await deleteWallThroughCard(page, divider.id);
		const deletedSource = await downloadSource(page);
		const afterDelete = layoutCounts(deletedSource);
		const deletedIds = layoutIds(deletedSource);
		expect(afterDelete.walls).toBe(afterOpening.walls - 1);
		expect(afterDelete.rooms).toBe(afterOpening.rooms - 1);
		expect(afterDelete.openings).toBe(afterOpening.openings - 1);
		expect(deletedIds.walls).not.toContain(divider.id);
		expect(deletedIds.openings).not.toContain(opening.id);
		rows.push(
			row(
				'starter.delete',
				'delete a Wall with its hosted Opening',
				'passed',
				`${JSON.stringify(afterOpening)} → ${JSON.stringify(afterDelete)}; the hosted ${opening.id} retired in the same step`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-starter-deleted.png')
			)
		);

		const undoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, undoBefore);
		const undoneSource = await downloadSource(page);
		expect(layoutCounts(undoneSource)).toEqual(afterOpening);
		expect(layoutIds(undoneSource).walls).toContain(divider.id);
		expect(layoutIds(undoneSource).openings).toContain(opening.id);
		const redoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Redo', exact: true }).click();
		await waitForAcceptedResult(page, redoBefore);
		const redoneSource = await downloadSource(page);
		expect(layoutIds(redoneSource)).toEqual(deletedIds);
		rows.push(
			row(
				'starter.undo-redo',
				'one Undo/Redo restores the Wall, Opening and Room with identity',
				'passed',
				`Undo restored ${divider.id} and ${opening.id}; Redo returned the deleted ids`,
				page,
				viewport,
				reducedMotion
			)
		);

		// Delete then recreate at the same endpoints: the replacement Wall must
		// receive a new identity, never the retired one.
		await armInk(page);
		await typePoint(page, 7, 3, 1);
		await typePoint(page, 9, 3, 2);
		const recreateBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		await waitForAcceptedResult(page, recreateBefore);
		const recreatedSource = await downloadSource(page);
		const recreatedIds = layoutIds(recreatedSource);
		const recreated = layoutOf(recreatedSource).walls.filter((wall) => !deletedIds.walls.includes(wall.id));
		expect(recreated).toHaveLength(1);
		expect(recreated[0]!.id).not.toBe(divider.id);
		expect(recreatedIds.walls).not.toContain(divider.id);
		rows.push(
			row(
				'starter.identity-delete-recreate',
				'delete and recreate never reuse the retired Wall id',
				'passed',
				`replacement ${recreated[0]!.id}; retired ${divider.id}`,
				page,
				viewport,
				reducedMotion
			)
		);
		const undoRecreate = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, undoRecreate);
		expect(layoutIds(await downloadSource(page))).toEqual(deletedIds);

		const savedSource = await downloadSource(page);
		const savedIds = layoutIds(savedSource);
		await saveToCloud(page);
		const projectId = /\/project\/([^/]+)\/spatial/.exec(new URL(page.url()).pathname)?.[1];
		if (projectId === undefined) throw new Error('the project id is not in the route');
		await page.reload();
		await expect(page.locator(STAGE)).toBeVisible({ timeout: 90_000 });
		await expect(page.locator(DOCK)).toBeVisible();
		await page.waitForTimeout(1_000);
		const reloadedSource = await downloadSource(page);
		expect(layoutIds(reloadedSource)).toEqual(savedIds);
		expect(layoutCounts(reloadedSource)).toEqual(afterDelete);
		rows.push(
			row(
				'starter.save-reload',
				'Save/reload preserves every identity',
				'passed',
				`${savedIds.walls.length} Walls, ${savedIds.junctions.length} Junctions, ${savedIds.rooms.length} Rooms retained`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-starter-reloaded.png')
			)
		);

		// Format 6 strict refusal in the editor, for a format-5 payload and an
		// unknown version. Each leaves the mounted project byte-identical and the
		// source still downloadable in format 6.
		for (const version of [5, 99]) {
			const beforeRefusal = layoutIds(await downloadSource(page));
			await openSourceVariant(page, tamperedFormat(reloadedSource, version));
			const note = page.locator('p.stage-note[role="status"]').filter({ hasText: 'not the current document format' });
			await expect(note).toBeVisible({ timeout: 30_000 });
			await expect(note).toContainText('current project is unchanged');
			const recovered = await downloadSource(page);
			expect(recovered.units.layout.data.formatVersion).toBe(6);
			expect(layoutIds(recovered)).toEqual(beforeRefusal);
			rows.push(
				row(
					`format.refuse-${version}`,
					`format ${version} refused with recovery`,
					'passed',
					`${(await note.innerText()).trim()}; the download recovered format 6 with the same identities`,
					page,
					viewport,
					reducedMotion,
					version === 5 ? await capture(page, 't1-s04-format-5-refused.png') : undefined
				)
			);
		}

		// A post-reload edit must not collide with any identity the saved source
		// already owns.
		await armInk(page);
		await typePoint(page, 10, 0, 1);
		await typePoint(page, 10, 2, 2);
		const postReloadBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		await waitForAcceptedResult(page, postReloadBefore);
		const postReloadSource = await downloadSource(page);
		const postReloadIds = layoutIds(postReloadSource);
		const postReloadWalls = layoutOf(postReloadSource).walls.filter((wall) => !savedIds.walls.includes(wall.id));
		expect(postReloadWalls).toHaveLength(1);
		expect(savedIds.walls).not.toContain(postReloadWalls[0]!.id);
		expect(postReloadIds.junctions.filter((id) => !savedIds.junctions.includes(id))).toHaveLength(2);
		rows.push(
			row(
				'identity.post-reload-edit',
				'post-reload edit allocates fresh identities',
				'passed',
				`new Wall ${postReloadWalls[0]!.id} and two new Junctions`,
				page,
				viewport,
				reducedMotion
			)
		);
		const undoPostReload = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, undoPostReload);
		expect(layoutIds(await downloadSource(page))).toEqual(savedIds);

		// Accessibility: the Stage is the named application surface, the reading
		// switch is a real pressed state, and a refused numeric entry is announced
		// without installing anything.
		expect(await page.locator(STAGE).getAttribute('role')).toBe('application');
		expect(await page.locator(STAGE).getAttribute('aria-label')).toBe('Spatial stage');
		expect(await page.locator(STAGE).getAttribute('tabindex')).toBe('0');
		const wallId = savedIds.walls[0]!;
		await selectSubject(page, wallId);
		const length = page.locator('label.field', { hasText: 'Length' }).locator('input').first();
		await expect(length).toBeVisible();
		const beforeInvalid = await acceptedResultCount(page);
		await length.fill('not-a-number');
		await length.press('Enter');
		await expect(page.locator(`[data-layout-card-fields] [role="alert"]`)).toContainText(/number|valid/i);
		expect(await acceptedResultCount(page)).toBe(beforeInvalid);
		expect(layoutIds(await downloadSource(page))).toEqual(savedIds);
		rows.push(
			row(
				'accessibility.roles-and-refusal',
				'named Stage, pressed reading state and announced Card refusal',
				'passed',
				'role=application with a tabindex; Plan aria-pressed=true; invalid Length announced and installed nothing',
				page,
				viewport,
				reducedMotion
			)
		);

		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(
			row(
				'starter.test',
				'integrated starter journey',
				'failed',
				error instanceof Error ? error.message : String(error),
				started.page,
				viewport,
				reducedMotion
			)
		);
		throw error;
	} finally {
		for (const entry of rows) await writeEvidence(entry);
		await started.close();
	}
});

test('empty: draw, close, divide, place an Opening, delete and reload', async ({ browser, baseURL }) => {
	test.setTimeout(420_000);
	const started = await session(browser, baseURL!, {
		viewport: { width: 1280, height: 800 },
		reducedMotion: 'reduce'
	});
	const rows: Row[] = [];
	const viewport = '1280x800';
	const reducedMotion = true;
	try {
		const { page, errors } = started;
		expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
		await startProject(page, 'Begin empty');
		await fitPlan(page);
		const empty = layoutCounts(await downloadSource(page));
		expect(empty).toEqual({ walls: 0, junctions: 0, rooms: 0, openings: 0 });
		await armInk(page);
		await typePoint(page, 2, -2, 1);
		await typePoint(page, 6, -2, 2);
		await typePoint(page, 6, 2, 3);
		await typePoint(page, 2, 2, 4);
		const closeBefore = await acceptedResultCount(page);
		await page.locator('[data-ink-close]').click();
		await waitForAcceptedResult(page, closeBefore);
		const closedSource = await downloadSource(page);
		const afterClose = layoutCounts(closedSource);
		expect(afterClose).toEqual({ walls: 4, junctions: 4, rooms: 1, openings: 0 });
		rows.push(
			row(
				'empty.close',
				'empty project → typed enclosure',
				'passed',
				`${JSON.stringify(empty)} → ${JSON.stringify(afterClose)}`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-empty-closed.png')
			)
		);

		await setReading(page, '3D');
		expect(layoutCounts(await downloadSource(page))).toEqual(afterClose);
		await setReading(page, 'Plan');
		await armInk(page);
		await typePoint(page, 2, 0, 1);
		await typePoint(page, 6, 0, 2);
		const divideBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		await waitForAcceptedResult(page, divideBefore);
		const dividedSource = await downloadSource(page);
		const afterDivide = layoutCounts(dividedSource);
		expect(afterDivide.rooms).toBe(2);
		const divider = dividerWall(dividedSource, closedSource);
		rows.push(
			row(
				'empty.divide',
				'divide the empty enclosure',
				'passed',
				`${JSON.stringify(afterClose)} → ${JSON.stringify(afterDivide)}; divider ${divider.id}`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-empty-divided.png')
			)
		);

		await selectSubject(page, divider.id);
		await armOpening(page);
		await page.locator('[data-opening-kind]').selectOption('door');
		await expect(page.locator('[data-opening-width]')).toHaveValue('0.9');
		await expect(page.locator('[data-opening-height]')).toHaveValue('2.1');
		await expect(page.locator('[data-opening-sill]')).toHaveValue('0');
		await page.locator('[data-opening-offset]').fill('2');
		const openingBefore = await acceptedResultCount(page);
		await placeOpeningThroughPalette(page, openingBefore);
		const openingSource = await downloadSource(page);
		const door = (layoutOf(openingSource).openings ?? []).find(
			(entry) => entry.wallId === divider.id && entry.kind === 'door'
		);
		if (door === undefined) throw new Error('the Door did not install on the divider');
		const afterOpening = layoutCounts(openingSource);
		expect(afterOpening.openings).toBe(1);
		rows.push(
			row(
				'empty.opening',
				'place a Door on the divider',
				'passed',
				`${door.id} on ${divider.id} at ${door.offset.toFixed(3)} m`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-empty-opening.png')
			)
		);

		await setReading(page, '3D');
		expect(layoutCounts(await downloadSource(page))).toEqual(afterOpening);
		await setReading(page, 'Plan');
		await deleteWallThroughCard(page, divider.id);
		const afterDeleteSource = await downloadSource(page);
		const afterDelete = layoutCounts(afterDeleteSource);
		expect(afterDelete.walls).toBe(afterDivide.walls - 1);
		expect(afterDelete.rooms).toBe(1);
		expect(afterDelete.openings).toBe(0);
		expect(layoutIds(afterDeleteSource).openings).not.toContain(door.id);
		rows.push(
			row(
				'empty.delete',
				'delete the divider and its Door',
				'passed',
				`${JSON.stringify(afterOpening)} → ${JSON.stringify(afterDelete)}; ${door.id} retired`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-empty-deleted.png')
			)
		);

		const undoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, undoBefore);
		expect(layoutCounts(await downloadSource(page))).toEqual(afterOpening);
		const redoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Redo', exact: true }).click();
		await waitForAcceptedResult(page, redoBefore);
		const redone = await downloadSource(page);
		expect(layoutIds(redone)).toEqual(layoutIds(afterDeleteSource));
		rows.push(
			row(
				'empty.undo-redo',
				'Undo/Redo covers the Wall, Door and Room',
				'passed',
				'Undo restored the hosted Door; Redo removed it again',
				page,
				viewport,
				reducedMotion
			)
		);

		const savedIds = layoutIds(redone);
		await saveToCloud(page);
		await page.reload();
		await expect(page.locator(STAGE)).toBeVisible({ timeout: 90_000 });
		await expect(page.locator(DOCK)).toBeVisible();
		await page.waitForTimeout(1_000);
		const reloaded = await downloadSource(page);
		expect(layoutIds(reloaded)).toEqual(savedIds);
		expect(layoutCounts(reloaded)).toEqual(afterDelete);
		rows.push(
			row(
				'empty.save-reload',
				'Save/reload preserves identities and the removed Door',
				'passed',
				`${savedIds.walls.length} Walls, ${savedIds.junctions.length} Junctions, ${savedIds.rooms.length} Rooms; 0 Openings`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-empty-reloaded.png')
			)
		);
		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(
			row(
				'empty.test',
				'integrated empty journey',
				'failed',
				error instanceof Error ? error.message : String(error),
				started.page,
				viewport,
				reducedMotion
			)
		);
		throw error;
	} finally {
		for (const entry of rows) await writeEvidence(entry);
		await started.close();
	}
});

test('narrow: keyboard, policy refusal and shell arbitration at 900×700 with reduced motion', async ({
	browser,
	baseURL
}) => {
	test.setTimeout(300_000);
	const started = await session(browser, baseURL!, {
		viewport: { width: 900, height: 700 },
		reducedMotion: 'reduce'
	});
	const rows: Row[] = [];
	const viewport = '900x700';
	const reducedMotion = true;
	try {
		const { page, errors } = started;
		await startProject(page, 'Enclosed room');
		await fitPlan(page);
		expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		const source = await downloadSource(page);
		const wallId = layoutOf(source).walls[0]!.id;
		await selectSubject(page, wallId);
		await page.waitForTimeout(300);
		const card = await page.locator(CARD).boundingBox();
		const lower = await page.locator('[data-lower-column]').boundingBox();
		if (card === null || lower === null) throw new Error('the Card or lower column has no box');
		const intersects =
			card.x < lower.x + lower.width &&
			lower.x < card.x + card.width &&
			card.y < lower.y + lower.height &&
			lower.y < card.y + card.height;
		expect(intersects, `Card ${JSON.stringify(card)} overlaps lower column ${JSON.stringify(lower)}`).toBe(false);
		rows.push(
			row(
				'narrow.shell',
				'narrow reduced-motion shell',
				'passed',
				'900×700; Card and lower column do not intersect; no horizontal page overflow',
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-narrow-shell.png')
			)
		);

		await page.locator('[data-head-find] summary').click();
		const find = page.locator('[data-head-find] input[type="search"]');
		await find.fill('Ink');
		const findEntry = page.locator('[data-head-find] button', { hasText: 'Ink' }).first();
		await expect(findEntry).toBeVisible();
		await findEntry.click();
		await expect(page.locator('[data-dock-tool="layout-ink"]')).toHaveAttribute('aria-pressed', 'true');
		rows.push(
			row('narrow.find', 'Head Find reaches the dock tool', 'passed', 'Ink armed from Find', page, viewport, reducedMotion)
		);
		await page.locator('[data-dock-select]').click();

		// Keyboard-only live chain: Enter finishes, Backspace removes one point,
		// Escape cancels with no source installed.
		await armInk(page);
		await typePoint(page, 8, 0, 1);
		await typePoint(page, 8, 3, 2);
		await typePoint(page, 10, 3, 3);
		const beforeKeyboard = await acceptedResultCount(page);
		await page.locator(STAGE).focus();
		await page.keyboard.press('Backspace');
		await waitForPoints(page, 2);
		await page.keyboard.press('Escape');
		await waitForPoints(page, 0);
		expect(await acceptedResultCount(page)).toBe(beforeKeyboard);
		expect(layoutIds(await downloadSource(page))).toEqual(layoutIds(source));
		rows.push(
			row(
				'narrow.keyboard',
				'keyboard backtrack and cancel install nothing',
				'passed',
				'Backspace removed one point; Escape cleared the chain; source unchanged',
				page,
				viewport,
				reducedMotion
			)
		);

		// A crossing without a Junction refuses in words with a repair and leaves
		// no partial source. Typed points exercise the same classification without
		// the narrow viewport's palette occluding the datum-level tap target.
		await armInk(page);
		await typePoint(page, 8, -2, 1);
		await typePoint(page, 6, -2, 2);
		const crossingBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		const refusal = page.locator('[data-ink-refusal]');
		await expect(refusal).toContainText(/cross|junction/i);
		expect(await acceptedResultCount(page)).toBe(crossingBefore);
		expect(layoutIds(await downloadSource(page))).toEqual(layoutIds(source));
		rows.push(
			row(
				'narrow.refusal',
				'crossing without a Junction refuses with a repair',
				'passed',
				(await refusal.innerText()).trim(),
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-narrow-refusal.png')
			)
		);
		await page.keyboard.press('Escape');

		// Invalid numeric options are announced and install nothing.
		await armInk(page);
		await page.locator('[data-ink-thickness]').fill('not-a-number');
		await page.locator('[data-ink-height]').click();
		await expect(page.locator(`${INK} p.error[role="alert"]`).first()).toContainText(/number|valid/i);
		expect(layoutIds(await downloadSource(page))).toEqual(layoutIds(source));
		rows.push(
			row(
				'narrow.invalid-options',
				'invalid palette measures announced',
				'passed',
				'thickness refusal installed nothing',
				page,
				viewport,
				reducedMotion
			)
		);
		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(
			row(
				'narrow.test',
				'narrow journey',
				'failed',
				error instanceof Error ? error.message : String(error),
				started.page,
				viewport,
				reducedMotion
			)
		);
		throw error;
	} finally {
		for (const entry of rows) await writeEvidence(entry);
		await started.close();
	}
});

test('short: shell stays arbitrated at 1024×600 with reduced motion', async ({ browser, baseURL }) => {
	test.setTimeout(240_000);
	const started = await session(browser, baseURL!, {
		viewport: { width: 1024, height: 600 },
		reducedMotion: 'reduce'
	});
	const rows: Row[] = [];
	const viewport = '1024x600';
	const reducedMotion = true;
	try {
		const { page, errors } = started;
		await startProject(page, 'Enclosed room');
		await fitPlan(page);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
		const source = await downloadSource(page);
		const wallId = layoutOf(source).walls[0]!.id;
		await selectSubject(page, wallId);
		await page.waitForTimeout(300);
		const card = await page.locator(CARD).boundingBox();
		const lower = await page.locator('[data-lower-column]').boundingBox();
		if (card === null || lower === null) throw new Error('the Card or lower column has no box');
		const intersects =
			card.x < lower.x + lower.width &&
			lower.x < card.x + card.width &&
			card.y < lower.y + lower.height &&
			lower.y < card.y + card.height;
		expect(intersects, `Card ${JSON.stringify(card)} overlaps lower column ${JSON.stringify(lower)}`).toBe(false);
		const stage = await page.locator(STAGE).boundingBox();
		const dock = await page.locator(DOCK).boundingBox();
		if (stage === null || dock === null) throw new Error('the Stage or dock has no box');
		expect(stage.height).toBeGreaterThan(120);
		expect(dock.y).toBeGreaterThanOrEqual(stage.y);
		rows.push(
			row(
				'short.shell',
				'short reduced-motion shell',
				'passed',
				`1024×600; Stage ${Math.round(stage.width)}×${Math.round(stage.height)}, Card/lower column clear, no page overflow`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't1-s04-short-shell.png')
			)
		);
		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(
			row(
				'short.test',
				'short shell',
				'failed',
				error instanceof Error ? error.message : String(error),
				started.page,
				viewport,
				reducedMotion
			)
		);
		throw error;
	} finally {
		for (const entry of rows) await writeEvidence(entry);
		await started.close();
	}
});
