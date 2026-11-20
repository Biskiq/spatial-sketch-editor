/**
 * PR 2 review correction — a hidden Canvas must not submit a zero-sized frame.
 *
 * The detached Preview keeps its renderer and scene warm between visits, and the
 * takeover is `hidden` while inactive. Layout therefore resizes its DOM canvas
 * to 0×0; r187's WebGPU renderer would create a zero-sized depth texture and
 * swapchain and log uncaptured validation errors. The generation facade now
 * refuses that draw, and this suite holds it to that boundary without a GPU or a
 * real renderer.
 */
import { describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
	canvas: { width: 0, height: 0 },
	render: vi.fn()
}));

vi.mock('$lib/render/renderer-backend', () => ({
	createProductRenderer: () => ({
		domElement: harness.canvas,
		render: harness.render,
		init: () => Promise.resolve(),
		dispose: () => Promise.resolve()
	}),
	initProductRenderer: () => Promise.resolve(),
	disposeProductRenderer: () => Promise.resolve(),
	observeRendererDeviceLoss: () => () => undefined,
	rendererBackendOf: () => 'webgpu'
}));

import { createRendererGeneration } from '$lib/render/renderer-generation';

describe('renderer generation zero-sized canvas', () => {
	it('refuses a draw while the canvas has no pixels, then resumes at a real size', async () => {
		harness.render.mockClear();
		harness.canvas.width = 0;
		harness.canvas.height = 0;
		const owner = createRendererGeneration({
			canvas: harness.canvas as unknown as HTMLCanvasElement,
			generation: 1,
			attempt: 'auto',
			surface: 'preview'
		});
		try {
			owner.start();
			await vi.waitFor(() => expect(owner.snapshot().state).toBe('ready'));

			// A hidden, kept-warm surface: its pending invalidation must not reach
			// r187 at 0×0.
			owner.facade.render({} as never, {} as never);
			expect(harness.render).not.toHaveBeenCalled();
			expect(owner.emptyDraws).toBe(1);
			expect(owner.forwardedDraws).toBe(0);
			expect(owner.blockedDraws).toBe(0);

			// Re-entry gives the canvas a real drawing buffer; the next frame is a
			// legitimate draw.
			harness.canvas.width = 1280;
			harness.canvas.height = 720;
			owner.facade.render({} as never, {} as never);
			expect(harness.render).toHaveBeenCalledTimes(1);
			expect(owner.forwardedDraws).toBe(1);
			expect(owner.emptyDraws).toBe(1);
		} finally {
			await owner.retire();
		}
	});
});
