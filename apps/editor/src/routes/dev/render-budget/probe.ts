/**
 * E7's renderer probe.
 *
 * The production Canvas callbacks already hand each renderer to
 * `perfRenderer`; the bench installs the harness hook before mounting, so the
 * probe observes the shipped renderer rather than a bench-local one. It counts
 * what the plan asks for and nothing else:
 *
 * - one sample per `renderer.render`, with `renderer.info` read after the call
 *   (the default `autoReset` makes that the frame's own call/triangle count);
 * - each shadow-map pass that actually renders, and the maps it renders (a
 *   point light is six), using the same active test as
 *   `authoring/stage/shadow-invalidation.ts`.
 *
 * Frame intervals are the intervals between render starts, not rAF ticks: a
 * Stage at rest produces no frames, and reporting rAF would hide that.
 */
import type { Camera, Object3D, WebGLRenderer } from 'three';

export type ProbeSurface = 'stage' | 'preview';

export type FrameSample = {
	/** `performance.now()` at the render call's start. */
	readonly time: number;
	/** `renderer.info.render.frame` after this render. */
	readonly frame: number;
	readonly calls: number;
	readonly triangles: number;
	readonly textures: number;
	readonly programs: number;
	readonly shadowPasses: number;
	readonly shadowMaps: number;
};

export type ProbeRead = {
	readonly surface: ProbeSurface | null;
	readonly samples: readonly FrameSample[];
};

type Installed = {
	readonly surface: ProbeSurface;
	readonly renderer: WebGLRenderer;
	restore(): void;
};

let installed: Installed | null = null;
let samples: FrameSample[] = [];
let registrations = 0;

/** Install the probe on one renderer; a previous renderer is restored first. */
export function registerProbeRenderer(renderer: WebGLRenderer, surface: ProbeSurface): void {
	if (installed?.renderer === renderer) return;
	registrations += 1;
	installed?.restore();
	samples = [];

	let shadowPasses = 0;
	let shadowMaps = 0;
	const originalShadowRender = renderer.shadowMap.render;
	renderer.shadowMap.render = function countedShadowPass(lights, scene, camera): void {
		const shadowMap = renderer.shadowMap;
		const active = shadowMap.enabled !== false && (shadowMap.autoUpdate || shadowMap.needsUpdate);
		const casting = active
			? lights.filter((light) => (light as { castShadow?: boolean }).castShadow === true)
			: [];
		if (casting.length > 0) {
			shadowPasses += 1;
			for (const light of casting) {
				shadowMaps += (light as { isPointLight?: boolean }).isPointLight === true ? 6 : 1;
			}
		}
		originalShadowRender.call(shadowMap, lights, scene, camera);
	};

	// The managed renderer replaces `renderer.render` with its ordinary frame
	// function after the first frame that discovers the shared physical-lighting
	// lookup. A one-time wrap would be dropped on exactly the Worlds with a
	// standard material, so the probe re-asserts itself at each frame boundary.
	let renderTarget = renderer.render;
	const countedRender = function countedRender(scene: Object3D, camera: Camera): void {
		const time = performance.now();
		const passesBefore = shadowPasses;
		const mapsBefore = shadowMaps;
		renderTarget.call(renderer, scene, camera);
		samples.push({
			time,
			frame: renderer.info.render.frame,
			calls: renderer.info.render.calls,
			triangles: renderer.info.render.triangles,
			textures: renderer.info.memory.textures,
			programs: renderer.info.programs?.length ?? 0,
			shadowPasses: shadowPasses - passesBefore,
			shadowMaps: shadowMaps - mapsBefore
		});
		// Re-assert before the loop's next frame: the managed renderer may have
		// replaced the property during this very call.
		if (renderer.render !== countedRender) {
			renderTarget = renderer.render;
			renderer.render = countedRender;
		}
	};
	renderer.render = countedRender;

	let supervising = true;
	let supervisor = 0;
	const ensureWrapped = (): void => {
		if (!supervising) return;
		if (renderer.render !== countedRender) {
			renderTarget = renderer.render;
			renderer.render = countedRender;
		}
		supervisor = requestAnimationFrame(ensureWrapped);
	};
	supervisor = requestAnimationFrame(ensureWrapped);

	installed = {
		surface,
		renderer,
		restore() {
			supervising = false;
			cancelAnimationFrame(supervisor);
			renderer.render = renderTarget;
			renderer.shadowMap.render = originalShadowRender;
		}
	};
}

/** Clear the samples but keep the renderer observation installed. */
export function resetProbe(): void {
	samples = [];
}

/** Whether a renderer is currently observed. */
export function probeSurface(): ProbeSurface | null {
	return installed?.surface ?? null;
}

/** Bench-only diagnostics: which renderer is observed and how many were registered. */
export function probeDebug(): {
	surface: ProbeSurface | null;
	registrations: number;
	samples: number;
	renderFrame: number | null;
	renderName: string | null;
} {
	const renderer = installed?.renderer;
	return {
		surface: probeSurface(),
		registrations,
		samples: samples.length,
		renderFrame: renderer?.info.render.frame ?? null,
		renderName: renderer?.render.name ?? null
	};
}

/** Read the samples collected since the last reset. */
export function readProbe(): ProbeRead {
	return { surface: probeSurface(), samples: [...samples] };
}

/**
 * Pin the renderer's pixel ratio for the bench. The Stage Canvas ships a
 * `[1, 1.5]` range; E7 requires DPR 1 on every surface, so the bench pins the
 * already-created renderer rather than changing the shipped Canvas.
 */
export function pinDevicePixelRatio(ratio: number): void {
	const renderer = installed?.renderer;
	if (renderer === undefined) return;
	renderer.setPixelRatio(ratio);
}

/** Forget the observed renderer (called when a bench surface unmounts). */
export function releaseProbe(): void {
	installed?.restore();
	installed = null;
	samples = [];
}
