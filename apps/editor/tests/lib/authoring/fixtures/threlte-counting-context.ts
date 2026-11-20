/**
 * The doubled Canvas boundary for the mounted Stage-shell counting tests.
 *
 * `@threlte/core` is mocked to this module in `stage-counting.test.ts`. The
 * components under test are the real StagePaper and StageShadowTriggers; only
 * the Canvas, its renderer and its scheduling are replaced. The renderer here is
 * an ordinary object with a `render` method: the production invalidation
 * controller wraps exactly that method, and the test calls it to issue one frame.
 */
import { DirectionalLight, Scene } from 'three';

export type CountingRenderer = {
	readonly domElement: null;
	render(scene: unknown, camera: unknown): void;
};

const renders: unknown[][] = [];
const invalidations: number[] = [];

export const countingScene = new Scene();
/** The one casting light the invalidation controller owns in these tests. */
export const countingLight = new DirectionalLight();
countingLight.castShadow = true;
countingScene.add(countingLight);

export const countingRenderer: CountingRenderer = {
	domElement: null,
	render(scene, camera) {
		renders.push([scene, camera]);
		// r187's ShadowNode clears the request it consumed.
		countingLight.shadow.needsUpdate = false;
	}
};

let invalidateCount = 0;

export const threlteProbe = {
	renders,
	invalidations,
	get invalidationCount(): number {
		return invalidateCount;
	},
	reset(): void {
		renders.length = 0;
		invalidations.length = 0;
		invalidateCount = 0;
		countingLight.shadow.autoUpdate = true;
		countingLight.shadow.needsUpdate = false;
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
