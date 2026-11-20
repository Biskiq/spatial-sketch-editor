/**
 * T1.P02.S06 D.6 (H9) — shadow-map invalidation on r187's per-light contract.
 *
 * The H9 obligation is a count, not a duration: during a fixed orbit (a camera
 * move, which no shadow map depends on) a settled Stage must render **zero**
 * shadow passes, and exactly one per affected shadow map after a trigger. r187's
 * node renderer reads each light's own `shadow.autoUpdate` / `shadow.needsUpdate`
 * (`ShadowNode.updateBefore`), so the fakes below copy that contract: a render
 * consumes a map only while the light is always-updating or dirty, and the render
 * clears the dirty flag.
 */
import { describe, expect, it, vi } from 'vitest';

import {
	createShadowInvalidation,
	type ShadowObjectLike,
	type ShadowRendererLike,
	type ShadowSceneLike
} from '$lib/render/shadow-invalidation';

type FakeLight = ShadowObjectLike & {
	readonly isLight: true;
	castShadow: boolean;
	isDirectionalLight?: boolean;
	isPointLight?: boolean;
	shadow: { autoUpdate: boolean; needsUpdate: boolean };
};

function light(
	flags: { castShadow?: boolean; isDirectionalLight?: boolean; isPointLight?: boolean } = {}
): FakeLight {
	return {
		isLight: true,
		castShadow: true,
		shadow: { autoUpdate: true, needsUpdate: false },
		...flags
	};
}

/**
 * A scene of lights and a renderer whose render consumes exactly what three's
 * `ShadowNode` would: an always-updating light, or one asked for an update, and
 * then clears the request.
 */
function fakeStage(lights: readonly FakeLight[]) {
	const scene: ShadowSceneLike = {
		traverse(callback) {
			for (const entry of lights) callback(entry);
		}
	};
	const state = { renders: 0, shadowRenders: 0 };
	const renderer: ShadowRendererLike = {
		render() {
			state.renders += 1;
			let consumed = 0;
			for (const entry of lights) {
				if (!entry.castShadow) continue;
				if (!entry.shadow.autoUpdate && !entry.shadow.needsUpdate) continue;
				entry.shadow.needsUpdate = false;
				consumed += 1;
			}
			if (consumed > 0) state.shadowRenders += 1;
		}
	};
	const frame = (): void => {
		renderer.render({}, {});
	};
	return { scene, renderer, state, frame };
}

describe('T1.P02.S06 H9 — shadow invalidation', () => {
	it('renders once on mount and nothing during a fixed orbit', () => {
		const { scene, renderer, state, frame } = fakeStage([light()]);
		const controller = createShadowInvalidation({ renderer, scene });
		// Owning the decision means autoUpdate is off and the first frame is asked
		// for explicitly, so the maps are correct before anything renders.
		expect(controller.stats()).toEqual({ passes: 0, maps: 0, invalidations: 0 });

		frame();
		expect(controller.stats().passes).toBe(1);
		expect(controller.stats().maps).toBe(1);
		expect(state.shadowRenders).toBe(1);
		// 60 orbit frames: the camera moved, no shadow map input did.
		for (let index = 0; index < 60; index += 1) frame();
		expect(controller.stats().passes).toBe(1);
		expect(state.shadowRenders).toBe(1);

		controller.dispose();
	});

	it('renders only the shared directional map after a Sky direction change', () => {
		const sun = light({ isDirectionalLight: true });
		const ambient = light();
		const point = light({ isPointLight: true });
		const { renderer, frame } = fakeStage([sun, ambient, point]);
		const controller = createShadowInvalidation({ renderer, scene: { traverse: (cb) => [sun, ambient, point].forEach(cb) } });
		frame();
		expect(controller.stats().maps).toBe(8);
		controller.invalidateSun();
		controller.invalidateSun();
		frame();
		// The Sun's map only; the Scene light and the point cube stay as they were.
		expect(controller.stats().maps).toBe(9);
		controller.invalidateSun();
		controller.invalidate();
		frame();
		expect(controller.stats().maps).toBe(17);
	});

	it('coalesces triggers into one pass and counts one map per casting light', () => {
		const lights = [light(), light({ castShadow: false }), light()];
		const { scene, renderer, frame } = fakeStage(lights);
		const controller = createShadowInvalidation({ renderer, scene });
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

	it('renders again when the lazy form renderer reports its mesh mounted', () => {
		const { scene, renderer, frame } = fakeStage([light()]);
		const controller = createShadowInvalidation({ renderer, scene });
		frame(); // Initial Stage scene, before a form exists.

		controller.invalidate(); // The Scene now contains a form; the lazy chunk is still pending.
		frame();
		expect(controller.stats().passes).toBe(2);

		// VisitorEntityGroups reports this only after the renderer component's
		// Threlte mesh has mounted. That later installation needs its own shadow pass.
		controller.invalidate();
		frame();
		expect(controller.stats().passes).toBe(3);
		frame();
		expect(controller.stats().passes).toBe(3);

		controller.dispose();
	});

	it('asks its scheduler for a frame when a dependency changes', () => {
		const { scene, renderer } = fakeStage([light()]);
		const requestFrame = vi.fn();
		const controller = createShadowInvalidation({ renderer, scene, requestFrame });
		requestFrame.mockClear();
		controller.invalidate();
		expect(requestFrame).toHaveBeenCalledTimes(1);
		controller.dispose();
	});

	it('keeps per-frame updates for an animated caster', () => {
		const { scene, renderer, frame } = fakeStage([light()]);
		const controller = createShadowInvalidation({ renderer, scene, alwaysUpdate: true });
		for (let index = 0; index < 5; index += 1) frame();
		expect(controller.stats().passes).toBe(5);
		// A trigger is meaningless when every frame already updates.
		controller.invalidate();
		expect(controller.stats().invalidations).toBe(0);
		controller.dispose();
	});

	it('configures a late-arriving light before it can render a per-frame map', () => {
		const lights: FakeLight[] = [];
		const scene: ShadowSceneLike = { traverse: (cb) => lights.forEach(cb) };
		const renderer: ShadowRendererLike = { render() {} };
		const controller = createShadowInvalidation({ renderer, scene });
		const late = light();
		late.shadow.autoUpdate = true;
		lights.push(late);
		// The traversal configures the new light for render-on-change and its first
		// map is still owed; without that it would render every frame from now on.
		controller.invalidate();
		expect(late.shadow.autoUpdate).toBe(false);
		expect(late.shadow.needsUpdate).toBe(true);
		// A Sun-only trigger leaves a non-directional light alone.
		late.shadow.needsUpdate = false;
		controller.invalidateSun();
		expect(late.shadow.needsUpdate).toBe(false);
		controller.dispose();
	});

	it('counts six shadow maps for a point light and none for a pass without casting lights', () => {
		const point = fakeStage([light({ isPointLight: true })]);
		const controller = createShadowInvalidation({ renderer: point.renderer, scene: point.scene });
		point.frame();
		expect(controller.stats()).toEqual({ passes: 1, maps: 6, invalidations: 0 });
		controller.dispose();

		// No casting light: three renders nothing, so the oracle must read nothing.
		const unlit = fakeStage([light({ castShadow: false })]);
		const idle = createShadowInvalidation({ renderer: unlit.renderer, scene: unlit.scene });
		unlit.frame();
		expect(idle.stats()).toEqual({ passes: 0, maps: 0, invalidations: 0 });
		idle.dispose();
	});

	it('switches between render-on-change and per-frame updates on one renderer', () => {
		const { scene, renderer, frame } = fakeStage([light()]);
		const controller = createShadowInvalidation({ renderer, scene });
		frame();
		expect(controller.stats().passes).toBe(1);

		// A model entity arrives in the resolved Scene: its meshes are added after
		// its URL resolves, so every frame updates until it settles.
		controller.setAlwaysUpdate(true);
		frame();
		frame();
		expect(controller.stats().passes).toBe(3);

		controller.setAlwaysUpdate(false);
		// Leaving per-frame mode renders once, so the last per-frame map is not
		// left standing, and then settles.
		frame();
		frame();
		frame();
		expect(controller.stats().passes).toBe(4);

		controller.dispose();
	});

	it('restores the renderer and Three’s own default when disposed', () => {
		const { scene, renderer } = fakeStage([light()]);
		const original = renderer.render;
		const controller = createShadowInvalidation({ renderer, scene });
		expect(renderer.render).not.toBe(original);
		controller.dispose();
		expect(renderer.render).toBe(original);
		controller.dispose();
		expect(renderer.render).toBe(original);
	});
});
