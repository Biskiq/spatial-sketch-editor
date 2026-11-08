/**
 * Shared product flows for the measurement harness (T3.P03.S02).
 *
 * The flows drive the shipped product through its real UI: the starter gallery,
 * the source-JSON entry, the Index selection with the Card's field writer, and
 * the Head's Undo/Redo/Save controls. No test-only route, adapter or build
 * injection is reached — the harness observes the same UI a creator does.
 */

import { expect, type Dialog, type Download, type Page } from '@playwright/test';

import type { FixtureProject } from './fixtures';
import type { LedgerRecord } from './ledger';

/** How long a harness step waits for a large tier's admission or result; never a measured bound. */
export const LARGE_TIER_WAIT_MS = 300_000;

export function uniqueProjectId(size: string): string {
	return `perf-${size.toLowerCase()}-${Date.now().toString(36)}`;
}

/** Full document navigation: cache reuse only, not a persistent-app lifecycle check. */
export async function closeToHub(page: Page): Promise<void> {
	await page.goto('/projects');
	await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
}

/** Open from the hub through Svelte client navigation; return the UI-generated identity. */
export async function openProjectFromHub(page: Page): Promise<string> {
	// SSR exposes the button before hydration installs its click handler. The
	// sign-in bootstrap leaves this state only after the hub's onMount.
	await expect(page.getByText('Checking sign-in…', { exact: true })).toBeHidden();
	const origin = await page.evaluate(() => performance.timeOrigin);
	const markStart = await page.evaluate(() => performance.now());
	await page.getByRole('button', { name: 'New Project' }).click();
	await expect(page.locator('[aria-label="Spatial stage"] canvas').first()).toBeVisible();
	await waitForMark(page, 'f2:create-empty', 20_000, markStart);
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
	const match = /\/project\/([^/]+)\/spatial/.exec(new URL(page.url()).pathname);
	if (match === null) throw new Error('New Project did not open a project');
	return decodeURIComponent(match[1]!);
}

/** Return along the history entry created by New Project, preserving the app realm. */
export async function closeProjectToHub(page: Page): Promise<void> {
	const origin = await page.evaluate(() => performance.timeOrigin);
	// Edited projects use the shipped unsaved-changes confirmation. Accept the
	// discard only for this close, and remove the listener even for a clean project.
	const discard = (dialog: Dialog) => dialog.type() === 'confirm' ? dialog.accept() : dialog.dismiss();
	page.on('dialog', discard);
	try {
		await page.goBack({ timeout: 20_000 });
		await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
		expect(new URL(page.url()).pathname).toBe('/projects');
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
	} finally {
		page.off('dialog', discard);
	}
}

/** Full document navigation to a fresh create intent; preserves cache, not app state. */
export async function gotoCreateIntent(page: Page, projectId: string): Promise<void> {
	await page.goto(`/project/${encodeURIComponent(projectId)}/spatial?create=1`);
	const chooser = page.getByRole('dialog', { name: 'Start a project' });
	const canvas = page.locator('canvas').first();
	// The current route opens an empty project immediately; an older build
	// still shows the starter chooser. Wait for whichever this build serves.
	await expect
		.poll(
			async () => {
				if (await chooser.isVisible().catch(() => false)) return 'chooser';
				if (await canvas.isVisible().catch(() => false)) return 'direct';
				return 'pending';
			},
			{ timeout: 60_000 }
		)
		.not.toBe('pending');
}

/**
 * Choose the create intent's starter on either build.
 *
 * The current route starts empty and replaces that project with the enclosed
 * room through Find. The old chooser is still served by stale previews, so the
 * same helper keeps those flows working without restoring the removed UI.
 */
export async function chooseCreateStarter(
	page: Page,
	starter: 'Enclosed room' | 'Begin empty'
): Promise<void> {
	const chooser = page.getByRole('dialog', { name: 'Start a project' });
	const canvas = page.locator('canvas').first();
	if (await chooser.isVisible().catch(() => false)) {
		await page.getByRole('button', { name: starter, exact: true }).click();
		await expect(canvas).toBeVisible({ timeout: 60_000 });
		return;
	}
	if (starter === 'Enclosed room') {
		const markStart = await page.evaluate(() => performance.now());
		await runFindCommand(page, 'Use enclosed room starter');
		const replacement = page.getByRole('alertdialog', { name: 'Replace project' });
		await expect(replacement).toBeVisible();
		await replacement.getByRole('button', { name: 'Replace', exact: true }).click();
		await waitForMark(page, 'stage:activated', 60_000, markStart);
	}
	await expect(canvas).toBeVisible({ timeout: 60_000 });
}

/** The canonical starter gallery, through the current Find entry or the old boot panel. */
export async function startStarterGallery(page: Page): Promise<void> {
	await chooseCreateStarter(page, 'Enclosed room');
}

/**
 * Draw and close a four-point enclosure through the shipped Ink palette.
 *
 * Typed points are the same exact parser a creator uses; no test-only route or
 * direct document write is involved. An empty project has a datum but no Room
 * floor, so this is the product path that makes floor placement reachable.
 */
export async function drawInkEnclosure(page: Page): Promise<void> {
	const dock = page.locator('[data-dock-tool="layout-ink"]');
	if ((await dock.getAttribute('aria-pressed')) !== 'true') await dock.click();
	await expect(page.locator('[data-layout-ink-palette]')).toBeVisible();
	const points = [
		[2, -2],
		[6, -2],
		[6, 2],
		[2, 2]
	] as const;
	for (let index = 0; index < points.length; index += 1) {
		const [x, z] = points[index]!;
		await addInkPoint(page, x, z);
		await expect
			.poll(
				() =>
					page.evaluate(() => {
						const count = document
							.querySelector('[data-layout-ink-palette]')
							?.getAttribute('data-ink-points');
						return count === null || count === undefined ? -1 : Number(count);
					}),
				{ timeout: 10_000 }
			)
			.toBe(index + 1);
	}
	const before = await acceptedResultCount(page);
	await closeInkRing(page);
	await waitForAcceptedResult(page, before);
}

/**
 * F2's explicit Open: the source-JSON entry, a real file chooser and the
 * canonical admission path. The returned ledger slice covers the open.
 */
/** Open the Head's project-procedure menu and leave it visible. */
export async function openProjectMenu(page: Page): Promise<void> {
	const trigger = page.locator('[data-head-project]');
	await expect(trigger).toBeVisible();
	if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
	await expect(page.getByRole('group', { name: 'Project actions' })).toBeVisible();
}

/** Close the Head's project-procedure menu when it is open. */
export async function closeProjectMenu(page: Page): Promise<void> {
	const trigger = page.locator('[data-head-project]');
	if ((await trigger.getAttribute('aria-expanded')) === 'true') await trigger.click();
}

/** Download the accepted source through the Head's project menu. */
export async function downloadSourceJson(page: Page): Promise<Download> {
	await openProjectMenu(page);
	const download = page.waitForEvent('download');
	await page.locator('[data-head-download]').click();
	const file = await download;
	await closeProjectMenu(page);
	return file;
}

/** Run one operation through the Head's Find combobox. */
export async function runFindCommand(page: Page, command: string): Promise<void> {
	const input = page.getByRole('combobox', { name: 'Find a subject, tool or operation' });
	await expect(input).toBeVisible();
	await input.fill(command);
	const option = page.getByRole('option', { name: new RegExp(`\\b${command}\\b`, 'i') }).first();
	await expect(option).toBeVisible();
	await option.getByRole('button').click();
}

export async function openSourceJson(page: Page, project: FixtureProject, timeoutMs = LARGE_TIER_WAIT_MS): Promise<void> {
	const markStart = await page.evaluate(() => performance.now());
	await openProjectMenu(page);
	await page.locator('[data-head-source]').click();
	const replacement = page.getByRole('alertdialog', { name: 'Replace project' });
	await expect(replacement).toBeVisible();
	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		replacement.getByRole('button', { name: 'Replace', exact: true }).click()
	]);
	const input = chooser.element();
	try {
		// Playwright 1.63's setFiles/setInputFiles retains an additional retargeted
		// ElementHandle internally. Use the public handle and the same DOM File /
		// input / change semantics for this bounded JSON payload, then release the
		// only remote handle we own. The shipped chooser and admission stay real.
		await input.evaluate((element, file) => {
			if (!(element instanceof HTMLInputElement)) throw new Error('The source chooser is not an input');
			const transfer = new DataTransfer();
			transfer.items.add(new File([file.json], file.name, { type: 'application/json' }));
			element.files = transfer.files;
			element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
			element.dispatchEvent(new Event('change', { bubbles: true }));
		}, { name: `${project.size}.json`, json: project.canonicalJson });
	} finally {
		await input.dispose();
	}
	// A wait bound, not a budget: XL and the opening-heavy C10 sweep can exceed
	// the default. E5 passes C10 its own measured bound; F2 keeps this one.
	await waitForMark(page, 'f2:open-admitted', timeoutMs, markStart);
	await expect(page.locator('canvas').first()).toBeVisible();
}

export async function waitForMark(page: Page, name: string, timeout = 20_000, afterTime = -1): Promise<LedgerRecord> {
	await page.waitForFunction(
		({ markName, after }) =>
			(window as Window & { __BISKIQ_PERF_RECORDS__?: LedgerRecord[] }).__BISKIQ_PERF_RECORDS__?.some(
				(record) => record.name === markName && record.time > after
			) === true,
		{ markName: name, after: afterTime },
		{ timeout, polling: 50 }
	);
	// A timestamp survives eviction from the bounded ledger. Return just the
	// matching record rather than copying the entire ledger over CDP.
	const record = await page.evaluate(({ markName, after }) => {
		const records = (window as Window & { __BISKIQ_PERF_RECORDS__?: LedgerRecord[] }).__BISKIQ_PERF_RECORDS__;
		if (records === undefined) return null;
		for (let index = records.length - 1; index >= 0; index -= 1) {
			const candidate = records[index]!;
			if (candidate.name === markName && candidate.time > after) return candidate;
		}
		return null;
	}, { markName: name, after: afterTime });
	if (record === null) throw new Error(`mark ${name} was not recorded`);
	return record;
}

/**
 * Select the first Wall through the Index and wait for its manipulation handles.
 *
 * T1.P02.S02 retired the Dimensions task: a selected Wall's handles are offered
 * with **no task armed** (the Layout adapter's `pressWhenNoTask`), and the
 * ordinary fields render in the selection Card.
 */
export async function selectFirstWall(page: Page): Promise<void> {
	await page.getByRole('group', { name: 'Subject kinds' }).getByRole('button', { name: 'Walls', exact: true }).click();
	const wallRow = page.getByRole('navigation', { name: 'Project locator' }).getByRole('button', { name: /^Wall / }).first();
	await expect(wallRow).toBeVisible();
	await wallRow.click();
	await expect(handleLocator(page, 'Wall end')).toBeVisible();
}

/**
 * Setup only: wait until the Stage has finished building what the open
 * admitted (its triangle count is stable across two samples), so a flow
 * samples at the loaded peak (A.4). A large tier with streamed models can block
 * the main thread for tens of seconds after admission; that is the product's
 * behaviour to report, and this wait is never a measured bound.
 */
export async function waitForStageSettled(page: Page, timeoutMs = LARGE_TIER_WAIT_MS): Promise<void> {
	const started = Date.now();
	let previous: number | null = null;
	while (Date.now() - started < timeoutMs) {
		const triangles = await page.evaluate(() => {
			const refs = (window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { renderer: { info: { render: { triangles: number } } } }> }).__BISKIQ_PERF_RENDER_REFS__;
			return refs?.stage?.renderer.info.render.triangles ?? -1;
		});
		// Two equal readings a full interval apart still define the loaded peak;
		// sampling before the first wait removes a whole interval from setup. A
		// Stage that has drawn nothing has not settled, so 0 never counts.
		if (previous !== null && triangles > 0 && triangles === previous) return;
		previous = triangles;
		await page.waitForTimeout(500);
	}
	throw new Error(`the Stage did not settle within ${timeoutMs / 1000} s`);
}

/**
 * Setup only: wait until the Stage camera stops moving (its last rendered
 * world matrix and projection are equal across two samples), so a window
 * starts at a settled Fit or reading instead of inside its transition.
 */
export async function waitForCameraSettled(page: Page, timeoutMs = 20_000): Promise<void> {
	const started = Date.now();
	let previous = '';
	let sampled = false;
	while (Date.now() - started < timeoutMs) {
		const pose = await page.evaluate(() => {
			type Camera = { matrixWorld: { elements: number[] }; projectionMatrix: { elements: number[] } };
			const camera = (window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { camera: Camera }> }).__BISKIQ_PERF_RENDER_REFS__?.stage?.camera;
			return camera === undefined ? '' : [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements].map((value) => value.toFixed(6)).join(',');
		});
		// Same stability proof (an equal pose one interval later); the first sample
		// no longer costs an interval of its own.
		if (sampled && pose !== '' && pose === previous) return;
		previous = pose;
		sampled = true;
		await page.waitForTimeout(250);
	}
	throw new Error(`the Stage camera did not settle within ${timeoutMs / 1000} s`);
}

/** The shipped Fit command: every footprint in frame. Setup, outside the timed windows. */
export async function fitStage(page: Page): Promise<void> {
	await runFindCommand(page, 'Fit');
	await waitForCameraSettled(page);
}

/** The shipped reading toggle (Plan or 3D), waited until the reading has settled. */
export async function setStageReading(page: Page, reading: 'Plan' | '3D'): Promise<void> {
	const button = page.locator(`[data-drafting-reading="${reading === 'Plan' ? 'plan' : '3d'}"]`);
	await expect(button).toBeVisible();
	await button.click();
	await expect(button).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
	await waitForCameraSettled(page);
}

/** Type one exact Ink point through the palette's Point disclosure. */
export async function addInkPoint(page: Page, x: number, z: number): Promise<void> {
	const xInput = page.locator('[data-ink-x]');
	if (!(await xInput.isVisible().catch(() => false))) {
		const pointToggle = page.locator('[data-ink-point-toggle]');
		if ((await pointToggle.count()) === 0) {
			await page.getByRole('button', { name: 'Ink settings and Opening' }).click();
		}
		const wallReading = page.locator('[data-ink-reading-wall]');
		if ((await wallReading.count()) > 0) await wallReading.click();
		const lineMode = page.locator('[data-ink-wall-mode="line"]');
		if ((await lineMode.count()) > 0 && (await lineMode.getAttribute('aria-checked')) !== 'true') {
			await lineMode.click();
		}
		await expect(pointToggle).toBeVisible();
		await pointToggle.click();
	}
	await expect(xInput).toBeVisible();
	await xInput.fill(String(x));
	await page.locator('[data-ink-z]').fill(String(z));
	await page.locator('[data-ink-add-point]').click();
}

/** Close the live Ink ring through the key row, opening it from a disclosure when needed. */
export async function closeInkRing(page: Page): Promise<void> {
	const close = page.locator('[data-ink-close]');
	if (!(await close.isVisible().catch(() => false))) {
		await page.getByRole('button', { name: 'Ink settings and Opening' }).click();
	}
	await expect(close).toBeVisible();
	await close.click();
}

/**
 * A scripted pan and zoom on the shipped Stage controls for `durationMs`: the
 * keyboard pans (arrow keys) and wheel zooms at the Stage center, alternating
 * so the framing returns close to where it started. Paced to wall-clock time.
 */
export async function scriptedPanZoom(page: Page, durationMs: number): Promise<void> {
	const box = await page.locator('.stage').first().boundingBox();
	if (box === null) throw new Error('the Stage has no box');
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
	const started = Date.now();
	for (let step = 0; Date.now() - started < durationMs; step++) {
		if (step % 2 === 0) await page.keyboard.press(keys[(step / 2) % keys.length]!);
		else await page.mouse.wheel(0, step % 4 === 1 ? -60 : 60);
		const wait = started + (step + 1) * 100 - Date.now();
		if (wait > 0) await page.waitForTimeout(wait);
	}
}

/**
 * Select one Wall by id through the Index search (the Index labels a Wall
 * `wall · <id>`) and wait for its manipulation handles.
 */
export async function selectWallById(page: Page, wallId: string): Promise<void> {
	await page.locator('#plate-index-search').fill(wallId);
	const wallRow = page.locator(`li.item[data-source-id$=":${wallId}"] button.item-row`).first();
	await expect(wallRow).toBeVisible();
	await wallRow.click();
	await expect(handleLocator(page, 'Wall end')).toBeVisible();
}

function handleLocator(page: Page, title: string) {
	return page.locator('svg.overlay g.mark', { has: page.locator('title', { hasText: title }) });
}

/** The viewport point of an overlay handle (SVG translate plus the overlay box). */
export async function handlePoint(page: Page, title: string): Promise<{ x: number; y: number }> {
	const marker = handleLocator(page, title);
	const glyph = marker.locator('circle.glyph.knob');
	await expect(glyph).toBeVisible();
	const box = await glyph.boundingBox();
	if (box === null) throw new Error(`handle ${title} has no position`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * A continuous drag on the shipped straight-Wall handle.
 *
 * `samples` pointer moves are dispatched along the Wall's own screen direction,
 * so the planner keeps producing a valid candidate. The spot check passes four,
 * or up to eight while a result is on a threshold margin.
 */
export async function dragWallHandle(
	page: Page,
	options: { samples: number; distance: number; settleMs?: number }
): Promise<{ start: { x: number; y: number }; end: { x: number; y: number }; dispatched: number }> {
	const startHandle = await handlePoint(page, 'Wall start');
	const start = await handlePoint(page, 'Wall end');
	const dx = start.x - startHandle.x;
	const dy = start.y - startHandle.y;
	const length = Math.hypot(dx, dy) || 1;
	const direction = { x: dx / length, y: dy / length };
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	for (let index = 1; index <= options.samples; index++) {
		const progress = (options.distance * index) / options.samples;
		await page.mouse.move(start.x + direction.x * progress, start.y + direction.y * progress);
	}
	// A delayed presentation needs its frame to paint before release clears the
	// preview; the correlation proof passes the harness delay here.
	const settleMs = options.settleMs ?? 0;
	if (settleMs > 0) await page.waitForTimeout(settleMs);
	await page.mouse.up();
	return {
		start,
		end: { x: start.x + direction.x * options.distance, y: start.y + direction.y * options.distance },
		dispatched: options.samples
	};
}

/** How many accepted results have installed so far. */
export async function acceptedResultCount(page: Page): Promise<number> {
	// Counted in the page: a full ledger read copies the frame clock, every
	// record and the event buffer for one integer, and the edit loops call this
	// before and after every commit.
	return page.evaluate(() => {
		const records = (window as Window & { __BISKIQ_PERF_RECORDS__?: LedgerRecord[] }).__BISKIQ_PERF_RECORDS__;
		if (records === undefined) return 0;
		let count = 0;
		for (const record of records) if (record.kind === 'result' && record.name === 'accepted-result') count += 1;
		return count;
	});
}

/** Wait until one more accepted result than `previous` has installed. */
export async function waitForAcceptedResult(page: Page, previous: number): Promise<LedgerRecord> {
	await page.waitForFunction(
		(count) =>
			((window as Window & { __BISKIQ_PERF_RECORDS__?: { kind: string; name: string }[] })
				.__BISKIQ_PERF_RECORDS__ ?? []).filter(
				(record) => record.kind === 'result' && record.name === 'accepted-result'
			).length > count,
		previous,
		{ timeout: LARGE_TIER_WAIT_MS, polling: 50 }
	);
	const record = await page.evaluate(() => {
		const records = (window as Window & { __BISKIQ_PERF_RECORDS__?: LedgerRecord[] }).__BISKIQ_PERF_RECORDS__;
		if (records === undefined) return null;
		for (let index = records.length - 1; index >= 0; index -= 1) {
			const candidate = records[index]!;
			if (candidate.kind === 'result' && candidate.name === 'accepted-result') return candidate;
		}
		return null;
	});
	if (record === null) throw new Error('no accepted result was installed');
	return record;
}

/**
 * `command → accepted result → first rendering opportunity after it`, computed
 * in the page.
 *
 * This is the same value the flow used to compute from a full `readLedger` on
 * every sample; it is now one evaluate that returns a single number, so the
 * frame clock and every input record are not serialized per sample.
 */
export async function commandPresentation(page: Page, commandName: string): Promise<number | null> {
	return page.evaluate((name) => {
		type Entry = { kind: string; name: string; time: number };
		const target = window as Window & { __BISKIQ_PERF_RECORDS__?: Entry[]; __BISKIQ_PERF_TICKS__?: number[] };
		const records = target.__BISKIQ_PERF_RECORDS__ ?? [];
		const ticks = target.__BISKIQ_PERF_TICKS__ ?? [];
		let command: Entry | undefined;
		for (let index = records.length - 1; index >= 0; index -= 1) {
			const candidate = records[index]!;
			if (candidate.kind === 'mark' && candidate.name === name) {
				command = candidate;
				break;
			}
		}
		if (command === undefined) return null;
		let completedAt: number | null = null;
		for (const candidate of records) {
			if (candidate.kind === 'result' && candidate.name === 'accepted-result' && candidate.time >= command.time) {
				completedAt = candidate.time;
				break;
			}
		}
		if (completedAt === null) return null;
		// rAF timestamps are monotonic, so the first tick at or after the result is
		// the first bracketed rendering opportunity (binary search, same answer as
		// `firstFrameAtOrAfter`).
		let low = 0;
		let high = ticks.length - 1;
		let frame: number | null = null;
		while (low <= high) {
			const middle = (low + high) >> 1;
			const tick = ticks[middle]!;
			if (tick >= completedAt) {
				frame = tick;
				high = middle - 1;
			} else low = middle + 1;
		}
		return frame === null ? null : frame - command.time;
	}, commandName);
}

/**
 * Frame intervals and long tasks inside `[from, to]`, computed in the page for
 * the same reason as {@link commandPresentation}: the orbit windows read this
 * several times per run and only need the two derived series.
 */
export async function frameWindow(
	page: Page,
	from: number,
	to: number
): Promise<{ intervals: number[]; longTaskCount: number; longestLongTask: number }> {
	return page.evaluate(([start, end]) => {
		const target = window as Window & {
			__BISKIQ_PERF_TICKS__?: number[];
			__BISKIQ_PERF_LONG_TASKS__?: { start: number; duration: number }[];
		};
		const intervals: number[] = [];
		let previous: number | null = null;
		for (const tick of target.__BISKIQ_PERF_TICKS__ ?? []) {
			if (tick < start || tick > end) continue;
			if (previous !== null) intervals.push(tick - previous);
			previous = tick;
		}
		let longTaskCount = 0;
		let longestLongTask = 0;
		for (const task of target.__BISKIQ_PERF_LONG_TASKS__ ?? []) {
			if (task.start < start || task.start > end) continue;
			longTaskCount += 1;
			longestLongTask = Math.max(longestLongTask, task.duration);
		}
		return { intervals, longTaskCount, longestLongTask };
	}, [from, to] as const);
}

/** Type an exact Wall length through the Card's Layout field writer and commit with Enter. */
export async function commitPrecisionLength(page: Page, lengthMeters: number): Promise<void> {
	const lengthField = page.locator('label.field', { hasText: 'Length' }).locator('input').first();
	// An accepted install rebinds the adapter, so the Card may have closed since the
	// previous command. Re-select the Wall through the shipped Index entry.
	if (!(await lengthField.isVisible().catch(() => false))) await selectFirstWall(page);
	await expect(lengthField).toBeVisible();
	await lengthField.fill(String(lengthMeters));
	await lengthField.press('Enter');
}

export async function undoRedoCycles(page: Page, cycles: number): Promise<void> {
	for (let index = 0; index < cycles; index++) {
		const beforeUndo = await acceptedResultCount(page);
		await page.getByRole('button', { name: 'Undo', exact: true }).click();
		await waitForAcceptedResult(page, beforeUndo);
		const beforeRedo = await acceptedResultCount(page);
		await page.getByRole('button', { name: 'Redo', exact: true }).click();
		await waitForAcceptedResult(page, beforeRedo);
	}
}
