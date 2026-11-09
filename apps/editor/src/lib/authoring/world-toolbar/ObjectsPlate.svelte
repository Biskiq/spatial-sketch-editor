<script lang="ts">
	/**
	 * Objects is the landed Furnish row. The Library and the selected object's
	 * identity stay on the panels that already own them; this plate only opens the
	 * real Objects instrument, so a tile never becomes a second placement writer.
	 */
	import WorldIcon from './WorldIcon.svelte';
	import { assets } from '$lib/content/assets';

	let { onOpen }: { onOpen: (assetId: string) => void } = $props();
	const approved = assets.filter((asset) => asset.status === 'approved').slice(0, 5);
</script>

<div class="objects-plate" data-objects-plate>
	{#each approved as asset (asset.id)}
		<button type="button" class="object" title={`Open ${asset.name} in Objects`} onclick={() => onOpen(asset.id)}>
			<WorldIcon name="object" size={18} />
			<span>{asset.name}</span>
		</button>
	{/each}
	<button type="button" class="panel" onclick={() => onOpen('')}>
		<WorldIcon name="library" size={18} />
		<span>Objects panel</span>
	</button>
</div>

<style>
	.objects-plate {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		overflow-x: auto;
		scrollbar-width: none;
	}
	button {
		display: grid;
		grid-template-columns: auto auto;
		align-items: center;
		gap: 6px;
		flex: none;
		height: 32px;
		max-width: 150px;
		padding: 0 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink-2);
		font: var(--shell-text-label)/1 var(--shell-sans);
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	button span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button.panel {
		margin-left: auto;
		color: var(--shell-ink-2);
	}
	button:focus-visible {
		outline: var(--shell-focus-ring-light);
		outline-offset: -2px;
	}
</style>
