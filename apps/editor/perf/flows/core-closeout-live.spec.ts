/**
 * Live closeout proof for #274, #273 and #275.
 *
 * Runs against the ordinary production preview and the real local API. No
 * test-only route is used: the Card, Head menu, Find, reading controls and Ink
 * palette are the shipped controls a creator uses.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Browser, type Page } from '@playwright/test';

import { loginAs, TEST_AUTH_SESSION_COOKIE } from '../../tests/e2e/test-auth';
import {
	acceptedResultCount,
	addInkPoint,
	downloadSourceJson,
	fitStage,
	openProjectMenu,
	setStageReading,
	uniqueProjectId,
	waitForAcceptedResult,
	waitForCameraSettled
} from '../lib/flow';
import { perfInitScript } from '../lib/ledger';

const apiOrigin = process.env.PERF_API_ORIGIN;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const resultsDir = process.env.PERF_RESULTS_DIR;
if (!apiOrigin || !authSecret || !resultsDir) {
	throw new Error('PERF_API_ORIGIN, E2E_TEST_AUTH_SECRET and PERF_RESULTS_DIR are required');
}

const REVISION = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8' }).trim();
const STAGE = '[role="application"][aria-label="Spatial stage"]';
const CARD = 'aside.card';
const DESTRUCTIVE = '[data-card-action="layout-wall-delete"]';
const evidencePath = resolve(resultsDir, 'core-closeout-live.json');
const runId = randomUUID();
const runChecks: Record<string, unknown> = {};

type LiveEvidence = {
	readonly revision: string;
	readonly checks: Record<string, unknown>;
};

async function writeEvidence(evidence: LiveEvidence): Promise<void> {
	await mkdir(resultsDir!, { recursive: true });
	Object.assign(runChecks, evidence.checks);
	await writeFile(
		evidencePath,
		JSON.stringify(
			{
				revision: evidence.revision,
				runId,
				checks: runChecks
			},
			null,
			2
		)
	);
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
		coarse?: boolean;
		reducedMotion?: 'no-preference' | 'reduce';
	}
): Promise<Session> {
	const context = await browser.newContext({
		viewport: options.viewport,
		deviceScaleFactor: 1,
		hasTouch: options.coarse === true,
		isMobile: false,
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
	const projectId = uniqueProjectId('closeout');
	await page.goto(`/project/${encodeURIComponent(projectId)}/spatial?create=1`);
	// The current route opens the minted empty project directly. Keep the
	// starter chooser branch for builds that still present it, but never fail
	// merely because the shipped route has moved past that dialog.
	const chooser = page.getByRole('dialog', { name: 'Start a project' });
	if (await chooser.isVisible({ timeout: 3_000 }).catch(() => false)) {
		await page.getByRole('button', { name: starter, exact: true }).click();
	}
	await expect(page.locator(STAGE)).toBeVisible({ timeout: 60_000 });
	await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
	await page.waitForTimeout(600);
	return projectId;
}

async function sourceFromDownload(page: Page): Promise<Record<string, any>> {
	const download = await downloadSourceJson(page);
	const path = await download.path();
	if (path === null) throw new Error('the source download produced no local path');
	return JSON.parse(await readFile(path, 'utf8')) as Record<string, any>;
}

async function closeProjectMenu(page: Page): Promise<void> {
	const trigger = page.locator('[data-head-project]');
	if ((await trigger.getAttribute('aria-expanded')) === 'true') await trigger.click();
}

async function armInk(page: Page): Promise<void> {
	const close = page.getByRole('button', { name: 'Close selection card' });
	if (await close.isVisible().catch(() => false)) await close.click();
	const key = page.locator('[data-dock-tool="layout-ink"]');
	if ((await key.getAttribute('aria-pressed')) !== 'true') await key.click();
	await expect(page.locator('[data-layout-ink-palette]')).toBeVisible();
	await expect(key).toHaveAttribute('aria-pressed', 'true');
	// A live Ink task owns the Stage: the Sheet's lane may not swallow a press.
	await expect(page.locator('[data-stage-height-sheet]')).toHaveCSS('pointer-events', 'none');
	const wallReading = page.locator('[data-ink-reading-wall]');
	if ((await wallReading.count()) > 0 && !(await wallReading.isChecked())) await wallReading.check();
}

async function selectSubject(page: Page, sourceId: string): Promise<void> {
	const close = page.getByRole('button', { name: 'Close selection card' });
	if (await close.isVisible().catch(() => false)) await close.click();
	await page.locator('#plate-index-search').fill(sourceId);
	const rows = page.locator('button.item-row');
	await expect(rows).toHaveCount(1);
	const row = rows.first();
	await expect(row).toBeVisible();
	await row.click();
	await expect(page.locator(CARD)).toBeVisible();
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
		if (camera === undefined) throw new Error('the Stage camera is not published');
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

async function installPointerTrace(page: Page): Promise<void> {
	await page.evaluate(() => {
		type EventRow = Record<string, unknown>;
		const target = window as Window & { __BOX_TRACE__?: EventRow[] };
		target.__BOX_TRACE__ = [];
		for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
			document.addEventListener(
				type,
				(event) => {
					const pointer = event as PointerEvent;
					target.__BOX_TRACE__!.push({
						type,
						at: performance.now(),
						pointerId: pointer.pointerId,
						pointerType: pointer.pointerType,
						isPrimary: pointer.isPrimary,
						buttons: pointer.buttons,
						clientX: pointer.clientX,
						clientY: pointer.clientY,
						target:
							pointer.target instanceof Element
								? `${pointer.target.tagName.toLowerCase()}.${String(pointer.target.className)}`
								: null
					});
				},
				true
			);
		}
	});
}

async function readPointerTrace(page: Page): Promise<unknown[]> {
	return page.evaluate(() => {
		const target = window as Window & {
			__BOX_TRACE__?: unknown[];
			__BISKIQ_PERF_RECORDS__?: unknown[];
		};
		return [
			...(target.__BOX_TRACE__ ?? []),
			{
				kind: 'ledger-tail',
				records: (target.__BISKIQ_PERF_RECORDS__ ?? []).slice(-80)
			}
		];
	});
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
	await rm(evidencePath, { force: true });
});

test('Card Cancel restores the destructive action and the current Head/Ink locators resolve', async ({
	browser,
	baseURL
}) => {
	test.setTimeout(300_000);
	const started = await session(browser, baseURL!, { viewport: { width: 1440, height: 900 } });
	const page = started.page;
	try {
		await startProject(page, 'Begin empty');

		await openProjectMenu(page);
		await expect(page.getByRole('group', { name: 'Project actions' })).toBeVisible();
		await expect(page.locator('[data-head-source]')).toBeVisible();
		const baseline = await sourceFromDownload(page);
		await closeProjectMenu(page);
		expect(baseline.units?.layout?.data?.walls).toEqual([]);

		await fitStage(page);
		const settled = await page.evaluate(() =>
			(window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { camera?: unknown }> })
				.__BISKIQ_PERF_RENDER_REFS__?.stage?.camera !== undefined
		);
		expect(settled).toBe(true);

		await setStageReading(page, '3D');
		await expect(page.locator('[data-drafting-reading="3d"]')).toHaveAttribute('aria-pressed', 'true');
		await setStageReading(page, 'Plan');
		await expect(page.locator('[data-drafting-reading="plan"]')).toHaveAttribute('aria-pressed', 'true');

		await armInk(page);
		await addInkPoint(page, 2, -2);
		await expect(page.locator('[data-ink-x]')).toBeVisible();
		await addInkPoint(page, 4, -2);
		await page.getByRole('button', { name: 'Ink settings and Opening' }).click();
		const finish = page.locator('[data-ink-finish]');
		await expect(finish).toBeEnabled({ timeout: 10_000 });
		const finishEnabled = await finish.isEnabled();
		const beforeFinish = await acceptedResultCount(page);
		await finish.click();
		await waitForAcceptedResult(page, beforeFinish);

		const withWall = await sourceFromDownload(page);
		await closeProjectMenu(page);
		const wallId = (withWall.units.layout.data.walls as { id: string }[])[0]?.id;
		if (wallId === undefined) throw new Error('the finish produced no Wall');
		await selectSubject(page, wallId);

		const actionsTrigger = page.getByRole('button', { name: 'Subject actions' });
		await expect(actionsTrigger).toBeVisible();
		await actionsTrigger.click();
		const destructive = page.locator(DESTRUCTIVE);
		await expect(destructive).toBeVisible();
		await destructive.focus();
		const beforeCancel = await acceptedResultCount(page);
		await page.keyboard.press('Enter');
		await expect(destructive).toHaveText(/Confirm erase/);
		await page.keyboard.press('Tab');
		const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
		await expect(cancel).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(destructive).toBeFocused();
		await expect(destructive).toHaveText('Erase');
		expect(await acceptedResultCount(page)).toBe(beforeCancel);
		await page.screenshot({ path: resolve(resultsDir!, 'core-closeout-card-cancel.png'), animations: 'disabled' });

		await writeEvidence({
			revision: REVISION,
			checks: {
				cardCancelKeyboard: {
					status: 'passed',
					viewport: '1440x900',
					beforeCancelAccepted: beforeCancel,
					afterCancelAccepted: await acceptedResultCount(page),
					focused: await destructive.evaluate((element) => element === document.activeElement),
					label: (await destructive.getAttribute('aria-label')) ?? null,
					text: (await destructive.innerText()).trim()
				},
				locators: {
					status: 'passed',
					projectMenu: true,
					sourceOpenControl: true,
					findFit: true,
					stageReading: true,
					inkPoint: true,
					pointEntries: 2,
					finishEnabled
				}
			}
		});
		expect(started.errors).toEqual([]);
	} finally {
		await started.close();
	}
});

test('Box second-corner release across fine and coarse viewports records a pointer trace', async ({
	browser,
	baseURL
}) => {
	test.setTimeout(480_000);
	const cases = [
		{ id: '1440x900-fine', viewport: { width: 1440, height: 900 }, coarse: false },
		{ id: '1180x820-coarse', viewport: { width: 1180, height: 820 }, coarse: true },
		{ id: '820x1180-coarse', viewport: { width: 820, height: 1180 }, coarse: true }
	] as const;
	const results: Record<string, unknown> = {};

	for (const entry of cases) {
		const started = await session(browser, baseURL!, {
			viewport: entry.viewport,
			coarse: entry.coarse,
			reducedMotion: 'reduce'
		});
		const page = started.page;
		try {
			await startProject(page, 'Begin empty');
			await fitStage(page);
			await setStageReading(page, 'Plan');
			await armInk(page);
			const boxMode = page.locator('[data-ink-wall-mode="box"]');
			await expect(boxMode).toBeVisible();
			await boxMode.click();
			await expect(boxMode).toHaveAttribute('aria-checked', 'true');
			await expect
				.poll(() => page.evaluate(() => matchMedia('(pointer: coarse)').matches))
				.toBe(entry.coarse);

			const from = await cssPoint(page, [2, 0, 2]);
			const to = await cssPoint(page, [4, 0, 4]);
			await installPointerTrace(page);
			const before = await acceptedResultCount(page);
			const paletteBefore = (await page.locator('[data-layout-ink-palette]').innerText()).trim();

			await page.mouse.move(from.x, from.y, { steps: 4 });
			await page.waitForTimeout(100);
			await page.mouse.down();
			await page.waitForTimeout(80);
			await page.mouse.up();
			await page.waitForTimeout(400);
			const afterFirst = await acceptedResultCount(page);
			const paletteAfterFirst = (await page.locator('[data-layout-ink-palette]').innerText()).trim();

			await page.mouse.move(to.x, to.y, { steps: 4 });
			await page.waitForTimeout(100);
			await page.mouse.down();
			await page.waitForTimeout(80);
			await page.mouse.up();
			await page.waitForTimeout(1_000);
			const afterSecond = await acceptedResultCount(page);
			const trace = await readPointerTrace(page);
			const refusal = await page.locator('[data-ink-refusal]').allInnerTexts();
			const result = {
				status: afterSecond > before ? 'committed' : 'did-not-commit',
				viewport: `${entry.viewport.width}x${entry.viewport.height}`,
				coarse: entry.coarse,
				coarseMedia: await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
				from,
				to,
				before,
				afterFirst,
				afterSecond,
				paletteBefore,
				paletteAfterFirst,
				paletteAfterSecond: (await page.locator('[data-layout-ink-palette]').innerText()).trim(),
				refusal,
				trace
			};
			results[entry.id] = result;
			await writeEvidence({ revision: REVISION, checks: { boxTrace: results } });
			await page.screenshot({
				path: resolve(resultsDir!, `core-closeout-box-${entry.id}.png`),
				animations: 'disabled'
			});

			expect(afterSecond, `Box did not commit at ${entry.id}`).toBeGreaterThan(before);

			const source = await sourceFromDownload(page);
			await closeProjectMenu(page);
			results[`${entry.id}-source`] = {
				walls: source.units.layout.data.walls.length,
				junctions: source.units.layout.data.junctions.length,
				rooms: source.units.layout.data.rooms.length
			};
			await writeEvidence({ revision: REVISION, checks: { boxTrace: results } });
			await waitForCameraSettled(page);
			expect(started.errors).toEqual([]);
		} finally {
			await started.close();
		}
	}
});

test('Height Sheet stays visual and pointer-operable while Ink owns the Stage', async ({
	browser,
	baseURL
}) => {
	test.setTimeout(300_000);
	const started = await session(browser, baseURL!, {
		viewport: { width: 820, height: 1180 },
		coarse: true,
		reducedMotion: 'reduce'
	});
	const page = started.page;
	try {
		await startProject(page, 'Begin empty');
		await fitStage(page);
		await setStageReading(page, 'Plan');
		await armInk(page);

		const sheet = page.locator('[data-stage-height-sheet]');
		const track = page.locator('[data-stage-height-sheet] [role="slider"]');
		const knob = page.locator('[data-stage-height-sheet] .knob');
		const rail = page.locator('[data-stage-height-sheet] .rail');
		const datum = page.locator('[data-stage-height-sheet] .tick.datum').first();
		const stage = page.locator('[role="application"][aria-label="Spatial stage"]');
		await expect(sheet).toHaveCSS('pointer-events', 'none');
		await expect(track).toHaveCSS('pointer-events', 'none');
		await expect(knob).toHaveCSS('pointer-events', 'auto');
		await expect(knob).toHaveCSS('box-sizing', 'border-box');
		await expect(rail).toHaveCSS('width', '2px');
		await expect(datum).toHaveCSS('width', '22px');
		await expect(datum).toHaveCSS('height', '2.5px');

		// The Sheet keeps the production wireframe's white marks on the dark Stage.
		await setStageReading(page, '3D');
		await expect(stage).toHaveAttribute('data-paper', 'false');
		await expect(rail).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.28)');
		await expect(datum).toHaveCSS('background-color', 'rgb(255, 255, 255)');
		await expect(page.locator('[data-stage-height-sheet] .numeric')).toHaveCount(0);
		await expect(page.locator('[data-stage-height-sheet] .pin-context')).toHaveCount(0);
		await expect(page.locator('[data-pin-hint]')).toHaveCount(0);
		const addPin = page.locator('[data-stage-height-sheet] button[aria-label^="Pin the height"]');
		await expect(addPin).toHaveCount(1);
		await expect(page.locator('[data-stage-height-sheet] .pin-dot')).toHaveCount(0);
		const removeControls = page.locator('[data-stage-height-sheet] button', { hasText: 'Remove pin' });
		await expect(removeControls).toHaveCount(0);

		const sliderValue = async (): Promise<number> => Number(await track.getAttribute('aria-valuenow'));
		const beforeHeight = await sliderValue();
		await addPin.click();
		await expect(page.locator('[data-stage-height-sheet] .pin-dot')).toHaveCount(1);
		await expect(page.locator('[data-stage-height-sheet] .pin-dot').first()).toHaveCSS(
			'background-color',
			'rgb(255, 255, 255)'
		);
		const knobBox = await knob.boundingBox();
		if (knobBox === null) throw new Error('the Height Sheet knob has no box');
		expect(knobBox.width).toBe(40);
		await installPointerTrace(page);
		await page.mouse.move(knobBox.x + knobBox.width / 2, knobBox.y + knobBox.height / 2);
		await page.mouse.down();
		await page.mouse.move(knobBox.x + knobBox.width / 2, knobBox.y + 120, { steps: 4 });
		await page.mouse.up();
		await expect.poll(sliderValue).not.toBe(beforeHeight);
		const afterHeight = await sliderValue();
		const rawTrace = await page.evaluate(() => {
			type EventRow = { type: string; target: string | null };
			return ((window as Window & { __BOX_TRACE__?: EventRow[] }).__BOX_TRACE__ ?? []).filter(
				(row) => row.type === 'pointerdown' && row.target?.includes('knob')
			);
		});
		expect(rawTrace.length, 'the knob did not receive the drag pointerdown').toBeGreaterThan(0);
		const pin = page.locator('[data-stage-height-sheet] .pin');
		await expect(pin).toHaveCount(1);
		await pin.click();
		await expect.poll(sliderValue).toBe(beforeHeight);
		await expect(page.locator('[data-stage-height-sheet] .pin-context')).toHaveCount(0);
		const jumpHeight = await sliderValue();

		await writeEvidence({
			revision: REVISION,
			checks: {
				heightSheetControls: {
					status: 'passed',
					viewport: '820x1180-coarse',
					trackPointerEvents: 'none',
					knobPointerEvents: 'auto',
					knobWidth: knobBox.width,
					knobBoxSizing: 'border-box',
					railWidth: '2px',
					railBackground: 'rgba(255,255,255,0.28)',
					datumWidth: '22px',
					datumHeight: '2.5px',
					datumBackground: 'rgb(255,255,255)',
					addPinButton: true,
					pinCreated: true,
					removeControls: 0,
					heightBefore: beforeHeight,
					heightAfterDrag: afterHeight,
					heightAfterPinJump: jumpHeight,
					knobPointerDownTarget: rawTrace[0]?.target ?? null
				}
			}
		});
		expect(started.errors).toEqual([]);
	} finally {
		await started.close();
	}
});
