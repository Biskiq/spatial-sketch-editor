import type { Page } from '@playwright/test';
import { handlePoint, selectWallById } from './flow';
import { readLedger } from './ledger';
import { dragStall, pickIdentity } from './spot-measurement';

/** Serialized into the browser: the element the browser hit-tests at a viewport point. */
export function describeHitTarget(point: { x: number; y: number }): string | null {
	const element = document.elementFromPoint(point.x, point.y);
	if (element === null) return null;
	const classes = element.getAttribute('class')?.trim().split(/\s+/).filter(Boolean) ?? [];
	return [element.tagName.toLowerCase(), ...classes].join('.');
}

/**
 * Fail at the first missing link of the drag's acceptance chain. Only a drag
 * that reached its commit waits for the accepted result.
 */
export async function requireDragCommit(page: Page, drag: { pressedAt: number; pressTarget: string | null }, wallId: string): Promise<void> {
	// The release's commit mark is recorded in the pointerup task; one frame
	// lets any same-task follow-up land before the ledger is read.
	await page.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame())));
	const stall = dragStall((await readLedger(page)).records.filter((record) => record.time >= drag.pressedAt), wallId);
	if (stall !== null) throw new Error(`Wall drag stalled at ${stall.boundary}: ${stall.reason}; press target ${drag.pressTarget ?? 'none'}`);
}

export type WorkSnapshot = { spans: Record<string, { count: number; totalMs: number; maxMs: number }>; counts: Record<string, number> };

/** Serialized into the browser; never mix an event receipt with an older rAF timestamp. */
export function installPanObserver(): void {
	const target = window as Window & { __spotPan?: { received: number; presented: number; offered: number[] }[]; __spotPanBound?: boolean };
	target.__spotPan = [];
	if (target.__spotPanBound) return;
	target.__spotPanBound = true;
	document.addEventListener('pointermove', (event) => {
		if (event.buttons === 0) return;
		const received = performance.now();
		const offered: number[] = [];
		const next = (time: number) => {
			offered.push(time);
			if (time < received) { requestAnimationFrame(next); return; }
			target.__spotPan?.push({ received, presented: time, offered });
		};
		requestAnimationFrame(next);
	}, true);
}

export async function workSnapshot(page: Page): Promise<WorkSnapshot | null> {
	return page.evaluate(() => {
		const ledger = (globalThis as { __BISKIQ_PERF_WORK__?: WorkSnapshot }).__BISKIQ_PERF_WORK__;
		if (ledger === undefined) return null;
		return JSON.parse(JSON.stringify(ledger)) as WorkSnapshot;
	});
}

function countDelta(before: WorkSnapshot | null, after: WorkSnapshot | null, name: string): number | null {
	if (before === null || after === null) return null;
	return (after.counts[name] ?? 0) - (before.counts[name] ?? 0);
}

export async function clickPick(page: Page, wallId: string) {
	// The Index selects the known identity; its current handles project that wall.
	await selectWallById(page, wallId);
	const start = await handlePoint(page, 'Wall start');
	const end = await handlePoint(page, 'Wall end');
	const point = { x: start.x * 0.75 + end.x * 0.25, y: start.y * 0.75 + end.y * 0.25 };
	// The Card overlays the canvas without reframing it. Close it before the hit;
	// a visible selected row alone is not evidence that a canvas click occurred.
	const cardClose = page.getByRole('button', { name: 'Close selection card', exact: true });
	if (await cardClose.isVisible()) await cardClose.click();
	// A selected Wall's entire body is a manipulation handle. Clear selection
	// through the shipped keyboard command so this press exercises picking.
	await page.keyboard.press('Escape');
	const selectionCleared = await page.locator('button.item-row[aria-current="true"]').count() === 0;
	if (!selectionCleared) throw new Error('Selection did not clear before the known-wall pick');
	const targetIsCanvas = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', point);
	if (!targetIsCanvas) throw new Error(`Known wall ${wallId} is obscured at ${point.x},${point.y}`);
	const before = await workSnapshot(page);
	const marksBefore = (await readLedger(page)).records.length;
	await page.mouse.click(point.x, point.y);
	// The pick is presented in a frame task, so a fixed sleep can read the ledger
	// before its mark exists. Wait, bounded, for this click's own pick record.
	await page
		.waitForFunction(
			(count) =>
				((window as unknown as { __BISKIQ_PERF_RECORDS__?: { name: string }[] }).__BISKIQ_PERF_RECORDS__ ?? [])
					.slice(count)
					.some((record) => record.name === 'stage:pick'),
			marksBefore,
			{ timeout: 2_000 }
		)
		.catch(() => undefined);
	const ledger = await readLedger(page);
	const marks = ledger.records.slice(marksBefore).filter((record) => record.name === 'stage:pick');
	const mark = marks.length === 1 ? marks[0] : undefined;
	const after = await workSnapshot(page);
	// The Index labels a Wall by its display name ("Wall 1"), so identity comes
	// from the row's source id, exactly as the Index selection above does.
	// Issue #346: matching the raw id in the row *text* reported every correct
	// known-Wall pick as unselected.
	const selected = await page.locator(`li.item[data-source-id$=":${wallId}"] button.item-row[aria-current="true"]`).count();
	return { elapsedMs: typeof mark?.detail?.elapsedMs === 'number' ? mark.detail.elapsedMs : null,
		resolved: pickIdentity(mark, wallId) === null ? null : pickIdentity(mark, wallId) === true && selected === 1,
		indexBuilds: countDelta(before, after, 'plan-pick:node-built'), mark: mark ?? null, point, selectionCleared, selected };
}
