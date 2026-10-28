import type { Page } from '@playwright/test';
import { handlePoint, selectWallById } from './flow';
import { readLedger } from './ledger';
import { pickIdentity } from './spot-measurement';

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
	await page.waitForTimeout(50);
	const ledger = await readLedger(page);
	const marks = ledger.records.slice(marksBefore).filter((record) => record.name === 'stage:pick');
	const mark = marks.length === 1 ? marks[0] : undefined;
	const after = await workSnapshot(page);
	const selected = await page.locator('button.item-row[aria-current="true"]', { hasText: wallId }).count();
	return { elapsedMs: typeof mark?.detail?.elapsedMs === 'number' ? mark.detail.elapsedMs : null,
		resolved: pickIdentity(mark, wallId) === null ? null : pickIdentity(mark, wallId) === true && selected === 1,
		indexBuilds: countDelta(before, after, 'plan-pick:node-built'), mark: mark ?? null, point, selectionCleared, selected };
}
