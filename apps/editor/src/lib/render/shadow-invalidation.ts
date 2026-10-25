/**
 * Shadow-map invalidation (T1.P02.S06 D.6 / H9).
 *
 * three's `WebGLShadowMap` defaults to `autoUpdate = true`, so **every rendered
 * frame** re-renders every shadow map — including every orbit frame, although the
 * Stage's lights and their shadow cameras are fixed in world space and its
 * casters are static between edits. Bench 1 records the Stage's CPU time inside
 * `render()` per frame (F7: 7.0 ms at L) without attributing a share to the shadow
 * pass; the claim here is the count, not a duration.
 *
 * This module owns that decision instead: the Stage keeps `autoUpdate = false`
 * and re-renders a shadow map only when something a shadow map actually depends
 * on changed. The trigger contract is the plan's (D.6):
 *
 * - a **caster's geometry** — the retained Wall/object representation's rebuild, a
 *   Scene placement added, moved or removed, an imported model's arrival or
 *   disposal, a ghost that casts: the wiring watches the compiled `geometry`, the
 *   resolved `scene`, the Room registry and `modelUrls`, which is exactly what
 *   changes when any of those happen (Undo/Redo, replacement and reads included,
 *   because they all install a new compiled geometry or Scene);
 * - a **caster's or receiver's transform, visibility or flags, or a
 *   depth-affecting material change** — the same identities: every mesh the Stage
 *   draws is derived from `geometry`, `scene` or `rooms`;
 * - a **Scene light** added, removed or changed — `scene` identity again;
 * - an **animated caster, or a caster whose arrival is asynchronous and therefore
 *   not observable at this boundary** (a resolved creator model parses after its
 *   URL arrives) — {@link ShadowInvalidation.setAlwaysUpdate} keeps today's
 *   per-frame behaviour for that surface. The wiring turns it on whenever the
 *   resolved Scene carries a model entity, which is the plan's rule that a
 *   trigger whose exact invalidation cannot be established keeps the per-frame
 *   update;
 * - **renderer lifecycle** — a fresh controller starts invalidated, and a restored
 *   WebGL context invalidates, because the maps were lost with the context. A
 *   recreated renderer is a new mount and therefore a new controller.
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
export type ShadowCasterLight = { readonly castShadow?: boolean; readonly isPointLight?: boolean };

export type ShadowInvalidationStats = {
	/** Shadow passes that actually rendered (not the no-op calls three skips). */
	readonly passes: number;
	/**
	 * Shadow maps rendered: one per casting light per pass, and six for a point
	 * light (a cube shadow renders one face per axis).
	 */
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
	 * Keep today's per-frame shadow updates from the start. Correct for an animated
	 * caster and for any surface whose exact invalidation has not been established.
	 */
	alwaysUpdate?: boolean;
};

export type ShadowInvalidation = {
	/** Report that something a shadow map depends on changed. Coalesces per frame. */
	invalidate(): void;
	/**
	 * Switch between "render on change" and today's per-frame updates. Switching
	 * back re-renders once, because the last frame under per-frame updates is not
	 * necessarily the current one.
	 */
	setAlwaysUpdate(alwaysUpdate: boolean): void;
	/** The count oracle's read: never a duration. */
	stats(): ShadowInvalidationStats;
	/** Restore the renderer's default behaviour and stop observing. Idempotent. */
	dispose(): void;
};

/** Shadow maps a controller already owns, so two mounts cannot fight over one. */
const owners = new WeakMap<ShadowMapLike, { controller: ShadowInvalidation; mounts: number }>();

export function createShadowInvalidation(options: ShadowInvalidationOptions): ShadowInvalidation {
	const existing = owners.get(options.shadowMap);
	if (existing) {
		// A second mount shares the one controller: a second wrapper would count
		// every pass twice, and either `dispose` would silently restore the
		// other's per-frame behaviour.
		existing.mounts += 1;
		return existing.controller;
	}

	const { shadowMap, requestFrame, canvas = null } = options;
	const originalRender = shadowMap.render;
	const originalAutoUpdate = shadowMap.autoUpdate;
	let alwaysUpdate = options.alwaysUpdate ?? false;
	let passes = 0;
	let maps = 0;
	let invalidations = 0;
	let disposed = false;

	// three skips the whole pass when `autoUpdate` is off and nothing asked for
	// an update, but the call itself still happens. Count only a pass that
	// actually renders, which is what the H9 oracle means by "shadow-map renders
	// during a fixed orbit = 0".
	shadowMap.render = function counted(lights, scene, camera): void {
		const casting = shadowMap.autoUpdate || shadowMap.needsUpdate ? lights.filter((light) => light.castShadow) : [];
		if (casting.length > 0) {
			passes += 1;
			for (const light of casting) maps += light.isPointLight ? 6 : 1;
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

	const controller: ShadowInvalidation = {
		invalidate() {
			if (disposed || alwaysUpdate) return;
			invalidations += 1;
			shadowMap.needsUpdate = true;
			requestFrame?.();
		},
		setAlwaysUpdate(next) {
			if (disposed || next === alwaysUpdate) return;
			alwaysUpdate = next;
			shadowMap.autoUpdate = next;
			// One render after either switch: leaving per-frame mode must not leave
			// the map from the last frame, and entering it does no harm.
			shadowMap.needsUpdate = true;
			requestFrame?.();
		},
		stats: () => ({ passes, maps, invalidations }),
		dispose() {
			const owner = owners.get(shadowMap);
			if (owner) {
				owner.mounts -= 1;
				if (owner.mounts > 0) return;
				owners.delete(shadowMap);
			}
			if (disposed) return;
			disposed = true;
			canvas?.removeEventListener('webglcontextrestored', restored);
			shadowMap.render = originalRender;
			shadowMap.autoUpdate = originalAutoUpdate;
		}
	};

	owners.set(shadowMap, { controller, mounts: 1 });
	return controller;
}
