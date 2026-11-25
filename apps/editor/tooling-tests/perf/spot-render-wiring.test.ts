// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { perfInitScript, readLedger, type LedgerRecord, type RenderFrame } from '../../perf/lib/ledger';
import { perfMark, perfRenderer } from '$lib/platform/perf-marks';
import { openTiming } from '../../perf/lib/spot-measurement';
import type { Page } from '@playwright/test';

afterEach(() => {
	vi.unstubAllGlobals();
	const target = window as unknown as Window & Record<string, unknown>;
	delete target.__BISKIQ_PERF__;
	delete target.__BISKIQ_PERF_RECORDS__;
	delete target.__BISKIQ_PERF_TICKS__;
	delete target.__BISKIQ_PERF_RENDER_FRAMES__;
	delete target.__BISKIQ_PERF_LONG_TASKS__;
	delete target.__BISKIQ_PERF_EVENTS__;
});

it('accepts a WebGPU config-only shadow map and a product frame wrapper without recursing', () => {
	vi.stubGlobal('requestAnimationFrame', () => 1);
	perfInitScript({});
	const base = vi.fn();
	const renderer: { render: (...args: unknown[]) => unknown; shadowMap: { enabled: boolean; transmitted: boolean; type: number };
		info: { render: { calls: number; triangles: number }; memory: { geometries: number; textures: number }; programs: unknown[] };
		getContext: () => { getExtension: () => null }; properties: { get: () => object } } = {
		render: base,
		// Three r187's WebGPURenderer shape: config only, no render hook.
		shadowMap: { enabled: false, transmitted: false, type: 1 },
		info: { render: { calls: 1, triangles: 12 }, memory: { geometries: 1, textures: 0 }, programs: [] },
		getContext: () => ({ getExtension: () => null }),
		properties: { get: () => ({}) }
	};
	perfRenderer(renderer, 'stage');
	// The product's countSurfaceFrames wrapper captures and re-enters the hook.
	const counted = renderer.render.bind(renderer);
	renderer.render = () => counted();
	renderer.render();
	const frames = (window as Window & { __BISKIQ_PERF_RENDER_FRAMES__?: RenderFrame[] }).__BISKIQ_PERF_RENDER_FRAMES__;
	expect(frames).toHaveLength(1);
	expect(base).toHaveBeenCalledTimes(1);
});

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
