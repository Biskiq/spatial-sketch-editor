// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
vi.mock('../../../perf/lib/flow', () => ({
	selectWallById: vi.fn(),
	handlePoint: async (_page: unknown, title: string) => title === 'Wall start' ? { x: 100, y: 100 } : { x: 200, y: 100 }
}));
import { clickPick, describeHitTarget, installPanObserver, requireDragCommit } from '../../../perf/lib/spot-browser';
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

it('names the element the browser hit-tests, so an overlay that shadows the Stage is visible', () => {
	const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	hit.setAttribute('class', 'toggle-hit svelte-x');
	Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => hit });
	expect(describeHitTarget({ x: 1, y: 1 })).toBe('rect.toggle-hit.svelte-x');
	Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
	expect(describeHitTarget({ x: 1, y: 1 })).toBeNull();
});

it('fails a drag at its first missing boundary instead of waiting for an accepted result', async () => {
	const target = window as Window & { __BISKIQ_PERF_RECORDS__?: LedgerRecord[] };
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { callback(0); return 1; });
	const page = { evaluate: async (fn: (arg?: unknown) => unknown, arg?: unknown) => fn(arg) } as unknown as Page;
	target.__BISKIQ_PERF_RECORDS__ = [
		{ kind: 'mark', name: 'stage:pick', time: 5, sequence: 0, detail: { outcome: 'resolved' } },
		{ kind: 'input', name: 'pointermove', time: 9, sequence: 1, detail: { wallMode: true } }
	];
	// Records before the press belong to another gesture.
	await expect(requireDragCommit(page, { pressedAt: 10, pressTarget: 'rect.toggle-hit' }, 'w'))
		.rejects.toThrow('Wall drag stalled at press-claimed: no adapter pointermove input was recorded (the press was not claimed by a Wall handle; 0 hover pick(s) recorded instead); press target rect.toggle-hit');
	target.__BISKIQ_PERF_RECORDS__ = [
		{ kind: 'input', name: 'pointermove', time: 11, sequence: 2, detail: { wallMode: true } },
		{ kind: 'install', name: 'wall-preview', time: 12, sequence: 3, detail: { wallId: 'w' } },
		{ kind: 'mark', name: 'input:release', time: 13, sequence: 4, detail: { phase: 'up' } },
		{ kind: 'mark', name: 'command:commit', time: 13, sequence: 5, detail: { wallId: 'w' } }
	];
	await expect(requireDragCommit(page, { pressedAt: 10, pressTarget: 'canvas' }, 'w')).resolves.toBeUndefined();
});
