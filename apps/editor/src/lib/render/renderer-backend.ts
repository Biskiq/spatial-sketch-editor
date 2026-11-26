/**
 * The product's one Three renderer factory: r187 `WebGPURenderer`.
 *
 * Every Biskiq 3D surface — the Stage, Visitor Preview and the published visit —
 * constructs its renderer here. Three selects the native WebGPU backend first and
 * its WebGL2 compatibility backend when WebGPU is unavailable; a recovery retry
 * can ask for the compatibility backend explicitly. The *observed* backend is
 * always read back from the initialized renderer, never inferred from the
 * request, so a measurement or diagnostic cannot silently mislabel a fallback.
 *
 * ## One Three resolution
 *
 * Pure shared objects (Vector3, Texture, ColorManagement) are the ones re-exported
 * from `three`; renderer and node types come from `three/webgpu`, and TSL from
 * `three/tsl`. Three's two entry points share one core, which PR 1 verified for
 * constructor identity and colour management on both backends.
 *
 * ## The accepted pipeline
 *
 * T2 S0 Gate A accepted `NoToneMapping` at exposure 1.0, sRGB output and an
 * `srgb-linear` working space. The factory names the parts it owns; the Canvas
 * names tone mapping through `CANVAS_TONE_MAPPING` because Threlte assigns its own
 * `AgXToneMapping` default to whatever factory it is given.
 *
 * ## Depth and viewport conventions
 *
 * The common renderer draws with its backend's coordinate system (WebGPU clip Z
 * in `[0, w]`, WebGL in `[-w, w]`). Evaluated Camera matrices stay authored in the
 * WebGL convention; `realizeEvaluatedCamera` converts them at the renderer
 * boundary. Viewport and scissor rectangles are CSS pixels with a **top-left**
 * origin on both backends — Three's WebGL2 backend converts Y internally.
 */
import {
	NoToneMapping,
	SRGBColorSpace,
	WebGLCoordinateSystem,
	WebGPUCoordinateSystem,
} from 'three';
import type { Camera, Matrix4, WebGPURenderer } from 'three/webgpu';
import { WebGPURenderer as ThreeWebGPURenderer } from 'three/webgpu';
import { countWork } from '@portfolio/layout-core/kernel';
import { perfRenderer } from '$lib/platform/perf-marks';

/** An observed, initialized backend. */
export type RendererBackend = 'webgpu' | 'webgl2';

/** What a generation asked for. `auto` is Three's WebGPU-first request. */
export type RendererAttempt = 'auto' | 'webgl2';

/** Why one generation stopped before or after it was usable. */
export type GenerationFailure = 'init-rejected' | 'init-timeout' | 'device-lost';

/** Which Canvas owns a renderer; the work counter is named for its surface. */
export type RendererSurface = 'stage' | 'preview';

/**
 * The accepted tone mapping, named once for the product Canvases.
 *
 * Gate A rejected ACES, AgX and Neutral on artwork fidelity (see
 * `docs/roadmap/t2-look-atmosphere/s0-rendering-gate/pipeline.md`). Threlte's
 * `<Canvas>` assigns `AgXToneMapping` unless a Canvas names this value.
 */
export const CANVAS_TONE_MAPPING = NoToneMapping;

/** The evaluated camera convention every authored matrix uses. */
export const AUTHORED_COORDINATE_SYSTEM = 'webgl' as const;

type ThreeRenderer = WebGPURenderer & {
	readonly backend: {
		readonly isWebGPUBackend?: boolean;
		readonly isWebGLBackend?: boolean;
	};
};

function asThree(renderer: WebGPURenderer): ThreeRenderer {
	return renderer as ThreeRenderer;
}

/**
 * Construct one renderer on the host's own canvas, synchronously.
 *
 * The options are the Stage's accepted request on both surfaces: antialiased,
 * alpha, high-performance, stencil (the Stage's outline probe and its picking
 * pass), and the builder's default half-float internal colour buffer.
 */
export function createProductRenderer(
	canvas: HTMLCanvasElement,
	attempt: RendererAttempt,
	surface: RendererSurface,
): WebGPURenderer {
	const renderer = new ThreeWebGPURenderer({
		canvas,
		antialias: true,
		alpha: true,
		stencil: true,
		powerPreference: 'high-performance',
		// `false` is Three's automatic WebGPU-first request. A recovery retry may
		// name the compatibility backend; the observed backend still decides what
		// the generation reports.
		forceWebGL: attempt === 'webgl2',
	});
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = NoToneMapping;
	renderer.toneMappingExposure = 1;
	// Threlte still owns the `shadows` prop; the factory does not pre-enable it,
	// so a dev bench that disables shadows keeps its existing policy.
	return countSurfaceFrames(perfRenderer(renderer, surface), surface);
}

/**
 * Count one rendered frame under this surface's production counter.
 *
 * The old managed renderer owned this; the common renderer's `render` is the one
 * call that presents a frame on both backends, so the wrapper moved here rather
 * than multiplying renderer ports. The shadow controller wraps the same method
 * later; nesting is order-independent because each wrapper only observes.
 */
export function countSurfaceFrames<T extends object>(renderer: T, surface: RendererSurface): T {
	const target = renderer as unknown as { render: (...args: unknown[]) => unknown };
	const original = target.render.bind(target);
	const name = surface === 'stage' ? 'render:stage-frame' : 'render:preview-frame';
	target.render = (...args: unknown[]): unknown => {
		countWork(name);
		return original(...args);
	};
	return renderer;
}

/** Resolve once the backend and its coordinate system are usable. */
export function initProductRenderer(renderer: WebGPURenderer): Promise<void> {
	return renderer.init().then(() => undefined);
}

/** The backend the initialized renderer actually obtained. */
export function rendererBackendOf(renderer: WebGPURenderer): RendererBackend {
	const backend = asThree(renderer).backend;
	return backend.isWebGPUBackend === true ? 'webgpu' : 'webgl2';
}

/** Dispose one generation's renderer. Three's own async teardown. */
export function disposeProductRenderer(renderer: WebGPURenderer): Promise<void> {
	return renderer.dispose() as Promise<void>;
}

/**
 * Observe device loss for one generation.
 *
 * Registered **before** `init`: a device can be lost during startup. Three
 * filters a `destroyed` reason from its own WebGPU callback, which is why the
 * documented `onDeviceLost` hook is the one place the owner learns about a lost
 * device; the WebGL2 backend relies on the canvas's `webglcontextlost` event.
 * The returned function removes the observer and is safe to call twice.
 */
export function observeRendererDeviceLoss(
	renderer: WebGPURenderer,
	listener: () => void,
): () => void {
	const three = asThree(renderer);
	if (three.backend.isWebGLBackend === true) {
		const canvas = three.domElement;
		const onLost = (event: Event): void => {
			// Let the browser know the application intends to recover it; the owner
			// replaces the canvas rather than restoring this context.
			event.preventDefault();
			listener();
		};
		canvas.addEventListener('webglcontextlost', onLost);
		let removed = false;
		return () => {
			if (removed) return;
			removed = true;
			canvas.removeEventListener('webglcontextlost', onLost);
		};
	}
	const previous = three.onDeviceLost;
	three.onDeviceLost = (info): void => {
		previous.call(three, info);
		listener();
	};
	let restored = false;
	return () => {
		if (restored) return;
		restored = true;
		three.onDeviceLost = previous;
	};
}

/** The camera coordinate system the observed backend uses. */
export function rendererCoordinateSystem(backend: RendererBackend): number {
	return backend === 'webgpu' ? WebGPUCoordinateSystem : WebGLCoordinateSystem;
}

/**
 * Convert an authored (WebGL) projection matrix to the backend's clip-space Z.
 *
 * Evaluated Camera matrices keep the `[-w, w]` convention the whole product
 * shares. WebGPU's clip space is `[0, w]`, so the third row becomes
 * `(row3 + row4) / 2` — `z' = (z + w) / 2`. X and Y are untouched; the caller
 * recomputes the inverse from the converted matrix, so the physical camera
 * inverse stays consistent with what is drawn.
 */
export function convertProjectionForBackend(
	projection: Matrix4,
	backend: RendererBackend,
): Matrix4 {
	if (backend === 'webgl2') return projection;
	const elements = projection.elements;
	for (let column = 0; column < 4; column += 1) {
		const index = column * 4;
		elements[index + 2] = (elements[index + 2]! + elements[index + 3]!) * 0.5;
	}
	return projection;
}

/** A camera that exposes the renderer's coordinate convention. */
export type RealizableCamera = Camera & { coordinateSystem?: number };
