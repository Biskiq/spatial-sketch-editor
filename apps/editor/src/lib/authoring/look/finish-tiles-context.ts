/**
 * The Stage's Finish picture service, read by the shelf, the Finish Card and the
 * Stage-mounted renderer. Readers name the service by type only, so a Card that
 * shows a tile never reaches the renderer; the route provides it
 * (`finish-tiles-provider`).
 */
import { getContext } from 'svelte';
import type { FinishTiles } from '$lib/render/materials/finish-tiles.svelte';

export const FINISH_TILES_CONTEXT_KEY = Symbol('biskiq.finish-tiles');

/** The nearest service, or null where none is provided (a harness, a test). */
export function tryUseFinishTiles(): FinishTiles | null {
	try {
		return getContext<FinishTiles | undefined>(FINISH_TILES_CONTEXT_KEY) ?? null;
	} catch {
		return null;
	}
}
