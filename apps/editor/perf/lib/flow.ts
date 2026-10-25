/**
 * Shared product flows for the measurement harness (T3.P03.S02).
 *
 * The flows drive the shipped product through its real UI: the starter gallery,
 * the source-JSON entry, the Index selection, the contributed Dimensions task
 * and the Head's Undo/Redo/Save controls. No test-only route, adapter or build
 * injection is reached — the harness observes the same UI a creator does.
 */

import { expect, type Dialog, type Page } from '@playwright/test';

import type { FixtureProject } from './fixtures';
import { readLedger, type LedgerRecord } from './ledger';

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
	await page.getByRole('button', { name: 'New Project' }).click();
	await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeVisible();
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
	await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeVisible();
}

/** The canonical starter gallery, through the boot panel. */
export async function startStarterGallery(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Enclosed room' }).click();
	await waitForMark(page, 'stage:activated');
	await expect(page.locator('canvas').first()).toBeVisible();
}

/**
 * F2's explicit Open: the source-JSON entry, a real file chooser and the
 * canonical admission path. The returned ledger slice covers the open.
 */
export async function openSourceJson(page: Page, project: FixtureProject): Promise<void> {
	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.getByRole('button', { name: 'Open source JSON' }).click()
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
	// A wait bound, not a budget: an XL admission takes longer than the default.
	await waitForMark(page, 'f2:open-admitted', LARGE_TIER_WAIT_MS);
	await expect(page.locator('canvas').first()).toBeVisible();
}

export async function waitForMark(page: Page, name: string, timeout = 20_000): Promise<LedgerRecord> {
	await page.waitForFunction(
		(markName) =>
			(window as Window & { __BISKIQ_PERF_RECORDS__?: { name: string }[] }).__BISKIQ_PERF_RECORDS__?.some(
				(record) => record.name === markName
			) === true,
		name,
		{ timeout, polling: 50 }
	);
	const ledger = await readLedger(page);
	const record = [...ledger.records].reverse().find((entry) => entry.name === name);
	if (record === undefined) throw new Error(`mark ${name} was not recorded`);
	return record;
}

/** Select the first Wall through the Index, then open its contributed Dimensions task. */
export async function selectFirstWallAndOpenDimensions(page: Page): Promise<void> {
	const wallRow = page.locator('button.item-row', { hasText: 'Wall' }).first();
	await expect(wallRow).toBeVisible();
	await wallRow.click();
	const dimensions = page.locator('.contributed-item button.item-row', { hasText: 'Dimensions' }).first();
	await expect(dimensions).toBeVisible();
	await dimensions.click();
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
	let previous = -1;
	while (Date.now() - started < timeoutMs) {
		await page.waitForTimeout(500);
		const triangles = await page.evaluate(() => {
			const refs = (window as unknown as { __BISKIQ_PERF_RENDER_REFS__?: Record<string, { renderer: { info: { render: { triangles: number } } } }> }).__BISKIQ_PERF_RENDER_REFS__;
			return refs?.stage?.renderer.info.render.triangles ?? -1;
		});
		if (triangles >= 0 && triangles === previous) return;
		previous = triangles;
	}
	throw new Error(`the Stage did not settle within ${timeoutMs / 1000} s`);
}

/**
 * Select one Wall by id through the Index search (the Index labels a Wall
 * `wall · <id>`), then open its contributed Dimensions task.
 */
export async function selectWallAndOpenDimensions(page: Page, wallId: string): Promise<void> {
	await page.locator('#plate-index-search').fill(wallId);
	const wallRow = page.locator('button.item-row', { hasText: wallId }).first();
	await expect(wallRow).toBeVisible();
	await wallRow.click();
	const dimensions = page.locator('.contributed-item button.item-row', { hasText: 'Dimensions' }).first();
	await expect(dimensions).toBeVisible();
	await dimensions.click();
	await expect(handleLocator(page, 'Wall end')).toBeVisible();
}

function handleLocator(page: Page, title: string) {
	return page.locator('svg.overlay g.marker', { has: page.locator('title', { hasText: title }) });
}

/** The viewport point of an overlay handle (SVG translate plus the overlay box). */
export async function handlePoint(page: Page, title: string): Promise<{ x: number; y: number }> {
	const marker = handleLocator(page, title);
	const transform = await marker.getAttribute('transform');
	const overlay = await page.locator('svg.overlay').boundingBox();
	if (transform === null || overlay === null) throw new Error(`handle ${title} has no position`);
	const match = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(transform);
	if (match === null) throw new Error(`unexpected transform: ${transform}`);
	return { x: overlay.x + Number(match[1]), y: overlay.y + Number(match[2]) };
}

/**
 * A continuous drag on the shipped straight-Wall handle.
 *
 * `samples` pointer moves are dispatched (the contract's floor is 60 per run)
 * along the Wall's own screen direction, so the planner keeps producing a valid
 * candidate instead of refusing a mirrored or colliding Wall. The product's
 * input sequence makes each sample a row in the correlation ledger.
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
	const ledger = await readLedger(page);
	return ledger.records.filter((record) => record.kind === 'result' && record.name === 'accepted-result').length;
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
	const ledger = await readLedger(page);
	const results = ledger.records.filter((record) => record.kind === 'result' && record.name === 'accepted-result');
	const record = results[results.length - 1];
	if (record === undefined) throw new Error('no accepted result was installed');
	return record;
}

/** Type an exact Wall length through the Dimensions instrument and commit with Enter. */
export async function commitPrecisionLength(page: Page, lengthMeters: number): Promise<void> {
	const lengthField = page.locator('label.field', { hasText: 'Length' }).locator('input').first();
	// An accepted install rebinds the adapter's task, so the instrument may have
	// closed since the previous command. Reopen it through the shipped Index entry.
	if (!(await lengthField.isVisible().catch(() => false))) await selectFirstWallAndOpenDimensions(page);
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
