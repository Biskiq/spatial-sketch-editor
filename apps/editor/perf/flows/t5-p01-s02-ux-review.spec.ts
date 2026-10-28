/**
 * T5.P01.S02 — integrated creator-workflow UX review.
 *
 * On-demand QA flow, not a benchmark and not part of a Vitest lane. It drives
 * the shipped editor against the real API, a task-private database and the
 * API test-auth seam, exactly as T1's integrated gate does, and records a row
 * plus screenshots for each scenario it can actually observe.
 *
 * Run through `perf/run-t1-s04-integrated-qa.mjs` with
 * `T1_S04_QA_SPEC=perf/flows/t5-p01-s02-ux-review.spec.ts`.
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
const evidencePath = resolve(resultsDir, 't5-p01-s02-ux-evidence.json');

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
};

type Session = {
	readonly page: Page;
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
	return { page, errors, close: () => context.close() };
}

async function startEmpty(page: Page): Promise<string> {
	const projectId = uniqueProjectId('t5-s02-ux');
	await page.goto(`/project/${encodeURIComponent(projectId)}/spatial?create=1`);
	await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeVisible();
	await page.getByRole('button', { name: 'Begin empty', exact: true }).click();
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
	let previous: string | null = null;
	// A click dispatches its intent and the route writes the new evaluation on the
	// next frame; sampling immediately can see the old pose twice and call it settled.
	await page.waitForTimeout(400);
	while (Date.now() - started < timeout) {
		const pose = await cameraPose(page);
		if (pose !== '' && pose === previous) return;
		if (pose !== '') previous = pose;
		await page.waitForTimeout(200);
	}
	throw new Error(
		`the Stage camera did not settle in ${timeout}ms ` +
			(previous === null ? '(never published to the harness)' : '(pose kept changing)')
	);
}

/**
 * A published overlay marker's CSS point, with the Stage surface as its origin.
 * The overlay is inset in the Stage and markers are translated in that space.
 */
async function markerPoint(page: Page, needle: string): Promise<{ x: number; y: number } | null> {
	return page.evaluate((text) => {
		const titles = [...document.querySelectorAll<SVGTitleElement>('svg.overlay g.marker title')];
		const title = titles.find((candidate) => (candidate.textContent ?? '').includes(text));
		if (title === undefined) return null;
		const marker = title.parentElement;
		if (marker === null) return null;
		// The painted box already includes the SVG transform and the surface's own
		// offset; reading it avoids assuming the overlay's origin is the Stage's.
		const rect = marker.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}, needle);
}

async function pointOverStage(page: Page, point: { x: number; y: number }): Promise<boolean> {
	return page.evaluate(([x, y]) => {
		const element = document.elementFromPoint(x, y);
		return element !== null && element.tagName.toLowerCase() === 'canvas';
	}, [point.x, point.y] as const);
}

/**
 * In the depth phase an empty press falls through to Stage navigation, so a pan
 * can lift a handle published behind the bottom Ink palette. Returns the visible
 * handle point.
 */
async function liftDepthHandle(page: Page): Promise<{ x: number; y: number }> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const handle = await markerPoint(page, 'Depth ');
		if (handle === null) throw new Error('the Shape depth handle is not published');
		if (await pointOverStage(page, handle)) return handle;
		const box = await page.locator(STAGE).boundingBox();
		if (box === null) throw new Error('the Stage has no box to pan');
		const x = box.x + box.width / 2;
		await page.mouse.move(x, box.y + box.height * 0.42);
		await page.mouse.down();
		await page.mouse.move(x, box.y + box.height * 0.1, { steps: 12 });
		await page.mouse.up();
		await waitForCameraSettled(page);
	}
	throw new Error('the Shape depth handle stayed behind another surface');
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
	if (reading === 'opening') await expect(page.locator(OPENING_PALETTE)).toBeVisible();
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

async function clickShapePoint(page: Page, point: readonly [number, number, number], count: number): Promise<void> {
	await clickWorld(page, point);
	await waitForPoints(page, count, true);
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

function layoutOf(source: Record<string, any>) {
	return source.units?.layout?.data as {
		walls: { id: string; startJunctionId: string; endJunctionId: string }[];
		junctions: { id: string; point: [number, number] }[];
		rooms: { id: string }[];
		openings: { id: string; wallId: string; kind: string }[];
	};
}

function sceneForms(source: Record<string, any>) {
	return (source.units?.scene?.data?.entities ?? []).filter((entity: { kind: string }) => entity.kind === 'form') as {
		id: string;
		position: [number, number, number];
		rotation: [number, number, number];
		form: { generator: { kind: string; plane: string; extent: number }; scale: [number, number, number] };
	}[];
}

function dividerWall(sourceAfter: Record<string, any>, sourceBefore: Record<string, any>): string {
	const before = layoutOf(sourceBefore);
	const after = layoutOf(sourceAfter);
	const beforeWalls = new Set(before.walls.map((wall) => wall.id));
	const beforeJunctions = new Set(before.junctions.map((junction) => junction.id));
	const divider = after.walls.find(
		(wall) =>
			!beforeWalls.has(wall.id) &&
			!beforeJunctions.has(wall.startJunctionId) &&
			!beforeJunctions.has(wall.endJunctionId)
	);
	if (divider === undefined) throw new Error('the division added no divider between two new junctions');
	return divider.id;
}

async function selectSubject(page: Page, sourceId: string): Promise<void> {
	await closeCard(page);
	await page.locator('#plate-index-search').fill(sourceId);
	const row = page.locator('button.item-row', { hasText: sourceId }).first();
	await expect(row).toBeVisible();
	await row.click();
	await expect(page.locator(CARD)).toBeVisible();
}

async function placeOpening(page: Page, before: number): Promise<void> {
	const refusal = page.locator('[data-opening-refusal]');
	await page.locator('[data-opening-place]').click();
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

async function writeRow(row: Row): Promise<void> {
	let evidence: Record<string, unknown> = {
		flow: 'T5.P01.S02 integrated creator-workflow UX review',
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
	const rows = (evidence.rows as Row[] | undefined) ?? [];
	rows.push(row);
	evidence.rows = rows;
	evidence.generatedAt = new Date().toISOString();
	await mkdir(resultsDir!, { recursive: true });
	await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
}

function row(
	id: string,
	scenario: string,
	status: Row['status'],
	detail: string,
	page: Page,
	viewport: string,
	reducedMotion: boolean,
	screenshot?: string
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
		...(screenshot === undefined ? {} : { screenshot })
	};
}

test.describe.configure({ mode: 'serial' });

let savedProjectId = '';

test('S02 integrated creator workflow', async ({ browser, baseURL }) => {
	test.setTimeout(600_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
	const rows: Row[] = [];
	const viewport = '1440x900';
	const reducedMotion = false;
	try {
		const { page, errors } = started;
		savedProjectId = await startEmpty(page);

		// Draw an enclosure, close it, then divide it through two host Walls.
		await armInk(page);
		await typePoint(page, 2, -2, 1);
		await typePoint(page, 6, -2, 2);
		await typePoint(page, 6, 2, 3);
		await typePoint(page, 2, 2, 4);
		const closeBefore = await acceptedResultCount(page);
		await page.locator('[data-ink-close]').click();
		await waitForAcceptedResult(page, closeBefore);
		const closed = await downloadSource(page);
		expect(layoutOf(closed).rooms).toHaveLength(1);
		rows.push(row('draw.close', 'Draw and close a Room', 'passed', '4 Walls / 4 Junctions / 1 Room', page, viewport, reducedMotion));

		// Frame the authored enclosure and close the Wall card that now owns the
		// lower column. Shape points stay in the upper half of the Room, above the
		// bottom Ink palette.
		await closeCard(page);
		await fitPlan(page);
		await armInk(page);
		await typePoint(page, 2, 0, 1);
		await typePoint(page, 6, 0, 2);
		const divideBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		await waitForAcceptedResult(page, divideBefore);
		const divided = await downloadSource(page);
		expect(layoutOf(divided).rooms).toHaveLength(2);
		const divider = dividerWall(divided, closed);
		rows.push(
			row(
				'divide.rooms',
				'Divide the Room through both Walls',
				'passed',
				`2 Rooms; divider ${divider}`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-01-drawn-divided.png')
			)
		);

		// Place a Window through the Opening reading, then switch all three readings.
		await selectSubject(page, divider);
		await closeCard(page);
		await chooseReading(page, 'opening');
		await page.locator('[data-opening-kind]').selectOption('window');
		await placeOpening(page, await acceptedResultCount(page));
		const opened = await downloadSource(page);
		expect(layoutOf(opened).openings).toHaveLength(1);
		expect(layoutOf(opened).openings[0]!.kind).toBe('window');
		rows.push(
			row(
				'opening.place',
				'Place a Window through the Opening reading',
				'passed',
				'one Wall-hosted Window',
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-02-opening.png')
			)
		);

		await closeCard(page);
		await chooseReading(page, 'wall');
		await expect(page.locator(INK)).toBeVisible();
		await chooseReading(page, 'shape');
		await expect(page.locator('[data-shape-palette]')).toBeVisible();
		rows.push(row('ink.readings', 'Switch Wall → Opening → Shape', 'passed', 'one Pen, three readings; no source written', page, viewport, reducedMotion));

		// An invalid outline names its issue before Finish, then Clear recovers.
		for (const [index, point] of (
			[
				[2.5, 0, 1.8],
				[3.5, 0, 0.8],
				[3.5, 0, 1.8],
				[2.5, 0, 0.8]
			] as const
		).entries()) {
			await clickShapePoint(page, point, index + 1);
		}
		const invalidRefusal = page.locator('[data-shape-refusal]');
		await expect(invalidRefusal).toBeVisible();
		await expect(invalidRefusal).toContainText(/crosses itself/i);
		await expect(page.locator('[data-shape-finish]')).toBeDisabled();
		rows.push(
			row(
				'shape.invalid-outline',
				'Invalid outline refuses live',
				'passed',
				`${(await invalidRefusal.innerText()).trim()}; Finish disabled`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-03-invalid-outline.png')
			)
		);
		await page.locator('[data-shape-clear]').click();

		// A valid floor Shape: keyboard backtrack, Enter Finish, invalid depth, Create.
		await clickShapePoint(page, [3, 0, 1.8], 1);
		await clickShapePoint(page, [5, 0, 1.8], 2);
		await clickShapePoint(page, [5, 0, 0.8], 3);
		await page.locator(STAGE).focus();
		await page.keyboard.press('Backspace');
		await waitForPoints(page, 2, true);
		await clickShapePoint(page, [5, 0, 0.8], 3);
		await clickShapePoint(page, [3, 0, 0.8], 4);
		await finishWithEnter(page);
		await expect(page.locator('[data-shape-depth]')).toBeVisible();

		// Cancelling the depth phase returns the live outline without writing a form.
		await page.locator('[data-shape-back]').click();
		await expect(page.locator('[data-shape-depth]')).toBeHidden();
		await expect(page.locator('[data-shape-finish]')).toBeEnabled();
		expect(sceneForms(await downloadSource(page))).toHaveLength(0);
		rows.push(
			row(
				'shape.depth-cancel',
				'Cancel the depth phase',
				'passed',
				'outline restored; no form written',
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-04a-depth-cancel.png')
			)
		);
		await finishWithEnter(page);
		await expect(page.locator('[data-shape-depth]')).toBeVisible();

		const depth = page.locator('[data-shape-depth]');
		await depth.fill('0');
		await depth.press('Tab');
		await expect(page.locator('[data-shape-refusal]')).toContainText(/between/i);
		await expect(page.locator('[data-shape-create]')).toBeDisabled();
		rows.push(
			row(
				'shape.invalid-depth',
				'Invalid typed depth refuses Create',
				'passed',
				'0 m names the admitted range; Create disabled',
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-04-invalid-depth.png')
			)
		);

		// The Plan floor normal faces the camera, so the handle is published up-screen
		// by its depth: pull it vertically and the same point must accept the drag.
		const planDepthHandle = await liftDepthHandle(page);
		const planValueBefore = await depth.inputValue();
		await page.mouse.move(planDepthHandle.x, planDepthHandle.y);
		await page.mouse.down();
		await page.mouse.move(planDepthHandle.x, planDepthHandle.y - 90, { steps: 10 });
		await page.mouse.up();
		await page.waitForTimeout(300);
		const planValueAfter = await depth.inputValue();
		const planCreateEnabled = await page.locator('[data-shape-create]').isEnabled();
		expect(planValueAfter).not.toBe(planValueBefore);
		expect(planCreateEnabled).toBe(true);
		rows.push(
			row(
				'shape.depth-drag-plan',
				'Depth handle in Plan',
				planValueAfter !== planValueBefore && planCreateEnabled ? 'passed' : 'failed',
				`${planValueBefore.trim()} → ${planValueAfter.trim()} m; Create ${
					planCreateEnabled ? 'enabled' : 'still disabled'
				}`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-04b-depth-drag-plan.png')
			)
		);

		// The PR-review regression path: a valid depth drag must restore validity after
		// an invalid typed value. In 3D the floor normal has real screen travel.
		await setReading(page, '3D');
		const depthHandle = await liftDepthHandle(page);
		await page.mouse.move(depthHandle.x, depthHandle.y);
		await page.mouse.down();
		await page.mouse.move(depthHandle.x, depthHandle.y - 90, { steps: 10 });
		await page.mouse.up();
		await expect(page.locator('[data-shape-create]')).toBeEnabled({ timeout: 10_000 });
		await expect(depth).not.toHaveValue('0');
		rows.push(
			row(
				'shape.invalid-depth-drag',
				'Depth drag recovers an invalid typed value',
				'passed',
				`handle dragged to ${(await depth.inputValue()).trim()} m; Create enabled`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-04c-depth-recovered.png')
			)
		);
		await setReading(page, 'Plan');
		await depth.fill('1.2');
		await depth.press('Tab');
		await expect(page.locator('[data-shape-create]')).toBeEnabled();
		const floorCreateBefore = await acceptedResultCount(page);
		await page.locator('[data-shape-create]').click();
		await waitForAcceptedResult(page, floorCreateBefore);
		await expect(page.locator(CARD)).toBeVisible();
		const floorSource = await downloadSource(page);
		const floorForms = sceneForms(floorSource);
		expect(floorForms).toHaveLength(1);
		expect(floorForms[0]!.form.generator).toMatchObject({ kind: 'extrude', plane: 'plan', extent: 1.2 });
		rows.push(
			row(
				'shape.floor.create',
				'Create a floor native form',
				'passed',
				'one plan extrude at 1.2 m; Card selected',
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-05-floor-created.png')
			)
		);

		// Exact Card size, then Undo/Redo.
		const widthField = page.getByLabel('Form width (m)');
		const heightField = page.getByLabel('Form height (m)');
		const depthField = page.getByLabel('Form depth (m)');
		await widthField.fill('3');
		await heightField.fill('1.2');
		await depthField.fill('2');
		const sizeBefore = await acceptedResultCount(page);
		await page.locator('.form-fields').getByRole('button', { name: 'Size', exact: true }).click();
		await waitForAcceptedResult(page, sizeBefore);
		await expect(widthField).toHaveValue(/3/);
		await expect(heightField).toHaveValue(/1\.2/);
		await expect(depthField).toHaveValue(/2/);
		const sizedSource = await downloadSource(page);
		const sized = sceneForms(sizedSource)[0]!;
		rows.push(
			row(
				'size.card-exact',
				'Size per axis through the Card',
				'passed',
				`dimensions 3 × 1.2 × 2; scale ${sized.form.scale.map((value) => value.toFixed(3)).join(' × ')}`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-06-sized-card.png')
			)
		);

		const undoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, undoBefore);
		const undoneWidth = sceneForms(await downloadSource(page))[0]!.form.scale[0];
		expect(undoneWidth).not.toBeCloseTo(sized.form.scale[0], 6);
		const redoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Redo', exact: true }).click();
		await waitForAcceptedResult(page, redoBefore);
		expect(sceneForms(await downloadSource(page))[0]!.form.scale[0]).toBeCloseTo(sized.form.scale[0], 6);
		rows.push(row('size.undo-redo', 'Size is one history entry', 'passed', 'Undo restores the prior scale; Redo returns it', page, viewport, reducedMotion));

		// Ink stays armed after Create so the creator can draw another Shape; direct
		// size rays are offered only while no contributed task owns the pointer. The
		// Card is dismissed only for the ray leg so it cannot cover the handle.
		await closeCard(page);
		await page.locator('[data-dock-select]').click();
		await expect(page.locator('[data-dock-select]')).toHaveAttribute('aria-pressed', 'true');
		// Per-axis ray drag from the selected form's Width handle, read from the
		// overlay so the press lands on the published handle rather than a guess.
		const dragFrom = await markerPoint(page, 'Width ');
		if (dragFrom === null) throw new Error('the selected form\'s Width handle is not published');
		if (!(await pointOverStage(page, dragFrom))) {
			throw new Error(`the Width handle at ${dragFrom.x},${dragFrom.y} is covered by another surface`);
		}
		const rayBefore = await acceptedResultCount(page);
		await page.mouse.move(dragFrom.x, dragFrom.y);
		await page.mouse.down();
		await page.waitForTimeout(100);
		// The published handle is the form's left Width edge; pull it outward (left)
		// to increase the axis, which also proves the ray is not an inward-only knob.
		await page.mouse.move(dragFrom.x - 60, dragFrom.y, { steps: 8 });
		await page.waitForTimeout(100);
		await page.mouse.up();
		await page.waitForTimeout(800);
		const rayAfter = await acceptedResultCount(page);
		if (rayAfter === rayBefore) {
			await capture(page, 't5-s02-07a-size-ray-miss.png');
			throw new Error(`the Width ray gesture did not commit (handle ${dragFrom.x.toFixed(1)},${dragFrom.y.toFixed(1)})`);
		}
		const raySource = await downloadSource(page);
		const rayForm = sceneForms(raySource)[0]!;
		expect(rayForm.form.scale[0]).toBeGreaterThan(sized.form.scale[0]);
		rows.push(
			row(
				'size.ray',
				'Drag the Width ray',
				'passed',
				`scale ${sized.form.scale[0].toFixed(3)} → ${rayForm.form.scale[0].toFixed(3)}; one accepted result`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-07-size-ray.png')
			)
		);

		// In settled Plan, Height is hidden along the camera ray. Its screen-space
		// handle remains a real size writer and one ray commit remains one Undo.
		const heightFrom = await markerPoint(page, 'Height ');
		if (heightFrom === null) throw new Error('the selected form\'s Height handle is not published in Plan');
		if (!(await pointOverStage(page, heightFrom))) {
			throw new Error(`the Plan Height handle at ${heightFrom.x},${heightFrom.y} is covered by another surface`);
		}
		const planHeightBefore = sceneForms(await downloadSource(page))[0]!;
		const planHeightResultBefore = await acceptedResultCount(page);
		await page.mouse.move(heightFrom.x, heightFrom.y);
		await page.mouse.down();
		await page.mouse.move(heightFrom.x, heightFrom.y - 60, { steps: 8 });
		await page.mouse.up();
		await waitForAcceptedResult(page, planHeightResultBefore);
		const planHeightAfter = sceneForms(await downloadSource(page))[0]!;
		expect(planHeightAfter.form.scale[1]).toBeGreaterThan(planHeightBefore.form.scale[1]);
		rows.push(
			row(
				'size.plan-height-ray',
				'Drag Height in Plan',
				'passed',
				`scale ${planHeightBefore.form.scale[1].toFixed(3)} → ${planHeightAfter.form.scale[1].toFixed(3)}; one accepted result`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-07b-plan-height-size.png')
			)
		);
		const planHeightUndoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, planHeightUndoBefore);
		expect(sceneForms(await downloadSource(page))[0]!.form.scale[1]).toBeCloseTo(planHeightBefore.form.scale[1], 6);
		const planHeightRedoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Redo', exact: true }).click();
		await waitForAcceptedResult(page, planHeightRedoBefore);
		expect(sceneForms(await downloadSource(page))[0]!.form.scale[1]).toBeCloseTo(planHeightAfter.form.scale[1], 6);
		rows.push(
			row(
				'size.plan-height-undo-redo',
				'Plan Height is one history entry',
				'passed',
				'Undo restores the previous Height scale; Redo restores the ray result',
				page,
				viewport,
				reducedMotion
			)
		);

		// An upright Shape on a 3D sheet, with Flip side.
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
		// A triangle stays below the Head at this fitted 3D pose; its three points
		// are still a closed, valid elevation outline.
		for (const [index, point] of (
			[
				[4, 2, 0],
				[5, 2, 0],
				[4, 2.5, 0]
			] as const
		).entries()) {
			await clickShapePoint(page, point, index + 1);
		}
		await page.locator('[data-shape-finish]').click();
		await page.locator('[data-shape-depth]').fill('0.5');
		await page.locator('[data-shape-depth]').press('Tab');
		const uprightBefore = await acceptedResultCount(page);
		await page.locator('[data-shape-create]').click();
		await waitForAcceptedResult(page, uprightBefore);
		const uprightSource = await downloadSource(page);
		const forms = sceneForms(uprightSource);
		expect(forms).toHaveLength(2);
		const upright = forms.find((form) => form.form.generator.plane === 'elevation')!;
		expect(upright.form.generator.extent).toBeCloseTo(0.5, 3);
		rows.push(
			row(
				'shape.upright.create',
				'Create an upright native form on a 3D sheet',
				'passed',
				`elevation extrude at 0.5 m; rotation y=${upright.rotation[1].toFixed(3)}`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-08-upright-created.png')
			)
		);

		// Save, reload, and compare the complete source identity set.
		const beforeSave = await downloadSource(page);
		const savedFormIds = sceneForms(beforeSave).map((form) => form.id).sort();
		await saveToCloud(page);
		await page.reload();
		await expect(page.locator(STAGE)).toBeVisible({ timeout: 90_000 });
		await expect(page.locator(DOCK)).toBeVisible();
		await page.waitForTimeout(1_000);
		const reloaded = await downloadSource(page);
		expect(sceneForms(reloaded).map((form) => form.id).sort()).toEqual(savedFormIds);
		expect(layoutOf(reloaded).rooms).toHaveLength(2);
		rows.push(
			row(
				'save.reload',
				'Save/reload preserves Layout and both forms',
				'passed',
				`2 Rooms; forms ${savedFormIds.join(', ')}`,
				page,
				viewport,
				reducedMotion,
				await capture(page, 't5-s02-09-reloaded.png')
			)
		);

		// Plan/3D consistency after reload.
		await setReading(page, 'Plan');
		expect(sceneForms(await downloadSource(page)).map((form) => form.id).sort()).toEqual(savedFormIds);
		await setReading(page, '3D');
		expect(sceneForms(await downloadSource(page)).map((form) => form.id).sort()).toEqual(savedFormIds);
		rows.push(row('reading.plan-3d', 'Plan and 3D agree after reload', 'passed', 'same form identities in both readings', page, viewport, reducedMotion));

		// Preview is either a real isolated surface or an explicit refusal.
		const preview = page.locator('[data-head-preview] button');
		if ((await preview.count()) > 0 && (await preview.isEnabled().catch(() => false))) {
			await preview.click();
			await expect(page.locator('.preview-takeover')).toBeVisible({ timeout: 60_000 });
			const takeover = await capture(page, 't5-s02-10-preview.png');
			await page.keyboard.press('Escape');
			await expect(page.locator(STAGE)).toBeVisible();
			rows.push(row('preview.enter-exit', 'Enter and leave Preview', 'passed', 'isolated Preview opened and returned to the Stage', page, viewport, reducedMotion, takeover));
		} else {
			const reason = (await page.locator('[data-unavailable-capability]').filter({ hasText: 'Preview' }).innerText()).trim();
			rows.push(row('preview.unavailable', 'Preview availability', 'not-run', `not exercisable from this source: ${reason}`, page, viewport, reducedMotion));
		}

		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(row('main.test', 'integrated S02 creator workflow', 'failed', error instanceof Error ? error.message : String(error), started.page, viewport, reducedMotion));
		throw error;
	} finally {
		for (const entry of rows) await writeRow(entry);
		await started.close();
	}
});

test('S02 Preview enters the authored world', async ({ browser, baseURL }) => {
	test.setTimeout(240_000);
	expect(savedProjectId).not.toBe('');
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
	const rows: Row[] = [];
	const viewport = '1440x900';
	try {
		const { page, errors } = started;
		await page.goto(`/project/${encodeURIComponent(savedProjectId)}/spatial`);
		await expect(page.locator(STAGE)).toBeVisible({ timeout: 90_000 });
		await expect(page.locator(DOCK)).toBeVisible();
		await page.waitForTimeout(800);

		// Preview needs an Experience and an enterable Presentation. Create them
		// through the shipped lens, then capture the 3D framing as a View.
		await page.locator('.lens-button', { hasText: 'Experience' }).click();
		const lens = page.getByRole('region', { name: 'Experience lens' });
		await expect(lens).toBeVisible({ timeout: 30_000 });
		await lens.getByRole('button', { name: 'Create Experience', exact: true }).click();
		await expect(lens.getByText('Accepted.')).toBeVisible({ timeout: 30_000 });
		await page.locator('.stage-actions').getByRole('button', { name: '3D', exact: true }).click();
		await waitForCameraSettled(page);
		await page.getByRole('toolbar', { name: 'Experience dock' }).getByRole('button', { name: 'Capture', exact: true }).click();
		await expect(lens.getByText('Accepted.')).toBeVisible({ timeout: 30_000 });

		const preview = page.locator('[data-head-preview] button');
		await expect(preview).toBeEnabled({ timeout: 60_000 });
		await preview.click();
		await expect(page.locator('.preview-takeover')).toBeVisible({ timeout: 60_000 });
		const takeover = await capture(page, 't5-s02-10-preview.png');
		await page.keyboard.press('Escape');
		await expect(page.locator(STAGE)).toBeVisible();
		expect(errors).toEqual([]);
		rows.push(
			row(
				'preview.enter-exit',
				'Enter and leave Preview',
				'passed',
				'created an Experience/Presentation, captured the 3D view, entered Preview and returned to the Stage',
				page,
				viewport,
				false,
				takeover
			)
		);
	} catch (error) {
		rows.push(
			row(
				'preview.test',
				'Preview journey',
				'failed',
				error instanceof Error ? error.message : String(error),
				started.page,
				viewport,
				false
			)
		);
		throw error;
	} finally {
		for (const entry of rows) await writeRow(entry);
		await started.close();
	}
});

test('S02 narrow and short shells with reduced motion', async ({ browser, baseURL }) => {
	test.setTimeout(300_000);
	expect(savedProjectId).not.toBe('');
	for (const [label, viewport] of [
		['narrow', { width: 900, height: 700 }],
		['short', { width: 1024, height: 600 }]
	] as const) {
		const started = await session(browser, baseURL!, { viewport, reducedMotion: 'reduce' });
		const rows: Row[] = [];
		const size = `${viewport.width}x${viewport.height}`;
		try {
			const { page, errors } = started;
			expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
			await page.goto(`/project/${encodeURIComponent(savedProjectId)}/spatial`);
			await expect(page.locator(STAGE)).toBeVisible({ timeout: 90_000 });
			await expect(page.locator(DOCK)).toBeVisible();
			await page.waitForTimeout(800);
			await armInk(page);
			await chooseReading(page, 'shape');
			// The instrument is the bounded surface: its body scrolls rather than
			// letting the taller Shape controls fall outside the viewport.
			const instrument = page.locator('[data-stage-instrument]');
			const instrumentBox = await instrument.boundingBox();
			expect(instrumentBox).not.toBeNull();
			expect(instrumentBox!.x).toBeGreaterThanOrEqual(0);
			expect(instrumentBox!.y).toBeGreaterThanOrEqual(0);
			expect(instrumentBox!.x + instrumentBox!.width).toBeLessThanOrEqual(viewport.width + 1);
			expect(instrumentBox!.y + instrumentBox!.height).toBeLessThanOrEqual(viewport.height + 1);
			const body = instrument.locator('.instrument-body');
			const scrolling = await body.evaluate((element) => ({
				clientHeight: element.clientHeight,
				scrollHeight: element.scrollHeight
			}));
			expect(scrolling.scrollHeight).toBeGreaterThan(scrolling.clientHeight);
			await page.locator('[data-shape-finish]').scrollIntoViewIfNeeded();
			await expect(page.locator('[data-shape-finish]')).toBeInViewport();
			const overflow = await page.evaluate(() => ({
				scrollWidth: document.documentElement.scrollWidth,
				innerWidth: window.innerWidth
			}));
			expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
			expect(errors).toEqual([]);
			rows.push(
				row(
					`shell.${label}`,
					`${label} shell with reduced motion`,
					'passed',
					`Shape instrument fits (${Math.round(instrumentBox!.width)}×${Math.round(instrumentBox!.height)}); body scrolls to Finish; no horizontal overflow`,
					page,
					size,
					true,
					await capture(page, `t5-s02-11-${label}.png`)
				)
			);
		} catch (error) {
			rows.push(row(`shell.${label}.test`, `${label} shell`, 'failed', error instanceof Error ? error.message : String(error), started.page, size, true));
			throw error;
		} finally {
			for (const entry of rows) await writeRow(entry);
			await started.close();
		}
	}
});
