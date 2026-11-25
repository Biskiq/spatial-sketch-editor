/**
 * E8/G4 measurement input: the values `StageShadowTriggers` reads, plus the Canvas
 * resources the probe provides. A test changes them to model a Scene edit, a
 * model arrival or a camera-only frame.
 */
import type { CompiledLayoutGeometry } from '@portfolio/layout-core/geometry';
import type { RuntimeScene } from '@portfolio/project-model/scene';
import type { RenderResources } from '$lib/render/resources/render-resources';

export type ShadowProbeInput = {
	geometry: CompiledLayoutGeometry;
	scene: RuntimeScene;
	modelUrls: ReadonlyMap<string, string> | null;
	formRenderRevision: number;
	/** Bumped to rebuild the spread props with unchanged values. */
	rebuild: number;
};

export const probeInput = $state<ShadowProbeInput>({
	geometry: {} as CompiledLayoutGeometry,
	scene: { entities: [] } as unknown as RuntimeScene,
	modelUrls: null,
	formRenderRevision: 0,
	rebuild: 0
});

/** Non-reactive handle the probe fills with the resources it provides. */
export const probeHandles: { resources: RenderResources | null } = { resources: null };
