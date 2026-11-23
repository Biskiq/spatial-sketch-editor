/** Provides the Stage's Finish picture service; called once by the route that owns the Stage. */
import { setContext } from 'svelte';
import { createFinishTiles, type FinishTiles } from '$lib/render/materials/finish-tiles.svelte';
import { FINISH_TILES_CONTEXT_KEY } from './finish-tiles-context';

export function provideFinishTiles(): FinishTiles {
	const tiles = createFinishTiles();
	setContext(FINISH_TILES_CONTEXT_KEY, tiles);
	return tiles;
}
