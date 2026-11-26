/**
 * Per-light shadow-map invalidation for r187's common renderer.
 *
 * The native `WebGLShadowMap` this replaced exposed a frame-global `autoUpdate`
 * and a `render()` the Stage could wrap. r187's node renderer instead reads each
 * leased light's own `LightShadow.autoUpdate` / `needsUpdate` (see
 * `ShadowNode.updateBefore`): the light is either updated every frame or only
 * when something asks. This module owns that decision for the Stage:
 *
 * - a **caster's geometry, Scene or approved model bytes**: the retained
 *   Wall/object rebuild, a Scene placement added, moved or removed. The wiring
 *   watches the compiled `geometry`, the resolved `scene` and `modelUrls`;
 * - a **caster's or receiver's transform, visibility or flags, or a
 *   depth-affecting material change**: the same identities;
 * - a **Scene light** added, removed or changed: `scene` identity again. A light
 *   that arrives late is configured on the next traversal, so it never renders a
 *   per-frame map;
 * - a **Sun/Moon shadow camera** change: re-render the directional maps alone;
 * - a **model arrival, release or drawn-state change**: the Canvas's caster
 *   channel reports it;
 * - an **animation that is playing**: a moving caster needs a fresh map every
 *   frame. The owner renders per frame only while the channel counts a playing
 *   action, and returns to render-on-change when the last one stops;
 * - **renderer lifecycle**: a fresh generation starts fully invalidated, so its
 *   first shadowed frame is correct.
 *
 * What is deliberately *not* a trigger: the camera. A shadow map is rendered from
 * the light's shadow camera, so orbiting the view changes no shadow texel.
 *
 * ## Counting
 *
 * `stats()` reports **actual submissions**, not requests. r187's `ShadowNode`
 * renders a due map by calling `renderer.render(scene, shadow.camera)` from
 * `renderShadow`, *inside* the outer scene render. A point light's cube is six
 * such calls, one per face. The counter therefore counts only nested calls whose
 * scene and camera are the ones `ShadowNode` submits, and never the enclosing
 * frame: `passes` is one per light per outer frame (the six point faces coalesce
 * into one pass), while `maps` is one per actual face submission. The old
 * outer-call check counted the first nested call and then the outer call again,
 * so a lost device's counter could overcount.
 *
 * The wrapper still configures and invalidates the lights a scheduler frame
 * needs; it just no longer infers a submission from a dirty flag. A frame with
 * no dirty map cannot count, and a request that is coalesced or skipped cannot
 * overcount.
 *
 * The module is framework-free on purpose: the unit test drives fake lights and a
 * fake renderer.
 */

import { countWork } from '@portfolio/layout-core/kernel';

/** The per-light shadow state r187's ShadowNode reads and clears. */
export type ShadowStateLike = {
	autoUpdate: boolean;
	needsUpdate: boolean;
	/** The camera `ShadowNode.renderShadow` passes to the renderer. */
	readonly camera?: unknown;
};

/** The slice of an object this module inspects while walking the scene. */
export type ShadowObjectLike = {
	readonly isLight?: boolean;
	readonly castShadow?: boolean;
	readonly isPointLight?: boolean;
	readonly isDirectionalLight?: boolean;
	readonly shadow?: ShadowStateLike;
};

/** The slice of a Scene this module needs. */
export type ShadowSceneLike = {
	traverse(callback: (object: ShadowObjectLike) => void): void;
};

/** The slice of the renderer this module wraps and counts. */
export type ShadowRendererLike = {
	render(scene: unknown, camera: unknown): unknown;
};

export type ShadowInvalidationStats = {
	/** Shadow passes observed: one per due light per outer scene render. */
	readonly passes: number;
	/** Shadow map faces submitted: one per nested call, six for a point light. */
	readonly maps: number;
	/** Times a caller reported a dependency change. */
	readonly invalidations: number;
};

export type ShadowInvalidationOptions = {
	/** The **real** renderer (not the ready-gated facade); its render is observed. */
	renderer: ShadowRendererLike;
	/** The scene whose shadow-casting lights this controller owns. */
	scene: ShadowSceneLike;
	/** Ask the renderer's scheduler for one frame; omit in a headless consumer. */
	requestFrame?: () => void;
	/**
	 * Keep today's per-frame shadow updates from the start. Correct for an animated
	 * caster and for any surface whose exact invalidation has not been established.
	 */
	alwaysUpdate?: boolean;
};

export type ShadowInvalidation = {
	/** Report that something a shadow map depends on changed. Coalesces per frame. */
	invalidate(): void;
	/** Re-render only the directional maps (the Sun/Moon lease). */
	invalidateSun(): void;
	/**
	 * Switch between "render on change" and per-frame updates. Switching back
	 * re-renders once, because the last frame under per-frame updates is not
	 * necessarily the current one.
	 */
	setAlwaysUpdate(alwaysUpdate: boolean): void;
	/** The count oracle's read: never a duration. */
	stats(): ShadowInvalidationStats;
	/** Restore Three's default behaviour and stop observing. Idempotent. */
	dispose(): void;
};

function isCasting(light: ShadowObjectLike): boolean {
	return light.isLight === true && light.castShadow === true && light.shadow !== undefined;
}

export function createShadowInvalidation(options: ShadowInvalidationOptions): ShadowInvalidation {
	const { renderer, scene, requestFrame } = options;
	const originalRender = renderer.render;
	let alwaysUpdate = options.alwaysUpdate ?? false;
	let passes = 0;
	let maps = 0;
	let invalidations = 0;
	/** Lights whose first face was seen in the current outer render. */
	let submitted = new Set<ShadowObjectLike>();
	let disposed = false;

	/** Every casting light currently in the scene, configured for our policy. */
	function castingLights(): ShadowObjectLike[] {
		const lights: ShadowObjectLike[] = [];
		scene.traverse((object) => {
			if (!isCasting(object)) return;
			const shadow = object.shadow!;
			// A late arrival must never render a per-frame map before its first
			// invalidation; configure it here, on every traversal.
			shadow.autoUpdate = alwaysUpdate;
			lights.push(object);
		});
		return lights;
	}

	function markDirty(select: (light: ShadowObjectLike) => boolean): void {
		for (const light of castingLights()) {
			if (select(light)) light.shadow!.needsUpdate = true;
		}
	}

	renderer.render = function counted(sceneRef: unknown, camera: unknown): unknown {
		const lights = castingLights();
		// This is the exact call `ShadowNode.renderShadow` makes (r187,
		// `src/nodes/lighting/ShadowNode.js`): the same scene and the light's own
		// shadow camera, nested inside the scene render. Only that submission is a
		// shadow pass; the enclosing render is not a second one.
		const submitting =
			sceneRef === scene
				? lights.find(
						(light) => light.shadow!.camera !== undefined && light.shadow!.camera === camera,
					)
				: undefined;
		// The enclosing render begins a new batch. r187's point cube submits six
		// faces through this same camera before the outer render returns; the
		// first face is the pass, and every call is one map face.
		if (submitting === undefined) submitted = new Set();
		const result = originalRender.call(renderer, sceneRef, camera);
		if (submitting !== undefined) {
			if (!submitted.has(submitting)) {
				submitted.add(submitting);
				passes += 1;
				// The work counter mirrors `stats().passes`: one real shadow pass,
				// never the enclosing frame and never a request that rendered nothing.
				countWork('render:shadow-update');
			}
			maps += 1;
		}
		return result;
	};

	// The first frame must render every map once: a fresh generation has none.
	for (const light of castingLights()) light.shadow!.needsUpdate = true;

	const controller: ShadowInvalidation = {
		invalidateSun() {
			if (disposed || alwaysUpdate) return;
			invalidations += 1;
			markDirty((light) => light.isDirectionalLight === true);
			requestFrame?.();
		},
		invalidate() {
			if (disposed || alwaysUpdate) return;
			invalidations += 1;
			markDirty(() => true);
			requestFrame?.();
		},
		setAlwaysUpdate(next) {
			if (disposed || next === alwaysUpdate) return;
			alwaysUpdate = next;
			for (const light of castingLights()) {
				light.shadow!.autoUpdate = next;
				light.shadow!.needsUpdate = true;
			}
			requestFrame?.();
		},
		stats: () => ({ passes, maps, invalidations }),
		dispose() {
			if (disposed) return;
			disposed = true;
			renderer.render = originalRender;
			for (const light of castingLights()) light.shadow!.autoUpdate = true;
		},
	};

	return controller;
}
