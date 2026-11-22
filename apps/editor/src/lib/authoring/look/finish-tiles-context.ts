/** The Stage's Finish picture service, shared by the shelf and the Stage-mounted renderer. */
import { getContext, setContext } from 'svelte';
import { createFinishTiles, type FinishTiles } from '$lib/render/materials/finish-tiles.svelte';

export const FINISH_TILES_CONTEXT_KEY = Symbol('biskiq.finish-tiles');

/** Called once by the route that owns the Stage. */
export function provideFinishTiles(): FinishTiles {
	const tiles = createFinishTiles();
	setContext(FINISH_TILES_CONTEXT_KEY, tiles);
	return tiles;
}

/** The nearest service, or null where none is provided (a harness, a test). */
export function tryUseFinishTiles(): FinishTiles | null {
	try {
		return getContext<FinishTiles | undefined>(FINISH_TILES_CONTEXT_KEY) ?? null;
	} catch {
		return null;
	}
}
