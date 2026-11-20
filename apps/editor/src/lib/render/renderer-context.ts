/**
 * The observed renderer state of the nearest Canvas host.
 *
 * `CanvasHost` publishes one mutable record; consumers read the *observed* backend
 * (never the requested one) for the two places the renderer's convention reaches
 * product code: Camera realization and the snapshot readback's row order. The
 * record is intentionally not reactive: every read is a frame-time read, and a
 * backend never changes inside a generation.
 */
import { getContext, setContext } from 'svelte';
import type { WebGPURenderer } from 'three/webgpu';
import type { RendererBackend } from './renderer-backend';
import type { FinishViewGeneration } from './resources/finish-views';

export type CanvasRendererState = {
	/** The observed backend of the ready generation, or null before readiness. */
	backend: RendererBackend | null;
	/** Which fresh canvas is live; a new number is a new generation. */
	generation: number;
	/**
	 * This host's stable owner id plus the live generation. Finish-view
	 * acquisitions carry it, so one Canvas recovering cannot refuse another
	 * Canvas's in-flight completion.
	 */
	viewGeneration: FinishViewGeneration;
	/**
	 * The **real** renderer of the ready generation.
	 *
	 * Threlte receives the ready-gated facade; the shadow controller must observe the
	 * real renderer's `render` calls, and it must never outlive the generation. The
	 * record is set on readiness and cleared when the generation retires.
	 */
	renderer: WebGPURenderer | null;
};

const KEY = Symbol('biskiq.canvas-renderer-state');

/** Called once by `CanvasHost`, during its own initialisation. */
export function provideCanvasRendererState(): CanvasRendererState {
	const state: CanvasRendererState = {
		backend: null,
		generation: 0,
		viewGeneration: { owner: 'global', generation: 0 },
		renderer: null
	};
	setContext(KEY, state);
	return state;
}

/** The nearest host's state. Throws outside a hosted Canvas. */
export function useCanvasRendererState(): CanvasRendererState {
	const state = getContext<CanvasRendererState | undefined>(KEY);
	if (state === undefined) {
		throw new Error('renderer state is missing: mount this content inside CanvasHost');
	}
	return state;
}

/**
 * The nearest host's state, or null when this component tree has no Canvas
 * host (a harness or a representation-only test).
 *
 * Render code uses this for the view-generation token only: without a host the
 * acquisition is unowned, which keeps the harness behavior and lets the
 * existing entry-level guards reject late completions.
 */
export function tryUseCanvasRendererState(): CanvasRendererState | null {
	try {
		return getContext<CanvasRendererState | undefined>(KEY) ?? null;
	} catch {
		return null;
	}
}
