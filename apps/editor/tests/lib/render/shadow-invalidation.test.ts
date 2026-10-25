/**
 * T1.P02.S06 D.6 (H9) — shadow-map invalidation.
 *
 * The H9 obligation is a count, not a duration: during a fixed orbit (a camera
 * move, which no shadow map depends on) a settled Stage must render **zero**
 * shadow passes, and exactly one per affected shadow map after a trigger. The
 * fake shadow map below copies three's own contract: it returns immediately while
 * `autoUpdate` is false and nothing asked for an update, and it clears
 * `needsUpdate` after it renders.
 */
import { describe, expect, it, vi } from 'vitest';

import {
	createShadowInvalidation,
	type ShadowCasterLight,
	type ShadowMapLike
} from '$lib/render/shadow-invalidation';

function fakeShadowMap(lights: ShadowCasterLight[] = [{ castShadow: true }]) {
	const state = {
		renders: 0,
		shadowMap: {
			autoUpdate: true,
			needsUpdate: false,
			enabled: true,
			render() {
				if (!state.shadowMap.enabled) return;
				if (!state.shadowMap.autoUpdate && !state.shadowMap.needsUpdate) return;
				state.shadowMap.needsUpdate = false;
				state.renders += 1;
			}
		} satisfies ShadowMapLike as ShadowMapLike
	};
	/** one ordinary frame, the way `WebGLRenderer.render` drives the shadow map */
	const frame = (): void => state.shadowMap.render(lights, {}, {});
	return { state, frame, lights };
}

describe('T1.P02.S06 H9 — shadow invalidation', () => {
	it('renders once on mount and nothing during a fixed orbit', () => {
		const { frame, state } = fakeShadowMap();
		const controller = createShadowInvalidation({ shadowMap: state.shadowMap });
		// Owning the decision means autoUpdate is off and the first frame is asked
		// for explicitly, so the maps are correct before anything renders.
		expect(state.shadowMap.autoUpdate).toBe(false);
		expect(state.shadowMap.needsUpdate).toBe(true);

		frame();
		expect(controller.stats().passes).toBe(1);
		expect(controller.stats().maps).toBe(1);
		// 60 orbit frames: the camera moved, no shadow map input did.
		for (let index = 0; index < 60; index += 1) frame();
		expect(controller.stats().passes).toBe(1);
		expect(state.renders).toBe(1);

		controller.dispose();
	});

	it('coalesces triggers into one pass and counts one map per casting light', () => {
		const lights: ShadowCasterLight[] = [{ castShadow: true }, { castShadow: false }, { castShadow: true }];
		const { frame, state } = fakeShadowMap(lights);
		const controller = createShadowInvalidation({ shadowMap: state.shadowMap });
		frame();
		expect(controller.stats()).toEqual({ passes: 1, maps: 2, invalidations: 0 });

		// Three triggers before the frame lands (geometry, scene and a model
		// arriving in the same task) are one pass, not three.
		controller.invalidate();
		controller.invalidate();
		controller.invalidate();
		expect(controller.stats().invalidations).toBe(3);
		frame();
		expect(controller.stats().passes).toBe(2);
		expect(controller.stats().maps).toBe(4);
		frame();
		expect(controller.stats().passes).toBe(2);

		controller.dispose();
	});

	it('asks its scheduler for a frame when a dependency changes', () => {
		const { state } = fakeShadowMap();
		const requestFrame = vi.fn();
		const controller = createShadowInvalidation({ shadowMap: state.shadowMap, requestFrame });
		requestFrame.mockClear();
		controller.invalidate();
		expect(requestFrame).toHaveBeenCalledTimes(1);
		controller.dispose();
	});

	it('keeps per-frame updates for an animated caster', () => {
		const { frame, state } = fakeShadowMap();
		const controller = createShadowInvalidation({ shadowMap: state.shadowMap, alwaysUpdate: true });
		expect(state.shadowMap.autoUpdate).toBe(true);
		for (let index = 0; index < 5; index += 1) frame();
		expect(controller.stats().passes).toBe(5);
		// A trigger is meaningless when every frame already updates.
		controller.invalidate();
		expect(controller.stats().invalidations).toBe(0);
		controller.dispose();
		expect(state.shadowMap.autoUpdate).toBe(true);
	});

	it('re-renders every map after the WebGL context is restored', () => {
		const { frame, state } = fakeShadowMap();
		const canvas = new EventTarget();
		const controller = createShadowInvalidation({ shadowMap: state.shadowMap, canvas });
		frame();
		frame();
		expect(controller.stats().passes).toBe(1);

		canvas.dispatchEvent(new Event('webglcontextrestored'));
		frame();
		expect(controller.stats().passes).toBe(2);

		controller.dispose();
		canvas.dispatchEvent(new Event('webglcontextrestored'));
		frame();
		// Disposed: the renderer's own default is back, so the frame updates
		// because `autoUpdate` is true again — not because the listener survived.
		expect(controller.stats().passes).toBe(2);
	});

	it('counts six shadow maps for a point light and none for a pass without casting lights', () => {
		const lights: ShadowCasterLight[] = [{ castShadow: true, isPointLight: true }];
		const point = fakeShadowMap(lights);
		const controller = createShadowInvalidation({ shadowMap: point.state.shadowMap });
		point.frame();
		expect(controller.stats()).toEqual({ passes: 1, maps: 6, invalidations: 0 });
		controller.dispose();

		// No casting light: three renders nothing, so the oracle must read nothing.
		const unlit = fakeShadowMap([{ castShadow: false }]);
		const idle = createShadowInvalidation({ shadowMap: unlit.state.shadowMap });
		unlit.frame();
		expect(idle.stats()).toEqual({ passes: 0, maps: 0, invalidations: 0 });
		idle.dispose();
	});

	it('counts nothing for a shadow map the renderer has disabled', () => {
		// `shadowMap.enabled = false` makes three render no map however the flags
		// stand, so a pass counted here would be a pass that never happened.
		const { frame, state } = fakeShadowMap();
		const controller = createShadowInvalidation({ shadowMap: state.shadowMap });
		state.shadowMap.enabled = false;
		controller.invalidate();
		frame();
		expect(controller.stats().passes).toBe(0);
		expect(state.renders).toBe(0);
		controller.dispose();
	});

	it('switches between render-on-change and per-frame updates on one renderer', () => {
		const { frame, state } = fakeShadowMap();
		const controller = createShadowInvalidation({ shadowMap: state.shadowMap });
		frame();
		expect(controller.stats().passes).toBe(1);

		// A model entity arrives in the resolved Scene: its meshes are added after
		// its URL resolves, so every frame updates until it settles.
		controller.setAlwaysUpdate(true);
		frame();
		frame();
		expect(controller.stats().passes).toBe(3);
		expect(state.shadowMap.autoUpdate).toBe(true);

		controller.setAlwaysUpdate(false);
		// Leaving per-frame mode renders once, so the last per-frame map is not
		// left standing, and then settles.
		frame();
		frame();
		frame();
		expect(controller.stats().passes).toBe(4);
		expect(state.shadowMap.autoUpdate).toBe(false);

		controller.dispose();
	});

	it('shares one controller between two mounts of the same renderer', () => {
		const { frame, state } = fakeShadowMap();
		const requestFrame = vi.fn();
		const first = createShadowInvalidation({ shadowMap: state.shadowMap, requestFrame });
		const second = createShadowInvalidation({ shadowMap: state.shadowMap, requestFrame });
		expect(second).toBe(first);
		frame();
		expect(first.stats().passes).toBe(1);

		// One mount leaving must not hand the renderer back to per-frame updates
		// while the other still owns the trigger set.
		second.dispose();
		expect(state.shadowMap.autoUpdate).toBe(false);
		first.invalidate();
		frame();
		expect(first.stats().passes).toBe(2);

		first.dispose();
		expect(state.shadowMap.autoUpdate).toBe(true);
	});

	it('restores the renderer on dispose exactly once', () => {
		const { frame, state } = fakeShadowMap();
		const controller = createShadowInvalidation({ shadowMap: state.shadowMap });
		const counted = state.shadowMap.render;
		controller.dispose();
		expect(state.shadowMap.autoUpdate).toBe(true);
		expect(state.shadowMap.render).not.toBe(counted);

		const before = controller.stats().passes;
		frame();
		expect(controller.stats().passes).toBe(before);
		controller.dispose();
		expect(state.shadowMap.autoUpdate).toBe(true);
	});
});
