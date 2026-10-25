/**
 * Shadow-map invalidation (T1.P02.S06 D.6 / H9).
 *
 * three's `WebGLShadowMap` defaults to `autoUpdate = true`, so **every rendered
 * frame** re-renders every shadow map — including every orbit frame, although the
 * Stage's lights and their shadow cameras are fixed in world space and its
 * casters are static between edits. Bench 1 counted that as one extra pass over
 * every caster per orbit frame (F7's CPU-per-frame row at L: 7.0 ms).
 *
 * This module owns that decision instead: the Stage keeps `autoUpdate = false`
 * and re-renders a shadow map only when something a shadow map actually depends
 * on changed. The trigger contract is the plan's (D.6), and every arm of it has a
 * caller:
 *
 * - a **caster's geometry** — the retained Wall representation's rebuild, a
 *   Scene placement added, moved or removed, an imported model's arrival or
 *   disposal, a ghost that casts: `SceneShadowTriggers.svelte` watches the
 *   `geometry`, `scene` and `modelUrls` identities, which is exactly what
 *   changes when any of those happen (Undo/Redo, replacement and reads included,
 *   because they all install a new compiled geometry or Scene);
 * - a **caster's or receiver's transform, visibility or flags, or a
 *   depth-affecting material change** — the same identity watches: every mesh
 *   the Stage draws is derived from `geometry` or `scene`;
 * - a **Scene light** added, removed or changed — `scene` identity again;
 * - an **animated caster** — `alwaysUpdate` keeps today's per-frame behaviour for
 *   that surface; the Stage has none, and setting it is the honest fallback when
 *   an exact trigger cannot be established;
 * - **renderer lifecycle** — a fresh renderer starts invalidated, and a restored
 *   WebGL context invalidates, because the maps were lost with the context.
 *
 * What is deliberately *not* a trigger: the camera. A shadow map is rendered from
 * the light's shadow camera, so orbiting the view changes no shadow texel. That
 * is the whole saving.
 *
 * The module is framework-free and renderer-agnostic on purpose: a `WebGLRenderer`
 * satisfies {@link ShadowMapLike}, and the unit test drives a fake one.
 */

/** The slice of `THREE.WebGLShadowMap` this module needs. */
export type ShadowMapLike = {
	autoUpdate: boolean;
	needsUpdate: boolean;
	render(lights: readonly ShadowCasterLight[], scene: unknown, camera: unknown): void;
};

/** The slice of a light this module needs, for counting. */
export type ShadowCasterLight = { readonly castShadow?: boolean };

export type ShadowInvalidationStats = {
	/** Shadow passes that actually rendered (not the no-op calls three skips). */
	readonly passes: number;
	/** Shadow maps rendered: one per casting light per pass. */
	readonly maps: number;
	/** Times a caller reported a dependency change. */
	readonly invalidations: number;
};

export type ShadowInvalidationOptions = {
	shadowMap: ShadowMapLike;
	/** Ask the renderer's scheduler for one frame; omit in a headless consumer. */
	requestFrame?: () => void;
	/** The canvas, so a restored WebGL context re-renders the maps it lost. */
	canvas?: EventTarget | null;
	/**
	 * Keep today's per-frame shadow updates. Correct for an animated caster and
	 * for any surface whose exact invalidation has not been established.
	 */
	alwaysUpdate?: boolean;
};

export type ShadowInvalidation = {
	/** Report that something a shadow map depends on changed. Coalesces per frame. */
	invalidate(): void;
	/** The count oracle's read: never a duration. */
	stats(): ShadowInvalidationStats;
	/** Restore the renderer's default behaviour and stop observing. Idempotent. */
	dispose(): void;
};

export function createShadowInvalidation(options: ShadowInvalidationOptions): ShadowInvalidation {
	const { shadowMap, requestFrame, canvas = null, alwaysUpdate = false } = options;
	const originalRender = shadowMap.render;
	const originalAutoUpdate = shadowMap.autoUpdate;
	let passes = 0;
	let maps = 0;
	let invalidations = 0;
	let disposed = false;

	// three skips the whole pass when `autoUpdate` is off and nothing asked for
	// an update, but the call itself still happens. Count only a pass that
	// actually renders, which is what the H9 oracle means by "shadow-map renders
	// during a fixed orbit = 0".
	shadowMap.render = function counted(lights, scene, camera): void {
		if (shadowMap.autoUpdate || shadowMap.needsUpdate) {
			passes += 1;
			for (const light of lights) if (light.castShadow) maps += 1;
		}
		originalRender.call(shadowMap, lights, scene, camera);
	};

	shadowMap.autoUpdate = alwaysUpdate;
	// The first frame must render the maps once, whether or not anyone reports a
	// change first.
	shadowMap.needsUpdate = true;

	const restored = (): void => {
		// The context's textures and shadow maps are gone; every map must render
		// again before the image is correct.
		shadowMap.needsUpdate = true;
		requestFrame?.();
	};
	canvas?.addEventListener('webglcontextrestored', restored);

	return {
		invalidate() {
			if (disposed || alwaysUpdate) return;
			invalidations += 1;
			shadowMap.needsUpdate = true;
			requestFrame?.();
		},
		stats: () => ({ passes, maps, invalidations }),
		dispose() {
			if (disposed) return;
			disposed = true;
			canvas?.removeEventListener('webglcontextrestored', restored);
			shadowMap.render = originalRender;
			shadowMap.autoUpdate = originalAutoUpdate;
		}
	};
}
