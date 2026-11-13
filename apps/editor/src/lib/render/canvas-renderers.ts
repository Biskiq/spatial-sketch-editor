/**
 * The two renderer callbacks the product hands to Threlte's `<Canvas>`.
 *
 * Keeping the surface next to the renderer factory is what makes the frame
 * counter name and the `perfRenderer` registration agree: the Stage Canvas and
 * the Preview Canvas pass these functions directly as `createRenderer`, so a
 * test can exercise the same production callback without a browser.
 */
import type { WebGLRenderer } from 'three';
import { perfRenderer } from '$lib/platform/perf-marks';
import { createManagedWebGLRenderer } from './managed-webgl-renderer';

/** Stage's persistent Canvas: stencil for the picking pass, counted as Stage frames. */
export function stageCanvasRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
	return perfRenderer(
		createManagedWebGLRenderer(canvas, { stencil: true, surface: 'stage' }),
		'stage'
	);
}

/** Visitor Preview's Canvas, counted under its own surface name. */
export function previewCanvasRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
	return perfRenderer(createManagedWebGLRenderer(canvas, { surface: 'preview' }), 'preview');
}
