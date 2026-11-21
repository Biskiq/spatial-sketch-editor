import type { LookSource } from '$lib/render/materials/scene-finish';

/** A minimal Scene look source for the S8 resolver tests. */
export function lookSource(input: {
	readonly textures?: LookSource['textures'];
	readonly materials?: LookSource['materials'];
	readonly palette?: LookSource['palette'];
	readonly environment?: LookSource['environment'];
	readonly materialIndex?: LookSource['materialIndex'];
}): LookSource {
	return {
		textures: input.textures ?? [],
		materials: input.materials ?? [],
		palette: input.palette ?? [],
		environment: input.environment ?? {},
		...(input.materialIndex === undefined ? {} : { materialIndex: input.materialIndex })
	} as LookSource;
}
