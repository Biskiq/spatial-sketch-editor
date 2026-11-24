<script lang="ts">
	/**
	 * Studio's World placements, verbatim: the Place-copy transfer strip, then the
	 * scope strip with its Root panel. Each mount condition stays here, and this
	 * component adds no DOM of its own.
	 */
	import StudioScopeStrip from './StudioScopeStrip.svelte';
	import StudioRootPanel from './StudioRootPanel.svelte';
	import StudioTransferStrip from './StudioTransferStrip.svelte';
	import type { StudioRootView, StudioScopeView, StudioTransferView } from './studio-view';

	let {
		previewing = false,
		lens = 'world',
		ready = false,
		transfer = null,
		scope = null,
		root = null,
		canUndo = false,
		onUndo
	}: {
		readonly previewing?: boolean;
		readonly lens?: 'world' | 'experience';
		readonly ready?: boolean;
		readonly transfer?: StudioTransferView | null;
		readonly scope?: StudioScopeView | null;
		readonly root?: StudioRootView | null;
		readonly canUndo?: boolean;
		readonly onUndo: () => void;
	} = $props();
</script>

{#if ready && !previewing && lens === 'world' && transfer !== null && scope === null}
	<StudioTransferStrip {...transfer} />
{/if}

{#if !previewing && lens === 'world' && scope !== null && root !== null}
	<StudioScopeStrip {...scope} />
	<StudioRootPanel {...root} {canUndo} {onUndo} />
{/if}
