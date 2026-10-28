// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { perfInitScript, readLedger, type LedgerRecord, type RenderFrame } from '../../../perf/lib/ledger';
import { perfMark, perfRenderer } from '$lib/platform/perf-marks';
import { openTiming } from '../../../perf/lib/spot-measurement';
import type { Page } from '@playwright/test';

afterEach(() => { vi.unstubAllGlobals(); });

it('observes only real render calls and pairs open with the submitted source and later frame clock', async () => {
	const callbacks: FrameRequestCallback[] = [];
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length; });
	perfInitScript({});
	const target = window as Window & { __BISKIQ_PERF_RECORDS__?: LedgerRecord[]; __BISKIQ_PERF_RENDER_FRAMES__?: RenderFrame[] };
	// jsdom shares the window and product global; this is the production helper,
	// renderer hand-off, init-script wrapper and page readback, not fabricated marks.
	perfMark('f2:open-requested');
	perfMark('f2:open-admitted', { sourceContentId: 'opened' });
	const renderer = {
		render: vi.fn(), renderBufferDirect: vi.fn(), shadowMap: { render: vi.fn() },
		info: { render: { calls: 1, triangles: 12 }, memory: { geometries: 1, textures: 0 }, programs: [] },
		getContext: () => ({ getExtension: () => null }), properties: { get: () => ({}) }
	};
	perfRenderer(renderer, 'stage');
	perfMark('stage:source-ready', { sourceContentId: 'old' });
	renderer.render();
	perfMark('stage:source-ready', { sourceContentId: 'opened' });
	expect(target.__BISKIQ_PERF_RENDER_FRAMES__).toHaveLength(1);
	renderer.render();
	const frames = target.__BISKIQ_PERF_RENDER_FRAMES__!;
	callbacks.shift()!(frames[1]!.end + 10);
	const page = { evaluate: (fn: () => unknown) => Promise.resolve(fn()) } as unknown as Page;
	const observed = await readLedger(page);
	expect(observed.renderFrames.map((frame) => frame.sourceContentId)).toEqual(['old', 'opened']);
	const measured = openTiming(observed, 0);
	expect(measured.rendered).toBe(frames[1]!.end);
	expect(measured.presented).toBe(frames[1]!.end + 10);
	expect(renderer.render).not.toBeUndefined();
	delete (globalThis as { __BISKIQ_PERF__?: unknown }).__BISKIQ_PERF__;
	delete (globalThis as { __BISKIQ_PERF_RECORDS__?: unknown }).__BISKIQ_PERF_RECORDS__;
});
