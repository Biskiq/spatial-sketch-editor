<script lang="ts">
	import { setContext } from 'svelte';
	import StagePaintTray from '$lib/authoring/stage/shell/StagePaintTray.svelte';
	import { FINISH_TILES_CONTEXT_KEY } from '$lib/authoring/look/finish-tiles-context';
	import type { PaintSwatch, PaintTrayView } from '$lib/authoring/look/finish-authoring.svelte';
	import type { PaintTrayState } from '$lib/authoring/look/paint-tray-state.svelte';
	import type { FinishTiles, FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';

	let {
		tiles,
		first,
		view,
		onPick,
		tileSource
	}: {
		tiles: FinishTiles;
		first: PaintTrayView;
		view: PaintTrayState;
		onPick: (swatch: PaintSwatch) => void;
		tileSource: (finishId: string) => FinishTileSource | null;
	} = $props();
	// svelte-ignore state_referenced_locally
	let tray = $state<PaintTrayView>(first);
	// svelte-ignore state_referenced_locally
	setContext(FINISH_TILES_CONTEXT_KEY, tiles);

	/** The test's hand on the Finish service: a new tray view (another pick). */
	export function show(next: PaintTrayView): void {
		tray = next;
	}
</script>

<StagePaintTray
	{tray}
	{view}
	radius="surface"
	{onPick}
	onColour={() => {}}
	onFavourite={() => {}}
	onDropper={() => {}}
	onRadius={() => {}}
	onLibrary={() => {}}
	{tileSource}
/>
