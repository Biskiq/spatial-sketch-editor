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
			render() {
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
