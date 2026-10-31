/**
 * T1.P02.S02 — browser acceptance for draw, close, divide and delete.
 *
 * This is on-demand slice evidence, not a measurement row. It drives the shipped
 * Stage through the real Ink palette, dock, Card, Head and Save/reload path
 * against the compiled API and a task-private database. Every row records the
 * revision, viewport, reading/motion preference and the observed consequence.
 *
 * The suite deliberately fails on a refused creator action rather than treating
 * a selector as proof: drawing is accepted only when an accepted result installs
 * and the downloaded source gains the expected Walls/Junctions/Rooms.
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
const CARD = 'aside.card';
const CARD_FIELDS = '[data-layout-card-fields]';
const DELETE = '[data-card-action="layout-wall-delete"]';
const LENS = '[role="group"][aria-label="Product lens"]';
const evidencePath = resolve(resultsDir, 't1-s02-browser-evidence.json');

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
		flow: 'T1.P02.S02 browser acceptance',
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
	const projectId = uniqueProjectId('t1s02');
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
	// A prior refusal/hover can still be presenting a camera update. Aim only
	// after the rendered camera settles, and retain read-only evidence of the
	// requested point, each press and the Stage's draft-marker projection.
	await waitForCameraSettled(page);
	const beforePose = await cameraPose(page);
	const { x, y } = await cssPoint(page, point);
	const hit = await page.evaluate(([clientX, clientY]) => {
		const element = document.elementFromPoint(clientX, clientY);
		return element === null ? 'none' : `${element.tagName.toLowerCase()}.${String(element.className)}`;
	}, [x, y] as const);
	if (!hit.includes('canvas') && !hit.includes('stage')) {
		throw new Error(`world point ${point.join(',')} projects to ${x.toFixed(1)},${y.toFixed(1)} over ${hit}, not the Stage`);
	}
	await page.mouse.move(x, y);
	const pressPose = await cameraPose(page);
	await page.mouse.down();
	await page.mouse.up();
	await page.waitForTimeout(150);
	const markers = await page.locator('.overlay .marker').evaluateAll((nodes) => nodes
		.filter((node) => node.querySelector('title')?.textContent?.startsWith('Chain point'))
		.map((node) => ({ label: node.querySelector('title')?.textContent, css: node.getAttribute('transform') })));
	const traceFile = resolve(resultsDir!, 't1-s02-pointer-trace.json');
	let traces: unknown[] = [];
	try { traces = JSON.parse(await readFile(traceFile, 'utf8')); } catch { /* first pointer */ }
	traces.push({ url: page.url(), requestedWorld: point, clientCss: [x, y], beforePose, pressPose,
		afterPose: await cameraPose(page), draftMarkerProjection: markers });
	await writeFile(traceFile, JSON.stringify(traces, null, 2));
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

function layoutCounts(source: Record<string, any>) {
	const layout = source.units?.layout?.data;
	if (layout === undefined) throw new Error('the downloaded source has no Layout unit');
	return {
		walls: layout.walls.length as number,
		junctions: layout.junctions.length as number,
		rooms: layout.rooms.length as number,
		openings: (layout.openings?.length ?? 0) as number
	};
}

function layoutIds(source: Record<string, any>) {
	const layout = source.units?.layout?.data;
	return {
		walls: (layout.walls as { id: string }[]).map((wall) => wall.id).sort(),
		junctions: (layout.junctions as { id: string }[]).map((junction) => junction.id).sort(),
		rooms: (layout.rooms as { id: string }[]).map((room) => room.id).sort()
	};
}

async function selectSubject(page: Page, sourceId: string): Promise<void> {
	await page.locator('#plate-index-search').fill(sourceId);
	const row = page.locator('button.item-row', { hasText: sourceId }).first();
	await expect(row).toBeVisible();
	await row.click();
	await expect(page.locator(CARD)).toBeVisible();
}

async function capture(page: Page, name: string): Promise<string> {
	const path = resolve(resultsDir!, name);
	await page.screenshot({ path, fullPage: true, animations: 'disabled' });
	return name;
}

async function saveToCloud(page: Page): Promise<void> {
	const button = page.locator('[data-head-save] button').first();
	await expect(button).toBeEnabled();
	await button.click();
	await expect(page.locator('[data-head-save]')).toHaveAttribute('data-save-status', 'saved', { timeout: 90_000 });
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

test('starter: draw a deliberate join, close an enclosure, divide a Room, delete, undo/redo and reload', async ({ browser, baseURL }) => {
	test.setTimeout(300_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
	const rows: Row[] = [];
	try {
		const { page, errors } = started;
		await startProject(page, 'Enclosed room');
		await fitPlan(page);
		// The new enclosure extends past the starter's Fit; a user zooms out on the
		// shipped Stage so every deliberate point is reachable by the pointer.
		const stageBox = await page.locator(STAGE).boundingBox();
		if (stageBox === null) throw new Error('the Stage has no box');
		await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
		await page.mouse.wheel(0, 400);
		await page.waitForTimeout(300);
		const before = layoutCounts(await downloadSource(page));
		expect(before).toMatchObject({ walls: 4, junctions: 4, rooms: 1 });
		rows.push(row('starter.baseline', 'starter enclosure', 'passed', JSON.stringify(before), page, '1440x900', false));

		await armInk(page);
		// One deliberate junction at the starter's (7, 2) corner; the other three
		// corners are free points. Closing on the start Junction must not mint a
		// parallel Junction at the same coordinate.
		await clickWorldAndWait(page, [7, 0, 2], 1);
		await clickWorldAndWait(page, [9, 0, 2], 2);
		await clickWorldAndWait(page, [9, 0, 4], 3);
		await clickWorldAndWait(page, [7, 0, 4], 4);
		const acceptedBeforeClose = await acceptedResultCount(page);
		await clickWorld(page, [7, 0, 2]);
		await page.waitForTimeout(400);
		let closePath = 'pointer on start Junction';
		if ((await acceptedResultCount(page)) === acceptedBeforeClose) {
			const close = page.locator('[data-ink-close]');
			if (await close.isEnabled()) {
				await close.click();
				closePath = 'Close ring button (pointer start did not close)';
			}
		}
		await waitForAcceptedResult(page, acceptedBeforeClose);
		await expect(page.locator('[data-ink-refusal]')).toHaveCount(0);
		const closedSource = await downloadSource(page);
		const afterClose = layoutCounts(closedSource);
		const closedWallIds = layoutIds(closedSource).walls;
		expect(afterClose.walls).toBe(before.walls + 4);
		expect(afterClose.junctions).toBe(before.junctions + 3);
		expect(afterClose.rooms).toBe(before.rooms + 1);
		rows.push(row(
			'starter.close',
			'free Wall → deliberate join → enclosure',
			'passed',
			`${closePath}; ${JSON.stringify(before)} → ${JSON.stringify(afterClose)}; one accepted result installed`,
			page,
			'1440x900',
			false,
			await capture(page, 't1-s02-starter-closed.png')
		));

		await setReading(page, '3D');
		expect(layoutCounts(await downloadSource(page))).toEqual(afterClose);
		rows.push(row('starter.plan-3d', 'Plan/3D read one candidate', 'passed', 'reading switch preserved the accepted counts', page, '1440x900', false, await capture(page, 't1-s02-starter-3d.png')));
		await setReading(page, 'Plan');

		// Closing the auto-selected Wall's Card keeps its selection but uncovers the
		// left edge of the Stage, where the dividing Wall starts.
		const closeCard = page.getByRole('button', { name: 'Close selection card' });
		if (await closeCard.isVisible().catch(() => false)) await closeCard.click();
		await armInk(page);
		await clickWorldAndWait(page, [7, 0, 0], 1);
		await clickWorldAndWait(page, [0, 0, 0], 2);
		const beforeDivide = await acceptedResultCount(page);
		await finishWithEnter(page);
		await waitForAcceptedResult(page, beforeDivide);
		const dividedSource = await downloadSource(page);
		const afterDivide = layoutCounts(dividedSource);
		// A division that splits both host Walls adds the two split segments plus
		// the dividing Wall; the semantic outcome is exactly one new Room.
		expect(afterDivide.walls).toBeGreaterThan(afterClose.walls);
		expect(afterDivide.rooms).toBe(afterClose.rooms + 1);
		rows.push(row('starter.divide', 'divide a Room', 'passed', `${JSON.stringify(afterClose)} → ${JSON.stringify(afterDivide)}`, page, '1440x900', false, await capture(page, 't1-s02-starter-divided.png')));

		// The dividing Wall is the new Wall whose two endpoints are the Junctions the
		// host splits just created; the split segments each retain an original end.
		const closedJunctionIds = new Set(layoutIds(closedSource).junctions);
		const newJunctionIds = new Set(layoutIds(dividedSource).junctions.filter((id) => !closedJunctionIds.has(id)));
		const divider = (dividedSource.units.layout.data.walls as {
			id: string;
			startJunctionId: string;
			endJunctionId: string;
		}[]).find(
			(wall) =>
				!closedWallIds.includes(wall.id) &&
				newJunctionIds.has(wall.startJunctionId) &&
				newJunctionIds.has(wall.endJunctionId)
		);
		if (divider === undefined) throw new Error('the division added no divider between two new split Junctions');
		await selectSubject(page, divider.id);
		const deleteAction = page.locator(DELETE);
		await expect(deleteAction).toBeVisible();
		await deleteAction.click();
		await expect(deleteAction).toContainText('Confirm');
		await expect(page.locator('[data-card-actions]')).toContainText(/deletes|Room|Opening/i);
		const beforeDelete = await acceptedResultCount(page);
		await deleteAction.click();
		await waitForAcceptedResult(page, beforeDelete);
		const afterDelete = layoutCounts(await downloadSource(page));
		expect(afterDelete.walls).toBeLessThan(afterDivide.walls);
		expect(afterDelete.rooms).toBe(afterClose.rooms);
		rows.push(row('starter.delete', 'delete a Wall and reconcile its Room', 'passed', `${JSON.stringify(afterDivide)} → ${JSON.stringify(afterDelete)}; disclosure read before the second press`, page, '1440x900', false, await capture(page, 't1-s02-starter-deleted.png')));

		const undoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, undoBefore);
		const afterUndo = layoutCounts(await downloadSource(page));
		expect(afterUndo).toEqual(afterDivide);
		const redoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Redo', exact: true }).click();
		await waitForAcceptedResult(page, redoBefore);
		const afterRedo = layoutCounts(await downloadSource(page));
		expect(afterRedo).toEqual(afterDelete);
		rows.push(row('starter.undo-redo', 'one Undo/Redo per accepted delete', 'passed', `${JSON.stringify(afterUndo)} then ${JSON.stringify(afterRedo)}`, page, '1440x900', false));

		const savedIds = layoutIds(await downloadSource(page));
		await saveToCloud(page);
		const projectId = /\/project\/([^/]+)\/spatial/.exec(new URL(page.url()).pathname)?.[1];
		if (projectId === undefined) throw new Error('the project id is not in the route');
		await page.reload();
		await expect(page.locator(STAGE)).toBeVisible({ timeout: 90_000 });
		await expect(page.locator(DOCK)).toBeVisible();
		await page.waitForTimeout(1_000);
		const reloadedIds = layoutIds(await downloadSource(page));
		expect(reloadedIds).toEqual(savedIds);
		rows.push(row('starter.save-reload', 'Save/reload preserve identities', 'passed', `${savedIds.walls.length} Walls, ${savedIds.junctions.length} Junctions, ${savedIds.rooms.length} Rooms retained`, page, '1440x900', false, await capture(page, 't1-s02-starter-reloaded.png')));

		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(row('starter.test', 'starter journey', 'failed', error instanceof Error ? error.message : String(error), started.page, '1440x900', false));
		throw error;
	} finally {
		for (const entry of rows) await writeEvidence(entry);
		await started.close();
	}
});

test('empty: draw and close an enclosure, read it in 3D, edit Card precision and use the keyboard', async ({ browser, baseURL }) => {
	test.setTimeout(300_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
	const rows: Row[] = [];
	try {
		const { page, errors } = started;
		await startProject(page, 'Begin empty');
		await fitPlan(page);
		const before = layoutCounts(await downloadSource(page));
		expect(before).toEqual({ walls: 0, junctions: 0, rooms: 0, openings: 0 });
		await armInk(page);
		await typePoint(page, 2, -2, 1);
		await typePoint(page, 6, -2, 2);
		await typePoint(page, 6, 2, 3);
		await typePoint(page, 2, 2, 4);
		const closeBefore = await acceptedResultCount(page);
		await page.locator('[data-ink-close]').click();
		await waitForAcceptedResult(page, closeBefore);
		const afterClose = layoutCounts(await downloadSource(page));
		expect(afterClose).toEqual({ walls: 4, junctions: 4, rooms: 1, openings: 0 });
		rows.push(row('empty.close', 'empty project → enclosure', 'passed', `typed points; ${JSON.stringify(before)} → ${JSON.stringify(afterClose)}`, page, '1440x900', true, await capture(page, 't1-s02-empty-closed.png')));

		await setReading(page, '3D');
		expect(layoutCounts(await downloadSource(page))).toEqual(afterClose);
		rows.push(row('empty.plan-3d', 'empty enclosure in 3D', 'passed', 'reading switch preserved the accepted counts', page, '1440x900', true, await capture(page, 't1-s02-empty-3d.png')));
		await setReading(page, 'Plan');

		const source = await downloadSource(page);
		const wallId = (source.units.layout.data.walls as { id: string }[]).at(0)!.id;
		await selectSubject(page, wallId);
		const length = page.locator('label.field', { hasText: 'Length' }).locator('input').first();
		await expect(length).toBeVisible();
		const beforeInvalid = await acceptedResultCount(page);
		await length.fill('not-a-number');
		await length.press('Enter');
		await expect(page.locator(`${CARD_FIELDS} [role="alert"]`)).toContainText(/number|valid/i);
		expect(await acceptedResultCount(page)).toBe(beforeInvalid);
		expect(layoutCounts(await downloadSource(page))).toEqual(afterClose);
		rows.push(row('empty.invalid-length', 'invalid numeric entry', 'passed', 'Card refused the text with an alert and installed nothing', page, '1440x900', true, await capture(page, 't1-s02-empty-invalid-length.png')));

		await length.fill('3.5');
		await length.press('Enter');
		await waitForAcceptedResult(page, beforeInvalid);
		const afterPrecision = await downloadSource(page);
		// An exact length moves the non-fixed endpoint Junction; the Wall record's
		// own fields stay the same. The accepted Layout source is the consequence.
		expect(afterPrecision.units.layout.data).not.toEqual(source.units.layout.data);
		rows.push(row('empty.card-precision', 'Card precision', 'passed', 'a valid exact length installed one accepted change; the invalid text did not', page, '1440x900', true));
		const undoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, undoBefore);
		expect(layoutCounts(await downloadSource(page))).toEqual(afterClose);

		// A two-point chain finished with the host's Enter, then Backspace and
		// Escape against a live three-point chain.
		await armInk(page);
		await typePoint(page, 8, 0, 1);
		await typePoint(page, 8, 3, 2);
		const keyboardBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		await waitForAcceptedResult(page, keyboardBefore);
		const afterKeyboard = layoutCounts(await downloadSource(page));
		expect(afterKeyboard.walls).toBe(afterClose.walls + 1);
		await armInk(page);
		await typePoint(page, 10, 0, 1);
		await typePoint(page, 10, 3, 2);
		await typePoint(page, 12, 3, 3);
		await page.locator(STAGE).focus();
		await page.keyboard.press('Backspace');
		await waitForPoints(page, 2);
		await page.keyboard.press('Escape');
		await waitForPoints(page, 0);
		expect(layoutCounts(await downloadSource(page))).toEqual(afterKeyboard);
		rows.push(row('empty.keyboard', 'keyboard-only finish/backtrack/cancel', 'passed', 'Enter finished a two-point chain; Backspace removed one point; Escape cleared the live chain with no install', page, '1440x900', true));

		// One Undo/Redo for the accepted chain itself, not only for the later delete.
		const keyboardIds = layoutIds(await downloadSource(page));
		const chainUndoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, chainUndoBefore);
		expect(layoutCounts(await downloadSource(page))).toEqual(afterClose);
		const chainRedoBefore = await acceptedResultCount(page);
		await page.locator('[data-editor-history]').getByRole('button', { name: 'Redo', exact: true }).click();
		await waitForAcceptedResult(page, chainRedoBefore);
		expect(layoutIds(await downloadSource(page))).toEqual(keyboardIds);
		rows.push(row('empty.undo-redo-chain', 'one Undo/Redo per accepted chain', 'passed', 'the keyboard chain undid to the enclosure and redid to the same Wall/Junction identities', page, '1440x900', true));

		// Divide the enclosure, read the result in 3D, then delete the divider and
		// reconcile the two Rooms back into one.
		const closeCard = page.getByRole('button', { name: 'Close selection card' });
		if (await closeCard.isVisible().catch(() => false)) await closeCard.click();
		const preDivideIds = layoutIds(await downloadSource(page));
		await armInk(page);
		// Split the left and right host Walls at their midpoints; the bottom edge is
		// under the open palette at this viewport, while both mid-height points are
		// reachable.
		await clickWorldAndWait(page, [2, 0, 0], 1);
		await clickWorldAndWait(page, [6, 0, 0], 2);
		const divideBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		await waitForAcceptedResult(page, divideBefore);
		const dividedSource = await downloadSource(page);
		const afterDivide = layoutCounts(dividedSource);
		expect(afterDivide.walls).toBeGreaterThan(afterClose.walls);
		expect(afterDivide.rooms).toBe(afterClose.rooms + 1);
		rows.push(row('empty.divide', 'divide the empty enclosure', 'passed', `${JSON.stringify(afterClose)} → ${JSON.stringify(afterDivide)}`, page, '1440x900', true, await capture(page, 't1-s02-empty-divided.png')));

		await setReading(page, '3D');
		expect(layoutCounts(await downloadSource(page))).toEqual(afterDivide);
		rows.push(row('empty.plan-3d-divide', 'divided enclosure in 3D', 'passed', 'reading switch preserved the divided counts', page, '1440x900', true));
		await setReading(page, 'Plan');

		const enclosureJunctions = new Set(layoutIds(await downloadSource(page)).junctions);
		const preDivideJunctions = new Set(preDivideIds.junctions);
		const newJunctions = new Set([...enclosureJunctions].filter((id) => !preDivideJunctions.has(id)));
		const divider = (dividedSource.units.layout.data.walls as {
			id: string;
			startJunctionId: string;
			endJunctionId: string;
		}[]).find(
			(wall) => !preDivideIds.walls.includes(wall.id) && newJunctions.has(wall.startJunctionId) && newJunctions.has(wall.endJunctionId)
		);
		if (divider === undefined) throw new Error('the empty division added no divider between two new split Junctions');
		await selectSubject(page, divider.id);
		const deleteAction = page.locator(DELETE);
		await expect(deleteAction).toBeVisible();
		await deleteAction.click();
		await expect(deleteAction).toContainText('Confirm');
		await expect(page.locator('[data-card-actions]')).toContainText(/deletes|Room|Opening/i);
		const deleteBefore = await acceptedResultCount(page);
		await deleteAction.click();
		await waitForAcceptedResult(page, deleteBefore);
		const afterDelete = layoutCounts(await downloadSource(page));
		expect(afterDelete.walls).toBe(afterDivide.walls - 1);
		expect(afterDelete.rooms).toBe(afterClose.rooms);
		rows.push(row('empty.delete', 'delete the empty divider and reconcile Rooms', 'passed', `${JSON.stringify(afterDivide)} → ${JSON.stringify(afterDelete)}; disclosure read before the second press`, page, '1440x900', true, await capture(page, 't1-s02-empty-deleted.png')));

		await setReading(page, '3D');
		expect(layoutCounts(await downloadSource(page))).toEqual(afterDelete);
		rows.push(row('empty.plan-3d-delete', 'reconciled enclosure in 3D', 'passed', 'reading switch preserved the reconciled counts', page, '1440x900', true));
		await setReading(page, 'Plan');
		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(row('empty.test', 'empty journey', 'failed', error instanceof Error ? error.message : String(error), started.page, '1440x900', true));
		throw error;
	} finally {
		for (const entry of rows) await writeEvidence(entry);
		await started.close();
	}
});

test('policy: crossing, collinear overlap, nested ring and invalid input refuse with no partial source', async ({ browser, baseURL }) => {
	test.setTimeout(300_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
	const rows: Row[] = [];
	try {
		const { page, errors } = started;
		await startProject(page, 'Enclosed room');
		await fitPlan(page);
		const baseline = layoutCounts(await downloadSource(page));
		await armInk(page);

		await clickWorldAndWait(page, [8, 0, -2], 1);
		await clickWorldAndWait(page, [6, 0, -2], 2);
		const crossingBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		await expect(page.locator('[data-ink-refusal]')).toContainText(/cross|junction/i);
		expect(await acceptedResultCount(page)).toBe(crossingBefore);
		expect(layoutCounts(await downloadSource(page))).toEqual(baseline);
		expect(await inkPoints(page)).toBe(2);
		rows.push(row('policy.crossing', 'crossing without a Junction', 'passed', `refused: ${(await page.locator('[data-ink-refusal]').textContent())?.trim()}`, page, '1440x900', false, await capture(page, 't1-s02-policy-crossing.png')));
		await page.keyboard.press('Escape');
		await waitForPoints(page, 0);

		await clickWorldAndWait(page, [7, 0, 2], 1);
		await clickWorldAndWait(page, [7, 0, -1], 2);
		const overlapBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		await expect(page.locator('[data-ink-refusal]')).toContainText(/overlap|collinear|coincident/i);
		expect(await acceptedResultCount(page)).toBe(overlapBefore);
		expect(layoutCounts(await downloadSource(page))).toEqual(baseline);
		rows.push(row('policy.overlap', 'collinear overlap', 'passed', `refused: ${(await page.locator('[data-ink-refusal]').textContent())?.trim()}`, page, '1440x900', false));
		await page.keyboard.press('Escape');
		await waitForPoints(page, 0);

		// The nested ring is inside the open palette's footprint on this viewport;
		// typed coordinates exercise the same classification without occlusion.
		await typePoint(page, 2, 0, 1);
		await typePoint(page, 4, 0, 2);
		await typePoint(page, 4, -2, 3);
		await typePoint(page, 2, -2, 4);
		const nestedBefore = await acceptedResultCount(page);
		await page.locator('[data-ink-close]').click();
		await expect(page.locator('[data-ink-refusal]')).toContainText(/nest|shared|ring|junction/i);
		expect(await acceptedResultCount(page)).toBe(nestedBefore);
		expect(layoutCounts(await downloadSource(page))).toEqual(baseline);
		rows.push(row('policy.nested', 'disconnected nested ring', 'passed', `refused: ${(await page.locator('[data-ink-refusal]').textContent())?.trim()}`, page, '1440x900', false));
		await page.keyboard.press('Escape');
		await waitForPoints(page, 0);

		await page.locator('[data-ink-thickness]').fill('not-a-number');
		await page.locator('[data-ink-height]').click();
		await expect(page.locator(`${INK} p.error[role="alert"]`).first()).toContainText(/number|valid/i);
		await page.locator('[data-ink-x]').fill('nope');
		await page.locator('[data-ink-z]').fill('0');
		await page.locator('[data-ink-add-point]').click();
		await expect(page.locator(`${INK} p.error[role="alert"]`).last()).toContainText(/number|valid|coordinate/i);
		expect(layoutCounts(await downloadSource(page))).toEqual(baseline);
		rows.push(row('policy.invalid-options', 'invalid numeric entry in the palette', 'passed', 'thickness and typed coordinate refusals installed nothing', page, '1440x900', false, await capture(page, 't1-s02-policy-invalid.png')));

		await page.keyboard.press('Escape');
		// With no live chain, the palette-first Escape disarms Ink and unmounts the
		// palette; either outcome leaves zero live points and no hidden proposal.
		expect(await inkPoints(page)).toBeLessThanOrEqual(0);
		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(row('policy.test', 'policy refusals', 'failed', error instanceof Error ? error.message : String(error), started.page, '1440x900', false));
		throw error;
	} finally {
		for (const entry of rows) await writeEvidence(entry);
		await started.close();
	}
});

test('shell: narrow reduced-motion layout, Find, contributed-task arbitration and unsaved replacement', async ({ browser, baseURL }) => {
	test.setTimeout(300_000);
	const started = await session(browser, baseURL!, { viewport: { width: 900, height: 700 }, reducedMotion: 'reduce' });
	const rows: Row[] = [];
	try {
		const { page, errors } = started;
		await startProject(page, 'Enclosed room');
		await fitPlan(page);
		expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
		const source = await downloadSource(page);
		const wallId = (source.units.layout.data.walls as { id: string }[]).at(0)!.id;
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
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		rows.push(row('shell.narrow', 'narrow, reduced-motion shell', 'passed', `900×700; Card and lower column do not intersect; no horizontal page overflow`, page, '900x700', true, await capture(page, 't1-s02-shell-narrow.png')));

		await page.locator('[data-head-find] summary').click();
		const find = page.locator('[data-head-find] input[type="search"]');
		await find.fill('Ink');
		const findEntry = page.locator('[data-head-find] button', { hasText: 'Ink' }).first();
		await expect(findEntry).toBeVisible();
		await findEntry.click();
		await expect(page.locator('[data-dock-tool="layout-ink"]')).toHaveAttribute('aria-pressed', 'true');
		rows.push(row('shell.find', 'Head Find reaches the dock tool', 'passed', 'the contributed Ink entry armed the dock tool', page, '900x700', true));
		await page.locator('[data-dock-select]').click();

		// A non-dock contributed task leaves the Card's selection intact and does
		// not re-arm Ink when it closes.
		const task = page.locator('.contributed-item button.item-row', { hasText: 'Place plinth' }).first();
		await task.click();
		await expect(page.locator('[data-stage-instrument]')).toBeVisible();
		await selectSubject(page, wallId);
		await expect(page.locator(CARD)).toBeVisible();
		await page.getByRole('button', { name: 'Close Place plinth' }).click();
		await expect(page.locator('[data-dock-tool="layout-ink"]')).toHaveAttribute('aria-pressed', 'false');
		rows.push(row('shell.task-arbitration', 'contributed task and Card arbitration', 'passed', 'selection survived the invoked task; closing it did not re-arm Ink', page, '900x700', true));

		// The Library's own Scene contribution, not only the Layout dock's task:
		// opening it must not clear the selected subject or leave Ink armed.
		const libraryTask = page.locator('.contributed-item button.item-row', { hasText: 'Objects' }).first();
		await expect(libraryTask).toBeVisible();
		await libraryTask.click();
		await expect(page.locator('[data-stage-instrument]')).toBeVisible();
		await selectSubject(page, wallId);
		await expect(page.locator(CARD)).toBeVisible();
		await page.getByRole('button', { name: 'Close Objects' }).click();
		await expect(page.locator('[data-dock-tool="layout-ink"]')).toHaveAttribute('aria-pressed', 'false');
		rows.push(row('shell.library-task', 'active Library contribution and Card arbitration', 'passed', 'Scene Place object opened while the Wall stayed selected; closing it did not re-arm Ink', page, '900x700', true));

		// The Guide lives in the Experience lens; mounting it must not turn Ink back on.
		await page.locator(LENS).getByRole('button', { name: 'Experience', exact: true }).click();
		await expect(page.getByRole('region', { name: 'Experience lens' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Guide', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await page.locator(LENS).getByRole('button', { name: 'World', exact: true }).click();
		await expect(page.locator('[data-dock-tool="layout-ink"]')).toHaveAttribute('aria-pressed', 'false');
		await selectSubject(page, wallId);
		rows.push(row('shell.guide-lens', 'active Guide lens and Card arbitration', 'passed', 'Experience lens mounted with the Guide open; returning to World left Ink disarmed and the Wall selectable', page, '900x700', true));

		// An unsaved edit opens the replacement guard; cancelling changes nothing.
		await armInk(page);
		await typePoint(page, 8, 0, 1);
		await typePoint(page, 8, 3, 2);
		const replaceBefore = await acceptedResultCount(page);
		await finishWithEnter(page);
		await waitForAcceptedResult(page, replaceBefore);
		// The lower column is now at its palette height, not only the dock's. The
		// measured lift must clear the invoked palette too.
		await selectSubject(page, wallId);
		const cardWithPalette = await page.locator(CARD).boundingBox();
		const lowerWithPalette = await page.locator('[data-lower-column]').boundingBox();
		if (cardWithPalette === null || lowerWithPalette === null) throw new Error('the Card or palette-bearing column has no box');
		const paletteIntersects =
			cardWithPalette.x < lowerWithPalette.x + lowerWithPalette.width &&
			lowerWithPalette.x < cardWithPalette.x + cardWithPalette.width &&
			cardWithPalette.y < lowerWithPalette.y + lowerWithPalette.height &&
			lowerWithPalette.y < cardWithPalette.y + cardWithPalette.height;
		expect(paletteIntersects, `Card ${JSON.stringify(cardWithPalette)} overlaps the palette column ${JSON.stringify(lowerWithPalette)}`).toBe(false);
		rows.push(row('shell.palette-clearance', 'Card clears the invoked palette', 'passed', 'with Ink armed and its palette open, the Card and the full lower column do not intersect', page, '900x700', true));
		const edited = layoutCounts(await downloadSource(page));
		let nativeConfirm = '';
		page.once('dialog', async (dialog) => {
			nativeConfirm = dialog.message();
			await dialog.accept();
		});
		await page.locator('.stage-actions').getByRole('button', { name: 'Open source JSON', exact: true }).click();
		const replace = page.getByRole('alertdialog', { name: 'Replace project' });
		await expect(replace).toBeVisible();
		await replace.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(replace).toBeHidden();
		expect(layoutCounts(await downloadSource(page))).toEqual(edited);
		rows.push(row('shell.unsaved-replacement', 'unsaved project replacement guard', 'passed', `native confirm (${nativeConfirm}) then the in-page Replace prompt; Cancel preserved the edited source`, page, '900x700', true, await capture(page, 't1-s02-shell-replacement.png')));
		expect(errors).toEqual([]);
	} catch (error) {
		rows.push(row('shell.test', 'shell journey', 'failed', error instanceof Error ? error.message : String(error), started.page, '900x700', true));
		throw error;
	} finally {
		for (const entry of rows) await writeEvidence(entry);
		await started.close();
	}
});
