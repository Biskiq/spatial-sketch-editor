/**
 * Shared product flows for the measurement harness (T3.P03.S02).
 *
 * The flows drive the shipped product through its real UI: the starter gallery,
 * the source-JSON entry, the Index selection, the contributed Dimensions task
 * and the Head's Undo/Redo/Save controls. No test-only route, adapter or build
 * injection is reached — the harness observes the same UI a creator does.
 */

import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, type Page } from '@playwright/test';

import type { FixtureProject } from './fixtures';
import { readLedger, type LedgerRecord } from './ledger';

export function uniqueProjectId(size: string): string {
	return `perf-${size.toLowerCase()}-${Date.now().toString(36)}`;
}

/** Leave the Stage for the hub, ending this repeat-use cycle in the same context. */
export async function closeToHub(page: Page): Promise<void> {
	await page.goto('/projects');
	await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
}

/** Navigate to a fresh create-intent project (the absent row offers the starter). */
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

function writeFixtureFile(project: FixtureProject): string {
	const directory = mkdtempSync(join(tmpdir(), 'biskiq-perf-fixture-'));
	const path = join(directory, `${project.size}.json`);
	writeFileSync(path, project.canonicalJson);
	return path;
}

/**
 * F2's explicit Open: the source-JSON entry, a real file chooser and the
 * canonical admission path. The returned ledger slice covers the open.
 */
export async function openSourceJson(page: Page, project: FixtureProject): Promise<void> {
	const path = writeFixtureFile(project);
	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.getByRole('button', { name: 'Open source JSON' }).click()
	]);
	await chooser.setFiles(path);
	await waitForMark(page, 'f2:open-admitted');
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
	if ((options.settleMs ?? 0) > 0) await page.waitForTimeout(options.settleMs);
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
		{ timeout: 60_000, polling: 50 }
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
