// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
vi.mock('../../../perf/lib/flow', () => ({
	selectWallById: vi.fn(),
	handlePoint: async (_page: unknown, title: string) => title === 'Wall start' ? { x: 100, y: 100 } : { x: 200, y: 100 }
}));
import { clickPick, installPanObserver } from '../../../perf/lib/spot-browser';
import type { LedgerRecord } from '../../../perf/lib/ledger';

afterEach(() => vi.restoreAllMocks());

it('waits for a frame timestamp after pan receipt instead of clamping a negative delay to zero', () => {
	const frames: FrameRequestCallback[] = [];
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.push(callback); return frames.length; });
	vi.spyOn(performance, 'now').mockReturnValue(100);
	installPanObserver();
	document.dispatchEvent(new MouseEvent('pointermove', { buttons: 1 }));
	frames.shift()!(99);
	const target = window as Window & { __spotPan?: { received: number; presented: number; offered: number[] }[] };
	expect(target.__spotPan).toEqual([]);
	frames.shift()!(116);
	expect(target.__spotPan).toEqual([{ received: 100, presented: 116, offered: [99, 116] }]);
});

it('closes the overlay before a real canvas click and requires a new hit of the known identity', async () => {
	let covered = true;
	let selected = true;
	const target = window as Window & { __BISKIQ_PERF_RECORDS__?: LedgerRecord[] };
	target.__BISKIQ_PERF_RECORDS__ = [];
	Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => document.createElement(covered ? 'aside' : 'canvas') });
	const page = {
		getByRole: () => ({ isVisible: async () => true, click: async () => { covered = false; } }),
		evaluate: async (fn: (arg?: unknown) => unknown, arg?: unknown) => fn(arg),
		keyboard: { press: async () => { selected = false; } },
		mouse: { click: async () => {
			expect(covered).toBe(false);
			expect(selected).toBe(false);
			selected = true;
			target.__BISKIQ_PERF_RECORDS__!.push({ kind: 'mark', name: 'stage:pick', time: 1, sequence: 0, detail: { elapsedMs: 2, outcome: 'resolved', sourceId: 'known', sourceKind: 'wall' } });
		} },
		waitForTimeout: async () => {}, locator: () => ({ count: async () => selected ? 1 : 0 })
	} as unknown as Page;
	expect(await clickPick(page, 'known')).toMatchObject({ resolved: true, elapsedMs: 2, selected: 1 });
	target.__BISKIQ_PERF_RECORDS__ = [];
	(page.mouse.click as unknown) = async () => {};
	expect(await clickPick(page, 'known')).toMatchObject({ resolved: null, elapsedMs: null });
});
