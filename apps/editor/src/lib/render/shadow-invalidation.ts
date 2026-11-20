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
 * `stats()` reports **actual submissions**, not requests: a pass is counted only
 * when a rendering call consumed at least one dirty (or always-updating) casting
 * light, and each consumed light counts one map — six for a point light's cube.
 * The counter wraps the real renderer's `render`, so it sees the same calls the
 * scheduler makes and never counts a no-op frame.
 *
 * The module is framework-free on purpose: the unit test drives fake lights and a
 * fake renderer.
 */

import { countWork } from '@portfolio/layout-core';

/** The per-light shadow state r187's ShadowNode reads and clears. */
export type ShadowStateLike = {
	autoUpdate: boolean;
	needsUpdate: boolean;
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
	/** Rendering calls that consumed at least one shadow map. */
	readonly passes: number;
	/** Shadow maps rendered: one per consumed light, six for a point light. */
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
		const consumed = lights.filter((light) => light.shadow!.needsUpdate || alwaysUpdate);
		const result = originalRender.call(renderer, sceneRef, camera);
		if (consumed.length > 0) {
			passes += 1;
			// The work counter mirrors `stats().passes`: one rendering call that
			// actually consumed a map, never a call that had nothing dirty.
			countWork('render:shadow-update');
			for (const light of consumed) maps += light.isPointLight === true ? 6 : 1;
		}
		// r187 clears `needsUpdate` inside its own shadow pass; the assertion keeps
		// the counter honest if a future version stops doing that.
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
		}
	};

	return controller;
}
