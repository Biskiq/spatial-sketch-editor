<script lang="ts">
	import { setContext } from 'svelte';
	import FinishTile from '$lib/authoring/look/FinishTile.svelte';
	import type { FinishTiles, FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import { FINISH_TILES_CONTEXT_KEY } from '$lib/authoring/look/finish-tiles-context';

	let { tiles, first }: { tiles: FinishTiles; first: FinishTileSource | null } = $props();
	// svelte-ignore state_referenced_locally
	let source = $state<FinishTileSource | null>(first);
	// svelte-ignore state_referenced_locally
	setContext(FINISH_TILES_CONTEXT_KEY, tiles);

	/** The test's hand on the shelf: choose another Finish. */
	export function choose(next: FinishTileSource | null): void {
		source = next;
	}
</script>

<FinishTile {source} color="#808080" size={32} label="probe" />
