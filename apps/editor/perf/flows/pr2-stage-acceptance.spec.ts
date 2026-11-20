/**
 * PR 2 review acceptance — the editor's own Stage and detached Preview.
 *
 * The published route was already measured. This journey runs the shipped route
 * against a seeded authenticated API/database and drives what the creator uses:
 * Plan/3D, a Wall drag, a Finish change, Slice, Near-wall Cutaway, a placed Point
 * light with a real shadow, an Experience Camera capture, a Visitor Preview visit
 * with exit/re-entry, and a forced renderer recovery. It runs twice in one spec,
 * once on native WebGPU and once with `navigator.gpu` hidden so Three takes its
 * automatic WebGL2 fallback.
 *
 * The shadow assertions read the product's own submission counter through the
 * perf-gated `__BISKIQ_SHADOW_STATS__` hook. That is the point of this journey:
 * the counter is exercised by real r187 ShadowNode calls, including a point
 * light's six faces, not by a fake renderer.
 *
 * On-demand evidence, not a lane. Run through
 * `perf/run-pr2-stage-acceptance.mjs`; it owns the private database, API and
 * preview server, and the test-auth cookie.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type Browser, type Page } from '@playwright/test';

import { loginAs, TEST_AUTH_SESSION_COOKIE } from '../../tests/e2e/test-auth';
import { newMeasuredSession } from '../lib/browser';
import { VIEWPORT } from '../lib/config';
import {
	acceptedResultCount,
	addInkPoint,
	closeInkRing,
	dragWallHandle,
	fitStage,
	gotoCreateIntent,
	selectFirstWall,
	setStageReading,
	uniqueProjectId,
	waitForMark
} from '../lib/flow';

type Backend = 'webgpu' | 'webgl2';

type ColdRenderer = {
	surface: string;
	renderer: {
		domElement: HTMLCanvasElement;
		backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean };
		info: { calls: number; render: { calls: number; triangles: number } };
		onDeviceLost?: (info: unknown) => void;
	};
};

type ShadowStats = { passes: number; maps: number; invalidations: number };

declare global {
	interface Window {
		__BISKIQ_COLD_RENDERERS__?: ColdRenderer[];
		__BISKIQ_PERF_ON_RENDERER__?: (renderer: ColdRenderer['renderer'], surface: string) => void;
		__BISKIQ_PERF_RENDER_REFS__?: Record<string, {
			renderer: ColdRenderer['renderer'];
			scene: unknown;
			camera: { matrixWorld: { elements: number[] }; projectionMatrix: { elements: number[] } };
		}>;
		__BISKIQ_SHADOW_STATS__?: () => ShadowStats;
		__BISKIQ_PERF_RECORDS__?: { kind: string; name: string; time: number; detail?: Record<string, unknown> }[];
	}
}

const apiOrigin = process.env.PERF_API_ORIGIN;
const authSecret = process.env.E2E_TEST_AUTH_SECRET;
const resultsDir = process.env.PERF_RESULTS_DIR;
const baseURL = process.env.PERF_BASE_URL;
if (!apiOrigin || !authSecret || !resultsDir || !baseURL) {
	throw new Error('PERF_API_ORIGIN, E2E_TEST_AUTH_SECRET, PERF_RESULTS_DIR and PERF_BASE_URL are required');
}

const STAGE = '[role="application"][aria-label="Spatial stage"]';
/**
 * Every console error is recorded. The recovery boundary is itself written to
 * the console stream, so messages are attributed by their position in that
 * stream: anything before the boundary is a journey error, anything after it is
 * a recovery error. Muting the collector cannot be used here, because that would
 * hide exactly the errors the forced loss is supposed to explain.
 */
const RECOVERY_BOUNDARY = 'pr2-stage:recovery-boundary';
/**
 * A recovery message is accepted only when it carries this run's forced-loss
 * reason, names a device the loss invalidated, or is Three's own WebGL2
 * context-loss report (the browser event has no custom reason). A bare
 * `Uncaptured WebGPU GPUValidationError` is not device-loss noise: the same
 * prefix describes shader, pipeline and binding defects that must fail the run.
 */
const DEVICE_LOSS_NOISE = /pr2-stage-forced-loss|\[Invalid Device\]|WebGL Device Lost/i;
const STAGE_HOST = '[data-canvas-host="stage"]';
const READY = `${STAGE_HOST}[data-phase="ready"]`;
const VISITOR_CANVAS = '[data-visitor-canvas-root] canvas';

type Row = {
	readonly step: string;
	readonly status: 'passed' | 'failed';
	readonly detail: string;
	readonly screenshot?: string;
};

type CapturedError = {
	readonly phase: 'journey' | 'recovery';
	readonly text: string;
	readonly at: number;
};

function cookieForBrowser(pair: string): { name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean } {
	const equals = pair.indexOf('=');
	if (equals < 1) throw new Error('test-auth did not return a cookie pair');
	const name = pair.slice(0, equals);
	if (name !== TEST_AUTH_SESSION_COOKIE) throw new Error(`unexpected session cookie ${name}`);
	return {
		name,
		value: pair.slice(equals + 1),
		domain: new URL(baseURL!).hostname,
		path: '/',
		httpOnly: true,
		secure: false
	};
}

async function openSession(browser: Browser, backend: Backend, errors: CapturedError[]) {
	let phase: CapturedError['phase'] = 'journey';
	const started = await newMeasuredSession(browser, {
		viewport: VIEWPORT,
		deviceScaleFactor: 1,
		network: 'N0',
		cacheState: 'cold'
	});
	const { page, context } = started;
	await context.addInitScript(({ hideWebGpu }) => {
		if (hideWebGpu) {
			// The automatic-selection path: this is a browser without WebGPU, not a
			// product toggle. Three must take its WebGL2 backend on its own.
			try {
				Object.defineProperty(Navigator.prototype, 'gpu', { value: undefined, configurable: true });
			} catch {
				/* a browser without the property needs nothing */
			}
		}
		window.__BISKIQ_COLD_RENDERERS__ = [];
		window.__BISKIQ_PERF_ON_RENDERER__ = (renderer, surface) => {
			window.__BISKIQ_COLD_RENDERERS__!.push({ surface, renderer });
			renderer.domElement.dataset.pr2Canvas = String(window.__BISKIQ_COLD_RENDERERS__!.length);
			// The harness ledger's hook is written for the old WebGL renderer: it
			// assumes `shadowMap`, `renderBufferDirect` and a GL context, none of
			// which the common WebGPU renderer has before its first frame. Preserve
			// only what the flow helpers need (Stage camera/triangle settle) and
			// leave the ledger's WebGL-only counters out of this acceptance.
			if (surface !== 'stage') return;
			const refs = (window.__BISKIQ_PERF_RENDER_REFS__ ??= {});
			const capture = renderer.render.bind(renderer);
			renderer.render = (scene, camera) => {
				refs.stage = { renderer, scene, camera };
				return capture(scene, camera);
			};
		};
	}, { hideWebGpu: backend === 'webgl2' });
	const auth = await loginAs({ user: 'agent-admin', apiOrigin: apiOrigin!, secret: authSecret!, origin: baseURL! });
	await context.addCookies([cookieForBrowser(auth.cookie)]);
	page.on('pageerror', (error) => {
		errors.push({ phase, text: `pageerror: ${error.stack ?? error.message}`, at: Date.now() });
	});
	page.on('console', (message) => {
		if (message.type() !== 'error') return;
		const text = message.text();
		// The boundary is emitted in the page's console stream, so every earlier
		// message has already been delivered under `journey`; only later ones can
		// describe the loss that has not happened yet at this point.
		if (text === RECOVERY_BOUNDARY) {
			phase = 'recovery';
			return;
		}
		errors.push({ phase, text: `console: ${text}`, at: Date.now() });
	});
	return {
		...started,
		beginRecovery: async () => {
			await page.evaluate((boundary) => console.error(boundary), RECOVERY_BOUNDARY);
		}
	};
}

async function stageState(page: Page) {
	return page.evaluate(() => {
		const entries = (window.__BISKIQ_COLD_RENDERERS__ ?? []).filter((entry) => entry.surface === 'stage');
		const entry = entries.at(-1);
		if (entry === undefined) return null;
		const canvas = entry.renderer.domElement;
		const backend = entry.renderer.backend?.isWebGPUBackend === true
			? 'webgpu'
			: entry.renderer.backend?.isWebGLBackend === true
				? 'webgl2'
				: 'unknown';
		return {
			generations: entries.length,
			canvasId: canvas.dataset.pr2Canvas ?? null,
			before: canvas.dataset.pr2Before === '1',
			connected: canvas.isConnected,
			backend,
			calls: entry.renderer.info.calls,
			drawCalls: entry.renderer.info.render.calls
		};
	});
}

async function shadowStats(page: Page): Promise<ShadowStats | null> {
	return page.evaluate(() => window.__BISKIQ_SHADOW_STATS__?.() ?? null);
}

async function shadowDiagnostics(page: Page): Promise<unknown> {
	return page.evaluate(() => {
		const entry = (window.__BISKIQ_COLD_RENDERERS__ ?? []).filter((candidate) => candidate.surface === 'stage').at(-1);
		const refs = window.__BISKIQ_PERF_RENDER_REFS__;
		const scene = refs?.stage?.scene as { traverse?: (callback: (object: unknown) => void) => void } | undefined;
		const lights: unknown[] = [];
		scene?.traverse?.((object) => {
			const light = object as { isLight?: boolean; type?: string; castShadow?: boolean; shadow?: { autoUpdate?: boolean; needsUpdate?: boolean; camera?: unknown } };
			if (light.isLight === true) {
				lights.push({
					type: light.type,
					castShadow: light.castShadow,
					autoUpdate: light.shadow?.autoUpdate,
					needsUpdate: light.shadow?.needsUpdate,
					hasCamera: light.shadow?.camera !== undefined
				});
			}
		});
		const shadowMap = entry?.renderer.shadowMap as { enabled?: boolean; type?: number } | undefined;
		return {
			shadowEnabled: shadowMap?.enabled ?? null,
			shadowType: shadowMap?.type ?? null,
			sameRenderer: entry?.renderer === refs?.stage?.renderer,
			scene: scene !== undefined,
			lights
		};
	});
}

async function screenshot(page: Page, backend: Backend, name: string, rows: Row[]): Promise<string> {
	const path = join(resultsDir!, `pr2-stage-${backend}-${name}.png`);
	const selector = name.startsWith('preview') ? VISITOR_CANVAS : STAGE_HOST;
	const bytes = await page.locator(selector).screenshot({ path });
	const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
	rows.push({ step: name, status: 'passed', detail: `canvas sha256:${hash}`, screenshot: path });
	return hash;
}

async function ensureIndexOpen(page: Page): Promise<void> {
	if (await page.locator('#plate-index-search').isVisible().catch(() => false)) return;
	await page.locator('[data-head-index]').click();
	await expect(page.locator('#plate-index-search')).toBeVisible();
}

async function selectToolKey(page: Page) {
	return page.locator('nav[aria-label="World tool families"] button').filter({ hasText: 'Select' }).first();
}

async function enterSelectTool(page: Page): Promise<void> {
	const select = await selectToolKey(page);
	if (await select.isVisible().catch(() => false)) await select.click();
}

async function waitForAccepted(page: Page, previous: number, timeoutMs = 60_000): Promise<void> {
	await page.waitForFunction(
		(count) =>
			((window.__BISKIQ_PERF_RECORDS__ ?? []).filter(
				(record) => record.kind === 'result' && record.name === 'accepted-result'
			).length > count),
		previous,
		{ timeout: timeoutMs, polling: 50 }
	);
}

async function openLibrary(page: Page, category: 'Finishes' | 'Lights'): Promise<void> {
	const dock = page.locator('nav[aria-label="World tool families"]');
	await dock.getByRole('button', { name: /^Library/ }).click();
	const plate = page.locator('[data-world-toolbar]');
	await plate.getByRole('button', { name: category, exact: true }).click();
}

async function saveProject(page: Page): Promise<void> {
	const save = page.locator('[data-head-save]');
	if ((await save.getAttribute('data-save-status')) === 'saved' && (await save.getAttribute('data-unsaved')) === null) return;
	const button = page.locator('[data-head-save-button]');
	if (await button.isEnabled().catch(() => false)) await button.click();
	await expect(save).toHaveAttribute('data-save-status', 'saved', { timeout: 30_000 });
	await expect(save).not.toHaveAttribute('data-unsaved', '', { timeout: 30_000 });
}

async function forceStageRecovery(page: Page, backend: Backend): Promise<{ before: Awaited<ReturnType<typeof stageState>>; after: Awaited<ReturnType<typeof stageState>>; unavailable: boolean }> {
	const before = await stageState(page);
	if (before === null) throw new Error('the Stage renderer was never registered with the harness hook');
	await page.evaluate((webgl2) => {
		const entries = (window.__BISKIQ_COLD_RENDERERS__ ?? []).filter((entry) => entry.surface === 'stage');
		const entry = entries.at(-1);
		if (entry === undefined) throw new Error('no stage renderer to lose');
		entry.renderer.domElement.dataset.pr2Before = '1';
		if (webgl2) {
			// The browser's own loss event; cancelable so the host replaces the canvas
			// instead of letting the browser restore this context.
			entry.renderer.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
			return;
		}
		entry.renderer.onDeviceLost?.({ message: 'pr2-stage-forced-loss' });
	}, backend === 'webgl2');

	let unavailable = false;
	if (backend === 'webgl2') {
		// The approved episode keeps a WebGL2 surface for the episode: one loss
		// presents Retry instead of looping.
		await expect(page.locator('[data-renderer-unavailable]')).toBeVisible({ timeout: 25_000 });
		unavailable = true;
		await page.getByRole('button', { name: 'Retry', exact: true }).click();
	}
	await expect.poll(async () => (await stageState(page))?.generations ?? 0, { timeout: 30_000 })
		.toBeGreaterThan(before.generations);
	await expect(page.locator(READY)).toBeVisible({ timeout: 30_000 });
	await expect.poll(async () => (await stageState(page))?.calls ?? 0, { timeout: 30_000 }).toBeGreaterThan(1);
	const after = await stageState(page);
	if (after === null) throw new Error('the recovered Stage renderer is not registered');
	return { before, after, unavailable };
}

async function drawEnclosure(page: Page): Promise<void> {
	// The current create intent opens an empty project; make the room through the
	// shipped Ink palette, exactly as a creator would.
	await setStageReading(page, 'Plan');
	await page.locator('nav[aria-label="World tool families"] button.family').filter({ hasText: 'Build' }).click();
	// The compact Ink plate is the default; "More" opens the exact settings that
	// carry the typed-point form used below.
	await page.getByRole('button', { name: 'More', exact: true }).click();
	const palette = page.locator('[data-layout-ink-palette]');
	await expect(palette).toBeVisible({ timeout: 20_000 });
	// The exact settings disclose the pen readings; the typed-point form is one
	// step further in, which `addInkPoint` opens.
	await palette.getByRole('button', { name: 'Ink settings' }).click();
	const points = [
		[2, -2],
		[6, -2],
		[6, 2],
		[2, 2]
	] as const;
	for (const [x, z] of points) await addInkPoint(page, x, z);
	const before = await acceptedResultCount(page);
	await closeInkRing(page);
	await waitForAccepted(page, before);
	// Close ring finishes the Room but leaves Ink armed. Cancel the stroke through
	// the palette's own control so the Wall selection can own the pointer and
	// show its manipulation handles. Escape alone does not reach the Stage while
	// focus is on the close control.
	if (!(await palette.locator('[data-ink-cancel]').isVisible().catch(() => false))) {
		await palette.getByRole('button', { name: 'Ink settings' }).click();
	}
	await palette.locator('[data-ink-cancel]').click();
	await enterSelectTool(page);
	await expect(await selectToolKey(page)).toHaveAttribute('aria-pressed', 'true');
	await fitStage(page);
}

async function runJourney(
	page: Page,
	backend: Backend,
	rows: Row[],
	session: { beginRecovery(): Promise<void> }
): Promise<void> {
	const projectId = uniqueProjectId(`pr2-stage-${backend}`);
	await gotoCreateIntent(page, projectId);
	if (backend === 'webgl2') {
		const hidden = await page.evaluate(() => {
			const proto = Object.getOwnPropertyDescriptor(Navigator.prototype, 'gpu');
			const own = Object.getOwnPropertyDescriptor(navigator, 'gpu');
			return { value: String(navigator.gpu), proto: proto?.value === undefined, own: own?.value === undefined };
		});
		console.log('[pr2-stage] WebGL2 fallback environment', JSON.stringify(hidden));
	}
	await expect(page.locator(STAGE)).toBeVisible({ timeout: 60_000 });
	await expect(page.locator(READY)).toBeVisible({ timeout: 60_000 });
	await expect(page.locator(`${READY}[data-backend="${backend}"]`)).toBeVisible({ timeout: 60_000 });
	await drawEnclosure(page);
	// Three's common renderer does not populate the old WebGL `info.render`
	// triangle count, so the ledger's settle predicate is meaningless here. The
	// camera has settled inside Fit; give the first post-edit frame one beat.
	await page.waitForTimeout(1_000);
	const initial = await stageState(page);
	expect(initial?.backend).toBe(backend);
	rows.push({ step: 'stage-ready', status: 'passed', detail: `backend ${initial?.backend}; generations ${initial?.generations}` });

	// Plan and 3D on the one persistent Canvas.
	await setStageReading(page, 'Plan');
	await screenshot(page, backend, 'plan', rows);
	await setStageReading(page, '3D');
	await screenshot(page, backend, '3d', rows);

	// Select the first Wall and drag its end: a real accepted Layout edit.
	await enterSelectTool(page);
	await ensureIndexOpen(page);
	await selectFirstWall(page);
	const beforeDrag = await acceptedResultCount(page);
	await dragWallHandle(page, { samples: 4, distance: 20 });
	await waitForAccepted(page, beforeDrag);
	await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
	await screenshot(page, backend, 'wall-drag', rows);
	rows.push({ step: 'wall-drag', status: 'passed', detail: 'Wall end moved; one accepted result installed' });

	// A Finish on the selected Wall.
	await openLibrary(page, 'Finishes');
	const beforeFinish = await acceptedResultCount(page);
	const finish = page.locator('[data-finish-tile^="curated:"]').first();
	await expect(finish).toBeVisible();
	await finish.click();
	await page.waitForTimeout(400);
	if ((await acceptedResultCount(page)) === beforeFinish) {
		// A Library pick with no scene selection arms Paint rather than assigning;
		// commit the armed Finish on the selected Wall surface.
		const box = await page.locator(STAGE_HOST).boundingBox();
		if (box === null) throw new Error('the Stage has no box to paint');
		await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
	}
	await waitForAccepted(page, beforeFinish);
	await screenshot(page, backend, 'finish', rows);
	rows.push({ step: 'finish', status: 'passed', detail: 'curated Finish accepted on the selected Wall' });

	// The Slice reading: Level on, then Put back. A reading writes no source.
	await page.locator('nav[aria-label="World tool families"] button.family').filter({ hasText: 'Build' }).click();
	await page.getByRole('button', { name: 'Slice', exact: true }).click();
	await expect(page.locator('[data-slice-plate]')).toBeVisible();
	const beforeSlice = await acceptedResultCount(page);
	await page.getByRole('button', { name: 'Level cut' }).click();
	await expect(page.locator('[data-slice-pill]')).toBeVisible({ timeout: 20_000 });
	await screenshot(page, backend, 'slice', rows);
	expect(await acceptedResultCount(page)).toBe(beforeSlice);
	await page.locator('[data-slice-put-back]').click();
	await expect(page.locator('[data-slice-pill]')).toBeHidden({ timeout: 20_000 });
	rows.push({ step: 'slice', status: 'passed', detail: 'Level cut applied and put back; no source write' });

	// Near-wall Cutaway: Whole, then Cut, on the same 3D Stage.
	const openReadings = async () => {
		await page.getByRole('button', { name: 'More readings' }).click();
		await expect(page.locator('[data-near-walls="cut"]')).toBeVisible();
	};
	await openReadings();
	await page.locator('[data-near-walls="whole"]').click();
	await screenshot(page, backend, 'cutaway-whole', rows);
	await openReadings();
	await page.locator('[data-near-walls="cut"]').click();
	await expect(page.locator('[data-near-walls="cut"]')).toHaveAttribute('aria-checked', 'true');
	await screenshot(page, backend, 'cutaway-cut', rows);
	rows.push({ step: 'cutaway', status: 'passed', detail: 'Near walls Whole then Cut' });

	// Studio deliberately uses its fixed even light and excludes authored lights
	// (`includeLights={sky !== null}`). Choose a real sky, then switch the Sun's
	// shadows off so the new Point light is the only caster the counter sees.
	const beforeSky = await acceptedResultCount(page);
	await page.locator('[data-stage-environment-control]').click();
	await page.getByRole('button', { name: 'Daylight', exact: true }).click();
	await waitForAccepted(page, beforeSky);
	const sunShadows = page.getByRole('switch', { name: /Sun shadows/i });
	if (!(await sunShadows.isVisible().catch(() => false))) {
		await page.locator('details summary').filter({ hasText: 'More' }).click();
	}
	if (await sunShadows.isChecked()) {
		const beforeSunShadows = await acceptedResultCount(page);
		await sunShadows.click();
		await waitForAccepted(page, beforeSunShadows);
	}
	await page.locator('[data-stage-environment-control]').click();

	// Place a Point light, make it cast, and read the real submission counter.
	await openLibrary(page, 'Lights');
	await page.locator('[data-world-toolbar] [aria-label="Lights"]').getByRole('button', { name: 'Point', exact: true }).click();
	const beforeLight = await acceptedResultCount(page);
	const canvasBox = await page.locator(STAGE_HOST).boundingBox();
	if (canvasBox === null) throw new Error('the Stage has no box to place a light in');
	await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
	await waitForAccepted(page, beforeLight);
	if (!(await page.locator('[data-light-fields]').isVisible().catch(() => false))) {
		await ensureIndexOpen(page);
		await page.locator('#plate-index-search').fill('Point');
		await page.locator('li.item button.item-row').filter({ hasText: 'Point' }).first().click();
	}
	await expect(page.locator('[data-light-fields]')).toBeVisible();
	const beforeShadowStats = await shadowStats(page);
	if (beforeShadowStats === null) throw new Error('the Stage shadow counter was not exposed to the harness');
	const beforeShadow = await acceptedResultCount(page);
	await page.locator('[data-field="shadow"]').check();
	await waitForAccepted(page, beforeShadow);
	console.log('[pr2-stage] shadow diagnostics', JSON.stringify(await shadowDiagnostics(page)));
	await expect.poll(async () => (await shadowStats(page))?.maps ?? 0, { timeout: 20_000 })
		.toBeGreaterThanOrEqual(beforeShadowStats.maps + 6);
	const afterShadowStats = await shadowStats(page);
	expect((afterShadowStats?.maps ?? 0) - beforeShadowStats.maps).toBe(6);
	expect((afterShadowStats?.passes ?? 0) - beforeShadowStats.passes).toBe(1);
	await screenshot(page, backend, 'light-shadow', rows);
	rows.push({
		step: 'light-shadow',
		status: 'passed',
		detail: `Point Shadow on: maps +${(afterShadowStats?.maps ?? 0) - beforeShadowStats.maps}, passes +${(afterShadowStats?.passes ?? 0) - beforeShadowStats.passes}`
	});

	// A settled Stage does no shadow work across an orbit and an idle second.
	const settled = await shadowStats(page);
	await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
	await page.mouse.down();
	for (let step = 0; step < 12; step += 1) {
		await page.mouse.move(
			canvasBox.x + canvasBox.width / 2 + Math.sin(step / 3) * 30,
			canvasBox.y + canvasBox.height / 2 + Math.cos(step / 4) * 16
		);
		await page.waitForTimeout(20);
	}
	await page.mouse.up();
	await page.waitForTimeout(1_000);
	const afterOrbit = await shadowStats(page);
	expect(afterOrbit).toEqual(settled);
	rows.push({ step: 'shadow-idle', status: 'passed', detail: `no shadow submissions across orbit/idle; ${settled?.maps} maps total` });

	// Save, then the Experience Camera capture (a real snapshot) and Preview.
	await saveProject(page);
	await page.getByRole('button', { name: 'Experience', exact: true }).click();
	await page.getByRole('button', { name: 'New Experience', exact: true }).click();
	await page.getByRole('textbox', { name: 'New Experience name' }).press('Enter');
	await expect(page.locator('[data-experience-dock]')).toBeVisible({ timeout: 30_000 });
	const beforeCapture = await acceptedResultCount(page);
	await page.locator('[aria-label="Experience dock"]').getByRole('button', { name: 'Capture', exact: true }).click();
	await waitForMark(page, 'experience:capture-accepted', 30_000);
	await expect.poll(() => acceptedResultCount(page)).toBeGreaterThan(beforeCapture);
	await screenshot(page, backend, 'experience-capture', rows);
	rows.push({ step: 'camera-capture', status: 'passed', detail: 'Experience Capture installed one accepted Camera snapshot' });

	const visitStart = await page.evaluate(() => performance.now());
	await page.locator('[data-head-preview] button').click();
	await waitForMark(page, 'preview:entered', 30_000);
	await expect(page.locator(VISITOR_CANVAS)).toBeVisible({ timeout: 30_000 });
	// With no Guide, Preview opens directly into free exploration.
	await expect(page.locator('nav[aria-label="Free exploration"], nav[aria-label="Exploring"]')).toBeVisible({ timeout: 20_000 });
	await page.waitForFunction(
		(since) => (window.__BISKIQ_PERF_RECORDS__ ?? []).some((record) => record.name === 'visitor:first-frame' && record.time > since),
		visitStart,
		{ timeout: 30_000 }
	);
	await screenshot(page, backend, 'preview', rows);
	await page.getByRole('button', { name: /Exit preview/ }).click();
	await waitForMark(page, 'preview:returned', 30_000);
	await expect(page.locator(VISITOR_CANVAS)).toBeHidden();
	await expect(page.locator(STAGE)).toBeVisible();
	rows.push({ step: 'preview-visit', status: 'passed', detail: 'visitor free exploration drew its first frame; exited to the Stage' });

	// Re-entry is a new run on the warm surface.
	const reentry = await page.evaluate(() => performance.now());
	await page.locator('[data-head-preview] button').click();
	await waitForMark(page, 'preview:entered', 30_000);
	await expect(page.locator('nav[aria-label="Free exploration"], nav[aria-label="Exploring"]')).toBeVisible({ timeout: 20_000 });
	await page.waitForFunction(
		(since) => (window.__BISKIQ_PERF_RECORDS__ ?? []).some((record) => record.name === 'visitor:first-frame' && record.time > since),
		reentry,
		{ timeout: 30_000 }
	);
	await page.getByRole('button', { name: /Exit preview/ }).click();
	await waitForMark(page, 'preview:returned', 30_000);
	await expect(page.locator(STAGE)).toBeVisible();
	rows.push({ step: 'preview-reentry', status: 'passed', detail: 'second visit drew on the same warm Preview surface' });

	// Return to the World lens so the Stage's own selection and recovery are what
	// this last phase exercises.
	await page.getByRole('button', { name: 'World', exact: true }).click();
	await expect(page.locator(READY)).toBeVisible();

	// Recovery on the Stage itself: WebGPU replaces the generation; WebGL2
	// presents Retry and resumes on a fresh canvas. The console boundary lands
	// after the last journey frame, so any validation error already in flight is
	// still attributed to the journey and cannot be excused by the later loss.
	await page.waitForTimeout(500);
	await session.beginRecovery();
	const recovery = await forceStageRecovery(page, backend);
	expect(recovery.after.canvasId).not.toBe(recovery.before.canvasId);
	expect(recovery.after.before).toBe(false);
	expect(recovery.after.connected).toBe(true);
	// The collector stays live for the rest of the run: a validation error after
	// recovery that does not name the lost device fails the journey.
	await screenshot(page, backend, 'recovered', rows);
	await enterSelectTool(page);
	await ensureIndexOpen(page);
	await selectFirstWall(page);
	await expect(page.locator(STAGE)).toBeVisible();
	rows.push({
		step: 'stage-recovery',
		status: 'passed',
		detail: `${backend === 'webgl2' ? 'unavailable → Retry' : 'automatic new generation'}; fresh canvas; a Wall selects again`
	});
}

test.describe('PR 2 Stage and Preview acceptance', () => {
	for (const backend of ['webgpu', 'webgl2'] as const) {
		test(`${backend}: Stage authoring, shadows, capture, Preview and recovery`, async ({ browser }) => {
			test.setTimeout(300_000);
			const errors: CapturedError[] = [];
			const rows: Row[] = [];
			const started = await openSession(browser, backend, errors);
			try {
				await runJourney(started.page, backend, rows, started);
				const journeyErrors = errors.filter((entry) => entry.phase === 'journey');
				const recoveryErrors = errors.filter((entry) => entry.phase === 'recovery');
				// A journey error is never device-loss noise: the loss has not been
				// forced yet. A recovery error must name the lost device; an uncaptured
				// GPUValidationError alone could be a real shader or pipeline defect.
				expect(journeyErrors).toEqual([]);
				expect(recoveryErrors.filter((entry) => !DEVICE_LOSS_NOISE.test(entry.text))).toEqual([]);
			} finally {
				const state = await stageState(started.page).catch(() => null);
				const shadows = await shadowStats(started.page).catch(() => null);
				await mkdir(resultsDir!, { recursive: true });
				await writeFile(
					join(resultsDir!, `pr2-stage-${backend}.json`),
					JSON.stringify({
						flow: 'PR 2 Stage and Preview browser acceptance',
						backend,
						project: 'seeded agent-admin session',
						viewport: VIEWPORT,
						generatedAt: new Date().toISOString(),
						stage: state,
						shadows,
						errors: errors.filter((entry) => entry.phase === 'journey').map((entry) => entry.text),
						recoveryErrors: errors.filter((entry) => entry.phase === 'recovery').map((entry) => entry.text),
						deviceLossNoise: errors.filter(
							(entry) => entry.phase === 'recovery' && DEVICE_LOSS_NOISE.test(entry.text)
						).length,
						rows
					}, null, 2)
				);
				await started.close();
			}
		});
	}
});
