/**
 * The two renderer callbacks the product hands to Threlte's `<Canvas>`.
 *
 * Keeping the surface next to the renderer factory is what makes the frame
 * counter name and the `perfRenderer` registration agree: the Stage Canvas and
 * the Preview Canvas pass these functions directly as `createRenderer`, so a
 * test can exercise the same production callback without a browser.
 *
 * `CANVAS_TONE_MAPPING` lives here for the same reason: the pipeline the
 * factory is measured under and the pipeline the Canvases run have one source.
 */
import { NoToneMapping, type WebGLRenderer } from 'three';
import { perfRenderer } from '$lib/platform/perf-marks';
import { createManagedWebGLRenderer } from './managed-webgl-renderer';

/**
 * The accepted tone mapping, named once for the two product Canvases.
 *
 * T2 S0 Gate A accepted `NoToneMapping` at exposure 1.0 with sRGB output and an
 * `srgb-linear` working space, and rejected ACES, AgX and Neutral on artwork
 * fidelity (see `docs/roadmap/t2-look-atmosphere/s0-rendering-gate/pipeline.md`).
 * The factory cannot hold that decision on its own: Threlte's `<Canvas>` assigns
 * its own `AgXToneMapping` default to whatever renderer `createRenderer`
 * returns, so every Canvas must name the accepted value. Exposure needs no prop —
 * neither this factory nor Threlte writes `toneMappingExposure`, so Three's 1.0
 * stands — and output colour space is Threlte's sRGB default, which no Canvas
 * overrides.
 */
export const CANVAS_TONE_MAPPING = NoToneMapping;

/**
 * Stage's persistent Canvas: stencil for the picking pass, counted as Stage frames.
 *
 * `localClippingEnabled` is set at creation, not when a Slice starts: the first Stage
 * frame already compiles with the two plane slots, so entering, dragging and leaving
 * a Slice never recompiles a program. The plane *count* is constant for the Canvas's
 * life; only the plane *values* change, which is a uniform update.
 */
export function stageCanvasRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
	const renderer = createManagedWebGLRenderer(canvas, { stencil: true, surface: 'stage' });
	renderer.localClippingEnabled = true;
	return perfRenderer(renderer, 'stage');
}

/** Visitor Preview's Canvas, counted under its own surface name. */
export function previewCanvasRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
	return perfRenderer(createManagedWebGLRenderer(canvas, { surface: 'preview' }), 'preview');
}
