import { createSkyHost } from './sky/sky-host.svelte';

export type SkyDependencies = Parameters<typeof createSkyHost>[0];

export function createSkyFeature(deps: SkyDependencies) {
	const sky = createSkyHost(deps);
	return {
		id: 'sky' as const,
		regions: { canvas: sky.canvas, overlay: sky.overlay, panels: sky.panels },
		escapeRungs: { sky: sky.dismiss },
		ports: {
			groundReachMeters: sky.groundReachMeters,
			cardStratum: sky.cardStratum,
			pickMaterial: sky.pickMaterial,
			pickLibraryEntry: sky.pickLibraryEntry,
			setStudioWhileEditing: sky.setStudioWhileEditing,
		},
		get sky() {
			return sky.sky;
		},
		get libraryShelf() {
			return sky.libraryShelf;
		},
		get studioWhileEditing() {
			return sky.studioWhileEditing;
		},
	};
}
