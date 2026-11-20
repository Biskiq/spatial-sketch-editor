// @vitest-environment jsdom
/**
 * PR 2 review correction — renderer recovery must cancel the captured Stage press.
 *
 * The host used to dispatch `new PointerEvent('pointercancel', { pointerId: 1 })`.
 * A Stage press is owned by whatever pointer id the browser delivered, so a
 * touch, pen or later pointer did not match and its edit survived the canvas
 * replacement. The host now reads the surface's actual captured ids and cancels
 * them through the viewport's existing pointercancel seam before the fresh
 * generation mounts. This suite mounts the production host with a stub Canvas and
 * a stub generation owner, then replaces the generation while a non-1 pointer is
 * captured.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';

import CanvasHost from '$lib/render/CanvasHost.svelte';
import type { GenerationSnapshot } from '$lib/render/renderer-generation';

const harness = vi.hoisted(() => ({
	generations: [] as Array<{
		readonly options: {
			readonly generation: number;
			readonly onChange?: (snapshot: GenerationSnapshot) => void;
		};
	}>,
	order: [] as string[]
}));

vi.mock('@threlte/core', async () => ({
	Canvas: (await import('./fixtures/CanvasHostCanvas.svelte')).default
}));

vi.mock('$lib/render/renderer-generation', () => ({
	createRendererGeneration: (options: {
		generation: number;
		onChange?: (snapshot: GenerationSnapshot) => void;
	}) => {
		const record = { options };
		harness.generations.push(record);
		harness.order.push('create');
		return {
			generation: options.generation,
			renderer: { render() {} },
			facade: { render() {} },
			retirement: Promise.resolve(),
			forwardedDraws: 0,
			blockedDraws: 0,
			snapshot: () => ({ state: 'starting', backend: null, failure: null }),
			start() {
				queueMicrotask(() => options.onChange?.({ state: 'ready', backend: 'webgpu', failure: null }));
			},
			retire: () => Promise.resolve()
		};
	}
}));

const children = createRawSnippet(() => ({ render: () => '<span data-child></span>' }));

let targets: HTMLElement[] = [];

beforeEach(() => {
	harness.generations.length = 0;
	harness.order.length = 0;
});

afterEach(() => {
	for (const target of targets) target.remove();
	targets = [];
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('CanvasHost renderer recovery', () => {
	it('cancels the actual captured pointer id before the fresh canvas mounts', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		targets.push(target);
		const cancelled: number[] = [];
		target.addEventListener('pointercancel', (event) => {
			cancelled.push((event as PointerEvent).pointerId);
			harness.order.push('cancel');
		});

		const component = mount(CanvasHost, {
			target,
			props: {
				surface: 'stage',
				capturedPointers: () => {
					harness.order.push('read');
					// The old generation is still the only one when the ids are read.
					expect(harness.generations).toHaveLength(1);
					return [7];
				},
				children
			}
		});
		try {
			await vi.waitFor(() => expect(harness.generations).toHaveLength(1));
			await vi.waitFor(() =>
				expect(target.querySelector('[data-canvas-host]')?.getAttribute('data-phase')).toBe('ready')
			);

			// The device is lost while pointer 7 owns the Stage press. Recovery must
			// cancel that id, synchronously, before the second generation is created.
			harness.generations[0]!.options.onChange?.({
				state: 'failed',
				backend: 'webgpu',
				failure: 'device-lost'
			});
			expect(cancelled).toEqual([7]);
			expect(harness.order).toEqual(['create', 'read', 'cancel']);

			await tick();
			expect(harness.generations).toHaveLength(2);
			expect(harness.order).toEqual(['create', 'read', 'cancel', 'create']);
		} finally {
			await unmount(component);
		}
	});

	it('does not fabricate a pointer id when the surface holds no gesture', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		targets.push(target);
		const cancelled: number[] = [];
		target.addEventListener('pointercancel', (event) => cancelled.push((event as PointerEvent).pointerId));

		const component = mount(CanvasHost, {
			target,
			props: { surface: 'stage', capturedPointers: () => [], children }
		});
		try {
			await vi.waitFor(() => expect(harness.generations).toHaveLength(1));
			await vi.waitFor(() =>
				expect(target.querySelector('[data-canvas-host]')?.getAttribute('data-phase')).toBe('ready')
			);
			harness.generations[0]!.options.onChange?.({
				state: 'failed',
				backend: 'webgpu',
				failure: 'device-lost'
			});
			expect(cancelled).toEqual([]);
			await tick();
			expect(harness.generations).toHaveLength(2);
		} finally {
			await unmount(component);
		}
	});
});
