/**
 * The doubled Canvas boundary for the mounted Stage-shell counting tests.
 *
 * `@threlte/core` is mocked to this module in `stage-counting.test.ts`. The
 * components under test are the real StagePaper and StageShadowTriggers; only
 * the Canvas, its renderer and its scheduling are replaced. The renderer's
 * `shadowMap` here is a fake `ShadowMapLike`: a shadow-map render that three
 * would issue is invoked explicitly by the test, so the production invalidation
 * wrapper is what counts it.
 */
import { Scene } from 'three';
import type { ShadowMapLike } from '$lib/render/shadow-invalidation';

export type CountingShadowMap = ShadowMapLike & {
	render(lights: readonly unknown[], scene: unknown, camera: unknown): void;
};

export type CountingRenderer = {
	readonly shadowMap: CountingShadowMap;
	readonly domElement: null;
};

const shadowRenders: unknown[][] = [];
const invalidations: number[] = [];

export const countingShadowMap: CountingShadowMap = {
	autoUpdate: true,
	needsUpdate: false,
	render(lights, scene, camera) {
		shadowRenders.push([lights, scene, camera]);
	}
};

export const countingRenderer: CountingRenderer = {
	shadowMap: countingShadowMap,
	domElement: null
};

export const countingScene = new Scene();
let invalidateCount = 0;

export const threlteProbe = {
	shadowRenders,
	invalidations,
	get invalidationCount(): number {
		return invalidateCount;
	},
	reset(): void {
		shadowRenders.length = 0;
		invalidations.length = 0;
		invalidateCount = 0;
		countingShadowMap.autoUpdate = true;
		countingShadowMap.needsUpdate = false;
	}
};

export function invalidate(): void {
	invalidateCount += 1;
}

/** `StagePaper` and `StageShadowTriggers` both read these three values. */
export function useThrelte() {
	return {
		scene: countingScene,
		camera: undefined,
		renderer: countingRenderer,
		invalidate
	};
}

/** `SceneInstanceMaterial` renders through a Threlte component; counting does not need it. */
export const T = new Proxy({}, { get: () => () => undefined });
